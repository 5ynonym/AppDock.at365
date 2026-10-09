import { CommandPalette } from './CommandPalette';
import { GestureActions } from './GestureActions';
import { Toggle } from './Toggle';
import { useEffect, useState } from 'react';
import type { Settings, ExtensionSnapshot } from '../shared/contracts';
import { shortcutFromEvent, type UiCommand } from '../shared/commands';
import {
  defaultGestures,
  gestureTypes,
  groupGestureBindings,
  gestureTitle,
  moveGestureBinding,
  type GestureBinding,
  type GestureScope,
} from '../shared/gestures';

function Names({
  label,
  values,
  change,
}: {
  label: string;
  values: string[];
  change: (values: string[]) => void;
}) {
  const [text, setText] = useState(values.join(', '));
  useEffect(() => setText(values.join(', ')), [JSON.stringify(values)]);
  return (
    <label className="gesture-option">
      <span>{label}</span>
      <input
        aria-label={label}
        value={text}
        placeholder="chrome.exe, firefox.exe"
        onChange={(e) => setText(e.target.value)}
        onBlur={() =>
          change(
            text
              .split(/[\n,]/)
              .map((v) => v.trim())
              .filter(Boolean),
          )
        }
      />
    </label>
  );
}
export function GesturesEditor({
  settings,
  onChange,
  commands,
  applets,
}: {
  settings: Settings;
  onChange: (v: Settings) => void;
  commands: UiCommand[];
  applets: ExtensionSnapshot[];
}) {
  const gestures = settings.gestures ?? defaultGestures();
  const [adding, setAdding] = useState<string | null>(null),
    [newGesture, setNewGesture] = useState('move-up'),
    [dragged, setDragged] = useState<string | null>(null),
    [dropTarget, setDropTarget] = useState<string | null>(null),
    [error, setError] = useState('');
  const change = (patch: Partial<typeof gestures>) =>
    onChange({ ...settings, gestures: { ...gestures, ...patch } });
  const rows = gestures.bindings;
  const groups = groupGestureBindings(rows);
  const update = (id: string, patch: Partial<GestureBinding>) => {
    const current = rows.find((r) => r.id === id);
    if (!current) return;
    const updated = { ...current, ...patch };
    if (patch.gesture && patch.gesture !== current.gesture) {
      // Moving to a different group unmounts the key field; React may not emit blur.
      void window.dock.setShortcutRecording(false).catch((e) => setError(String(e)));
      const next = rows.filter((r) => r.id !== id);
      const last = next.map((r) => r.gesture).lastIndexOf(patch.gesture);
      next.splice(last < 0 ? next.length : last + 1, 0, updated);
      change({ bindings: next });
    } else change({ bindings: rows.map((r) => (r.id === id ? updated : r)) });
  };
  const catalog = new Map(commands.map((c) => [c.id, c]));
  useEffect(
    () => () => {
      void window.dock.setShortcutRecording(false);
    },
    [],
  );
  const move = (id: string, target: string) =>
    change({ bindings: moveGestureBinding(rows, id, target) });
  return (
    <section className="gestures-editor" aria-label="マウスジェスチャー設定">
      <h2>マウスジェスチャー</h2>
      <p className="settings-help">
        右ボタンを押しながら操作します。移動は右ボタンを離すと実行し、方向転換でキャンセル。クリック・ホイール・キーは押したときに実行します。
      </p>
      <div className="gesture-enabled">
        <Toggle
          label="マウスジェスチャーを有効にする"
          checked={gestures.enabled}
          onChange={(enabled) => change({ enabled })}
        />
        マウスジェスチャーを有効にする
      </div>{' '}
      <p className="settings-help">
        一時停止はトレイメニューから切り替えられます。何も操作せずに離すと普通の右クリックに戻ります。Escapeでキャンセル（Escapeに割り当てた場合はそのコマンドを実行）。
      </p>
      <details className="gesture-options">
        <summary>対象ブラウザ・除外・操作感・待機表示</summary>
        <Names
          label="Webブラウザのexe"
          values={gestures.browsers}
          change={(browsers) => change({ browsers })}
        />
        <Names
          label="ジェスチャーを除外するexe"
          values={gestures.excludedProcesses}
          change={(excludedProcesses) => change({ excludedProcesses })}
        />
        <div className="gesture-enabled">
          <Toggle
            label="ブラウザ条件でChromiumウィンドウだけを対象にする"
            checked={gestures.requireChromiumWindowClass}
            onChange={(requireChromiumWindowClass) => change({ requireChromiumWindowClass })}
          />
          ブラウザ条件でChromiumウィンドウだけを対象にする
        </div>{' '}
        <p className="settings-help">
          Firefoxなどではオフにします。WebBrowserToolsの操作対象もこの一覧を使います。exe名のみを指定し、パスは含めません。
        </p>
        <div className="gesture-options-grid">
          <label className="gesture-option">
            <span>移動距離（px）</span>
            <input
              type="number"
              min="5"
              max="500"
              value={gestures.distance}
              onChange={(e) => change({ distance: Number(e.target.value) })}
            />
          </label>
          <label className="gesture-option">
            <span>ホイールの最小実行間隔（ms）</span>
            <input
              type="number"
              min="0"
              max="5000"
              value={gestures.wheelDelayMs}
              onChange={(e) => change({ wheelDelayMs: Number(e.target.value) })}
            />
          </label>
          <label className="gesture-option">
            <span>待機表示の位置</span>
            <select
              value={gestures.indicatorPosition}
              onChange={(e) =>
                change({ indicatorPosition: e.target.value as typeof gestures.indicatorPosition })
              }
            >
              <option value="gesture-start">ジェスチャー開始地点</option>
              <option value="window-center">対象ウィンドウの中央</option>
            </select>
          </label>
          <label className="gesture-option">
            <span>待機表示の不透明度</span>
            <input
              type="number"
              min="0.1"
              max="1"
              step="0.05"
              value={gestures.indicatorOpacity}
              onChange={(e) => change({ indicatorOpacity: Number(e.target.value) })}
            />
          </label>
        </div>
      </details>
      <p className="settings-help">
        同じ入力で条件に一致したコマンドを一覧順に実行します。同じコマンドは1回だけ実行します。対象が変わった場合は後続の操作を中止します。
      </p>
      <div className="gesture-add">
        <select
          aria-label="追加するジェスチャー"
          value={newGesture}
          onChange={(e) => setNewGesture(e.target.value)}
        >
          {gestureTypes.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
          <option value="key:A">キーボード（追加後にキーを指定）</option>
        </select>
        <button onClick={() => setAdding(newGesture)}>割り当てを追加</button>
      </div>
      {adding && (
        <CommandPalette
          mode="select"
          commands={commands}
          pins={settings.pinnedCommands}
          shortcuts={settings.shortcuts}
          onPinsChange={(pinnedCommands) => onChange({ ...settings, pinnedCommands })}
          onClose={() => setAdding(null)}
          onChoose={(command) => {
            change({
              bindings: [
                ...rows,
                {
                  id: crypto.randomUUID(),
                  command: command.id,
                  gesture: adding,
                  enabled: true,
                  when: {
                    scope: command.extensionId ? 'owner' : 'app',
                    appletIds: [],
                    processes: [],
                  },
                },
              ],
            });
            setAdding(null);
          }}
        />
      )}{' '}
      {error && <p role="alert">{error}</p>}
      <p className="settings-help">
        同じジェスチャーの中で上から実行します。左端のハンドルをドラッグして並べ替えられます。ハンドルにフォーカスして上下キーでも移動できます。
      </p>
      {groups.map((group) => (
        <section
          className="gesture-group"
          key={group.gesture}
          data-gesture-group={group.gesture}
          aria-label={gestureTitle(group.gesture)}
        >
          <div className="gesture-group-heading">
            <h3>
              {gestureTitle(group.gesture)} <small>{group.bindings.length}件</small>
            </h3>
            <button
              aria-label={`${gestureTitle(group.gesture)}に割り当てを追加`}
              onClick={() => setAdding(group.gesture)}
            >
              ＋ 割り当てを追加
            </button>
          </div>
          <div className="gesture-table-scroll">
            <table className="gesture-table">
              <thead>
                <tr>
                  <th>順番</th>
                  <th>有効</th>
                  <th>コマンド</th>
                  <th>ジェスチャー</th>
                  <th>いつ・どこで</th>
                  <th>その他</th>
                </tr>
              </thead>
              <tbody>
                {group.bindings.map((r, groupIndex) => {
                  const index = rows.findIndex((row) => row.id === r.id);
                  const c = catalog.get(r.command);
                  const shared = rows.filter((x) => x.enabled && x.gesture === r.gesture).length;
                  return (
                    <tr
                      key={r.id}
                      data-gesture-row={r.id}
                      className={dropTarget === r.id ? 'gesture-drop-target' : ''}
                      onDragOver={(e) => {
                        if (rows.find((row) => row.id === dragged)?.gesture !== r.gesture) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDropTarget(r.id);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragged) move(dragged, r.id);
                        setDragged(null);
                        setDropTarget(null);
                      }}
                    >
                      <td>
                        <button
                          className="gesture-drag-handle"
                          draggable
                          aria-label={`割り当て${index + 1}を並べ替え`}
                          title="ドラッグ、または上下キーでグループ内を並べ替え"
                          onDragStart={(e) => {
                            setDragged(r.id);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', r.id);
                          }}
                          onDragEnd={() => {
                            setDragged(null);
                            setDropTarget(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                            e.preventDefault();
                            e.stopPropagation();
                            const target =
                              group.bindings[groupIndex + (e.key === 'ArrowUp' ? -1 : 1)];
                            if (target) move(r.id, target.id);
                          }}
                        >
                          <span aria-hidden="true">⠿</span> {groupIndex + 1}
                        </button>
                      </td>
                      <td>
                        <Toggle
                          label={`割り当て${index + 1}を有効`}
                          checked={r.enabled}
                          onChange={(enabled) => update(r.id, { enabled })}
                        />
                      </td>
                      <td>
                        <strong>{c?.title ?? r.command}</strong>
                        <small>{c?.extension ?? '未確認のコマンド'}</small>
                        <small className="command-id">{r.command}</small>
                        {!c?.available && <small>現在利用できません</small>}
                      </td>
                      <td>
                        <select
                          aria-label={`割り当て${index + 1}のジェスチャー`}
                          value={r.gesture.startsWith('key:') ? 'key' : r.gesture}
                          onChange={(e) =>
                            update(r.id, {
                              gesture: e.target.value === 'key' ? 'key:A' : e.target.value,
                            })
                          }
                        >
                          {gestureTypes.map(([id, title]) => (
                            <option key={id} value={id}>
                              {title}
                            </option>
                          ))}
                          <option value="key">キーボード</option>
                        </select>
                        {r.gesture.startsWith('key:') && (
                          <>
                            <input
                              aria-label={`割り当て${index + 1}のキー`}
                              readOnly
                              value={r.gesture.slice(4)}
                              title="選択してキーを押してください。Tabで次の欄へ移動します。"
                              onFocus={() => {
                                void window.dock
                                  .setShortcutRecording(true)
                                  .catch((e) => setError(String(e)));
                              }}
                              onBlur={() => {
                                void window.dock.setShortcutRecording(false);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Tab') return;
                                e.preventDefault();
                                e.stopPropagation();
                                if (e.repeat) return;
                                try {
                                  const key = shortcutFromEvent(e);
                                  if (key) update(r.id, { gesture: 'key:' + key });
                                } catch (err) {
                                  setError(String(err));
                                }
                              }}
                            />
                            <select
                              aria-label={`割り当て${index + 1}の特殊キー`}
                              value=""
                              onChange={(e) => {
                                if (e.target.value)
                                  update(r.id, { gesture: 'key:' + e.target.value });
                              }}
                            >
                              <option value="">特殊キーを選択…</option>
                              {[
                                'Tab',
                                'Ctrl+Tab',
                                'Ctrl+Shift+Tab',
                                'Escape',
                                'Enter',
                                'Space',
                                'Pause',
                              ].map((k) => (
                                <option key={k}>{k}</option>
                              ))}
                            </select>
                          </>
                        )}
                        {shared > 1 && (
                          <small>
                            同じ入力に{shared}件の割り当て。条件の重なりを確認してください。
                          </small>
                        )}
                      </td>
                      <td>
                        <select
                          aria-label={`割り当て${index + 1}の条件`}
                          value={r.when.scope}
                          onChange={(e) => {
                            const scope = e.target.value as GestureScope;
                            update(r.id, {
                              when: {
                                scope,
                                appletIds:
                                  scope === 'applets'
                                    ? [applets.find((a) => a.pages?.length)?.id ?? '']
                                    : [],
                                processes: scope === 'exe' ? ['example.exe'] : [],
                              },
                            });
                          }}
                        >
                          <option value="global">グローバル</option>
                          <option value="browser">Webブラウザ</option>
                          <option value="exe">指定したexe</option>
                          <option value="app">AppDock全体</option>
                          <option value="pages">すべてのApplet</option>
                          {c?.extensionId && <option value="owner">{c.extension}</option>}
                          {!c?.extensionId && r.when.scope === 'owner' && (
                            <option value="owner">コマンドの提供元（現在未確認）</option>
                          )}
                          <option value="applets">指定したApplet</option>
                        </select>
                        {r.when.scope === 'exe' && (
                          <Names
                            label={`割り当て${index + 1}のexe`}
                            values={r.when.processes}
                            change={(processes) => update(r.id, { when: { ...r.when, processes } })}
                          />
                        )}
                        {r.when.scope === 'applets' && (
                          <div className="gesture-applet-picker">
                            {applets
                              .filter((a) => a.pages?.length)
                              .map((a) => (
                                <label key={a.id}>
                                  <input
                                    type="checkbox"
                                    checked={r.when.appletIds.includes(a.id)}
                                    onChange={(e) =>
                                      update(r.id, {
                                        when: {
                                          ...r.when,
                                          appletIds: e.target.checked
                                            ? [...r.when.appletIds, a.id]
                                            : r.when.appletIds.filter((id) => id !== a.id),
                                        },
                                      })
                                    }
                                  />
                                  {a.displayName}
                                </label>
                              ))}
                          </div>
                        )}
                        {r.when.scope === 'owner' &&
                          c?.extensionId &&
                          !applets.find((a) => a.id === c.extensionId)?.pages?.length && (
                            <small>提供元にページがありません。別の条件を選んでください。</small>
                          )}
                      </td>
                      <td>
                        <GestureActions
                          label={`割り当て${index + 1}のその他の操作`}
                          onDuplicate={() =>
                            change({
                              bindings: [
                                ...rows.slice(0, index + 1),
                                { ...structuredClone(r), id: crypto.randomUUID() },
                                ...rows.slice(index + 1),
                              ],
                            })
                          }
                          onDelete={() =>
                            change({ bindings: rows.filter((row) => row.id !== r.id) })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {!rows.length && <p className="empty">コマンドを選んで、ジェスチャーを追加してください。</p>}
    </section>
  );
}
