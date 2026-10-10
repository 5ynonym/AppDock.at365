import http, { type IncomingMessage } from 'node:http';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { AutomationApi, AutomationError, automationMethods } from './automation-api';

const names = [
  'appdock_get_info',
  'appdock_list_applets',
  'appdock_get_settings_schema',
  'appdock_get_settings',
  'appdock_get_applet',
  'appdock_list_commands',
  'appdock_execute_command',
  'appdock_get_shortcuts',
  'appdock_get_gestures',
  'appdock_get_ribbon',
  'appdock_get_tray',
];
const descriptions = [
  'AppDockの版・接続先・対応APIを取得します。',
  'Appletの基本情報と稼働状態を取得します。設定や認証情報は含みません。',
  '公開された設定の型・適用タイミングを取得します。appletId省略時は本体設定です。',
  '公開された設定と変更番号を取得します。appletId省略時は本体設定です。変更前に呼んでください。',
  '指定したAppletの説明・状態・エラー概要・外部公開コマンドを取得します。認証情報や全設定は含みません。',
  '外部公開を許可したコマンドと現在の実行可否を取得します。実行前に確認してください。',
  'commands.listのinputSchemaに従いidとargsで実行します。設定変更は設定変更許可、Appletの有効・無効・再起動はApplet管理許可も必要です。settings.updateのargsにはchangesとexpectedRevision、任意のdryRunを指定します。別途コマンド実行許可が必要です。受付または処理応答を返し、操作先の効果は保証しません。失敗や応答消失時は状態確認前に再実行しないでください。',
  'ショートカットの割当・条件・実行順・revision・割当可能な公開コマンド・OS登録状態を取得します。変更はappdock.shortcuts.updateへoperations/expectedRevision/任意dryRunを渡してください。設定変更・コマンド実行・ショートカット編集の許可が必要です。同じキーの複数行は条件を満たす順に実行します。OS登録は非同期なので保存後に再取得してください。',
  'マウスジェスチャーの割当・条件・実行順・動作設定・revision・割当可能な公開コマンドを取得します。変更はappdock.gestures.updateへoperations/expectedRevision/任意dryRunを渡します。設定変更・コマンド実行・ジェスチャー編集の許可が必要です。右ボタンを押しながら移動/クリック/ホイール/キーで操作します。保存成功は実入力の成功を保証しません。',
  'リボンの配置・表示・項目・保持中の未導入ID・revisionを取得します。変更はappdock.ribbon.updateのoperationsとexpectedRevision、任意dryRunを指定します。コマンド実行・設定変更・リボン編集の許可が必要です。項目IDはコマンドIDと異なります。無効Appletの配置を保持し、編集だけで有効化やページ表示はしません。resetは未導入項目の配置も含め初期状態に戻します。',
  'タスクトレイのメニュー・シングル/ダブルクリック割当・割当可能コマンド・revisionを取得します。編集はappdock.tray.updateへoperations/expectedRevision/任意dryRunを指定します。実行・設定変更・タスクトレイ編集の許可が必要です。新規割当は公開済み引数なしコマンドだけ。メニューの設定/終了は末尾固定。グループは1段、ungroupで中身を保持して解除できます。doubleClickCommandはnullで解除でき、シングルは1コマンド必須です。編集だけでコマンドを実行しません。',
];
function tools() {
  return names.map((name, i) => ({
    name,
    description: descriptions[i],
    inputSchema: {
      type: 'object' as const,
      properties:
        i === 2 || i === 3
          ? { appletId: { type: 'string', maxLength: 200 } }
          : i === 4
            ? { id: { type: 'string', maxLength: 200 } }
            : i === 6
              ? {
                  id: { type: 'string', maxLength: 200 },
                  args: {
                    type: 'object',
                    description: 'commands.listで取得したinputSchemaに従う引数',
                  },
                }
              : {},
      ...(i === 4 || i === 6 ? { required: ['id'] } : {}),
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: i !== 6,
      destructiveHint: i === 6,
      idempotentHint: i !== 6,
      openWorldHint: i === 6,
    },
  }));
}
function body(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0,
      failed = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 65536) {
        if (!failed) reject(Error('TOO_LARGE'));
        failed = true;
        chunks.length = 0;
      } else if (!failed) chunks.push(chunk);
    });
    req.on('end', () => {
      if (!failed) {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          reject(Error('INVALID_JSON'));
        }
      }
    });
    req.on('error', reject);
    req.on('aborted', () => reject(Error('ABORTED')));
  });
}
export class AutomationMcp {
  private server?: http.Server;
  private requests = new Set<Server>();
  port = 0;
  constructor(
    private api: AutomationApi,
    private token: () => string,
    private connected: () => void,
    private version: string,
    private audit: (level: string, message: string) => void = () => {},
  ) {}
  async start(port: number) {
    const server = http.createServer(async (req, res) => {
      const fail = (status: number) => {
        if (!res.headersSent)
          res.writeHead(status, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
        res.end(http.STATUS_CODES[status]);
      };
      if (req.url !== '/mcp') return fail(404);
      if (
        req.headers.host !== `127.0.0.1:${this.port}` ||
        (req.headers.origin && req.headers.origin !== `http://127.0.0.1:${this.port}`)
      )
        return fail(403);
      const authorization = Buffer.from(req.headers.authorization ?? '');
      const expected = Buffer.from(`Bearer ${this.token()}`);
      if (authorization.length !== expected.length || !timingSafeEqual(authorization, expected))
        return fail(401);
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return fail(405);
      }
      if (!req.headers['content-type']?.startsWith('application/json')) return fail(415);
      if (this.requests.size >= 8) return fail(429);
      const sdk = new Server(
        { name: 'AppDock', version: this.version },
        {
          capabilities: { tools: {} },
          instructions:
            'Read settings and their revision before changing them. List public commands before executing an exact id. Setting commands require both command and settings permissions. Applet lifecycle commands require command and Applet management permissions; enable/disable persist the enabled setting, restart never enables a disabled Applet. Read shortcuts.get before editing shortcuts with appdock.shortcuts.update; command, settings and shortcut editing permissions are required. Use only assignableCommands for new assignments. Keep unrelated bindings; use stable binding IDs, expectedRevision and dryRun. A shared key executes all matching bindings in their saved order; OS registration is asynchronous and must be checked separately. Read ribbon.get before editing with appdock.ribbon.update; command, settings and ribbon editing permissions are required. Ribbon IDs are not command IDs; disabled Applet pages retain layout without activation. Reorder includes every item in the chosen placement, including hidden and disabled pages. Reset clears retained missing-page layout too. Use commands.execute with args following the listed inputSchema. A settingsSaved response confirms persistence, not completion of Applet settingsChanged. lifecycleApplied reports the current enabled/state; waiting means startup is scheduled. A command response is not proof of its external effect. Do not retry commands after errors or lost responses without checking their effect. Never overwrite settings.json directly. Account data is not exposed.',
        },
      );
      this.requests.add(sdk);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      let disposed = false;
      const dispose = () => {
        if (disposed) return;
        disposed = true;
        this.requests.delete(sdk);
        void sdk.close().catch(() => {});
      };
      res.on('close', dispose);
      sdk.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: tools() }));
      sdk.setRequestHandler(CallToolRequestSchema, async (request) => {
        const index = names.indexOf(request.params.name);
        const method = index < 0 ? 'unknown' : automationMethods[index];
        const requestId = randomUUID();
        const started = Date.now();
        const target = this.api.auditTarget(method, request.params.arguments ?? {});
        const context = `[MCP] API=${method} requestId=${requestId}${target ? ` target=${target}` : ''}`;
        if (method === 'commands.execute') this.audit('info', `${context} result=started`);
        try {
          if (index < 0) throw new AutomationError('NOT_FOUND', '対応していないツールです。');
          const value = await this.api.call(
            automationMethods[index],
            request.params.arguments ?? {},
          );
          this.audit(
            'info',
            `${context} result=success${method === 'commands.execute' ? ` completion=${value.completion}` : ''} durationMs=${Date.now() - started}`,
          );
          return {
            content: [{ type: 'text', text: JSON.stringify(value) }],
            structuredContent: value,
          };
        } catch (error) {
          const value = {
            code: error instanceof AutomationError ? error.code : 'INTERNAL_ERROR',
            message: error instanceof AutomationError ? error.message : '処理に失敗しました。',
          };
          this.audit(
            'warn',
            `${context} result=failed code=${value.code} durationMs=${Date.now() - started}`,
          );
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify(value) }],
            structuredContent: value,
          };
        }
      });
      try {
        const data = await body(req);
        const current = Buffer.from(`Bearer ${this.token()}`);
        if (authorization.length !== current.length || !timingSafeEqual(authorization, current)) {
          fail(401);
          dispose();
          return;
        }
        await sdk.connect(transport);
        res.setHeader('Cache-Control', 'no-store');
        await transport.handleRequest(req, res, data);
        if (
          sdk.getClientVersion() &&
          data &&
          typeof data === 'object' &&
          'method' in data &&
          data.method === 'initialize' &&
          !req.headers['x-appdock-self-test']
        )
          this.connected();
      } catch (error) {
        fail((error as Error).message === 'TOO_LARGE' ? 413 : 400);
        dispose();
      }
    });
    server.requestTimeout = 10000;
    server.headersTimeout = 10000;
    server.setTimeout(60000, (socket) => socket.destroy());
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
    this.port = (server.address() as { port: number }).port;
    this.server = server;
  }
  async close() {
    const server = this.server;
    this.server = undefined;
    if (!server) return;
    server.closeAllConnections();
    await Promise.allSettled([...this.requests].map((s) => s.close()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
    this.requests.clear();
    this.port = 0;
  }
}
