/** One press captures its command list before any command can change the active page. */
export class ShortcutDispatcher {
  private executing = new Set<string>();
  private keys = new Set<string>();
  constructor(
    private execute: (id: string) => Promise<unknown>,
    private report: (message: string) => void,
    private stopped: () => boolean = () => false,
  ) {}
  async dispatch(key: string, commands: string[]) {
    if (this.keys.has(key) || this.stopped()) return;
    const captured = [...new Set(commands)].filter((id) => !this.executing.has(id));
    this.keys.add(key);
    let executed = 0;
    let failed = 0;
    // Reserve the entire batch before the first asynchronous execution (SendInput re-entry).
    captured.forEach((id) => this.executing.add(id));
    try {
      for (const id of captured) {
        if (this.stopped()) break;
        try {
          await this.execute(id);
          executed++;
        } catch (error) {
          failed++;
          this.report(`${id}: ${String(error)}`);
        }
      }
    } finally {
      captured.forEach((id) => this.executing.delete(id));
      this.keys.delete(key);
    }
    return { executed, failed };
  }
}
