import { useEffect, useState } from 'react';
import type { UpdateResult } from '../shared/contracts';
const updateError = (error: unknown) => {
  const message = (error instanceof Error ? error.message : '').replace(
    /^Error invoking remote method '[^']+': (?:Error: )?/,
    '',
  );
  return message || '更新を確認できませんでした。通信環境を確認して、もう一度お試しください。';
};

export function VersionCheck({
  id,
  details = false,
  disabled = false,
  compact = false,
}: {
  id?: string;
  details?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UpdateResult>();
  const [error, setError] = useState('');
  const [sharedBusy, setSharedBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void window.dock.snapshot().then((snapshot) => {
        if (!alive) return;
        setSharedBusy(snapshot.updates.busy);
        setResult(snapshot.updates.results.find((result) => result.id === (id ?? 'host')));
      });
    };
    refresh();
    const unsubscribe = window.dock.onChanged(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [id]);
  const check = async () => {
    setBusy(true);
    setError('');
    setResult(undefined);
    try {
      setResult(await window.dock.checkUpdates(id));
    } catch (err) {
      setError(updateError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="version-check">
      <button
        className={compact ? 'text-button' : 'update-primary'}
        disabled={busy || sharedBusy || disabled}
        title={disabled ? '未保存の設定を保存または破棄してから更新してください。' : undefined}
        onClick={() => {
          setError('');
          setBusy(true);
          void window.dock
            .installUpdates(id ?? 'host')
            .catch((error) => setError(updateError(error)))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? '処理中…' : id ? 'このAppletを更新' : 'AppDockを更新'}
      </button>
      <button
        className="text-button"
        disabled={busy || sharedBusy || disabled}
        onClick={() => void check()}
      >
        {busy ? '更新を確認中…' : '更新を確認'}
      </button>
      {result && (
        <span role="status">
          {result.status === 'available'
            ? `${result.latestVersion} が公開されています。`
            : result.status === 'current'
              ? '最新版です。'
              : result.status === 'unpublished'
                ? '公開リリースが見つかりません。'
                : result.status === 'unsupported'
                  ? '更新元が設定されていません。'
                  : result.message}
        </span>
      )}
      {result?.status === 'available' && result.releaseUrl && (
        <button
          className="text-button"
          onClick={() => {
            void window.dock.openReleases(id).catch((err: Error) => setError(updateError(err)));
          }}
        >
          リリースを開く
        </button>
      )}
      {details && result && (
        <time dateTime={result.checkedAt} className="muted">
          最終確認:{' '}
          {new Intl.DateTimeFormat('ja-JP', { dateStyle: 'short', timeStyle: 'short' }).format(
            new Date(result.checkedAt),
          )}
        </time>
      )}
      {error && (
        <span className="error-text" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
