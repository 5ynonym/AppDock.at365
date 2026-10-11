import { settingsControls } from '../../../src/shared/settings-ui/api';
import { useEffect, useRef, useState } from 'react';
import { Toggle } from '../../../src/shared/settings-ui/Toggle';
import {
  appletApiPermissionLabels,
  type AppletApiPermission,
  type AppletApiPermissions,
} from '../../../src/shared/appdock-api';
import type { AutomationAction, AutomationState } from '../../../src/shared/automation';

const rows: {
  key: AppletApiPermission;
  description: string;
  mcp?: keyof AutomationState;
  action?: string;
  label?: string;
}[] = [
  { key: 'read', description: '公開された状態・設定・コマンド一覧を取得します。' },
  {
    key: 'execute',
    description: '公開されたコマンドを実行します。',
    mcp: 'allowExecute',
    action: 'setExecution',
    label: 'コマンド実行',
  },
  {
    key: 'write',
    description: '本体とAppletが公開した設定を変更します。',
    mcp: 'allowWrite',
    label: '設定変更',
  },
  {
    key: 'manageApplets',
    description: 'Appletの有効・無効・再起動を操作します。',
    mcp: 'allowManageApplets',
    action: 'setAppletManagement',
    label: 'Applet管理',
  },
  {
    key: 'editShortcuts',
    description: 'キー・条件・実行順を編集します。',
    mcp: 'allowEditShortcuts',
    action: 'setShortcutEditing',
    label: 'ショートカット編集',
  },
  {
    key: 'editGestures',
    description: '割り当て・条件・実行順・動作設定を編集します。',
    mcp: 'allowEditGestures',
    action: 'setGestureEditing',
    label: 'ジェスチャー編集',
  },
  {
    key: 'editRibbon',
    description: '表示・配置・並び順・区切り線を編集します。',
    mcp: 'allowEditRibbon',
    action: 'setRibbonEditing',
    label: 'リボン編集',
  },
  {
    key: 'editTray',
    description: 'メニューとクリック・ダブルクリックの割り当てを編集します。',
    mcp: 'allowEditTray',
    action: 'setTrayEditing',
    label: 'タスクトレイ編集',
  },
  { key: 'sendInput', description: 'アクティブなウィンドウへキーや操作メッセージを送ります。' },
];

function needs(key: AppletApiPermission, permissions: AppletApiPermissions, applet: boolean) {
  if (key === 'read' || key === 'sendInput') return [];
  const required: AppletApiPermission[] = applet ? ['read'] : [];
  if (key !== 'execute') required.push('execute');
  if (key.startsWith('edit')) required.push('write');
  return required.filter((k) => !permissions[k]).map((k) => appletApiPermissionLabels[k]);
}

export function ApiPermissionsSettings({
  grants,
  error: appletError,
  busy: hostBusy,
  onOpenCodex,
}: {
  grants: AppletApiPermissions;
  error?: string;
  busy: boolean;
  onOpenCodex(): void;
}) {
  const [state, setState] = useState<AutomationState>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const operation = useRef(false);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      void settingsControls
        .automation({ kind: 'status' })
        .then((r) => {
          if (active) setState(r.state);
        })
        .catch((e) => {
          if (active) setError(String(e));
        });
    refresh();
    const unsubscribe = settingsControls.onChanged(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  async function save(action: () => Promise<unknown>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage('このPCに保存しました。');
    } catch (e) {
      setError(String(e));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  const mcpPermissions: AppletApiPermissions = {
    execute: state?.allowExecute,
    write: state?.allowWrite,
  };
  function reason(key: AppletApiPermission, applet: boolean) {
    if (!applet && !state?.running) return '連携が停止中です';
    const missing = needs(key, applet ? grants : mcpPermissions, applet);
    return missing.length ? `未有効：${missing.join('・')}の許可が必要です` : '';
  }
  return (
    <section className="api-permissions" aria-label="操作の許可">
      <div className="permission-heading">
        <h3>操作の許可</h3>
        <span className="muted">このPCに自動保存</span>
      </div>
      <p className="muted">
        AppletとMCPの許可を、それぞれ設定します。Applet側はすべてのAppletに共通です。変更はすぐに反映されます。
      </p>
      <div className="permission-connection">
        <span>
          MCP連携：
          {!state ? '確認中…' : state.running ? '稼働中' : state.enabled ? '起動できません' : 'OFF'}
        </span>
        <button className="secondary" onClick={onOpenCodex}>
          Codex連携を設定
        </button>
      </div>
      <p className="muted">
        必要な許可が不足している操作は、ONでも有効になりません。連携がOFFの間も、MCPの許可を設定できます。
      </p>
      {(error || appletError || state?.error) && (
        <p className="error-text" role="alert">
          {error || appletError || state?.error}
        </p>
      )}
      <p className="permission-save-status" role="status">
        {busy ? '保存しています…' : message || '変更は保存ボタンを押さずに保存されます。'}
      </p>
      <table className="permission-table">
        <thead>
          <tr>
            <th scope="col">操作</th>
            <th scope="col">Applet</th>
            <th scope="col">MCP（Codex）</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const appletOn = grants[row.key] === true;
            const mcpOn = row.mcp && state?.[row.mcp] === true;
            return (
              <tr key={row.key}>
                <th scope="row">
                  <strong>{appletApiPermissionLabels[row.key]}</strong>
                  <p>{row.description}</p>
                </th>
                <td data-caller="Applet">
                  <Toggle
                    label={`Applet：${appletApiPermissionLabels[row.key]}`}
                    checked={appletOn}
                    disabled={hostBusy || busy || !!appletError}
                    onChange={(value) =>
                      void save(() =>
                        settingsControls.setAppletApiPermissions({ ...grants, [row.key]: value }),
                      )
                    }
                  />
                  {appletOn && reason(row.key, true) && (
                    <small className="permission-pending">{reason(row.key, true)}</small>
                  )}
                </td>
                <td data-caller="MCP（Codex）">
                  {row.key === 'read' ? (
                    <span className="permission-fixed">連携中は許可</span>
                  ) : row.key === 'sendInput' ? (
                    <span className="permission-fixed">直接公開なし</span>
                  ) : (
                    <>
                      <Toggle
                        label={`Codexからの${row.label}を許可する`}
                        checked={!!mcpOn}
                        disabled={hostBusy || busy || !state}
                        onChange={(allowed) =>
                          void save(async () => {
                            const action =
                              row.key === 'write'
                                ? ({
                                    kind: 'configure',
                                    enabled: state!.enabled,
                                    allowWrite: allowed,
                                    port: state!.port,
                                  } as const)
                                : ({ kind: row.action, allowed } as AutomationAction);
                            setState((await settingsControls.automation(action)).state);
                          })
                        }
                      />
                      {mcpOn && reason(row.key, false) && (
                        <small className="permission-pending">{reason(row.key, false)}</small>
                      )}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <details className="permission-help">
        <summary>許可の適用とログについて</summary>
        <p>
          MCPで公開されたAppletコマンドが共通APIを呼ぶ場合、その内側の処理にはApplet側の許可を使います。MCPで直接公開されていない入力操作も、この経路では利用できます。
        </p>
        <p>
          APIの呼出しと結果は、MCPはautomation、Appletは各Appletのログに記録します。引数の値や認証情報は記録しません。
        </p>
      </details>
    </section>
  );
}
