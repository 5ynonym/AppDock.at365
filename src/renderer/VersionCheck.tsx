import { useState } from 'react';
import type { UpdateResult } from '../shared/contracts';
const updateError = (error: unknown) => {
  const message = (error instanceof Error ? error.message : '').replace(
    /^Error invoking remote method '[^']+': (?:Error: )?/,
    '',
  );
  return /^(更新|正式版|リリース)/.test(message)
    ? message
    : '更新を確認できませんでした。通信環境を確認して、もう一度お試しください。';
};

export function VersionCheck({ id, details = false }: { id?: string; details?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UpdateResult>();
  const [error, setError] = useState('');
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
      <button className="text-button" disabled={busy} onClick={() => void check()}>
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
                : '更新確認先が設定されていません。'}
        </span>
      )}
      {result?.status === 'available' && (
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
