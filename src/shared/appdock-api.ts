// One operation catalog drives MCP tools and both Applet SDK entry points.
export const appDockOperations = {
  'input.sendKeys': {
    callers: ['applet'],
    permissions: ['sendInput'],
    name: 'appdock_send_keys',
    description: 'アクティブなウィンドウへキーを送信します。',
    inputSchema: {
      type: 'object',
      properties: { keys: { type: 'string', minLength: 1, maxLength: 100 } },
      required: ['keys'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  'input.appCommand': {
    callers: ['applet'],
    permissions: ['sendInput'],
    name: 'appdock_send_app_command',
    description: 'アクティブなウィンドウへ操作メッセージを送信します。',
    inputSchema: {
      type: 'object',
      properties: { action: { type: 'string', enum: ['back', 'forward', 'reload'] } },
      required: ['action'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  'system.getInfo': {
    callers: ['mcp', 'applet'],
    permissions: ['read'],
    name: 'appdock_get_info',
    description: 'AppDockの版・接続先・対応APIを取得します。',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  'applets.list': {
    callers: ['mcp', 'applet'],
    permissions: ['read'],
    name: 'appdock_list_applets',
    description: 'Appletの基本情報と稼働状態を取得します。設定や認証情報は含みません。',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  'settings.getSchema': {
    callers: ['mcp', 'applet'],
    permissions: ['read'],
    name: 'appdock_get_settings_schema',
    description: '公開された設定の型・適用タイミングを取得します。appletId省略時は本体設定です。',
    inputSchema: {
      type: 'object',
      properties: {
        appletId: {
          type: 'string',
          maxLength: 200,
        },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  'settings.get': {
    callers: ['mcp', 'applet'],
    permissions: ['read'],
    name: 'appdock_get_settings',
    description:
      '公開された設定と変更番号を取得します。appletId省略時は本体設定です。変更前に呼んでください。',
    inputSchema: {
      type: 'object',
      properties: {
        appletId: {
          type: 'string',
          maxLength: 200,
        },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  'applets.get': {
    callers: ['mcp', 'applet'],
    permissions: ['read'],
    name: 'appdock_get_applet',
    description:
      '指定したAppletの説明・状態・エラー概要・外部公開コマンドを取得します。認証情報や全設定は含みません。',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          maxLength: 200,
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  'commands.list': {
    callers: ['mcp', 'applet'],
    permissions: ['read'],
    name: 'appdock_list_commands',
    description:
      '外部公開を許可したコマンドと現在の実行可否を取得します。実行前に確認してください。',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  'commands.execute': {
    callers: ['mcp', 'applet'],
    permissions: ['read'],
    name: 'appdock_execute_command',
    description:
      'commands.listのinputSchemaに従いidとargsで実行します。設定変更は設定変更許可、Appletの有効・無効・再起動はApplet管理許可も必要です。settings.updateのargsにはchangesとexpectedRevision、任意のdryRunを指定します。別途コマンド実行許可が必要です。受付または処理応答を返し、操作先の効果は保証しません。失敗や応答消失時は状態確認前に再実行しないでください。',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          maxLength: 200,
        },
        args: {
          type: 'object',
          description: 'commands.listで取得したinputSchemaに従う引数',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  'shortcuts.get': {
    callers: ['mcp', 'applet'],
    permissions: ['read'],
    name: 'appdock_get_shortcuts',
    description:
      'ショートカットの割当・条件・実行順・revision・割当可能な公開コマンド・OS登録状態を取得します。変更はappdock.shortcuts.updateへoperations/expectedRevision/任意dryRunを渡してください。設定変更・コマンド実行・ショートカット編集の許可が必要です。同じキーの複数行は条件を満たす順に実行します。OS登録は非同期なので保存後に再取得してください。',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  'gestures.get': {
    callers: ['mcp', 'applet'],
    permissions: ['read'],
    name: 'appdock_get_gestures',
    description:
      'マウスジェスチャーの割当・条件・実行順・動作設定・revision・割当可能な公開コマンドを取得します。変更はappdock.gestures.updateへoperations/expectedRevision/任意dryRunを渡します。設定変更・コマンド実行・ジェスチャー編集の許可が必要です。右ボタンを押しながら移動/クリック/ホイール/キーで操作します。保存成功は実入力の成功を保証しません。',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  'ribbon.get': {
    callers: ['mcp', 'applet'],
    permissions: ['read'],
    name: 'appdock_get_ribbon',
    description:
      'リボンの配置・表示・項目・保持中の未導入ID・revisionを取得します。変更はappdock.ribbon.updateのoperationsとexpectedRevision、任意dryRunを指定します。コマンド実行・設定変更・リボン編集の許可が必要です。項目IDはコマンドIDと異なります。無効Appletの配置を保持し、編集だけで有効化やページ表示はしません。resetは未導入項目の配置も含め初期状態に戻します。',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  'tray.get': {
    callers: ['mcp', 'applet'],
    permissions: ['read'],
    name: 'appdock_get_tray',
    description:
      'タスクトレイのメニュー・シングル/ダブルクリック割当・割当可能コマンド・revisionを取得します。編集はappdock.tray.updateへoperations/expectedRevision/任意dryRunを指定します。実行・設定変更・タスクトレイ編集の許可が必要です。新規割当は公開済み引数なしコマンドだけ。メニューの設定/終了は末尾固定。グループは1段、ungroupで中身を保持して解除できます。doubleClickCommandはnullで解除でき、シングルは1コマンド必須です。編集だけでコマンドを実行しません。',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
} as const;
export type ApiCaller = 'mcp' | 'applet';
export function operationsFor(caller: ApiCaller) {
  return Object.entries(appDockOperations).filter(([, d]) =>
    (d.callers as readonly string[]).includes(caller),
  );
}
export type AppDockMethod = keyof typeof appDockOperations;
export const appDockMethods = Object.keys(appDockOperations) as AppDockMethod[];
export const appletApiPermissionLabels = {
  sendInput: 'Windowsへのキー・操作メッセージ送信',
  read: '公開情報の取得',
  execute: '公開コマンドの実行',
  write: '公開設定の変更',
  manageApplets: 'Appletの有効・無効・再起動',
  editShortcuts: 'ショートカットの編集',
  editGestures: 'マウスジェスチャーの編集',
  editRibbon: 'リボンの編集',
  editTray: 'タスクトレイの編集',
} as const;
export type AppletApiPermission = keyof typeof appletApiPermissionLabels;
export type AppletApiPermissions = Partial<Record<AppletApiPermission, boolean>>;
export type AppDockReply =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: { code: string; message: string } };
export class AppDockApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export interface AppDockClient {
  call(method: AppDockMethod, params?: Record<string, unknown>): Promise<Record<string, unknown>>;
}
export function createAppDockClient(
  request: (method: string, params: unknown) => Promise<AppDockReply>,
): AppDockClient {
  return {
    call: async (method, params = {}) => {
      const reply = await request('host.appdock.call', { method, params });
      if (!reply.ok) throw new AppDockApiError(reply.error.code, reply.error.message);
      return reply.value;
    },
  };
}
