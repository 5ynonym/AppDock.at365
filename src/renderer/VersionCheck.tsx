import { useState } from 'react';
import type { UpdateResult } from '../shared/contracts';

export function VersionCheck({ id }: { id?: string }) {
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
      setError(err instanceof Error ? err.message : String(err));
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
            void window.dock.openReleases(id).catch((err: Error) => setError(err.message));
          }}
        >
          リリースを開く
        </button>
      )}
      {error && (
        <span className="error-text" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
