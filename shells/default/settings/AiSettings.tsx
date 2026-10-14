import { useEffect, useRef, useState } from 'react';
import type { SettingsControlEditor } from '../../../src/shared/settings-ui/api';
import type { SettingsPageAuxiliary } from '../../../src/shared/settings-page';
import {
  defaultAiSettings,
  aiApprovalValue,
  newAiConnection,
  type AiConnectionSettings,
  type AiModel,
} from '../../../src/shared/ai';
import {
  SettingsInput,
  SettingsTextarea,
  SettingsUrlInput,
} from '../../../src/shared/settings-ui/SettingsInput';
import {
  SettingsSection,
  SettingsField,
  SettingsFeedback,
} from '../../../src/shared/settings-ui/SettingsSections';
import { Toggle } from '../../../src/shared/settings-ui/Toggle';
import { settingAnchor } from '../../../src/shared/settings-ui/setting-anchor';

export function AiSettingsForm({
  editor,
  auxiliary,
  invoke,
  busy,
}: {
  editor: SettingsControlEditor;
  auxiliary?: SettingsPageAuxiliary['ai'];
  invoke(name: string, args?: unknown[]): Promise<any>;
  busy: boolean;
}) {
  const value = editor.value.ai ?? defaultAiSettings();
  const [selected, setSelected] = useState('');
  const c = value.connections.find((c) => c.id === selected) ?? value.connections[0];
  const status = auxiliary?.connections.find((v) => v.id === c?.id);
  const [key, setKey] = useState(''),
    [models, setModels] = useState<AiModel[]>([]);
  const [model, setModel] = useState(''),
    [prompt, setPrompt] = useState(''),
    [input, setInput] = useState('');
  const [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const operation = useRef(false);
  const signature = JSON.stringify([c, status?.allowed, status?.apiKeyConfigured]);
  const current = useRef(signature);
  current.current = signature;
  useEffect(() => {
    setModels([]);
    setError('');
    setMessage('');
  }, [signature]);
  useEffect(() => {
    setKey('');
  }, [c?.id, c?.baseUrl]);
  const change = (next: typeof value) => editor.edit({ ...editor.value, ai: next });
  const patch = (next: Partial<AiConnectionSettings>) => {
    if (c)
      change({
        ...value,
        connections: value.connections.map((v) => (v.id === c.id ? { ...c, ...next } : v)),
      });
  };
  const run = async (work: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true;
    setPending(true);
    setError('');
    setMessage('');
    const started = current.current;
    try {
      await work();
    } catch (e) {
      if (started === current.current)
        setError(e instanceof Error ? e.message : 'AIの操作に失敗しました。');
    } finally {
      operation.current = false;
      setPending(false);
    }
  };
  const jobs = (auxiliary?.jobs ?? []).filter((j) => j.connectionId === c?.id);
  const job = jobs.at(-1),
    active = jobs.some((j) => ['queued', 'running'].includes(j.state));
  const presets: AiConnectionSettings['preset'][] = [
    'ollama',
    'lm-studio',
    'llama-cpp',
    'openai',
    'custom',
  ];
  const presetNames = ['Ollama', 'LM Studio', 'llama.cpp', 'OpenAI', 'その他の互換サーバー'];
  return (
    <div className="settings-sections" aria-label="AI">
      <SettingsSection
        title="共通の設定"
        description="各AppletとMCPが同じ接続設定を使います。用途別のモデルと追加プロンプトは呼出し側から指定できます。"
      >
        <SettingsField
          title="共通プロンプト"
          description="全用途で共有する基本方針です。用途別の追加プロンプトに組み合わせます。空欄でも使えます。"
          {...settingAnchor('ai', 'commonPrompt')}
        >
          <SettingsTextarea
            aria-label="共通プロンプト"
            value={value.commonPrompt}
            onChange={(e) => change({ ...value, commonPrompt: e.target.value })}
          />
        </SettingsField>
        <SettingsField title="既定のAI接続" {...settingAnchor('ai', 'defaultConnectionId')}>
          <select
            aria-label="既定のAI接続"
            value={value.defaultConnectionId ?? ''}
            onChange={(e) => change({ ...value, defaultConnectionId: e.target.value || undefined })}
          >
            <option value="">未設定</option>
            {value.defaultConnectionId &&
              !value.connections.some((c) => c.id === value.defaultConnectionId) && (
                <option value={value.defaultConnectionId}>
                  未配置の接続：{value.defaultConnectionId}
                </option>
              )}
            {value.connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.id}
              </option>
            ))}
          </select>
        </SettingsField>
      </SettingsSection>
      <SettingsSection
        title="AI接続設定"
        description="OpenAI互換のChat Completions APIを使用します。接続先は8件まで登録できます。"
        {...settingAnchor('ai', 'connections')}
      >
        <SettingsField title="編集する接続">
          <select
            aria-label="編集するAI接続"
            value={c?.id ?? ''}
            onChange={(e) => setSelected(e.target.value)}
          >
            {!c && <option value="">接続がありません</option>}
            {value.connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.id}
              </option>
            ))}
          </select>
          <div className="settings-actions">
            <button
              disabled={busy || value.connections.length >= 8}
              onClick={() => {
                const next = newAiConnection(crypto.randomUUID());
                change({
                  ...value,
                  connections: [...value.connections, next],
                  defaultConnectionId: value.defaultConnectionId ?? next.id,
                });
                setSelected(next.id);
              }}
            >
              接続を追加
            </button>
            <button
              disabled={busy || !c || pending || active}
              onClick={() => {
                if (c)
                  change({
                    ...value,
                    connections: value.connections.filter((v) => v.id !== c.id),
                    defaultConnectionId:
                      value.defaultConnectionId === c.id ? undefined : value.defaultConnectionId,
                  });
              }}
            >
              接続を削除
            </button>
          </div>
        </SettingsField>
        {c && (
          <>
            <SettingsField title="名前">
              <SettingsInput
                aria-label="AI接続の名前"
                value={c.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </SettingsField>
            <SettingsField
              title="接続の種類"
              description="新しい接続で入力例を使えます。選択だけでは入力済みのURLや互換性設定を変更しません。"
            >
              <select
                aria-label="AI接続の種類"
                value={c.preset}
                onChange={(e) =>
                  patch({ preset: e.target.value as AiConnectionSettings['preset'] })
                }
              >
                {presets.map((p, i) => (
                  <option key={p} value={p}>
                    {presetNames[i]}
                  </option>
                ))}
              </select>
              <button
                disabled={busy || pending || !!c.baseUrl}
                onClick={() => {
                  const defaults = newAiConnection(c.id, c.preset);
                  patch({
                    baseUrl: defaults.baseUrl,
                    authentication: defaults.authentication,
                    compatibility: defaults.compatibility,
                  });
                }}
              >
                空の接続へ種類の既定値を入力
              </button>
            </SettingsField>
            <SettingsField
              title="APIのURL"
              description="/v1を含むベースURLです。Ollama: http://サーバー:11434/v1、LM Studio: http://サーバー:1234/v1。"
            >
              <SettingsUrlInput
                key={c.id}
                aria-label="AIのAPIのURL"
                spellCheck={false}
                value={c.baseUrl}
                placeholder="http://llm-server:11434/v1"
                onChange={(e) => patch({ baseUrl: e.target.value })}
              />
              {c.baseUrl.startsWith('http:') && (
                <p>この接続では入力とAPIキーがTLSで暗号化されません。</p>
              )}
            </SettingsField>
            <SettingsField
              title="既定モデル"
              description="呼出し側がモデルを省略した場合に使います。一覧にないIDも入力できます。"
            >
              <SettingsInput
                aria-label="AIの既定モデル"
                list="ai-models"
                value={c.defaultModel ?? ''}
                onChange={(e) => patch({ defaultModel: e.target.value })}
              />
              <datalist id="ai-models">
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </datalist>
              <div className="settings-actions">
                <button
                  disabled={busy || pending || !status?.allowed}
                  onClick={() =>
                    void run(async () => {
                      const started = current.current;
                      const r = await invoke('aiModels', [c.id]);
                      if (started !== current.current) return;
                      setModels(r.models);
                      setMessage(
                        r.models.length
                          ? `${r.models.length}件のモデルを取得しました。`
                          : '一覧は空でした。モデルIDを直接入力できます。',
                      );
                    })
                  }
                >
                  モデル一覧を更新
                </button>
              </div>
            </SettingsField>
            <SettingsField title="認証方式">
              <select
                aria-label="AIの認証方式"
                value={c.authentication}
                onChange={(e) =>
                  patch({
                    authentication: e.target.value as AiConnectionSettings['authentication'],
                  })
                }
              >
                <option value="none">認証なし</option>
                <option value="bearer">Bearer APIキー</option>
              </select>
            </SettingsField>
            <SettingsField
              title="APIキー"
              description="このPCだけに暗号化保存します。接続先を変更したら再設定してください。"
              {...settingAnchor('ai', 'apiKey')}
            >
              <SettingsInput
                aria-label="AIのAPIキー"
                type="password"
                autoComplete="off"
                value={key}
                placeholder={status?.apiKeyConfigured ? '設定済み・変更時だけ入力' : '未設定'}
                onChange={(e) => setKey(e.target.value)}
              />
              <div className="settings-actions">
                <button
                  disabled={busy || pending || !key || !c.baseUrl}
                  onClick={() =>
                    void run(async () => {
                      await invoke('aiSetKey', [c.id, c.baseUrl, key]);
                      setKey('');
                      setMessage('APIキーをこのPCに保存しました。');
                    })
                  }
                >
                  AIのAPIキーを設定
                </button>
                <button
                  disabled={busy || pending || !status?.apiKeyConfigured}
                  onClick={() =>
                    void run(async () => {
                      await invoke('aiSetKey', [c.id, c.baseUrl, '']);
                      setKey('');
                      setMessage('APIキーを削除しました。');
                    })
                  }
                >
                  AIのAPIキーを削除
                </button>
              </div>
            </SettingsField>
            <SettingsField
              title="このPCで使用"
              description="この接続へ入力を送信します。呼出し側が選ぶモデルによって、課金や外部への転送が発生する場合があります。Applet・MCPの操作許可は別に設定します。"
              {...settingAnchor('ai', 'access')}
            >
              <Toggle
                label="このPCでAI接続を使用"
                checked={status?.allowed ?? false}
                disabled={busy || pending || !c.baseUrl}
                onChange={(allowed) =>
                  void run(async () => {
                    await invoke('aiSetAllowed', [c.id, aiApprovalValue(c), allowed]);
                  })
                }
              />
              {!status?.allowed && (
                <p>接続先や互換性設定を変更した場合も、ここで利用を許可してください。</p>
              )}
            </SettingsField>
            <SettingsSection title="サーバーに合わせた詳細設定" collapsible>
              <SettingsField title="出力トークン上限の形式">
                <select
                  aria-label="AIの出力上限形式"
                  value={c.compatibility.tokenLimitField}
                  onChange={(e) =>
                    patch({
                      compatibility: {
                        ...c.compatibility,
                        tokenLimitField: e.target
                          .value as AiConnectionSettings['compatibility']['tokenLimitField'],
                      },
                    })
                  }
                >
                  <option value="max_tokens">max_tokens（ローカル互換API）</option>
                  <option value="max_completion_tokens">max_completion_tokens（OpenAI）</option>
                </select>
              </SettingsField>
              <SettingsField
                title="Temperature"
                description="対応するモデルだけ指定します。空欄はサーバーの既定値です。"
              >
                <SettingsInput
                  aria-label="AIのTemperature"
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={c.compatibility.temperature ?? ''}
                  onChange={(e) =>
                    patch({
                      compatibility: {
                        ...c.compatibility,
                        temperature: e.target.value === '' ? undefined : Number(e.target.value),
                      },
                    })
                  }
                />
              </SettingsField>
              <SettingsField
                title="推論の強さ"
                description="対応するモデルのreasoning_effortを指定します。空欄では送信しません。"
              >
                <SettingsInput
                  aria-label="AIの推論の強さ"
                  value={c.compatibility.reasoningEffort ?? ''}
                  onChange={(e) =>
                    patch({
                      compatibility: {
                        ...c.compatibility,
                        reasoningEffort: e.target.value || undefined,
                      },
                    })
                  }
                />
              </SettingsField>
              <SettingsField
                title="生成結果の保存指定"
                description="store:falseに対応する接続で指定します。提供元の監査ログまで非保存にする指定ではありません。"
              >
                <select
                  aria-label="AIの保存指定"
                  value={c.compatibility.store}
                  onChange={(e) =>
                    patch({
                      compatibility: {
                        ...c.compatibility,
                        store: e.target.value as 'omit' | 'false',
                      },
                    })
                  }
                >
                  <option value="omit">指定しない</option>
                  <option value="false">store:falseを送信</option>
                </select>
              </SettingsField>
            </SettingsSection>
          </>
        )}
        <SettingsFeedback busy={pending} error={error || status?.error} message={message} />
      </SettingsSection>
      <SettingsSection
        title="文章生成の試験"
        description="入力は選択した接続先に送信され、課金される場合があります。最初は架空の入力で確認してください。共通プロンプトも適用されます。"
        {...settingAnchor('ai', 'preview')}
      >
        <SettingsField
          title="今回のモデル"
          description="空欄なら選択した接続の既定モデルを使います。"
        >
          <SettingsInput
            aria-label="試験のAIモデル"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
        </SettingsField>
        <SettingsField title="追加プロンプト">
          <SettingsTextarea
            aria-label="試験の追加プロンプト"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </SettingsField>
        <SettingsField title="入力データ">
          <SettingsTextarea
            aria-label="試験の入力データ"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </SettingsField>
        <div className="settings-actions">
          <button
            className="primary"
            disabled={
              busy ||
              pending ||
              active ||
              !c ||
              !status?.allowed ||
              !(value.commonPrompt.trim() || prompt.trim() || input.trim())
            }
            onClick={() =>
              void run(async () => {
                await invoke('aiPreview', [
                  {
                    requestId: crypto.randomUUID(),
                    connectionId: c!.id,
                    ...(model ? { model } : {}),
                    additionalPrompt: prompt,
                    input,
                  },
                ]);
              })
            }
          >
            文章を生成
          </button>
          <button
            disabled={pending || !active}
            onClick={() =>
              void run(async () => {
                for (const j of jobs.filter((j) => ['queued', 'running'].includes(j.state)))
                  await invoke('aiCancel', [j.jobId]);
              })
            }
          >
            生成を取り消す
          </button>
        </div>
        {job && (
          <div role="status">
            <p>
              {
                {
                  queued: '待機中',
                  running: '生成中',
                  completed: '完了',
                  failed: '失敗',
                  canceled: '取消',
                }[job.state]
              }
              ：{job.model}
              {job.error ? ' — ' + job.error.message : ''}
            </p>
            {job.text && <pre className="ai-preview-result">{job.text}</pre>}
            {job.resultExpired && <p>生成結果の保持期限を過ぎました。</p>}
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
