import { Toggle } from './Toggle';
import {
  appletApiPermissionLabels,
  type AppletApiPermissions as Permissions,
} from '../shared/appdock-api';
export function AppletApiPermissions({
  grants,
  error,
  busy,
  run,
}: {
  grants: Permissions;
  error?: string;
  busy: boolean;
  run: (action: () => Promise<unknown>) => unknown;
}) {
  return (
    <section className="applet-api-permissions">
      <h3>Appletからの操作許可</h3>
      <p className="muted">
        すべてのAppletに共通の許可です。このPCだけに保存し、変更はすぐに反映します。Codex連携の許可とは別に管理します。設定の変更や各編集には、公開情報の取得とコマンド実行の許可も必要です。
      </p>
      {error && <p className="error-text">{error}</p>}
      {Object.entries(appletApiPermissionLabels).map(([key, label]) => (
        <div className="setting-row" key={key}>
          <strong>{label}</strong>
          <Toggle
            label={label}
            checked={grants[key as keyof Permissions] === true}
            disabled={busy || !!error}
            onChange={(value) => {
              const next = { ...grants, [key]: value };
              void run(() => window.dock.setAppletApiPermissions(next));
            }}
          />
        </div>
      ))}
    </section>
  );
}
