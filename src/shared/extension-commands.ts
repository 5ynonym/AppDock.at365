import type { Command, DeclaredCommand } from './contracts';

export function parseDeclaredCommands(id: string, value: unknown): DeclaredCommand[] | undefined {
  if (value === undefined) return undefined;
  const commands = parseExtensionCommands(id, value);
  const ids = new Set(commands.map((command) => command.id));
  return commands.map((command, index) => {
    const declaration = (value as Record<string, unknown>[])[index];
    if (
      declaration.activateOnExecute !== undefined &&
      typeof declaration.activateOnExecute !== 'boolean'
    )
      throw new Error('activateOnExecute はtrue / falseで指定してください。');
    const aliases = declaration.aliases;
    if (aliases !== undefined) {
      if (!Array.isArray(aliases) || aliases.length > 8)
        throw new Error('コマンドの別名は8件以内です。');
      for (const alias of aliases) {
        if (
          typeof alias !== 'string' ||
          !alias.startsWith(id + '.') ||
          alias.length > 200 ||
          ids.has(alias)
        )
          throw new Error('コマンドの別名が重複しているか形式が不正です。');
        ids.add(alias);
      }
    }
    return {
      ...command,
      ...(aliases !== undefined ? { aliases: aliases as string[] } : {}),
      ...(declaration.activateOnExecute !== undefined
        ? { activateOnExecute: declaration.activateOnExecute as boolean }
        : {}),
    };
  });
}

export function parseExtensionCommands(id: string, value: unknown): Command[] {
  if (!Array.isArray(value) || value.length > 100)
    throw new Error('コマンド登録は100件以下の配列です。');
  const seen = new Set<string>();
  return value.map((command) => {
    if (
      !command ||
      typeof command !== 'object' ||
      typeof command.id !== 'string' ||
      !command.id.startsWith(id + '.') ||
      command.id.length > 200 ||
      typeof command.title !== 'string' ||
      !command.title.trim() ||
      command.title.length > 200 ||
      seen.has(command.id)
    )
      throw new Error('コマンド登録の形式が正しくありません。');
    seen.add(command.id);
    return { id: command.id, title: command.title };
  });
}
