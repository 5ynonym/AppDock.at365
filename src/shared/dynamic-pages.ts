import type { ExtensionManifest } from './contracts';
import { validPageId, type AppletPageDefinition } from './applet-pages';

export interface DynamicPageDefinition extends AppletPageDefinition {
  context?: Record<string, unknown>;
}

export function dynamicPageCommand(owner: string, id: string) {
  return `${owner}.pages.${id}.open`;
}

/** Validate the complete replacement before changing any live resources. */
export function parseDynamicPages(
  manifest: ExtensionManifest,
  value: unknown,
): DynamicPageDefinition[] {
  if (!manifest.capabilities?.includes('pages') || !manifest.capabilities.includes('dynamic-pages'))
    throw Error('pagesとdynamic-pages capabilityが必要です。');
  if (!Array.isArray(value) || value.length > 64)
    throw Error('動的ページは64件以下の配列で指定してください。');
  const ids = new Set((manifest.pages ?? []).map((page) => page.id));
  return value.map((raw) => {
    if (
      !raw ||
      typeof raw !== 'object' ||
      Array.isArray(raw) ||
      Object.keys(raw).some(
        (key) =>
          !['id', 'title', 'source', 'ui', 'icon', 'defaultDisplay', 'context'].includes(key),
      ) ||
      !validPageId(raw.id) ||
      ids.has(raw.id) ||
      typeof raw.title !== 'string' ||
      !raw.title.trim() ||
      raw.title.length > 80 ||
      /[\x00-\x1f\x7f]/.test(raw.title) ||
      raw.source !== 'local' ||
      typeof raw.ui !== 'string' ||
      !raw.ui ||
      !/\.html$/i.test(raw.ui) ||
      (raw.icon !== undefined &&
        !['mail', 'clock', 'image', 'folder', 'extensions'].includes(raw.icon)) ||
      (raw.defaultDisplay !== undefined && !['page', 'window'].includes(raw.defaultDisplay))
    )
      throw Error('動的ページのID・名前・表示内容を確認してください。');
    if (
      raw.context !== undefined &&
      (!raw.context ||
        typeof raw.context !== 'object' ||
        Array.isArray(raw.context) ||
        new TextEncoder().encode(JSON.stringify(raw.context)).length > 16384)
    )
      throw Error('ページのcontextは16KB以下のオブジェクトで指定してください。');
    const openCommand = dynamicPageCommand(manifest.id, raw.id);
    if (
      openCommand.length > 200 ||
      manifest.commands?.some((command) => command.id === openCommand || command.aliases?.includes(openCommand))
    )
      throw Error('ページ操作のIDが既存コマンドと重複しています。');
    ids.add(raw.id);
    return { ...structuredClone(raw), title: raw.title.trim(), openCommand };
  });
}
