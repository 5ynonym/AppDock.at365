# 既存.NETアプリの移行メモ

2026-10-05時点の現行ソースを参照したホストへの移行案です。各アプリの元ソースと元の設定は変更していません。

## GmailChecker.at365

`GmailChecker/Google` のGmailClient・GmailMonitor・OAuthService、およびStorageの原子的保存や認証処理をCoreとして切り出します。現在のクラスはinternalなので、同一拡張アセンブリへのソース移動か、必要なpublic境界の作成が必要です。初期の移行候補です。

- WinFormsの設定画面をホストの設定／アカウント管理パネルへ。
- NotifyIconとメニューをSDKのTray、通知をNotificationsへ。
- OAuthはPKCE・state・ループバックの検証を維持し、ブラウザ起動はBrowser APIへ。
- refresh token等はSecrets、非秘密の設定はSettingsへ。
- 定期監視はSchedulerへ。認証失効、Retry-After、履歴IDの保存失敗時の扱いを維持。
- アカウント追加の対話UI、ファイル選択、通知音再生はAPI v1に未実装。Gmail移行時にホストAPIを追加する対象。

実アカウントでのログイン・通信はホスト作成段階では行いません。

## Watch.at365

現在はWPFにWinFormsトレイとWindowsフックを組み合わせています。CommonのApplicationSettingsをホスト設定へ移し、入力・ホットキー・時計の各機能を分割してから移行します。

- フック／ホットキーはWindows固有処理として拡張側に残す。
- NotifyIcon、ON/OFF設定、ログはホストへ。
- 時計オーバーレイとクリップボード履歴ウィンドウは、メイン画面とは別の表示が必要。
- クリップボードのSTA・メッセージループ、カーソルを動かさない表示、500msの静穏待機、起動中だけ保持する履歴を維持。
- API v1の.NETランナーはWindowsDesktopを同梱していないため、WPF/WinForms依存をそのまま読み込む前提ではない。ネイティブ表示用ヘルパーか、別ElectronウィンドウとWindows API橋渡しを設計する。
- 既存Watchとの同時有効化でフック・ホットキーが競合しないよう、移行時の切り替えを用意。

## WallpaperSlideshow.at365

ImageCatalog・ImageLoader等の画像選定／処理をCoreへ。ApplicationController、DispatcherForm、WallpaperControllerにあるWinFormsとWindowsイベントへの結合を整理します。

- 設定、実行／停止、トレイ、ログをホストへ。
- Progman/WorkerWに配置するネイティブ描画を残す。Electronのメイン画面を壁紙ウィンドウとして流用しない。
- 複数モニター、RDP再接続、スリープ復帰、ネットワーク断、表示イベントとSTAディスパッチの設計が必要。
- 画像選定・読み込みの直列化や最新要求の優先、エラーからの復旧を維持する。

## 進め方

GmailからHost APIの不足を実利用で埋め、その後Watch／Wallpaperのネイティブ表示を設計する順序が扱いやすいです。既存アプリの独立起動を残し、共有CoreとUI境界だけを分けることも可能です。ホストのSDK v1はDLL接続・状態パネル・コマンドの土台であり、既存UIやすべての機能を自動的に変換するものではありません。
