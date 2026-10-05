import type { ExtensionManifest, Settings, SettingDefinition, SettingOption } from './contracts';
const object = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
export function parseSettingOptions(value: unknown): SettingOption[] {
  if (
    !Array.isArray(value) ||
    value.length > 128 ||
    value.some(
      (o) =>
        !object(o) ||
        typeof o.label !== 'string' ||
        !o.label ||
        o.label.length > 160 ||
        typeof o.value !== 'string' ||
        !o.value ||
        o.value.length > 256,
    ) ||
    new Set(value.map((o) => o.value)).size !== value.length
  )
    throw new Error('設定の選択肢は重複のないラベルと値の配列です。');
  return value.map((o) => ({ label: o.label, value: o.value }));
}
export function validateSettingValue(definition: SettingDefinition, value: unknown) {
  const fail = () => {
    throw new Error(`${definition.title} の値を確認してください。`);
  };
  if (definition.type === 'boolean' && typeof value !== 'boolean') fail();
  if (
    definition.type === 'number' &&
    (typeof value !== 'number' ||
      !Number.isFinite(value) ||
      (definition.minimum !== undefined && value < definition.minimum) ||
      (definition.maximum !== undefined && value > definition.maximum))
  )
    fail();
  if (definition.type === 'string' && (typeof value !== 'string' || value.length > 10000)) fail();
  if (
    definition.type === 'select' &&
    (typeof value !== 'string' ||
      !value ||
      value.length > 256 ||
      (!definition.dynamic && !definition.options?.some((o) => o.value === value)))
  )
    fail();
}
export function parseSettingDefinitions(value: unknown): SettingDefinition[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 128)
    throw new Error('settings の形式が正しくありません。');
  const keys = new Set<string>();
  return value.map((s) => {
    if (
      !object(s) ||
      typeof s.key !== 'string' ||
      !/^[a-zA-Z0-9._-]{1,100}$/.test(s.key) ||
      ['constructor', 'prototype', '__proto__'].includes(s.key) ||
      keys.has(s.key) ||
      typeof s.title !== 'string' ||
      !s.title ||
      s.title.length > 160 ||
      !['boolean', 'number', 'string', 'select'].includes(s.type) ||
      (s.description !== undefined &&
        (typeof s.description !== 'string' || s.description.length > 500))
    )
      throw new Error('settings の項目定義を確認してください。');
    keys.add(s.key);
    for (const key of ['minimum', 'maximum', 'step'])
      if (s[key] !== undefined && (typeof s[key] !== 'number' || !Number.isFinite(s[key])))
        throw new Error(`${s.title} の範囲が正しくありません。`);
    if (
      (s.minimum !== undefined && s.maximum !== undefined && s.minimum > s.maximum) ||
      (s.step !== undefined && s.step <= 0) ||
      (s.dynamic !== undefined && typeof s.dynamic !== 'boolean')
    )
      throw new Error(`${s.title} の範囲が正しくありません。`);
    const definition = {
      ...s,
      ...(s.type === 'select' ? { options: parseSettingOptions(s.options) } : {}),
    } as SettingDefinition;
    if (definition.default !== undefined) validateSettingValue(definition, definition.default);
    return definition;
  });
}
export function validateAppletSettings(value: Settings, applets: ExtensionManifest[]) {
  for (const applet of applets)
    for (const definition of applet.settings ?? []) {
      const saved = value.extensions[applet.id]?.settings[definition.key];
      if (saved !== undefined) validateSettingValue(definition, saved);
    }
}
