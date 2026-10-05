import fs from 'node:fs';
import path from 'node:path';
import { Notification, safeStorage, shell } from 'electron';
import type { ExtensionInstance } from './extensions';
import type { SettingsStore } from './settings';
import { atomicWrite, isObject } from './settings';
import type { Panel } from '../../shared/contracts';
export function createHostApi(
  settings: SettingsStore,
  dataRoot: string,
  log: (level: string, source: string, message: string) => void,
  changed: () => void,
) {
  return async (e: ExtensionInstance, method: string, params: unknown): Promise<unknown> => {
    if (!isObject(params)) throw new Error('API引数はオブジェクトで指定してください。');
    const p = params;
    const id = e.manifest.id;
    if (['stopped', 'stopping', 'error'].includes(e.state))
      throw new Error('拡張は停止しています。');
    const requireCapability = (cap: string) => {
      if (!e.manifest.capabilities?.includes(cap))
        throw new Error(`manifest の capabilities に ${cap} が必要です。`);
    };
    const key = () => {
      if (
        typeof p.key !== 'string' ||
        !/^[a-zA-Z0-9._-]{1,100}$/.test(p.key) ||
        ['__proto__', 'constructor', 'prototype'].includes(p.key)
      )
        throw new Error('key の形式が正しくありません。');
      return p.key as string;
    };
    switch (method) {
      case 'host.log':
        log(
          ['info', 'warn', 'error'].includes(p.level) ? p.level : 'info',
          id,
          String(p.message ?? ''),
        );
        return null;
      case 'host.settings.get':
        return structuredClone(settings.value.extensions[id]?.settings ?? {});
      case 'host.settings.set': {
        requireCapability('settings');
        const k = key();
        const current = settings.value.extensions[id]?.settings ?? {};
        settings.updateExtension(id, { settings: { ...current, [k]: p.value } });
        return null;
      }
      case 'host.notifications.show':
        requireCapability('notifications');
        if (typeof p.title !== 'string' || typeof p.body !== 'string')
          throw new Error('title と body が必要です。');
        if (settings.value.host.notifications && Notification.isSupported())
          new Notification({ title: p.title.slice(0, 100), body: p.body.slice(0, 500) }).show();
        return null;
      case 'host.browser.open': {
        requireCapability('browser');
        const url = new URL(String(p.url));
        if (url.protocol !== 'https:' || url.username || url.password)
          throw new Error('ブラウザでは資格情報を含まないHTTPS URLを指定してください。');
        await shell.openExternal(url.href);
        return null;
      }
      case 'host.ui.panel': {
        requireCapability('ui');
        if (
          typeof p.title !== 'string' ||
          p.title.length > 200 ||
          (p.description !== undefined && typeof p.description !== 'string') ||
          (p.facts !== undefined &&
            (!Array.isArray(p.facts) ||
              p.facts.length > 30 ||
              p.facts.some(
                (f: unknown) =>
                  !isObject(f) || typeof f.label !== 'string' || typeof f.value !== 'string',
              ))) ||
          (p.actions !== undefined &&
            (!Array.isArray(p.actions) ||
              p.actions.length > 30 ||
              p.actions.some(
                (a: unknown) =>
                  !isObject(a) ||
                  typeof a.title !== 'string' ||
                  typeof a.command !== 'string' ||
                  !a.command.startsWith(id + '.'),
              )))
        )
          throw new Error('パネルの形式が正しくありません。');
        e.panel = structuredClone(p) as unknown as Panel;
        changed();
        return null;
      }
      case 'host.storage.get':
      case 'host.storage.set': {
        requireCapability('storage');
        const k = key();
        const file = path.join(dataRoot, 'storage', id, k + '.json');
        if (method.endsWith('.get'))
          return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
        const text = JSON.stringify(p.value ?? null);
        if (Buffer.byteLength(text) > 1024 * 1024) throw new Error('保存データは1MB以下です。');
        atomicWrite(file, text);
        return null;
      }
      case 'host.secrets.get':
      case 'host.secrets.set':
      case 'host.secrets.delete': {
        requireCapability('secrets');
        if (!safeStorage.isEncryptionAvailable())
          throw new Error('Windowsの暗号化機能を利用できません。');
        const file = path.join(dataRoot, 'secrets', id, key() + '.dat');
        if (method.endsWith('.get'))
          return fs.existsSync(file)
            ? safeStorage.decryptString(Buffer.from(fs.readFileSync(file, 'utf8'), 'base64'))
            : null;
        if (method.endsWith('.delete')) {
          if (fs.existsSync(file)) fs.unlinkSync(file);
          return null;
        }
        if (typeof p.value !== 'string' || p.value.length > 100000)
          throw new Error('secret は100,000文字以下の文字列です。');
        // Base64 is used only for the atomic writer, never exposed through the renderer.
        atomicWrite(file, safeStorage.encryptString(p.value).toString('base64'));
        return null;
      }
      default:
        throw new Error(`未対応のHost API: ${method}`);
    }
  };
}
