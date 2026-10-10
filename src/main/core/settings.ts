import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { randomUUID, createHash } from 'node:crypto';
import { observeFile } from './file-observer';
import type { Settings, SettingsSnapshot, ExtensionSettings } from '../../shared/contracts';
import {
  createDefaultSettings as defaults,
  parseSettings as validate,
} from '../../shared/settings-schema';
const isObject = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
function atomicWrite(file: string, text: string | Uint8Array) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const readPrevious = () => {
    try {
      return fs.readFileSync(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  };
  const previous = readPrevious();
  const tmp = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tmp, text, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    for (let attempt = 0; ; attempt++) {
      if (attempt > 0) {
        const current = readPrevious();
        if (previous === undefined ? current !== undefined : !current?.equals(previous))
          throw Error('保存先が別の場所で変更されました。再取得してください。');
      }
      try {
        fs.renameSync(tmp, file);
        break;
      } catch (error) {
        if (
          process.platform !== 'win32' ||
          attempt >= 3 ||
          !['EPERM', 'EACCES', 'EBUSY'].includes((error as NodeJS.ErrnoException).code ?? '')
        )
          throw error;
        // Retry only the same atomic replacement, never the setting operation or a toggle.
        // Readers can briefly deny rename on Windows; preserve any intervening writer.
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25 * (attempt + 1));
      }
    }
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}
class SettingsStore extends EventEmitter {
  file: string;
  revision: number;
  value: Settings;
  watcher?: fs.FSWatcher;
  timer?: ReturnType<typeof setTimeout>;
  private observer?: ReturnType<typeof observeFile>;
  private lastBackup = '';
  private lastBackupTime = 0;
  syncError?: string;
  recovered = false;
  constructor(
    file: string,
    private backupDirectory?: string,
  ) {
    super();
    this.file = file;
    this.revision = 0;
    this.value = defaults();
  }
  private readDisk() {
    const stat = fs.statSync(this.file);
    if (!stat.isFile() || stat.size > 4 * 1024 * 1024)
      throw Error('設定ファイルは4MB以下の通常ファイルにしてください。');
    return validate(JSON.parse(fs.readFileSync(this.file, 'utf8').replace(/^\uFEFF/, '')));
  }
  load() {
    try {
      if (!fs.existsSync(this.file)) {
        if (
          this.backupDirectory &&
          fs.existsSync(path.join(this.backupDirectory, 'last-good.json'))
        )
          throw Error('設定ファイルがありません。');
        atomicWrite(this.file, JSON.stringify(this.value, null, 2) + '\n');
      }
      this.value = this.readDisk();
    } catch (error) {
      if (!this.backupDirectory) throw error;
      const files = fs.existsSync(this.backupDirectory)
        ? fs
            .readdirSync(this.backupDirectory)
            .filter((n) => /^settings-.*\.json$/.test(n))
            .sort()
            .reverse()
        : [];
      let restored: Settings | undefined;
      for (const name of ['last-good.json', ...files]) {
        try {
          restored = validate(
            JSON.parse(fs.readFileSync(path.join(this.backupDirectory, name), 'utf8')),
          );
          break;
        } catch {
          /* Try another validated generation. */
        }
      }
      if (!restored) throw error;
      this.value = restored;
      this.recovered = true;
      this.syncError =
        '設定を読み込めないため、このPCの正常なバックアップで動作しています。共有ファイルは変更していません。';
    }
    if (!this.recovered) {
      try {
        this.backup(this.value);
      } catch {
        this.syncError = '設定は読み込めましたが、このPCへのバックアップを保存できませんでした。';
      }
    }
    this.revision++;
    return this.snapshot();
  }
  snapshot(): SettingsSnapshot {
    return {
      value: structuredClone(this.value),
      revision: this.revision,
      path: this.file,
      syncError: this.syncError,
      recovered: this.recovered,
    };
  }
  private backup(value: Settings) {
    if (!this.backupDirectory) return;
    const text = JSON.stringify(value, null, 2) + '\n';
    const hash = createHash('sha256').update(text).digest('hex');
    if (hash === this.lastBackup) return;
    this.lastBackupTime = Math.max(Date.now(), this.lastBackupTime + 1);
    atomicWrite(
      path.join(this.backupDirectory, `settings-${this.lastBackupTime}-${randomUUID()}.json`),
      text,
    );
    atomicWrite(path.join(this.backupDirectory, 'last-good.json'), text);
    this.lastBackup = hash;
    const generations = fs
      .readdirSync(this.backupDirectory)
      .filter((n) => /^settings-.*\.json$/.test(n))
      .sort()
      .reverse();
    for (const old of generations.slice(20)) fs.unlinkSync(path.join(this.backupDirectory, old));
  }
  private accept(next: Settings) {
    const changed = JSON.stringify(next) !== JSON.stringify(this.value);
    const unhealthy = this.syncError || this.recovered;
    this.backup(next);
    this.syncError = undefined;
    this.recovered = false;
    if (changed) {
      this.value = next;
      this.revision++;
      this.emit('changed', this.snapshot());
    } else if (unhealthy) this.emit('statusChanged', this.snapshot());
  }
  assertRevision(revision: number) {
    // Also detect a manual edit before the file watcher has delivered it.
    const disk = this.readDisk();
    if (JSON.stringify(disk) !== JSON.stringify(this.value)) {
      this.accept(disk);
    }
    if (revision !== this.revision)
      throw new Error('設定が別の場所で変更されました。再読み込みしてから保存してください。');
  }
  save(value: unknown, revision: number, asset?: { commit(): void; rollback(): void }) {
    this.assertRevision(revision);
    const next = validate(value);
    this.backup(this.value);
    try {
      asset?.commit();
      atomicWrite(this.file, JSON.stringify(next, null, 2) + '\n');
    } catch (error) {
      try {
        asset?.rollback();
      } catch (rollbackError) {
        throw new Error(`${String(error)} / 画像の復元に失敗しました: ${String(rollbackError)}`);
      }
      throw error;
    }
    this.value = next;
    this.syncError = undefined;
    try {
      this.backup(next);
    } catch {
      this.syncError = '設定を保存しましたが、このPCへのバックアップを保存できませんでした。';
    }
    this.recovered = false;
    this.revision++;
    this.emit('changed', this.snapshot());
    return this.snapshot();
  }
  updateExtension(id: string, patch: Partial<ExtensionSettings>) {
    const v = structuredClone(this.value);
    const current = v.extensions[id] || { enabled: false, settings: {} };
    v.extensions[id] = { ...current, ...patch };
    return this.save(v, this.revision);
  }
  watch(onError: (error: Error) => void) {
    this.observer?.close();
    this.observer = observeFile(
      this.file,
      (text) => this.accept(validate(JSON.parse(text.replace(/^\uFEFF/, '')))),
      (error) => {
        this.syncError = '設定ファイルを読み込めません。最後の正常な設定を継続しています。';
        this.recovered = !!this.backupDirectory;
        this.emit('statusChanged', this.snapshot());
        onError(error);
      },
    );
  }
  restoreBackup(revision: number) {
    if (!this.recovered || revision !== this.revision)
      throw Error('復元する設定を再確認してください。');
    // A valid incoming sync update always wins over the fallback.
    let incoming: Settings | undefined;
    try {
      incoming = this.readDisk();
    } catch {
      /* Only an invalid or missing shared file can be explicitly restored. */
    }
    if (incoming) {
      this.accept(incoming);
      throw Error('正常な設定が届いたため、バックアップの復元を中止しました。');
    }
    if (this.backupDirectory && fs.existsSync(this.file)) {
      if (fs.statSync(this.file).size > 4 * 1024 * 1024)
        throw Error('破損ファイルが大きすぎます。手動で退避してから復元してください。');
      atomicWrite(
        path.join(this.backupDirectory, `invalid-${Date.now()}-${randomUUID()}.txt`),
        fs.readFileSync(this.file),
      );
    }
    atomicWrite(this.file, JSON.stringify(this.value, null, 2) + '\n');
    this.recovered = false;
    this.syncError = undefined;
    this.revision++;
    this.emit('changed', this.snapshot());
    return this.snapshot();
  }
  close() {
    clearTimeout(this.timer);
    this.watcher?.close();
    this.observer?.close();
  }
}
export { SettingsStore, defaults, validate, atomicWrite, isObject };
