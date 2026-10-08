import type { SettingsEditor } from './useSettingsEditor';

export function SettingsActions({ editor, busy }: { editor: SettingsEditor; busy: boolean }) {
  const disabled = !editor.dirty || busy || editor.avatarLoading;
  return (
    <>
      <span className={editor.dirty ? 'unsaved' : 'muted'}>
        {editor.dirty ? '未保存の変更があります' : 'すべて保存されています'}
      </span>
      <button className="text-button" disabled={disabled} onClick={editor.reset}>
        変更を破棄して再読み込み
      </button>
      <button className="primary" disabled={disabled} onClick={() => void editor.save()}>
        変更をすべて保存
      </button>
    </>
  );
}

export function SettingsMessages({
  editor,
  currentRevision,
}: {
  editor: SettingsEditor;
  currentRevision: number;
}) {
  return (
    <>
      {editor.parseError && (
        <div className="error-text" role="alert">
          {editor.parseError}
        </div>
      )}
      {editor.dirty && editor.revision !== currentRevision && (
        <div className="error-text" role="alert">
          別の場所で設定が変わりました。編集中の内容は保持しています。再読み込みして変更をやり直してください。
        </div>
      )}
    </>
  );
}
