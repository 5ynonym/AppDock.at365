import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { Settings, SettingsSnapshot, ExtensionSettings } from '../../shared/contracts';
import {
  createDefaultSettings as defaults,
  parseSettings as validate,
} from '../../shared/settings-schema';
const isObject = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
function atomicWrite(file: string, text: string | Uint8Array) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tmp, text, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    fs.renameSync(tmp, file);
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
  constructor(file: string) {
    super();
    this.file = file;
    this.revision = 0;
    this.value = defaults();
  }
  load() {
    if (!fs.existsSync(this.file))
      atomicWrite(this.file, JSON.stringify(this.value, null, 2) + '\n');
    this.value = validate(JSON.parse(fs.readFileSync(this.file, 'utf8').replace(/^\uFEFF/, '')));
    this.revision++;
    return this.snapshot();
  }
  snapshot(): SettingsSnapshot {
    return { value: structuredClone(this.value), revision: this.revision, path: this.file };
  }
  assertRevision(revision: number) {
    // Also detect a manual edit before the file watcher has delivered it.
    const disk = validate(JSON.parse(fs.readFileSync(this.file, 'utf8').replace(/^\uFEFF/, '')));
    if (JSON.stringify(disk) !== JSON.stringify(this.value)) {
      this.value = disk;
      this.revision++;
      this.emit('changed', this.snapshot());
    }
    if (revision !== this.revision)
      throw new Error('設定が別の場所で変更されました。再読み込みしてから保存してください。');
  }
  save(value: unknown, revision: number, asset?: { commit(): void; rollback(): void }) {
    this.assertRevision(revision);
    const next = validate(value);
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
    this.watcher = fs.watch(path.dirname(this.file), (_, name) => {
      if (name && name.toString() !== path.basename(this.file)) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        try {
          const next = validate(
            JSON.parse(fs.readFileSync(this.file, 'utf8').replace(/^\uFEFF/, '')),
          );
          if (JSON.stringify(next) !== JSON.stringify(this.value)) {
            this.value = next;
            this.revision++;
            this.emit('changed', this.snapshot());
          }
        } catch (e) {
          onError(e instanceof Error ? e : new Error(String(e)));
        }
      }, 250);
    });
  }
  close() {
    clearTimeout(this.timer);
    this.watcher?.close();
  }
}
export { SettingsStore, defaults, validate, atomicWrite, isObject };
