import { hostSettingItem } from '../../../src/shared/settings-catalog';
import { settingAnchor } from '../../../src/shared/settings-ui/setting-anchor';
import {
  SettingsInput,
  SettingsTextarea,
  numberInput,
} from '../../../src/shared/settings-ui/SettingsInput';
import { settingsControls } from '../../../src/shared/settings-ui/api';
import { useEffect, useRef, useState } from 'react';
import { Toggle } from '../../../src/shared/settings-ui/Toggle';
import type { AutomationAction, AutomationState } from '../../../src/shared/automation';

export function CodexSettings({ onOpenPermissions }: { onOpenPermissions(): void }) {
  const [state, setState] = useState<AutomationState>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [file, setFile] = useState('');
  const [port, setPort] = useState('0');
  const [name, setName] = useState('AppDock');
  const operation = useRef(false);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      void settingsControls
        .automation({ kind: 'status' })
        .then((r) => {
          if (!active) return;
          setState(r.state);
        })
        .catch((e) => {
          if (active) setError(String(e));
        });
    refresh();
    const unsubscribe = settingsControls.onChanged(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (state) setFile(state.configFile);
  }, [state?.configFile]);
  useEffect(() => {
    if (state) setPort(String(state.port));
  }, [state?.port]);
  useEffect(() => {
    if (state) setName(state.serverId);
  }, [state?.serverId]);
  async function run(action: AutomationAction) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await settingsControls.automation(action);
      setState(r.state);
      setMessage(r.message ?? '更新しました。');
    } catch (e) {
      setError(String(e));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  if (!state) return <div role="status">{error || '連携状態を読み込んでいます…'}</div>;
  const configure = (
    enabled = state!.enabled,
    allowWrite = state!.allowWrite,
    nextPort = state!.port,
  ) => void run({ kind: 'configure', enabled, allowWrite, port: nextPort });
  return (
    <section className="codex-settings" aria-label="Codex連携">
      <h3>Codex連携</h3>
      <p>
        同じPCのCodexからAppDockの状態を確認し、基本設定の変更や公開されたコマンドの実行ができます。連携の設定はこのPCへ即時反映されます。
      </p>
      <div className="setting-row" {...settingAnchor('codex', 'automation')}>
        <div>
          <strong>{hostSettingItem('codex', 'automation').title}</strong>
          <p>AppDockの起動中に接続できます。</p>
        </div>
        <Toggle
          label="Codex連携を有効にする"
          checked={state.enabled}
          disabled={busy}
          onChange={(v) => configure(v)}
        />
      </div>
      <div className="permission-connection" {...settingAnchor('codex', 'permissions')}>
        <p>AppletとMCPから操作できる範囲は「操作の許可」で設定します。</p>
        <button className="secondary" onClick={onOpenPermissions}>
          操作の許可を開く
        </button>
      </div>
      <dl className="codex-status">
        <dt>サーバー</dt>
        <dd>{state.running ? '稼働中' : state.enabled ? '起動できません' : '停止中'}</dd>
        <dt>Codexへの登録</dt>
        <dd>
          {state.registration === 'registered'
            ? '登録済み'
            : state.registration === 'conflict'
              ? '確認が必要'
              : '未登録'}
        </dd>
        <dt>クライアント接続</dt>
        <dd>
          {state.lastClientAt
            ? new Date(state.lastClientAt).toLocaleString()
            : 'まだ確認されていません'}
        </dd>
      </dl>
      {(error || state.error || state.registrationError) && (
        <p className="codex-error" role="alert">
          {error || state.error || state.registrationError}
        </p>
      )}
      {message && (
        <p className="codex-message" role="status">
          {message}
        </p>
      )}
      <h3 {...settingAnchor('codex', 'registration')}>
        {hostSettingItem('codex', 'registration').title}
      </h3>
      <p>
        このAppDockの接続情報だけをCodex設定に追加します。登録後はCodexを再読み込みまたは再起動してください。
      </p>
      <label className="codex-field">
        Codexの設定ファイル
        <SettingsInput
          aria-label="Codexの設定ファイル"
          value={file}
          disabled={busy}
          spellCheck={false}
          onChange={(e) => setFile(e.target.value)}
        />
      </label>
      <div className="codex-actions">
        <button
          className="secondary"
          disabled={busy || file === state.configFile}
          onClick={() => void run({ kind: 'selectConfig', file })}
        >
          設定先を変更
        </button>
        <button
          disabled={busy || !state.running || file !== state.configFile}
          onClick={() => void run({ kind: 'register' })}
        >
          登録・修復
        </button>
        <button
          className="secondary"
          disabled={busy || state.registration === 'absent'}
          onClick={() => void run({ kind: 'unregister' })}
        >
          登録を解除
        </button>
        <button
          className="secondary"
          disabled={busy || !state.running}
          onClick={() => void run({ kind: 'test' })}
        >
          接続テスト
        </button>
      </div>
      <p>
        {state.lastClientAt
          ? 'クライアントからの接続を確認しました。'
          : '新しいCodexチャットで「AppDockの状態を確認して」と依頼してください。'}{' '}
        接続テストはAppDock内の疎通確認です。
      </p>
      <details {...settingAnchor('codex', 'connection')}>
        <summary>{hostSettingItem('codex', 'connection').title}</summary>
        <dl className="codex-status">
          <dt>接続先</dt>
          <dd>{state.endpoint || '連携を有効にすると決まります'}</dd>
          <dt>登録名</dt>
          <dd>{state.serverId}</dd>
        </dl>
        <label className="codex-field">
          Codexへの登録名
          <SettingsInput
            aria-label="Codexへの登録名"
            value={name}
            maxLength={64}
            disabled={busy}
            spellCheck={false}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <p>複数のAppDockを登録するときは、AppDock_Testなど別の名前にしてください。</p>
        <button
          className="secondary"
          disabled={busy || name === state.serverId}
          onClick={() => void run({ kind: 'selectName', name })}
        >
          登録名を保存
        </button>
        <p>登録名を変える場合は、一度登録を解除してから登録し直してください。</p>
        <label className="codex-field">
          接続ポート
          <SettingsInput
            type="number"
            min="0"
            max="65535"
            aria-label="接続ポート"
            value={port}
            disabled={busy}
            onChange={(e) => setPort(e.target.value)}
          />
        </label>
        <p>0は空きポートを選んで保存します。変更後は登録を修復してください。</p>
        <div className="codex-actions">
          <button
            className="secondary"
            disabled={busy || port === ''}
            onClick={() => configure(state.enabled, state.allowWrite, Number(port))}
          >
            ポートを適用
          </button>
          <button
            className="secondary"
            disabled={busy || !state.port}
            onClick={() => void run({ kind: 'rotateToken' })}
          >
            認証情報を再発行
          </button>
        </div>
        <p>
          接続トークンはCodexのローカル設定にも保存されます。再発行後は登録を修復してください。別PCやWSLのCodexはこの画面の登録対象ではありません。
        </p>
      </details>
    </section>
  );
}
