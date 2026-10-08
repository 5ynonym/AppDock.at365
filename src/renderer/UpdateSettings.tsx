import { useEffect, useState } from 'react';
import type { Settings, ExtensionSnapshot, UpdateState } from '../shared/contracts';
import { createDefaultSettings } from '../shared/settings-schema';

export function UpdateSettings({
  draft,
  edit: onChange,
  appletCount,
  dirty,
}: {
  draft: Settings;
  edit(next: Settings): void;
  appletCount: number;
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
      <div className="actions update-actions">
        <button
          className="update-primary"
          disabled={state.busy || dirty || appletCount === 0}
          title={dirty ? '未保存の設定を保存または破棄してください。' : undefined}
          onClick={() => action(() => window.dock.installUpdates('applets'))}
        >
          Appletを一括更新
        </button>
        <button
          className="text-button"
          disabled={state.busy || dirty}
          onClick={() => action(() => window.dock.checkAllUpdates())}
        >
          すべての更新を確認
        </button>
      </div>
      <p className="muted">更新ボタンで最新版を確認・準備し、最後に対象を確認して再起動します。</p>
      {dirty && <p role="status">更新前に未保存の設定を保存または破棄してください。</p>}
      {state.phase && (
        <p role="status" className="update-feedback">
          {state.phase}
        </p>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <details className="update-disclosure">
        <summary>更新の設定</summary>
        <div className="update-settings-content">
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
          <button
            className="text-button"
            disabled={draft.updates.hostSource === createDefaultSettings().updates.hostSource}
            onClick={() =>
              edit((next) => {
                next.updates.hostSource = createDefaultSettings().updates.hostSource;
              })
            }
          >
            AppDockの更新元を既定に戻す
          </button>
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
        </div>
      </details>
    </section>
  );
}

export function AppletUpdateSource({
  extension,
  draft,
  edit,
}: {
  extension: ExtensionSnapshot;
  draft: Settings;
  edit(next: Settings): void;
}) {
  const source = draft.extensions[extension.id]?.updateSource;
  const defaultSource = extension.updateRepository ? `github:${extension.updateRepository}` : '';
  const change = (value: string | undefined) => {
    const next = structuredClone(draft);
    const entry = next.extensions[extension.id] ?? { enabled: extension.enabled, settings: {} };
    if (value === undefined) delete entry.updateSource;
    else entry.updateSource = value;
    next.extensions[extension.id] = entry;
    edit(next);
  };
  return (
    <details className="update-disclosure applet-update-source">
      <summary>
        更新元の設定{' '}
        <span className="muted">
          {source === undefined ? '既定' : source === '' ? '無効' : 'カスタム'}
        </span>
      </summary>
      <div className="update-settings-content">
        <label className="update-source">
          <span>{extension.displayName}の更新元</span>
          <input
            aria-label={`${extension.displayName}の更新元`}
            value={source ?? defaultSource}
            placeholder="publishフォルダー / URL / github:owner/repo"
            onChange={(event) => change(event.target.value)}
          />
        </label>
        <p className="muted">
          {defaultSource ? `既定: ${defaultSource}` : 'このAppletには既定の更新元がありません。'}{' '}
          空欄を保存すると更新確認を無効にします。
        </p>
        <button
          className="text-button"
          disabled={source === undefined}
          onClick={() => change(undefined)}
        >
          既定に戻す
        </button>
      </div>
    </details>
  );
}
