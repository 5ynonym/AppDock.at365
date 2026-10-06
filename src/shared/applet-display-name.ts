import type { ExtensionManifest } from './contracts';

/** Presentation only: manifest names and IDs remain unchanged. */
export function appletDisplayName(
  manifest: Pick<ExtensionManifest, 'name' | 'displayName'>,
): string {
  const explicit = manifest.displayName?.trim();
  if (explicit) return explicit;
  const name = manifest.name.trim();
  return name.replace(/^Applet\./, '').trim() || name;
}
