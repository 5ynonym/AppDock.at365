import { useEffect, useState } from 'react';
import { shortcutFromEvent, type UiCommand } from '../shared/commands';
import type { GlobalHotKeyStatus } from '../shared/contracts';
export function ShortcutsEditor({
  commands,
  bindings,
  onChange,
  globalCommands,
  onGlobalChange,
  statuses,
  onRestore,
  owner,
}: {
  commands: UiCommand[];
  bindings: Record<string, string[]>;
  onChange(value: Record<string, string[]>): void;
  globalCommands: string[];
  onGlobalChange(value: string[]): void;
  statuses: GlobalHotKeyStatus[];
  onRestore(id: string): void;
  owner?: string | null;
}) {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const conflicts = (id: string) =>
    Object.entries(bindings).flatMap(([otherId, keys]) =>
      otherId === id
        ? []
        : keys
            .filter((key) => bindings[id]?.includes(key))
            .map((key) => {
              const other = commands.find((command) => command.id === otherId);
              return `${key} は ${other ? `${other.extension} / ${other.title}` : otherId} にも割り当てられています。`;
            }),
    );
  const visible = commands
    .filter(
      (command) =>
        (owner === undefined || command.extensionId === owner) &&
        `${command.title} ${command.extension} ${command.id} ${(bindings[command.id] ?? []).join(' ')}`
          .toLowerCase()
          .includes(filter.toLowerCase()) &&
        (statusFilter === 'all' ||
          (statusFilter === 'assigned' && bindings[command.id]?.length) ||
          (statusFilter === 'unassigned' && !bindings[command.id]?.length) ||
          (statusFilter === 'conflict' &&
            (conflicts(command.id).length ||
              statuses.some((status) => status.commandId === command.id && status.error)))),
    )
    .sort((a, b) => {
      const group = (command: UiCommand) =>
        command.extensionId === null
          ? '0'
          : command.extensionId === undefined
            ? '2'
            : `1${command.extension}\0${command.extensionId}`;
      return group(a).localeCompare(group(b), 'ja') || a.title.localeCompare(b.title, 'ja');
    });
  const [adding, setAdding] = useState<string | null>(null);
  const [recording, setRecording] = useState('');
  const setBindings = (id: string, values: string[]) => onChange({ ...bindings, [id]: values });
  const setGlobal = (id: string, enabled: boolean) =>
    onGlobalChange(
      enabled
        ? [...new Set([...globalCommands, id])]
        : globalCommands.filter((item) => item !== id),
    );
  const recordingError = (error: unknown) => setRecordError(String(error));
  const [recordError, setRecordError] = useState('');
  useEffect(() => {
    const focus = () => {
      if (document.activeElement?.matches('[data-shortcut-recorder]'))
        void window.dock.setShortcutRecording(true).catch(recordingError);
    };
    window.addEventListener('focus', focus);
    return () => {
      window.removeEventListener('focus', focus);
      void window.dock.setShortcutRecording(false).catch(() => {});
    };
  }, []);
  return (
    <div className="shortcuts-editor">
      <h3>ショートカットキー</h3>
      <p className="settings-help">
        欄を選び、割り当てたいキーを押してください。Pauseや文字キー単独にも対応します。
        「グローバル」を有効にすると、ほかのアプリを操作中やトレイ格納中にも使えます。
        ×で解除、Escapeで入力を終了します。変更は保存で反映します。
      </p>
      {recordError && <p role="alert">{recordError}</p>}
      <input
        className="shortcut-filter"
        aria-label="ショートカットのコマンドを検索"
        placeholder="コマンドを検索…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <select
        aria-label="ショートカットの絞り込み"
        value={statusFilter}
        onChange={(event) => setStatusFilter(event.target.value)}
      >
        <option value="all">すべて</option>
        <option value="assigned">割り当て済み</option>
        <option value="unassigned">未設定</option>
        <option value="conflict">競合・登録エラーあり</option>
      </select>
      {!visible.length && (
        <p className="empty">
          該当するコマンドはありません。停止中のAppletでまだ取得していないコマンドは、起動後に表示されます。
        </p>
      )}
      {visible.map((command, commandIndex) => {
        const current = bindings[command.id] ?? [];
        const shown = current.length ? [...current, ...(adding === command.id ? [''] : [])] : [''];
        return (
          <div className="shortcut-row" key={command.id} data-shortcut-command={command.id}>
            {owner === undefined &&
              (commandIndex === 0 ||
                visible[commandIndex - 1].extensionId !== command.extensionId) && (
                <h4 className="shortcut-group">
                  {command.extensionId === undefined ? '未確認のコマンド' : command.extension}
                </h4>
              )}
            <div className="shortcut-description">
              <strong>{command.title}</strong>
              <div className="shortcut-meta">
                <span title={command.extension}>{command.extension}</span>
                <code title={`コマンドID: ${command.id}`}>{command.id}</code>
              </div>
              <div className="shortcut-status-line">
                <label className="shortcut-global">
                  <input
                    type="checkbox"
                    checked={globalCommands.includes(command.id)}
                    onChange={(event) => setGlobal(command.id, event.target.checked)}
                  />
                  グローバル
                </label>
                <span className="shortcut-scope">
                  {globalCommands.includes(command.id) ? '他のアプリでも有効' : 'AppDock内のみ'}
                </span>
                {!command.available && (
                  <span className="shortcut-availability">現在利用できません</span>
                )}
                {globalCommands.includes(command.id) && !command.available && (
                  <span>Applet起動時に登録します</span>
                )}
                {statuses
                  .filter((status) => status.commandId === command.id && !status.error)
                  .map((status) => (
                    <span key={status.shortcut} title="保存済みの登録状態">
                      {status.shortcut}: {status.registered ? '登録済み' : '未登録'}
                    </span>
                  ))}
              </div>
              {conflicts(command.id).map((message) => (
                <p className="shortcut-conflict" role="alert" key={message}>
                  {message}
                </p>
              ))}
              {statuses
                .filter((status) => status.commandId === command.id && status.error)
                .map((status) => (
                  <p className="shortcut-conflict" key={status.shortcut} role="alert">
                    {status.shortcut}: {status.error}
                  </p>
                ))}
            </div>
            <div className="shortcut-bindings">
              {shown.map((binding, index) => {
                const recordId = command.id + ':' + index;
                return (
                  <div className="shortcut-binding" key={index}>
                    <input
                      readOnly
                      data-shortcut-recorder="true"
                      aria-label={`${command.title}のショートカット ${index + 1}`}
                      value={binding}
                      placeholder={recording === recordId ? 'キーを押してください…' : '未設定'}
                      onFocus={() => {
                        setRecordError('');
                        setRecording(recordId);
                        void window.dock.setShortcutRecording(true).catch(recordingError);
                      }}
                      onBlur={() => {
                        setRecording('');
                        setAdding(null);
                        void window.dock.setShortcutRecording(false).catch(recordingError);
                      }}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === 'Tab') return;
                        event.preventDefault();
                        if (event.key === 'Escape') {
                          event.currentTarget.blur();
                          return;
                        }
                        const value = shortcutFromEvent(event.nativeEvent);
                        if (value) {
                          const next = [...current];
                          next[index] = value;
                          setBindings(command.id, next);
                          setAdding(null);
                        }
                      }}
                    />
                    {binding && (
                      <button
                        className="text-button"
                        aria-label={`${command.title}のショートカット ${index + 1}を解除`}
                        onClick={() =>
                          setBindings(
                            command.id,
                            current.filter((_, i) => i !== index),
                          )
                        }
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
              <div className="shortcut-row-actions">
                {statuses.some((status) => status.commandId === command.id && status.error) && (
                  <button
                    className="text-button"
                    onClick={() => {
                      void window.dock.retryGlobalHotKeys().catch(recordingError);
                    }}
                  >
                    登録を再試行
                  </button>
                )}
                {current.length > 0 && current.length < 5 && (
                  <button className="text-button" onClick={() => setAdding(command.id)}>
                    別キーを追加
                  </button>
                )}
                <button
                  className="text-button"
                  onClick={() => {
                    onRestore(command.id);
                    setAdding(null);
                  }}
                >
                  既定に戻す
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
