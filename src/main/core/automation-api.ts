import type { Settings, SettingsSnapshot } from '../../shared/contracts';
import type { SettingsStore } from './settings';
import type { AutomationApplet, AutomationCommand } from './automation-commands';
import { SettingsCommands, SettingsCommandError } from './settings-commands';
import { AppletManagement, AppletManagementError } from './applet-management';
import { RibbonCommands } from './ribbon-commands';
import { GestureCommands } from './gesture-commands';
import { ShortcutCommands } from './shortcut-commands';
import type { GlobalHotKeyStatus, ExtensionSnapshot } from '../../shared/contracts';

export class AutomationError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export const automationMethods = [
  'system.getInfo',
  'applets.list',
  'settings.getSchema',
  'settings.get',
  'applets.get',
  'commands.list',
  'commands.execute',
  'shortcuts.get',
  'gestures.get',
  'ribbon.get',
] as const;
export class AutomationApi {
  private executing = false;
  private settingsCommands: SettingsCommands;
  private shortcuts: ShortcutCommands;
  private gestures: GestureCommands;
  private ribbon: RibbonCommands;
  constructor(
    private options: {
      settings: SettingsStore;
      save(value: Settings, revision: number): SettingsSnapshot;
      settingsCommands?: SettingsCommands;
      appletManagement?: AppletManagement;
      manageable?(): boolean;
      shortcutsEditable?(): boolean;
      gesturesEditable?(): boolean;
      ribbonEditable?(): boolean;
      ribbonApplets?(): ExtensionSnapshot[];
      shortcutStatus?(): GlobalHotKeyStatus[];
      applets(): AutomationApplet[];
      commands(): AutomationCommand[];
      execute(id: string): Promise<unknown>;
      executable(): boolean;
      version: string;
      instanceId: string;
      writable(): boolean;
      ready(): boolean;
    },
  ) {
    this.settingsCommands =
      options.settingsCommands ?? new SettingsCommands({ ...options, applets: () => [] });
    this.ribbon = new RibbonCommands({ ...options, settingsCommands: this.settingsCommands });
    this.gestures = new GestureCommands({
      ...options,
      settingsCommands: this.settingsCommands,
      commands: () => this.commands(),
    });
    this.shortcuts = new ShortcutCommands({
      ...options,
      settingsCommands: this.settingsCommands,
      commands: () => this.commands(),
      status: options.shortcutStatus,
    });
  }
  private commands() {
    return [
      ...new Map(
        [
          ...this.options.commands(),
          ...this.settingsCommands.commands(),
          ...(this.options.appletManagement?.commands() ?? []),
          ...this.shortcuts.commands(),
          ...this.gestures.commands(),
          ...this.ribbon.commands(),
        ].map((c) => [
          c.id,
          {
            ...c,
            inputSchema: c.inputSchema ?? {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
          },
        ]),
      ).values(),
    ];
  }
  auditTarget(method: string, params: unknown): string | undefined {
    if (!object(params)) return undefined;
    if (method === 'commands.execute') return this.commands().find((c) => c.id === params.id)?.id;
    if (method === 'applets.get') return this.options.applets().find((a) => a.id === params.id)?.id;
    if (method === 'settings.get' || method === 'settings.getSchema')
      return this.options.applets().find((a) => a.id === params.appletId)?.id;
    return undefined;
  }
  call(
    method: string,
    params: unknown = {},
  ): Record<string, unknown> | Promise<Record<string, unknown>> {
    if (!this.options.ready())
      throw new AutomationError('NOT_READY', 'AppDockは起動中または終了中です。');
    if (!object(params)) throw new AutomationError('INVALID_ARGUMENT', '引数はオブジェクトです。');
    if (
      !['settings.get', 'settings.getSchema', 'applets.get', 'commands.execute'].includes(method) &&
      Object.keys(params).length
    )
      throw new AutomationError('INVALID_ARGUMENT', 'この操作には引数がありません。');
    switch (method) {
      case 'system.getInfo':
        return {
          apiVersion: 2,
          ribbonEditingAllowed: this.options.ribbonEditable?.() ?? false,
          appletManagementAllowed: this.options.manageable?.() ?? false,
          gestureEditingAllowed: this.options.gesturesEditable?.() ?? false,
          shortcutEditingAllowed: this.options.shortcutsEditable?.() ?? false,
          version: this.options.version,
          instanceId: this.options.instanceId,
          methods: automationMethods,
          writable: this.options.writable(),
          executable: this.options.executable(),
        };
      case 'applets.list':
        return {
          applets: this.options.applets().map(({ id, name, version, state, enabled }) => ({
            id,
            name,
            version,
            state,
            enabled,
          })),
        };
      case 'applets.get': {
        const id = this.id(params);
        const applet = this.options.applets().find((a) => a.id === id);
        if (!applet) throw new AutomationError('NOT_FOUND', 'Appletが見つかりません。');
        return {
          applet,
          commands: this.commands().filter((c) => c.appletId === id),
          executable: this.options.executable(),
        };
      }
      case 'commands.list':
        return {
          ribbonEditingAllowed: this.options.ribbonEditable?.() ?? false,
          gestureEditingAllowed: this.options.gesturesEditable?.() ?? false,
          shortcutEditingAllowed: this.options.shortcutsEditable?.() ?? false,
          appletManagementAllowed: this.options.manageable?.() ?? false,
          commands: this.commands(),
          executable: this.options.executable(),
          writable: this.options.writable(),
        };
      case 'commands.execute':
        return this.execute(this.id(params, true), params.args === undefined ? {} : params.args);
      case 'ribbon.get':
        return {
          ...this.ribbon.get(),
          writable: this.options.writable(),
          executable: this.options.executable(),
          ribbonEditingAllowed: this.options.ribbonEditable?.() ?? false,
        };
      case 'gestures.get':
        return {
          ...this.gestures.get(),
          writable: this.options.writable(),
          executable: this.options.executable(),
          gestureEditingAllowed: this.options.gesturesEditable?.() ?? false,
        };
      case 'shortcuts.get':
        return {
          ...this.shortcuts.get(),
          writable: this.options.writable(),
          executable: this.options.executable(),
          gestureEditingAllowed: this.options.gesturesEditable?.() ?? false,
          shortcutEditingAllowed: this.options.shortcutsEditable?.() ?? false,
        };
      case 'settings.getSchema':
      case 'settings.get': {
        if (
          Object.keys(params).some((k) => k !== 'appletId') ||
          (params.appletId !== undefined &&
            (typeof params.appletId !== 'string' ||
              !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(params.appletId) ||
              params.appletId === 'appdock'))
        )
          throw new AutomationError(
            'INVALID_ARGUMENT',
            'Appletの設定はappletIdだけを指定してください。',
          );
        try {
          return method === 'settings.get'
            ? this.settingsCommands.get(params.appletId as string | undefined)
            : {
                ...this.settingsCommands.schema(params.appletId as string | undefined),
                writable: this.options.writable(),
              };
        } catch (error) {
          if (error instanceof SettingsCommandError)
            throw new AutomationError(error.code, error.message);
          throw error;
        }
      }
      default:
        throw new AutomationError('NOT_FOUND', '対応していない操作です。');
    }
  }
  private id(params: Record<string, unknown>, argumentsAllowed = false): string {
    if (
      Object.keys(params).some((k) => k !== 'id' && !(argumentsAllowed && k === 'args')) ||
      typeof params.id !== 'string' ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(params.id)
    )
      throw new AutomationError(
        'INVALID_ARGUMENT',
        '正しいidと対応する引数だけを指定してください。',
      );
    return params.id;
  }
  private async execute(id: string, args: unknown): Promise<Record<string, unknown>> {
    if (!this.options.executable())
      throw new AutomationError(
        'EXECUTION_DISABLED',
        'AppDockのCodex連携画面でコマンド実行を許可してください。',
      );
    const command = this.commands().find((c) => c.id === id);
    if (!command)
      throw new AutomationError('NOT_FOUND', '外部に公開されているコマンドではありません。');
    if (!command.available)
      throw new AutomationError('UNAVAILABLE', 'このコマンドは現在利用できません。');
    if (
      !object(args) ||
      (!['settings.write', 'shortcuts.write', 'gestures.write', 'ribbon.write'].includes(
        command.permission ?? '',
      ) &&
        Object.keys(args).length)
    )
      throw new AutomationError(
        'INVALID_ARGUMENT',
        'コマンドのinputSchemaに合うargsを指定してください。',
      );
    if (
      ['settings.write', 'shortcuts.write', 'gestures.write', 'ribbon.write'].includes(
        command.permission ?? '',
      ) &&
      !this.options.writable()
    )
      throw new AutomationError(
        'WRITE_DISABLED',
        'AppDockのCodex連携画面で設定変更を許可してください。',
      );
    if (this.executing) throw new AutomationError('BUSY', '別のAPIコマンドを実行中です。');
    if (command.permission === 'ribbon.write' && !this.options.ribbonEditable?.())
      throw new AutomationError(
        'RIBBON_EDITING_DISABLED',
        'AppDockのCodex連携画面でリボン編集を許可してください。',
      );
    if (command.permission === 'gestures.write' && !this.options.gesturesEditable?.())
      throw new AutomationError(
        'GESTURE_EDITING_DISABLED',
        'AppDockのCodex連携画面でジェスチャー編集を許可してください。',
      );
    if (command.permission === 'shortcuts.write' && !this.options.shortcutsEditable?.())
      throw new AutomationError(
        'SHORTCUT_EDITING_DISABLED',
        'AppDockのCodex連携画面でショートカット編集を許可してください。',
      );
    if (command.permission === 'applets.manage' && !this.options.manageable?.())
      throw new AutomationError(
        'APPLET_MANAGEMENT_DISABLED',
        'AppDockのCodex連携画面でApplet管理を許可してください。',
      );
    this.executing = true;
    try {
      if (command.permission === 'ribbon.write') {
        const result = this.ribbon.execute(args);
        return {
          id,
          completion: result.dryRun ? 'validated' : 'settingsSaved',
          effectVerified: false,
          ...result,
        };
      }
      if (command.permission === 'shortcuts.write' || command.permission === 'gestures.write') {
        const result = (
          command.permission === 'shortcuts.write' ? this.shortcuts : this.gestures
        ).execute(args);
        return {
          id,
          completion: result.dryRun ? 'validated' : 'settingsSaved',
          effectVerified: false,
          ...result,
        };
      }
      if (command.permission === 'applets.manage') {
        if (!this.options.appletManagement)
          throw new AppletManagementError('NOT_FOUND', 'Applet管理を利用できません。');
        const result = await this.options.appletManagement.execute(id);
        return { id, completion: 'lifecycleApplied', effectVerified: false, ...result };
      }
      if (command.permission === 'settings.write') {
        const result = this.settingsCommands.execute(id, args);
        return {
          id,
          completion: result.dryRun ? 'validated' : 'settingsSaved',
          effectVerified: false,
          ...result,
        };
      }
      await this.options.execute(id);
      return {
        id,
        completion: command.completion,
        effectVerified: false,
        message:
          command.completion === 'accepted'
            ? '表示要求を受け付けました。表示の完了は未確認です。'
            : 'コマンド処理から応答が返りました。操作先での効果は未確認です。',
      };
    } catch (error) {
      if (error instanceof SettingsCommandError || error instanceof AppletManagementError)
        throw new AutomationError(error.code, error.message);
      throw new AutomationError(
        'COMMAND_FAILED',
        '実行に失敗したか、完了を確認できません。再実行する前に操作先の状態を確認してください。',
      );
    } finally {
      this.executing = false;
    }
  }
}
