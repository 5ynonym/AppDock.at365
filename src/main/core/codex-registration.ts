import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
// smol-toml exports a CJS build, but shares its ESM declaration file.
const { parse }: { parse(text: string): Record<string, unknown> } = require('smol-toml');
import { atomicWrite } from './settings';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
export function codexServerName(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value)
  )
    throw Error('登録名は英字で始まる64文字以内の英数字・ハイフン・アンダースコアです。');
  return value;
}
function blockName(block: string): string {
  const names = Object.keys(parsed(block).mcp_servers ?? {});
  if (names.length !== 1) throw Error('AppDockの登録範囲を確認してください。');
  return codexServerName(names[0]);
}
export function codexConfigPath(file: unknown): string {
  if (
    typeof file !== 'string' ||
    !path.isAbsolute(file) ||
    path.basename(file).toLowerCase() !== 'config.toml'
  )
    throw Error('Codexのconfig.tomlを絶対パスで指定してください。');
  return path.resolve(file);
}
function read(file: string) {
  if (!fs.existsSync(file)) return '';
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024)
    throw Error('Codex設定ファイルを安全に読み取れません。');
  return fs.readFileSync(file, 'utf8');
}
function parsed(text: string): any {
  try {
    return parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw Error('Codex設定のTOMLを読み取れません。設定を確認してください。');
  }
}
function range(text: string, id: string) {
  const start = `# BEGIN AppDock MCP ${id}`;
  const end = `# END AppDock MCP ${id}`;
  const a = text.indexOf(start),
    b = text.indexOf(end);
  if (a < 0 && b < 0) return null;
  if (
    a < 0 ||
    b < a ||
    text.indexOf(start, a + start.length) >= 0 ||
    text.indexOf(end, b + end.length) >= 0 ||
    (a > 0 && text[a - 1] !== '\n')
  )
    throw Error('AppDockの登録範囲が変更されています。手動で確認してください。');
  let finish = b + end.length;
  if (text.slice(finish, finish + 2) === '\r\n') finish += 2;
  else if (text[finish] === '\n') finish++;
  return { a, b: finish, block: text.slice(a, finish) };
}
export function registrationBlock(id: string, endpoint: string, token: string, name = 'AppDock') {
  codexServerName(name);
  if (
    !/^appdock_[a-f0-9]{16}$/.test(id) ||
    !/^http:\/\/127\.0\.0\.1:\d+\/mcp$/.test(endpoint) ||
    !/^[a-f0-9]{64}$/.test(token)
  )
    throw Error('登録情報が不正です。');
  return `# BEGIN AppDock MCP ${id}\n[mcp_servers.${name}]\nurl = "${endpoint}"\nenabled = true\nrequired = false\nhttp_headers = { Authorization = "Bearer ${token}" }\n# END AppDock MCP ${id}\n`;
}
export function registrationStatus(
  file: string,
  id: string,
  expectedBlock: string,
  ownedHash?: string,
) {
  try {
    const text = read(codexConfigPath(file)),
      config = parsed(text),
      r = range(text, id),
      name = blockName(expectedBlock);
    if (!r && !config.mcp_servers?.[name]) return { registration: 'absent' as const };
    if (
      r &&
      r.block === expectedBlock &&
      isDeepStrictEqual(config.mcp_servers?.[name], parsed(expectedBlock).mcp_servers[name])
    )
      return { registration: 'registered' as const };
    return {
      registration: 'conflict' as const,
      registrationError:
        r && hash(r.block) === ownedHash
          ? blockName(r.block) !== name
            ? '登録名が変わっています。一度登録を解除してから登録し直してください。'
            : '接続先または認証情報が変わっています。登録を修復してください。'
          : !r && config.mcp_servers?.[name]
            ? '同じ登録名が使われています。接続の詳細で別の登録名を指定してください。'
            : '既存の登録内容が変更されています。上書きせず設定を確認してください。',
    };
  } catch (e) {
    return { registration: 'conflict' as const, registrationError: (e as Error).message };
  }
}
export function changeRegistration(
  file: string,
  id: string,
  block: string,
  ownedHash: string | undefined,
  remove = false,
) {
  file = codexConfigPath(file);
  const before = read(file),
    config = parsed(before),
    r = range(before, id),
    name = blockName(block);
  if (r && r.block !== block && hash(r.block) !== ownedHash)
    throw Error('登録内容が外部で変更されています。上書きせず確認してください。');
  if (remove && !r) return undefined;
  const previousName = r ? blockName(r.block) : undefined;
  if (!remove && previousName && previousName !== name)
    throw Error('登録名を変える場合は、一度登録を解除してから登録し直してください。');
  const without = r ? before.slice(0, r.a) + before.slice(r.b) : before;
  // A marker inside a TOML string, or keys appended into our table, must not erase unrelated data.
  const stripped = parsed(without),
    expected = parsed(before);
  if (expected.mcp_servers) {
    if (previousName) delete expected.mcp_servers[previousName];
    if (!Object.keys(expected.mcp_servers).length) delete expected.mcp_servers;
  }
  if (stripped.mcp_servers && !Object.keys(stripped.mcp_servers).length)
    delete stripped.mcp_servers;
  if (!isDeepStrictEqual(expected, stripped))
    throw Error('登録範囲に他の設定があります。手動で確認してください。');
  if (!remove && stripped.mcp_servers?.[name])
    throw Error('同じ登録名が使われています。接続の詳細で別の登録名を指定してください。');
  const next = remove
    ? without
    : without + (without.endsWith('\n') || !without ? '' : '\n') + block;
  const nextConfig = parsed(next);
  if (
    !remove &&
    !isDeepStrictEqual(nextConfig.mcp_servers?.[name], parsed(block).mcp_servers[name])
  )
    throw Error('Codex設定へ登録できません。');
  if (read(file) !== before) throw Error('Codex設定が変更されました。再読み込みしてください。');
  // Preserve an exact recovery copy, never restore the entire file on unregister.
  if (before) atomicWrite(file + '.appdock-backup', before);
  atomicWrite(file, next);
  return remove ? undefined : hash(block);
}
