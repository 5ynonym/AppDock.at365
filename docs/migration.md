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

元のWatchはWPFにWinFormsトレイとWindowsフックを組み合わせています。時計機能は **Applet.Watch.at365** として `../Applet.Watch.at365` に実装済みです。時計専用WPFプロセスを `runtime: native` で起動し、表示状態・モニター・位置などをAppDockの設定へ集約しました。元Watchのソースや設定は変更していません。

マウスジェスチャー、ホットキー、AutoLockなどは別Appletへ分離する方針です。時計Applet内にそれらの拡張ポイントは設けません。

- フック／ホットキーはWindows固有処理として拡張側に残す。
- NotifyIcon、ON/OFF設定、ログはホストへ。
- 時計オーバーレイは今回のnative Appletで実装済み。クリップボード履歴にも専用の表示が必要。
- クリップボードのSTA・メッセージループ、カーソルを動かさない表示、500msの静穏待機、起動中だけ保持する履歴を維持。
- DLL用の.NETランナーはWindowsDesktopを同梱していない。WPF/WinFormsを使うAppletは、時計と同様にWindowsDesktopを含む専用EXEと `runtime: native` を利用できる。
- 既存Watchとの同時有効化でフック・ホットキーが競合しないよう、移行時の切り替えを用意。

## WallpaperSlideshow.at365

ImageCatalog・ImageLoader等の画像選定／処理をCoreへ。ApplicationController、DispatcherForm、WallpaperControllerにあるWinFormsとWindowsイベントへの結合を整理します。

- 設定、実行／停止、トレイ、ログをホストへ。
- Progman/WorkerWに配置するネイティブ描画を残す。Electronのメイン画面を壁紙ウィンドウとして流用しない。
- 複数モニター、RDP再接続、スリープ復帰、ネットワーク断、表示イベントとSTAディスパッチの設計が必要。
- 画像選定・読み込みの直列化や最新要求の優先、エラーからの復旧を維持する。

## 進め方

時計Appletを最初の実装として、ホスト設定・コマンド・nativeプロセスの接続を確認済みです。次のAppletは、その機能に必要なHost APIを追加しながら個別に移行します。既存アプリの独立起動を残し、共有CoreとUI境界だけを分けることも可能です。SDK v1はDLL／native接続・状態パネル・コマンドの土台であり、既存UIやすべての機能を自動的に変換するものではありません。
