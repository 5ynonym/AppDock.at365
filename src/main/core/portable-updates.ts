import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { compareVersions, parseVersion } from '../../shared/versions';
import { validateUpdateSource } from '../../shared/update-sources';
import { readManifest } from './extensions';
import type { UpdateResult, UpdateState, UpdateSettings } from '../../shared/contracts';

const execute = promisify(execFile);
const limit = 512 * 1024 * 1024;
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export interface UpdateTarget {
  id: string;
  name: string;
  version: string;
  source: string;
  destination: string;
  kind: 'host' | 'applet';
}
interface Feed {
  schemaVersion: 1;
  kind: 'host' | 'applet';
  id: string;
  version: string;
  minimumHostVersion?: string;
  payload: { file: string; sha256: string; size: number; format: 'exe' | 'zip' };
}
interface Candidate {
  target: UpdateTarget;
  feed?: Feed;
  payload?: string;
  directory?: string;
  version: string;
}
const json = (bytes: Buffer) => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
export function safeRelative(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length < 512 &&
    !/[\\:\x00-\x1f]/.test(value) &&
    !value.startsWith('/') &&
    value
      .split('/')
      .every(
        (part) =>
          !!part &&
          part !== '.' &&
          part !== '..' &&
          !/[. ]$/.test(part) &&
          !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part),
      )
  );
}
async function readBounded(
  location: string,
  max: number,
  fetcher: Fetcher,
  signal?: AbortSignal,
  progress?: (received: number) => void,
): Promise<Buffer> {
  const combined = AbortSignal.any([
    AbortSignal.timeout(max <= 1024 * 1024 ? 10000 : 120000),
    ...(signal ? [signal] : []),
  ]);
  combined.throwIfAborted();
  let stream: AsyncIterable<Uint8Array>;
  if (!/^https?:/i.test(location)) {
    const stat = await fs.stat(location);
    if (!stat.isFile() || stat.size > max)
      throw Error('更新ファイルが大きすぎるか、通常ファイルではありません。');
    stream = createReadStream(location, { signal: combined });
  } else {
    const response = await fetcher(location, { signal: combined, redirect: 'follow' });
    if (!response.ok) throw Error(`更新ファイルを取得できませんでした (HTTP ${response.status})。`);
    if (new URL(response.url || location).protocol !== new URL(location).protocol)
      throw Error('更新URLの転送で通信方式が変更されました。');
    if (!response.body) throw Error('更新ファイルの内容がありません。');
    stream = response.body as unknown as AsyncIterable<Uint8Array>;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    combined.throwIfAborted();
    size += chunk.length;
    if (size > max) throw Error('更新ファイルが大きすぎます。');
    chunks.push(Buffer.from(chunk));
    progress?.(size);
  }
  combined.throwIfAborted();
  return Buffer.concat(chunks);
}
function validateFeed(value: any, target: UpdateTarget): Feed {
  if (value?.schemaVersion !== 1 || value.kind !== target.kind || value.id !== target.id)
    throw Error('更新情報の対象ID・配布形式が一致しません。');
  parseVersion(value.version);
  if (value.minimumHostVersion !== undefined) parseVersion(value.minimumHostVersion);
  const p = value.payload;
  if (
    !p ||
    !safeRelative(p.file) ||
    !/^[a-f0-9]{64}$/i.test(p.sha256) ||
    !Number.isSafeInteger(p.size) ||
    p.size <= 0 ||
    p.size > limit ||
    p.format !== (target.kind === 'host' ? 'exe' : 'zip')
  )
    throw Error('更新情報の配布ファイル・ハッシュ・サイズが正しくありません。');
  return value;
}
async function copyTree(
  source: string,
  destination: string,
  signal: AbortSignal,
  progress: (bytes: number) => void,
  budget = { bytes: 0, files: 0 },
) {
  signal.throwIfAborted();
  const stat = await fs.lstat(source);
  if (stat.isSymbolicLink()) throw Error('更新元のリンクは使用できません。');
  if (stat.isDirectory()) {
    await fs.mkdir(destination, { recursive: true });
    for (const entry of await fs.readdir(source)) {
      if (!safeRelative(entry)) throw Error('更新元に使用できないファイル名があります。');
      // Generated update packages are distribution metadata, not installed Applet files.
      if (entry === 'update.json' || entry === 'update.zip') continue;
      await copyTree(
        path.join(source, entry),
        path.join(destination, entry),
        signal,
        progress,
        budget,
      );
    }
  } else {
    if (!stat.isFile() || ++budget.files > 10000 || (budget.bytes += stat.size) > limit)
      throw Error('更新元のファイル数・サイズが上限を超えました。');
    await fs.copyFile(source, destination);
    signal.throwIfAborted();
    progress(budget.bytes);
  }
}
async function treeHash(directory: string, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  const files: string[] = [];
  async function walk(current: string) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isSymbolicLink()) throw Error('準備済み更新にリンクがあります。');
      if (entry.isDirectory()) await walk(file);
      else files.push(path.relative(directory, file).replace(/\\/g, '/'));
    }
  }
  await walk(directory);
  const hashes = await Promise.all(
    files.sort().map(
      async (file) =>
        `${file}\0${createHash('sha256')
          .update(await fs.readFile(path.join(directory, file), { signal }))
          .digest('hex')}\n`,
    ),
  );
  return createHash('sha256').update(hashes.join('')).digest('hex');
}
export class PortableUpdates {
  state: UpdateState = { busy: false, phase: '', results: [] };
  private controller?: AbortController;
  cancel(): boolean {
    if (!this.state.busy || !this.state.cancellable || !this.controller) return false;
    this.state.cancellable = false;
    this.state.phase = '更新を取り消しています…';
    this.controller.abort();
    this.options.changed();
    return true;
  }
  constructor(
    private options: {
      targets(): UpdateTarget[];
      settings(): UpdateSettings;
      hostVersion: string;
      helper: string;
      executable: string;
      restartArgs: string[];
      baseDirectory: string;
      stateDirectory?: string;
      fetcher?: Fetcher;
      changed(): void;
      confirm(names: string[]): Promise<boolean>;
      shutdown(): void;
      processIds(): number[];
      log(message: string): void;
    },
  ) {}
  private get fetcher() {
    return this.options.fetcher ?? fetch;
  }
  private update(result: UpdateResult) {
    this.state.results = [...this.state.results.filter((item) => item.id !== result.id), result];
    this.options.changed();
  }
  private async candidate(
    target: UpdateTarget,
    hostVersion: string,
  ): Promise<Candidate | undefined> {
    const source = target.source.trim();
    validateUpdateSource(source);
    if (!source) return;
    let feedLocation = source;
    let assets: any[] | undefined;
    const github =
      source.match(/^github:(.+)$/i) ??
      source.match(
        /^https:\/\/github\.com\/([^/]+\/[^/]+)(?:\/releases(?:\/latest|\/tag\/([^/]+))?\/?)?$/i,
      );
    if (github) {
      const endpoint = github[2] ? `tags/${encodeURIComponent(github[2])}` : 'latest';
      const release = json(
        await readBounded(
          `https://api.github.com/repos/${github[1]}/releases/${endpoint}`,
          1024 * 1024,
          this.fetcher,
          this.controller?.signal,
        ),
      );
      if (release.draft || release.prerelease) throw Error('正式版のリリースではありません。');
      assets = release.assets;
      const info = assets?.find((asset) => asset.name === 'update.json');
      if (!info) throw Error('リリースに update.json がありません。');
      feedLocation = info.browser_download_url;
    } else if (/^https?:/i.test(source) && source.endsWith('/'))
      feedLocation = new URL('update.json', source).href;
    else if (!/^https?:/i.test(source)) {
      const stat = await fs.stat(source);
      if (stat.isDirectory()) {
        feedLocation = path.join(source, 'update.json');
        // Existing Applet publish folders work even before publishing a feed/ZIP.
        if (target.kind === 'applet' && !(await fs.stat(feedLocation).catch(() => null))) {
          const manifest = json(
            await readBounded(
              path.join(source, 'extension.json'),
              1024 * 1024,
              this.fetcher,
              this.controller?.signal,
            ),
          );
          if (manifest.id !== target.id || manifest.apiVersion !== 1)
            throw Error('更新元AppletのIDが一致しません。');
          parseVersion(manifest.version);
          if (
            manifest.minimumHostVersion &&
            compareVersions(manifest.minimumHostVersion, hostVersion) > 0
          )
            throw Error(
              `AppDock ${manifest.minimumHostVersion} 以降が必要です。先に本体を更新してください。`,
            );
          return { target, directory: source, version: manifest.version };
        }
      }
    }
    const feed = validateFeed(
      json(await readBounded(feedLocation, 1024 * 1024, this.fetcher, this.controller?.signal)),
      target,
    );
    if (feed.minimumHostVersion && compareVersions(feed.minimumHostVersion, hostVersion) > 0)
      throw Error(
        `AppDock ${feed.minimumHostVersion} 以降が必要です。先に本体を更新してください。`,
      );
    let payload: string;
    if (assets) {
      const asset = assets.find((item) => item.name === feed.payload.file);
      if (!asset || !/^https:\/\//i.test(asset.browser_download_url))
        throw Error('リリースの配布ファイルがありません。');
      payload = asset.browser_download_url;
    } else
      payload = /^https?:/i.test(feedLocation)
        ? new URL(feed.payload.file, feedLocation).href
        : path.join(path.dirname(feedLocation), feed.payload.file);
    return { target, feed, payload, version: feed.version };
  }
  private async checkTarget(
    target: UpdateTarget,
    hostVersion = this.options.hostVersion,
  ): Promise<{ result: UpdateResult; candidate?: Candidate }> {
    const github =
      target.source.match(/^github:(.+)$/i) ??
      target.source.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)(?:\/releases.*)?$/i);
    const base = {
      id: target.id,
      name: target.name,
      currentVersion: target.version,
      checkedAt: new Date().toISOString(),
      releaseUrl: github ? `https://github.com/${github[1]}/releases` : undefined,
    };
    try {
      const candidate = await this.candidate(target, hostVersion);
      if (!candidate) return { result: { ...base, status: 'unsupported' } };
      const comparison = compareVersions(candidate.version, target.version);
      const installable =
        comparison > 0 || (comparison === 0 && this.options.settings().allowSameVersion);
      return {
        candidate,
        result: {
          ...base,
          status: comparison > 0 ? 'available' : 'current',
          latestVersion: candidate.version,
          installable,
        },
      };
    } catch (error) {
      this.controller?.signal.throwIfAborted();
      return {
        result: {
          ...base,
          status: /先に本体/.test(String(error)) ? 'incompatible' : 'error',
          message: String(error).replace(/^Error: /, ''),
        },
      };
    }
  }
  private begin(phase: string) {
    if (this.state.busy) throw Error('更新処理が進行中です。');
    this.controller = new AbortController();
    this.state.busy = true;
    this.state.cancellable = true;
    this.state.progress = undefined;
    this.state.completion = undefined;
    this.state.notice = undefined;
    this.state.phase = phase;
    this.options.changed();
  }
  private notice(kind: NonNullable<UpdateState['notice']>['kind'], message: string) {
    this.state.notice = { id: randomUUID(), kind, message };
  }
  private checkedNotice(results: UpdateResult[]) {
    const available = results.filter((result) => result.status === 'available');
    const failed = results.filter(
      (result) => result.status === 'error' || result.status === 'incompatible',
    );
    const skipped = results.filter(
      (result) => result.status === 'unsupported' || result.status === 'unpublished',
    );
    const updates =
      available.length === 1
        ? `${available[0].name} ${available[0].latestVersion} に更新できます。`
        : `${available.length}件の更新があります。`;
    if (failed.length)
      this.notice(
        'error',
        `${available.length ? `${updates} ` : ''}${failed.length}件の更新を確認できませんでした。${failed[0].name}: ${failed[0].message ?? '更新元を確認してください。'}`,
      );
    else if (available.length)
      this.notice(
        'available',
        `${updates}${skipped.length ? ` ${skipped.length}件は更新元が未設定または未公開です。` : ''}`,
      );
    else if (skipped.length)
      this.notice(
        'info',
        `確認できた対象に更新はありません。${skipped.length}件は更新元が未設定または未公開です。`,
      );
    else
      this.notice(
        'info',
        results.length
          ? '更新はありません。最新版を使用しています。'
          : '更新を確認する対象がありません。',
      );
  }
  async check(ids?: string[], silent = false): Promise<UpdateState> {
    this.begin('更新を確認中…');
    try {
      const results: UpdateResult[] = [];
      for (const target of this.options.targets().filter((t) => !ids || ids.includes(t.id))) {
        const { result } = await this.checkTarget(target);
        results.push(result);
        this.update(result);
      }
      if (!silent) this.checkedNotice(results);
      this.state.phase = '';
    } catch (error) {
      if (!this.controller?.signal.aborted) {
        this.notice('error', String(error).replace(/^Error: /, ''));
        throw error;
      }
      this.state.phase = '更新確認を取り消しました。';
      if (!silent) this.notice('info', this.state.phase);
    } finally {
      this.state.busy = false;
      this.state.cancellable = false;
      this.controller = undefined;
      this.options.changed();
    }
    return structuredClone(this.state);
  }
  async install(scope: string): Promise<UpdateState> {
    this.begin('更新を準備中…');
    const signal = this.controller!.signal;
    let temporary: string | undefined;
    let handedOff = false;
    try {
      const targets = this.options
        .targets()
        .filter(
          (t) => scope === 'all' || (scope === 'applets' ? t.kind === 'applet' : t.id === scope),
        );
      // Check the host first so Applets can use the version installed in this same transaction.
      if (scope === 'all')
        targets.sort((a, b) => Number(b.kind === 'host') - Number(a.kind === 'host'));
      if (!targets.length) throw Error('更新対象がありません。');
      if (!this.options.executable) throw Error('更新の適用は配布版のAppDockで行ってください。');
      const candidates: Candidate[] = [];
      const results: UpdateResult[] = [];
      let hostVersion = this.options.hostVersion;
      for (const target of targets) {
        signal.throwIfAborted();
        const checked = await this.checkTarget(target, hostVersion);
        results.push(checked.result);
        this.update(checked.result);
        if (checked.candidate && checked.result.installable) {
          candidates.push(checked.candidate);
          if (target.kind === 'host') hostVersion = checked.candidate.version;
        }
      }
      if (!candidates.length) {
        this.state.phase = '適用できる更新はありません。';
        this.checkedNotice(results);
        return { ...structuredClone(this.state), busy: false, cancellable: false };
      }
      temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'AppDock-update-'));
      const helper = path.join(temporary, 'AppDock.Updater.exe');
      await fs.copyFile(this.options.helper, helper);
      const items: {
        kind: string;
        id: string;
        version: string;
        source: string;
        destination: string;
        sha256?: string;
      }[] = [];
      for (const [index, candidate] of candidates.entries()) {
        signal.throwIfAborted();
        this.state.phase = `${candidate.target.name} を取得中…`;
        this.state.progress = {
          id: candidate.target.id,
          name: candidate.target.name,
          index: index + 1,
          count: candidates.length,
          receivedBytes: 0,
          totalBytes: candidate.feed?.payload.size,
        };
        this.options.changed();
        let lastNotice = 0;
        const report = (receivedBytes: number) => {
          this.state.progress!.receivedBytes = receivedBytes;
          if (Date.now() - lastNotice >= 100 || receivedBytes === this.state.progress!.totalBytes) {
            lastNotice = Date.now();
            this.options.changed();
          }
        };
        const staged = path.join(temporary, `payload-${index}`);
        if (candidate.directory) await copyTree(candidate.directory, staged, signal, report);
        else {
          const data = await readBounded(candidate.payload!, limit, this.fetcher, signal, report);
          this.state.phase = `${candidate.target.name} を検証中…`;
          this.options.changed();
          const hash = createHash('sha256').update(data).digest('hex');
          if (
            data.length !== candidate.feed!.payload.size ||
            hash.toLowerCase() !== candidate.feed!.payload.sha256.toLowerCase()
          )
            throw Error(`${candidate.target.name}: 配布ファイルのサイズ・ハッシュが一致しません。`);
          if (candidate.target.kind === 'host') await fs.writeFile(staged, data, { flag: 'wx' });
          else {
            const archive = `${staged}.zip`;
            await fs.writeFile(archive, data, { flag: 'wx' });
            await execute(helper, ['--extract', archive, staged], {
              windowsHide: true,
              timeout: 120000,
              signal,
            });
          }
        }
        if (candidate.target.kind === 'applet') {
          const m = json(
            await readBounded(
              path.join(staged, 'extension.json'),
              1024 * 1024,
              this.fetcher,
              this.controller?.signal,
            ),
          );
          if (
            m.id !== candidate.target.id ||
            m.version !== candidate.version ||
            m.apiVersion !== 1 ||
            !safeRelative(m.entry)
          )
            throw Error('展開したAppletのID・版・エントリーが更新情報と一致しません。');
          if (!['node', 'native', 'dotnet'].includes(m.runtime))
            throw Error('Appletの実行形式が正しくありません。');
          if (m.minimumHostVersion && compareVersions(m.minimumHostVersion, hostVersion) > 0)
            throw Error('更新するAppletに必要な本体バージョンが不足しています。');
          await fs.access(path.join(staged, m.entry));
          readManifest(staged);
        } else {
          const header = await fs.readFile(staged);
          if (header[0] !== 0x4d || header[1] !== 0x5a)
            throw Error('本体の配布ファイルがEXEではありません。');
        }
        items.push({
          kind: candidate.target.kind,
          id: candidate.target.id,
          version: candidate.version,
          source: staged,
          destination: candidate.target.destination,
          sha256:
            candidate.target.kind === 'host'
              ? candidate.feed!.payload.sha256
              : await treeHash(staged, signal),
        });
      }
      signal.throwIfAborted();
      this.state.cancellable = false;
      this.state.progress = undefined;
      this.state.phase = '更新内容の確認を待っています…';
      this.options.changed();
      if (
        !(await this.options.confirm(
          candidates.map((c) => `${c.target.name} ${c.target.version} → ${c.version}`),
        ))
      ) {
        this.state.phase = '更新を取り消しました。';
        this.notice('info', this.state.phase);
        return { ...structuredClone(this.state), busy: false, cancellable: false };
      }
      this.state.phase = '再起動を準備中…';
      this.options.changed();
      const job = {
        schemaVersion: 1,
        baseDirectory: this.options.baseDirectory,
        executable: this.options.executable,
        args: this.options.restartArgs,
        processIds: this.options.processIds(),
        items,
        stateDirectory: this.options.stateDirectory,
        result: path.join(
          this.options.stateDirectory || path.join(this.options.baseDirectory, 'data'),
          'update-result.json',
        ),
      };
      const jobPath = path.join(temporary, 'job.json');
      await fs.writeFile(jobPath, JSON.stringify(job));
      const child = spawn(helper, ['--apply', jobPath], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      let failure: Error | undefined;
      child.once('error', (error) => {
        failure = error;
      });
      for (let attempt = 0; attempt < 100; attempt++) {
        if (failure) throw failure;
        if (await fs.stat(`${jobPath}.ready`).catch(() => null)) break;
        if (child.exitCode !== null || attempt === 99)
          throw Error('更新ミニプログラムを開始できませんでした。');
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      // Commit only after the helper validated the entire job. No payload may be applied before this marker.
      await fs.writeFile(`${jobPath}.commit`, 'apply');
      child.unref();
      handedOff = true;
      this.state.phase = '終了して更新を適用します…';
      this.options.changed();
      this.options.shutdown();
      return structuredClone(this.state);
    } catch (error) {
      if (signal.aborted) {
        this.state.phase = '更新を取り消しました。インストール済みのファイルは変更していません。';
        this.notice('info', this.state.phase);
      } else {
        this.state.phase = String(error).replace(/^Error: /, '');
        this.notice('error', this.state.phase);
        throw error;
      }
    } finally {
      if (!handedOff) {
        if (temporary) await fs.rm(temporary, { recursive: true, force: true }).catch(() => {});
        this.state.busy = false;
        this.state.cancellable = false;
        this.state.progress = undefined;
        this.controller = undefined;
        this.options.changed();
      }
    }
    return structuredClone(this.state);
  }
  scheduleStartup(
    smoke: boolean,
    notify: (results: UpdateResult[]) => void,
  ): ReturnType<typeof setTimeout> | undefined {
    const settings = this.options.settings();
    const ids = this.options
      .targets()
      .filter((t) =>
        t.kind === 'host' ? settings.checkHostOnStartup : settings.checkAppletsOnStartup,
      )
      .map((t) => t.id);
    if (smoke || !ids.length) return;
    return setTimeout(() => {
      const current = this.options.settings();
      const currentIds = this.options
        .targets()
        .filter((target) =>
          target.kind === 'host' ? current.checkHostOnStartup : current.checkAppletsOnStartup,
        )
        .map((target) => target.id);
      void this.check(currentIds, true)
        .then(() => {
          if (this.options.settings().notifyOnStartup)
            notify(
              this.state.results.filter(
                (r) => r.status === 'available' && currentIds.includes(r.id!),
              ),
            );
        })
        .catch((error) => this.options.log(String(error)));
    }, settings.startupDelaySeconds * 1000);
  }
}
