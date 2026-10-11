import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { atomicWrite, isObject } from './settings';
import { AppDockApi, AutomationError, automationMethods } from './appdock-api';
import {
  appletApiPermissionLabels,
  type AppletApiPermissions,
  type AppDockReply,
} from '../../shared/appdock-api';
import type { ExtensionInstance } from './extensions';

function permissions(value: unknown): AppletApiPermissions {
  if (
    !isObject(value) ||
    Object.entries(value).some(
      ([k, v]) => !Object.hasOwn(appletApiPermissionLabels, k) || typeof v !== 'boolean',
    )
  )
    throw Error('Appletの操作許可が不正です。');
  return { ...value };
}
export class AppletApiAccess {
  private grants: Record<string, { folder: string; permissions: AppletApiPermissions }> = {};
  error?: string;
  constructor(private file: string) {
    try {
      if (!fs.existsSync(file)) return;
      if (fs.statSync(file).size > 262144) throw Error();
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (saved.version !== 1 || !isObject(saved.grants)) throw Error();
      const next: typeof this.grants = {};
      for (const [id, grant] of Object.entries(saved.grants)) {
        if (!isObject(grant) || typeof grant.folder !== 'string' || !path.isAbsolute(grant.folder))
          throw Error();
        Object.defineProperty(next, id, {
          value: { folder: grant.folder, permissions: permissions(grant.permissions) },
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
      this.grants = next;
    } catch {
      this.error = 'Applet操作の許可設定を読み取れません。applet-api.jsonを確認してください。';
    }
  }
  get(applet: { id: string; folder: string; capabilities?: string[] }): AppletApiPermissions {
    if (this.error || !applet.capabilities?.includes('appdock-api')) return {};
    const grant = Object.hasOwn(this.grants, applet.id) ? this.grants[applet.id] : undefined;
    return grant?.folder === path.resolve(applet.folder).toLowerCase()
      ? { ...grant.permissions }
      : {};
  }
  set(applet: { id: string; folder: string; capabilities?: string[] }, value: unknown) {
    if (this.error) throw Error(this.error);
    if (!applet.capabilities?.includes('appdock-api'))
      throw Error('このAppletはAppDock操作APIを宣言していません。');
    const next = {
      ...this.grants,
      [applet.id]: {
        folder: path.resolve(applet.folder).toLowerCase(),
        permissions: permissions(value),
      },
    };
    atomicWrite(this.file, JSON.stringify({ version: 1, grants: next }, null, 2) + '\n');
    this.grants = next;
  }
}

export async function callAppletApi(
  api: AppDockApi,
  applet: ExtensionInstance,
  request: unknown,
  audit: (level: string, source: string, message: string) => void,
): Promise<AppDockReply> {
  const method =
    isObject(request) &&
    typeof request.method === 'string' &&
    (automationMethods as readonly string[]).includes(request.method)
      ? request.method
      : 'unknown';
  const context = `[Applet API] API=${method} requestId=${randomUUID()}`;
  const started = Date.now();
  try {
    if (
      !isObject(request) ||
      Object.keys(request).some((k) => !['method', 'params'].includes(k)) ||
      method === 'unknown'
    )
      throw new AutomationError('INVALID_ARGUMENT', '対応するmethodとparamsを指定してください。');
    if (!applet.manifest.capabilities?.includes('appdock-api'))
      throw new AutomationError('CAPABILITY_REQUIRED', 'manifestにappdock-apiが必要です。');
    if (!['starting', 'running'].includes(applet.state))
      throw new AutomationError('UNAVAILABLE', 'Appletは停止しています。');
    audit('info', applet.manifest.id, `${context} result=started`);
    const value = await api.call(method, request.params ?? {}, applet.manifest.id);
    audit(
      'info',
      applet.manifest.id,
      `${context} result=success durationMs=${Date.now() - started}`,
    );
    return { ok: true, value };
  } catch (error) {
    const result =
      error instanceof AutomationError
        ? { code: error.code, message: error.message }
        : { code: 'INTERNAL_ERROR', message: '処理に失敗しました。' };
    audit(
      'warn',
      applet.manifest.id,
      `${context} result=failed code=${result.code} durationMs=${Date.now() - started}`,
    );
    return { ok: false, error: result };
  }
}
