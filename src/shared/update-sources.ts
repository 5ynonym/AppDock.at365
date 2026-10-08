// A saved source is a publish directory/update.json, an HTTP(S) feed, or a GitHub repository.
export function validateUpdateSource(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length > 4096 || /[\x00-\x1f]/.test(value))
    throw Error('更新元は4096文字以内のパス・URL・GitHubリポジトリです。');
  if (!value.trim()) return;
  if (/^github:/i.test(value)) {
    if (!/^github:[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(value))
      throw Error('更新元のGitHub指定は github:owner/repo です。');
    return;
  }
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    if (url.username || url.password || url.hash)
      throw Error('更新元URLに認証情報やフラグメントを含めないでください。');
    return;
  }
  if (!/^[A-Za-z]:[\\/]/.test(value) && !/^\\\\[^\\/]+\\[^\\/]+/.test(value))
    throw Error('更新元は絶対パス・UNC・HTTP(S) URL・github:owner/repoです。');
  if (/^\\\\[?.]\\/.test(value)) throw Error('更新元にデバイスパスは使えません。');
}
