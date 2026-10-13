import { webSettingLabels, appletSettingsPageId } from '../settings-catalog';
import { settingAnchor } from './setting-anchor';
import { SettingsInput, SettingsTextarea, numberInput } from './SettingsInput';
import { settingsControls } from './api';
import { useEffect, useRef, useState } from 'react';
import type { SettingsControlEditor as SettingsEditor } from './api';
import type { WebApplet, WebNavigation, WebProfile } from '../web-applets';
import {
  defaultWebShortcutDefaults,
  mergeWebDefaults,
  type WebShortcutDefault,
} from '../web-applets';
import { shortcutFromEvent } from '../commands';
import { shortcutScopes, type ShortcutScope } from '../keybindings';

export function WebAppletSettings({
  editor,
  itemId,
  onAccounts,
  accounts,
  applets = [],
  tab = 'settings',
  onDelete,
  onDefaults,
}: {
  editor: SettingsEditor;
  itemId?: string;
  accounts: WebProfile[];
  applets?: { id: string; title: string }[];
  onAccounts(): void;
  tab?: 'settings' | 'shortcuts';
  onDelete?(): void;
  onDefaults?(): Promise<string>;
}) {
  const { value: settings, edit } = editor;
  const data = settings.webApplets;
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
        ...settings,
        webApplets: {
          ...data,
          items: data.items.map((a) => (a.id === item.id ? { ...a, ...patch } : a)),
        },
      });
  };
  const changeDefaults = (shortcutDefaults: WebShortcutDefault[]) =>
    edit({ ...settings, webApplets: { ...data, shortcutDefaults } });
  const changeDefault = (index: number, patch: Partial<WebShortcutDefault>) =>
    changeDefaults(
      data.shortcutDefaults.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  const add = async () => {
    setBusy(true);
    try {
      const account = accounts[0] ?? (await settingsControls.createWebAccount('個人用'));
      const current = liveEditor.current.value;
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
      setMessage('名前とURLを変更すると自動保存します。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'WebAppletを追加できませんでした。');
    } finally {
      setBusy(false);
    }
  };
  async function defaults() {
    if (!item) return;
    if (onDefaults) {
      setBusy(true);
      try {
        setMessage(await onDefaults());
      } catch {
        setMessage('取得できませんでした。手動で設定できます。');
      } finally {
        setBusy(false);
      }
      return;
    }
    const token = ++request.current,
      before = { ...item };
    setBusy(true);
    setMessage('Web側の設定JSONを確認しています…');
    try {
      const result = await settingsControls.webDefaults(item.url);
      if (token !== request.current) return;
      const current = live.current.items.find((a) => a.id === before.id);
      if (!current || current.url !== before.url) {
        setMessage('読取中に設定が変更されました。もう一度取得してください。');
        return;
      }
      const updated = mergeWebDefaults(current, before, result);
      edit({
        ...liveEditor.current.value,
        webApplets: {
          ...live.current,
          items: live.current.items.map((a) => (a.id === before.id ? updated : a)),
        },
      });
      setMessage(`${result.message} 設定へ反映しました。`);
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
          {tab === 'settings' && (
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
            </>
          )}
          {tab === 'shortcuts' && (
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
                          <SettingsInput
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
                          <SettingsInput
                            readOnly
                            data-shortcut-recorder="true"
                            aria-label={`既定のショートカット${index + 1}`}
                            value={row.key}
                            onFocus={() => void settingsControls.setShortcutRecording(true)}
                            onBlur={() => void settingsControls.setShortcutRecording(false)}
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
                                  <SettingsInput
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
          )}
        </>
      )}
      {tab === 'settings' && item && (
        <div className="web-applet-form" key={item.id}>
          <label {...settingAnchor(appletSettingsPageId(item.id), 'name')}>
            {webSettingLabels.name}
            <SettingsInput
              aria-label="WebAppletの名前"
              value={item.name}
              maxLength={80}
              onChange={(e) => change({ name: e.target.value })}
            />
          </label>
          <label {...settingAnchor(appletSettingsPageId(item.id), 'url')}>
            {webSettingLabels.url}
            <SettingsInput
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
          <div
            className="actions"
            {...settingAnchor(appletSettingsPageId(item.id), 'action:defaults')}
          >
            <button className="secondary" disabled={busy} onClick={() => void defaults()}>
              {webSettingLabels['action:defaults']}
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
          <label {...settingAnchor(appletSettingsPageId(item.id), 'icon')}>
            {webSettingLabels.icon}
            <SettingsInput
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
                    const current = liveEditor.current.value;
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
          <label {...settingAnchor(appletSettingsPageId(item.id), 'display')}>
            {webSettingLabels.display}
            <select
              aria-label="WebAppletの表示方法"
              value={item.display}
              onChange={(e) => change({ display: e.target.value as WebApplet['display'] })}
            >
              <option value="page">本体のページ</option>
              <option value="window">別ウィンドウ</option>
            </select>
          </label>
          <label {...settingAnchor(appletSettingsPageId(item.id), 'navigation')}>
            {webSettingLabels.navigation}
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
          <label {...settingAnchor(appletSettingsPageId(item.id), 'allowedOrigins')}>
            {webSettingLabels.allowedOrigins}
            <SettingsTextarea
              aria-label="WebAppletの追加許可先"
              value={item.allowedOrigins.join('\n')}
              onChange={(e) =>
                change({ allowedOrigins: e.target.value.split('\n').filter(Boolean) })
              }
              placeholder="https://accounts.example.com"
            />
          </label>
          <label {...settingAnchor(appletSettingsPageId(item.id), 'accountId')}>
            {webSettingLabels.accountId}
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
          <div
            className="actions"
            {...settingAnchor(appletSettingsPageId(item.id), 'action:accounts')}
          >
            <button className="text-button" onClick={onAccounts}>
              {webSettingLabels['action:accounts']}
            </button>
          </div>
          <p className="muted">
            同じ枠を選んだWebAppletはログイン状態を共有します。Gmailの枠とは共有しません。
          </p>
          <div
            className="actions"
            {...settingAnchor(appletSettingsPageId(item.id), 'action:delete')}
          >
            <button
              className="text-button danger"
              onClick={() => {
                if (onDelete) {
                  onDelete();
                  return;
                }
                edit({
                  ...settings,
                  webApplets: { ...data, items: data.items.filter((a) => a.id !== item.id) },
                });
                setSelected('');
              }}
            >
              {webSettingLabels['action:delete']}
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
