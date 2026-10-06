import type { ExtensionManifest, Settings, SettingDefinition, SettingOption } from './contracts';
import { readObjectList, objectFieldValue } from './object-list';
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
    definition.type === 'string-list' &&
    (!Array.isArray(value) ||
      value.length > 64 ||
      value.some((item) => typeof item !== 'string' || !item.trim() || item.length > 32767))
  )
    fail();
  if (definition.type === 'object-list') {
    let items: Record<string, unknown>[];
    try {
      items = readObjectList(value);
    } catch {
      fail();
      return;
    }
    for (const item of items)
      for (const field of definition.fields ?? []) {
        let fieldValue: unknown;
        try {
          fieldValue = objectFieldValue(item, field);
        } catch {
          fail();
          return;
        }
        if (fieldValue !== undefined) validateSettingValue(field, fieldValue);
      }
  }
  if (definition.type === 'json') {
    if (typeof value !== 'string' || value.length > 10000) {
      fail();
      return;
    }
    try {
      JSON.parse(value);
    } catch {
      fail();
    }
  }
  if (definition.type === 'shortcut-list') {
    if (!Array.isArray(value) || value.length > 32) {
      fail();
      return;
    }
    const ids = new Set<string>();
    for (const entry of value) {
      if (
        !object(entry) ||
        typeof entry.id !== 'string' ||
        !/^[a-z0-9][a-z0-9-]{0,39}$/.test(entry.id) ||
        ids.has(entry.id) ||
        typeof entry.title !== 'string' ||
        !entry.title.trim() ||
        entry.title.length > 100 ||
        typeof entry.keys !== 'string' ||
        !validSendKeys(entry.keys)
      ) {
        fail();
        return;
      }
      ids.add(entry.id);
    }
  }
  if (
    definition.type === 'select' &&
    (typeof value !== 'string' ||
      !value ||
      value.length > 256 ||
      (!definition.dynamic && !definition.options?.some((o) => o.value === value)))
  )
    fail();
}
export function parseSettingDefinitions(
  value: unknown,
  depth = 0,
): SettingDefinition[] | undefined {
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
      ![
        'boolean',
        'number',
        'string',
        'json',
        'select',
        'shortcut-list',
        'string-list',
        'object-list',
      ].includes(s.type) ||
      (s.description !== undefined &&
        (typeof s.description !== 'string' || s.description.length > 500))
    )
      throw new Error('settings の項目定義を確認してください。');
    keys.add(s.key);
    if (
      (s.type === 'object-list' && (depth > 0 || !Array.isArray(s.fields) || !s.fields.length)) ||
      (depth === 0 && s.type === 'string-list') ||
      (depth > 0 && ['object-list', 'shortcut-list', 'json'].includes(s.type)) ||
      (s.itemTitle !== undefined &&
        (typeof s.itemTitle !== 'string' || s.itemTitle.length > 100)) ||
      (s.format !== undefined && s.format !== 'directory') ||
      (s.numericOptions !== undefined && typeof s.numericOptions !== 'boolean') ||
      (s.aliases !== undefined &&
        (!Array.isArray(s.aliases) ||
          s.aliases.length > 8 ||
          s.aliases.some(
            (alias: unknown) =>
              typeof alias !== 'string' ||
              !/^[A-Za-z0-9._-]{1,100}$/.test(alias) ||
              ['__proto__', 'prototype', 'constructor'].includes(alias),
          )))
    )
      throw new Error('一覧設定の項目定義を確認してください。');
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
      ...(s.type === 'object-list' ? { fields: parseSettingDefinitions(s.fields, depth + 1) } : {}),
    } as SettingDefinition;
    if (definition.default !== undefined) validateSettingValue(definition, definition.default);
    return definition;
  });
}

export function validSendKeys(value: string): boolean {
  const parts = value.split('+').map((part) => part.trim().toUpperCase());
  const key = parts.pop() ?? '';
  const modifiers = parts.map(
    (part) => ({ CONTROL: 'CTRL', WINDOWS: 'WIN', META: 'WIN' })[part] ?? part,
  );
  return (
    value.length <= 100 &&
    modifiers.every((part) => ['CTRL', 'ALT', 'SHIFT', 'WIN'].includes(part)) &&
    new Set(modifiers).size === modifiers.length &&
    /^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|ENTER|TAB|ESC|ESCAPE|SPACE|BACKSPACE|DELETE|INSERT|HOME|END|PAGEUP|PAGEDOWN|LEFT|RIGHT|UP|DOWN)$/.test(
      key,
    )
  );
}
export function validateAppletSettings(value: Settings, applets: ExtensionManifest[]) {
  for (const applet of applets)
    for (const definition of applet.settings ?? []) {
      const saved = value.extensions[applet.id]?.settings[definition.key];
      if (saved !== undefined) validateSettingValue(definition, saved);
    }
}
