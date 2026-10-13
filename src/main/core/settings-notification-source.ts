import { randomUUID } from 'node:crypto';
import type { SettingsEditingSession } from './settings-editing-session';
import type { NotificationService } from './notification-service';

/** Temporary consumer; remove this adapter when settings use immediate persistence. */
export class SettingsNotificationSource {
  private id?: string;
  private signature = '';
  constructor(
    private service: NotificationService,
    private options: {
      editor: SettingsEditingSession;
      route(): string;
      busy(): boolean;
      flush(): Promise<void>;
      edit(): Promise<void>;
    },
  ) {}
  refresh() {
    const s = this.options.editor.snapshot();
    if (!s.dirty) {
      if (this.id) this.service.end('host.settings', this.id);
      this.id = undefined;
      this.signature = '';
      return;
    }
    const message = s.parseError || s.saveError;
    const busy = this.options.busy() || s.pending || s.avatarLoading;
    const visible = !['settings', 'extensions'].includes(this.options.route());
    const signature = JSON.stringify([message, busy, visible]);
    if (this.id && signature === this.signature) return;
    this.signature = signature;
    const act = async (type: 'save' | 'discard') => {
      await this.options.flush();
      const latest = this.options.editor.snapshot();
      try {
        await this.options.editor.act({
          sessionId: latest.sessionId,
          editRevision: latest.editRevision,
          operationId: randomUUID(),
          action: { type },
        });
      } catch {
        // EditingSession retains draft and reports a safe presentation error.
        if (!this.options.editor.snapshot().saveError)
          throw Error('設定操作を完了できませんでした。');
      } finally {
        this.signature = '';
        this.refresh();
      }
    };
    this.id = this.service.upsert('host.settings', {
      dedupeKey: 'editing',
      level: message ? 'error' : 'warning',
      title: message ? '変更を保存できません' : '未保存の変更があります',
      body: message.slice(0, 2000) || '設定・ショートカットなどの変更がまだ保存されていません。',
      lifetime: { type: 'condition' },
      dismissible: false,
      targets: ['banner'],
      history: 'persistent',
      historyText: {
        title: '設定の未保存変更',
        body: message ? '設定の保存に問題がありました。' : '設定の変更が未保存です。',
      },
      busy,
      bannerVisible: visible,
      actions: [
        ...(message ? [{ key: 'edit', label: '設定を確認', run: this.options.edit }] : []),
        { key: 'discard', label: 'すべて破棄…', run: () => act('discard') },
        { key: 'save', label: 'すべて保存', primary: true, run: () => act('save') },
      ],
    });
  }
}
