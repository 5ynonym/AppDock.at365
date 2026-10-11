import { randomUUID } from 'node:crypto';
import type { HostSnapshot } from '../../shared/contracts';
import type { ShellPageAction, ShellPageRequest } from '../../shared/shell-pages';
import type {
  SettingsPageAuxiliary,
  SettingsPageModel,
  SettingsPageRequest,
} from '../../shared/settings-page';
import type { SettingsPageDefinition } from '../../shared/settings-catalog';
import { settingsPageChanged } from '../../shared/settings-catalog';
import type { SettingsEditingSession } from './settings-editing-session';
import type { ShellPageController } from './shell-page-controller';

export class SettingsPageSession implements ShellPageController {
  readonly kind = 'settings';
  readonly requiresFlush = true;
  readonly id: string;
  readonly route: string;
  private revision = 0;
  private signature = '';
  private actionPage = '';
  private disposed = false;
  private error = '';
  private actions = new Map<string, { id: string; run: (args: unknown[]) => Promise<unknown> }>();
  private requests = new Map<string, Promise<unknown>>();
  constructor(
    private request: SettingsPageRequest,
    private options: {
      editor: SettingsEditingSession;
      host(): HostSnapshot;
      auxiliary(page: SettingsPageDefinition): SettingsPageAuxiliary;
      actions(page: SettingsPageDefinition): Record<string, (args: unknown[]) => Promise<unknown>>;
      changed(): void;
      release?(): void;
      resize?(width: number): void;
    },
  ) {
    if (
      !request ||
      request.kind !== 'settings' ||
      !['settings', 'extensions'].includes(request.route) ||
      !['full', 'applet'].includes(request.context) ||
      typeof request.id !== 'string' ||
      request.id.length > 100
    )
      throw Error('Invalid settings page request');
    this.id = request.id;
    this.route = request.route;
    if (request.pageId && request.pageId !== options.editor.snapshot().pageId) {
      const state = options.editor.snapshot();
      // The host's selected detail supplies the scope; a rejected transition keeps the original JSON.
      void options.editor
        .act({
          sessionId: state.sessionId,
          editRevision: state.editRevision,
          operationId: randomUUID(),
          action: { type: 'select-page', pageId: request.pageId },
        })
        .catch((error) => {
          this.error = String(error);
          options.changed();
        });
    }
  }
  snapshot(): SettingsPageModel {
    const state = this.options.editor.snapshot();
    const host = this.options.host();
    const page = this.options.editor.page();
    const previous =
      this.actionPage === page.id
        ? this.actions
        : new Map<string, { id: string; run: (args: unknown[]) => Promise<unknown> }>();
    this.actionPage = page.id;
    this.actions = new Map(
      Object.entries(this.options.actions(page)).map(([key, run]) => [
        key,
        { id: previous.get(key)?.id ?? randomUUID(), run },
      ]),
    );
    const content: SettingsPageModel['content'] = {
      context: this.request.context,
      sidebarWidth: this.request.sidebarWidth ?? 280,
      hostWidth: this.request.hostWidth ?? 1024,
      page,
      values: page.json ? this.options.editor.projection() : {},
      navigation:
        this.request.context === 'full'
          ? this.options.editor
              .catalog()
              .filter((p) => p.kind === 'host')
              .map((p) => ({
                id: p.id,
                title: p.title,
                owner: p.owner,
                dirty:
                  !!state.buffers[p.id] ||
                  settingsPageChanged(state.draft, host.settings.value, p, host.extensions),
              }))
          : [],
      query: '',
      results: [],
      editing: {
        sessionId: state.sessionId,
        editRevision: state.editRevision,
        dirty: state.dirty,
        pending: state.pending,
        conflict: state.dirty && state.revision !== host.settings.revision,
        error: this.error || state.parseError || state.saveError,
        mode: state.mode,
        text: state.mode === 'json' ? state.text : '',
        avatarChanged: state.avatarChanged,
        avatarLoading: state.avatarLoading,
      },
      actions: Object.fromEntries([...this.actions].map(([key, a]) => [key, a.id])),
      auxiliary: this.options.auxiliary(page),
    };
    const signature = JSON.stringify({ content, dark: host.dark });
    if (signature !== this.signature) {
      this.signature = signature;
      this.revision++;
    }
    return {
      schemaVersion: 1,
      id: this.id,
      contextId: 'primary',
      kind: 'settings',
      revision: this.revision,
      dark: host.dark,
      content,
    };
  }
  async act(action: ShellPageAction) {
    if (
      this.disposed ||
      action?.type !== 'settings' ||
      action.id !== this.id ||
      typeof action.operationId !== 'string' ||
      !action.operationId ||
      action.operationId.length > 100
    )
      throw Error('Stale settings page');
    const existing = this.requests.get(action.operationId);
    if (existing) return existing;
    const work = this.perform(action);
    this.requests.set(action.operationId, work);
    while (this.requests.size > 512) this.requests.delete(this.requests.keys().next().value!);
    return work;
  }
  private async perform(action: Extract<ShellPageAction, { type: 'settings' }>) {
    const state = this.options.editor.snapshot();
    if (action.sessionId !== state.sessionId || action.editRevision !== state.editRevision)
      throw Error('編集内容が別の画面で変わりました。再取得してください。');
    this.error = '';
    try {
      let result: unknown;
      const op = action.operation;
      if (op.kind === 'sidebar-width') {
        if (
          this.request.context !== 'full' ||
          !Number.isFinite(op.width) ||
          op.width < 220 ||
          op.width > 480
        )
          throw Error('一覧の幅が不正です。');
        this.request.sidebarWidth = Math.round(op.width);
        this.options.resize?.(this.request.sidebarWidth);
      } else if (op.kind === 'select') {
        if (this.request.context !== 'full')
          throw Error('この入口では設定ページを変更できません。');
        await this.options.editor.act({
          ...action,
          action: { type: 'select-page', pageId: op.pageId },
        });
        if (op.pageId !== state.pageId) this.options.release?.();
      } else if (op.kind === 'edit') {
        if (
          ![
            'mode',
            'page-values',
            'partial-text',
            'avatar',
            'avatar-loading',
            'save',
            'discard',
            'reload',
          ].includes(op.action.type)
        )
          throw Error('設定操作が不正です。');
        if (
          (op.action.type === 'avatar' ||
            (op.action.type === 'avatar-loading' && op.action.value)) &&
          state.pageId !== 'profile'
        )
          throw Error('画像はプロフィールで選択してください。');
        await this.options.editor.act({ ...action, action: op.action });
      } else if (op.kind === 'invoke') {
        // Rebuild against current page and availability before resolving the issued ID.
        this.snapshot();
        const issued = [...this.actions.values()].find((a) => a.id === op.actionId);
        if (
          !issued ||
          !Array.isArray(op.args ?? []) ||
          JSON.stringify(op.args ?? []).length > 1024 * 1024
        )
          throw Error('このページで許可されていない操作です。');
        result = await issued.run(op.args ?? []);
      } else throw Error('設定操作が不正です。');
      return { model: this.snapshot(), result };
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      this.options.changed();
    }
  }
  dispose() {
    this.disposed = true;
    this.actions.clear();
    this.options.release?.();
  }
  update(request: ShellPageRequest) {
    if (request.kind !== 'settings') return;
    if (
      Number.isFinite(request.sidebarWidth) &&
      request.sidebarWidth! >= 220 &&
      request.sidebarWidth! <= 480
    )
      this.request.sidebarWidth = request.sidebarWidth;
    if (
      Number.isFinite(request.hostWidth) &&
      request.hostWidth! >= 320 &&
      request.hostWidth! <= 10000
    )
      this.request.hostWidth = request.hostWidth;
  }
}
