import type { SettingsEditor } from './useSettingsEditor';
export function SettingsToolbar({
  editor,
  children,
}: {
  editor: SettingsEditor;
  busy: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="settings-toolbar">
      {children}
      {editor.pending && <span role="status">保存中…</span>}
    </div>
  );
}
export function SettingsMessages({ editor }: { editor: SettingsEditor; currentRevision: number }) {
  return editor.error ? (
    <div className="error-text" role="alert">
      {editor.error}
      <button onClick={editor.reset}>設定を再読み込み</button>
    </div>
  ) : null;
}
