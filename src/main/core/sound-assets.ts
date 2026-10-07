import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { readWave } from './sounds';

export function managedSound(root: string, file: string): boolean {
  return (
    path.dirname(path.resolve(file)).toLowerCase() === path.resolve(root, 'sounds').toLowerCase() &&
    /^[a-f0-9]{64}\.wav$/.test(path.basename(file))
  );
}
export async function importSound(root: string, source: string): Promise<string> {
  const bytes = await readWave(source);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const directory = path.join(root, 'sounds');
  await fs.mkdir(directory, { recursive: true });
  const target = path.join(directory, hash + '.wav');
  try {
    const current = await readWave(target);
    if (createHash('sha256').update(current).digest('hex') === hash) return target;
  } catch {}
  const temp = path.join(directory, hash + '.' + randomUUID() + '.tmp');
  try {
    await fs.writeFile(temp, bytes, { flag: 'wx' });
    await fs.rename(temp, target);
  } finally {
    await fs.unlink(temp).catch(() => {});
  }
  return target;
}
export async function pruneSounds(root: string, files: string[]): Promise<void> {
  const directory = path.join(root, 'sounds');
  const keep = new Set(files.map((file) => path.resolve(file).toLowerCase()));
  let entries: string[];
  try {
    entries = await fs.readdir(directory);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!/^[a-f0-9]{64}\.wav$/.test(entry)) continue;
    const file = path.join(directory, entry);
    if (!keep.has(path.resolve(file).toLowerCase())) await fs.unlink(file).catch(() => {});
  }
}
