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
- オールインワンZIPの置換はstage内のprevious-all-in-one.zipをbackupとして指定する。null backupで既存ファイルの削除に失敗する実例があり、旧ZIPを保持する既存の回帰試験と発行先での実置換を確認する。実利用先deploy時の退避不要という指定とは区別する。
- .NET SDK/Runtime・プロセス契約を変えたらnative AppletのRelease buildと接続/停止/表示/保存も確認する。runtimeconfig欠落は発行元・EXE内・実展開先を比較して原因を切り分ける。
- deployは依頼範囲で実施し、発行成功と実利用先への配置を区別する。ユーザー指定によりdeploy.batの配置先は同期/変更履歴で復元できるため、旧EXE等の別フォルダー退避を追加しない。配置ハッシュと設定保持は確認する。この指定を自己更新helperの復旧用backupへ流用しない。
- Windows PowerShell用PS1はUTF-8 BOM/CRLF。Get-FileHashを解決できない環境では.NET FileStream/SHA256を使う。PowerShell 5.1のFile.Replaceへnull backupを渡す場合はNullString.Valueを使う。GitHub CLIのPATHや認証境界は実行環境で確認する。

## ホスト・UI・Webアカウントの維持事項

- Windows通知のクリックは配置専用protocol activationを使い、元のportable EXE/保存先へ戻す。Electronの共有製品名shortcut/COM登録に起動先を依存させない。URIから任意commandを実行せず、一度限りのトークンと稼働中子プロセスのガードを維持する。通知変更ではtests/notification-routing.test.cjsとscripts/notification-portable-test.cjsを確認し、Windows ShellによるURI起動と物理toastクリックの検証範囲を区別する。

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
- 旧Releaseの削除はユーザーの指定がある時だけ、修正版のVerify成功後に対象ID/タグを確認して行う。Releaseと添付アセットを削除し、追加指定がなければGitタグ/コミット履歴を残す。詳細はRelease手順の旧Release削除を参照する。

## Applet追加

- 新しいAppletはAppDockの親フォルダー直下の独立Gitリポジトリに置き、ルートに`extension.json`と`publish.bat`を用意する。既存の6件を固定リストとして扱わない。
- publish.batはビルドに失敗したら非0終了とし、共通`scripts/pack-applet-update.ps1`で、そのAppletの`publish/update.json`と`publish/update.zip`を生成する。manifestのIDは一意にし、版・minimumHostVersion・entryを正しく記載する。
- AppDockのpublish.batはこれらのrepoを自動検出するため、名前一覧の追記は不要。追加後は[オールインワン発行](docs/all-in-one.md)の検査と展開起動で、新Appletも含まれることを確認する。探索範囲外のrepoは勝手に無視せず、配置または明示のAppletRootを整える。
- READMEは利用者向け、開発/発行手順はDEVELOPMENT/docs、実測結果と未確認事項はVERIFICATIONへ記録する。BATはCP932/CRLFを保つ。

## WebAppletの維持事項

- URLから動的に追加する本体管理Applet。設定・アカウント・遷移・Web提供JSON・検証の正本は[WebApplet](docs/web-applets.md)。従来の未実装相談は実装履歴として扱う。
- Gmailとはaccounts/session/Cookieの保存領域とライフサイクルを分離する。認証データのコピー・移行を追加しない。WebApplet専用の同じ枠はWebApplet間で共有する。
- 枠の削除は保存データも消去し、枠除去とpendingDeletionを同じatomic writeで記録する。生成済みsessionの物理回収は次回起動のsession生成前に行い、ロック等の失敗は記録を残して再試行する。登録中/設定で参照中/同プロセスで生成済みのsessionを回収せず、削除済みsessionを終了時に再flushしない。専用sessions直下の検証済みIDと非転送rootを守り、Gmail/他枠/外部junction先を削除しない。旧版の記録なし残存領域を自動削除するものとは区別する。
- Webアカウント管理は独立した設定カテゴリと専用accounts.jsonを使う。操作は設定draft/revision/saveから独立して即時反映し、削除/クリアはホストの警告dialogで確認する。旧settings内の枠はIDとsessionを保って移行し、専用ファイルの保存成功後だけ旧フィールドを除く。使用中枠の削除ガードと設定保存時の参照検証を維持する。
- アカウント名はblur/Enter/ボタンで確定、確定前のEscapeで保存済みの名前へ戻す。IME変換中/空欄の確定、Enterとblurの重複送信、名前変更で直後の削除/クリアのクリックを失うことを避ける。非同期snapshot反映で次の編集中の名前を上書きしない。
- リモートページにpreload/Node/ホストIPCを公開しない。外部JSONは検証した推奨初期値だけを取り込み、アカウント/コマンド/許可範囲拡張を受け入れず、手動変更を再取得で上書きしない。
- WebAppletはページを開いた時に生成する。既存AppletSurfaceを使い、表示先の切替でWebContents/session/入力を作り直さない。無効化/削除/アカウント・URL変更時の破棄、Cookie保存、共有枠消去時の対象画面終了を確認する。
- 無効化したApplet（WebApplet/Gmailを含む）は実リボンから除外し、再開時に元の表示/順序/上下配置へ戻す。リボン設定の一覧には保持し、コマンドによる明示起動や、有効なAppletの開始待ち/エラー表示/再試行を妨げない。
- WebAppletのID接頭辞web.は本体管理用。ファイルmanifestからこの名前空間やweb runtimeを読み込まない。本体と一緒に更新されるため、個別Appletの配布更新対象へ混ぜない。
- 今後の同機能変更ではtests/web-applets.test.cjs、tests/web-profiles.test.cjs、scripts/web-applets-ui-test.cjs、scripts/web-applets-portable-test.cjsに加え、既存ページ/Gmail表示の回帰を確認する。保存形式変更時は保持した旧配布物でscripts/web-profiles-migration-ui-test.cjsも実施する。実サイト認証・長期背景動作とオフラインfixtureの成功を区別する。

## 条件付きショートカットの維持事項

- 正本は[条件付きショートカット](docs/keybindings.md)。割り当てごとのkeybindingsを使い、旧shortcuts/globalShortcutCommandsへ条件を押し込まない。新形式が存在すれば旧フィールドは表示用の派生値。
- 本体・localページ・Gmail UI/本文・WebApplet・Windowsホットキーは共通resolver/dispatcherへ渡す。押下時の条件で実行対象を固定し、保存順・同一コマンド1回・再入防止・終了時打切りを保つ。
- Applet条件は実Windowフォーカスと表示中のSurfaceから判定する。非選択/背景/トレイのページ選択をアクティブと扱わず、リモートページへホストIPCを公開しない。
- owner条件は現在のコマンド登録元extensionIdと表示中ページを照合し、ID接頭辞から推測しない。選択肢は「すべてのApplet → 提供元名だけ → 指定したApplet」の順。本体コマンドには提供元項目を出さない。
- 未割り当てのAppletコマンドへキーを追加する時はowner、本体/提供元不明はappを既定にする。既存条件の編集/複製を上書きしない。コマンド一覧の補助表示は完全なIDを見せ、提供元表示名とIDの双方で検索できることを保つ。
- UIはuseSettingsEditorのdraft/JSON/revision/saveを共用。条件のない旧設定への完全互換のために新設計を複雑化しない（2026-10-09ユーザー指定）。
