import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { atomicWrite, type SettingsStore } from './settings';
import { observeFile } from './file-observer';
import {
  parseWebProfiles,
  profileId,
  webProfileName,
  type WebProfile,
} from '../../shared/web-applets';

/** Account operations own their file and never change the settings revision. */
export class WebProfileStore {
  private value: WebProfile[] = [];
  private pending: string[] = [];
  private observer?: ReturnType<typeof observeFile>;
  private settings?: SettingsStore;
  constructor(
    readonly file: string,
    private localDirectory?: string,
  ) {}
  private get pendingFile() {
    return this.localDirectory && path.join(this.localDirectory, 'pending-deletion.json');
  }
  private read(received?: string) {
    if (received === undefined && !fs.existsSync(this.file) && this.value.length === 0)
      return { accounts: [], pendingDeletion: [...this.pending] };
    const text = (received ?? fs.readFileSync(this.file, 'utf8')).replace(/^\uFEFF/, '');
    if (Buffer.byteLength(text) > 65536) throw Error('Webアカウントの保存ファイルが大きすぎます。');
    const raw = JSON.parse(text);
    if (raw?.schemaVersion !== 1) throw Error('Webアカウントの保存形式に対応していません。');
    const accounts = parseWebProfiles(raw.accounts);
    const pending = this.pendingFile
      ? fs.existsSync(this.pendingFile)
        ? JSON.parse(fs.readFileSync(this.pendingFile, 'utf8'))
        : []
      : (raw.pendingDeletion ?? []);
    if (
      !Array.isArray(pending) ||
      pending.some(
        (id) => !profileId(id) || (!this.pendingFile && accounts.some((a) => a.id === id)),
      ) ||
      new Set(pending).size !== pending.length
    )
      throw Error('Webアカウントの削除待ち記録が不正です。');
    return { accounts, pendingDeletion: pending as string[] };
  }
  load(settings: SettingsStore) {
    this.settings = settings;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const legacy = settings.recovered
      ? undefined
      : JSON.parse(fs.readFileSync(settings.file, 'utf8').replace(/^\uFEFF/, ''))?.webApplets
          ?.accounts;
    if (fs.existsSync(this.file)) {
      const saved = this.read();
      this.value = saved.accounts;
      this.pending = saved.pendingDeletion;
    } else if (legacy !== undefined) {
      const migrated = parseWebProfiles(legacy ?? []);
      atomicWrite(
        this.file,
        JSON.stringify({ schemaVersion: 1, accounts: migrated }, null, 2) + '\n',
      );
      this.value = migrated;
    }
    // Only remove legacy metadata after the new file is successfully written.
    // Existing account IDs/session directories are not moved or recreated.
    if (legacy !== undefined) settings.save(settings.value, settings.revision);
  }
  watch(changed: () => void, failed: (error: Error) => void) {
    this.observer = observeFile(
      this.file,
      (text) => {
        const saved = this.read(text);
        if (JSON.stringify(saved.accounts) !== JSON.stringify(this.value)) {
          this.value = saved.accounts;
          changed();
        }
      },
      (error) => {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || this.value.length) failed(error);
      },
    );
  }
  close() {
    this.observer?.close();
  }
  snapshot() {
    return structuredClone(this.value);
  }
  get(id: unknown) {
    const result = profileId(id) ? this.value.find((a) => a.id === id) : undefined;
    if (!result) throw Error('Webアカウント枠がありません。');
    return { ...result };
  }
  private unchanged(allowEmptyInitialization = false) {
    if (
      !allowEmptyInitialization &&
      !fs.existsSync(this.file) &&
      this.settings?.value.webApplets.items.length
    )
      throw Error('Webアカウント一覧の同期を待っています。枠が届いてから操作してください。');
    if (
      JSON.stringify(this.read()) !==
      JSON.stringify({ accounts: this.value, pendingDeletion: this.pending })
    )
      throw Error(
        'Webアカウントが別の場所で変更されました。一覧の同期を待ってから操作してください。',
      );
  }
  private save(next: WebProfile[], pending = this.pending, allowEmptyInitialization = false) {
    this.unchanged(allowEmptyInitialization);
    const validated = parseWebProfiles(next);
    const text =
      JSON.stringify(
        {
          schemaVersion: 1,
          accounts: validated,
          ...(!this.pendingFile ? { pendingDeletion: pending } : {}),
        },
        null,
        2,
      ) + '\n';
    if (Buffer.byteLength(text) > 65536) throw Error('Webアカウントの保存ファイルが大きすぎます。');
    if (this.pendingFile) atomicWrite(this.pendingFile, JSON.stringify(pending));
    try {
      atomicWrite(this.file, text);
    } catch (error) {
      if (this.pendingFile) atomicWrite(this.pendingFile, JSON.stringify(this.pending));
      throw error;
    }
    this.value = validated;
    this.pending = [...pending];
  }
  add(rawName: unknown) {
    const account = { id: `account.${randomUUID()}`, name: webProfileName(rawName) };
    // A deliberate add can recover an empty roster left behind by old settings.
    // Still re-read any delivered file before saving; never initialize at startup.
    this.save([...this.value, account], this.pending, this.value.length === 0);
    return { ...account };
  }
  rename(id: unknown, rawName: unknown) {
    const a = this.get(id),
      name = webProfileName(rawName);
    this.save(this.value.map((p) => (p.id === a.id ? { ...p, name } : p)));
  }
  remove(id: unknown) {
    const a = this.get(id);
    // Removal and the cleanup record commit together, including after a crash.
    this.save(
      this.value.filter((p) => p.id !== a.id),
      [...this.pending, a.id],
    );
  }
  pendingDeletion() {
    return this.pending.filter((id) => !this.value.some((a) => a.id === id));
  }
  cleanupSessions(referenced: Iterable<string>, live: Iterable<string> = []) {
    const blocked = new Set([...referenced, ...live, ...this.value.map((a) => a.id)]);
    const root = path.resolve(this.localDirectory || path.dirname(this.file), 'sessions');
    for (const id of [...this.pending]) {
      if (blocked.has(id)) continue;
      this.unchanged();
      // Only a validated ID directly below our own, non-redirected session root.
      const target = path.resolve(root, id);
      if (!profileId(id) || path.dirname(target) !== root)
        throw Error('削除対象の保存先が不正です。');
      try {
        let rootStat: fs.Stats | undefined;
        try {
          rootStat = fs.lstatSync(root);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        if (rootStat) {
          const actual = fs.realpathSync(root);
          if (rootStat.isSymbolicLink() || actual.toLowerCase() !== root.toLowerCase())
            throw Error('保存先が別の場所へ転送されています。');
          if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink())
            throw Error('削除対象が別の場所へ転送されています。');
          fs.rmSync(target, { recursive: true, force: true });
        }
      } catch {
        // Locked/inaccessible files remain tracked for the next startup.
        continue;
      }
      if (this.pendingFile) {
        const remaining = this.pending.filter((p) => p !== id);
        atomicWrite(this.pendingFile, JSON.stringify(remaining));
        this.pending = remaining;
      } else
        this.save(
          this.value,
          this.pending.filter((p) => p !== id),
        );
    }
    return this.pendingDeletion();
  }
}
