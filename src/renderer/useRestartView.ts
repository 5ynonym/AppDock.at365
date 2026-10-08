import { useLayoutEffect, useState } from 'react';

// Only navigation is retained. Settings drafts and Applet data have their own owners.
export function useRestartView<T extends string | boolean>(
  key: string,
  fallback: T,
  allowed?: readonly T[] | ((value: T) => boolean),
) {
  const storageKey = `appdock.restart-view.${key}`;
  const [value, setValue] = useState<T>(() => {
    if (new URLSearchParams(location.search).get('restoreView') !== '1') return fallback;
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      if (typeof saved !== typeof fallback) return fallback;
      if (typeof saved === 'string' && saved.length > 200) return fallback;
      return !allowed ||
        (typeof allowed === 'function' ? allowed(saved as T) : allowed.includes(saved as T))
        ? (saved as T)
        : fallback;
    } catch {
      return fallback;
    }
  });
  useLayoutEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // A disabled/full browser store must not prevent navigation.
    }
  }, [storageKey, value]);
  return [value, setValue] as const;
}
