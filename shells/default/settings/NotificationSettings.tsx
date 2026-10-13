import type { FormEditor } from './SettingsForm';
import type {
  NotificationPreference,
  NotificationTypeEntry,
} from '../../../src/shared/notification-types';
import {
  notificationTypeKey,
  notificationSettingKey,
  resolveNotificationPolicy,
} from '../../../src/shared/notification-types';
import { settingAnchor } from '../../../src/shared/settings-ui/setting-anchor';
import { SettingsInput } from '../../../src/shared/settings-ui/SettingsInput';
import { Toggle } from '../../../src/shared/settings-ui/Toggle';
const targetTitles = { banner: 'バナー', desktop: 'デスクトップ通知', windows: 'Windows通知' };
const reasonTitles: Record<string, string> = {
  'type-disabled': 'この種類の通知はオフです。',
  'applet-disabled': 'Applet共通設定で停止中です。',
  'type-definition-changed': '通知種類の仕様が変わりました。設定を確認してください。',
  'no-available-targets': '選択した通知先はこの版では利用できません。',
};
export function NotificationSettings({
  editor,
  types,
}: {
  editor: FormEditor;
  types: NotificationTypeEntry[];
}) {
  const draft = editor.draft;
  const overrides = draft.notificationPreferences?.overrides ?? [];
  const change = (type: NotificationTypeEntry, patch?: Partial<NotificationPreference>) => {
    const key = notificationTypeKey(type),
      current = overrides.find((r) => notificationTypeKey(r) === key);
    const next = overrides.filter((r) => notificationTypeKey(r) !== key);
    if (patch)
      next.push({
        ownerKind: type.ownerKind,
        ownerId: type.ownerId,
        typeId: type.typeId,
        ...current,
        ...patch,
      });
    editor.edit({ ...draft, notificationPreferences: { overrides: next } });
  };
  const owners = [...new Set(types.map((t) => JSON.stringify([t.ownerKind, t.ownerId])))];
  const unknown = overrides.filter(
    (r) => !types.some((t) => notificationTypeKey(t) === notificationTypeKey(r)),
  );
  return (
    <div className="notification-settings">
      <div className="setting-row" {...settingAnchor('notifications', 'notifications')}>
        <div>
          <strong>Appletからの通知を許可</strong>
          <p>種類別設定と併せて適用します。旧方式の通知もこのスイッチで制御します。</p>
        </div>
        <Toggle
          label="Appletからの通知を許可"
          checked={draft.host.notifications}
          onChange={(notifications) =>
            editor.edit({ ...draft, host: { ...draft.host, notifications } })
          }
        />
      </div>
      <p className="muted">
        変更は設定を保存した後の通知に反映されます。時間制限を変更しても、表示中の通知の期限は変わりません。
      </p>
      {owners.map((owner) => {
        const rows = types.filter((t) => JSON.stringify([t.ownerKind, t.ownerId]) === owner);
        return (
          <section key={owner} aria-label={rows[0].ownerTitle + 'の通知'}>
            <h3>{rows[0].ownerTitle}</h3>
            {rows.map((type) => {
              const policy = resolveNotificationPolicy(type, draft);
              const row = overrides.find(
                (r) => notificationTypeKey(r) === notificationTypeKey(type),
              );
              const checked = !type.canDisable || (row?.enabled ?? type.defaultEnabled);
              return (
                <article
                  className="notification-setting-card"
                  key={notificationTypeKey(type)}
                  {...settingAnchor('notifications', notificationSettingKey(type))}
                >
                  <div className="setting-row">
                    <div>
                      <strong>{type.title}</strong>
                      <p>{type.description}</p>
                    </div>
                    <Toggle
                      label={type.title + 'を通知'}
                      checked={checked}
                      disabled={!type.canDisable}
                      onChange={(enabled) => change(type, { enabled })}
                    />
                  </div>
                  {!type.canDisable && <p className="muted">{type.disabledControlReason}</p>}
                  {type.ownerKind === 'applet' &&
                    !['starting', 'running'].includes(type.ownerState) && (
                      <p className="muted">Appletは停止中です。通知設定を編集できます。</p>
                    )}
                  {policy.reason && (
                    <p role="status">{reasonTitles[policy.reason] ?? policy.reason}</p>
                  )}
                  <fieldset>
                    <legend>通知先</legend>
                    <label>
                      <SettingsInput
                        type="checkbox"
                        aria-label={type.title + 'の通知センターのみ'}
                        checked={!policy.selectedTargets.length}
                        disabled={!!type.requiredTargets.length}
                        onChange={(e) => {
                          if (e.target.checked) change(type, { targets: [] });
                        }}
                      />
                      通知センターのみ
                    </label>
                    {type.allowedTargets.map((target) => (
                      <label key={target}>
                        <SettingsInput
                          type="checkbox"
                          aria-label={type.title + 'の' + targetTitles[target]}
                          checked={policy.selectedTargets.includes(target)}
                          disabled={target !== 'banner' || type.requiredTargets.includes(target)}
                          onChange={(e) =>
                            change(type, {
                              targets: e.target.checked
                                ? [...policy.selectedTargets, target]
                                : policy.selectedTargets.filter((t) => t !== target),
                            })
                          }
                        />
                        {targetTitles[target]}
                        {target !== 'banner'
                          ? '（未対応）'
                          : type.requiredTargets.includes(target)
                            ? '（必須）'
                            : ''}
                      </label>
                    ))}
                  </fieldset>
                  {type.lifetimePolicy === 'userDuration' ? (
                    <label className="notification-duration">
                      自動消去までの秒数
                      <SettingsInput
                        type="text"
                        inputMode="numeric"
                        aria-label={type.title + 'の表示時間'}
                        placeholder="空欄なら閉じるまで表示"
                        value={
                          row?.durationSeconds === undefined
                            ? (type.defaultDurationSeconds ?? '')
                            : (row.durationSeconds ?? '')
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          change(type, {
                            durationSeconds: (value === ''
                              ? null
                              : /^\d+$/.test(value)
                                ? Number(value)
                                : value) as number | null,
                          });
                        }}
                      />
                      <small>1〜86,400秒。空欄なら自動で消えません。</small>
                    </label>
                  ) : (
                    <p className="muted">
                      {type.lifetimePolicy === 'condition'
                        ? '問題が解消するまで表示します。'
                        : '閉じるまで表示します。'}
                    </p>
                  )}
                  <button disabled={!row} onClick={() => change(type)}>
                    既定に戻す
                  </button>
                </article>
              );
            })}
          </section>
        );
      })}
      {!!unknown.length && (
        <section aria-label="現在利用できない通知種類">
          <h3>現在利用できない種類</h3>
          {unknown.map((row) => (
            <article className="notification-setting-card" key={notificationTypeKey(row)}>
              <strong>
                {row.ownerId} / {row.typeId}
              </strong>
              <p>定義が見つかりません。再導入に備えて設定を保持しています。</p>
              <button
                onClick={() =>
                  editor.edit({
                    ...draft,
                    notificationPreferences: {
                      overrides: overrides.filter(
                        (r) => notificationTypeKey(r) !== notificationTypeKey(row),
                      ),
                    },
                  })
                }
              >
                この種類の設定を削除
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
