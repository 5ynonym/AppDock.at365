import fs from 'node:fs';
import path from 'node:path';
import { imageDirectory, registerLocalImages } from './panel-images';
import { safeStorage, shell, dialog, nativeTheme } from 'electron';
import { showNotification } from './notifications';
import { queueSound } from './sounds';
import type { ExtensionInstance } from './extensions';
import type { SettingsStore } from './settings';
import { atomicWrite, isObject } from './settings';
import type { Panel } from '../../shared/contracts';
import { parseSettingOptions, validateSettingValue } from '../../shared/setting-definitions';
import { parseExtensionCommands } from '../../shared/extension-commands';
import { getWebAccounts } from './web-accounts';
import { safePageShortcut } from '../../shared/keybindings';
import { pathToFileURL } from 'node:url';
import { contained } from './extensions';
import { pageKey } from '../../shared/applet-pages';
import { openLocalPage, pageHostShortcut } from './applet-pages';
export function createHostApi(
  settings: SettingsStore,
  dataRoot: string,
  log: (level: string, source: string, message: string) => void,
  changed: () => void,
  commandsChanged: () => void = changed,
  executeCommand: (id: string) => Promise<unknown> = async () => {},
) {
  return async (e: ExtensionInstance, method: string, params: unknown): Promise<unknown> => {
    if (!isObject(params)) throw new Error('API引数はオブジェクトで指定してください。');
    const p = params;
    const id = e.manifest.id;
    const validAction = (action: unknown) =>
      isObject(action) &&
      typeof action.title === 'string' &&
      action.title.length <= 200 &&
      (action.selected == null || typeof action.selected === 'boolean') &&
      ((typeof action.command === 'string' &&
        action.command.startsWith(id + '.') &&
        !action.actionId) ||
        (typeof action.actionId === 'string' &&
          action.actionId.startsWith(id + '.') &&
          action.actionId.length <= 200 &&
          !action.command));
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
      case 'host.pages.open': {
        requireCapability('pages');
        const page = e.manifest.pages?.find((page) => page.id === p.id);
        if (!page || page.source !== 'local') throw Error('ローカルページがありません。');
        return openLocalPage(
          {
            appletId: id,
            key: pageKey(id, page.id),
            title: page.title,
            url: pathToFileURL(contained(e.manifest.folder, page.ui!)).href,
            preload: path.resolve(__dirname, '../applet-page-preload.js'),
            stateFile: path.join(dataRoot, 'pages', id, page.id, 'window-state.json'),
            defaultDisplay: page.defaultDisplay,
            partition: `applet-page-${id}-${page.id}`,
            onLayout: () => {},
            onCreated: (contents) =>
              contents.on('before-input-event', (event, input) => {
                if (safePageShortcut(input) && pageHostShortcut(input, id)) event.preventDefault();
              }),
          },
          {
            snapshot: () => ({
              dark: nativeTheme.shouldUseDarkColors,
              settings: e.manifest.capabilities?.includes('settings')
                ? Object.fromEntries(
                    (e.manifest.settings ?? []).map((definition) => [
                      definition.key,
                      settings.value.extensions[id]?.settings[definition.key] ?? definition.default,
                    ]),
                  )
                : {},
            }),
            execute: (command) => {
              if (
                e.state !== 'running' ||
                typeof command !== 'string' ||
                !e.commands.some((item) => item.id === command)
              )
                throw Error('自身の実行中コマンドだけを呼び出せます。');
              return executeCommand(command);
            },
            changed: (callback) => {
              settings.on('changed', callback);
              nativeTheme.on('updated', callback);
              return () => {
                settings.removeListener('changed', callback);
                nativeTheme.removeListener('updated', callback);
              };
            },
          },
        );
      }
      case 'host.webAccounts.start':
      case 'host.webAccounts.open':
      case 'host.webAccounts.cycle':
      case 'host.webAccounts.navigate':
      case 'host.webAccounts.read':
      case 'host.webAccounts.report': {
        requireCapability('web-accounts');
        const web = getWebAccounts(
          id,
          e.manifest.displayName ?? e.manifest.name,
          e.manifest.folder,
          dataRoot,
          e.manifest.webAccounts,
          {
            capabilities: e.manifest.capabilities ?? [],
            page: e.manifest.pages?.find((page) => page.source === 'web-accounts'),
            settings: () =>
              Object.fromEntries(
                (e.manifest.capabilities?.includes('settings') ? (e.manifest.settings ?? []) : [])
                  .filter(
                    (definition) =>
                      definition.type === 'boolean' ||
                      (definition.type === 'select' && !definition.dynamic),
                  )
                  .map((definition) => {
                    const value =
                      settings.value.extensions[id]?.settings[definition.key] ?? definition.default;
                    return [
                      definition.key,
                      definition.type === 'boolean'
                        ? value === true
                        : typeof value === 'string'
                          ? value
                          : '',
                    ];
                  }),
              ),
            setSetting: (key, value) => {
              requireCapability('settings');
              const definition = e.manifest.settings?.find(
                (definition) =>
                  definition.key === key &&
                  (definition.type === 'boolean' ||
                    (definition.type === 'select' && !definition.dynamic)),
              );
              if (!definition) throw Error('宣言されたboolean/静的select設定を指定してください。');
              validateSettingValue(definition, value);
              const current = settings.value.extensions[id]?.settings ?? {};
              settings.updateExtension(id, { settings: { ...current, [definition.key]: value } });
            },
            onSettingsChanged: (callback) => {
              settings.on('changed', callback);
              return () => settings.removeListener('changed', callback);
            },
            failed: (message) => log('error', id, message),
            shortcut: (input) => pageHostShortcut(input, id),
          },
        );
        if (method.endsWith('.start')) {
          await web.start();
          return null;
        }
        if (method.endsWith('.open')) {
          await web.open();
          return null;
        }
        if (method.endsWith('.cycle')) {
          await web.cycle(p.direction);
          return null;
        }
        if (method.endsWith('.navigate')) {
          await web.navigate(p.action);
          return null;
        }
        if (method.endsWith('.report')) {
          web.report(p.id as string, p.status as string, p.attention as boolean, p.data);
          return null;
        }
        return web.read();
      }
      case 'host.ui.pickFile': {
        requireCapability('file-dialog');
        if (p.kind !== 'json' && p.kind !== 'wav')
          throw new Error('JSONまたはWAVを指定してください。');
        const result = await dialog.showOpenDialog({
          title: p.kind === 'json' ? 'OAuthクライアントJSONを選択' : '通知音を選択',
          properties: ['openFile'],
          filters: [{ name: p.kind.toUpperCase(), extensions: [p.kind] }],
        });
        return result.canceled ? null : (result.filePaths[0] ?? null);
      }
      case 'host.audio.play': {
        requireCapability('audio');
        if (typeof p.file !== 'string') throw new Error('音声ファイルを指定してください。');
        const child = e.child;
        queueSound(
          p.file,
          () => e.child === child && ['starting', 'running'].includes(e.state),
          () => log('error', id, '通知音を再生できません。WAVファイルを確認してください。'),
        );
        return null;
      }
      case 'host.tray.attention':
        requireCapability('tray-attention');
        if (typeof p.active !== 'boolean') throw new Error('activeはbooleanです。');
        e.attention = p.active;
        commandsChanged();
        return null;
      case 'host.commands.replace': {
        requireCapability('dynamic-commands');
        const commands = parseExtensionCommands(id, p.commands);
        e.commands = commands;
        e.tray = e.tray.filter((item) => commands.some((command) => command.id === item.command));
        commandsChanged();
        return null;
      }
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
        const definition = e.manifest.settings?.find((s) => s.key === k);
        if (definition) validateSettingValue(definition, p.value);
        const current = settings.value.extensions[id]?.settings ?? {};
        settings.updateExtension(id, { settings: { ...current, [k]: p.value } });
        return null;
      }
      case 'host.settings.options': {
        requireCapability('settings');
        const k = key();
        if (!e.manifest.settings?.some((s) => s.key === k && s.type === 'select' && s.dynamic))
          throw new Error('動的な選択肢を宣言した設定項目が必要です。');
        const options = parseSettingOptions(p.options);
        if (JSON.stringify(e.settingOptions[k]) !== JSON.stringify(options)) {
          e.settingOptions[k] = options;
          changed();
        }
        return null;
      }
      case 'host.notifications.show': {
        requireCapability('notifications');
        if (typeof p.title !== 'string' || typeof p.body !== 'string')
          throw new Error('title と body が必要です。');
        if (p.silent != null && typeof p.silent !== 'boolean')
          throw new Error('silentはbooleanです。');
        if (
          p.command != null &&
          (typeof p.command !== 'string' || !e.commands.some((c) => c.id === p.command))
        )
          throw new Error('このAppletの登録済みコマンドを指定してください。');
        if (settings.value.host.notifications) {
          const child = e.child;
          showNotification(p.title.slice(0, 100), p.body.slice(0, 500), p.silent === true, () => {
            if (p.command && e.state === 'running' && e.child === child)
              void executeCommand(p.command).catch(() =>
                log('error', id, '通知のコマンドを実行できませんでした。'),
              );
          });
        }
        return null;
      }
      case 'host.browser.open': {
        requireCapability('browser');
        const url = new URL(String(p.url));
        if (url.protocol !== 'https:' || url.username || url.password)
          throw new Error('ブラウザでは資格情報を含まないHTTPS URLを指定してください。');
        await shell.openExternal(url.href);
        return null;
      }
      case 'host.ui.imageDirectory':
        requireCapability('local-images');
        return imageDirectory(dataRoot, id);
      case 'host.ui.panel': {
        requireCapability('ui');
        if (
          p.images != null &&
          (!Array.isArray(p.images) ||
            p.images.length > 1000 ||
            p.images.some(
              (item: unknown) =>
                !isObject(item) ||
                typeof item.title !== 'string' ||
                item.title.length > 1200 ||
                (item.imageFile != null &&
                  (typeof item.imageFile !== 'string' ||
                    !path.isAbsolute(item.imageFile) ||
                    !e.manifest.capabilities?.includes('local-images'))) ||
                (item.tooltip != null &&
                  (typeof item.tooltip !== 'string' || item.tooltip.length > 32767)) ||
                (item.description != null &&
                  (typeof item.description !== 'string' || item.description.length > 1000)) ||
                (item.image != null &&
                  (typeof item.image !== 'string' ||
                    item.image.length > 200000 ||
                    !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
                      item.image,
                    ))) ||
                (item.actions != null &&
                  (!Array.isArray(item.actions) ||
                    item.actions.length > 4 ||
                    item.actions.some((a: unknown) => !validAction(a)))),
            ))
        )
          throw new Error('パネルの画像は1000件以内のサムネイルを指定してください。');
        if (
          typeof p.title !== 'string' ||
          (p.tabs != null &&
            (!Array.isArray(p.tabs) ||
              p.tabs.length > 100 ||
              p.tabs.some((a: unknown) => !validAction(a)))) ||
          p.title.length > 200 ||
          (p.description != null && typeof p.description !== 'string') ||
          (p.facts != null &&
            (!Array.isArray(p.facts) ||
              p.facts.length > 30 ||
              p.facts.some(
                (f: unknown) =>
                  !isObject(f) || typeof f.label !== 'string' || typeof f.value !== 'string',
              ))) ||
          (p.actions != null &&
            (!Array.isArray(p.actions) ||
              p.actions.length > 100 ||
              p.actions.some((a: unknown) => !validAction(a))))
        )
          throw new Error('パネルの形式が正しくありません。');
        e.panel = registerLocalImages(structuredClone(p) as unknown as Panel, dataRoot, id);
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
