export interface TtsVoice {
  id: string;
  name: string;
}
export interface TtsSettings {
  baseUrl: string;
  model: string;
  defaultVoice: string;
  defaultSpeed: number;
  speedMode: 'playback' | 'server';
  voicesSource: 'endpoint' | 'manual';
  voicesPath: string;
  manualVoices: TtsVoice[];
}
export interface TtsJob {
  jobId: string;
  state: 'queued' | 'generating' | 'playing' | 'completed' | 'failed' | 'canceled';
  createdAt: string;
  updatedAt: string;
  error?: { code: string; message: string };
}
export const defaultTtsSettings = (): TtsSettings => ({
  baseUrl: '',
  model: '',
  defaultVoice: '',
  defaultSpeed: 1,
  speedMode: 'playback',
  voicesSource: 'endpoint',
  voicesPath: 'audio/voices',
  manualVoices: [],
});
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export function ttsBaseUrl(value: string): string {
  if (!value) return '';
  if (value.length > 2048 || /[\\\s?#]/.test(value))
    throw Error('TTSのURLは認証情報・クエリー・フラグメントを含まないHTTP(S) URLにしてください。');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw Error('TTSのURLが不正です。');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw Error('TTSのURLはHTTP(S) URLにしてください。');
  return url.href.replace(/\/+$/, '');
}
export function ttsVoicesPath(value: string): string {
  if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(value) || value.length > 256)
    throw Error('ボイス一覧のパスはベースURL配下の相対パスにしてください。');
  return value;
}
export function parseTtsVoices(value: unknown): TtsVoice[] {
  if (!Array.isArray(value) || value.length > 1000)
    throw Error('ボイス一覧は1000件以下の配列です。');
  const ids = new Set<string>();
  return value.map((v) => {
    if (
      !object(v) ||
      typeof v.id !== 'string' ||
      !v.id.trim() ||
      v.id.length > 200 ||
      (v.name !== undefined && (typeof v.name !== 'string' || v.name.length > 200)) ||
      ids.has(v.id)
    )
      throw Error('ボイス一覧のID・表示名・重複を確認してください。');
    ids.add(v.id);
    return { id: v.id, name: typeof v.name === 'string' ? v.name : v.id };
  });
}
/** OpenAI-compatible catalogs and Qwen3-TTS catalogs use different envelopes. */
export function parseTtsModels(value: unknown): TtsVoice[] {
  if (!object(value)) throw Error('モデル一覧はオブジェクトです。');
  if (Object.hasOwn(value, 'data')) return parseTtsVoices(value.data);
  if (!Array.isArray(value.models) || value.models.length > 1000)
    throw Error('モデル一覧は1000件以下の配列です。');
  const rows = value.models.map((model) => {
    if (!object(model) || (model.downloaded !== undefined && typeof model.downloaded !== 'boolean'))
      throw Error('モデル一覧の項目が不正です。');
    return { id: model.id ?? model.name, name: model.name, downloaded: model.downloaded };
  });
  const models = parseTtsVoices(rows);
  // Never offer a known-unavailable model or trigger an implicit server download.
  return models.filter((_, index) => rows[index].downloaded !== false);
}
export function parseTtsSettings(value: unknown): TtsSettings {
  if (value === undefined) return defaultTtsSettings();
  if (!object(value)) throw Error('ttsはオブジェクトです。');
  const defaults = defaultTtsSettings();
  if (Object.keys(value).some((k) => !Object.hasOwn(defaults, k)))
    throw Error('TTSに未対応の設定があります。APIキーは専用欄で設定してください。');
  const v = { ...defaults, ...value };
  for (const key of ['baseUrl', 'model', 'defaultVoice', 'voicesPath'] as const)
    if (typeof v[key] !== 'string') throw Error('TTSの文字列設定が不正です。');
  if (v.model.length > 200 || v.defaultVoice.length > 200)
    throw Error('モデルとボイスは200文字以下です。');
  if (!Number.isFinite(v.defaultSpeed) || v.defaultSpeed < 0.25 || v.defaultSpeed > 4)
    throw Error('読み上げ速度は0.25～4.0です。');
  if (!['playback', 'server'].includes(v.speedMode))
    throw Error('速度の適用先はplayback/serverです。');
  if (!['endpoint', 'manual'].includes(v.voicesSource))
    throw Error('ボイス一覧方式はendpoint/manualです。');
  return {
    ...v,
    baseUrl: ttsBaseUrl(v.baseUrl),
    model: v.model.trim(),
    defaultVoice: v.defaultVoice.trim(),
    voicesPath: ttsVoicesPath(v.voicesPath),
    manualVoices: parseTtsVoices(v.manualVoices),
  } as TtsSettings;
}
export type TtsSpeakInput = { text: string; voice?: string; speed?: number; requestId: string };
export type TtsSpeakResult = TtsJob & { completion: 'accepted' };
export type TtsVoicesResult = { voices: TtsVoice[]; source: 'endpoint' | 'manual' };
