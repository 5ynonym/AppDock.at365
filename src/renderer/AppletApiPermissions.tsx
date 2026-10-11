import { Toggle } from './Toggle';
import {
  appletApiPermissionLabels,
  type AppletApiPermissions as Permissions,
} from '../shared/appdock-api';
import type { ExtensionSnapshot } from '../shared/contracts';
export function AppletApiPermissions({
  applet,
  grants,
  error,
  busy,
  run,
}: {
  applet: ExtensionSnapshot;
  grants: Permissions;
  error?: string;
  busy: boolean;
  run: (action: () => Promise<unknown>) => unknown;
}) {
  if (!applet.capabilities?.includes('appdock-api')) return null;
  return (
    <section className="applet-api-permissions">
      <h3>このAppletからのAppDock操作</h3>
      <p className="muted">
        このPCだけに保存し、変更はすぐに反映します。Codex連携の許可とは別に管理します。設定の変更や各編集には、公開情報の取得とコマンド実行の許可も必要です。
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
              void run(() => window.dock.setAppletApiPermissions(applet.id, next));
            }}
          />
        </div>
      ))}
    </section>
  );
}
