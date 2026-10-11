import { randomUUID } from 'node:crypto';

export interface InputInvocation {
  signal?: AbortSignal;
  window?: string;
  source?: string;
}
/** Host-issued call identities bind input to the actual command and its lifetime. */
export class CommandContexts {
  private pending = new Map<
    string,
    {
      appletId: string;
      session?: string;
      controller: AbortController;
      window?: string;
      source?: string;
    }
  >();
  async run<T>(
    appletId: string,
    invocation: { session: string; window: string; source: string } | undefined,
    execute: (id: string) => Promise<T>,
  ): Promise<T> {
    const id = randomUUID();
    const entry = { appletId, ...invocation, controller: new AbortController() };
    this.pending.set(id, entry);
    try {
      return await execute(id);
    } finally {
      entry.controller.abort();
      this.pending.delete(id);
    }
  }
  get(appletId: string, id: unknown): InputInvocation {
    if (id === undefined || id === null) return {};
    const entry = typeof id === 'string' ? this.pending.get(id) : undefined;
    if (!entry || entry.appletId !== appletId) throw Error('コマンドの実行情報が失効しています。');
    return { signal: entry.controller.signal, window: entry.window, source: entry.source };
  }
  cancel(session: string) {
    for (const e of this.pending.values()) if (e.session === session) e.controller.abort();
  }
  stop(appletId: string) {
    for (const e of this.pending.values()) if (e.appletId === appletId) e.controller.abort();
  }
}
