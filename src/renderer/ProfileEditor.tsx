import { useEffect, useRef, useState } from 'react';
export function ProfileEditor({
  name,
  avatarUrl,
  busy,
  onName,
  onAvatar,
  onLoading,
}: {
  name: string;
  avatarUrl: string | null;
  busy: boolean;
  onName(value: string): void;
  onAvatar(bytes: Uint8Array | null, preview: string | null): void;
  onLoading(value: boolean): void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const selection = useRef(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(
    () => () => {
      selection.current++;
      onLoading(false);
    },
    [onLoading],
  );
  return (
    <div className="profile-editor">
      <h3>プロフィール</h3>
      <p className="settings-help">Dockで使う名前と、左下に表示するアバターを設定します。</p>
      <div className="profile-preview">
        <div className="profile-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="プロフィール画像" />
          ) : (
            Array.from(name.trim())[0] || '?'
          )}
        </div>
        <div>
          <strong>{name || '名前を入力してください'}</strong>
          <p>Your personal workspace</p>
        </div>
      </div>
      <div className="setting-row">
        <div>
          <strong>ユーザー名</strong>
          <p>80文字以内で入力してください。</p>
        </div>
        <input
          aria-label="ユーザー名"
          value={name}
          maxLength={80}
          disabled={busy || loading}
          onChange={(e) => onName(e.target.value)}
        />
      </div>
      <div className="setting-row">
        <div>
          <strong>アバター画像</strong>
          <p>PNG / JPEG · 5MBまで。保存するとavatar.pngを置き換えます。</p>
        </div>
        <div className="profile-actions">
          <button
            className="secondary"
            disabled={busy || loading}
            onClick={() => input.current?.click()}
          >
            {loading ? '読み込み中…' : '画像を選択'}
          </button>
          <button
            className="text-button"
            disabled={busy || loading || !avatarUrl}
            onClick={() => {
              selection.current++;
              setError('');
              onAvatar(null, null);
            }}
          >
            画像を削除
          </button>
        </div>
      </div>
      <input
        ref={input}
        className="profile-file-input"
        type="file"
        aria-label="アバター画像を選択"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          const request = ++selection.current;
          setError('');
          setLoading(true);
          onLoading(true);
          try {
            if (file.size > 5 * 1024 * 1024) throw new Error('画像は5MB以下にしてください。');
            const bytes = new Uint8Array(await file.arrayBuffer());
            const preview = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(new Error('画像を読み込めません。'));
              reader.readAsDataURL(file);
            });
            if (request === selection.current) onAvatar(bytes, preview);
          } catch (e) {
            if (request === selection.current) setError(e instanceof Error ? e.message : String(e));
          } finally {
            if (request === selection.current) {
              setLoading(false);
              onLoading(false);
            }
          }
        }}
      />
      {error && (
        <div className="error-text" role="alert">
          {error}
        </div>
      )}
      <p className="footnote">
        画像は設定ファイルの隣に1枚だけ保存します。変更は画面上部の「保存」で確定します。
      </p>
    </div>
  );
}
