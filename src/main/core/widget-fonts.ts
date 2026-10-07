import fs from 'node:fs';
import path from 'node:path';
import type { WidgetDefinition } from '../../shared/widgets';
export function widgetFontPath(folder: string, widget: WidgetDefinition) {
  if (!widget.fontFile) return undefined;
  const root = fs.realpathSync(folder);
  const file = fs.realpathSync(path.resolve(root, widget.fontFile));
  const relative = path.relative(root, file);
  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    !/\.(ttf|woff2)$/i.test(file) ||
    !fs.statSync(file).isFile() ||
    fs.statSync(file).size > 5 * 1024 * 1024
  )
    throw new Error('ウィジェットのフォントはApplet内の5MB以下のファイルです。');
  return file;
}
export function registerWidgetFonts(folder: string, widgets: WidgetDefinition[]) {
  return widgets.map((w) => ({
    ...w,
    fontUrl: widgetFontPath(folder, w) ? `appdock://host/widget-fonts/${w.id}` : undefined,
  }));
}
