import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { atomicWrite } from './settings';
import { aiApprovalValue, aiObject, aiId, type AiConnectionSettings } from '../../shared/ai';
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
export class AiSecrets {
  constructor(
    private keysFile: string,
    private accessFile: string,
    private encryption: { encrypt(value: string): string; decrypt(value: string): string },
  ) {}
  private read(file: string): Record<string, { fingerprint: string; key?: string }> {
    try {
      if (fs.statSync(file).size > 262144) throw Error();
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw Error('AIのPC専用設定を読み取れません。');
    }
    try {
      const v = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (
        !aiObject(v) ||
        v.version !== 1 ||
        !aiObject(v.entries) ||
        Object.keys(v.entries).length > 128
      )
        throw Error();
      for (const [id, item] of Object.entries(v.entries)) {
        if (
          !aiId(id) ||
          !aiObject(item) ||
          typeof item.fingerprint !== 'string' ||
          !/^[a-f0-9]{64}$/.test(item.fingerprint) ||
          (item.key !== undefined && (typeof item.key !== 'string' || item.key.length > 32768)) ||
          Object.keys(item).some((k) => !['fingerprint', 'key'].includes(k))
        )
          throw Error();
      }
      return v.entries as Record<string, { fingerprint: string; key?: string }>;
    } catch {
      throw Error('AIのPC専用設定を読み取れません。ファイルを確認してください。');
    }
  }
  key(c: AiConnectionSettings): string | undefined {
    const v = this.read(this.keysFile)[c.id];
    if (!v || v.fingerprint !== hash(c.baseUrl) || v.key === undefined) return undefined;
    try {
      return this.encryption.decrypt(v.key);
    } catch {
      throw Error('AIのAPIキーを復号できません。再設定してください。');
    }
  }
  setKey(c: AiConnectionSettings, value: unknown) {
    if (typeof value !== 'string' || value.length > 8192 || /[\x00-\x1f\x7f]/.test(value))
      throw Error('APIキーは改行を含まない8192文字以下の文字列です。');
    const entries = this.read(this.keysFile);
    if (value) {
      if (!c.baseUrl) throw Error('APIキーの保存前に接続先を設定してください。');
      entries[c.id] = { fingerprint: hash(c.baseUrl), key: this.encryption.encrypt(value) };
    } else delete entries[c.id];
    if (Object.keys(entries).length > 128) throw Error('AIのAPIキー保存件数が上限に達しました。');
    atomicWrite(this.keysFile, JSON.stringify({ version: 1, entries }) + '\n');
  }
  allowed(c: AiConnectionSettings): boolean {
    try {
      return this.read(this.accessFile)[c.id]?.fingerprint === hash(aiApprovalValue(c));
    } catch {
      return false;
    }
  }
  setAllowed(c: AiConnectionSettings, allowed: unknown) {
    if (typeof allowed !== 'boolean') throw Error('AIの利用許可はON/OFFで指定してください。');
    if (allowed && !c.baseUrl) throw Error('利用許可の前に接続先を設定してください。');
    const entries = this.read(this.accessFile);
    if (allowed) entries[c.id] = { fingerprint: hash(aiApprovalValue(c)) };
    else delete entries[c.id];
    if (Object.keys(entries).length > 128)
      throw Error('AIの利用許可の保存件数が上限に達しました。');
    atomicWrite(this.accessFile, JSON.stringify({ version: 1, entries }) + '\n');
  }
  status(c: AiConnectionSettings) {
    try {
      const access = this.read(this.accessFile);
      return {
        id: c.id,
        apiKeyConfigured: !!this.key(c),
        allowed: access[c.id]?.fingerprint === hash(aiApprovalValue(c)),
      };
    } catch (e) {
      return {
        id: c.id,
        apiKeyConfigured: false,
        allowed: false,
        error: e instanceof Error ? e.message : 'AIのPC専用設定を確認してください。',
      };
    }
  }
}
