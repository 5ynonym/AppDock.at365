# AppDockの作業ルール

A:配下では最初に[A:\AGENTS.md](../../AGENTS.md)と参照先のALICE指示を読む。このファイルはAppDockリポジトリ全体に適用する。

## 情報の保存先と更新

- AppDock固有の作業ルール・運用上の注意・未実装の合意事項はこのファイルで管理し、共通のALICE/TOOLS.mdへ戻さない。仕様・運用・検証・発行方法に影響する変更では、このファイルと参照文書の更新要否を同じ作業で確認する。
- 詳細仕様の入口は[DEVELOPMENT.md](DEVELOPMENT.md)。過去のTOOLS.mdにあった版別の実装経緯・検証範囲は[実装履歴](docs/implementation-history.md)に保存している。関係箇所の調査時に参照し、当時の「未実装」「未確認」を現在の状態と混同しない。
- 新しい実測結果・一時調査はVERIFICATION.mdへ記録する。古い版・ハッシュ・branch・権限を固定の現状として扱わず、現ソース・Git・配布物を確認する。兄弟Appletを編集するときは、そのrepoの指示と開発文書も読む。

## 開発・発行・配置の注意

- Node/pnpmはtoolchain.jsonの版を.toolsへ配置してdev.bat経由で使う。pnpm 12の導入ではinstall.jsとWindows shimの再生成が必要。Electron取得は既存のpostinstall/setup手順に従う。依存更新時は初回導入と再実行も確認する。
- node_modulesをjunctionで共有したworktreeで依存のインストールを行わない。親repoのjunctionや.binがworktreeの絶対パスへ変わり得るため、依存を更新するcheckoutは独立node_modulesにする。worktree整理時は参照先の境界と元checkoutの動作を確認する。
- build-main.cjsはout/mainを再生成する。GUI試験や再起動の最中にビルドを重ねない。発行完了後の固定した配布物を使い、検証コピーと最終EXEのSHA256を照合する。
- 本体の単一EXEとportableの展開先/Tray IDの安定性を維持する。scripts/build-portable.cjs・portable.nsiの展開mutex/lease、子プロセスの寿命、hProc形式のHANDLE変換を保つ。electron-builder更新時はcustom templateとの連携と実EXEの更新/再起動/同時起動/異常終了を確認する。
- .NET SDK/Runtime・プロセス契約を変えたらnative AppletのRelease buildと接続/停止/表示/保存も確認する。runtimeconfig欠落は発行元・EXE内・実展開先を比較して原因を切り分ける。
- deployは依頼範囲で実施し、発行成功と実利用先への配置を区別する。ユーザー指定によりdeploy.batの配置先は同期/変更履歴で復元できるため、旧EXE等の別フォルダー退避を追加しない。配置ハッシュと設定保持は確認する。この指定を自己更新helperの復旧用backupへ流用しない。
- Windows PowerShell用PS1はUTF-8 BOM/CRLF。Get-FileHashを解決できない環境では.NET FileStream/SHA256を使う。PowerShell 5.1のFile.Replaceへnull backupを渡す場合はNullString.Valueを使う。GitHub CLIのPATHや認証境界は実行環境で確認する。

## ホスト・UI・Webアカウントの維持事項

- メインWindowと共有sessionのスペルチェック無効化を維持する。起動遅延とminimumHostVersion照合はホスト共通で管理し、停止/無効化/終了で予約を取り消す。削除済みウィジェット基盤は互換性のために復活させない。
- AppletページのUI WebContentsと表示先Window/領域を分離し、page/window切替でsession/Viewを作り直さない。非選択時の背景描画、表示中だけのキー処理、OS/入力フォーカスを奪わないことを検証する。詳細は[Appletページ](docs/applet-pages.md)。
- WebアカウントはApplet IDごとに保存領域を分離する。認証originは宣言された完全なoriginに限定し、query/認証値/本人情報を診断に出さない。Gmail固有の観測/通知判定はGmail側へ残す。詳細は[WebアカウントAPI](docs/web-accounts.md)。
- 背景Webの動作はvisibilityState、rAF、observer.readyだけで成功としない。Playwrightのfocus emulationが結果を変えるため、未表示の通常起動も別途検証する。ページ自身の描画/取得開始と、必要に応じて許可された実受信を確認する。実メール送信は明示許可の範囲に限定する。
- keepActiveの認証遷移/別文書/破棄時の解除、native focus時の入力を保つ。破棄後にWebContents.debugger getterを呼ばず、生存中の参照と冪等disposeで解放する。WebContentsViewを含む画面は親WindowのcapturePageだけで表示確認を完了扱いにしない。
- 設定はuseSettingsEditorの共有draft/JSON/revision/saveを維持し、詳細/設定画面で二重draftや二重入力を作らない。settingActionsは自身の宣言済みcommandに限定し、実行中ガード・結果表示・未保存入力を保つ。
- 更新/通常再起動は--restore-viewとプロフィールの画面選択を復元し、終了中のselected(null)で保存先をホームへ上書きしない。Applet復元はstartupReady/対象runningを待つ。詳細は[更新ガイド](docs/updates.md)。
- 更新成功のお知らせは本文を遮らないステータスバー通知を維持する。通知の表示時間はHostSnapshot.windowVisibleで実Windowの可視状態から数え、backgroundThrottling無効時のdocument.hiddenを非表示の判定に使わない。失敗結果は自動消去しない。
- 自己更新の起動時checkはmetadata確認だけ。明示installの確認・実PID終了待ち・journal/commit・復元手順とsettings/.appdockの保持を維持する。故障注入は隔離したコピーだけへ行い、製品の確認dialogは省略しない。GUI・実GitHub取得・実インストール・実UNCの検証範囲を区別する。

## リリース

- バージョン更新・リリースを依頼されたら、作業前に[docs/RELEASING.md](docs/RELEASING.md)を読む。手順書を正本とし、過去チャットやartifactsだけに依存しない。
- 「バージョンアップして一緒にリリースして」という依頼は、その変更の検証・配布物作成・対象mainのpush・タグ/Release作成・アセット添付・公開後確認までの指示として扱う。対象や版が不明なら必要な点だけ確認する。単なる文書整備・ビルドの依頼で公開しない。
- 本体は単一EXEを維持する。通常EXE、update.json、全ローカルAppletを拡張として配置したオールインワンZIPを同じ本体Releaseへ含める。
- プロジェクト内のNode/pnpmを使う。既存のpublish.bat・更新JSON仕様・Applet個別更新を維持する。公開済みアセット/タグを自動上書きしない。
- `scripts/release.ps1`のPrepareでビルド・テスト・配布物検証を完了させ、Draftで全アセットを照合してからPublishへ進む。失敗時は非公開のまま停止し、手順書の復旧手順に従う。公開リクエストの結果が不明なら再作成せず状態を確認する。
- GUI試験は直列・隔離profileで行う。実利用設定・認証データは配布物へ入れない。

## Applet追加

- 新しいAppletはAppDockの親フォルダー直下の独立Gitリポジトリに置き、ルートに`extension.json`と`publish.bat`を用意する。既存の6件を固定リストとして扱わない。
- publish.batはビルドに失敗したら非0終了とし、共通`scripts/pack-applet-update.ps1`で、そのAppletの`publish/update.json`と`publish/update.zip`を生成する。manifestのIDは一意にし、版・minimumHostVersion・entryを正しく記載する。
- AppDockのpublish.batはこれらのrepoを自動検出するため、名前一覧の追記は不要。追加後は[オールインワン発行](docs/all-in-one.md)の検査と展開起動で、新Appletも含まれることを確認する。探索範囲外のrepoは勝手に無視せず、配置または明示のAppletRootを整える。
- READMEは利用者向け、開発/発行手順はDEVELOPMENT/docs、実測結果と未確認事項はVERIFICATIONへ記録する。BATはCP932/CRLFを保つ。

## AppDock WebApplet：次回実装用の記録（2026-10-09）

状態：設計相談のみ。ユキちゃんは「あとでお願いする」と指定しており、今回は記録まで。実装・配置・コミットはまだ依頼されていない。

### ユキちゃんの希望と決まった方針

- 好きなWebページをURLから動的に「WebApplet」として追加できる。Appletの一覧・詳細設定・リボンから扱える体験にする。
- 名前とURLを設定し、リボンを押すとAppDockの埋め込みページまたは別ウィンドウで表示する。表示方法は設定可能にする。
- WebAppletごとにページ遷移を許可するか設定できる。
- WebAppletが使用するWebアカウント枠を一覧から選べる。Gmailで使っている管理方式を参考にする。
- **WebAppletのアカウント一覧とログイン保存領域はGmailとは別管理。Gmailの枠との共有案は採用しない。** Gmailのログイン・ログアウト・枠削除・新着監視へ影響を出さない。
- WebApplet側で初回ログインする。Gmailの認証データのコピーや移行は不要。管理用コードを再利用する場合も保存先は独立させる。

### 次回の設計で決める事項

- 1ページを1WebAppletとして追加するか、最初の相談にあった1Applet内の複数URL/リボンボタンにも対応するか。具体的な構成と件数上限は未確定。
- ページ遷移設定の選択肢・初期値、認証先への転送、新しいウィンドウを要求するリンクの扱い。
- WebApplet専用のアカウント枠を複数WebAppletで共有できる範囲と、枠を削除するときの扱い。Gmailとの分離は確定。
- 名前/URLの変更でもリボン配置・表示先等を保持する安定ID、保存形式、必要時のページ読込と画面再利用。

### 追加アイデア：Webアプリが提供する設定JSON（2026-10-09、検討案）

Web用機能はこれから作る設計相談。下記の標準仕様は比較・再利用候補として調査したもので、AppDockのWebAppletや独自JSON連携が既に実装されているという意味ではない。

- ユキちゃんの案：表示するWebアプリがJSONを提供し、名前/アイコン/ページ遷移なし・同じサブドメイン内等を自動設定できる。AppDockでの手動設定も維持する。まだ採用/具体仕様は確定していない。
- アリスの提案：Web側の推奨初期設定として読む。URL登録時に自動検出して追加フォームを埋め、ユーザーの編集を優先する。初版は追加時読取と明示的な再取得を候補にし、ページ再読込のたびに保存設定を強制更新しない。更新で許可範囲を勝手に広げない。
- Web App Manifestのname/icons/start_url/scopeを活用し、遷移禁止やsame-origin等のAppDock専用指定は名前の衝突を避けた独自appdock項目を候補にする。通常manifestはlink rel=manifestで発見できる。独自項目は未定義の設計案であり、既存APIとして扱わない。
- scopeはWebアプリの適用範囲で、ブラウザーの遷移遮断機能ではない。AppDockの遷移制限は別途ホストで実施する。同じサブドメイン限定はscheme/host/portの完全一致（same-origin）を基本候補とし、兄弟サブドメインを自動許可しない。
- 許可した宣言データ項目だけ検証して取り込む。既存extension manifest/settings.jsonへ丸ごとmergeしたり、実行コード/任意コマンド/使用アカウント枠をWeb側から指定したりしない。Gmailとの保存領域分離を維持する。
- JSON取得元は登録先の同一origin・HTTPSを初期候補にし、アイコン/JSONのサイズ・時間・転送先も検証する。不在/不正/取得失敗なら手動設定に戻れる形とし、別サイトへの認証転送や範囲拡張は別設計とする。
- 参照確認済み： https://www.w3.org/TR/appmanifest/ （2026-10-08 Working Draft。標準項目、link、proprietary拡張、同origin scope）、https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/scope （scopeは範囲外への遷移を遮断しない）。後日の実装時は現仕様を再確認する。

### 調査済みの実装上の入口

- `30.PROJECT/AppDock.at365/src/shared/applet-pages.ts`：相談時はmanifest固定の最大10ページ。各pageが個別リボンボタンになり、page/windowを選べる。動的ページ登録は未提供。dynamic-commandsはリボンページ登録とは別。
- `src/main/core/applet-pages.ts`：既存AppletSurfaceはWebContentsViewを本体ページ/別Windowへ載せ替える。画面領域・Window位置・終了処理を再利用する候補。
- `src/main/core/web-accounts.ts`：相談時はApplet IDごとのaccounts.jsonとsessions/<accountId>。Webアカウントsourceは1Applet1ページ、初期URL/HTTPS originはmanifest固定、任意URLのnavigate APIはない。Gmailのremoveはログインデータ/cacheを消去するので、共有データを不用意に使わない。
- `docs/applet-pages.md`、`docs/web-accounts.md`、`src/shared/contracts.ts`も確認する。Gmailの観測/通知など固有処理はGmail側に残す。
- 2026-10-09のコード非変更検証で同Applet3ボタン・10ページ受理/11拒否・web-accounts2ページ拒否・remote source拒否を確認。実サイトとの互換性は未検証。
- 相談時のAppDockはpackage0.22.0/codex/portable-updatesで既存未コミット変更あり。後日は現ブランチ・差分・APIを再確認し、別作業を上書きしない。Gmail分離と既存表示の回帰確認を含めて実装する。

この節は未実装の相談内容として保持する。実装を依頼された時に現ソース・要望を再確認し、着手と完了に合わせて状態を更新する。
