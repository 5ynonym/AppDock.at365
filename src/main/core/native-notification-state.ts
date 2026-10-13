import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { JsonLinePeer } from './rpc';
/** Lazy, hook-free query worker. It owns no notification content or lifetime. */
export class NativeNotificationState {
  private child?: ChildProcessWithoutNullStreams;
  private peer?: JsonLinePeer;
  constructor(private executable: string) {}
  async accepts() {
    if (!this.peer || this.peer.closed) {
      this.close();
      const child = spawn(this.executable, ['--notification-state'], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const peer = new JsonLinePeer(child.stdout, child.stdin, async () => {
        throw Error('Unexpected notification event');
      });
      this.child = child;
      this.peer = peer;
      child.stderr.resume();
      child.on('error', () => peer.close());
      child.on('exit', () => peer.close());
    }
    const value = await this.peer.request('notifications.state', {}, 2000);
    if (typeof value?.accepts !== 'boolean') throw Error('Invalid notification state');
    return value.accepts;
  }
  close() {
    this.peer?.close();
    this.child?.kill();
    this.peer = undefined;
    this.child = undefined;
  }
}
