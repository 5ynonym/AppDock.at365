/** One host-wide FIFO for prepared audio. Generation stays outside this queue. */
export interface AudioPlaybackRequest {
  bytes: Buffer;
  signal?: AbortSignal;
  speed?: number;
  playbackTimeoutMs: number;
  beforePlay?: () => void;
}
type Entry = {
  request: AudioPlaybackRequest;
  controller: AbortController;
  resolve(): void;
  reject(error: unknown): void;
  cleanup(): void;
};
export class AudioPlaybackQueue {
  private queue: Entry[] = [];
  private active?: Entry;
  private running?: Promise<void>;
  private closed = false;
  constructor(
    private player: (request: AudioPlaybackRequest & { signal: AbortSignal }) => Promise<void>,
    private capacity = 48,
    private waitMs = 600000,
  ) {}
  play(request: AudioPlaybackRequest): Promise<void> {
    if (this.closed) return Promise.reject(Error('音声再生サービスは終了しています。'));
    if (request.signal?.aborted) return Promise.resolve();
    if (this.queue.length + (this.active ? 1 : 0) >= this.capacity)
      return Promise.reject(Error('音声の再生待ちが多すぎます。'));
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const entry: Entry = { request, controller, resolve, reject, cleanup: () => {} };
      const abort = () => {
        controller.abort();
        const index = this.queue.indexOf(entry);
        if (index >= 0) {
          this.queue.splice(index, 1);
          entry.cleanup();
          resolve();
        }
      };
      const timer = setTimeout(() => {
        const index = this.queue.indexOf(entry);
        if (index < 0) return;
        this.queue.splice(index, 1);
        entry.cleanup();
        reject(Error('音声の再生待ち時間を超えました。'));
      }, this.waitMs);
      entry.cleanup = () => {
        clearTimeout(timer);
        request.signal?.removeEventListener('abort', abort);
      };
      request.signal?.addEventListener('abort', abort, { once: true });
      this.queue.push(entry);
      queueMicrotask(() => this.pump());
    });
  }
  private pump() {
    if (this.active || this.closed) return;
    const entry = this.queue.shift();
    if (!entry) return;
    this.active = entry;
    this.running = (async () => {
      try {
        if (!entry.controller.signal.aborted)
          await this.player({ ...entry.request, signal: entry.controller.signal });
        entry.resolve();
      } catch (error) {
        if (entry.controller.signal.aborted) entry.resolve();
        else entry.reject(error);
      } finally {
        entry.cleanup();
        this.active = undefined;
        queueMicrotask(() => this.pump());
      }
    })();
  }
  async close() {
    this.closed = true;
    for (const entry of this.queue.splice(0)) {
      entry.controller.abort();
      entry.cleanup();
      entry.resolve();
    }
    this.active?.controller.abort();
    await this.running;
  }
}
