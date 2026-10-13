/** Shared lazy OS eligibility query, independent of any notification Window. */
export class NotificationAvailability {
  private consumers = new Set<string>();
  private listeners = new Set<() => void>();
  private blocked = new Set<string>();
  private value: 'unknown' | 'allowed' | 'blocked' | 'failed' = 'unknown';
  private timer?: ReturnType<typeof setInterval>;
  private querying = false;
  private epoch = 0;
  private disposed = false;
  constructor(private options: { query(): Promise<boolean>; close(): void; failed(): void }) {}
  status() {
    return this.blocked.size ? 'blocked' : this.value;
  }
  subscribe(callback: () => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
  private changed() {
    for (const callback of this.listeners) callback();
  }
  use(id: string, enabled: boolean) {
    if (this.disposed) return;
    if (enabled) this.consumers.add(id);
    else this.consumers.delete(id);
    if (this.consumers.size && !this.timer) {
      this.timer = setInterval(() => void this.check(), 1000);
      this.timer.unref();
      void this.check();
    } else if (!this.consumers.size && this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
      this.epoch++;
      this.querying = false;
      this.options.close();
      if (this.value !== 'failed') this.value = 'unknown';
    }
  }
  setBlocked(reason: string, blocked: boolean) {
    const old = this.status();
    if (blocked) this.blocked.add(reason);
    else {
      this.blocked.delete(reason);
      if (this.value !== 'failed') this.value = 'unknown';
    }
    if (old !== this.status()) this.changed();
    if (!blocked) void this.check();
  }
  async check() {
    if (this.disposed || this.querying || !this.consumers.size || this.value === 'failed') return;
    this.querying = true;
    const epoch = this.epoch;
    try {
      const allowed = await this.options.query();
      if (epoch !== this.epoch || this.disposed) return;
      const value = allowed ? 'allowed' : 'blocked';
      if (value !== this.value) {
        this.value = value;
        this.changed();
      }
    } catch {
      if (epoch !== this.epoch || this.disposed) return;
      this.value = 'failed';
      this.options.failed();
      this.changed();
    } finally {
      if (epoch === this.epoch) this.querying = false;
    }
  }
  retry() {
    this.value = 'unknown';
    this.changed();
    void this.check();
  }
  dispose() {
    this.disposed = true;
    this.epoch++;
    clearInterval(this.timer);
    this.options.close();
    this.listeners.clear();
    this.consumers.clear();
  }
}
