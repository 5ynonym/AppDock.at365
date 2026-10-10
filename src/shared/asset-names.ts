export function assetFilename(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 180 &&
    !/[\\/:*?"<>|\x00-\x1f\x7f]/.test(value) &&
    !/[. ]$/.test(value) &&
    value !== '.' &&
    value !== '..' &&
    !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(value)
  );
}
export function avatarReference(value: unknown): value is string {
  if (value === 'avatar.png') return true;
  const prefixes = [
    'data/assets/profile/',
    'data/assets/appdock/avatars/',
    '.appdock/assets/profile/',
    '.appdock/assets/appdock/avatars/',
  ];
  return (
    typeof value === 'string' &&
    prefixes.some(
      (prefix) => value.startsWith(prefix) && assetFilename(value.slice(prefix.length)),
    ) &&
    /\.(png|jpe?g)$/i.test(value)
  );
}
