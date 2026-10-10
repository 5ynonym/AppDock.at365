import { randomUUID } from 'node:crypto';
import type { Settings, SettingsSnapshot } from '../../shared/contracts';
import type { SettingsStore } from './settings';
import type { AutomationApplet, AutomationCommand } from './automation-commands';

export class AutomationError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const automationFields = {
  theme: {
    type: 'string',
    enum: ['dark', 'light', 'system'],
    description: '表示テーマ',
    applies: 'immediate',
  },
  notifications: { type: 'boolean', description: '通知を表示する', applies: 'immediate' },
  closeToTray: {
    type: 'boolean',
    description: '閉じるボタンでトレイに格納する',
    applies: 'nextClose',
  },
  startMinimized: { type: 'boolean', description: '起動時に最小化する', applies: 'nextStart' },
} as const;
const keys = Object.keys(automationFields) as (keyof typeof automationFields)[];
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export const automationMethods = [
  'system.getInfo',
  'applets.list',
  'settings.getSchema',
  'settings.get',
  'settings.patch',
  'applets.get',
  'commands.list',
  'commands.execute',
] as const;
export class AutomationApi {
  private epoch = randomUUID();
  private executing = false;
  constructor(
    private options: {
      settings: SettingsStore;
      save(value: Settings, revision: number): SettingsSnapshot;
      applets(): AutomationApplet[];
      commands(): AutomationCommand[];
      execute(id: string): Promise<unknown>;
      executable(): boolean;
      version: string;
      instanceId: string;
      writable(): boolean;
      ready(): boolean;
    },
  ) {}
  private revision() {
    return `${this.epoch}:${this.options.settings.revision}`;
  }
  private values() {
    const host = this.options.settings.value.host;
    return Object.fromEntries(keys.map((k) => [k, host[k]]));
  }
  auditTarget(method: string, params: unknown): string | undefined {
    if (!object(params)) return undefined;
    if (method === 'commands.execute')
      return this.options.commands().find((c) => c.id === params.id)?.id;
    if (method === 'applets.get') return this.options.applets().find((a) => a.id === params.id)?.id;
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
      !['settings.patch', 'applets.get', 'commands.execute'].includes(method) &&
      Object.keys(params).length
    )
      throw new AutomationError('INVALID_ARGUMENT', 'この操作には引数がありません。');
    switch (method) {
      case 'system.getInfo':
        return {
          apiVersion: 1,
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
          commands: this.options.commands().filter((c) => c.appletId === id),
          executable: this.options.executable(),
        };
      }
      case 'commands.list':
        return { commands: this.options.commands(), executable: this.options.executable() };
      case 'commands.execute':
        return this.execute(this.id(params));
      case 'settings.getSchema':
        return { fields: automationFields, scope: 'host', writable: this.options.writable() };
      case 'settings.get':
        return {
          values: this.values(),
          revision: this.revision(),
          warning: this.options.settings.syncError ?? null,
        };
      case 'settings.patch':
        return this.patch(params);
      default:
        throw new AutomationError('NOT_FOUND', '対応していない操作です。');
    }
  }
  private id(params: Record<string, unknown>): string {
    if (
      Object.keys(params).some((k) => k !== 'id') ||
      typeof params.id !== 'string' ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(params.id) ||
      params.id !== params.id.trim()
    )
      throw new AutomationError('INVALID_ARGUMENT', '正しいidだけを指定してください。');
    return params.id;
  }
  private async execute(id: string): Promise<Record<string, unknown>> {
    if (!this.options.executable())
      throw new AutomationError(
        'EXECUTION_DISABLED',
        'AppDockのCodex連携画面でコマンド実行を許可してください。',
      );
    // Rebuild the current catalog at execution time; do not trust a previously listed command.
    const command = this.options.commands().find((c) => c.id === id);
    if (!command)
      throw new AutomationError('NOT_FOUND', '外部に公開されているコマンドではありません。');
    if (!command.available)
      throw new AutomationError('UNAVAILABLE', 'このコマンドは現在利用できません。');
    if (this.executing) throw new AutomationError('BUSY', '別のAPIコマンドを実行中です。');
    this.executing = true;
    try {
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
    } catch {
      throw new AutomationError(
        'COMMAND_FAILED',
        '実行に失敗したか、完了を確認できません。再実行する前に操作先の状態を確認してください。',
      );
    } finally {
      this.executing = false;
    }
  }
  private patch(p: Record<string, unknown>) {
    if (
      Object.keys(p).some((k) => !['changes', 'expectedRevision', 'dryRun'].includes(k)) ||
      typeof p.expectedRevision !== 'string' ||
      !object(p.changes) ||
      !Object.keys(p.changes).length ||
      (p.dryRun !== undefined && typeof p.dryRun !== 'boolean')
    )
      throw new AutomationError(
        'INVALID_ARGUMENT',
        'changesとexpectedRevisionを指定してください。',
      );
    if (!this.options.writable())
      throw new AutomationError(
        'WRITE_DISABLED',
        'AppDockのCodex連携画面で設定変更を許可してください。',
      );
    const next = structuredClone(this.options.settings.value);
    for (const [key, value] of Object.entries(p.changes)) {
      if (
        !keys.includes(key as (typeof keys)[number]) ||
        (key === 'theme'
          ? !['dark', 'light', 'system'].includes(String(value)) || typeof value !== 'string'
          : typeof value !== 'boolean')
      )
        throw new AutomationError('INVALID_ARGUMENT', '公開された設定項目と値を確認してください。');
      Object.assign(next.host, { [key]: value });
    }
    const store = this.options.settings;
    if (p.expectedRevision !== this.revision())
      throw new AutomationError(
        'REVISION_CONFLICT',
        '設定を再取得して変更内容を確認してください。',
      );
    // Recheck disk, including edits not yet observed by the file watcher.
    try {
      store.assertRevision(store.revision);
    } catch {
      throw new AutomationError(
        'REVISION_CONFLICT',
        '設定ファイルが変更されたか、読み取れません。再取得してください。',
      );
    }
    if (p.expectedRevision !== this.revision())
      throw new AutomationError('REVISION_CONFLICT', '設定を再取得してください。');
    const changed = Object.keys(p.changes).filter(
      (k) =>
        next.host[k as keyof typeof next.host] !== store.value.host[k as keyof typeof next.host],
    );
    if (!p.dryRun && changed.length) {
      try {
        this.options.save(next, store.revision);
      } catch {
        throw new AutomationError(
          'SAVE_FAILED',
          '設定を保存できませんでした。AppDockのログを確認してください。',
        );
      }
    }
    return {
      dryRun: p.dryRun === true,
      changed,
      values: p.dryRun ? Object.fromEntries(keys.map((k) => [k, next.host[k]])) : this.values(),
      revision: this.revision(),
      applies: Object.fromEntries(
        changed.map((k) => [k, automationFields[k as (typeof keys)[number]].applies]),
      ),
      warning: store.syncError ?? null,
    };
  }
}
