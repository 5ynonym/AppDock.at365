import type { ReactNode } from 'react';
import type { SettingsPageDefinition } from '../../../src/shared/settings-catalog';

const descriptions: Record<string, string> = {
  appearance: 'テーマと各領域のShellを選び、ワークスペースの見た目を整えます。',
  general: '音の再生や、起動時・ウィンドウを閉じたときの動作を設定します。',
  notifications: '通知の種類ごとに、表示先・表示時間・読み上げを設定します。',
  tts: 'OpenAI互換のTTSサーバーで生成した音声を、このPCで再生します。',
  ribbon:
    '上寄せ・下寄せを選び、それぞれの並び順と表示を設定できます。行をドラッグするか上下ボタンで並べ替えると自動保存します。',
  tray: 'トレイアイコンのクリック操作と、メニューに表示するコマンドを設定します。',
  shortcuts: 'コマンドを見つけて、キーと使う場面を設定できます。',
  gestures: 'コマンドを見つけて、操作と使う場面を設定できます。',
  'web-accounts':
    'WebApplet専用のアカウント枠を管理します。同じ枠を選んだWebAppletはログイン状態を共有し、Gmailのアカウントとは別管理です。',
  permissions:
    'AppletとMCPの許可を、それぞれ設定します。Applet側はすべてのAppletに共通です。変更はすぐに反映されます。',
  codex:
    '同じPCのCodexやネットワーク上のMCPクライアントから、AppDockの状態確認・設定変更・公開コマンドの実行ができます。連携の設定はこのPCへ即時反映されます。',
  profile: 'Dockで使う名前と、左下に表示するアバターを設定します。',
  about: 'AppDockとインストール済みAppletのバージョンを確認し、更新を管理します。',
};

/** One frame for host settings, Applets, and both form / JSON views. */
export function SettingsPageLayout({
  page,
  mode,
  pending,
  error,
  onMode,
  onOpenFile,
  onReload,
  children,
  announcement,
}: {
  page: SettingsPageDefinition;
  mode: 'form' | 'json';
  pending: boolean;
  error: string;
  onMode(mode: 'form' | 'json'): void;
  onOpenFile(): void;
  onReload(): void;
  children: ReactNode;
  announcement: ReactNode;
}) {
  const modes: ('form' | 'json')[] = page.json ? ['form', 'json'] : ['form'];
  const description =
    page.kind === 'host'
      ? descriptions[page.id]
      : page.collection
        ? '表示方法・アカウント・サイトの動作を設定します。'
        : 'Appletの表示方法・起動時の動作と、個別の設定を変更します。';
  return (
    <main className="settings-page-layout">
      <header className="settings-page-heading">
        <h1>{page.title}</h1>
        <p>{description ?? 'このページの設定を変更します。'}</p>
      </header>
      <div className="settings-page-toolbar">
        <div className="tabs" role="group" aria-label="設定の表示形式">
          {modes.map((value) => (
            <button
              key={value}
              type="button"
              className={value === mode ? 'selected' : ''}
              aria-pressed={value === mode}
              onClick={() => onMode(value)}
            >
              {value === 'form' ? 'フォーム' : 'JSON'}
            </button>
          ))}
        </div>
        <p className="settings-save-status" role="status">
          {pending ? '保存中…' : '変更は自動で保存されます。'}
        </p>
        {page.json && (
          <button type="button" className="settings-file-button" onClick={onOpenFile}>
            ファイルを開く
          </button>
        )}
      </div>
      {error && (
        <div className="settings-page-error">
          <p className="error-text" role="alert">
            {error}
          </p>
          <button type="button" className="secondary" onClick={onReload}>
            設定を再読み込み
          </button>
        </div>
      )}
      <div className={`settings-body settings-panel settings-panel-${mode}`} key={page.id + mode}>
        {children}
      </div>
      {announcement}
    </main>
  );
}
