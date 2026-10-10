import { useEffect, useRef, useState } from 'react';
import type { UpdateState } from '../shared/contracts';
import { Icon } from './Icon';

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
export function UpdateProgress({
  state,
  visible,
  onDetails,
}: {
  state: UpdateState;
  visible: boolean;
  onDetails(): void;
}) {
  const [dismissed, setDismissed] = useState('');
  const [error, setError] = useState('');
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remaining = useRef(6000);
  const element = useRef<HTMLElement>(null);
  const notice =
    state.notice ??
    (state.completion
      ? {
          id: `completion:${state.completion.ok}:${state.completion.message}`,
          kind: state.completion.ok ? 'info' : 'error',
          message: state.completion.message,
        }
      : undefined);
  const id = notice?.id ?? '';
  useEffect(() => {
    setHovered(element.current?.matches(':hover') ?? false);
    setFocused(element.current?.contains(document.activeElement) ?? false);
  }, [id, state.busy, dismissed]);
  useEffect(() => {
    remaining.current = 6000;
  }, [id]);
  useEffect(() => {
    if (state.busy) setError('');
  }, [state.busy]);
  useEffect(() => {
    if (
      !id ||
      state.busy ||
      !visible ||
      hovered ||
      focused ||
      error ||
      notice?.kind === 'error' ||
      dismissed === id
    )
      return;
    const started = performance.now();
    const timer = window.setTimeout(() => setDismissed(id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (performance.now() - started));
    };
  }, [id, state.busy, visible, hovered, focused, error, notice?.kind, dismissed]);
  if (!state.busy && (!notice || dismissed === id)) return null;
  const message = error || (state.busy ? state.phase : notice?.message) || '';
  const failed = !!error || (!state.busy && notice?.kind === 'error');
  const progress = state.busy ? state.progress : undefined;
  return (
    <section
      ref={element}
      className={`update-operation${failed ? ' has-error' : ''}`}
      aria-label="更新のお知らせ"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <Icon name={state.busy ? 'refresh' : failed ? 'logs' : 'check'} size={14} />
      <span className="update-operation-message" role={failed ? 'alert' : 'status'} title={message}>
        {message}
      </span>
      {progress && (
        <>
          <progress
            aria-label={`${progress.name}の取得状況`}
            max={progress.totalBytes ?? 1}
            value={
              progress.totalBytes
                ? Math.min(progress.receivedBytes, progress.totalBytes)
                : undefined
            }
          />
          <small>
            {progress.index}/{progress.count} · {megabytes(progress.receivedBytes)}
            {progress.totalBytes ? ` / ${megabytes(progress.totalBytes)}` : ''}
          </small>
        </>
      )}
      {state.busy ? (
        <button
          className="text-button"
          disabled={!state.cancellable}
          onClick={() => void window.dock.cancelUpdates().catch((error) => setError(String(error)))}
        >
          キャンセル
        </button>
      ) : (
        <>
          <button
            className="text-button"
            onClick={() => {
              onDetails();
              setDismissed(id);
            }}
          >
            更新画面を開く
          </button>
          <button
            className="update-notice-close"
            aria-label="更新結果を閉じる"
            onClick={() => setDismissed(id)}
          >
            <Icon name="close" size={12} />
          </button>
        </>
      )}
    </section>
  );
}
