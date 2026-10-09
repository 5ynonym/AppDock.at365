import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { atomicWrite, type SettingsStore } from './settings';
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
  constructor(readonly file: string) {}
  private read() {
    const text = fs.readFileSync(this.file, 'utf8').replace(/^\uFEFF/, '');
    if (Buffer.byteLength(text) > 65536) throw Error('Webアカウントの保存ファイルが大きすぎます。');
    const raw = JSON.parse(text);
    if (raw?.schemaVersion !== 1) throw Error('Webアカウントの保存形式に対応していません。');
    const accounts = parseWebProfiles(raw.accounts);
    const pending = raw.pendingDeletion ?? [];
    if (
      !Array.isArray(pending) ||
      pending.some((id) => !profileId(id) || accounts.some((a) => a.id === id)) ||
      new Set(pending).size !== pending.length
    )
      throw Error('Webアカウントの削除待ち記録が不正です。');
    return { accounts, pendingDeletion: pending as string[] };
  }
  load(settings: SettingsStore) {
    const legacy = JSON.parse(fs.readFileSync(settings.file, 'utf8').replace(/^\uFEFF/, ''))
      ?.webApplets?.accounts;
    if (fs.existsSync(this.file)) {
      const saved = this.read();
      this.value = saved.accounts;
      this.pending = saved.pendingDeletion;
    } else {
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
  snapshot() {
    return structuredClone(this.value);
  }
  get(id: unknown) {
    const result = profileId(id) ? this.value.find((a) => a.id === id) : undefined;
    if (!result) throw Error('Webアカウント枠がありません。');
    return { ...result };
  }
  private unchanged() {
    if (
      JSON.stringify(this.read()) !==
      JSON.stringify({ accounts: this.value, pendingDeletion: this.pending })
    )
      throw Error('Webアカウントが別の場所で変更されました。再起動して読み直してください。');
  }
  private save(next: WebProfile[], pending = this.pending) {
    this.unchanged();
    const validated = parseWebProfiles(next);
    const text =
      JSON.stringify({ schemaVersion: 1, accounts: validated, pendingDeletion: pending }, null, 2) +
      '\n';
    if (Buffer.byteLength(text) > 65536) throw Error('Webアカウントの保存ファイルが大きすぎます。');
    atomicWrite(this.file, text);
    this.value = validated;
    this.pending = [...pending];
  }
  add(rawName: unknown) {
    const account = { id: `account.${randomUUID()}`, name: webProfileName(rawName) };
    this.save([...this.value, account]);
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
    return [...this.pending];
  }
  cleanupSessions(referenced: Iterable<string>, live: Iterable<string> = []) {
    const blocked = new Set([...referenced, ...live]);
    const root = path.resolve(path.dirname(this.file), 'sessions');
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
      this.save(
        this.value,
        this.pending.filter((p) => p !== id),
      );
    }
    return this.pendingDeletion();
  }
}
