import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomBytes, createHash } from 'node:crypto';
import type { AutomationAction, AutomationState, AutomationReply } from '../../shared/automation';
import { atomicWrite } from './settings';
import { AutomationApi } from './automation-api';
import { AutomationMcp } from './automation-mcp';
import {
  changeRegistration,
  codexConfigPath,
  codexServerName,
  registrationBlock,
  registrationStatus,
} from './codex-registration';

interface LocalConfig {
  version: 1;
  enabled: boolean;
  allowWrite: boolean;
  allowExecute: boolean;
  port: number;
  token: string;
  configFile: string;
  serverName: string;
  owned: Record<string, string>;
}
export class AutomationService {
  private config: LocalConfig;
  private token = '';
  private server?: AutomationMcp;
  private busy = false;
  private closed = false;
  private loadError?: string;
  private error?: string;
  private lastClientAt?: string;
  readonly id: string;
  private file: string;
  constructor(
    private options: {
      localDirectory: string;
      baseDirectory: string;
      version: string;
      encrypt(value: string): string;
      decrypt(value: string): string;
      createApi(writable: () => boolean, id: string, executable: () => boolean): AutomationApi;
      changed(): void;
      audit?(level: string, message: string): void;
    },
  ) {
    this.id =
      'appdock_' +
      createHash('sha256')
        .update(path.resolve(options.baseDirectory).toLowerCase())
        .digest('hex')
        .slice(0, 16);
    this.file = path.join(options.localDirectory, 'automation.json');
    this.config = {
      version: 1,
      enabled: false,
      allowWrite: false,
      allowExecute: false,
      port: 0,
      token: '',
      serverName: 'AppDock',
      configFile: path.join(
        process.env.CODEX_HOME || path.join(os.homedir(), '.codex'),
        'config.toml',
      ),
      owned: {},
    };
    try {
      if (fs.existsSync(this.file)) {
        if (fs.statSync(this.file).size > 262144) throw Error();
        const c = JSON.parse(fs.readFileSync(this.file, 'utf8')) as LocalConfig;
        if (
          c.version !== 1 ||
          typeof c.enabled !== 'boolean' ||
          typeof c.allowWrite !== 'boolean' ||
          (c.allowExecute !== undefined && typeof c.allowExecute !== 'boolean') ||
          !Number.isInteger(c.port) ||
          c.port < 0 ||
          c.port > 65535 ||
          typeof c.token !== 'string' ||
          !c.owned ||
          typeof c.owned !== 'object' ||
          Array.isArray(c.owned) ||
          Object.values(c.owned).some((v) => typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v))
        )
          throw Error();
        c.configFile = codexConfigPath(c.configFile);
        c.allowExecute ??= false;
        c.serverName = codexServerName(c.serverName ?? 'AppDock');
        const token = options.decrypt(c.token);
        if (!/^[a-f0-9]{64}$/.test(token)) throw Error();
        this.token = token;
        this.config = c;
      }
    } catch {
      this.loadError = '連携設定を読み取れません。PC専用のautomation.jsonを確認してください。';
    }
  }
  private save() {
    if (!this.token) {
      this.token = randomBytes(32).toString('hex');
      this.config.token = this.options.encrypt(this.token);
    }
    atomicWrite(this.file, JSON.stringify(this.config, null, 2) + '\n');
  }
  private block() {
    return registrationBlock(
      this.id,
      `http://127.0.0.1:${this.config.port}/mcp`,
      this.token,
      this.config.serverName,
    );
  }
  state(): AutomationState {
    return {
      enabled: this.config.enabled,
      allowWrite: this.config.allowWrite,
      allowExecute: this.config.allowExecute,
      port: this.config.port,
      running: !!this.server,
      endpoint: this.config.port ? `http://127.0.0.1:${this.config.port}/mcp` : '',
      serverId: this.config.serverName,
      error: this.loadError || this.error,
      lastClientAt: this.lastClientAt,
      configFile: this.config.configFile,
      ...(this.token
        ? registrationStatus(
            this.config.configFile,
            this.id,
            this.block(),
            this.config.owned[this.config.configFile],
          )
        : { registration: 'absent' as const }),
    };
  }
  private async start() {
    if (!this.config.enabled || this.server || this.loadError || this.closed) return;
    const server = new AutomationMcp(
      this.options.createApi(
        () => this.config.enabled && this.config.allowWrite && !this.closed,
        this.id,
        () => this.config.enabled && this.config.allowExecute && !this.closed,
      ),
      () => this.token,
      () => {
        this.lastClientAt = new Date().toISOString();
        this.options.changed();
      },
      this.options.version,
      this.options.audit,
    );
    try {
      await server.start(this.config.port);
      if (this.closed) {
        await server.close();
        return;
      }
      this.config.port = server.port;
      this.save();
      this.server = server;
      this.error = undefined;
    } catch {
      await server.close();
      this.error = 'MCPを開始できません。ポートの競合や連携設定の保存先を確認してください。';
    }
  }
  async initialize() {
    await this.start();
  }
  async action(action: AutomationAction): Promise<AutomationReply> {
    if (!action || typeof action !== 'object' || typeof action.kind !== 'string')
      throw Error('連携操作が不正です。');
    if (action.kind === 'status') return { state: this.state() };
    if (this.busy || this.closed) throw Error('連携の処理中です。しばらく待ってください。');
    if (this.loadError) throw Error(this.loadError);
    this.busy = true;
    const previous = structuredClone(this.config);
    try {
      let message: string | undefined;
      switch (action.kind) {
        case 'configure': {
          if (
            typeof action.enabled !== 'boolean' ||
            typeof action.allowWrite !== 'boolean' ||
            !Number.isInteger(action.port) ||
            action.port < 0 ||
            action.port > 65535 ||
            (action.port > 0 && action.port < 1024)
          )
            throw Error('連携設定が不正です。ポートは1024～65535、または0（自動選択）です。');
          if (!this.token) {
            this.token = randomBytes(32).toString('hex');
            this.config.token = this.options.encrypt(this.token);
          }
          this.config.enabled = action.enabled;
          this.config.allowWrite = action.allowWrite;
          this.config.port = action.port;
          this.save();
          if (!action.enabled || action.port !== previous.port) {
            await this.server?.close();
            this.server = undefined;
            this.lastClientAt = undefined;
          }
          this.error = undefined;
          await this.start();
          message = this.error || 'このPCの連携設定を保存しました。';
          break;
        }
        case 'selectConfig':
          this.config.configFile = codexConfigPath(action.file);
          this.save();
          break;
        case 'selectName':
          this.config.serverName = codexServerName(action.name);
          this.save();
          message = '登録名を保存しました。既存の登録は解除してから登録し直してください。';
          break;
        case 'setExecution':
          if (typeof action.allowed !== 'boolean') throw Error('コマンド実行の許可が不正です。');
          this.config.allowExecute = action.allowed;
          this.save();
          message = 'このPCのコマンド実行許可を保存しました。';
          break;
        case 'register':
          if (!this.server) throw Error('先に連携を有効にしてMCPを起動してください。');
          this.config.owned[this.config.configFile] = changeRegistration(
            this.config.configFile,
            this.id,
            this.block(),
            this.config.owned[this.config.configFile],
          )!;
          this.save();
          message =
            '登録しました。Codexを再読み込みまたは再起動して、新しいチャットから接続を確認してください。';
          break;
        case 'unregister':
          if (!this.token) throw Error('解除する登録がありません。');
          changeRegistration(
            this.config.configFile,
            this.id,
            this.block(),
            this.config.owned[this.config.configFile],
            true,
          );
          delete this.config.owned[this.config.configFile];
          this.save();
          message = 'このAppDockの登録を解除しました。Codexを再読み込みしてください。';
          break;
        case 'rotateToken':
          if (!this.token) throw Error('先に連携を有効にしてください。');
          this.token = randomBytes(32).toString('hex');
          this.config.token = this.options.encrypt(this.token);
          this.save();
          this.lastClientAt = undefined;
          message = '認証情報を再発行しました。「登録・修復」でCodexの登録を更新してください。';
          break;
        case 'test': {
          if (!this.server) throw Error('MCPが起動していません。');
          const response = await fetch(this.state().endpoint, {
            method: 'POST',
            signal: AbortSignal.timeout(5000),
            headers: {
              Authorization: `Bearer ${this.token}`,
              'Content-Type': 'application/json',
              Accept: 'application/json, text/event-stream',
              'x-appdock-self-test': '1',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'initialize',
              params: {
                protocolVersion: '2025-06-18',
                capabilities: {},
                clientInfo: { name: 'AppDock connection test', version: '1' },
              },
            }),
          });
          const value = (await response.json()) as any;
          if (!response.ok || !value.result?.serverInfo) throw Error('接続テストに失敗しました。');
          message = 'AppDock内の疎通に成功しました。Codexからの接続確認は別途必要です。';
          break;
        }
        default:
          throw Error('対応していない連携操作です。');
      }
      this.options.changed();
      return { state: this.state(), message };
    } catch (e) {
      this.config = previous;
      this.token = previous.token ? this.options.decrypt(previous.token) : '';
      // Never echo credentials or raw TOML in an IPC error.
      if (e instanceof Error && !/Bearer |authorization|token =/i.test(e.message)) throw e;
      throw Error('連携操作に失敗しました。設定とアクセス権を確認してください。');
    } finally {
      this.busy = false;
    }
  }
  async close() {
    this.closed = true;
    await this.server?.close();
    this.server = undefined;
  }
}
