import type { ExtensionSnapshot } from './contracts';

export type AppletOperation = 'enable' | 'disable' | 'restart';
export const appletManagementId = (id: string, operation: AppletOperation) =>
  `appdock.applets.${id}.${operation}`;

/** Host-owned commands; Applets cannot grant themselves lifecycle privileges. */
export function appletManagementCommands(applets: ExtensionSnapshot[]) {
  return applets.flatMap((a) =>
    (['enable', 'disable', 'restart'] as const).map((operation) => ({
      id: appletManagementId(a.id, operation),
      title: `${a.displayName}を${{ enable: '有効にする', disable: '無効にする', restart: '再起動する' }[operation]}`,
      extension: 'AppDock',
      extensionId: null,
      appletId: a.id,
      operation,
      available:
        !['starting', 'stopping'].includes(a.state) && (operation !== 'restart' || a.enabled),
    })),
  );
}
