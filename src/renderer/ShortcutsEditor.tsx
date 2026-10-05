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
}: {
  commands: UiCommand[];
  bindings: Record<string, string[]>;
  onChange(value: Record<string, string[]>): void;
  globalCommands: string[];
  onGlobalChange(value: string[]): void;
  statuses: GlobalHotKeyStatus[];
  onRestore(id: string): void;
}) {
  const [filter, setFilter] = useState('');
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
      {commands
        .filter((c) =>
          (c.title + ' ' + c.extension + ' ' + c.id).toLowerCase().includes(filter.toLowerCase()),
        )
        .map((command) => {
          const current = bindings[command.id] ?? [];
          const shown = current.length
            ? [...current, ...(adding === command.id ? [''] : [])]
            : [''];
          return (
            <div className="shortcut-row" key={command.id} data-shortcut-command={command.id}>
              <div className="shortcut-description">
                <strong>{command.title}</strong>
                <span>
                  {command.extension}
                  {!command.available && ' · 現在利用できません'}
                </span>
                <code>{command.id}</code>
                <label className="shortcut-global">
                  <input
                    type="checkbox"
                    checked={globalCommands.includes(command.id)}
                    onChange={(event) => setGlobal(command.id, event.target.checked)}
                  />
                  グローバル
                </label>
                {globalCommands.includes(command.id) && !command.available && (
                  <span>Applet起動時に登録します</span>
                )}
                {statuses
                  .filter((status) => status.commandId === command.id)
                  .map((status) => (
                    <span key={status.shortcut} role={status.error ? 'alert' : undefined}>
                      {status.shortcut}:{' '}
                      {status.error ?? (status.registered ? '登録済み' : '未登録')}
                    </span>
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
