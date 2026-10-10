import { useEffect, useRef, useState } from 'react';
import type { UiCommand } from '../shared/commands';
import type { Settings, GlobalHotKeyStatus } from '../shared/contracts';
import { getKeybindings, keybindingConditionLabel, type Keybinding } from '../shared/keybindings';
import { ShortcutCommandList } from './ShortcutCommandList';
import { ShortcutOrderDialog } from './ShortcutOrderDialog';

/** Settings adds catalog-wide discovery around the same command list used by Applet details. */
export function ShortcutsEditor({
  commands,
  settings,
  onChange,
  statuses,
  applets,
}: {
  commands: UiCommand[];
  settings: Settings;
  onChange(value: Settings): void;
  statuses: GlobalHotKeyStatus[];
  applets: { id: string; title: string }[];
}) {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState('');
  const [orderOpen, setOrderOpen] = useState(false);
  const lastStatuses = useRef(statuses);
  useEffect(() => {
    if (statuses.length) lastStatuses.current = statuses;
  }, [statuses]);
  const displayedStatuses = statuses.length ? statuses : lastStatuses.current;
  const rows = getKeybindings(settings);
  const known = new Map(commands.map((command) => [command.id, command]));
  for (const row of rows)
    if (!known.has(row.command))
      known.set(row.command, {
        id: row.command,
        title: row.command,
        extension: '未確認のコマンド',
        available: false,
      });
  const catalog = [...known.values()].filter(
    (command) => !command.hidden || rows.some((row) => row.command === command.id),
  );
  const statusError = (row: Keybinding) =>
    row.enabled && row.when.scope === 'global' && known.get(row.command)?.available
      ? displayedStatuses.find(
          (status) => status.commandId === row.command && status.shortcut === row.key,
        )?.error
      : undefined;
  const terms = filter.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const visible = catalog.filter((command) => {
    const assigned = rows.filter((row) => row.command === command.id);
    const text = [
      command.title,
      command.id,
      command.extension,
      ...assigned.map(
        (row) =>
          `${row.key} ${keybindingConditionLabel(row.when, command.extensionId ? command.extension : undefined, applets)}`,
      ),
    ]
      .join(' ')
      .toLocaleLowerCase();
    return (
      terms.every((term) => text.includes(term)) &&
      (statusFilter === 'all' ||
        (statusFilter === 'assigned' && assigned.length > 0) ||
        (statusFilter === 'unassigned' && !assigned.length) ||
        (statusFilter === 'conflict' && assigned.some((row) => statusError(row))))
    );
  });
  return (
    <div className="shortcuts-editor command-shortcuts">
      <header className="command-shortcuts-heading">
        <div>
          <h2>ショートカットキー</h2>
          <p>コマンドを見つけて、キーと使う場面を設定できます。</p>
        </div>
        <span className="command-count">{catalog.length} コマンド</span>
      </header>
      <div className="command-shortcut-tools">
        <div className="command-shortcut-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label="ショートカットのコマンドを検索"
            placeholder="コマンド・キー・提供元を検索…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
        <select
          className="shortcut-status-filter"
          aria-label="ショートカットの絞り込み"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">すべて</option>
          <option value="assigned">割り当て済み</option>
          <option value="unassigned">未割り当て</option>
          <option value="conflict">登録エラー</option>
        </select>
      </div>
      <div className="command-shortcut-summary">
        <span role="status">
          {visible.length} / {catalog.length} コマンドを表示
        </span>
        <button className="text-button shortcut-order-open" onClick={() => setOrderOpen(true)}>
          実行順…
        </button>
        {(filter || statusFilter !== 'all') && (
          <button
            className="text-button"
            onClick={() => {
              setFilter('');
              setStatusFilter('all');
            }}
          >
            絞り込みを解除
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {rows.length >= 2000 && (
        <p role="status">
          割り当ては2000件までです。追加するには既存の割り当てを削除してください。
        </p>
      )}
      <ShortcutCommandList
        commands={visible}
        allCommands={catalog}
        settings={settings}
        applets={applets}
        onChange={onChange}
        showProvider
        statusError={statusError}
        onRetry={() =>
          void window.dock.retryGlobalHotKeys().catch((reason) => setError(String(reason)))
        }
      />
      {orderOpen && (
        <ShortcutOrderDialog
          settings={settings}
          commands={catalog}
          applets={applets}
          onChange={onChange}
          onClose={() => setOrderOpen(false)}
        />
      )}
    </div>
  );
}
