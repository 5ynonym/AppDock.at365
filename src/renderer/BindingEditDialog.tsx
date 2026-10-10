import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
export function BindingEditDialog({
  title,
  adding,
  valid,
  onApply,
  onClose,
  children,
  className = '',
}: {
  title: string;
  adding: boolean;
  valid: boolean;
  onApply(): void;
  onClose(): void;
  children(ready: boolean, setError: (error: string) => void): ReactNode;
  className?: string;
}) {
  const [error, setError] = useState('');
  const [recordingReady, setRecordingReady] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [returnFocus] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const id = useId();
  useLayoutEffect(() => {
    dialog.current?.showModal();
    dialog.current
      ?.querySelector<HTMLElement>('[data-initial-focus], .shortcut-capture')
      ?.focus({ preventScroll: true });
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
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, []);

  const apply = () => {
    if (!valid || !recordingReady) return;
    try {
      onApply();
    } catch (reason) {
      setError(String(reason));
    }
  };
  return createPortal(
    <dialog
      ref={dialog}
      className={`applet-shortcut-dialog ${className}`}
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
      {children(recordingReady, setError)}
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
