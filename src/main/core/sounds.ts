import fs from 'node:fs/promises';
import path from 'node:path';
import { BrowserWindow, shell } from 'electron';

let queue: Promise<void> = Promise.resolve();
let pending = 0;
/** Short notifications only. No shell commands, remote URLs or persistent renderer. */
export function queueSound(file: string, alive: () => boolean, failed: () => void): void {
  if (file && (!path.isAbsolute(file) || path.extname(file).toLowerCase() !== '.wav'))
    throw new Error('通知音にはWAVの絶対パスが必要です。');
  if (pending >= 32) throw new Error('通知音の再生待ちが多すぎます。');
  pending++;
  queue = queue
    .then(async () => {
      if (!alive()) return;
      if (!file) {
        shell.beep();
        return;
      }
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
      if (!alive()) return;
      const player = new BrowserWindow({
        show: false,
        webPreferences: {
          sandbox: true,
          nodeIntegration: false,
          contextIsolation: true,
          spellcheck: false,
          backgroundThrottling: false,
          autoplayPolicy: 'no-user-gesture-required',
        },
      });
      const watch = setInterval(() => {
        if (!alive() && !player.isDestroyed()) player.destroy();
      }, 250);
      const deadline = setTimeout(() => {
        if (!player.isDestroyed()) player.destroy();
      }, 30000);
      try {
        await player.loadURL(
          'data:text/html,' +
            encodeURIComponent(
              '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; media-src data:"><title>AppDock Audio</title>',
            ),
        );
        await player.webContents.executeJavaScript(`new Promise((resolve, reject) => {
        const sound = new Audio(${JSON.stringify('data:audio/wav;base64,' + bytes.toString('base64'))});
        sound.onended = () => resolve(true); sound.onerror = () => reject(new Error('Audio failed'));
        sound.play().catch(reject);
      })`);
      } finally {
        clearInterval(watch);
        clearTimeout(deadline);
        if (!player.isDestroyed()) player.destroy();
      }
    })
    .catch(() => {
      if (alive()) failed();
    })
    .finally(() => {
      pending--;
    });
}
