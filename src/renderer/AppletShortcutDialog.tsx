import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizeShortcut, shortcutFromEvent } from '../shared/commands';
import type { Keybinding } from '../shared/keybindings';
import { ShortcutConditionField } from './ShortcutFields';
import { Toggle } from './Toggle';

const specialGroups = [
  ['操作', ['Tab', 'Enter', 'Escape', 'Space', 'Backspace', 'Delete', 'Insert', 'Pause', 'Plus']],
  ['移動', ['Up', 'Down', 'Left', 'Right', 'Home', 'End', 'PageUp', 'PageDown']],
  ['ファンクション', Array.from({ length: 24 }, (_, i) => `F${i + 1}`)],
] as const;

export function AppletShortcutDialog({
  initial,
  title,
  ownerTitle,
  applets,
  adding,
  onApply,
  onClose,
}: {
  initial: Keybinding;
  title: string;
  ownerTitle?: string;
  applets: { id: string; title: string }[];
  adding: boolean;
  onApply(row: Keybinding): void;
  onClose(): void;
}) {
  const [value, setValue] = useState(() => structuredClone(initial));
  const [special, setSpecial] = useState(false);
  const [modifiers, setModifiers] = useState<string[]>(initial.key.split('+').slice(0, -1));
  const [error, setError] = useState('');
  const [recordingReady, setRecordingReady] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const recorder = useRef<HTMLButtonElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    dialog.current?.showModal();
    recorder.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    let active = true;
    const suspend = () => {
      setRecordingReady(false);
      void window.dock
        .setShortcutRecording(true)
        .then(() => {
          if (active) setRecordingReady(true);
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
    };
  }, []);
  const choose = (key: string) => {
    setValue({ ...value, key });
    setModifiers(key.split('+').slice(0, -1));
    setError('');
  };
  const valid = !!value.key && (value.when.scope !== 'applets' || !!value.when.appletIds.length);
  const apply = () => {
    if (!valid || !recordingReady) return;
    try {
      onApply({ ...value, key: normalizeShortcut(value.key) });
    } catch (reason) {
      setError(String(reason));
    }
  };
  return createPortal(
    <dialog
      ref={dialog}
      className="applet-shortcut-dialog"
      aria-labelledby={`${id}-title`}
      data-shortcut-recorder="true"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.nativeEvent.isComposing) {
          if (event.key === 'Escape') event.preventDefault();
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header>
        <div>
          <small>{adding ? '割り当てを追加' : '割り当てを編集'}</small>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <button className="shortcut-dialog-close" aria-label="編集をキャンセル" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="shortcut-capture-label">
        <span>ショートカットキー</span>
        <small>{recordingReady ? '押して入力' : '入力を準備中…'}</small>
      </div>
      <button
        ref={recorder}
        className="shortcut-capture"
        aria-label="ショートカットキーを入力"
        aria-describedby={`${id}-hint`}
        onKeyDown={(event) => {
          if (event.key === 'Escape' || (event.key === 'Tab' && !event.ctrlKey && !event.altKey))
            return;
          event.preventDefault();
          event.stopPropagation();
          if (!recordingReady || event.repeat || event.nativeEvent.isComposing) return;
          const key = shortcutFromEvent(event.nativeEvent);
          if (key) choose(key);
          else if (!['Control', 'Alt', 'Shift'].includes(event.key))
            setError('このキーは使用できません。特殊キーから選択することもできます。');
        }}
      >
        {value.key ? (
          value.key.split('+').map((part, index) => <kbd key={index}>{part}</kbd>)
        ) : (
          <span>キーの組み合わせを押してください</span>
        )}
      </button>
      <p className="shortcut-capture-hint" id={`${id}-hint`}>
        Tabで次の項目へ・Escでキャンセル。これらのキーは特殊キーから選べます。
      </p>
      <button
        className="shortcut-special-trigger"
        aria-expanded={special}
        aria-controls={`${id}-special`}
        onClick={() => setSpecial(!special)}
      >
        特殊キーから選ぶ <span aria-hidden="true">{special ? '−' : '＋'}</span>
      </button>
      {special && (
        <div className="shortcut-special-picker" id={`${id}-special`}>
          <div className="shortcut-modifiers" role="group" aria-label="特殊キーの修飾キー">
            {['Ctrl', 'Alt', 'Shift'].map((modifier) => (
              <button
                key={modifier}
                aria-pressed={modifiers.includes(modifier)}
                onClick={() =>
                  setModifiers(
                    modifiers.includes(modifier)
                      ? modifiers.filter((m) => m !== modifier)
                      : [...modifiers, modifier],
                  )
                }
              >
                {modifier}
              </button>
            ))}
            <small>組み合わせて選択</small>
          </div>
          {specialGroups.map(([name, keys]) => (
            <div className="shortcut-special-group" key={name}>
              <small>{name}</small>
              <div>
                {keys.map((key) => (
                  <button
                    key={key}
                    aria-pressed={value.key === normalizeShortcut([...modifiers, key].join('+'))}
                    onClick={() => {
                      choose(normalizeShortcut([...modifiers, key].join('+')));
                      setSpecial(false);
                      recorder.current?.focus({ preventScroll: true });
                    }}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="shortcut-dialog-condition">
        <span>いつ・どこで</span>
        <ShortcutConditionField
          value={value.when}
          label="割り当てのいつ・どこで"
          ownerTitle={ownerTitle}
          applets={applets}
          onChange={(when) => {
            if (when.scope !== 'default')
              setValue({ ...value, when: { scope: when.scope, appletIds: when.appletIds } });
          }}
        />
      </div>
      <div className="shortcut-dialog-enabled">
        <span>この割り当てを有効にする</span>
        <Toggle
          checked={value.enabled}
          label="この割り当てを有効にする"
          onChange={(enabled) => setValue({ ...value, enabled })}
        />
      </div>
      {error && (
        <p className="shortcut-dialog-error" role="alert">
          {error}
        </p>
      )}
      <footer>
        <small>適用後、画面上部から保存できます。</small>
        <div>
          <button onClick={onClose}>キャンセル</button>
          <button className="primary" disabled={!valid || !recordingReady} onClick={apply}>
            {adding ? '追加' : '適用'}
          </button>
        </div>
      </footer>
    </dialog>,
    document.body,
  );
}
