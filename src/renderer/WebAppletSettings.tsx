import { useEffect, useRef, useState } from 'react';
import type { SettingsEditor } from './useSettingsEditor';
import type { WebApplet, WebNavigation, WebProfile } from '../shared/web-applets';
import { defaultWebShortcutDefaults, type WebShortcutDefault } from '../shared/web-applets';
import { shortcutFromEvent } from '../shared/commands';
import { shortcutScopes, type ShortcutScope } from '../shared/keybindings';

export function WebAppletSettings({
  editor,
  itemId,
  onAccounts,
  accounts,
  applets = [],
}: {
  editor: SettingsEditor;
  itemId?: string;
  accounts: WebProfile[];
  applets?: { id: string; title: string }[];
  onAccounts(): void;
}) {
  const { draft, edit } = editor;
  const data = draft.webApplets;
  const [selected, setSelected] = useState(itemId ?? data.items[0]?.id ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  const liveEditor = useRef(editor);
  liveEditor.current = editor;
  const live = useRef(data);
  live.current = data;
  const item = data.items.find((a) => a.id === (itemId ?? selected));
  useEffect(() => {
    request.current++;
    return () => {
      request.current++;
    };
  }, [item?.id]);
  const change = (patch: Partial<WebApplet>) => {
    if (item)
      edit({
        ...draft,
        webApplets: {
          ...data,
          items: data.items.map((a) => (a.id === item.id ? { ...a, ...patch } : a)),
        },
      });
  };
  const changeDefaults = (shortcutDefaults: WebShortcutDefault[]) =>
    edit({ ...draft, webApplets: { ...data, shortcutDefaults } });
  const changeDefault = (index: number, patch: Partial<WebShortcutDefault>) =>
    changeDefaults(
      data.shortcutDefaults.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  const add = async () => {
    setBusy(true);
    try {
      const account = accounts[0] ?? (await window.dock.createWebAccount('個人用'));
      const current = liveEditor.current.draft;
      const a: WebApplet = {
        id: `web.${crypto.randomUUID()}`,
        name: '新しいWebApplet',
        url: 'https://example.com/',
        accountId: account.id,
        enabled: true,
        display: 'page',
        navigation: 'same-origin',
        allowedOrigins: [],
        icon: '',
      };
      edit({
        ...current,
        webApplets: {
          ...current.webApplets,
          items: [...current.webApplets.items, a],
        },
      });
      setSelected(a.id);
      setMessage('名前とURLを入力して設定を保存してください。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'WebAppletを追加できませんでした。');
    } finally {
      setBusy(false);
    }
  };
  async function defaults() {
    if (!item) return;
    const token = ++request.current,
      before = { ...item };
    setBusy(true);
    setMessage('Web側の設定JSONを確認しています…');
    try {
      const result = await window.dock.webDefaults(item.url);
      if (token !== request.current) return;
      const current = live.current.items.find((a) => a.id === before.id);
      if (!current || current.url !== before.url) {
        setMessage('読取中に設定が変更されました。もう一度取得してください。');
        return;
      }
      // Preserve fields changed by the user while the request was in flight.
      const updated = { ...current };
      const previous = current.imported;
      if (
        result.name &&
        current.name === before.name &&
        (previous?.name !== undefined
          ? current.name === previous.name
          : current.name === '新しいWebApplet')
      )
        updated.name = result.name;
      if (
        result.icon &&
        current.icon === before.icon &&
        (previous?.icon !== undefined ? current.icon === previous.icon : !current.icon)
      )
        updated.icon = result.icon;
      if (result.url && (!previous?.url || current.url === previous.url)) updated.url = result.url;
      if (
        result.navigation &&
        current.navigation === before.navigation &&
        (previous?.navigation !== undefined
          ? current.navigation === previous.navigation
          : current.navigation === 'same-origin')
      )
        updated.navigation = result.navigation;
      updated.imported = {
        ...previous,
        ...(result.name ? { name: result.name } : {}),
        ...(result.icon ? { icon: result.icon } : {}),
        ...(result.url ? { url: result.url } : {}),
        ...(result.navigation ? { navigation: result.navigation } : {}),
      };
      edit({
        ...liveEditor.current.draft,
        webApplets: {
          ...live.current,
          items: live.current.items.map((a) => (a.id === before.id ? updated : a)),
        },
      });
      setMessage(`${result.message} 内容を確認して保存してください。`);
    } catch {
      setMessage('取得できませんでした。手動で設定できます。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="web-applet-settings" aria-label="WebApplet設定">
      {!itemId && (
        <>
          <p className="muted">
            URLからWebAppletを追加できます。アカウント枠はGmailとは別管理です。
          </p>
          <div className="actions">
            <button
              className="secondary"
              disabled={busy || data.items.length >= 64}
              onClick={() => void add()}
            >
              ＋ WebAppletを追加
            </button>
          </div>
          <div className="web-applet-list">
            {data.items.map((a) => (
              <button
                key={a.id}
                className={a.id === selected ? 'selected' : 'secondary'}
                onClick={() => {
                  setSelected(a.id);
                  setMessage('');
                }}
              >
                {a.icon && <img src={a.icon} alt="" />}
                {a.name}
              </button>
            ))}
          </div>
          <div className="web-shortcut-defaults">
            <h3>これから追加するWebAppletのショートカット</h3>
            <p className="muted">
              追加時に各WebAppletへコピーします。既存の割り当ては変更しません。
            </p>
            <div className="keybindings-scroll">
              <table className="keybindings-table">
                <thead>
                  <tr>
                    <th>有効</th>
                    <th>コマンド</th>
                    <th>キーバインド</th>
                    <th>いつ・どこで</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {data.shortcutDefaults.map((row, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`既定の割り当て${index + 1}を有効にする`}
                          checked={row.enabled}
                          onChange={(event) =>
                            changeDefault(index, { enabled: event.target.checked })
                          }
                        />
                      </td>
                      <td>
                        <select
                          aria-label={`既定のコマンド${index + 1}`}
                          value={row.command}
                          onChange={(event) =>
                            changeDefault(index, {
                              command: event.target.value as WebShortcutDefault['command'],
                            })
                          }
                        >
                          <option value="reload">リロード</option>
                          <option value="back">戻る</option>
                          <option value="forward">進む</option>
                          <option value="open">開く</option>
                          <option value="home">開始ページへ</option>
                        </select>
                      </td>
                      <td>
                        <input
                          readOnly
                          data-shortcut-recorder="true"
                          aria-label={`既定のショートカット${index + 1}`}
                          value={row.key}
                          onFocus={() => void window.dock.setShortcutRecording(true)}
                          onBlur={() => void window.dock.setShortcutRecording(false)}
                          onKeyDown={(event) => {
                            event.stopPropagation();
                            if (event.key === 'Tab' && !event.ctrlKey && !event.altKey) return;
                            event.preventDefault();
                            if (event.key === 'Escape') {
                              event.currentTarget.blur();
                              return;
                            }
                            const key = shortcutFromEvent(event.nativeEvent);
                            if (key) changeDefault(index, { key });
                          }}
                        />
                      </td>
                      <td>
                        <select
                          aria-label={`既定のいつ・どこで${index + 1}`}
                          value={row.when.scope}
                          onChange={(event) =>
                            changeDefault(index, {
                              when: { scope: event.target.value as ShortcutScope, appletIds: [] },
                            })
                          }
                        >
                          {shortcutScopes.map((scope) => (
                            <option key={scope.id} value={scope.id}>
                              {scope.id === 'owner' ? '追加されるWebApplet' : scope.title}
                            </option>
                          ))}
                        </select>
                        {row.when.scope === 'applets' && (
                          <div
                            className="web-shortcut-targets"
                            role="group"
                            aria-label={`既定の対象Applet${index + 1}`}
                          >
                            {[
                              ...applets,
                              ...row.when.appletIds
                                .filter((id) => !applets.some((applet) => applet.id === id))
                                .map((id) => ({ id, title: `未導入: ${id}` })),
                            ].map((applet) => (
                              <label key={applet.id}>
                                <input
                                  type="checkbox"
                                  checked={row.when.appletIds.includes(applet.id)}
                                  onChange={(event) =>
                                    changeDefault(index, {
                                      when: {
                                        scope: 'applets',
                                        appletIds: event.target.checked
                                          ? [...row.when.appletIds, applet.id]
                                          : row.when.appletIds.filter((id) => id !== applet.id),
                                      },
                                    })
                                  }
                                />
                                {applet.title}
                              </label>
                            ))}
                            {!row.when.appletIds.length && (
                              <small role="alert">1件以上選択してください。</small>
                            )}
                          </div>
                        )}
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() =>
                            changeDefaults(data.shortcutDefaults.filter((_, i) => i !== index))
                          }
                        >
                          解除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="actions">
              <button
                className="secondary"
                disabled={data.shortcutDefaults.length >= 20}
                onClick={() =>
                  changeDefaults([
                    ...data.shortcutDefaults,
                    {
                      command: 'reload',
                      key: 'F5',
                      enabled: true,
                      when: { scope: 'owner', appletIds: [] },
                    },
                  ])
                }
              >
                ＋ 割り当てを追加
              </button>
              <button
                className="text-button"
                onClick={() => changeDefaults(defaultWebShortcutDefaults())}
              >
                既定に戻す
              </button>
            </div>
          </div>
        </>
      )}
      {item && (
        <div className="web-applet-form" key={item.id}>
          <label>
            名前
            <input
              aria-label="WebAppletの名前"
              value={item.name}
              maxLength={80}
              onChange={(e) => change({ name: e.target.value })}
            />
          </label>
          <label>
            開始URL
            <input
              aria-label="WebAppletのURL"
              value={item.url}
              maxLength={4096}
              onChange={(e) => change({ url: e.target.value })}
              onBlur={() => {
                if (item.name === '新しいWebApplet' && item.url !== 'https://example.com/')
                  void defaults();
              }}
            />
          </label>
          <div className="actions">
            <button className="secondary" disabled={busy} onClick={() => void defaults()}>
              Web側の推奨設定を取得
            </button>
            {item.icon && (
              <>
                <img className="web-applet-icon" src={item.icon} alt="WebAppletのアイコン" />
                <button className="text-button" onClick={() => change({ icon: '' })}>
                  アイコンを戻す
                </button>
              </>
            )}
          </div>
          <label>
            アイコン画像（PNG / JPEG / WebP、4MB以下）
            <input
              aria-label="WebAppletのアイコン画像"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (
                  file.size > 4 * 1024 * 1024 ||
                  !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
                ) {
                  setMessage('4MB以下のPNG / JPEG / WebPを選んでください。');
                  return;
                }
                const id = item.id,
                  token = ++request.current;
                try {
                  const image = await createImageBitmap(file);
                  const canvas = document.createElement('canvas');
                  canvas.width = 32;
                  canvas.height = 32;
                  canvas.getContext('2d')!.drawImage(image, 0, 0, 32, 32);
                  image.close();
                  if (token === request.current) {
                    const current = liveEditor.current.draft;
                    edit({
                      ...current,
                      webApplets: {
                        ...current.webApplets,
                        items: current.webApplets.items.map((a) =>
                          a.id === id ? { ...a, icon: canvas.toDataURL('image/png') } : a,
                        ),
                      },
                    });
                  }
                } catch {
                  setMessage('画像を読み込めませんでした。');
                }
              }}
            />
          </label>
          <label>
            表示方法
            <select
              aria-label="WebAppletの表示方法"
              value={item.display}
              onChange={(e) => change({ display: e.target.value as WebApplet['display'] })}
            >
              <option value="page">本体のページ</option>
              <option value="window">別ウィンドウ</option>
            </select>
          </label>
          <label>
            ページ遷移
            <select
              aria-label="WebAppletのページ遷移"
              value={item.navigation}
              onChange={(e) => change({ navigation: e.target.value as WebNavigation })}
            >
              <option value="none">開始ページに固定</option>
              <option value="same-origin">同じorigin内だけ</option>
              <option value="any">HTTP(S)のページを許可</option>
            </select>
          </label>
          <label>
            追加の許可先（認証用など、1行1origin）
            <textarea
              aria-label="WebAppletの追加許可先"
              value={item.allowedOrigins.join('\n')}
              onChange={(e) =>
                change({ allowedOrigins: e.target.value.split('\n').filter(Boolean) })
              }
              placeholder="https://accounts.example.com"
            />
          </label>
          <label>
            使用するWebアカウント
            <select
              aria-label="WebAppletのアカウント"
              value={item.accountId}
              onChange={(e) => change({ accountId: e.target.value })}
            >
              {!accounts.some((a) => a.id === item.accountId) && (
                <option value={item.accountId} disabled>
                  アカウント枠を選び直してください
                </option>
              )}
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button className="text-button" onClick={onAccounts}>
              Webアカウントを管理
            </button>
          </div>
          <p className="muted">
            同じ枠を選んだWebAppletはログイン状態を共有します。Gmailの枠とは共有しません。
          </p>
          <div className="actions">
            <button
              className="text-button danger"
              onClick={() => {
                edit({
                  ...draft,
                  webApplets: { ...data, items: data.items.filter((a) => a.id !== item.id) },
                });
                setSelected('');
              }}
            >
              このWebAppletを削除
            </button>
          </div>
          <p className="muted">
            削除は設定の保存で反映します。アカウント枠とログイン状態は残ります。
          </p>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
