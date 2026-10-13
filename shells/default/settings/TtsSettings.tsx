import React, { useState, useEffect } from 'react';
import type { SettingsControlEditor } from '../../../src/shared/settings-ui/api';
import type { SettingsPageAuxiliary } from '../../../src/shared/settings-page';
import { defaultTtsSettings, type TtsSettings, type TtsVoice } from '../../../src/shared/tts';
import { settingAnchor } from '../../../src/shared/settings-ui/setting-anchor';
export function TtsSettingsForm({
  editor,
  auxiliary,
  invoke,
  busy,
}: {
  editor: SettingsControlEditor;
  auxiliary?: SettingsPageAuxiliary['tts'];
  invoke(name: string, args?: unknown[]): Promise<any>;
  busy: boolean;
}) {
  const value = editor.value.tts ?? defaultTtsSettings();
  const [key, setKey] = useState('');
  const [text, setText] = useState('');
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [manual, setManual] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    setVoices([]);
    setMessage('');
  }, [value.baseUrl, value.voicesSource, value.voicesPath, JSON.stringify(value.manualVoices)]);
  const change = (patch: Partial<TtsSettings>) =>
    editor.edit({ ...editor.value, tts: { ...value, ...patch } });
  const run = async (action: () => Promise<void>) => {
    if (pending) return;
    setPending(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  };
  const field = (id: string, title: string, child: React.ReactNode) => (
    <label className="setting-row" {...settingAnchor('tts', id)}>
      <span>{title}</span>
      {child}
    </label>
  );
  return (
    <section className="settings-form tts-settings" aria-label="読み上げ">
      <h3>読み上げ</h3>
      <p className="muted">
        OpenAI互換のTTSサーバーで生成した音声を、このPCで再生します。変更は自動保存されます。
      </p>
      {field(
        'baseUrl',
        'APIのURL',
        <input
          aria-label="APIのURL"
          value={value.baseUrl}
          placeholder="http://host:8080/v1"
          onChange={(e) => change({ baseUrl: e.target.value })}
        />,
      )}
      {field(
        'model',
        'TTSモデル',
        <input
          aria-label="TTSモデル"
          value={value.model}
          onChange={(e) => change({ model: e.target.value })}
        />,
      )}
      <div {...settingAnchor('tts', 'apiKey')}>
        <label>
          APIキー
          <input
            aria-label="APIキー"
            type="password"
            autoComplete="off"
            value={key}
            placeholder={
              auxiliary?.apiKeyConfigured ? '設定済み（値は表示しません）' : '未設定・認証なし'
            }
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
        <button
          disabled={busy || pending || !key}
          onClick={() =>
            void run(async () => {
              await invoke('ttsSetKey', [key]);
              setKey('');
              setMessage('APIキーをこのPCに保存しました。');
            })
          }
        >
          APIキーを設定
        </button>
        <button
          className="secondary"
          disabled={busy || pending || (!auxiliary?.apiKeyConfigured && !auxiliary?.error)}
          onClick={() =>
            void run(async () => {
              await invoke('ttsSetKey', ['']);
              setKey('');
              setMessage('APIキーを削除しました。');
            })
          }
        >
          APIキーを削除
        </button>
        <p className="muted">
          APIキーはこのPCに暗号化保存します。接続先を変更したら再設定してください。
        </p>
      </div>
      {field(
        'defaultVoice',
        '既定のボイス',
        <input
          aria-label="既定のボイス"
          list="tts-voices"
          value={value.defaultVoice}
          onChange={(e) => change({ defaultVoice: e.target.value })}
        />,
      )}
      <datalist id="tts-voices">
        {voices.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </datalist>
      {field(
        'defaultSpeed',
        '読み上げ速度',
        <input
          aria-label="読み上げ速度"
          type="number"
          min="0.25"
          max="4"
          step="0.05"
          value={value.defaultSpeed}
          onChange={(e) => change({ defaultSpeed: e.target.valueAsNumber })}
        />,
      )}
      <button
        disabled={busy || pending}
        onClick={() =>
          void run(async () => {
            const r = await invoke('ttsVoices');
            setVoices(r.voices);
            setMessage(`${r.voices.length}件のボイスを取得しました。`);
          })
        }
      >
        ボイス一覧を更新
      </button>
      {voices.length > 0 && <p>{voices.map((v) => `${v.name} (${v.id})`).join('、')}</p>}
      <details className="update-disclosure">
        <summary>速度・ボイス一覧の詳細設定</summary>
        {field(
          'speedMode',
          '速度の適用先',
          <select
            aria-label="速度の適用先"
            value={value.speedMode}
            onChange={(e) => change({ speedMode: e.target.value as TtsSettings['speedMode'] })}
          >
            <option value="playback">AppDockで再生速度を変更</option>
            <option value="server">サーバーで生成速度を変更</option>
          </select>,
        )}
        {field(
          'voicesSource',
          'ボイス一覧の取得方式',
          <select
            aria-label="ボイス一覧の取得方式"
            value={value.voicesSource}
            onChange={(e) => {
              setVoices([]);
              change({ voicesSource: e.target.value as TtsSettings['voicesSource'] });
            }}
          >
            <option value="endpoint">サーバーから取得</option>
            <option value="manual">手動一覧</option>
          </select>,
        )}
        {field(
          'voicesPath',
          'ボイス一覧のパス',
          <input
            aria-label="ボイス一覧のパス"
            value={value.voicesPath}
            onChange={(e) => change({ voicesPath: e.target.value })}
          />,
        )}
        {field(
          'manualVoices',
          '手動ボイス一覧（JSON）',
          <textarea
            aria-label="手動ボイス一覧"
            value={manual ?? JSON.stringify(value.manualVoices, null, 2)}
            onChange={(e) => {
              const v = e.target.value;
              setManual(v);
              try {
                change({ manualVoices: JSON.parse(v) });
                setError('');
              } catch {
                setError('手動ボイス一覧をJSON配列で入力してください。');
              }
            }}
          />,
        )}
        <p className="muted">
          手動一覧はidとnameを持つ配列です。一覧を取得できないサーバーでも、ボイスIDを直接指定できます。
        </p>
      </details>
      <div {...settingAnchor('tts', 'preview')}>
        <h3>試聴</h3>
        <label>
          試聴するテキスト
          <textarea
            aria-label="試聴するテキスト"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <p className="muted">
          入力したテキストを設定先のTTSサーバーへ送信します。本文は保存しません。
        </p>
        <button
          disabled={busy || pending || !text.trim()}
          onClick={() =>
            void run(async () => {
              await invoke('ttsPreview', [text, crypto.randomUUID()]);
              setMessage('読み上げを受け付けました。');
            })
          }
        >
          試聴する
        </button>
        <button
          className="secondary"
          disabled={busy || pending}
          onClick={() =>
            void run(async () => {
              await invoke('ttsStop');
              setMessage('読み上げを停止しました。');
            })
          }
        >
          すべての読み上げを停止
        </button>
        <ul>
          {auxiliary?.jobs.slice(-5).map((j) => (
            <li key={j.jobId}>
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
            </li>
          ))}
        </ul>
      </div>
      {(error || auxiliary?.error) && (
        <p className="error-text" role="alert">
          {error || auxiliary?.error}
        </p>
      )}
      <p role="status">{pending ? '処理しています…' : message}</p>
    </section>
  );
}
