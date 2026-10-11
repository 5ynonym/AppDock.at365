import type { Settings } from '../../../src/shared/contracts';
import type { SettingsPageModel, SettingsPageOperation } from '../../../src/shared/settings-page';
import { createDefaultSettings } from '../../../src/shared/settings-schema';
import { settingsProjection } from '../../../src/shared/settings-catalog';
import type { SettingsControlsApi } from '../../../src/shared/settings-ui/api';
/** Values absent from this page are local defaults, never another page's draft. */
export function materialize(model: SettingsPageModel): Settings {
  const merge = (base: any, value: any): any => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return structuredClone(value);
    const result = { ...base };
    for (const [key, part] of Object.entries(value))
      if (!['__proto__', 'prototype', 'constructor'].includes(key))
        result[key] = merge(result[key], part);
    return result;
  };
  return merge(createDefaultSettings(), model.content.values);
}
export class SettingsViewClient {
  model?: SettingsPageModel;
  private queued = 0;
  private chain = Promise.resolve();
  private listeners = new Set<() => void>();
  constructor(
    private render: (model: SettingsPageModel) => void,
    private failed: (text: string) => void,
  ) {}
  flush = () => this.chain;
  accept(next: unknown) {
    const m = next as SettingsPageModel;
    if (m?.kind !== 'settings' || (this.model?.id === m.id && this.model.revision >= m.revision))
      return;
    this.model = m;
    if (!this.queued) this.render(m);
    for (const fn of this.listeners) fn();
  }
  act(operation: SettingsPageOperation): Promise<any> {
    this.queued++;
    const work = this.chain.then(async () => {
      const m = this.model!;
      const response = (await window.appdockPage.act({
        id: m.id,
        type: 'settings',
        sessionId: m.content.editing.sessionId,
        editRevision: m.content.editing.editRevision,
        operationId: crypto.randomUUID(),
        operation,
      })) as { model: SettingsPageModel; result: unknown };
      this.accept(response.model);
      this.failed('');
      return response.result;
    });
    this.chain = work
      .then(
        () => {},
        async (e) => {
          this.failed(String(e));
          try {
            this.accept((await window.appdockPage.connect()).snapshot);
          } catch {}
        },
      )
      .finally(() => {
        this.queued--;
        if (!this.queued && this.model) this.render(this.model);
      });
    return work;
  }
  invoke = (name: string, args: unknown[] = []): Promise<any> => {
    const id = this.model?.content.actions[name];
    if (!id) return Promise.reject(Error('この設定では利用できない操作です。'));
    // Long operations (palette, updates) must not hold the input queue or their cancel action.
    return this.chain.then(async () => {
      const m = this.model!;
      const response = (await window.appdockPage.act({
        id: m.id,
        type: 'settings',
        sessionId: m.content.editing.sessionId,
        editRevision: m.content.editing.editRevision,
        operationId: crypto.randomUUID(),
        operation: { kind: 'invoke', actionId: id, args },
      })) as { model: SettingsPageModel; result: unknown };
      this.accept(response.model);
      return response.result;
    });
  };
  editor(model: SettingsPageModel) {
    const ignore = (p: Promise<unknown>) => void p.catch(() => {});
    return {
      draft: materialize(model),
      edit: (draft: Settings) => {
        const values = settingsProjection(
          draft,
          model.content.page,
          model.content.auxiliary.applets ?? [],
        );
        this.render({
          ...model,
          content: { ...model.content, values, editing: { ...model.content.editing, dirty: true } },
        });
        ignore(
          this.act({
            kind: 'edit',
            action: { type: 'page-values', pageId: model.content.page.id, value: values },
          }),
        );
      },
      setAvatar: this.setAvatar,
      setAvatarLoading: this.setAvatarLoading,
    };
  }
  setAvatar = (bytes: Uint8Array | null, name?: string) => {
    void this.act({ kind: 'edit', action: { type: 'avatar', bytes, name } }).catch(() => {});
  };
  setAvatarLoading = (value: boolean) => {
    void this.act({ kind: 'edit', action: { type: 'avatar-loading', value } }).catch(() => {});
  };
  controls(): SettingsControlsApi {
    const invoke = this.invoke;
    return {
      snapshot: async () => ({
        updates: this.model?.content.auxiliary.updates ?? { busy: false, phase: '', results: [] },
      }),
      onChanged: (callback) => {
        this.listeners.add(callback);
        return () => {
          this.listeners.delete(callback);
        };
      },
      checkUpdates: (id) => invoke('checkUpdates', [id]),
      checkAllUpdates: () => invoke('checkAllUpdates'),
      installUpdates: (id) => invoke('installUpdates', [id]),
      cancelUpdates: () => invoke('cancelUpdates'),
      openReleases: (id) => invoke('openReleases', [id]),
      setShortcutRecording: (value) => invoke('setShortcutRecording', [value]),
      retryGlobalHotKeys: () => invoke('retryGlobalHotKeys'),
      openCommandPalette: (request) => invoke('openCommandPalette', [request]),
      cancelCommandPalette: (id) => invoke('cancelCommandPalette', [id]),
      createWebAccount: (name) => invoke('createWebAccount', [name]),
      renameWebAccount: (id, name) => invoke('renameWebAccount', [id, name]),
      deleteWebAccount: (id) => invoke('deleteWebAccount', [id]),
      clearWebAccount: (id) => invoke('clearWebAccount', [id]),
      webDefaults: (url) => invoke('webDefaults', [url]),
      chooseDirectory: () => invoke('chooseDirectory'),
      setAppletApiPermissions: (value) => invoke('setAppletApiPermissions', [value]),
      automation: (value) => invoke('automation', [value]),
      executeCommand: (id) => invoke(`settingAction:${id}`),
    };
  }
}
