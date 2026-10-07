import type { WidgetContent } from './widgets';
export function widgetDateText(date: Date, content: WidgetContent) {
  const parts = new Intl.DateTimeFormat(content.locale ?? 'en-US', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    timeZone: content.timeZone,
  }).formatToParts(date);
  const get = (name: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === name)?.value ?? '';
  return `${get('month')}/${get('day')} ${get('weekday')}`;
}
export interface InkMetrics {
  left: number;
  right: number;
  ascent: number;
  descent: number;
  advance: number;
}
export type MeasureInk = (text: string, size: number) => InkMetrics;
export interface PositionedGlyph {
  text: string;
  x: number;
  y: number;
  size: number;
}
export function clockTypography(value: string, size: number, measure: MeasureInk) {
  // Shape whole text runs so proportional advances and kerning remain native to the font.
  const main = measure(value.slice(0, 5), size);
  const runs = [{ text: value.slice(0, 5), x: 0, y: 0, size, metrics: main }];
  if (value.length > 5) {
    const seconds = measure(value.slice(5), size / 2);
    runs.push({
      text: value.slice(5),
      x: main.advance,
      y: main.descent - seconds.descent,
      size: size / 2,
      metrics: seconds,
    });
  }
  const left = Math.min(...runs.map((r) => r.x - r.metrics.left));
  const right = Math.max(...runs.map((r) => r.x + r.metrics.right));
  const top = Math.min(...runs.map((r) => r.y - r.metrics.ascent));
  const bottom = Math.max(...runs.map((r) => r.y + r.metrics.descent));
  return {
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
    glyphs: runs.map(({ text, x, y, size }): PositionedGlyph => ({
      text,
      x: x - left,
      y: y - top,
      size,
    })),
  };
}
export function dateTypography(text: string, size: number, measure: MeasureInk) {
  const m = measure(text, size);
  return {
    width: Math.max(1, m.left + m.right),
    height: Math.max(1, m.ascent + m.descent),
    glyphs: [{ text, x: m.left, y: m.ascent, size }],
  };
}
