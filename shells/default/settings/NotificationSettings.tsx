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
import {
  SettingsSection,
  SettingsField,
  SettingsChoice,
  SettingsFeedback,
} from '../../../src/shared/settings-ui/SettingsSections';
const targetTitles = { banner: 'バナー', desktop: 'デスクトップ通知', windows: 'Windows通知' };
const ownerGroup = (type: NotificationTypeEntry) =>
  type.ownerKind === 'host' ? 'host' : JSON.stringify([type.ownerKind, type.ownerId]);
const reasonTitles: Record<string, string> = {
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
    setVoiceOverride(false);
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
    ['queued', 'generating', 'waitingPlayback', 'playing'].includes(j.state),
  );
  const overrides = settings.notificationPreferences?.overrides ?? [];
  const change = (type: NotificationTypeEntry, patch: Partial<NotificationPreference>) => {
    const key = notificationTypeKey(type),
      current = overrides.find((r) => notificationTypeKey(r) === key);
    const next = overrides.filter((r) => notificationTypeKey(r) !== key);
    const updated: NotificationPreference = {
      ownerKind: type.ownerKind,
      ownerId: type.ownerId,
      typeId: type.typeId,
      ...current,
      ...patch,
    };
    // Keep edits valid when an older saved preference lacks newly required controls.
    if (updated.targets && type.requiredTargets.length)
      updated.targets = [...new Set([...updated.targets, ...type.requiredTargets])];
    next.push(updated);
    editor.edit({
      ...settings,
      notificationPreferences: { ...settings.notificationPreferences, overrides: next },
    });
  };
  const owners = [...new Set(types.map(ownerGroup))];
  const unknown = overrides.filter(
    (r) => !types.some((t) => notificationTypeKey(t) === notificationTypeKey(r)),
  );
  return (
    <div className="settings-sections notification-settings">
      <SettingsSection
        title="通知の受け取り方"
        collapsible
        description="種類ごとに通知先を組み合わせられます。必須の通知先がない種類は、通知センターだけに残すこともできます。"
      >
        <p>
          通知は通知センターで確認できます。バナー・デスクトップ通知・Windows通知・読み上げを組み合わせて、受け取り方を選んでください。バナー必須の通知は「通知センターのみ」に変更できません。
        </p>
      </SettingsSection>
      <SettingsSection
        title="通知の読み上げ"
        description={`現在の声: ${effective.voice || '未設定'} ／ 速度: ${effective.speed}倍。通常は共通の読み上げ設定を使います。`}
        collapsible
      >
        <p>
          通知先に「読み上げ」を選んだ種類に適用します。タイトルと本文は共通設定のTTSサーバーへ送信されます。
        </p>
        <SettingsField
          title="声"
          description="共通の声を使うか、通知だけ別の声に変更できます。"
          {...settingAnchor('notifications', 'speech.voice')}
        >
          <div className="settings-actions">
            <Toggle
              label="通知の声に共通設定を使う"
              checked={speech.voice === undefined && !voiceOverride}
              onChange={(inherit) => {
                setVoiceOverride(!inherit);
                if (inherit) changeSpeech('voice');
                else if (effective.voice) changeSpeech('voice', effective.voice);
              }}
            />
            <span>共通設定を使う</span>
          </div>
          {speech.voice !== undefined || voiceOverride ? (
            <>
              <SettingsInput
                aria-label="通知用のボイスID"
                value={speech.voice ?? ''}
                onChange={(e) => changeSpeech('voice', e.target.value)}
                list="notification-voices"
                placeholder="通知用のボイスID"
              />
              <datalist id="notification-voices">
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </datalist>
              <div className="settings-actions">
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
            </>
          ) : (
            <p>現在の声: {effective.voice || '未設定'}</p>
          )}
        </SettingsField>
        <SettingsField
          title="速度"
          description="1倍が標準速度です。"
          {...settingAnchor('notifications', 'speech.speed')}
        >
          <div className="settings-actions">
            <Toggle
              label="通知の速度に共通設定を使う"
              checked={speech.speed === undefined}
              onChange={(inherit) => changeSpeech('speed', inherit ? undefined : effective.speed)}
            />
            <span>共通設定を使う</span>
          </div>
          {speech.speed !== undefined ? (
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
          ) : (
            <p>現在の速度: {effective.speed}</p>
          )}
        </SettingsField>
        {(!auxiliary?.configured || !effective.voice) && (
          <p role="status">読み上げには、接続先・モデル・声の設定が必要です。</p>
        )}
        <div className="settings-actions" {...settingAnchor('notifications', 'speech.preview')}>
          <button
            className="primary"
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
        </div>
        {auxiliary?.jobs.slice(-1).map((j) => (
          <p key={j.jobId} role="status">
            {
              {
                queued: '待機中',
                generating: '生成中',
                waitingPlayback: '再生待ち',
                playing: '再生中',
                completed: '完了',
                failed: '失敗',
                canceled: '取消',
              }[j.state]
            }
            {j.error ? '：' + j.error.message : ''}
          </p>
        ))}
        <SettingsFeedback busy={pending} error={error} />
      </SettingsSection>
      {owners.map((owner) => {
        const rows = types.filter((t) => ownerGroup(t) === owner);
        return (
          <SettingsSection
            key={owner}
            title={rows[0].ownerTitle}
            aria-label={rows[0].ownerTitle + 'の通知'}
          >
            {rows.map((type) => {
              const policy = resolveNotificationPolicy(type, settings);
              const row = overrides.find(
                (r) => notificationTypeKey(r) === notificationTypeKey(type),
              );
              const speaking = row?.speak === true;
              const eventSending = row?.mcpEvents === true;
              const delivery = policy.selectedTargets.map((target) => targetTitles[target]);
              const deliverySummary = delivery.length
                ? delivery.join('・')
                : eventSending
                  ? speaking
                    ? '音声・MCP Eventsのみ'
                    : 'MCP Eventsのみ'
                  : speaking
                    ? '音声のみ'
                    : '通知センターのみ';
              const duration =
                type.lifetimePolicy === 'condition'
                  ? '問題が解消するまで'
                  : policy.durationSeconds === null
                    ? '閉じるまで表示'
                    : `表示時間: ${policy.durationSeconds}秒`;
              const summary = [
                deliverySummary,
                duration,
                `読み上げ: ${speaking ? 'ON' : 'OFF'}`,
                `MCP Events: ${eventSending ? 'ON' : 'OFF'}`,
              ].join(' ／ ');
              return (
                <SettingsSection
                  title={type.title}
                  description={summary}
                  collapsible
                  className="notification-setting-card"
                  key={notificationTypeKey(type)}
                  {...settingAnchor('notifications', notificationSettingKey(type))}
                >
                  <p>{type.description}</p>
                  {type.ownerKind === 'applet' &&
                    !['starting', 'running'].includes(type.ownerState) && (
                      <p className="muted">Appletは停止中です。通知設定を編集できます。</p>
                    )}
                  {policy.reason && (
                    <p role="status">{reasonTitles[policy.reason] ?? policy.reason}</p>
                  )}
                  <fieldset className="notification-targets">
                    <legend>通知先</legend>
                    <div className="settings-choice-grid">
                      {type.allowedTargets.map((target) => (
                        <SettingsChoice
                          key={target}
                          label={targetTitles[target]}
                          ariaLabel={type.title + 'の' + targetTitles[target]}
                          checked={policy.selectedTargets.includes(target)}
                          disabled={type.requiredTargets.includes(target)}
                          description={
                            type.requiredTargets.includes(target) ? 'この通知では必須' : undefined
                          }
                          onChange={(on) =>
                            change(type, {
                              targets: on
                                ? [...policy.selectedTargets, target]
                                : policy.selectedTargets.filter((t) => t !== target),
                            })
                          }
                        />
                      ))}
                      <SettingsChoice
                        label="読み上げ"
                        description="タイトルと本文を音声で通知"
                        ariaLabel={type.title + 'を読み上げる'}
                        checked={speaking}
                        onChange={(speak) => change(type, { speak })}
                      />
                      <SettingsChoice
                        label="MCP Events"
                        description="購読中のdot等へタイトルと本文を送信。OFF中は送信を止め、購読は有効期限まで保持"
                        ariaLabel={type.title + 'をMCP Eventsで送信'}
                        checked={eventSending}
                        onChange={(mcpEvents) => change(type, { mcpEvents })}
                      />
                    </div>
                    <label className="notification-center-only">
                      <SettingsInput
                        type="checkbox"
                        aria-label={type.title + 'の通知センターのみ'}
                        checked={!policy.selectedTargets.length && !speaking && !eventSending}
                        disabled={!!type.requiredTargets.length}
                        onChange={(e) => {
                          if (e.target.checked)
                            change(type, { targets: [], speak: false, mcpEvents: false });
                        }}
                      />
                      通知センターのみ
                    </label>
                  </fieldset>
                  {eventSending && (
                    <p className="muted">
                      MCP連携の有効化、ChatGPTから届く接続経路、dotでの監視登録が必要です。AppDockが動作中に発生した新しい通知を送ります。
                    </p>
                  )}
                  {speaking && (!auxiliary?.configured || !effective.voice) && (
                    <p className="notification-target-hint">
                      読み上げには接続先・モデル・声の設定が必要です。
                      <button onClick={() => select('tts')}>読み上げ設定を開く</button>
                    </p>
                  )}
                  {type.lifetimePolicy === 'userDuration' ? (
                    <SettingsField
                      title="自動消去までの秒数"
                      description="1〜86,400秒。空欄なら閉じるまで表示します。"
                    >
                      <SettingsInput
                        type="text"
                        inputMode="numeric"
                        aria-label={type.title + 'の表示時間'}
                        placeholder="閉じるまで表示"
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
                    </SettingsField>
                  ) : (
                    <p className="muted">
                      {type.lifetimePolicy === 'condition'
                        ? '問題が解消するまで表示します。'
                        : '閉じるまで表示します。'}
                    </p>
                  )}
                </SettingsSection>
              );
            })}
          </SettingsSection>
        );
      })}
      <SettingsSection
        title="通知の表示時間について"
        description="通知先ごとの動作の違いを確認できます。"
        collapsible
      >
        <p>表示時間の変更は次の通知から反映されます。現在表示中の通知の期限は変わりません。</p>
        <p>
          Windows通知の表示時間・消去はWindowsが管理します。ここで指定する時間は通知センターで操作できる期間です。通知によってはクリックで直接開きます。
        </p>
      </SettingsSection>
      {!!unknown.length && (
        <SettingsSection
          title="現在利用できない種類"
          description="再導入に備えて、以前の設定を保持しています。"
          aria-label="現在利用できない通知種類"
          collapsible
        >
          {unknown.map((row) => (
            <SettingsField key={notificationTypeKey(row)} title={row.ownerId + ' / ' + row.typeId}>
              <div className="settings-actions">
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
              </div>
            </SettingsField>
          ))}
        </SettingsSection>
      )}
    </div>
  );
}
