import React, { useEffect, useState, useRef } from 'react';
import type { SettingsPageAuxiliary } from '../../../src/shared/settings-page';
import type { TtsVoice } from '../../../src/shared/tts';
import { resolveNotificationSpeech } from '../../../src/shared/notification-types';
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
};
export function NotificationSettings({
  editor,
  types,
  auxiliary,
  invoke,
  busy,
  select,
}: {
  editor: FormEditor;
  types: NotificationTypeEntry[];
  auxiliary?: SettingsPageAuxiliary['notificationSpeech'];
  invoke(name: string, args?: unknown[]): Promise<any>;
  busy: boolean;
  select(id: string): void;
}) {
  const settings = editor.value;
  const speech = settings.notificationPreferences?.speech ?? {};
  const effective = resolveNotificationSpeech(settings, auxiliary?.defaults);
  const voiceListRevision = useRef(auxiliary?.voiceListRevision);
  voiceListRevision.current = auxiliary?.voiceListRevision;
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [voiceOverride, setVoiceOverride] = useState(false);
  useEffect(() => {
    setVoices([]);
  }, [auxiliary?.voiceListRevision]);
  useEffect(() => {
    if (speech.voice !== undefined) setVoiceOverride(false);
  }, [speech.voice]);
  const changeSpeech = (key: 'voice' | 'speed', value?: string | number) => {
    const next = { ...speech };
    if (value === undefined) delete next[key];
    else (next as any)[key] = value;
    editor.edit({
      ...settings,
      notificationPreferences: {
        ...settings.notificationPreferences,
        overrides: settings.notificationPreferences?.overrides ?? [],
        speech: next,
      },
    });
  };
  const run = async (name: string, args?: unknown[]) => {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      return await invoke(name, args);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  };
  const previewActive = auxiliary?.jobs.some((j) =>
    ['queued', 'generating', 'playing'].includes(j.state),
  );
  const overrides = settings.notificationPreferences?.overrides ?? [];
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
    editor.edit({
      ...settings,
      notificationPreferences: { ...settings.notificationPreferences, overrides: next },
    });
  };
  const owners = [...new Set(types.map((t) => JSON.stringify([t.ownerKind, t.ownerId])))];
  const unknown = overrides.filter(
    (r) => !types.some((t) => notificationTypeKey(t) === notificationTypeKey(r)),
  );
  return (
    <div className="notification-settings">
      <section className="notification-speech-settings" aria-label="通知の読み上げ">
        <h3>通知の読み上げ</h3>
        <p className="muted">
          タイトルと本文を読み上げます。内容は、設定したTTSサーバーへ送信されます。接続先とモデルは共通の読み上げ設定を使用します。
        </p>
        <div {...settingAnchor('notifications', 'speech.voice')}>
          <div className="setting-row">
            <div>
              <strong>声</strong>
              <p>共通の読み上げ設定を使う</p>
            </div>
            <Toggle
              label="通知の声に共通設定を使う"
              checked={speech.voice === undefined && !voiceOverride}
              onChange={(inherit) => {
                setVoiceOverride(!inherit);
                if (inherit) changeSpeech('voice');
                else if (effective.voice) changeSpeech('voice', effective.voice);
              }}
            />
          </div>
          {speech.voice !== undefined || voiceOverride ? (
            <label>
              通知用のボイスID
              <SettingsInput
                aria-label="通知用のボイスID"
                value={speech.voice ?? ''}
                onChange={(e) => changeSpeech('voice', e.target.value)}
                list="notification-voices"
              />
            </label>
          ) : (
            <p className="muted">現在の声: {effective.voice || '未設定'}</p>
          )}
          <datalist id="notification-voices">
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </datalist>
          <button
            disabled={busy || pending}
            onClick={() => {
              const revision = auxiliary?.voiceListRevision;
              void run('notificationVoices').then((v) => {
                if (v && revision === voiceListRevision.current) setVoices(v.voices);
              });
            }}
          >
            ボイス一覧を更新
          </button>
        </div>
        <div {...settingAnchor('notifications', 'speech.speed')}>
          <div className="setting-row">
            <div>
              <strong>速度</strong>
              <p>共通の読み上げ設定を使う</p>
            </div>
            <Toggle
              label="通知の速度に共通設定を使う"
              checked={speech.speed === undefined}
              onChange={(inherit) => changeSpeech('speed', inherit ? undefined : effective.speed)}
            />
          </div>
          {speech.speed !== undefined ? (
            <label>
              通知用の読み上げ速度
              <SettingsInput
                type="number"
                min={0.25}
                max={4}
                step={0.05}
                aria-label="通知用の読み上げ速度"
                value={speech.speed}
                onChange={(e) =>
                  changeSpeech('speed', e.target.value.trim() ? Number(e.target.value) : NaN)
                }
              />
            </label>
          ) : (
            <p className="muted">現在の速度: {effective.speed}</p>
          )}
        </div>
        {(!auxiliary?.configured || !effective.voice) && (
          <p role="status">読み上げには、接続先・モデル・声の設定が必要です。</p>
        )}
        <div
          className="notification-speech-actions"
          {...settingAnchor('notifications', 'speech.preview')}
        >
          <button
            disabled={
              busy || pending || previewActive || !auxiliary?.configured || !effective.voice
            }
            onClick={() => void run('notificationPreview', [crypto.randomUUID()])}
          >
            通知の読み上げを試聴
          </button>
          <button
            disabled={pending || !previewActive}
            onClick={() => void run('notificationPreviewStop')}
          >
            試聴を停止
          </button>
          <button onClick={() => select('tts')}>読み上げ設定を開く</button>
          {auxiliary?.jobs.slice(-3).map((j) => (
            <p key={j.jobId} role="status">
              {
                {
                  queued: '待機中',
                  generating: '生成中',
                  playing: '再生中',
                  completed: '完了',
                  failed: '失敗',
                  canceled: '取消',
                }[j.state]
              }
              {j.error ? '：' + j.error.message : ''}
            </p>
          ))}
        </div>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
      </section>
      <div className="setting-row" {...settingAnchor('notifications', 'notifications')}>
        <div>
          <strong>Appletからの通知を許可</strong>
          <p>種類別設定と併せて適用します。旧方式の通知もこのスイッチで制御します。</p>
        </div>
        <Toggle
          label="Appletからの通知を許可"
          checked={settings.host.notifications}
          onChange={(notifications) =>
            editor.edit({ ...settings, host: { ...settings.host, notifications } })
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
              const policy = resolveNotificationPolicy(type, settings);
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
                  <div className="setting-row">
                    <span>通知を読み上げる</span>
                    <Toggle
                      label={type.title + 'を読み上げる'}
                      checked={row?.speak === true}
                      onChange={(speak) => change(type, { speak })}
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
                          disabled={type.requiredTargets.includes(target)}
                          onChange={(e) =>
                            change(type, {
                              targets: e.target.checked
                                ? [...policy.selectedTargets, target]
                                : policy.selectedTargets.filter((t) => t !== target),
                            })
                          }
                        />
                        {targetTitles[target]}
                        {type.requiredTargets.includes(target) ? '（必須）' : ''}
                      </label>
                    ))}
                  </fieldset>
                  {type.allowedTargets.includes('windows') && (
                    <p className="muted">
                      Windows通知の表示時間・消去はWindowsが管理します。ここで指定する時間は通知センターで操作できる期間です。操作はセンターから利用でき、通知によってはクリックで直接開きます。
                    </p>
                  )}
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
                    ...settings,
                    notificationPreferences: {
                      ...settings.notificationPreferences,
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
