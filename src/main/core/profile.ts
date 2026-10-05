import fs from 'node:fs';
import path from 'node:path';
import { nativeImage } from 'electron';
import type { SettingsStore } from './settings';
import { atomicWrite, validate } from './settings';
export function saveUserSettings(
  store: SettingsStore,
  directory: string,
  value: unknown,
  revision: number,
  avatar?: Uint8Array | null,
) {
  const next = validate(value);
  if (avatar === undefined) return store.save(next, revision);
  const file = path.join(directory, 'avatar.png');
  let png: Buffer | null = null;
  if (avatar !== null) {
    if (
      !(avatar instanceof Uint8Array) ||
      avatar.byteLength === 0 ||
      avatar.byteLength > 5 * 1024 * 1024
    )
      throw new Error('画像は5MB以下のPNGまたはJPEGを選んでください。');
    const bytes = Buffer.from(avatar);
    const isPng = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!isPng && !isJpeg) throw new Error('PNGまたはJPEG画像を選んでください。');
    const image = nativeImage.createFromBuffer(bytes);
    const { width, height } = image.getSize();
    if (image.isEmpty() || width > 8192 || height > 8192 || width * height > 16 * 1024 * 1024)
      throw new Error('画像を読み込めません。画像サイズを小さくして試してください。');
    const scale = Math.min(1, 256 / width, 256 / height);
    png = image
      .resize({
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        quality: 'best',
      })
      .toPNG();
    next.profile.avatar = 'avatar.png';
  } else next.profile.avatar = null;
  const previous = fs.existsSync(file) ? fs.readFileSync(file) : null;
  return store.save(next, revision, {
    commit: () => {
      if (png) atomicWrite(file, png);
      else if (fs.existsSync(file)) fs.unlinkSync(file);
    },
    rollback: () => {
      if (previous) atomicWrite(file, previous);
      else if (fs.existsSync(file)) fs.unlinkSync(file);
    },
  });
}
