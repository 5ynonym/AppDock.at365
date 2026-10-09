import { useEffect, useRef, useState } from 'react';
import { BindingActions } from './BindingActions';
import { CommandPalette } from './CommandPalette';
import { Toggle } from './Toggle';
import { shortcutFromEvent, type UiCommand } from '../shared/commands';
import type { Settings, GlobalHotKeyStatus, ExtensionSnapshot } from '../shared/contracts';
import {
  defaultKeybindings,
  addDefaultBindings,
  getKeybindings,
  withKeybindings,
  shortcutScopes,
  moveKeybindingInGroup,
  type Keybinding,
  type ShortcutScope,
} from '../shared/keybindings';

export function ShortcutsEditor({
  commands,
  settings,
  onChange,
  statuses,
  applets,
  extensions,
  owner,
}: {
  commands: UiCommand[];
  settings: Settings;
  onChange(value: Settings): void;
  statuses: GlobalHotKeyStatus[];
  applets: { id: string; title: string }[];
  extensions: ExtensionSnapshot[];
  owner?: string | null;
}) {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [recordError, setRecordError] = useState('');
  const [recording, setRecording] = useState('');
  const [choosing, setChoosing] = useState<string | null>(null);
  const [appletFilter, setAppletFilter] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [focusBinding, setFocusBinding] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const lastStatuses = useRef(statuses);
  useEffect(() => {
    // Recording temporarily releases all OS registrations; keep any error visible until rechecked.
    if (statuses.length) lastStatuses.current = statuses;
  }, [statuses]);
  const displayedStatuses = statuses.length ? statuses : lastStatuses.current;
  const rows = getKeybindings(settings);
  const defaults = [
    ...defaultKeybindings(),
    ...extensions.flatMap((extension) =>
      addDefaultBindings(
        [],
        extension.id,
        extension.runtime === 'web'
          ? settings.webApplets.shortcutDefaults.map((binding) => ({
              ...binding,
              command: `${extension.id}.${binding.command}`,
            }))
          : (extension.defaultKeybindings ?? []),
      ),
    ),
  ];
  const change = (next: Keybinding[]) => onChange(withKeybindings(settings, next));
  const update = (id: string, patch: Partial<Keybinding>) =>
    change(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const error = (e: unknown) => setRecordError(String(e));
  const create = (command: UiCommand, key: string): Keybinding => ({
    id: crypto.randomUUID(),
    command: command.id,
    key,
    enabled: true,
    when: { scope: command.extensionId ? 'owner' : 'app', appletIds: [] },
  });
  const move = (id: string, direction: number) => {
    const next = [...rows],
      from = rows.findIndex((row) => row.id === id),
      to = from + direction;
    if (to < 0 || to >= next.length) return;
    [next[from], next[to]] = [next[to], next[from]];
    change(next);
  };
  useEffect(() => {
    const focus = () => {
      if (document.activeElement?.matches('[data-shortcut-recorder]'))
        void window.dock.setShortcutRecording(true).catch(error);
    };
    window.addEventListener('focus', focus);
    return () => {
      window.removeEventListener('focus', focus);
      void window.dock.setShortcutRecording(false).catch(() => {});
    };
  }, []);
  const known = new Map(commands.map((c) => [c.id, c]));
  for (const row of rows)
    if (!known.has(row.command))
      known.set(row.command, {
        id: row.command,
        title: row.command,
        extension: '未確認のコマンド',
        available: false,
      });
  const groupForCommand = (id: string) => {
    const command = known.get(id);
    return !command ||
      command.extension === '未確認のコマンド' ||
      (command.extensionId && !extensions.some((applet) => applet.id === command.extensionId))
      ? 'unknown'
      : (command.extensionId ?? 'appdock');
  };
  const groupOrders = new Map<string, number>();
  const groupCounts = new Map<string, number>();
  for (const row of rows) {
    const group = groupForCommand(row.command);
    const order = (groupCounts.get(group) ?? 0) + 1;
    groupCounts.set(group, order);
    groupOrders.set(row.id, order);
  }
  const moveInGroup = (id: string, target: string) =>
    change(moveKeybindingInGroup(rows, id, target, groupForCommand));
  const addBinding = (command: UiCommand) => {
    const binding = create(command, '');
    change([...rows, binding]);
    setFilter('');
    setStatusFilter('all');
    setAdding(null);
    setFocusBinding(binding.id);
  };
  const duplicate = (row: Keybinding) => {
    const index = rows.indexOf(row),
      binding = { ...structuredClone(row), id: crypto.randomUUID() };
    change([...rows.slice(0, index + 1), binding, ...rows.slice(index + 1)]);
    setFocusBinding(binding.id);
  };
  useEffect(() => {
    if (!focusBinding) return;
    const frame = requestAnimationFrame(() => {
      document
        .querySelector<HTMLInputElement>(
          `[data-binding-id="${focusBinding}"] [data-shortcut-recorder]`,
        )
        ?.focus();
      setFocusBinding(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusBinding]);
  const entries = [
    ...rows.map((row) => ({ command: known.get(row.command)!, row })),
    ...[...known.values()]
      .filter((c) => !rows.some((row) => row.command === c.id) && !c.hidden)
      .map((command) => ({ command, row: undefined as Keybinding | undefined })),
  ].filter(
    ({ command, row }) =>
      (owner === undefined || command.extensionId === owner) &&
      `${command.title} ${command.extension} ${command.id} ${row?.key ?? ''}`
        .toLowerCase()
        .includes(filter.toLowerCase()) &&
      (statusFilter === 'all' ||
        (statusFilter === 'assigned' && row) ||
        (statusFilter === 'unassigned' && !row) ||
        (statusFilter === 'conflict' &&
          row &&
          row.enabled &&
          row.when.scope === 'global' &&
          command.available &&
          displayedStatuses.some(
            (s) => s.commandId === row.command && s.shortcut === row.key && s.error,
          ))),
  );
  const groups =
    owner === undefined
      ? [
          {
            id: 'appdock',
            title: 'AppDock',
            entries: entries.filter(
              (e) => !e.command.extensionId && e.command.extension !== '未確認のコマンド',
            ),
          },
          ...extensions.map((applet) => ({
            id: applet.id,
            title: applet.displayName,
            entries: entries.filter((e) => e.command.extensionId === applet.id),
          })),
          {
            id: 'unknown',
            title: '未確認のコマンド',
            entries: entries.filter(
              (e) =>
                e.command.extension === '未確認のコマンド' ||
                (e.command.extensionId && !extensions.some((a) => a.id === e.command.extensionId)),
            ),
          },
        ].filter(
          (group) =>
            group.entries.length || (group.id === 'appdock' && !filter && statusFilter === 'all'),
        )
      : [{ id: owner ?? 'appdock', title: '', entries }];
  return (
    <div className="shortcuts-editor">
      <h2>ショートカットキー</h2>
      <p className="settings-help">
        キー欄を選んでキーを押し、「いつ・どこで」を選びます。変更は保存で反映します。同じキーで条件を満たしたコマンドを実行順に処理し、同じコマンドは1回だけ実行します。Tabで次の欄、Escapeで記録を終了します。
      </p>
      <p className="settings-help">
        AppletのWeb画面では文字入力を守るため、Ctrl /
        Alt付き、F1〜F24、Pauseを受け付けます。グローバルは他のアプリでも有効です。
      </p>
      {recordError && <p role="alert">{recordError}</p>}
      <div className="shortcut-filters">
        <input
          className="shortcut-filter"
          aria-label="ショートカットのコマンドを検索"
          placeholder="コマンド・キーを検索…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div
          className="tabs shortcut-status-filter"
          role="group"
          aria-label="ショートカットの絞り込み"
        >
          {[
            ['all', 'すべて'],
            ['assigned', '割り当て済み'],
            ['unassigned', '未設定'],
            ['conflict', '登録エラー'],
          ].map(([value, title]) => (
            <button
              key={value}
              aria-pressed={statusFilter === value}
              className={statusFilter === value ? 'selected' : ''}
              onClick={() => setStatusFilter(value)}
            >
              {title}
            </button>
          ))}
        </div>
      </div>
      {owner === undefined && (
        <p className="settings-help">
          AppDockを先頭に、Applet一覧の順で表示します。グループの表示順と、割り当ての実行順は別です。
        </p>
      )}
      <p className="settings-help">
        左端のつまみをドラッグ、または上下キーで同じApplet内の実行順を変更できます。番号はグループ内の順番です。その他の操作は「…」から開けます。新しい割り当てはキーを指定してから保存してください。
      </p>
      <div className="gesture-add shortcut-add">
        <button onClick={() => setAdding(owner === undefined ? '*' : (owner ?? 'appdock'))}>
          割り当てを追加
        </button>
      </div>
      {adding !== null && (
        <CommandPalette
          mode="select"
          commands={commands.filter(
            (command) => adding === '*' || groupForCommand(command.id) === adding,
          )}
          pins={settings.pinnedCommands}
          shortcuts={settings.shortcuts}
          onPinsChange={(pinnedCommands) => onChange({ ...settings, pinnedCommands })}
          onClose={() => setAdding(null)}
          onChoose={addBinding}
        />
      )}
      {groups.map((group) => (
        <section
          className={`shortcut-group${group.title ? ' gesture-group' : ''}`}
          key={group.id}
          data-shortcut-owner={group.id}
          aria-label={group.title || undefined}
        >
          {group.title && (
            <div className="shortcut-group-heading gesture-group-heading">
              <h3>
                {group.title}
                <small>{group.entries.length}件</small>
              </h3>
              {group.id !== 'unknown' && (
                <button
                  aria-label={`${group.title}に割り当てを追加`}
                  onClick={() => setAdding(group.id)}
                >
                  ＋ 割り当てを追加
                </button>
              )}
            </div>
          )}
          <div className="keybindings-scroll gesture-table-scroll">
            <table className="keybindings-table gesture-table">
              <colgroup>
                <col className="binding-order-column" />
                <col className="binding-enabled-column" />
                <col />
                <col className="binding-input-column" />
                <col className="binding-condition-column" />
                <col className="binding-actions-column" />
              </colgroup>
              <thead>
                <tr>
                  <th>順番</th>
                  <th>有効</th>
                  <th>コマンド</th>
                  <th>キーバインド</th>
                  <th>いつ・どこで</th>
                  <th>その他</th>
                </tr>
              </thead>
              <tbody>
                {group.entries.map(({ command, row }) => {
                  const index = row ? rows.indexOf(row) : -1;
                  const rowKey = row?.id ?? `empty:${command.id}`;
                  const commandIndex = row
                    ? rows.filter((r) => r.command === command.id).indexOf(row) + 1
                    : 1;
                  const status =
                    row?.when.scope === 'global' && row.enabled && command.available
                      ? displayedStatuses.find(
                          (s) => s.commandId === row.command && s.shortcut === row.key,
                        )
                      : undefined;
                  const choices = [
                    ...applets,
                    ...(row?.when.appletIds ?? [])
                      .filter((id) => !applets.some((a) => a.id === id))
                      .map((id) => ({ id, title: `未導入: ${id}` })),
                  ];
                  return (
                    <tr
                      key={rowKey}
                      data-shortcut-command={command.id}
                      data-binding-id={row?.id}
                      className={dropTarget === row?.id ? 'gesture-drop-target' : ''}
                      onDragOver={(event) => {
                        const source = rows.find((item) => item.id === dragged);
                        if (
                          !row ||
                          !source ||
                          groupForCommand(source.command) !== groupForCommand(row.command)
                        )
                          return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        setDropTarget(row.id);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (row && dragged) moveInGroup(dragged, row.id);
                        setDragged(null);
                        setDropTarget(null);
                      }}
                    >
                      <td>
                        {row ? (
                          <button
                            className="gesture-drag-handle"
                            draggable
                            aria-label={`${command.title}のショートカット ${commandIndex}を並べ替え`}
                            title="ドラッグ、または上下キーで同じApplet内の実行順を変更"
                            onDragStart={(event) => {
                              setDragged(row.id);
                              event.dataTransfer.effectAllowed = 'move';
                              event.dataTransfer.setData('text/plain', row.id);
                            }}
                            onDragEnd={() => {
                              setDragged(null);
                              setDropTarget(null);
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                              event.preventDefault();
                              event.stopPropagation();
                              const visible = group.entries.flatMap((entry) =>
                                entry.row ? [entry.row] : [],
                              );
                              const target =
                                visible[visible.indexOf(row) + (event.key === 'ArrowUp' ? -1 : 1)];
                              if (target) moveInGroup(row.id, target.id);
                            }}
                          >
                            <span aria-hidden="true">⠿</span> {groupOrders.get(row.id)}
                          </button>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        {row && (
                          <Toggle
                            label={`${command.title}の割り当てを有効にする`}
                            checked={row.enabled}
                            onChange={(enabled) => update(row.id, { enabled })}
                          />
                        )}
                      </td>
                      <td>
                        <strong>{command.title}</strong>
                        <small>{command.extension}</small>
                        <small className="command-id" title={command.extension}>
                          {command.id}
                        </small>
                        {!command.available && <small>現在利用できません</small>}
                        {['appdock.quit', 'appdock.restart'].includes(command.id) && (
                          <small>終了・再起動より後の処理は実行されません。</small>
                        )}
                        <label className="keybinding-tray">
                          <input
                            type="checkbox"
                            aria-label={`${command.title}をトレイに表示`}
                            checked={settings.trayCommands.includes(command.id)}
                            onChange={(e) =>
                              onChange({
                                ...settings,
                                trayCommands: e.target.checked
                                  ? [...new Set([...settings.trayCommands, command.id])]
                                  : settings.trayCommands.filter((id) => id !== command.id),
                              })
                            }
                          />
                          トレイに表示
                        </label>
                      </td>
                      <td>
                        <input
                          readOnly
                          data-shortcut-recorder="true"
                          aria-label={`${command.title}のショートカット ${commandIndex}`}
                          value={row?.key ?? ''}
                          placeholder={recording === rowKey ? 'キーを押してください…' : '未設定'}
                          onFocus={() => {
                            setRecordError('');
                            setRecording(rowKey);
                            void window.dock.setShortcutRecording(true).catch(error);
                          }}
                          onBlur={() => {
                            setRecording('');
                            void window.dock.setShortcutRecording(false).catch(error);
                          }}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) return;
                            e.preventDefault();
                            if (e.key === 'Escape') {
                              e.currentTarget.blur();
                              return;
                            }
                            const key = shortcutFromEvent(e.nativeEvent);
                            if (key) {
                              if (row) update(row.id, { key });
                              else {
                                e.currentTarget.blur();
                                change([...rows, create(command, key)]);
                              }
                            }
                          }}
                        />
                        <select
                          aria-label={`${command.title}の特殊キー ${commandIndex}`}
                          value=""
                          onChange={(event) => {
                            if (!event.target.value) return;
                            if (row) update(row.id, { key: event.target.value });
                            else change([...rows, create(command, event.target.value)]);
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
                          ].map((key) => (
                            <option key={key}>{key}</option>
                          ))}
                        </select>
                        {row && !row.key && <small>キーを指定してください。</small>}
                        {status?.error && (
                          <small role="alert" className="shortcut-conflict">
                            {status.error}
                          </small>
                        )}
                        {status?.error && (
                          <button
                            className="text-button"
                            onClick={() => void window.dock.retryGlobalHotKeys().catch(error)}
                          >
                            登録を再試行
                          </button>
                        )}
                      </td>
                      <td>
                        {row ? (
                          <>
                            <select
                              aria-label={`${command.title}のいつ・どこで ${commandIndex}`}
                              value={row.when.scope}
                              onChange={(e) => {
                                const scope = e.target.value as ShortcutScope;
                                update(row.id, {
                                  when: {
                                    scope,
                                    appletIds: scope === 'applets' ? row.when.appletIds : [],
                                  },
                                });
                                setChoosing(scope === 'applets' ? row.id : null);
                                setAppletFilter('');
                              }}
                            >
                              {shortcutScopes
                                .filter(
                                  (s) =>
                                    s.id !== 'owner' ||
                                    command.extensionId ||
                                    row.when.scope === 'owner',
                                )
                                .map((s) => (
                                  <option
                                    key={s.id}
                                    value={s.id}
                                    disabled={s.id === 'owner' && !command.extensionId}
                                  >
                                    {s.id === 'owner' ? command.extension : s.title}
                                  </option>
                                ))}
                            </select>
                            {row.when.scope === 'applets' && (
                              <>
                                <button
                                  className="keybinding-targets"
                                  aria-expanded={choosing === row.id}
                                  onClick={() => {
                                    setChoosing(choosing === row.id ? null : row.id);
                                    setAppletFilter('');
                                  }}
                                >
                                  {row.when.appletIds.length
                                    ? row.when.appletIds
                                        .map((id) => choices.find((a) => a.id === id)?.title ?? id)
                                        .join(' / ')
                                    : 'Appletを選択…'}
                                </button>
                                {choosing === row.id && (
                                  <div
                                    className="keybinding-picker"
                                    role="group"
                                    aria-label="対象Applet"
                                  >
                                    <input
                                      aria-label="対象Appletを検索"
                                      placeholder="Appletを検索…"
                                      value={appletFilter}
                                      onChange={(e) => setAppletFilter(e.target.value)}
                                    />
                                    {choices
                                      .filter((a) =>
                                        `${a.title} ${a.id}`
                                          .toLowerCase()
                                          .includes(appletFilter.toLowerCase()),
                                      )
                                      .map((a) => (
                                        <label key={a.id}>
                                          <input
                                            type="checkbox"
                                            checked={row.when.appletIds.includes(a.id)}
                                            onChange={(e) =>
                                              update(row.id, {
                                                when: {
                                                  ...row.when,
                                                  appletIds: e.target.checked
                                                    ? [...row.when.appletIds, a.id]
                                                    : row.when.appletIds.filter(
                                                        (id) => id !== a.id,
                                                      ),
                                                },
                                              })
                                            }
                                          />
                                          {a.title}
                                        </label>
                                      ))}
                                    {!choices.length && <small>Appletが登録されていません。</small>}
                                    <button onClick={() => setChoosing(null)}>閉じる</button>
                                  </div>
                                )}
                                {!row.when.appletIds.length && (
                                  <small role="alert">1件以上選択してください。</small>
                                )}
                              </>
                            )}
                          </>
                        ) : (
                          <span>キーを設定すると選べます</span>
                        )}
                      </td>
                      <td>
                        <BindingActions
                          label={`${command.title}のショートカット ${commandIndex}のその他の操作`}
                          removalKind="clear-key"
                          onDuplicate={row ? () => duplicate(row) : undefined}
                          onDelete={
                            row
                              ? () => change(rows.filter((item) => item.id !== row.id))
                              : undefined
                          }
                          extraActions={[
                            ...(row
                              ? [
                                  {
                                    title: '全体の実行順を上げる',
                                    disabled: index === 0,
                                    onClick: () => move(row.id, -1),
                                  },
                                  {
                                    title: '全体の実行順を下げる',
                                    disabled: index === rows.length - 1,
                                    onClick: () => move(row.id, 1),
                                  },
                                ]
                              : [{ title: '割り当てを追加', onClick: () => addBinding(command) }]),
                            {
                              title: '既定に戻す',
                              onClick: () =>
                                change([
                                  ...rows.filter((item) => item.command !== command.id),
                                  ...defaults
                                    .filter((item) => item.command === command.id)
                                    .map((item) => ({ ...item, id: crypto.randomUUID() })),
                                ]),
                            },
                          ]}
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
      {!entries.length && (
        <p className="empty">
          該当するコマンドはありません。停止中のAppletでまだ取得していないコマンドは、起動後に表示されます。
        </p>
      )}
    </div>
  );
}
