import { useEffect, useState } from 'react';
import type { UpdateState } from '../shared/contracts';
import { Icon } from './Icon';

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
/** Completed results use the common notification service; the footer owns progress and cancel. */
export function UpdateProgress({ state }: { state: UpdateState }) {
  const [error, setError] = useState('');
  useEffect(() => {
    setError('');
  }, [state.busy]);
  if (!state.busy) return null;
  const progress = state.progress;
  const message = error || state.phase;
  return (
    <section className={`update-operation${error ? ' has-error' : ''}`} aria-label="更新の進捗">
      <Icon name="refresh" size={14} />
      <span className="update-operation-message" role={error ? 'alert' : 'status'} title={message}>
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
      <button
        className="text-button"
        disabled={!state.cancellable}
        onClick={() => void window.dock.cancelUpdates().catch((e) => setError(String(e)))}
      >
        キャンセル
      </button>
    </section>
  );
}
