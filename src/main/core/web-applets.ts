import { session, nativeImage, dialog, net, type WebContents } from 'electron';
import path from 'node:path';
import { AppletSurface, pageHostShortcut } from './applet-pages';
import type { SettingsStore } from './settings';
import type { ExtensionSnapshot } from '../../shared/contracts';
import { shortcutFromEvent } from '../../shared/commands';
import {
  allowedWebAppletNavigation,
  manifestDefaults,
  webId,
  profileId,
  webUrl,
  type WebApplet,
  type WebDefaults,
  type WebPageState,
} from '../../shared/web-applets';

export class WebAppletManager {
  private views = new Map<
    string,
    { surface: AppletSurface; item: WebApplet; state: WebPageState }
  >();
  private clearing = new Set<string>();
  private sessions = new Map<string, Electron.Session>();
  private closed = false;
  constructor(
    private settings: SettingsStore,
    private root: string,
    private changed: () => void,
    private execute: (id: string) => Promise<unknown>,
  ) {}
  private account(id: string) {
    if (!profileId(id) || !this.settings.value.webApplets.accounts.some((a) => a.id === id))
      throw Error('WebApplet専用のアカウント枠がありません。');
    const cached = this.sessions.get(id);
    if (cached) return cached;
    const ses = session.fromPath(path.join(this.root, 'web-applets', 'sessions', id));
    ses.setSpellCheckerEnabled(false);
    ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    ses.setPermissionCheckHandler(() => false);
    this.sessions.set(id, ses);
    return ses;
  }
  snapshot(): ExtensionSnapshot[] {
    return this.settings.value.webApplets.items.map((a) => ({
      apiVersion: 1,
      id: a.id,
      name: a.name,
      displayName: a.name,
      version: '1.0.0',
      runtime: 'web',
      entry: '',
      folder: '',
      description: `Webページ · ${new URL(a.url).origin}`,
      enabled: a.enabled,
      state: !a.enabled ? 'stopped' : this.views.get(a.id)?.state.error ? 'error' : 'running',
      error: this.views.get(a.id)?.state.error || null,
      capabilities: [],
      settings: [],
      tray: [],
      settingOptions: {},
      commands: ['open', 'back', 'forward', 'reload', 'home'].map((key) => ({
        id: `${a.id}.${key}`,
        title: (
          {
            open: '開く',
            back: '戻る',
            forward: '進む',
            reload: '再読み込み',
            home: '開始ページへ',
          } as Record<string, string>
        )[key],
        activateOnExecute: key === 'open',
        available: a.enabled,
      })),
      pages: [
        {
          id: 'main',
          title: a.name,
          icon: 'extensions',
          iconImage: a.icon,
          source: 'local',
          ui: '',
          openCommand: `${a.id}.open`,
          defaultDisplay: a.display,
        },
      ],
      panel: {
        title: a.name,
        description: '専用アカウントでWebページを表示します。',
        actions: [{ title: 'Webページを開く', command: `${a.id}.open` }],
      },
    }));
  }
  states() {
    return Object.fromEntries([...this.views].map(([id, v]) => [id, v.state]));
  }
  reconcile() {
    for (const [id, v] of this.views) {
      const a = this.settings.value.webApplets.items.find((a) => a.id === id);
      if (!a || !a.enabled || a.url !== v.item.url || a.accountId !== v.item.accountId) {
        v.surface.close();
        this.views.delete(id);
      } else {
        v.item = a;
        v.surface.options.title = a.name;
        if (v.surface.display === 'window') v.surface.window?.setTitle(a.name);
      }
    }
  }
  async open(id: string) {
    if (this.closed || !webId(id)) throw Error('WebAppletがありません。');
    const a = this.settings.value.webApplets.items.find((a) => a.id === id);
    if (!a?.enabled || this.clearing.has(a.accountId))
      throw Error('WebAppletが無効またはアカウント処理中です。');
    let v = this.views.get(id);
    if (!v) {
      const state: WebPageState = {
        loading: true,
        error: '',
        origin: new URL(a.url).origin,
        canGoBack: false,
        canGoForward: false,
      };
      let wc: WebContents;
      const surface = new AppletSurface({
        key: `page:${id}:main`,
        title: a.name,
        url: a.url,
        partition: `web-applet-${a.accountId}`,
        session: this.account(a.accountId),
        remote: true,
        stateFile: path.join(this.root, 'web-applets', 'windows', `${id}.json`),
        defaultDisplay: a.display,
        onLayout: () => {},
        onCreated: (contents) => {
          wc = contents;
          const current = () =>
            this.settings.value.webApplets.items.find((item) => item.id === id) ?? a;
          const permitted = (url: string) => allowedWebAppletNavigation(current(), url);
          const blocked = () => {
            state.error = '設定で許可されていないページへの移動を止めました。';
            this.changed();
          };
          wc.on('will-navigate', (event, url) => {
            if (!permitted(url)) {
              event.preventDefault();
              blocked();
            }
          });
          wc.on('will-redirect', (event) => {
            if (event.isMainFrame && !permitted(event.url)) {
              event.preventDefault();
              blocked();
            }
          });
          wc.setWindowOpenHandler(({ url }) => {
            if (permitted(url)) void wc.loadURL(url).catch(() => {});
            else blocked();
            return { action: 'deny' };
          });
          wc.on('before-input-event', (event, input) => {
            // Do not consume normal text-entry keys in an untrusted document.
            if (
              !surface.visible ||
              (!input.control &&
                !input.alt &&
                !/^F([1-9]|1[0-9]|2[0-4])$/i.test(input.key) &&
                input.key !== 'Pause')
            )
              return;
            if (pageHostShortcut(input)) {
              event.preventDefault();
              return;
            }
            if (input.type !== 'keyDown' || input.isAutoRepeat || input.isComposing) return;
            const key = shortcutFromEvent({
              key: input.key,
              code: input.code,
              ctrlKey: input.control,
              altKey: input.alt,
              shiftKey: input.shift,
              metaKey: input.meta,
            });
            const commands =
              this.snapshot()
                .find((a) => a.id === id)
                ?.commands.filter(
                  (c) =>
                    key &&
                    !this.settings.value.globalShortcutCommands.includes(c.id) &&
                    this.settings.value.shortcuts[c.id]?.includes(key),
                ) ?? [];
            if (commands.length === 1) {
              event.preventDefault();
              void this.execute(commands[0].id).catch(() => {});
            }
          });
          const update = () => {
            if (wc.isDestroyed()) return;
            state.loading = wc.isLoading();
            state.canGoBack = wc.navigationHistory.canGoBack();
            state.canGoForward = wc.navigationHistory.canGoForward();
            try {
              state.origin = new URL(wc.getURL()).origin;
            } catch {}
            this.changed();
          };
          wc.on('did-start-loading', () => {
            state.error = '';
            update();
          });
          wc.on('did-stop-loading', update);
          wc.on('did-navigate', update);
          wc.on('did-navigate-in-page', (_event, url, main) => {
            if (main && !permitted(url) && wc.navigationHistory.canGoBack()) {
              wc.navigationHistory.goBack();
              blocked();
            } else update();
          });
          wc.on('did-fail-load', (_event, code, _description, _url, main) => {
            if (main && code !== -3) {
              state.error = `ページを読み込めませんでした（${code}）。`;
              this.changed();
            }
          });
          wc.on('render-process-gone', () => {
            state.error = 'Webページの処理が終了しました。再起動してください。';
            this.changed();
          });
        },
      });
      v = { surface, item: a, state };
      this.views.set(id, v);
    }
    try {
      await v.surface.open();
    } catch {
      v.state.error = 'ページを読み込めませんでした。URLと接続を確認してください。';
      this.changed();
      throw Error(v.state.error);
    }
    this.changed();
  }
  async navigate(id: string, action: unknown) {
    const v = this.views.get(id);
    if (!v || !v.item.enabled || v.surface.ui.webContents.isDestroyed())
      throw Error('Webページを先に開いてください。');
    const wc = v.surface.ui.webContents;
    if (action === 'reload') wc.reload();
    else if (action === 'home') await wc.loadURL(v.item.url);
    else if (action === 'back' || action === 'forward') {
      const h = wc.navigationHistory,
        entries = h.getAllEntries(),
        offset = action === 'back' ? -1 : 1;
      const target = entries[h.getActiveIndex() + offset];
      if (target && allowedWebAppletNavigation(v.item, target.url)) h.goToOffset(offset);
    } else throw Error('Webページの操作が不正です。');
  }
  restart(id: string) {
    const v = this.views.get(id);
    v?.surface.close();
    this.views.delete(id);
    return this.open(id);
  }
  async clearAccount(id: string) {
    const ses = this.account(id);
    if (this.clearing.has(id)) throw Error('アカウントを処理しています。');
    this.clearing.add(id);
    try {
      const answer = await dialog.showMessageBox({
        type: 'question',
        message: 'このWebApplet専用アカウントのログイン情報とサイトデータを消去しますか？',
        detail: 'この枠を使うWebAppletを閉じます。Gmailのアカウントには影響しません。',
        buttons: ['キャンセル', '消去'],
        defaultId: 0,
        cancelId: 0,
      });
      if (answer.response !== 1 || this.closed) return;
      for (const [key, v] of this.views)
        if (v.item.accountId === id) {
          v.surface.close();
          this.views.delete(key);
        }
      await ses.clearStorageData();
      await ses.clearCache();
      await ses.cookies.flushStore();
      this.changed();
    } finally {
      this.clearing.delete(id);
    }
  }
  async close() {
    this.closed = true;
    for (const v of this.views.values()) v.surface.close();
    this.views.clear();
    const results = await Promise.allSettled(
      [...this.sessions.values()].map(async (ses) => {
        ses.flushStorageData();
        await ses.cookies.flushStore();
      }),
    );
    if (results.some((r) => r.status === 'rejected'))
      throw Error('Webアカウントの保存に失敗しました。');
  }
}

async function resource(
  ses: Electron.Session,
  raw: string,
  origin: string,
  limit: number,
): Promise<{ bytes: Buffer; url: string }> {
  let url = webUrl(raw);
  for (let i = 0; i < 4; i++) {
    url = webUrl(url);
    if (new URL(url).origin !== origin) throw Error('別のoriginへの取得は許可されていません。');
    // Session.fetch rejects manual redirects without exposing Location.
    // Inspect ClientRequest's redirect event before issuing the next request.
    const response = await new Promise<{ bytes?: Buffer; location?: string }>((resolve, reject) => {
      const request = net.request({ url, session: ses, redirect: 'manual', credentials: 'omit' });
      let settled = false;
      const finish = (result?: { bytes?: Buffer; location?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        request.abort();
        if (result) resolve(result);
        else reject(Error('Web設定の取得に失敗しました。'));
      };
      const timer = setTimeout(() => finish(), 5000);
      request.on('error', () => finish());
      request.on('redirect', (_status, _method, location) => finish({ location }));
      request.on('response', (incoming) => {
        if (incoming.statusCode < 200 || incoming.statusCode >= 300) {
          finish();
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        incoming.on('data', (chunk: Buffer) => {
          if (settled) return;
          size += chunk.length;
          if (size > limit) {
            finish();
            return;
          }
          chunks.push(chunk);
        });
        incoming.on('error', () => finish());
        incoming.on('aborted', () => finish());
        incoming.on('end', () => finish({ bytes: Buffer.concat(chunks, size) }));
      });
      request.end();
    });
    if (response.location) {
      url = new URL(response.location, url).href;
      continue;
    }
    if (!response.bytes) throw Error('取得できません。');
    return { bytes: response.bytes, url };
  }
  throw Error('転送が多すぎます。');
}
export async function discoverWebDefaults(raw: string): Promise<WebDefaults> {
  const url = webUrl(raw),
    origin = new URL(url).origin;
  const ses = session.fromPartition('web-metadata');
  ses.setPermissionRequestHandler((_wc, _permission, cb) => cb(false));
  let manifestUrl: string | undefined;
  try {
    const page = await resource(ses, url, origin, 256000);
    const html = page.bytes.toString('utf8');
    for (const tag of html.match(/<link\b[^>]{0,2048}>/gi) ?? []) {
      const attrs = Object.fromEntries(
        [...tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map((m) => [
          m[1].toLowerCase(),
          m[2] ?? m[3] ?? m[4],
        ]),
      );
      if ((attrs.rel ?? '').toLowerCase().split(/\s+/).includes('manifest') && attrs.href) {
        manifestUrl = new URL(attrs.href.replaceAll('&amp;', '&'), page.url).href;
        break;
      }
    }
    manifestUrl ??= new URL('/.well-known/appdock.json', url).href;
    const manifest = await resource(ses, manifestUrl, origin, 64000);
    const defaults = manifestDefaults(
      JSON.parse(manifest.bytes.toString('utf8')),
      manifest.url,
      url,
    );
    let icon: string | undefined;
    if (defaults.iconUrl)
      try {
        const { bytes } = await resource(ses, defaults.iconUrl, origin, 256000);
        const png =
          bytes.length >= 24 &&
          bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        if (!png && !jpeg) throw Error('アイコンはPNG/JPEGを指定してください。');
        if (png && (bytes.readUInt32BE(16) > 2048 || bytes.readUInt32BE(20) > 2048))
          throw Error('アイコンの解像度が大きすぎます。');
        const image = nativeImage.createFromBuffer(bytes),
          size = image.getSize();
        if (!image.isEmpty() && size.width <= 2048 && size.height <= 2048) {
          const data = image.resize({ width: 32, height: 32 }).toDataURL();
          if (data.length <= 24576) icon = data;
        }
      } catch {}
    return {
      name: defaults.name,
      url: defaults.url,
      navigation: defaults.navigation,
      source: defaults.source,
      icon,
      message: 'Web側の推奨設定を読み込みました。',
    };
  } catch {
    return { message: 'Web側の設定JSONを取得できませんでした。手動で設定できます。' };
  } finally {
    await ses.clearStorageData();
    await ses.clearCache();
  }
}
