import type { ExtensionSnapshot, Settings } from './contracts';

export const widgetAnchors = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
] as const;
export interface WidgetPlacement {
  home: boolean;
  order: number;
  desktop: boolean;
  monitor: string;
  layer: 'front' | 'desktop';
  position: 'anchor' | 'free';
  anchor: (typeof widgetAnchors)[number];
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  opacity: number;
  color: string;
}
export interface WidgetContent {
  kind: 'clock' | 'date' | 'text';
  showSeconds?: boolean;
  locale?: string;
  timeZone?: string;
  body?: string;
  facts?: { label: string; value: string }[];
}
export interface WidgetDefinition {
  id: string;
  title: string;
  description?: string;
  content: WidgetContent;
  fontFile?: string;
  fontUrl?: string;
  initialPlacement?: Partial<WidgetPlacement>;
}
export interface WidgetSnapshot extends WidgetDefinition {
  extensionId: string;
  extensionName: string;
  available: boolean;
  placement: WidgetPlacement;
}
export interface WidgetDisplay {
  id: string;
  label: string;
  primary: boolean;
  bounds: { x: number; y: number; width: number; height: number };
}
export const defaultWidgetPlacement = (): WidgetPlacement => ({
  home: false,
  order: 0,
  desktop: false,
  monitor: 'primary',
  layer: 'front',
  position: 'anchor',
  anchor: 'top-right',
  x: 20,
  y: 20,
  width: 360,
  height: 160,
  fontSize: 80,
  opacity: 0.8,
  color: '#ffffff',
});
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export const validWidgetId = (id: unknown): id is string =>
  typeof id === 'string' &&
  /^[a-z0-9][a-z0-9.-]{0,199}$/.test(id) &&
  !['constructor', 'prototype', '__proto__'].includes(id);
export function parseWidgetPlacement(value: unknown): WidgetPlacement {
  if (!object(value)) throw new Error('ウィジェットの配置設定はオブジェクトです。');
  const p = { ...defaultWidgetPlacement(), ...value };
  if (
    typeof p.home !== 'boolean' ||
    typeof p.desktop !== 'boolean' ||
    typeof p.monitor !== 'string' ||
    !p.monitor ||
    p.monitor.length > 256 ||
    !['front', 'desktop'].includes(p.layer) ||
    !['anchor', 'free'].includes(p.position) ||
    !widgetAnchors.includes(p.anchor) ||
    typeof p.color !== 'string' ||
    !/^#[0-9a-f]{6}$/i.test(p.color)
  )
    throw new Error('ウィジェットの表示先・位置・色が正しくありません。');
  const limits = {
    order: [0, 9999],
    x: [-32000, 32000],
    y: [-32000, 32000],
    width: [120, 7680],
    height: [60, 4320],
    fontSize: [12, 720],
    opacity: [0.05, 1],
  };
  for (const [key, [min, max]] of Object.entries(limits)) {
    const v = p[key as keyof WidgetPlacement];
    if (
      typeof v !== 'number' ||
      !Number.isFinite(v) ||
      v < min ||
      v > max ||
      (key === 'order' && !Number.isInteger(v))
    )
      throw new Error(`ウィジェットの ${key} は ${min}～${max} です。`);
  }
  return Object.fromEntries(
    Object.keys(defaultWidgetPlacement()).map((key) => [key, p[key as keyof WidgetPlacement]]),
  ) as unknown as WidgetPlacement;
}
export function parseWidgetSettings(value: unknown): Record<string, WidgetPlacement> {
  if (value === undefined) return {};
  if (!object(value) || Object.keys(value).length > 500)
    throw new Error('widgets は500件以内の配置設定です。');
  return Object.fromEntries(
    Object.entries(value).map(([id, p]) => {
      if (!validWidgetId(id)) throw new Error('ウィジェットIDが正しくありません。');
      return [id, parseWidgetPlacement(p)];
    }),
  );
}
export function parseWidgetDefinitions(extensionId: string, value: unknown): WidgetDefinition[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 16 || JSON.stringify(value).length > 128000)
    throw new Error('Appletのウィジェットは16件・128KB以内です。');
  const ids = new Set<string>();
  return value.map((v) => {
    if (
      !object(v) ||
      !validWidgetId(v.id) ||
      !v.id.startsWith(extensionId + '.') ||
      ids.has(v.id) ||
      typeof v.title !== 'string' ||
      !v.title.trim() ||
      v.title.length > 100 ||
      (v.description != null &&
        (typeof v.description !== 'string' || v.description.length > 1000)) ||
      !object(v.content) ||
      !['clock', 'date', 'text'].includes(String(v.content.kind))
    )
      throw new Error('ウィジェットの定義が正しくありません。');
    ids.add(v.id);
    const c = v.content;
    if (
      (c.showSeconds != null && typeof c.showSeconds !== 'boolean') ||
      (c.body != null && (typeof c.body !== 'string' || c.body.length > 4000)) ||
      (c.facts != null &&
        (!Array.isArray(c.facts) ||
          c.facts.length > 20 ||
          c.facts.some(
            (f) =>
              !object(f) ||
              typeof f.label !== 'string' ||
              typeof f.value !== 'string' ||
              f.label.length > 200 ||
              f.value.length > 1000,
          )))
    )
      throw new Error('ウィジェットの内容が正しくありません。');
    for (const key of ['locale', 'timeZone'])
      if (c[key] != null && (typeof c[key] !== 'string' || !c[key] || c[key].length > 100))
        throw new Error('日時の地域設定が正しくありません。');
    try {
      new Intl.DateTimeFormat((c.locale ?? undefined) as string | undefined, {
        timeZone: (c.timeZone ?? undefined) as string | undefined,
      });
    } catch {
      throw new Error('日時の地域・タイムゾーンが正しくありません。');
    }
    if (
      v.fontFile != null &&
      (typeof v.fontFile !== 'string' ||
        !/^[a-zA-Z0-9_./-]{1,200}\.(ttf|woff2)$/i.test(v.fontFile) ||
        v.fontFile.includes('..') ||
        v.fontFile.startsWith('/'))
    )
      throw new Error('フォントはApplet内の相対パスです。');
    return {
      id: v.id,
      title: v.title.trim(),
      description: v.description as string | undefined,
      content: {
        kind: c.kind as WidgetContent['kind'],
        showSeconds: c.showSeconds as boolean | undefined,
        locale: (c.locale ?? undefined) as string | undefined,
        timeZone: (c.timeZone ?? undefined) as string | undefined,
        body: c.body as string | undefined,
        facts: c.facts as WidgetContent['facts'],
      },
      fontFile: v.fontFile as string | undefined,
      initialPlacement:
        v.initialPlacement == null ? undefined : parseWidgetPlacement(v.initialPlacement),
    };
  });
}
export function widgetCatalog(
  extensions: ExtensionSnapshot[],
  settings: Settings,
): WidgetSnapshot[] {
  return extensions
    .flatMap((e) =>
      (e.widgets ?? []).map((w) => ({
        ...w,
        extensionId: e.id,
        extensionName: e.displayName,
        available: e.state === 'running',
        placement: settings.widgets[w.id] ?? defaultWidgetPlacement(),
      })),
    )
    .sort((a, b) => a.placement.order - b.placement.order || a.id.localeCompare(b.id));
}
// Electron screen coordinates and sizes are DIP, including negative monitor origins.
export function widgetBounds(p: WidgetPlacement, display: WidgetDisplay['bounds']) {
  const width = Math.round(Math.min(p.width, display.width));
  const height = Math.round(Math.min(p.height, display.height));
  const horizontal = p.anchor.includes('left')
    ? 0
    : p.anchor.includes('right') || p.anchor === 'right'
      ? 1
      : 0.5;
  const vertical = p.anchor.startsWith('top') ? 0 : p.anchor.startsWith('bottom') ? 1 : 0.5;
  const x =
    p.position === 'free'
      ? p.x
      : (display.width - width) * horizontal + p.x * (horizontal === 1 ? -1 : 1);
  const y =
    p.position === 'free'
      ? p.y
      : (display.height - height) * vertical + p.y * (vertical === 1 ? -1 : 1);
  return {
    x: display.x + Math.round(Math.max(0, Math.min(display.width - width, x))),
    y: display.y + Math.round(Math.max(0, Math.min(display.height - height, y))),
    width,
    height,
  };
}
export function selectWidgetDisplay(displays: WidgetDisplay[], monitor: string) {
  return displays.find((d) => d.id === monitor) ?? displays.find((d) => d.primary) ?? displays[0];
}
