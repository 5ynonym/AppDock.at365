import type { ExtensionSnapshot } from '../../shared/contracts';
import { appletManagementCommands, type AppletOperation } from '../../shared/applet-management';
import type { SettingsStore } from './settings';

export class AppletManagementError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export class AppletManagement {
  private busy = new Set<string>();
  constructor(
    private options: {
      settings: SettingsStore;
      applets(): ExtensionSnapshot[];
      ready(): boolean;
      reconcile(): Promise<unknown>;
      restart(id: string): Promise<unknown>;
    },
  ) {}
  commands() {
    return appletManagementCommands(this.options.applets()).map((c) => ({
      ...c,
      available: c.available && !this.busy.has(c.appletId),
      unavailableReason:
        c.available && !this.busy.has(c.appletId) ? null : 'Appletが無効、または状態を変更中です。',
      completion: 'lifecycleApplied' as const,
      permission: 'applets.manage' as const,
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    }));
  }
  has(id: string) {
    return this.commands().some((c) => c.id === id);
  }
  execute(id: string) {
    const command = this.commands().find((c) => c.id === id);
    if (!command) throw new AppletManagementError('NOT_FOUND', 'Applet管理コマンドがありません。');
    return this.run(command.appletId, command.operation);
  }
  async run(id: string, operation: AppletOperation) {
    if (!this.options.ready())
      throw new AppletManagementError('NOT_READY', 'AppDockは起動中または終了中です。');
    if (!['enable', 'disable', 'restart'].includes(operation))
      throw new AppletManagementError('INVALID_ARGUMENT', '操作が不正です。');
    if (this.busy.has(id)) throw new AppletManagementError('BUSY', 'このAppletを操作中です。');
    const { settings } = this.options;
    try {
      settings.assertRevision(settings.revision);
    } catch {
      throw new AppletManagementError(
        'CONFLICT',
        '設定が変更されています。現在の設定を確認してから再実行してください。',
      );
    }
    const applet = this.options.applets().find((a) => a.id === id);
    if (!applet) throw new AppletManagementError('NOT_FOUND', 'Appletがありません。');
    if (['starting', 'stopping'].includes(applet.state))
      throw new AppletManagementError('BUSY', 'Appletの状態を変更中です。');
    if (operation === 'restart' && !applet.enabled)
      throw new AppletManagementError('UNAVAILABLE', '無効なAppletは再起動できません。');
    this.busy.add(id);
    try {
      const changed = operation !== 'restart' && applet.enabled !== (operation === 'enable');
      if (changed) {
        const next = structuredClone(settings.value);
        if (applet.runtime === 'web') {
          const item = next.webApplets.items.find((a) => a.id === id);
          if (!item) throw new AppletManagementError('NOT_FOUND', 'Appletがありません。');
          item.enabled = operation === 'enable';
        } else {
          next.extensions[id] = {
            ...(next.extensions[id] ?? { settings: {} }),
            enabled: operation === 'enable',
          };
        }
        settings.save(next, settings.revision);
        await this.options.reconcile();
      } else if (operation === 'restart') {
        await this.options.restart(id);
      }
      const current = this.options.applets().find((a) => a.id === id);
      if (!current || !['running', 'waiting', 'stopped'].includes(current.state))
        throw new AppletManagementError(
          'LIFECYCLE_FAILED',
          'Appletの起動または停止を確認できません。現在の状態とAppDockのログを確認してください。',
        );
      return {
        changed,
        applet: { id, enabled: current.enabled, state: current.state },
      };
    } finally {
      this.busy.delete(id);
    }
  }
}
