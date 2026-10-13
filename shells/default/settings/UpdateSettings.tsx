import { hostSettingItem } from '../../../src/shared/settings-catalog';
import { settingAnchor } from '../../../src/shared/settings-ui/setting-anchor';
import {
  SettingsInput,
  SettingsTextarea,
  numberInput,
} from '../../../src/shared/settings-ui/SettingsInput';
import { settingsControls } from '../../../src/shared/settings-ui/api';
import { useEffect, useState } from 'react';
import type { Settings, ExtensionSnapshot, UpdateState } from '../../../src/shared/contracts';
import { createDefaultSettings } from '../../../src/shared/settings-schema';
import { UpdateCheckTime } from '../../../src/shared/settings-ui/VersionCheck';

export function UpdateSettings({
  settings,
  edit: onChange,
  appletCount,
}: {
  settings: Settings;
  edit(next: Settings): void;
  appletCount: number;
}) {
  const edit = (change: (next: Settings) => void) => {
    const next = structuredClone(settings);
    change(next);
    onChange(next);
  };
  const [state, setState] = useState<UpdateState>({ busy: false, phase: '', results: [] });
  const [error, setError] = useState('');
  const checkedAt = state.results
    .map((result) => result.checkedAt)
    .sort()
    .at(-1);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void settingsControls.snapshot().then((snapshot) => {
        if (alive) setState(snapshot.updates);
      });
    };
    refresh();
    const unsubscribe = settingsControls.onChanged(refresh);
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
    <section
      {...settingAnchor('about', 'updateActions')}
      className="update-settings"
      aria-label="アップデート設定"
    >
      <div className="actions update-actions">
        <button
          className="update-primary"
          disabled={state.busy}
          onClick={() => action(() => settingsControls.installUpdates('all'))}
        >
          本体と全Appletを更新
        </button>
        <button
          className="text-button"
          disabled={state.busy || appletCount === 0}
          onClick={() => action(() => settingsControls.installUpdates('applets'))}
        >
          Appletを一括更新
        </button>
        <span className="update-check-control">
          <button
            className="text-button"
            disabled={state.busy}
            onClick={() => action(() => settingsControls.checkAllUpdates())}
          >
            すべての更新を確認
          </button>
          <UpdateCheckTime checkedAt={checkedAt} />
        </span>
      </div>
      <p className="muted">
        本体と全Appletの更新は、更新のある対象をまとめて準備し、最後に確認して1回の再起動で適用します。
      </p>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <details className="update-disclosure" {...settingAnchor('about', 'updates')}>
        <summary>{hostSettingItem('about', 'updates').title}</summary>
        <div className="update-settings-content">
          <label className="update-source" {...settingAnchor('about', 'hostSource')}>
            <span>{hostSettingItem('about', 'hostSource').title}</span>
            <SettingsInput
              aria-label="AppDockの更新元"
              value={settings.updates.hostSource}
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
            disabled={settings.updates.hostSource === createDefaultSettings().updates.hostSource}
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
                'checkHostOnStartup',
                'checkAppletsOnStartup',
                'notifyOnStartup',
                'allowSameVersion',
              ] as const
            ).map((key) => (
              <label key={key} {...settingAnchor('about', key)}>
                <SettingsInput
                  type="checkbox"
                  checked={settings.updates[key]}
                  onChange={(event) =>
                    edit((next) => {
                      next.updates[key] = event.target.checked;
                    })
                  }
                />
                {hostSettingItem('about', key).title}
              </label>
            ))}
            <label {...settingAnchor('about', 'startupDelaySeconds')}>
              {hostSettingItem('about', 'startupDelaySeconds').title}
              <SettingsInput
                aria-label="起動から確認までの秒数"
                type="number"
                min={0}
                max={3600}
                value={settings.updates.startupDelaySeconds}
                onChange={(event) =>
                  edit((next) => {
                    next.updates.startupDelaySeconds = numberInput(event.target.value);
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
  settings,
  edit,
}: {
  extension: ExtensionSnapshot;
  settings: Settings;
  edit(next: Settings): void;
}) {
  const source = settings.extensions[extension.id]?.updateSource;
  const defaultSource = extension.updateRepository ? `github:${extension.updateRepository}` : '';
  const change = (value: string | undefined) => {
    const next = structuredClone(settings);
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
          <SettingsInput
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
