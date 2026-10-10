import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { rankCommands, movePinnedCommand, type UiCommand } from '../shared/commands';
import { Icon } from './Icon';

/** Execution and selection share navigation and favorites; only the caller decides the action. */
export function CommandPalette({
  commands,
  pins = [],
  onPinsChange,
  shortcuts = {},
  busy = false,
  mode = 'execute',
  onChoose,
  onClose,
  selectionDescription,
}: {
  commands: UiCommand[];
  pins?: string[];
  onPinsChange?(ids: string[]): void;
  shortcuts?: Record<string, string[]>;
  busy?: boolean;
  mode?: 'execute' | 'select';
  onChoose(command: UiCommand): void;
  onClose(): void;
  selectionDescription?(command: UiCommand): string;
}) {
  const [query, setQuery] = useState(''),
    [index, setIndex] = useState(0),
    [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null),
    prefix = useId();
  const filtered = rankCommands(
    commands.filter(
      (c) =>
        !c.hidden &&
        `${c.title} ${c.extension} ${c.id}`.toLowerCase().includes(query.toLowerCase()),
    ),
    pins,
  );
  const selected = Math.min(index, Math.max(0, filtered.length - 1));
  const visiblePins = filtered.filter((c) => pins.includes(c.id)).map((c) => c.id);
  const canChoose = (c: UiCommand) => !busy && (mode === 'select' || c.available);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.querySelector('input')?.focus();
    if (mode === 'select')
      void window.dock.setShortcutRecording(true).catch((e) => setError(String(e)));
    return () => {
      if (mode === 'select') void window.dock.setShortcutRecording(false);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [mode]);
  useEffect(() => {
    ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selected, query]);
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="command-palette"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'select' ? 'コマンドを選択' : 'コマンドパレット'}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
          if (e.key === 'Tab') {
            const nodes = Array.from(
              ref.current?.querySelectorAll<HTMLElement>('input, button:not(:disabled)') ?? [],
            );
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="palette-input">
          <Icon name="search" />
          <input
            aria-label="コマンドを検索"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls={`${prefix}-results`}
            aria-activedescendant={filtered[selected] ? `${prefix}-option-${selected}` : undefined}
            placeholder={mode === 'select' ? '割り当てるコマンドを検索…' : 'コマンドを入力…'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setIndex(
                  filtered.length
                    ? (selected + (e.key === 'ArrowDown' ? 1 : -1) + filtered.length) %
                        filtered.length
                    : 0,
                );
              }
              if (
                e.key === 'Enter' &&
                !e.repeat &&
                filtered[selected] &&
                canChoose(filtered[selected])
              ) {
                e.preventDefault();
                onChoose(filtered[selected]);
              }
            }}
          />
          <button aria-label="パレットを閉じる" onClick={onClose}>
            <kbd>Esc</kbd>
          </button>
        </div>
        <div className="palette-label">{mode === 'select' ? 'コマンドを選択' : 'COMMANDS'}</div>
        <div
          id={`${prefix}-results`}
          className="palette-results"
          role="listbox"
          aria-label="コマンド検索結果"
        >
          {filtered.map((c, i) => {
            const pinned = pins.includes(c.id),
              pinIndex = visiblePins.indexOf(c.id);
            return (
              <div
                className={`palette-command ${pinned ? 'pinned' : ''} ${i === selected ? 'highlighted' : ''}`}
                id={`${prefix}-option-${i}`}
                role="option"
                aria-selected={i === selected}
                key={c.id}
                data-command-id={c.id}
              >
                <button
                  className="palette-execute"
                  disabled={!canChoose(c)}
                  onClick={() => onChoose(c)}
                >
                  <Icon name={mode === 'select' ? 'check' : 'play'} size={16} />
                  <div>
                    {c.title}
                    <small title={c.extension}>
                      <span className="command-id">{c.id}</span>
                      {!c.available && <span> · Applet起動後に利用できます</span>}
                      {pinned && <span className="pin-badge">PINNED</span>}
                    </small>
                    {selectionDescription && <small>{selectionDescription(c)}</small>}
                  </div>
                  {shortcuts[c.id]?.[0] && <kbd>{shortcuts[c.id][0]}</kbd>}
                </button>
                {onPinsChange && (
                  <div className="palette-pin-controls">
                    {pinned && (
                      <>
                        <button
                          aria-label={`${c.title}を上に移動`}
                          disabled={busy || pinIndex <= 0}
                          onClick={() =>
                            onPinsChange(movePinnedCommand(pins, c.id, -1, visiblePins))
                          }
                        >
                          ↑
                        </button>
                        <button
                          aria-label={`${c.title}を下に移動`}
                          disabled={busy || pinIndex === visiblePins.length - 1}
                          onClick={() =>
                            onPinsChange(movePinnedCommand(pins, c.id, 1, visiblePins))
                          }
                        >
                          ↓
                        </button>
                      </>
                    )}
                    <button
                      className="pin-toggle"
                      aria-label={`${c.title}を${pinned ? 'ピン留め解除' : 'ピン留め'}`}
                      aria-pressed={pinned}
                      disabled={busy}
                      onClick={() =>
                        onPinsChange(pinned ? pins.filter((id) => id !== c.id) : [...pins, c.id])
                      }
                    >
                      {pinned ? '★' : '☆'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {!filtered.length && <p className="empty">該当するコマンドはありません。</p>}
        </div>
        {error && <p role="alert">{error}</p>}
        <div className="palette-footer">
          ↑↓キーで選択・Enterで{mode === 'select' ? '選択（実行しません）' : '実行'}・Escで閉じる。
          {onPinsChange && '☆でピン留め、矢印ボタンで並べ替え。'}
        </div>
      </div>
    </div>,
    document.body,
  );
}
