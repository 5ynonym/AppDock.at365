import { AutomationError } from './appdock-api';
import {
  aiObject,
  aiString,
  type AiConnectionSettings,
  type AiJob,
  type AiModel,
} from '../../shared/ai';
export class AiError extends AutomationError {}
export const aiFail = (code: string, message: string): never => {
  throw new AiError(code, message);
};
export class AiOpenAiChat {
  constructor(private fetcher: typeof fetch = fetch) {}
  private async json(
    c: AiConnectionSettings,
    key: string | undefined,
    path: string,
    signal: AbortSignal,
    body?: string,
  ): Promise<unknown> {
    let response: Response | undefined;
    try {
      response = await this.fetcher(c.baseUrl + '/' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(key ? { Authorization: 'Bearer ' + key } : {}),
        },
        ...(body === undefined ? {} : { body }),
        signal,
        redirect: 'error',
      });
      if (!response.ok) {
        if ([401, 403].includes(response.status))
          aiFail('AI_AUTH_FAILED', 'AIサーバーの認証を確認してください。');
        if (response.status === 429)
          aiFail('AI_RATE_LIMITED', 'AIサーバーが受付を制限しています。');
        if (path === 'models' && [404, 405].includes(response.status))
          aiFail(
            'AI_MODELS_UNSUPPORTED',
            'モデル一覧に対応していません。モデルIDを直接入力してください。',
          );
        aiFail('AI_SERVER_ERROR', `AIサーバーがHTTP ${response.status}を返しました。`);
      }
      if (
        (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() !==
          'application/json' ||
        !response.body
      )
        aiFail('AI_INVALID_RESPONSE', 'AIサーバーの応答形式が不正です。');
      const reader = response.body!.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 1024 * 1024)
            aiFail('AI_RESPONSE_TOO_LARGE', 'AIサーバーの応答が大きすぎます。');
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      try {
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
      } catch {
        return aiFail('AI_INVALID_RESPONSE', 'AIサーバーのJSON応答が不正です。');
      }
    } catch (e) {
      if (e instanceof AiError) throw e;
      if (signal.aborted) return aiFail('AI_CANCELED', 'AIの通信を取り消しました。');
      return aiFail(
        'AI_CONNECTION_FAILED',
        'AIサーバーへ接続できません。URLとサーバーの状態を確認してください。',
      );
    } finally {
      await response?.body?.cancel().catch(() => {});
    }
  }
  async generate(
    c: AiConnectionSettings,
    key: string | undefined,
    body: string,
    signal: AbortSignal,
  ): Promise<Pick<AiJob, 'text' | 'usage'>> {
    const v = await this.json(c, key, 'chat/completions', signal, body);
    if (!aiObject(v) || !Array.isArray(v.choices) || !aiObject(v.choices[0]))
      return aiFail('AI_INVALID_RESPONSE', '生成結果が不正です。');
    const choice = v.choices[0];
    if (choice.finish_reason === 'length')
      return aiFail(
        'AI_OUTPUT_LIMIT',
        '出力トークンの上限に達したため、文章を最後まで生成できませんでした。トークン上限を増やすか、推論の強さを調整してください。',
      );
    if (
      choice.finish_reason !== 'stop' ||
      !aiObject(choice.message) ||
      choice.message.refusal ||
      choice.message.tool_calls ||
      choice.message.function_call ||
      !aiString(choice.message.content, 4096) ||
      !choice.message.content.trim()
    )
      return aiFail(
        'AI_INVALID_RESPONSE',
        '生成が完了していないか、有効な文章が返されませんでした。',
      );
    const result: Pick<AiJob, 'text' | 'usage'> = { text: choice.message.content };
    if (v.usage !== undefined && v.usage !== null) {
      if (!aiObject(v.usage)) return aiFail('AI_INVALID_RESPONSE', 'トークン使用量が不正です。');
      result.usage = {};
      for (const [wire, field] of [
        ['prompt_tokens', 'promptTokens'],
        ['completion_tokens', 'completionTokens'],
        ['total_tokens', 'totalTokens'],
      ] as const) {
        const n = v.usage[wire];
        if (n !== undefined) {
          if (!Number.isSafeInteger(n) || Number(n) < 0)
            return aiFail('AI_INVALID_RESPONSE', 'トークン使用量が不正です。');
          result.usage[field] = n as number;
        }
      }
    }
    return result;
  }
  async models(
    c: AiConnectionSettings,
    key: string | undefined,
    signal: AbortSignal,
  ): Promise<{ models: AiModel[] }> {
    const v = await this.json(c, key, 'models', signal);
    if (!aiObject(v) || !Array.isArray(v.data) || v.data.length > 1000)
      return aiFail('AI_INVALID_MODELS', 'モデル一覧の形式が不正です。');
    const ids = new Set<string>();
    return {
      models: v.data.map((m) => {
        if (
          !aiObject(m) ||
          !aiString(m.id, 200) ||
          !m.id.trim() ||
          /[\r\n]/.test(m.id) ||
          ids.has(m.id) ||
          (m.name !== undefined && !aiString(m.name, 200))
        )
          return aiFail('AI_INVALID_MODELS', 'モデル一覧のID・名前・重複を確認してください。');
        ids.add(m.id);
        return { id: m.id, name: typeof m.name === 'string' ? m.name : m.id };
      }),
    };
  }
}
