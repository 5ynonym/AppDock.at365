import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Settings } from '../shared/contracts';
import type { UiCommand } from '../shared/commands';
import {
  applyKeybindingOrder,
  getKeybindings,
  keybindingGroups,
  keybindingConditionLabel,
  moveKeybindingWithinKey,
  withKeybindings,
} from '../shared/keybindings';

export function ShortcutOrderDialog({
  settings,
  commands,
  applets,
  initialKey,
  onChange,
  onClose,
}: {
  settings: Settings;
  commands: UiCommand[];
  applets: { id: string; title: string }[];
  initialKey?: string;
  onChange(value: Settings): void;
  onClose(): void;
}) {
  const [original] = useState(() => structuredClone(getKeybindings(settings)));
  const [returnFocus] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const [ordered, setOrdered] = useState(original);
  const groups = keybindingGroups(ordered);
  const [key, setKey] = useState(
    initialKey ?? groups.find(([, rows]) => rows.length > 1)?.[0] ?? groups[0]?.[0] ?? '',
  );
  const rows = groups.find(([name]) => name === key)?.[1] ?? [];
  const catalog = new Map(commands.map((command) => [command.id, command]));
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [over, setOver] = useState<string | null>(null);
  const dragged = useRef<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const selector = useRef<HTMLSelectElement>(null);
  const id = useId();
  const originalGroups = new Map(keybindingGroups(original));
  const changed = groups.filter(
    ([name, group]) =>
      group.map((row) => row.id).join('\n') !==
      (originalGroups.get(name) ?? []).map((row) => row.id).join('\n'),
  ).length;
  useLayoutEffect(() => {
    dialog.current?.showModal();
    selector.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    let active = true;
    const suspend = () => {
      setReady(false);
      void window.dock
        .setShortcutRecording(true)
        .then(() => {
          if (active) setReady(true);
        })
        .catch((reason) => {
          if (active) setError(String(reason));
        });
    };
    suspend();
    window.addEventListener('focus', suspend);
    return () => {
      active = false;
      window.removeEventListener('focus', suspend);
      void window.dock.setShortcutRecording(false).catch(() => {});
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, []);
  const move = (from: string, to: string) => {
    setOrdered((value) => moveKeybindingWithinKey(value, from, to));
    const source = rows.find((row) => row.id === from);
    setNotice(
      `${catalog.get(source?.command ?? '')?.title ?? source?.command ?? '割り当て'}を${rows.findIndex((row) => row.id === to) + 1}番目に移動しました。`,
    );
    setError('');
  };
  return createPortal(
    <dialog
      ref={dialog}
      className="applet-shortcut-dialog shortcut-order-dialog"
      aria-labelledby={`${id}-title`}
      data-shortcut-recorder="true"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <header>
        <div>
          <small>アプリ全体の割り当て</small>
          <h2 id={`${id}-title`}>ショートカットの実行順</h2>
        </div>
        <button
          className="shortcut-dialog-close"
          aria-label="実行順の編集をキャンセル"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <label className="shortcut-order-key">
        キー
        <select
          ref={selector}
          aria-label="実行順を変更するキー"
          value={key}
          disabled={!groups.length}
          onChange={(event) => {
            setKey(event.target.value);
            dragged.current = null;
            setOver(null);
            setNotice('');
          }}
        >
          {!groups.length && <option value="">割り当てがありません</option>}
          {groups.map(([name, group]) => (
            <option key={name} value={name}>
              {name} · {group.length}件
            </option>
          ))}
        </select>
      </label>
      <p className="shortcut-order-help">
        条件に一致する割り当てを、上から順に実行します。無効・利用できないものは実行されません。
      </p>
      <ol className="shortcut-order-list" aria-label={`${key}の実行順`}>
        {rows.map((row, index) => {
          const command = catalog.get(row.command);
          const title = command?.title ?? row.command;
          return (
            <li
              key={row.id}
              data-order-binding={row.id}
              className={`shortcut-order-row${over === row.id ? ' drop-target' : ''}`}
              onDragOver={(event) => {
                if (dragged.current && dragged.current !== row.id) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setOver(row.id);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragged.current) move(dragged.current, row.id);
                dragged.current = null;
                setOver(null);
              }}
            >
              <button
                className="shortcut-order-handle"
                draggable
                aria-label={`${title}の順番をドラッグで変更`}
                title="ドラッグ、またはAlt＋↑↓で移動"
                onDragStart={(event) => {
                  dragged.current = row.id;
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', row.id);
                }}
                onDragEnd={() => {
                  dragged.current = null;
                  setOver(null);
                }}
                onKeyDown={(event) => {
                  if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
                    event.preventDefault();
                    const target = rows[index + (event.key === 'ArrowUp' ? -1 : 1)];
                    if (target) move(row.id, target.id);
                  }
                }}
              >
                ⠿
              </button>
              <span className="shortcut-order-number" aria-label={`${index + 1}番目`}>
                {index + 1}
              </span>
              <div className="shortcut-order-command">
                <strong>{title}</strong>
                <small>
                  {command?.extension ?? '未確認のコマンド'} ·{' '}
                  {keybindingConditionLabel(
                    row.when,
                    command?.extensionId ? command.extension : undefined,
                    applets,
                  )}
                </small>
                <small className="command-id">{row.command}</small>
                {(!row.enabled || !command?.available) && (
                  <small>{!row.enabled ? '無効' : '現在利用できません'}</small>
                )}
              </div>
              <div className="shortcut-order-moves">
                <button
                  aria-label={`${title}を上へ`}
                  disabled={index === 0}
                  onClick={() => move(row.id, rows[index - 1].id)}
                >
                  ↑
                </button>
                <button
                  aria-label={`${title}を下へ`}
                  disabled={index === rows.length - 1}
                  onClick={() => move(row.id, rows[index + 1].id)}
                >
                  ↓
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      {rows.length < 2 && (
        <p className="muted">
          {rows.length
            ? 'このキーの割り当ては1件です。並べ替える相手がありません。'
            : 'キーの割り当てを追加すると、ここで実行順を変更できます。'}
        </p>
      )}
      <p className="shortcut-order-help">
        同じコマンドが複数の条件に一致した場合は、最初の一致位置で1回だけ実行します。
      </p>
      <div className="shortcut-order-notice" role="status">
        {notice || 'ドラッグ・上下ボタンで並べ替えられます。'}
      </div>
      {error && (
        <p className="shortcut-dialog-error" role="alert">
          {error}
        </p>
      )}
      <footer>
        <small>{changed ? `${changed}キーの順序を変更` : '保存は「変更をすべて保存」から'}</small>
        <div>
          <button onClick={onClose}>キャンセル</button>
          <button
            className="primary"
            disabled={!changed || !ready}
            onClick={() => {
              try {
                onChange(
                  withKeybindings(
                    settings,
                    applyKeybindingOrder(getKeybindings(settings), original, ordered),
                  ),
                );
                onClose();
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : String(reason));
              }
            }}
          >
            適用
          </button>
        </div>
      </footer>
    </dialog>,
    document.body,
  );
}
