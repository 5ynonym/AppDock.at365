import { useEffect, useState } from 'react';
import type { Settings, ExtensionSnapshot, UpdateState } from '../shared/contracts';

export function UpdateSettings({
  draft,
  edit: onChange,
  extensions,
  dirty,
}: {
  draft: Settings;
  edit(next: Settings): void;
  extensions: ExtensionSnapshot[];
  dirty: boolean;
}) {
  const edit = (change: (next: Settings) => void) => {
    const next = structuredClone(draft);
    change(next);
    onChange(next);
  };
  const [state, setState] = useState<UpdateState>({ busy: false, phase: '', results: [] });
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void window.dock.snapshot().then((snapshot) => {
        if (alive) setState(snapshot.updates);
      });
    };
    refresh();
    const unsubscribe = window.dock.onChanged(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  const action = (callback: () => Promise<UpdateState>) => {
    setError('');
    void callback()
      .then(setState)
      .catch((error) => setError(String(error).replace(/^Error: /, '')));
  };
  return (
    <section className="update-settings" aria-label="アップデート設定">
      <h3>アップデート設定</h3>
      <p className="muted">
        更新元は保存した設定を使用します。更新するとAppDockとすべてのAppletを終了して再起動します。
      </p>
      {dirty && <p role="status">更新前に未保存の設定を保存または破棄してください。</p>}
      <label className="update-source">
        <span>AppDockの更新元</span>
        <input
          aria-label="AppDockの更新元"
          value={draft.updates.hostSource}
          onChange={(event) =>
            edit((next) => {
              next.updates.hostSource = event.target.value;
            })
          }
          placeholder="publishフォルダー / URL / github:owner/repo"
        />
      </label>
      <p className="muted">
        ローカルの絶対パス・UNC・更新情報JSONのHTTP(S)
        URL・GitHubリポジトリURLに対応します。空欄で更新確認を無効にします。
      </p>
      <div className="update-options">
        {(
          [
            ['checkHostOnStartup', '起動時にAppDockの更新を確認'],
            ['checkAppletsOnStartup', '起動時にAppletの更新を確認'],
            ['notifyOnStartup', '起動時に更新が見つかったら通知'],
            ['allowSameVersion', '同じバージョンの再適用を許可（開発用）'],
          ] as const
        ).map(([key, title]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={draft.updates[key]}
              onChange={(event) =>
                edit((next) => {
                  next.updates[key] = event.target.checked;
                })
              }
            />
            {title}
          </label>
        ))}
        <label>
          起動から確認までの秒数
          <input
            aria-label="起動から確認までの秒数"
            type="number"
            min={0}
            max={3600}
            value={draft.updates.startupDelaySeconds}
            onChange={(event) =>
              edit((next) => {
                next.updates.startupDelaySeconds = Number(event.target.value);
              })
            }
          />
        </label>
      </div>
      <p className="muted">
        起動時は更新情報の確認だけを行います。配布ファイルのダウンロードや適用は行いません。同じ版の再適用を許可しても古い版には戻しません。
      </p>
      <div className="actions">
        <button
          className="secondary"
          disabled={state.busy}
          onClick={() => action(() => window.dock.checkAllUpdates())}
        >
          すべての更新を確認
        </button>
        <button
          className="secondary"
          disabled={state.busy || dirty}
          onClick={() => action(() => window.dock.installUpdates('applets'))}
        >
          Appletを一括更新
        </button>
      </div>
      {state.phase && <p role="status">{state.phase}</p>}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <h3>Appletごとの更新元</h3>
      {extensions.map((extension) => (
        <label className="update-source" key={extension.id}>
          <span>{extension.displayName}</span>
          <input
            aria-label={`${extension.displayName}の更新元`}
            value={draft.extensions[extension.id]?.updateSource ?? ''}
            placeholder={
              extension.updateRepository
                ? `既定: github:${extension.updateRepository}`
                : '更新元を指定'
            }
            onChange={(event) =>
              edit((next) => {
                const current = next.extensions[extension.id] ?? { enabled: false, settings: {} };
                next.extensions[extension.id] = { ...current, updateSource: event.target.value };
              })
            }
          />
          <span className="muted">
            {draft.extensions[extension.id]?.updateSource === undefined
              ? 'Appletの既定の更新元を使用'
              : draft.extensions[extension.id]?.updateSource === ''
                ? '更新確認を無効'
                : '指定した更新元を使用'}
          </span>
          <button
            className="text-button"
            onClick={() =>
              edit((next) => {
                if (next.extensions[extension.id])
                  delete next.extensions[extension.id].updateSource;
              })
            }
          >
            既定に戻す
          </button>
        </label>
      ))}
    </section>
  );
}
