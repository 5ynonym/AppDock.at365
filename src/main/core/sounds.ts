import fs from 'node:fs/promises';
import path from 'node:path';
import { audioPlayback } from './audio-service';
let pending = 0;
export async function readWave(file: string): Promise<Buffer> {
  if (!path.isAbsolute(file) || path.extname(file).toLowerCase() !== '.wav')
    throw new Error('通知音にはWAVの絶対パスが必要です。');
  const handle = await fs.open(file, 'r');
  let bytes: Buffer;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 16 * 1024 * 1024) throw new Error('WAV too large');
    bytes = await handle.readFile();
  } finally {
    await handle.close();
  }
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE')
    throw new Error('Invalid WAV');
  return bytes;
}
/** Short notifications only. Empty selection is silent; no system beep fallback. */
export function queueSound(file: string, alive: () => boolean, failed: () => void): void {
  if (!file) return;
  if (!path.isAbsolute(file) || path.extname(file).toLowerCase() !== '.wav')
    throw new Error('通知音にはWAVの絶対パスが必要です。');
  if (pending >= 32) throw new Error('通知音の再生待ちが多すぎます。');
  if (!alive()) return;
  pending++;
  const controller = new AbortController();
  const watch = setInterval(() => {
    if (!alive()) controller.abort();
  }, 100);
  void (async () => {
    try {
      const bytes = await readWave(file);
      if (!alive() || controller.signal.aborted) return;
      await audioPlayback.play({
        bytes,
        signal: controller.signal,
        playbackTimeoutMs: 30000,
        beforePlay: () => {
          if (!alive()) controller.abort();
        },
      });
    } catch {
      if (alive() && !controller.signal.aborted) failed();
    } finally {
      clearInterval(watch);
      pending--;
    }
  })();
}
