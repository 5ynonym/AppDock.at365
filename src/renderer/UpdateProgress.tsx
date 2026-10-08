import { useEffect, useState } from 'react';
import type { UpdateState } from '../shared/contracts';

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
export function UpdateProgress({ state }: { state: UpdateState }) {
  const [dismissed, setDismissed] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (state.busy) {
      setDismissed('');
      setError('');
    }
  }, [state.busy]);
  if (!state.busy && (state.completion?.ok || !state.phase || dismissed === state.phase))
    return null;
  const progress = state.progress;
  return (
    <section className="update-operation" aria-label="更新の進行状況">
      <div className="update-operation-body">
        <p role="status">{state.phase}</p>
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
              {progress.index} / {progress.count} 件 · {megabytes(progress.receivedBytes)}
              {progress.totalBytes
                ? ` / ${megabytes(progress.totalBytes)} (${Math.min(100, Math.floor((progress.receivedBytes / progress.totalBytes) * 100))}%)`
                : ' 取得済み'}
            </small>
          </>
        )}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
      </div>
      {state.busy ? (
        <button
          className="secondary"
          disabled={!state.cancellable}
          onClick={() => void window.dock.cancelUpdates().catch((error) => setError(String(error)))}
        >
          キャンセル
        </button>
      ) : (
        <button
          className="text-button"
          aria-label="更新結果を閉じる"
          onClick={() => setDismissed(state.phase)}
        >
          閉じる
        </button>
      )}
    </section>
  );
}
