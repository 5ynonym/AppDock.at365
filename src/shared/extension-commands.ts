import type { Command } from './contracts';

export function parseExtensionCommands(id: string, value: unknown): Command[] {
  if (!Array.isArray(value) || value.length > 100)
    throw new Error('コマンド登録は100件以下の配列です。');
  const seen = new Set<string>();
  return value.map((command) => {
    if (!command || typeof command !== 'object' || typeof command.id !== 'string'
      || !command.id.startsWith(id + '.') || command.id.length > 200
      || typeof command.title !== 'string' || !command.title.trim() || command.title.length > 200
      || seen.has(command.id)) throw new Error('コマンド登録の形式が正しくありません。');
    seen.add(command.id);
    return { id: command.id, title: command.title };
  });
}
