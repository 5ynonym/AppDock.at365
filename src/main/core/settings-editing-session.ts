import { randomUUID } from 'node:crypto';
import type { ExtensionSnapshot, Settings, SettingsSnapshot } from '../../shared/contracts';
import type { SettingsEditRequest, SettingsEditingState } from '../../shared/settings-editing';
import { parseSettings } from '../../shared/settings-schema';
import { validateAppletSettings } from '../../shared/setting-definitions';
import {
  settingsCatalog,
  settingsProjection,
  applySettingsJson,
} from '../../shared/settings-catalog';

/** Accepted edits outlive all renderer and Shell views. Persistence stays in SettingsStore. */
export class SettingsEditingSession {
  private state: SettingsEditingState;
  private avatar?: Uint8Array | null;
  private avatarName?: string;
  private operations = new Map<string, Promise<SettingsEditingState>>();
  private formErrors = new Map<string, string>();
  constructor(
    private options: {
      current(): SettingsSnapshot;
      applets(): ExtensionSnapshot[];
      save(
        value: Settings,
        revision: number,
        avatar?: Uint8Array | null,
        name?: string,
      ): Promise<SettingsSnapshot>;
      confirmDiscard(): Promise<boolean>;
      changed(): void;
    },
  ) {
    const saved = options.current();
    this.state = {
      sessionId: randomUUID(),
      editRevision: 0,
      revision: saved.revision,
      draft: structuredClone(saved.value),
      text: '',
      mode: 'form',
      dirty: false,
      parseError: '',
      saveError: '',
      pending: false,
      avatarLoading: false,
      avatarChanged: false,
      pageId: 'appearance',
      buffers: {},
    };
  }
  snapshot() {
    this.synchronize();
    return structuredClone(this.state);
  }
  get draft() {
    this.synchronize();
    return structuredClone(this.state.draft);
  }
  catalog() {
    return settingsCatalog(this.options.applets(), this.draft);
  }
  page(id = this.state.pageId) {
    const page = this.catalog().find((p) => p.id === id);
    if (!page) throw Error('設定対象が見つかりません。');
    return page;
  }
  projection(id = this.state.pageId) {
    return this.state.buffers[id]
      ? (JSON.parse(this.state.buffers[id]) as Record<string, unknown>)
      : settingsProjection(this.draft, this.page(id), this.options.applets());
  }
  avatarData() {
    return this.avatar ? new Uint8Array(this.avatar) : null;
  }
  private notify() {
    this.state.editRevision++;
    this.options.changed();
  }
  synchronize() {
    const saved = this.options.current();
    if (!this.state.dirty && !this.state.pending && this.state.revision !== saved.revision) {
      this.reset();
    }
  }
  private reset() {
    const saved = this.options.current();
    Object.assign(this.state, {
      draft: structuredClone(saved.value),
      revision: saved.revision,
      text: '',
      dirty: false,
      parseError: '',
      saveError: '',
      avatarLoading: false,
      avatarChanged: false,
      avatarPreview: undefined,
      buffers: {},
    });
    this.avatar = undefined;
    this.avatarName = undefined;
    this.formErrors.clear();
    if (this.state.mode === 'json') {
      try {
        this.state.text = JSON.stringify(this.projection(), null, 2);
      } catch {
        this.state.mode = 'form';
        this.state.text = '';
      }
    }
    this.notify();
  }
  async act(request: SettingsEditRequest): Promise<SettingsEditingState> {
    if (
      !request ||
      request.sessionId !== this.state.sessionId ||
      typeof request.operationId !== 'string' ||
      !request.operationId ||
      request.operationId.length > 100
    )
      throw Error('編集セッションが古くなっています。再取得してください。');
    const existing = this.operations.get(request.operationId);
    if (existing) return existing;
    this.synchronize();
    if (request.editRevision !== this.state.editRevision)
      throw Error('編集内容が別の画面で変わりました。入力を確認してください。');
    if (this.state.pending) throw Error('設定操作の完了を待ってください。');
    const result = this.perform(request.action);
    this.operations.set(request.operationId, result);
    while (this.operations.size > 512) this.operations.delete(this.operations.keys().next().value!);
    return result;
  }
  private async perform(action: SettingsEditRequest['action']) {
    switch (action.type) {
      case 'select-page':
        this.page(action.pageId);
        if (
          this.state.mode === 'json' &&
          this.state.parseError &&
          action.pageId !== this.state.pageId
        )
          throw Error('JSONの内容を修正してから移動してください。');
        if (action.pageId !== this.state.pageId) {
          this.state.pageId = action.pageId;
          this.state.mode = 'form';
        }
        break;
      case 'page-values': {
        if (action.pageId !== this.state.pageId || this.state.mode !== 'form')
          throw Error('表示中の設定ページが変わりました。');
        const text = JSON.stringify(action.value, (_key, value) => {
          if (typeof value === 'number' && !Number.isFinite(value))
            throw Error('数値の入力を確認してください。');
          return value;
        });
        const next = applySettingsJson(
          this.state.draft,
          this.page(),
          this.options.applets(),
          text,
          false,
        );
        // Keep incomplete form text separate from the last validated draft, including across views.
        try {
          applySettingsJson(this.state.draft, this.page(), this.options.applets(), text);
          this.state.draft = next;
          delete this.state.buffers[action.pageId];
          this.formErrors.delete(action.pageId);
        } catch (error) {
          this.state.buffers[action.pageId] = text;
          this.formErrors.set(
            action.pageId,
            `${this.page().title}: ${error instanceof Error ? error.message : error}`,
          );
        }
        this.state.dirty = true;
        this.state.parseError = '';
        break;
      }
      case 'partial-text':
        if (action.pageId !== this.state.pageId || this.state.mode !== 'json')
          throw Error('表示中の設定ページが変わりました。');
        if (
          typeof action.value !== 'string' ||
          new TextEncoder().encode(action.value).length > 1024 * 1024
        )
          throw Error('JSONは1MB以下にしてください。');
        this.state.text = action.value;
        this.state.dirty = true;
        try {
          this.state.draft = applySettingsJson(
            this.state.draft,
            this.page(),
            this.options.applets(),
            action.value,
          );
          this.state.parseError = '';
        } catch (error) {
          this.state.parseError = `JSONの内容を修正してください。${error instanceof Error ? error.message : error}`;
        }
        break;
      case 'draft': {
        if (this.state.mode === 'json' && this.state.parseError)
          throw Error('JSONの内容を修正してください。');
        // Incomplete form values are accepted, but never functions or non-finite numbers.
        const check = (value: unknown): void => {
          if (typeof value === 'number' && !Number.isFinite(value))
            throw Error('数値の入力を確認してください。');
          if (typeof value === 'function' || typeof value === 'symbol')
            throw Error('設定値が不正です。');
          if (value && typeof value === 'object') Object.values(value).forEach(check);
        };
        check(action.value);
        if (
          !action.value ||
          new TextEncoder().encode(JSON.stringify(action.value)).length > 1024 * 1024
        )
          throw Error('設定は1MB以下にしてください。');
        this.state.draft = structuredClone(action.value);
        this.state.text =
          this.state.mode === 'json' ? JSON.stringify(this.projection(), null, 2) : '';
        this.state.dirty = true;
        this.state.parseError = '';
        break;
      }
      case 'mode':
        if (!['form', 'json'].includes(action.value)) throw Error('表示方法が不正です。');
        if (this.state.parseError && this.state.mode === 'json')
          throw Error('JSONの内容を修正してからフォームを開いてください。');
        if (action.value === 'json' && this.formErrors.has(this.state.pageId))
          throw Error('入力途中の項目を修正してからJSONを開いてください。');
        this.state.mode = action.value;
        if (action.value === 'json') this.state.text = JSON.stringify(this.projection(), null, 2);
        break;
      case 'avatar':
        if (
          action.bytes !== null &&
          (!(action.bytes instanceof Uint8Array) || action.bytes.length > 5 * 1024 * 1024)
        )
          throw Error('画像は5MB以下にしてください。');
        this.avatar = action.bytes === null ? null : new Uint8Array(action.bytes);
        this.avatarName = action.name;
        this.state.avatarChanged = true;
        this.state.avatarPreview =
          this.avatar === null
            ? null
            : `data:image/${this.avatar[0] === 137 ? 'png' : 'jpeg'};base64,${Buffer.from(this.avatar).toString('base64')}`;
        this.state.dirty = true;
        break;
      case 'avatar-loading':
        if (typeof action.value !== 'boolean') throw Error('画像読込状態が不正です。');
        this.state.avatarLoading = action.value;
        break;
      case 'reload':
        if (this.state.avatarLoading) throw Error('画像の読み込み中です。');
        this.reset();
        return this.snapshot();
      case 'discard':
        if (this.state.avatarLoading) throw Error('画像の読み込み中です。');
        this.state.pending = true;
        this.notify();
        try {
          if (await this.options.confirmDiscard()) this.reset();
        } finally {
          this.state.pending = false;
          this.notify();
        }
        return this.snapshot();
      case 'save':
        if (!this.state.dirty) return this.snapshot();
        if (this.state.avatarLoading) throw Error('画像の読み込み中です。');
        this.state.saveError = '';
        try {
          if (this.state.parseError) throw Error(this.state.parseError);
          if (this.formErrors.size) throw Error([...this.formErrors.values()].join('\n'));
          const value = parseSettings(this.state.draft);
          validateAppletSettings(value, this.options.applets());
          this.state.pending = true;
          this.notify();
          await this.options.save(value, this.state.revision, this.avatar, this.avatarName);
          this.reset();
        } catch (error) {
          this.state.saveError = error instanceof Error ? error.message : String(error);
          throw error;
        } finally {
          this.state.pending = false;
          this.notify();
        }
        return this.snapshot();
      default:
        throw Error('設定操作が不正です。');
    }
    this.notify();
    return this.snapshot();
  }
}
