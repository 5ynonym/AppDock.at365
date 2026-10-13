const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
/** Merge only edited fields. Concurrent writes to the same field require fresh input. Arrays are atomic. */
export function mergeSettingsInput<T>(before: T, next: T, current: T): T {
  const check = (v: unknown) => {
    const text = JSON.stringify(v, (_k, p) => {
      if (
        (typeof p === 'number' && !Number.isFinite(p)) ||
        typeof p === 'function' ||
        typeof p === 'symbol' ||
        typeof p === 'bigint'
      )
        throw Error('設定値が不正です。');
      return p;
    });
    if (!text || new TextEncoder().encode(text).length > 1024 * 1024)
      throw Error('設定は1MB以下にしてください。');
  };
  check(before);
  check(next);
  const merge = (a: unknown, b: unknown, c: unknown): unknown => {
    if (equal(a, b)) return structuredClone(c);
    if (object(a) && object(b) && object(c)) {
      const result = { ...c };
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (['__proto__', 'constructor', 'prototype'].includes(key))
          throw Error('設定キーが不正です。');
        if (!equal(a[key], b[key])) {
          const part = merge(a[key], b[key], c[key]);
          if (part === undefined) delete result[key];
          else result[key] = part;
        }
      }
      return result;
    }
    if (!equal(c, a) && !equal(c, b))
      throw Error('同じ設定が別の場所で変わりました。再読み込みして入力し直してください。');
    return structuredClone(b);
  };
  return merge(before, next, current) as T;
}
