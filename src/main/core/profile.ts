import fs from 'node:fs';
import path from 'node:path';
import { nativeImage } from 'electron';
import type { SettingsStore } from './settings';
import { validate } from './settings';
import { assetFilename } from '../../shared/asset-names';
export function saveUserSettings(
  store: SettingsStore,
  directory: string,
  value: unknown,
  revision: number,
  avatar?: Uint8Array | null,
  avatarName?: string,
) {
  const next = validate(value);
  if (avatar === undefined) return store.save(next, revision);
  if (avatar === null) {
    next.profile.avatar = null;
    return store.save(next, revision);
  }
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
  avatarName ??= isPng ? 'avatar.png' : 'avatar.jpg';
  if (
    !assetFilename(avatarName) ||
    !/\.(png|jpe?g)$/i.test(avatarName) ||
    isPng !== /\.png$/i.test(avatarName)
  )
    throw Error('画像の形式とファイル名を確認してください。');
  const root = path.join(directory, 'data', 'assets', 'profile');
  fs.mkdirSync(root, { recursive: true });
  if (fs.realpathSync(root).toLowerCase() !== path.resolve(root).toLowerCase())
    throw Error('アバター保存先が転送されています。');
  const found = fs.readdirSync(root).find((n) => n.toLowerCase() === avatarName.toLowerCase());
  const name = found || avatarName,
    target = path.join(root, name);
  const same = () => {
    if (fs.lstatSync(target).isSymbolicLink() || !fs.readFileSync(target).equals(bytes))
      throw Error(
        `「${name}」と同名の別画像が登録されています。名前を変えてから登録してください。`,
      );
  };
  if (found) same();
  next.profile.avatar = `data/assets/profile/${name}`;
  return store.save(next, revision, {
    commit: () => {
      try {
        fs.writeFileSync(target, bytes, { flag: 'wx' });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        same();
      }
    },
    rollback: () => {}, // Registered originals remain available even when settings save fails.
  });
}
