import type { SettingDefinition } from './contracts';

export function readObjectList(value: unknown): Record<string, unknown>[] {
  const list = typeof value === 'string' ? JSON.parse(value) : value;
  if (
    !Array.isArray(list) ||
    list.length > 64 ||
    list.some((item) => !item || typeof item !== 'object' || Array.isArray(item))
  )
    throw new Error('設定は64件以内の項目の配列です。');
  return list;
}
export function objectFieldValue(item: Record<string, unknown>, field: SettingDefinition): unknown {
  const value = Object.hasOwn(item, field.key) ? item[field.key] : field.default;
  if (field.type === 'string-list') {
    if (
      value !== undefined &&
      (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
    )
      throw new Error(`${field.title} はフォルダーの一覧です。`);
    const strings = Array.isArray(value) ? [...value] : [];
    for (const alias of field.aliases ?? []) {
      const previous = item[alias];
      if (typeof previous === 'string' && previous.trim() && !strings.includes(previous))
        strings.push(previous);
    }
    return strings;
  }
  if (value === null) return field.default;
  if (field.type === 'select' && field.numericOptions && typeof value === 'number')
    return field.options?.[value]?.value ?? value;
  return value;
}
export function normalizeObject(
  item: Record<string, unknown>,
  fields: SettingDefinition[],
): Record<string, unknown> {
  const result = { ...item };
  for (const field of fields) {
    const value = objectFieldValue(item, field);
    if (value !== undefined) result[field.key] = value;
    for (const alias of field.aliases ?? []) delete result[alias];
  }
  return result;
}
