import { useState } from 'react';
import { defaultShortcuts, shortcutFromEvent, type UiCommand } from '../shared/commands';
export function ShortcutsEditor({
  commands,
  bindings,
  onChange,
}: {
  commands: UiCommand[];
  bindings: Record<string, string[]>;
  onChange(value: Record<string, string[]>): void;
}) {
  const [filter, setFilter] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [recording, setRecording] = useState('');
  const setBindings = (id: string, values: string[]) => onChange({ ...bindings, [id]: values });
  return (
    <div className="shortcuts-editor">
      <h3>ショートカットキー</h3>
      <p className="settings-help">
        欄を選び、割り当てたいキーを押してください。AppDockの画面を操作している間に使えます。Backspace
        / Deleteで解除できます。
      </p>
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
                        onFocus={() => setRecording(recordId)}
                        onBlur={() => {
                          setRecording('');
                          setAdding(null);
                        }}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (event.key === 'Tab') return;
                          event.preventDefault();
                          if (event.key === 'Escape') {
                            event.currentTarget.blur();
                            return;
                          }
                          if (
                            !event.ctrlKey &&
                            !event.altKey &&
                            ['Backspace', 'Delete'].includes(event.key)
                          ) {
                            setBindings(
                              command.id,
                              current.filter((_, i) => i !== index),
                            );
                            setAdding(null);
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
                  {current.length > 0 && current.length < 5 && (
                    <button className="text-button" onClick={() => setAdding(command.id)}>
                      別キーを追加
                    </button>
                  )}
                  <button
                    className="text-button"
                    onClick={() => {
                      setBindings(command.id, structuredClone(defaultShortcuts[command.id] ?? []));
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
