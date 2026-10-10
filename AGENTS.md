# AppDockの作業ルール

A:配下では最初に[A:\AGENTS.md](../../AGENTS.md)と[30.PROJECT共通指示](../AGENTS.md)を読む。このファイルはAppDockリポジトリ全体に適用する。

## 情報の保存先と更新

- AppDock固有の作業ルール・運用上の注意・未実装の合意事項はこのファイルで管理する。仕様・運用・検証・発行方法に影響する変更では、このファイルと参照文書の更新要否を同じ作業で確認する。共通手順の本文は正本へ集約し、各Appletから参照する。
- 詳細仕様の入口は[DEVELOPMENT.md](DEVELOPMENT.md)。版別の実装経緯・検証範囲は[実装履歴](docs/implementation-history.md)に保存している。関係箇所の調査時に参照し、当時の「未実装」「未確認」を現在の状態と混同しない。
- 新しい実測結果・一時調査はVERIFICATION.mdへ記録する。古い版・ハッシュ・branch・権限を固定の現状として扱わず、現ソース・Git・配布物を確認する。兄弟Appletを編集するときは、そのrepoの指示と開発文書も読む。

## 開発・発行・配置の注意

- 共通ログは[Applet API](docs/extensions.md#sdkで使えるサービス)を正本とする。停止処理中はhost.logだけを受け付け、AppletのIDと元のレベルを維持する。停止完了/異常終了後と、停止中の他APIの拒否を緩めない。回帰はtests/logging.test.cjs、実nativeの終了ログ/全体と個別画面はWallpaperSlideshowのscripts/test-host-logging-ui.cjsで確認する。

- 本体/全Appletの実行段階は[実装・コミット・リリースの共通手順](docs/development-workflow.md)を正本とする。実装時は必要なテストを選び、既存回帰を毎回一律に実行しない。変更モジュールの版更新・publish・発行物確認まで行い、コミットしない。コミット依頼時に対象/影響範囲の必要回帰をすべて通し、修正した発行物も更新してからコミットする。リリース時はコミット漏れ/未pushを確認・解消し、内容・依存・環境と証跡が一致した検証だけ再利用する。以下の機能別試験指定は検証範囲を選ぶ基準であり、実装のたびに全項目を実行する指定ではない。

- 実装・修正の作業完了時は、必要なテストと発行物の動作確認がすべて成功した後、[テストフォルダーの整理](DEVELOPMENT.md#作業完了時のテストフォルダー整理)を行う（2026-10-10ユーザー指定）。終了・成功を確認できる古いテスト専用フォルダーだけを対象とし、種類ごとに直近3回分を残す。実行中・状態不明・未解決の失敗記録・旧版移行用資料・固定ビルド出力・Release記録は削除しない。名前や経過日数だけで削除せず、安全確認できないものは保持して報告する。整理結果を検証記録へ残す。これは作業者の完了手順であり、通常publishや製品起動へ自動削除を追加する指示ではない。開発生成物の保存先は`.artifacts`（2026-10-10に`artifacts`から改名）。同期/バックアップ/スナップショットの設定はユキちゃんが担当する。
- 完成した本体の実装・修正は、Release前でもバージョンをインクリメントして`publish.bat`を実行し、`publish`へ発行する。通常の修正はパッチ番号を上げ、指定版を優先する。同じ変更の発行再試行・検証用再発行・リリースでは重ねて増やさず、同梱だけの未変更Appletの版は上げない。版更新は[リリース手順](docs/RELEASING.md)のSetVersionでpackage.jsonを更新し、README等の現行版記載も揃える。ユキちゃんの動作確認場所なので、開発ビルドだけで完了にしない。通常publishは本体単一EXEとupdate.jsonだけを生成し、終了コード・成果物の整合・発行版の隔離起動を確認する。変更したAppletはそのrepoで版更新・publishを行う。オールインワンZIP作成・未変更Appletの再発行・旧版ZIP整理は通常publishに含めず、AppDockのリリース時だけ行う。調査/計画/文書だけ、または明示的な発行不要指定は除く。commit・公開・実利用deployは別の指示に従う。
- Node/pnpmはtoolchain.jsonの版を.toolsへ配置してdev.bat経由で使う。pnpm 12の導入ではinstall.jsとWindows shimの再生成が必要。Electron取得は既存のpostinstall/setup手順に従う。依存更新時は初回導入と再実行も確認する。
- node_modulesをjunctionで共有したworktreeで依存のインストールを行わない。親repoのjunctionや.binがworktreeの絶対パスへ変わり得るため、依存を更新するcheckoutは独立node_modulesにする。worktree整理時は参照先の境界と元checkoutの動作を確認する。
- build-main.cjsはout/mainを再生成する。GUI試験や再起動の最中にビルドを重ねない。発行完了後の固定した配布物を使い、検証コピーと最終EXEのSHA256を照合する。
- 本体の単一EXEとportableの展開先/Tray IDの安定性を維持する。scripts/build-portable.cjs・portable.nsiの展開mutex/lease、子プロセスの寿命、hProc形式のHANDLE変換を保つ。electron-builder更新時はcustom templateとの連携と実EXEの更新/再起動/同時起動/異常終了を確認する。
- 実行時の自動展開物は同期不要。現portable.nsiはTEMP/AppDock.at365-識別子へ展開し、EXE配置内には展開しない。LOCALAPPDATA/at365/AppDock/runtimeへの変更は可能だが、2026-10-10の追加相談では未実装。変更時は配置別の安定パスと展開mutex/lease/最終終了時の限定削除を保ち、共有素材・認証・設定の保存先と混ぜない。
- オールインワンZIPの作成・旧版整理はAppDockのリリース時だけ行う（2026-10-09ユーザーの追加指定）。Release Prepareは通常publish後に全Appletを再発行・同梱し、全チェックと新版ZIP/本体の整合検証成功後、sealでpublish直下の`AppDock.at365-all-in-one-<version>.zip`のうち新版より古い正式版を削除する。削除名はplanのremovedOldBundlesへ記録する。生成・配置・検証に失敗した場合は旧版を残す。別のZIP、ディレクトリ/リンク、`.artifacts`、GitHub Releaseへこの削除ルールを適用しない。詳細は[オールインワン作成](docs/all-in-one.md#publishの旧版zip整理)。
- 同じ版のオールインワンZIPの置換はstage内のprevious-all-in-one.zipをbackupとして指定する。null backupで既存ファイルの削除に失敗する実例があり、失敗時に旧ZIPを保持する既存の回帰試験と発行先での実置換を確認する。実利用先deploy時の退避不要という指定とは区別する。
- .NET SDK/Runtime・プロセス契約を変えたらnative AppletのRelease buildと接続/停止/表示/保存も確認する。runtimeconfig欠落は発行元・EXE内・実展開先を比較して原因を切り分ける。
- deployは依頼範囲で実施し、発行成功と実利用先への配置を区別する。ユーザー指定によりdeploy.batの配置先は同期/変更履歴で復元できるため、旧EXE等の別フォルダー退避を追加しない。配置ハッシュと設定保持は確認する。この指定を自己更新helperの復旧用backupへ流用しない。
- Windows PowerShell用PS1はUTF-8 BOM/CRLF。Get-FileHashを解決できない環境では.NET FileStream/SHA256を使う。PowerShell 5.1のFile.Replaceへnull backupを渡す場合はNullString.Valueを使う。GitHub CLIのPATHや認証境界は実行環境で確認する。

## ホスト・UI・Webアカウントの維持事項

- 起動設定は[専用仕様](docs/launch-settings.md)を正本とする。一般設定の共有draft/JSON/revision/saveを使用し、OS登録は明示保存時だけ変更する。タスクは元のportable EXE・配置先・ユーザーに固定し、他配置や手動登録へ干渉しない。UACキャンセル/権限不足では保存せず、保存競合/失敗時は以前のタスクXMLを復元する。実権限と登録状態は保存された希望値と区別する。検証用のタスクは確実に解除し、UAC承認を自動化しない。

- Windows通知のクリックは配置専用protocol activationを使い、元のportable EXE/保存先へ戻す。Electronの共有製品名shortcut/COM登録に起動先を依存させない。URIから任意commandを実行せず、一度限りのトークンと稼働中子プロセスのガードを維持する。通知変更ではtests/notification-routing.test.cjsとscripts/notification-portable-test.cjsを確認し、Windows ShellによるURI起動と物理toastクリックの検証範囲を区別する。

- メインWindowと共有sessionのスペルチェック無効化を維持する。起動遅延とminimumHostVersion照合はホスト共通で管理し、停止/無効化/終了で予約を取り消す。削除済みウィジェット基盤は互換性のために復活させない。
- AppletページのUI WebContentsと表示先Window/領域を分離し、page/window切替でsession/Viewを作り直さない。非選択時の背景描画、表示中だけのキー処理、OS/入力フォーカスを奪わないことを検証する。詳細は[Appletページ](docs/applet-pages.md)。
- WebアカウントはApplet IDごとに保存領域を分離する。認証originは宣言された完全なoriginに限定し、query/認証値/本人情報を診断に出さない。Gmail固有の観測/通知判定はGmail側へ残す。詳細は[WebアカウントAPI](docs/web-accounts.md)。
- 背景Webの動作はvisibilityState、rAF、observer.readyだけで成功としない。Playwrightのfocus emulationが結果を変えるため、未表示の通常起動も別途検証する。ページ自身の描画/取得開始と、必要に応じて許可された実受信を確認する。実メール送信は明示許可の範囲に限定する。
- keepActiveの認証遷移/別文書/破棄時の解除、native focus時の入力を保つ。破棄後にWebContents.debugger getterを呼ばず、生存中の参照と冪等disposeで解放する。WebContentsViewを含む画面は親WindowのcapturePageだけで表示確認を完了扱いにしない。
- 設定はuseSettingsEditorの共有draft/JSON/revision/saveを維持し、詳細/設定画面で二重draftや二重入力を作らない。settingActionsは自身の宣言済みcommandに限定し、実行中ガード・結果表示・未保存入力を保つ。
- Applet詳細の説明・設定・ショートカット・ログは固定の横並びタブで同ページ内に排他表示する。選択表示とキーボード操作、ヘッダー/タブ位置を保つ。ログは選択Appletへ固定し、リボンのログページのsource選択と独立させる。設定との往復で共有draftを保持し、別Appletへ切り替えても選択中のタブを維持する。仕様・検証は[設定パネルの共用](docs/host-development.md#applet設定パネルの共用)を参照する。
- 更新/通常再起動は--restore-viewとプロフィールの画面選択を復元し、終了中のselected(null)で保存先をホームへ上書きしない。Applet復元はstartupReady/対象runningを待つ。詳細は[更新ガイド](docs/updates.md)。
- 更新成功のお知らせは本文を遮らないステータスバー通知を維持する。通知の表示時間はHostSnapshot.windowVisibleで実Windowの可視状態から数え、backgroundThrottling無効時のdocument.hiddenを非表示の判定に使わない。失敗結果は自動消去しない。
- 自己更新の起動時checkはmetadata確認だけ。明示installの確認・実PID終了待ち・journal/commit・復元手順とsettings/dataの保持を維持する。故障注入は隔離したコピーだけへ行い、製品の確認dialogは省略しない。GUI・実GitHub取得・実インストール・実UNCの検証範囲を区別する。
- 本体と全Appletの更新は`installUpdates('all')`の1job/1確認/1再起動へまとめる。同時適用する本体候補の版でAppletの最低host版を検証し、本体候補がない時は現行版を使う。ファイル型Appletだけを列挙し、WebAppletは本体に含める。確認日時は各確認ボタンの隣に置く。仕様と回帰は[更新ガイド](docs/updates.md)を参照する。

## リリース

- バージョン更新・リリースを依頼されたら、作業前に[docs/RELEASING.md](docs/RELEASING.md)を読む。手順書を正本とし、過去チャットや.artifactsだけに依存しない。
- 「バージョンアップして一緒にリリースして」という依頼は、その変更の検証・配布物作成・対象mainのpush・タグ/Release作成・アセット添付・公開後確認までの指示として扱う。対象や版が不明なら必要な点だけ確認する。単なる文書整備・ビルドの依頼で公開しない。
- AppDockのリリース依頼は本体と同梱Appletをまとめて扱う（2026-10-10ユーザー指定）。本体版が未公開なら単一EXE/update.json/全ローカルApplet入りZIPを本体Releaseへ公開する。同梱Appletの版が自身のrepoで未公開なら同梱版のupdate.zip/update.jsonをそのrepoへ公開・検証する。本体・Appletとも公開済み同版は再作成・上書きしない。同梱だけの版更新は不要。本体が公開済みでも検証済みbundleの一覧から未公開Appletを判定して続行できる。各repoの公開後検証と最新3件への整理まで完了し、skip/公開/失敗を個別記録する。単なる通常publishでは公開しない。詳細は[まとめてリリース](docs/RELEASING.md#本体と同梱appletをまとめてリリース)。
- プロジェクト内のNode/pnpmを使う。既存のpublish.bat・更新JSON仕様・Applet個別更新を維持する。公開済みアセット/タグを自動上書きしない。
- [Release手順](docs/RELEASING.md)の標準Prepare、または検証証跡を再利用した準備で、必要な検証を完了させる。再利用は型チェック/ソース回帰等に限り、新しい配布物の検証は毎回行う。preflight/sealとDraftの全アセット照合を経てPublishへ進む。失敗時は非公開のまま停止し、手順書の復旧手順に従う。公開リクエストの結果が不明なら再作成せず状態を確認する。
- GUI試験は直列・隔離profileで行う。実利用設定・認証データは配布物へ入れない。
- GitHub公開後のVerify成功後、公開済みReleaseをpublished_atの新しい順で3件だけ残し、古いReleaseと添付アセットを削除する（2026-10-09ユーザー指定）。本体はrelease.cjsのVerify末尾で共通release-retention.cjsを実行する。Appletも各repoの公開後検証が成功した場合だけ共通手順を使う。draft・Gitタグ/コミット履歴を保持し、候補/最新版の再確認と削除前後の記録を残す。公開・検証失敗時は削除しない。保持3件内の不具合Release等を追加で削除する場合は個別指定に従う。詳細は[Release整理](docs/RELEASING.md#公開済みreleaseを最新3件に整理)を参照する。

## Applet追加

- 新しいAppletはAppDockの親フォルダー直下の独立Gitリポジトリに置き、ルートに`extension.json`と`publish.bat`を用意する。開発/テスト生成物は`.artifacts`へ保存しGit除外する（既存Appletも2026-10-10に改名済み）。同期/バックアップ設定はユキちゃんが担当する。既存の6件を固定リストとして扱わない。
- publish.batはビルドに失敗したら非0終了とし、共通`scripts/pack-applet-update.ps1`で、そのAppletの`publish/update.json`と`publish/update.zip`を生成する。manifestのIDは一意にし、版・minimumHostVersion・entryを正しく記載する。
- AppDockのRelease Prepareのpack-all-in-oneはこれらのrepoを自動検出するため、名前一覧の追記は不要。追加したAppletは自身のpublishで確認し、AppDockリリース時に[オールインワン作成](docs/all-in-one.md)の検査と展開起動で収録を確認する。探索範囲外のrepoは勝手に無視せず、配置または明示のAppletRootを整える。
- READMEは利用者向け、開発/発行手順はDEVELOPMENT/docs、実測結果と未確認事項はVERIFICATIONへ記録する。BATはCP932/CRLFを保つ。

## WebAppletの維持事項

- 追加/管理と新規サイト用ショートカット初期値はApplet一覧の組み込み「WebApplet」の設定/ショートカットへ集約する。管理項目はrendererだけの入口で、runtime snapshot・更新・リボン・並べ替え・コマンド提供元へ混ぜない。各サイトのID/個別設定/リボンは維持し、設定カテゴリへWebApplet入口を戻さない。
- 設定/全Applet詳細はページ見出し下のSettingsToolbarで全編集内容を保存する。未保存のままそれ以外へ移ったら、本体Window上部のSettingsNoticeから保存/確認付き破棄を行う。共有draftを通知へ複製せず、専用preloadの通知操作をhost rendererへ戻す。別WebContentsViewへ重なるnative通知の最前面・フォーカス・サイズ・破棄・IPC送信元検査を保つ。専用GUIはscripts/settings-notice-ui-test.cjs。

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

- 0.26.23の[画面設計](docs/shortcut-ui-redesign.md)を正本とする。設定ページは全コマンドの平坦な一覧で未割り当ても表示し、一覧内にグループ分け/実行順操作/コマンド変更を置かない。実行順は専用ShortcutOrderDialogで変更する。検索/状態フィルター/表示件数を上部にまとめ、ShortcutCommandListとAppletShortcutDialogをApplet詳細と共用する。追加時は絞り込み・表示位置を保持し、自動スクロールしない。

- 設定ページ/通常Appletのショートカット削除は確認なしで共有draftへ反映する（BindingActionsのconfirmDelete=false）。保存前は全体の変更破棄で戻せる。ジェスチャーも0.26.24から確認なしで削除する。未割り当てとキーの左端を揃える。

- 0.26.20からApplet詳細は一覧の＋とキー/条件ペアから小さな編集dialogを開く。割り当てメニューの「このキーの実行順…」から、他Appletを含む全割り当ての専用パネルを開く。入力中だけの一時フォームを追加/適用で共有draftへ反映し、全体保存を維持する。dialog表示中はグローバル登録と画面ショートカットを抑止し、取消/閉じる/破棄時に復帰する。Tabは移動、Escapeは取消、Enterは記録欄ではキー入力として扱い、特殊キーからCtrl/Alt/Shift付きTab/Escape等を選べる。実測はscripts/shortcuts-ui-test.cjsとapplet-shortcut-edit-checks.cjs。

- 正本は[条件付きショートカット](docs/keybindings.md)。割り当てごとのkeybindingsを使い、旧shortcuts/globalShortcutCommandsへ条件を押し込まない。新形式が存在すれば旧フィールドは表示用の派生値。
- 本体・localページ・Gmail UI/本文・WebApplet・Windowsホットキーは共通resolver/dispatcherへ渡す。押下時の条件で実行対象を固定し、保存順・同一コマンド1回・再入防止・終了時打切りを保つ。
- Applet条件は実Windowフォーカスと表示中のSurfaceから判定する。非選択/背景/トレイのページ選択をアクティブと扱わず、リモートページへホストIPCを公開しない。
- owner条件は現在のコマンド登録元extensionIdと表示中ページを照合し、ID接頭辞から推測しない。選択肢は「すべてのApplet → 提供元名だけ → 指定したApplet」の順。本体コマンドには提供元項目を出さない。
- 未割り当てのAppletコマンドへキーを追加する時はowner、本体/提供元不明はappを既定にする。既存条件の編集/複製を上書きしない。コマンド一覧の補助表示は完全なIDを見せ、提供元表示名とIDの双方で検索できることを保つ。
- Appletの初期割り当ては自身のmanifestの`commands`と`defaultKeybindings`で宣言し、本体の既定キー表へApplet固有IDを戻さない。初回発見時だけ保存へ追加し、既存Applet/利用者が解除した行を再生成しない。WebAppletは設定内の将来分テンプレートを新規追加時にコピーし、Applet詳細に一括初期化は置かない。正本の形式と検証境界はdocs/keybindings.mdを参照する。
- UIはuseSettingsEditorのdraft/JSON/revision/saveを共用。条件のない旧設定への完全互換のために新設計を複雑化しない（2026-10-09ユーザー指定）。
- グローバルキーの登録ステータスはWindowsの受付状態であり、設定の保存状態とは別。キー記録中は全登録を一時解除しstatusesが空になる。表示の調査時はこの一時停止/復帰を区別する。詳細はdocs/keybindings.md。
- 正常時の登録済み/未登録と、正常な同キー割り当ての注意文は行に表示しない。登録エラーは記録中も直近の再検査結果を保持し、行高とエラー絞り込みを安定させる。表示用キャッシュをbackendの受付や共有draftへ使わない。全体順のメニューは操作範囲を明記する。

## マウスジェスチャーの維持事項

- 正本は[マウスジェスチャー](docs/gestures.md)。本体管理InputHost、共通コマンド予約、条件判定、共有設定draftを使い、Appletへフックを重複登録しない。WebBrowserToolsはブラウザ操作と送信キーを担当する。
- 旧設定はgestures未指定時だけ取り込み、空配列/解除済み割り当てを復活させない。初期値はApplet manifestのdefaultGestureBindingsから初回だけ追加する。WebBrowserToolsの対象exeは本体側と一致させる。
- 開始対象HWNDとページ文脈を固定し、対象/設定変更や取消後に次のアプリへ送らない。command.executeのinvocationとcommand.cancel/.NET CancellationTokenを保つ。キーとジェスチャーのコマンド予約は共用し、再入防止のためにジェスチャーの連続操作全体へ固定待機を追加しない。
- 右クリック復元、捕捉した左/中/キーの解放、ホイールの積算/滞留破棄、停止時の解除を実入力で確認する。待機表示の初期化はフック登録前。InputHostは必要なWPFランタイムを自己完結で収録し、配布は本体単一EXEを維持する。
- 変更時はtests/gestures.test.cjs、tests/InputTests、scripts/gestures-ui-test.cjs、既存ショートカット/ページ回帰を確認する。GUIは直列・隔離profile、発行後は固定配布物で確認する。
- 0.26.24のジェスチャー一覧は全コマンドを平坦に表示し、未割り当ても残す。検索/状態フィルター/＋/入力と条件/即時削除をショートカットと共用する。編集は種類別の選択ボタンとキー記録を持つGestureBindingDialog、順序はGestureOrderDialogで同一入力内だけ変更する。正本はdocs/gestures.md。全体ON/OFFと動作設定、browser/exe条件はジェスチャー側で管理する。

- 行の操作メニューはスクロール表の外へ浮かべ、行の高さを変えない。画面端の位置補正、外側クリック/Escapeで閉じる操作、キーボード移動を維持する。

- Applet設定は詳細ページへ集約し、設定ページにApplet別設定一覧/本体専用キー入口を戻さない。全コマンド一覧はカタログ順でappletOrderには連動しない。AppletIndexの並べ替えは共有draftのappletOrderだけを変更し、起動順/keybindingsの実行順/ribbon.orderを変更しない。回帰はtests/applet-order.test.cjsとscripts/applet-order-ui-test.cjs。

- ショートカットの行末メニューは編集/このキーの実行順/即時削除。追加/編集は小さなdialogで完成してから共有draftへ反映する。追加とキー変更は同キー末尾、条件/有効状態だけの変更は保存位置を保持する。ジェスチャーも同じ操作と位置保持を使い、編集/並べ替え時の外部更新を上書きしない。

- ショートカットとジェスチャーはCommandBindingListのコマンド/割り当て2列とし、狭幅・両テーマで検索/フィルター/編集パネルのoverflowを検証する。共通化では既存ショートカットのGUIも確認する。

- コマンド一覧に実行順番号を表示しない。専用パネルだけに番号と順番操作を置き、適用は同キーのスロット内でのみ行う。変更したキーの内容や順序が外部更新された場合は適用を拒否し、他キーの更新は保持する。検索/状態フィルターに該当するコマンドの全割り当てを表示し、保存配列やdispatcherの実行順を表示のために並べ替えない。

- ショートカットの解除はその他メニューの削除で選んだIDだけをdraftから除く。コマンド行は未割り当てとして残す。無効/停止中でも操作可能にし、空キーの保存検証を緩めない。Deleteは記録可能なキーとして維持する。

- タスクトレイは[専用仕様](docs/tray-menu.md)を正本とし、共有draft/JSON/revision/saveを使う。trayMenuが存在すれば空配列も尊重し、旧trayCommandsは派生値。固定の設定/終了はツリー外から末尾付加。未知コマンドと配置を保持し、グループ解除で子を削除しない。一時停止/再開は共通executeCommandへ登録した本体コマンドで、どの入口から実行してもトレイのチェックを再構成する。実Tray callback/単・ダブル判定と、配布単一EXEの編集/再起動試験の範囲を区別する。
