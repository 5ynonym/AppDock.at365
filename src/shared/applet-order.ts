/** Display order only: never reorder lifecycle or keybinding dispatch arrays. */
export function orderApplets<T extends { id: string }>(
  applets: readonly T[],
  order: readonly string[],
) {
  const byId = new Map(applets.map((applet) => [applet.id, applet]));
  const result: T[] = [];
  for (const id of order) {
    const applet = byId.get(id);
    if (applet) {
      result.push(applet);
      byId.delete(id);
    }
  }
  return [...result, ...byId.values()];
}

export function moveApplet(order: readonly string[], id: string, target: string) {
  const from = order.indexOf(id),
    to = order.indexOf(target);
  if (from < 0 || to < 0 || from === to) return [...order];
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}
