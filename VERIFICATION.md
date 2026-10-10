# 検証記録

## 2026-10-10: 0.26.18 コミット前の全回帰確認

- 共通ログ/WallpaperSlideshow終了対応のコミット依頼により、対象9ファイルをstageしてから標準回帰を実行。型検査、`dev.bat test`の192/192、変更コードのPrettier確認が成功。検証開始/終了のtreeは`14440020ff282971282d0b335478149d14175581`で一致し、未stage/未追跡の入力なし。
- 兄弟AppletのRelease回帰8グループ、RPC8項目と発行native EXE、実HWNDの終了通知3群、固定発行EXEのログGUI4群も今回再実行して成功。GUI証跡は`../Applet.WallpaperSlideshow.at365/.artifacts/host-logging-1791638884710/result.json`。停止時のApplet ID/errorレベル・全体/個別ログ・host.log・独自errors.logなしを確認。
- 再利用用証跡は`.artifacts/commit-validation-20261010-logging-shutdown/`。各コマンド/終了コード/完全ログSHA256、tracked入力、SDK/Runtime、toolchain/lockfile/依存状態、兄弟repoと発行物を保存。検証後の変更は本VERIFICATIONへの記録追加のみで、最終treeとコミットSHAを同証跡に記録する。
- 発行物は実装完了時の0.26.18/0.4.3から不変。feed/ZIP全2ファイル/文書リンク95件/既存全体ZIPの照合成功。新しい製品修正がなく再発行は不要。Applet側で終了済みの古い成功テスト2件だけを整理し、方式別最新成功3件・失敗・検証再利用資料を保持。
- PC自体のshutdown/reboot/logoff・実デスクトップ壁紙APIは未試験。隔離した実Windowsメッセージとfake壁紙APIの確認範囲を維持する。今回の明示依頼は両repoのローカルコミットまで。

## 2026-10-10: 0.26.18 Applet終了処理中の共通ログ

- WallpaperSlideshowの独自errors.logを共通APIへ移す依頼で、IExtensionContext.Log/Node logとhost.logは既存と確認。停止処理中の共通API一律拒否により、クリーンアップエラーがstderrのWarningになる境界を修正。stoppingではhost.logだけを許可し、stopped/errorと他APIの拒否は保持。SDK/RPC形式・プロセス寿命・全体終了手順の変更なし。
- 型検査/build成功（.artifacts/cleanup-logging-typecheck.log、cleanup-logging-build.log）。logging/notification-services/panel-images/lifecycleの関連回帰9/9成功（cleanup-logging-regression.log）。開始/稼働/停止中のログ、提供元IDのホスト付与、停止後拒否、停止中の設定/UI/通知拒否、実Node/.NETの起動/停止/再起動/異常終了分離を確認。
- 本体publish.bat終了0。0.26.18単一EXEは142,521,087bytes/SHA256 2dcb4e32c960101d4541dab24bdc949a655dd453b928388d4fd816f815cf7085。feedと検証コピー一致。既存全体ZIP1個はhash/size/mtime不変。未変更Applet再発行や全体ZIP生成なし。別途変更したWallpaperSlideshowは自身のpublishへ0.4.3を発行し、最低host0.26.18を設定。
- 固定単一EXEの隔離GUI4群成功: ../Applet.WallpaperSlideshow.at365/.artifacts/host-logging-1791637417933/result.json。実native Appletの起動失敗とfixtureの内部画像エラーを全体/個別ログ画面・ホストファイルで確認。普通の終了時のfixture cleanupログもApplet ID/errorレベルで保存。正常終了・重複抑制・独自errors.logなし・最終EXEコピーのhash一致を確認し、画像も目視。
- WallpaperSlideshowのWM_ENDSESSION/優先度/同期黒BMP処理の変更と、実HWNDへ限定送信した確定/取消/logoff/通常deactivateの検証は[Appletの記録](../Applet.WallpaperSlideshow.at365/VERIFICATION.md)を参照。Windows終了時にbefore-quitが発火しない仕様に対し、Applet側で同期クリーンアップする。PC自体のシャットダウン/再起動・実壁紙変更は行っていない。
- 2モジュールのmanifest/feed/ZIP全2ファイル、文書リンク95件、既存全体ZIPを照合（../Applet.WallpaperSlideshow.at365/.artifacts/logging-shutdown-final-check.json）。必要範囲を選択した実装時検証であり、全本体回帰・全GUI・実サービスを実行した記録ではない。
- 完了時整理は今回のtest-host-logging-ui/test-session-shutdownの成功をそれぞれ直近3回保持。未知の旧記録・失敗profile・固定ビルド/Release資料は保持し、.artifacts追加削除0。Appletの旧GUIが残した自身のTemp画像3件だけを境界/内容/終了確認後に削除。commit/push/Release/実利用deployなし。

## 2026-10-10: 実装・コミット・リリースの共通手順と検証再利用

- ユーザー依頼でdocs/development-workflow.mdへ本体/全Appletの段階別手順を集約。実装時は必要試験を選び版更新/publishまで、コミット時に必要回帰を全実行し修正/再発行後にcommit、リリース時に対象変更のコミット漏れと未pushを確認・解消する。
- 再利用条件はtree/対応commit、依存/関連環境・兄弟repo・未管理入力、完全な成功ログ/終了コード/SHA256の一致。文書のみの差分は明示して検査する。新規配布物と公開後検証は再実行。標準Prepareは変更せず、既存preflight/sealを用いてtypecheck/regressionの証跡だけ再利用する作業手順をRELEASINGへ追加し、再利用情報はseal対象ログへ残す。
- 30.PROJECT共通指示、本体AGENTS/DEVELOPMENT、6AppletのDEVELOPMENTと既存3AppletのAGENTSから参照。廃止された本体入口のALICE参照と親文書の誤った相対リンクを整理。変更前は本体/6AppletともGit作業ツリーcleanを確認。
- 検証: 対象手順14ファイルの相対リンク等162件が存在、追加した相互参照見出しの存在、Release手順の8項目がrelease.cjsのCHECKSと順序込みで一致、preflight/seal CLIとrelease.ps1のコマンド/ログ/出力契約を読取り照合。全7repoのgit diff --check成功。
- 文書だけのため製品回帰/GUI/ビルド/版更新/publish/Releaseの実行なし。証跡再利用経路の実Release試行は今回行っていない。スクリプトによる証跡自動判定を実装したものではなく、作業者が照合して既存準備処理を実行する手順。commit/push・実利用deploy・Codex内蔵メモリー更新なし。

## 2026-10-10: ポータブルEXEの実行時展開先の相談（変更なし）

- ユーザーは自動展開物を同期不要と考え、LOCALAPPDATA配下へ展開可能か質問。scripts/portable.nsi/build-portable.cjsを読取確認。現展開先はTEMP/AppDock.at365-PortableId、IDはTEMP/外側EXE/test-profileに基づく。EXEの配置フォルダーへは展開しない。PORTABLE_EXECUTABLE_DIR/FILEは元のEXEを子へ渡し、共有設定や素材の配置はこの展開先とは別。最後のruntime lease終了後に専用の子フォルダーだけを削除する。
- LOCALAPPDATA/at365/AppDock/runtime/識別子への変更はcustom NSIS templateで可能。ただし現時点では設計候補。変更する場合は安定した実行パス、Tray identity、二重起動/更新/再起動/親異常終了時のmutex/leaseと限定削除を維持し、実EXEで再検証する。今回の実行先変更・版更新・再発行・実利用展開先の整理は行っていない。
- READMEに残っていたログイン保存先の旧.appdock記載を現LOCALAPPDATA方式へ修正し、現TEMP展開と同期対象外を明記。並行するUI/その他差分は保持。読取/文書だけのため製品テスト再実行・テスト削除は対象なし。

## 2026-10-10: 0.26.15 at365保存先とプロフィール素材

- ユーザーの追加指定によりPC専用rootを%LOCALAPPDATA%/at365/AppDock/profiles/<配置ID>/へ変更。native updaterの許可rootも同時に変更し、旧namespace/別アプリrootは拒否する。APPDATA/LOCALAPPDATAへはat365を挟むという全アプリ共通方針と、今後のAppletも同期データはEXE配置内・端末固有データはホストのLOCALAPPDATA領域という規則を共有AGENTS/本体AGENTS/開発ガイドへ反映。現在のHost APIのSettingsは共有、Storage/SecretsはPC専用のApplet別領域を維持する。
- 続く指定で新しいアバター登録先を.appdock/assets/profile/<元ファイル名>へ変更。名前未指定のPNGもこの中のavatar.pngへ保存する。元bytes保持・同名別画像拒否・登録原素材の保持を同じ処理へ統一し、EXE隣へ新規avatar.pngを書かない。従来の参照は読み取り互換を残し、旧データの自動移動/削除は追加しない。
- 最終型検査と回帰190/190成功（at365-path-typecheck.log、at365-path-regression.log）。native helperは実LOCALAPPDATA内のランダムで不存在のIDに対し、at365/AppDockを受理、旧AppDock/別アプリを拒否し、保存ディレクトリを作成しないことも確認。既存の隔離journal復旧/設定受信/backup/素材/キー/.NET等の回帰を含む。
- 元名画像登録/同名拒否/不正画像/登録原素材保持/キー/.NET/再起動のsource GUI成功: .artifacts/preferences-1791613082761、at365-path-preferences.log。最終単一EXEの通常起動2配置GUI成功: .artifacts/settings-sync-ui-1791613228647/result.json（portable-production-path、10項目）。test-profileを使わず各fixtureのLOCALAPPDATAだけを隔離し、at365保存先・Chromium/Gmail分離・settings受信/dirty/backup/名簿・音声・profile画像単独変更/再起動を確認。実2PC/同期サービス/実認証ではなく隔離ファイル配達の試験。
- 最終固定単一EXE smoke成功: .artifacts/smoke-1791613278248/smoke-result.json、at365-path-smoke.log。ファイル名未指定のavatar.pngが.appdock/assets/profileに保存され、実画像表示・両テーマ・React/preloadのNode非公開・ピン/キー/トレイを確認。GUIは直列、専用プロセス終了を確認。smokeは既存の隔離root契約を使い、通常起動の保存先試験と区別する。
- 追加のprofile指定が発行中に届いたため、同じ修正の0.26.15を最終再発行した。at365-path-publish-final.log終了0、単一EXE142,526,132 bytes/SHA256 3a7fc899aa617ea0fe82eac98c1a668ec6903406e7e905fccfdd5d46034c9342。feed/隔離コピー一致、梱包out59ファイル/updaterが最終ビルドと一致、文書167相対リンク・両repo diff検査成功。証跡: .artifacts/at365-path-final-check.json。Gmail0.9.2のZIP hashは不変、Gmailコード/版/配布物と既存全体ZIPは変更せず、README保存先説明だけ追随。
- 作業完了時整理: 今回方式の通常起動GUI/名前未指定avatar smoke/source profile GUIはいずれも成功1回を保持。旧preferencesの結果/旧smokeの方式や再利用が未確定の記録、失敗/認証/固定ビルド/Release資料は保持し削除0。0.26.14の成功証拠も保持。実利用データの移動/削除、他アプリの既存保存先変更、commit/push/Release/deploy、同期サービス設定変更なし。

## 2026-10-10: 0.26.14 設定同期・PC専用保存・ファイル名アセット

- ユーザーが設計から一括実装へ承認し、登録元/用途別フォルダーの元ファイル名をIDにすること、同名別内容を拒否すること、旧.appdock移行を追加しないことを指定。共有settings.json/WebApplet枠/登録素材と、LOCALAPPDATA内の配置別認証・Gmail枠/枠設定・PC状態を分離。旧PC専用データの残存警告を追加し、実利用の旧フォルダーは移動・削除していない。仕様は[設定同期](docs/settings-sync.md)。
- 安定bytesの受信/rename/poll、dirty draftと保存前revision保護、正常20世代backup、破損/欠落時のローカル正常値継続、明示確認付き復元を追加。WebApplet名簿未到着時に空ファイルを生成しない。外部の枠削除で別PCのCookieを回収予約しない。アバター原画像/WAVは元ファイル名、同名同内容の再利用/別内容の拒否、共有素材の非prune、画像だけの受信再表示を実装。
- 最終のmain/renderer型検査とホスト回帰189/189成功。同期の途中JSON/rename/復旧/バックアップ20世代/古いdraft、名簿未到着の上書き防止、名簿外部削除とローカル回収の分離、名前/内容/登録rootの検証、native updaterのLOCALAPPDATA journal/result復旧と異なるroot拒否を含む。ログ: .artifacts/settings-sync-typecheck.log、settings-sync-regression.log。Gmail 0.9.2はpublish.bat -Testで21/21成功。
- sourceの2配置GUI: .artifacts/settings-sync-ui-1791611591247/result.json。最終固定単一EXEの2配置GUI: .artifacts/settings-sync-ui-1791611784215/result.json（10項目成功）。Chromium/Gmailの保存分離、settingsの起動中反映・dirty維持と古い保存拒否・破損再起動fallback/正常受信、WebApplet枠受信と外部削除後のローカルデータ保持、Gmail枠IDの非共有、登録音声一覧の到着と枠別独立選択、元アバター名と画像だけの反映、再起動保持を確認。実同期サービスを使わずファイルを隔離2配置へ配達した試験で、2台の実PCや実Googleログインは未検証。
- アバター登録/同名別画像拒否/不正画像拒否・キーと.NET等の既存設定GUI: .artifacts/preferences-1791611134067、settings-sync-preferences.log（終了0）。Gmailの既存UI機能GUI: ../Applet.Gmail.at365/.artifacts/ui-features-1791611016171/result.json（終了0）。登録済みWAV選択・同名拒否・標準/試聴・再起動、画像/枠/検索/キー/テーマ/geometry等を確認。音声欄の両テーマ画像を目視確認。途中で旧更新フィード/alert/keybindingsを前提にしたテストfixtureが失敗し、現契約に合わせたfixture・待機/locatorへ修正して最終成功。
- WebAppletの最終単一EXE回帰: .artifacts/web-portable-1791611830475/result.json。UI登録/well-known JSON/遅延表示/remote分離、ページと別Windowの入力/toolbar、停止/再開/ribbon、複数枠Cookie分離と再起動保持/Gmail保存維持が成功。GUIを直列実行し、専用起動プロセスを終了している。
- publish.bat終了0。本体0.26.14単一EXE 142,526,458 bytes、SHA256 2b12b5aa93f12103b7337cd8637e124e49796d038cc4813be0da55b8b8076e36。feedと隔離コピー一致、梱包outの全59ファイルとupdaterが最終ビルドに一致、文書167相対リンク成功。Gmail 0.9.2更新ZIP 89,381 bytes、SHA256 1a6484571df3d02481fd449d3ac1a900fec219e4ccf3d9d0008308e6c2889238、最低host0.26.14・全8ファイルのZIP/発行先一致。証跡: 両repo .artifacts/settings-sync-final-check.json、host settings-sync-publish.log、Gmail settings-sync-gmail-build.log。確認スクリプトのasar区切り/ZIP根階層の前提を修正して最終照合成功。
- 終了済みテスト整理: WebApplet portable成功の直近3回を保持し、古いweb-portable-1791531774239だけ削除（109,019,930 bytes）。結果/絶対root/再解析点/43プロセスの実行画像と候補参照0/全ファイル排他読み取りを確認。同期GUIはsource2/portable1の成功を保持。preferencesの個別resultなし、旧Gmailの方式/再利用不明、失敗・不明の資料は保持。結果: .artifacts/settings-sync-cleanup-{result,removed-proof}.json。通常publishのみで既存0.26.11全体ZIPのhash/size不変、未変更Applet再発行・commit/push/Release/実利用deploy・同期サービス設定変更なし。

## 2026-10-10: 古い成功テストフォルダーの整理

- ユーザーの削除依頼により、本体と全6Appletの`.artifacts`を確認。成功結果と実行方式を判定できるものを種類/方式ごとに直近3回まで保持し、それより古い94フォルダー（本体70、Gmail24）を削除。合計9,102,018,616 bytes（約9.1GB / 8.48GiB）。他5Appletは安全に削除できる条件を満たす古い成功分がなかった。
- 削除候補はrepoの`.artifacts`直下の検証済み絶対パスだけ。各repo/親/配下の再解析ポイントを除外し、結果JSONのhash・ファイル数/サイズを再照合、使用中プロセス/旧パス参照・ディレクトリの削除可否・配下ファイルの排他読み取りを確認してからPowerShellのLiteralPathで削除した。コマンドラインを取得できないAppDock群は実行パス/親PIDから実利用配置の子プロセスと確認、停止やACL変更はしていない。削除失敗/使用中による保留0件。
- 直近の成功結果69件のSHA256が不変、全削除候補が消え、その他の保持予定項目がすべて存在することを再確認。失敗/状態不明/実行方式不明のテスト536件、固定ビルド出力、Release/all-in-one資料、旧版移行資料、Gmailのgmail-dev/avatar-match-live、単独の調査ファイルは保持した。成功専用schemaはkeybindings/gesturesの末尾assert後のchecks形式も確認し、ただの名前/経過日数で削除していない。
- 本体0.26.12のEXE/feed SHA256と各Appletのpublish全33ファイルのhashが不変。Gmailの開発用データ3,166項目は改名時の棚卸しからsize/mtime/属性が不変。製品コード・版・設定変更/再発行/Release/deployなし。
- 候補/保持理由/全削除名/再照合結果は`.artifacts/cleanup-20261010-plan.json`、`cleanup-20261010-result.json`、`cleanup-20261010-verification.json`。調査のschema一覧と削除スクリプトは`A:/XX.TEMP/artifacts-cleanup-survey-20261010.json`、`remove-old-artifact-tests-20261010.ps1`。同期設定はユキちゃんが担当する。

## 2026-10-10: 開発生成物を`.artifacts`へ改名（0.26.12）

- ユーザー指定でrepo直下の`artifacts`を`.artifacts`へ改名。最初の通常/sandbox外の改名はアクセス拒否、ユーザーの中断・再開後の再試行は成功。原因は断定せず、ACL変更・実利用プロセス停止・旧データ削除は行っていない。Applet.WindowsTools.at365が元の場所に存在し、Git作業ツリーがcleanであることも再開時に確認した。
- 改名前後の74,986項目（ファイル51,473、通常ファイル合計42,783,730,897 bytes）の相対パス/サイズ/更新日時/ディレクトリ・リンク属性が一致。主要EXEと直近2件のRelease planのSHA256も移動直後に一致。棚卸しは`A:/XX.TEMP/appdock-artifacts-rename-20261010-before.json`と同`after.json`。保存済みJSON/ログの内部絶対パス・当時のhashは書き換えていない。旧記録のAppDock内の`artifacts/`は`.artifacts/`へ読み替える（各Applet自身の同名フォルダーは対象外）。
- 本体のビルド/開発起動/テスト/Release既定出力先/共有Appletパッカー/package.json/TypeScript fixture出力/Git除外と開発手順を更新。WindowMoverのDEVELOPMENT.mdも本体ホストを参照するコマンド1行だけ更新。以前からの未コミット文書変更を保持。製品のpackaged起動時のresources配置は変更なし。同期/バックアップ/スナップショットの除外設定は未変更。
- 型検査成功、`dev.bat test`は171 pass/0 fail。sandboxのpnpm依存検査待機を中断して通常環境で再実行し、依存検査も成功。変更CJS37件の構文、PS1の3件の構文/UTF-8 BOM、git diff --check成功。実行用ソース/スクリプト/テスト/設定に旧保存先参照なし、実行後も旧`artifacts`が再生成されないことと`.artifacts`のGit除外を確認。ログは`.artifacts/rename-20261010-{typecheck,test,publish,ui,portable,applet-pack}.log`。
- source GUIは`.artifacts/ui-1791568489764`で8群成功（.NET起動/コマンド/停止、設定保存、暗号化秘密、JSON保護など）。単一EXE smokeは`.artifacts/smoke-1791568492288`で終了0/ok:true、設定/avatarを隔離profileへ保存。共有`pack-applet-update.ps1`もdotnet-demo fixtureだけで終了0、update.zip/feedのsize/hash一致。未変更の製品Appletは再発行していない。
- 版更新後publish.bat終了0。本体EXEは142,514,767 bytes、SHA256 `ef4c8d0d412c6d1353371cbb11aa587b5ea74d9423efd518dc7096287e17bf5f`、0.26.12のfeedと隔離EXEコピーが一致。通常publishのみで全体ZIP作成/整理、GitHub操作、commit/push、実利用deployは行っていない。移動した直近2件のRelease planのhashは検証終了時も不変。
- 完了時整理: 今回のsource GUI/portable smokeは各方式1回なので直近3回保持の範囲内。改名した既存profileについては過去の使用終了・旧版資料の再利用要否を今回一括で確定していないため保持し、削除0件。フォルダーの改名で既存証跡を失わないことを確認した。

## 2026-10-09: キー割り当てのクリアをその他メニューへ明記（0.26.9）

- ユーザーの判断委任により、Deleteを解除キーにせずその他メニューを採用。従来の「削除…」をショートカットでは「キーのクリア…」へ明確化し、確認後に選んだIDの行だけを共有draftから除く。無効行/停止中でも操作でき、最後の割り当てを外した登録済みコマンドは未設定行へ戻る。他の割り当て/トレイ設定を維持し、空キーを保存するために検証を緩めない。
- 共通BindingActionsへremovalKindを追加し、ショートカットのメニュー/確認文/確定ボタンをクリア表記へ変更。ジェスチャーは既定の削除表記/確認を保持。Deleteのキー記録、通常の下書き保存/破棄・revision・登録エラー表示のしくみは保持。
- main/renderer型検査/build、Prettier/git diff --check/文書ローカルリンク97件成功。専用ソースGUIはshortcuts-ui-1791556431021の7群成功。複製した同コマンド行のクリア/キャンセル・元の割り当て保持、停止中Appletの無効行の解除→未設定表示→正常保存→終了/再起動後の解除保持、別コマンド/順序保持、Deleteをキーとして記録できることを検証。従来の登録競合/再試行、全列位置、採番、メニュー境界、両テーマ/3幅、保存/再起動も成功。
- gestures-ui-1791556254224のUI-only4群成功。共通部品変更後も従来の削除/確認/キャンセル/パレット/並べ替えを確認。実OSマウスジェスチャー入力は今回の対象外。保存形式/native入力/依存/lockfile/BAT変更なし。
- publish.bat終了0。0.26.9の単一EXEは142509665 bytes、SHA256 `0a0a5c88a0d70061e0e0836992a53d7a196537947c9b0627d70d655bd58dc712`、update.jsonの版/size/hash一致。既存0.26.2全体ZIPの個数/size/hash/更新日時ticks不変（artifacts/shortcut-clear-publish-result-20261009.json）。未変更Applet再発行/全体ZIP作成・整理なし。
- 発行した同一SHA256の実単一EXEコピーでも専用GUI7群成功（artifacts/shortcuts-ui-1791556619999/result.json）。無効/停止中行のクリア、確認キャンセル/複製行だけの解除、正常保存・終了/再起動後の解除保持、Deleteキーの記録、従来の登録競合/表示/採番/両テーマ3幅を確認。実利用設定・認証データは試験に使っていない。
- README/仕様/開発/AGENTS/版ノートと検証を更新。前の未コミット変更を保持し、今回もcommit/push/Release/実利用deployなし。
- 仕上げでメニュー幅を内容に合わせ、全項目が省略されないことをGUIで照合。ユーザーの追加指定で最終文言を短い「キーのクリア…」へ揃え、同じ0.26.9を再発行して上記最終hash/GUIを確認した。途中の実EXE試験は記録時のOS解除待ちで停止したため、試験側でホストを明示表示してからfocusする形へ修正し、最終EXEで成功。製品の入力処理/待機は変更していない。

## 2026-10-09: 正常時のショートカット表示整理・記録時の行位置安定（0.26.8）

- ユーザー承認で正常時の「登録済み/未登録」を省き、有効なglobal行かつ利用可能なコマンドの登録エラーだけを表示。「分かりづらくなる不要な表示」も対象とし、正常な複数割り当てにも出ていた「同じキーの割り当てあり」を省いた。同じキーの全一致/順次実行は上部の共通説明に残す。全体順メニューは「全体の実行順を上げる/下げる」と明記。未入力・現在利用不能・実登録エラー・再試行・完全コマンドID等、判断や対応に必要な表示は保持。
- 記録/再同期による一時的な空statusesでは直近の非空結果を表示専用に保持。同じ有効global行・同じコマンド/キーのエラー表示と絞り込みを再検査結果まで維持し、無効/別scope/利用不能の行へ古いエラーを表示しない。設定draft/JSON/revision/saveやbackendの実登録/入力処理へこのキャッシュを使わない。
- 型検査/build、Prettier/git diff --check/変更文書のローカルリンク97件成功。専用GUIはshortcuts-ui-1791554968135の6群成功。実Windows登録成功を確認してから、キー欄focusによるOS解除・blur後の再登録中も正常表示なし/全行高・表内行位置不変を照合。別の隔離ホストで同じキーを登録して実OS競合を発生させ、エラー絞り込み中の入力でも理由/行高を維持し、キー解放後の再試行成功でエラーが消えることを確認。複製/確認削除/追加/採番/全列座標/両テーマ・3幅/保存と再起動の既存検証も成功。
- keybindings-1791555044652の10群（実OSキー・ローカルとの重複防止・非表示・各条件・記録・順・保存）、navigation-1791555056219の17群成功。初期試験の浮動小数座標の完全一致、再試行/fixture設定復元の画面反映前の即時assertで失敗したため、0.5px未満の許容と対応する画面反映待ちへ試験を修正し最終成功。製品へ待機を追加していない。native入力・保存形式・依存/lockfile/BAT変更なし。
- publish.bat終了0。0.26.8の単一EXEは142512942 bytes、SHA256 `18f1cfee2c7538ab35865cafdcc21cd57576efef8256210f343672e8d8893519`。update.jsonの版/size/hashと一致、既存0.26.2全体ZIPの個数/size/hash/更新日時ticks不変（artifacts/shortcut-status-publish-result-20261009.json）。未変更Applet再発行や全体ZIP作成/整理なし。
- 同一SHA256の発行済み実単一EXEの隔離コピーでも専用GUI6群成功（artifacts/shortcuts-ui-1791555238339/result.json）。2つの実ホストでWindows登録エラーを確認し、正常focus/blur時の全行位置/高さ不変、エラー絞り込み・記録中の保持・再試行成功後の解消を検証。全列位置、両テーマ/3幅、メニュー、採番、保存と完全終了/再起動も成功。実利用設定・認証データは使用していない。
- README/開発/キー仕様/AGENTS/版ノートと検証記録を更新。既存の未コミット変更を保持、今回もcommit/push/Release/実利用deployなし。

## 2026-10-09: 全グループの列位置・幅配分・グループ内採番（0.26.7）

- ユーザー報告の列ずれを発行済み0.26.6の隔離コピーで再現。AppDock/短い名前/長い名前の3グループの先頭列は58.32/88.49/70.41pxで不一致（artifacts/group-columns-before-20261009.log、該当shortcuts-ui profileのgroup-columns-latest.json）。グループ見出しは既に表の外であり、原因はグループ別の自動テーブルレイアウトによる内容依存の幅計算。
- 両エディターに共通colgroup/table-layout: fixedを適用。追加指定で順番64px/有効52pxへ縮小、キー/ジェスチャー180px/条件200pxへ拡大、その他48pxを維持。コマンド列は残り幅、最小720pxの表を内部横スクロール。先頭2列の余白・ドラッグつまみの文字/間隔も調整し、番号とスイッチが収まる配置へ整理。
- ショートカット番号を提供元グループ内で1から表示。全行からグループ別番号を求めてから検索/状態フィルターを適用し、検索中も番号を保つ。ドラッグ後の採番は新しいグループ順へ追従する。保存配列の順序・dispatcherの条件/実行順はこの表示変更で変更しない。
- main/renderer型検査とbuild成功、Prettier/git diff --check/変更文書のローカルリンク97件成功。最終ソースGUIはartifacts/shortcuts-ui-1791553487915/result.jsonの5群成功。AppDock/2Applet（長いグループ名含む）と2ジェスチャーの全列座標/幅が一致し、dark/light・1280/900/700px全6組で両その他列48px、メニュー画面内/行高不変/main横overflowなし。番号A=1,2/B=1、検索中Aの2を保持、ドラッグで番号更新、他提供元位置保持・スイッチ・追加・複製・削除・保存/再起動を確認。
- navigation-1791553191170の17群、gestures-ui-1791553516587のUI-only4群成功。Applet詳細/共有設定の回帰、ジェスチャーのスイッチ/ドラッグ/メニュー/選択パレット/保存を確認。実OSマウス入力は今回のUI-onlyから除外。入力フック・nativeモジュール変更なし。全体unit167件は直前の0.26.6で成功済みで、今回の表示変更では型検査/既存GUIへ検証を絞った。
- publish.bat終了0。0.26.7の単一EXEは142514821 bytes、SHA256 `ba0202b905b8e22ab316c5740b60288ad525a062106581282a80c20f957931d5`、update.jsonの版/size/hash一致。既存0.26.2全体ZIPの個数/size/hashと更新日時（ticksを含む）不変。証跡artifacts/group-columns-publish-result-20261009.json。未変更Appletの再発行/全体ZIP作成・整理なし。
- 発行した同一SHA256の実単一EXEコピーでも上記専用GUI5群が成功（artifacts/shortcuts-ui-1791553673947/result.json）。全3キーグループ/2ジェスチャーグループ、両テーマ/全3幅で列座標と幅一致、その他は両方48px。グループ内採番/検索時番号保持、ドラッグ/スイッチ/パレット/複製/削除/保存/再起動を確認。実利用の設定・認証データは試験に使っていない。
- README/開発文書/AGENTS/版ノートを更新。0.26.6からの未コミット変更を保持したまま本修正を追加し、今回もcommit/push/Release/実利用deployなし。

## 2026-10-09: ショートカット/ジェスチャー編集UIの統一と細い操作列（0.26.6）

- ユーザー確認済みの0.26.5をmainへ`7b629f7`でコミットし、cleanを確認してから本変更を開始。ショートカット表を順番/有効/コマンド/キーバインド/いつ・どこで/その他の6列へ変更し、共通Toggle、ドラッグハンドル、選択専用CommandPalette、BindingActionsの浮動メニューをジェスチャーと共用。複製は既存条件を維持、削除は確認を通す。既定復元・全体の実行順操作・トレイ表示を保持した。
- グループ内のドラッグ/上下キーは他提供元の保存位置を保持。新規割り当ては空キーの下書きから始め、キー未指定の保存を拒否。特殊キー選択、提供元に限定した追加、追加後のキー欄フォーカス、記録中のホットキー停止/復帰を確認。終了・再起動の注意文をコマンド欄へ移し、両表の操作列を細くした。追加ボタン/メニューの角丸とやわらかいアクセント色を統一。
- main/renderer型検査、dev.bat testの167/167成功（artifacts/shortcuts-ui-tests-20261009.log）。追加unitは提供元内の並べ替えと実際のresolver順、他提供元位置・元配列の保持、グループ外drop拒否、保存形式のround-tripを確認。Prettier、git diff --check、変更文書のローカルリンク97件成功。依存/lockfile/BAT変更なし。
- ソースGUI: navigation-1791550774701の17群、shortcuts-ui-1791551226223の5群、keybindings-1791551229626の10群成功。キーGUIは実Windows入力、local/owner/別Window/Gmail/Web条件、記録・複製・順序・無効化・保存を含む。新規選択からコマンドが実行されないこと、空キーの保存拒否、メニューを開いても行高不変、削除キャンセル/確認、グループ外dropで未変更を確認。
- ジェスチャーGUIはgestures-ui-1791551350224のUI-only 4群成功（ネイティブ入力skipを明示）。共通メニュー・スイッチ・並べ替え・パレット/IME/フォーカス復帰・設定保存を確認。通常モードの初回は対象ウィンドウの前面取得に失敗したため、今回の実OSマウスジェスチャー入力は未確認。製品の入力フック/dispatcherは変更していない。
- publish.bat終了0。AppDock.at365.exeは0.26.6、142515253 bytes、SHA256 `2cb726de3d6bad2e6c1ba4ea872c63f3fca05ff71468f3cb3664e87277d46b7e`。publish/update.jsonの版/size/hash一致、既存0.26.2全体ZIPの個数/size/hash/更新日時不変（artifacts/shortcuts-ui-publish-result-20261009.json）。本体EXE/更新情報だけを通常発行し、未変更Applet再発行・全体ZIP作成/整理なし。
- 実単一EXE: 同一SHA256の隔離コピーでscripts/shortcuts-ui-test.cjsを実行し終了0。artifacts/shortcuts-ui-1791551793540/result.jsonはok:true、追加/保存/ドラッグ/上下キー/複製/確認付き削除/完全終了と再起動の5群成功。再起動後Ctrl+Tabとowner条件の保持を確認。dark/light、幅1280/900/700pxの全6組でショートカットの操作列51.02px、ジェスチャー48px、メニュー画面内・main横overflowなし。PNGを保存し、両表を目視確認。実利用の設定・認証データは使用していない。
- README/DEVELOPMENT/仕様/AGENTS/0.26.6版ノートを更新。今回の0.26.6は未コミット、push/GitHub Release/実利用deployなし。

## 2026-10-09: Applet設定の集約・独立ショートカットタブ・表示順（0.26.5）

- Applet詳細を説明/設定/ショートカット/ログの4タブへ整理。設定ページのApplet別一覧と本体専用キー入口を削除し、全体キー一覧をAppDock→保存されたApplet順→提供元不明のグループにした。上部tablist/tab/tabpanelとキーボード循環、固定ログsource、未保存入力/JSON/revisionの共有を保持。
- AppletIndexのトグルON中は全件表示・検索停止とし、ドラッグハンドル/上下ボタン/上下キーで共有draftのappletOrderを編集。全体保存/破棄に含め、再起動後も順を保持。WebAppletも対象、新規IDは末尾、不在IDは表示せず保存に保持。ホーム一覧/対象Applet候補も同じ順を使い、keybindingsの保存/実行順・起動順・ribbon.orderは変更しない。
- main/renderer型検査、dev.bat testの166/166、Prettier、git diff --check、変更文書のローカルリンク95件成功。新規unitは旧設定の補完、ID検証、不在/新規IDと順変更、元配列とキーの実行順の保持を確認。通常環境のtypecheck成功を確認し、sandboxのpnpm供給網確認の待機は中断した。依存/lockfile/BATの変更なし。
- ソースGUI: applet-order-1791548121973の4群、navigation-1791548125155の17群、applet-default-shortcuts-1791548134118の3群、web-applets-1791548134894の12群成功。ui-1791548270138（8群）、ribbon-layout-1791548272763（3群）、tray-ui-1791548315489も成功。旧入口のテストを新しい上部タブ/全体グループへ更新し、既存トレイ試験の固定ジェスチャーメニュー/完全ID表示の期待値も現行仕様へ修正した。フォーム/JSON/競合/破棄、停止中キー、設定action、ログ独立、Webアカウント/Gmail保存先、リボン/トレイの動作を確認。
- dark/light、幅1280/900/700pxのPNGを保存し、900pxの並べ替えとグループ画面、700pxの4タブを目視確認。等分flexで長いショートカット名が窮屈になったため自然幅へ修正し、単行/非切れ/ヘッダー座標/横overflowの検証成功。
- publish.bat終了0。AppDock.at365.exeは0.26.5、142514363 bytes、SHA256 `5d625c88e0e521f960d923604670bab894b753bcca73af30ff397f92e20cd502`。publish/update.jsonの版/size/hash一致（artifacts/applet-layout-publish-result-20261009.json）。既存0.26.2全体ZIPの個数/size/更新日時/hash不変。新版全体ZIPの作成/旧ZIP削除/未変更Appletの再発行はなし。
- 実単一EXE: publishと同じSHA256の隔離コピーでscripts/applet-order-ui-test.cjsを実行し、artifacts/applet-order-1791548674214/result.jsonはok:true。実ドラッグ・上下キー・共有設定/キーの保存と破棄・WebApplet順・全体グループ・dark/light全3幅・完全終了/再起動/順保持の4群成功。NSISのchild inspector出力はPlaywright electron.launchへ流れないため、直接接続の初回試行は停止して今回のprofileに一致する試験プロセスだけを終了し、既存web-applets-portable-testと同じ隔離CDP方式へ試験を修正した。製品への検証用API追加なし。
- README/DEVELOPMENT/ホスト開発/キー仕様/AGENTS/版ノートを更新。commit/push/GitHub Release/実利用deployは未実施。実利用中の設定・認証データは試験に使用していない。

## 2026-10-09: 通常publishとReleaseの分離・公開済みReleaseの3件保持（0.26.3）

- ユーザー指定で実装→版更新→変更モジュールのpublishを通常フローとし、本体のdistからpack:all-in-oneを分離。Release Prepareにpack-all-in-one工程を追加し、全体ZIPの作成・検証とseal成功後の旧版ZIP整理をリリース準備へ移した。通常publishは本体EXE/update.jsonだけ、変更したAppletは各repoで発行する。
- 追加指定のGitHub整理は公開後Verifyの成功保存後に共通release-retention.cjsで実行。公開日時順で最新3件の公開済みReleaseを保持し、古いRelease/assetだけを削除する。draft・Gitタグ/履歴は保持。全ページ取得、候補/保持対象/latestの再照合、削除前後と応答不明状態の記録を実装。Appletは公開後検証結果を保存して共通コマンドを実行する手順へ統一。
- 関連回帰: release.test.cjs/release-retention.test.cjsの16/16成功。既存all-in-one.test.cjsの隔離Git repoによる再発行/失敗時保持等の1件も成功。旧ZIPの数値版比較・新版/新しい版/別名/ネスト/backup保持・publishのjunction拒否、公開検証失敗時の削除抑止、整理失敗時もverified保持、3件以下/ページ分割/draft/対象変化/通信断の再開を確認。GitHubと公開ダウンロードはfixture。最終ログはartifacts/release-split-tests-20261009.log。
- 初回sandboxのfixtureはTEMPのGit書込/rename拒否で失敗。通常環境の隔離試験で成功。その後A:内TEMPで既存plan更新に一時的なEPERMが1件発生したため、既定TEMPで再実行し全件成功。製品のrename処理は変更していない。発行完了前の先行照合では旧feedの版不一致を検出し、終了0後の正式照合で解消した。
- SetVersionで0.26.2→0.26.3、README整合、型検査・ビルド・publish.bat終了0。単一EXEは142506046 bytes、SHA256 `c1b7181a7721248232ceca1fd82219f265bf78dfae55d21e036ae801ed486664`、update.jsonと一致。全Appletのpublishと既存ZIPの計34ファイルは発行前後で一覧/size/SHA256/更新日時一致。0.26.3全体ZIPは未生成、既存0.26.2 ZIPは保持。証跡artifacts/publish-scope-before-20261009.json、publish-scope-result-20261009.json、publish-split-20261009.log、publish-split-typecheck-20261009.log。
- 発行済み単一EXEの隔離smoke成功（artifacts/smoke-1791543109263、publish-split-smoke-20261009.log）。起動/保存先/プロフィール/トレイ等を確認。正式Prepare・実GitHub公開/削除・実利用deploy・commitは行っていない。releaseスクリプトは配布EXEに収録されないため、公開整理の追加後に同じ製品を再発行する必要はない。
- 共通30.PROJECT/AGENTS、本体AGENTS/DEVELOPMENT/README/all-in-one/RELEASINGとALICEの継続記録を新方針へ更新。前項の「通常発行後に旧ZIP整理」という当初指定は、この追加指定によりリリース時だけの実施へ変更。

## 2026-10-09: publishの旧版オールインワンZIP整理

- ユーザー指定で、新版の配置・検証成功後にpublish直下の旧版オールインワンZIPを削除する手順をAGENTS.mdとdocs/all-in-one.mdへ記録。発行失敗時は旧版保持。作業手順の整備であり、発行スクリプト・アプリ実装・版は変更していない。
- 現行0.26.2のpackage.json/update.json/ZIP内bundle.jsonの版一致、EXEのsize/SHA256、ZIPの安全なパス・重複拒否・全21ファイルのsize/SHA256・同梱本体の一致を再確認。全6Applet収録。実行結果は`artifacts/publish-zip-cleanup-20261009.json`。
- 0.23.0〜0.26.1の旧版ZIP9個を削除し、残存ZIPが`AppDock.at365-all-in-one-0.26.2.zip`だけであることを確認。アプリの変更・再発行・起動試験・commit・公開・実利用deployは行っていない。

## 2026-10-09: Applet別ショートカット初期値と一括初期化（0.25.2）

- `extension.json`の宣言コマンドだけを初期割り当てに指定できるようにし、初回発見時だけ設定へ追加。Gmail 0.9.1はCtrl+Tab/Ctrl+Shift+Tabをowner条件、Watch 0.1.2はPauseをglobal条件で宣言。本体のApplet固有既定値は除去。既存設定・ユーザーが解除した行を再追加せず、Applet詳細の一括初期化は対象Appletの行だけを下書きで置換する。
- WebAppletは将来の新規追加用テンプレートを設定画面で編集可能にし、作成時の保存で個別行へコピー。既定はリロードF5、戻るAlt+Left、進むAlt+Right、すべてowner/有効。既存WebAppletを遡及変更しない。WebAppletのコマンドと本体ツールバーは「リロード」へ改称。
- 型検査/build、全回帰136/136成功。sandbox内の最初の全体試験は一時フォルダーのEPERMとローカルHTTP接続待ちで完走せず、プロジェクト内一時領域と通常Windows環境で再実行して全件成功。新しい初期値・既存編集保持・Webテンプレート・Applet一括初期化のunitに加え、隔離GUIのApplet初期化3群（`artifacts/applet-default-shortcuts-1791532245168`）、WebApplet12群（`artifacts/web-applets-1791532251940`）、条件付きキー10群（`artifacts/keybindings-1791532292669`）成功。
- `publish.bat`終了0。AppDock単一EXEは100611885 bytes、SHA256 `6478fca6083f7f34ec1490ea8b85b66a1cecd5581a767f70afa3919419ec78a4`で`publish/update.json`の版0.25.2・size・hashと一致。全6Applet入りZIPは275734979 bytes、SHA256 `f922051edee927569815e2a29668d79bb0ad3a955d77adf03d4f62110e0c07fb`。`scripts/all-in-one-ui-test.cjs`でZIP全ファイルhash/size、安全な隔離展開、6Applet版/初期無効/起動を確認（`artifacts/bundle-verify-6110b7e8-bfb3-464a-aaed-573f162ad5ff`）。展開直後の設定にGmail2行とWatch1行が期待条件で存在した。
- 実単一EXEの隔離WebApplet3群も成功（`artifacts/web-portable-1791532267933`、版0.25.2/hash一致）。実Gmail認証と実利用先deployは試験していない。GitHub公開はこのローカル発行の対象外。

## 2026-10-09: Applet詳細タブを0.25.1へ版更新・コミット準備

- ユーザーがタブ表示を確認し、バージョンインクリメントとコミットを依頼。SetVersionで0.25.0→0.25.1、READMEの現行版とv0.25.1の変更ノートを整合。追加指定により、今後の完成時は版更新とpublish発行をセットにする方針を共通/本体AGENTSへ反映。通常修正はパッチ番号、再試行/未変更Applet同梱だけでは追加インクリメントしない。
- 型検査成功、`publish.bat`終了0。sandboxで版更新直後のpnpm確認が待機し、その対象だけを中断して通常Windows環境の型検査は終了0。lockfile/依存版に変更なし。
- 発行EXEは100611563 bytes、SHA256 `917e43727bb298f0227a7c637bc545a2ea8d21efcaadfe699d33b8746c6f648a`。update.jsonと0.25.1全体ZIP内の本体の版/hash/size一致。全6Applet/21ファイルの整合と安全な隔離展開を既存verify-all-in-one.ps1で確認（`artifacts/detail-tabs-0.25.1-publish-20261009.json`）。
- 0.25.1発行win-unpackedのnavigation GUI17群成功（`artifacts/navigation-1791529668175`）、実単一EXEの隔離smoke成功（`artifacts/smoke-1791529678569`）。push/GitHub Release/実利用deployは依頼範囲外。

## 2026-10-09: Applet詳細を横並びの説明・設定・ログタブへ統一

- ユーザーの横並び希望とUI判断の委任に基づき、可変ラベルの操作ボタンを固定の3タブへ統一。アイコン/選択色、tablist/tab/tabpanel、単一選択と左右循環/Home/Endの操作を追加。同ページの下だけ切り替え、共有設定draft・不正JSONの保護・対象Appletへのログ固定・別Applet選択の説明復帰を保持。
- 型検査/build/diff check成功。開発GUI17群成功（`artifacts/navigation-1791527251407`）、WebApplet GUI12群成功（`artifacts/web-applets-1791527306856`）。初回画像で説明/設定の2文字が折り返したためnowrapとアイコン縮小禁止を追加し、dark/light・700/900/1280pxでラベル1行/クリップなし、タブとヘッダーの座標一致、横overflowなしを検証・目視確認した。
- 既存JSON下書き試験のElectron fillがWindowsで全選択を失い追記になる現象が再発。下書き状態の検証はtextareaのnative value setterとinputイベントで入力し、全選択のOS状態に依存しない試験へ変更。製品のキー処理は変更していない。
- `publish.bat`終了0、単一EXE/update.json/全6Applet入りZIPを最新ソースで更新。版は0.25.0のまま。本体100608412 bytes、SHA256 `7ee2f092c84c40880e33cd045d61dd42e33cc359dbd4191e03753adb73fdaab8`。feed/hash/size一致、ZIP内本体一致、全21ファイルのhash/sizeと未収録ファイル/パスを既存verify-all-in-one.ps1で検証・隔離展開（`artifacts/detail-tabs-publish-20261009.json`、`artifacts/detail-tabs-bundle-20261009`）。
- 発行済みwin-unpackedのnavigation GUI17群成功（`artifacts/navigation-1791527467639`）、実単一EXEの隔離smoke成功（`artifacts/smoke-1791527478061`）。publish版でも上記タブ操作と共有設定・ログの回帰を確認。Release公開/commit/push/実利用deployなし。

## 2026-10-09: Applet内ログ変更をpublishへ発行・完了時の発行を定常化

- ユーザー指定で、アプリ実装・修正の完成時はRelease前でもpublishへ発行する方針を30.PROJECT/AGENTS.mdと本体AGENTS.mdへ記録。ソース/開発ビルドのみを完了とせず、既存発行手順・終了コード・成果物・隔離起動を確認する。公開/版更新/deployは別の指示に従う。
- `publish.bat`終了0。本体単一EXE/update.json/全6ローカルAppletのオールインワンZIPを発行。sandbox内の初回.NET発行は終了1、通常Windows環境で既存手順を再実行して成功。版は0.25.0のまま、commit/push/Release/実利用deployなし。
- EXEは100609519 bytes、SHA256 `ccf8dd13f9aaeb3013dd16f75d33dea06d183a9dacb6ebf82d0c72039605a24b`。update.jsonのhash/sizeと一致、ZIP内本体も一致。bundle.json記載の21ファイルのhash/sizeを検証（`artifacts/inline-logs-publish-20261009.json`）。ZIP内のWindows区切りを正規化して照合した。
- 発行済みwin-unpackedでnavigation GUI16群成功（`artifacts/navigation-1791526686735/result.json`）。初回は既存JSON fillの一時追記で失敗し、再試行成功。Applet内ログ・説明復帰・下書き保持・全体ログ独立・dark/lightと幅900/1280pxを確認。
- 実単一EXEの隔離smoke成功（`artifacts/smoke-1791526714472/smoke-result.json`）。起動・UI bridge・元EXE隣への設定保存・プロフィール画像・トレイ動作を確認。今回のZIPは収録整合の確認で、全実Appletの個別操作試験とは区別する。

## 2026-10-09: Applet詳細内でログを表示

- 「ログを見る」を別ログページへの遷移から、同じApplet詳細内のログ表示へ変更。説明・設定・ログを排他的に切り替え、両操作ボタンの位置と見た目を保持。選択Appletのsourceに固定し、既存LogsPageの検索・レベル・保存先操作を共用する。別Applet選択で説明へ戻り、リボンのログページのsourceと共有しない。
- `dev.bat run typecheck`、`dev.bat run build`、`git diff --check`成功。隔離Electronのnavigation GUI16群成功（`artifacts/navigation-1791526237083/result.json`）。固定source/空結果/検索/レベル/説明復帰/設定との往復/下書き保持/全体ログ独立を検証。dark/light、900/1280pxで切替ボタンとヘッダー座標一致・横overflowなし、900pxのログ画像も目視確認。
- sandbox内のElectron起動は失敗し、通常Windows環境の隔離profileで検証。初回GUIは既存JSON入力試験でfillが追記になり失敗、再実行で解消。追加試験の見出しlocatorがsidebarのh2も拾ったためh1へ限定して修正。最終GUIは全群成功。
- 版更新・publish・実利用deploy・commit・push・Releaseは未実施。ソースと開発ビルドでの確認結果。

## 2026-10-09: 条件付きショートカットを0.25.0としてリリース準備

- 新規キー割り当てはApplet提供元を既定にし、本体/提供元不明はAppDock全体。既存行のキー変更・複製は条件を保持。ショートカット表/コマンドパレット/ホームのピン留め/トレイ動作選択へ完全なコマンドIDを表示し、ID・コマンド名・提供元名の検索を維持した。
- 0.25.0へ版更新。型検査/build成功。専用GUI10群（`artifacts/keybindings-1791523433971`）、設定保持7群（`artifacts/preferences-1791523444534`）、画面遷移16群（`artifacts/navigation-1791523485549`）成功。dark/lightと700/900/1280pxを含む。ナビ試験の旧補助表示「未確認のコマンド」への依存を完全ID表示に合わせて更新した。
- 版変更後のpnpm依存確認はsandboxで停止し、対象プロセスだけを終了して通常環境で再実行した。lockfileは変更なし。OSキー試験の仮想キー送信は複数回未到達。非同期送信/試験順分離だけでは改善せず、試験ヘルパーに任意のScanCode方式を追加して実OS入力を確認した（比較試験`artifacts/keybindings-1791523386732`と最終GUIの双方で成功）。製品のキー受付へ待機/送信方式変更は加えていない。外部フック等の低レベル原因は断定しない。
- ユーザーがこの会話のショートカット基盤全体と上記2点をまとめた版更新/公開を依頼。最新Releaseはv0.24.2、origin/mainは`1e2a2a50d4fd86b76689d7015df57e0762bc23f9`、v0.25.0未使用、全6Applet checkout cleanと読取確認。正式Prepare→Draft→Publish→Verifyの実行証跡は`artifacts/release-0.25.0-shortcuts-20261009/plan.json`へ記録し、固定配布物の追加ショートカット/ページGUIも確認する。最終結果/公開URL/ハッシュはPlanとALICE日記を参照。実利用先deployは行わない。

## 2026-10-09: コマンド提供元のAppletページ条件を追加

- `owner`条件を追加し、現在のコマンド登録元extensionIdとアクティブページを照合。提供元名だけ（例: Gmail）を表示し、「すべてのApplet → 提供元名 → 指定したApplet」の順に配置。本体コマンドでは提供元項目を出さない。既存のpages/applets設定は意味を保つ。
- 型検査/build、条件・登録元・不明/本体・フォーカス・保存形式を含む専用unit 8/8成功。ソースGUI9群成功（`artifacts/keybindings-1791522519621`）。発行win-unpackedでも提供元内で実行/別Appletでは非実行、Gmail名だけの表示、本体項目除外、順序/保存を確認。
- 発行版GUIの実Windows入力試験は2回`Expected d,a`で停止。発行ヘルパー単独では同じSendInputを受信。診断用にOS通知/Web入力の観測だけを加えたGUIは9群成功（`artifacts/keybindings-1791522762511`）、ローカル重複防止/全Window非表示の2回ともOS通知を確認。製品コード/入力待機は変更していない。最初の未到達の低レベル原因は未特定。診断スクリプトは`artifacts/keybindings-owner-probe.cjs`に保存。
- `publish.bat`終了0。0.24.2のローカル確認版を再発行。EXE100612225 bytes/SHA256 `88c5afdb1d3978f748a4a200983822aeaf28babac0d81e8360fd8567086c41b3`とupdate.jsonが一致。全6Applet入りZIPの全ファイルsize/hashと本体一致、隔離展開した単一EXE起動/全Appletの版・初期無効を確認（`artifacts/owner-keybindings-bundle-result.json`）。実利用設定変更、deploy、commit、push、公開なし。

## 2026-10-09: 条件付きショートカット版をローカルpublishへ発行

- 追加依頼により`publish.bat`を実行し終了0。本体単一EXE、update.json、全6Applet入りZIPを更新。版は0.24.2のままのローカル確認用で、公開済みReleaseとは内容が異なる。deploy、commit、push、GitHub公開は行っていない。
- EXEは100610698 bytes、SHA256 `d9aa0f054789a38de1a0d7ae41022dbfab12d9e2cb149294052cc49f34f9b879`。update.jsonのsize/hashと実単一EXE試験コピーが一致。
- 発行したwin-unpackedで専用ショートカットGUI7群成功（`artifacts/keybindings-1791521847798`）。実単一EXEのWebApplet GUI3群も成功（`artifacts/web-portable-1791521873121`）、起動、設定/Cookieの再起動保持、リボン停止/復帰を確認。
- 同梱ZIPは275734355 bytes、SHA256 `81dd08a3c8aaf3e5da3feadd4f4bda37c2da4ffa00bd409d3a5738d7358c5aec`。全21ファイルのsize/hash、本体EXE一致、隔離展開後の実EXE起動、全6Appletの版と初期無効状態を確認（`artifacts/keybindings-publish-bundle-result.json`）。実利用設定/認証データは変更していない。

## 2026-10-09: 条件付きショートカット基盤（未公開）

- 割り当て単位のkeybindings、4種類のscope、複数Applet選択、全一致/保存順実行、同一コマンド重複除去、実行中再入抑制、失敗後の継続/終了時打切りを実装。旧設定は新形式がない時だけ利用し、新形式の空配列も維持。実利用settings.jsonの編集/破棄は行っていない。
- `dev.bat run typecheck`、`dev.bat run build`成功。通常権限の`dev.bat exec node --test tests/*.test.cjs`は132/132成功（新規7件含む）。初回sandboxではTempのrename/子プロセスが拒否され失敗したため、通常権限で再検証した。
- 専用GUI `scripts/keybindings-ui-test.cjs`は7群成功。最終証跡`artifacts/keybindings-1791521496874/result.json`、dark/light PNG。本体、localページ、WebApplet埋め込み/別Window、ページ切替後の捕捉済み実行対象、GmailローカルUI/オフライン本文、Ctrl+Alt+F10の実RegisterHotKey/SendInput、ローカルとの重複防止、全Window非表示、複数対象、記録中解除、順序/無効化/保存を確認。
- 既存GUI: `applet-pages-ui-test.cjs` 6群（`artifacts/applet-pages-1791520900394`）、`preferences-ui-test.cjs` 7群（`artifacts/preferences-1791521158229`）、`navigation-ui-test.cjs` 16群（`artifacts/navigation-1791521170308`）成功。.NET/Node実コマンド、再起動設定保持、両テーマ、狭幅、フォーム/JSON/各設定入口の下書き共有、Gmail session/入力/背景監視を含む。
- 途中の試験失敗: 素のF18/F23はOS登録競合。検証用ファイルの同時読取でatomic renameがEPERMになり、fixtureを追記型の別キー保存へ変更。GUI再起動ではPlaywrightのfocus emulationと実Windowフォーカスを区別して待機。Ctrl+Altキー一括SendInputはOS通知/対象WebContentsの双方へ届かない回があり、UIなしの最小ホストでは到着を確認。試験ヘルパーで押下中の修飾キーを待ち、各押下/解放を20ms間隔で送って最終GUI成功。製品の受付頻度に待機は追加していない。外部フック等を含む低レベル原因の断定はしない。
- 利用境界: Applet Web画面は文字入力保護のためCtrl/Alt付き・F1〜F24・Pause。本体の通常入力欄は既存保護、IME/リピート/キー記録を除外。native Appletの独自Windowはページ条件に含めない。実Gmail認証環境、物理キーボードの全配列/IME組合せ、配布単一EXEでの今回の変更は未検証。今回は版更新、publish、deploy、commit、push、Releaseを行っていない。


## 2026-10-09: 停止中Appletのリボン修正を0.24.2としてリリース

- ユーザーがローカル修正版の正常動作を確認し、版更新/公開と、不具合があった直前のRelease削除を指定。0.24.2へ更新し、下記のWeb/Gmail共通リボン修正と関連回帰をコミットする。Gmail Appletの版・API・保存形式は変更しない。
- 現在のGitHub latestはv0.24.1（Release ID 407459037、対象commit d57e9d4eac4403346adfc97733db74ecc6af3aa3）、v0.24.2のタグは未作成と読取確認。新しい`artifacts/release-0.24.2-ribbon-20261009/plan.json`で正式Prepare→Draft→Publish→Verifyを行い、固定配布物のWeb/既存ページGmail/リボン配置/実単一EXEの追加GUIも直列実施する。
- 新版のVerify成功後にv0.24.1のReleaseとアセットを削除し、Gitタグ/コミット履歴を保持する。削除前metadata・削除結果・latest/旧タグ照合は同じartifactsへ保存する。最終の版・hash・公開状態はPlanとALICE日記を参照し、Prepare後にソース/ノート/配布物を変更しない。実利用先deployは行わない。

## 2026-10-09: 停止中のWebApplet/Gmailをリボンから非表示

- 公開済み0.24.1のローカルEXEを隔離コピーして再現。AppletページでWebAppletを無効化してもアイコンが残る回帰を、`artifacts/web-ribbon-before-fix.log`の`disabled WebApplet ribbon disappears`で検出した。ユーザーの追加指定によりGmailも含め、実リボンのページ一覧を有効なAppletだけに限定した。設定の一覧・保存済み表示/順序/上下配置、開始待ち/エラー中の有効なApplet、コマンドによる明示起動の契約を保持する。
- project-local Node/pnpmの型検査・ビルド成功。ページ/WebApplet/Webプロフィールの回帰16/16成功、fail/skip 0（`artifacts/web-ribbon-typecheck.log`、`web-ribbon-build.log`、`web-ribbon-unit.log`）。Web GUIの最初の配置比較は画面更新前に読み取って失敗したため、保存済み下寄せの画面反映を待つ試験へ修正して成功。最終ソースの既存ページ/Gmail GUIも成功（`artifacts/web-ribbon-pages-source.log`）。
- `publish.bat`でローカルの通常単一EXE・update.json・全6Applet入りZIPを再発行、終了0（`artifacts/web-ribbon-publish-final.log`）。版は0.24.1のままのローカル確認用修正版で、今回のコミット/push/新Release公開/公開済みアセットの置換/実利用先deployは行っていない。
- 最終固定配布物の隔離GUIを直列実行し、全て終了0/ok:true。Web12群=`artifacts/web-applets-1791516642725/result.json`、既存ページ/Gmail6群=`artifacts/applet-pages-1791516651144/result.json`、リボン配置3群=`artifacts/ribbon-layout-1791516661820/result.json`、実単一EXE3群=`artifacts/web-portable-1791516667616/result.json`。Appletページの実スイッチで停止→対象だけ非表示→再開→リボンから正常表示、Gmail/WebのCookieとアカウント保持、上下/順序/手動非表示の保持、停止したWebAppletの再起動後の非表示を確認。実サイト認証・実メール受信は今回の変更範囲外。
- 最終EXEは100609206bytes、SHA256=`559fa6d46142c025f0a1510363e8bf5b6fe2bb541934df2c190bff092d87f5a2`。update.jsonのsize/hash、ZIP内の本体、実単一EXE試験コピーが一致（`artifacts/web-ribbon-artifact-check.json`）。README/開発ガイド/ページ・WebApplet仕様/repo AGENTSへ挙動を反映。

## 2026-10-09: Webアカウント改善と通知起動先修正を0.24.1へ統合

- ユーザーが「Gmail通知の起動先を修正」の完了を待って一緒にコミット/Releaseすることを明示承認。完了を確認し、Webアカウント独立管理・即時操作・削除後処理・名前blur/Escapeと、配置先/profile別の通知protocol activationを同じ本体版へ統合する。Applet API/各Appletの版・単一EXE形式は変更しない。
- 統合前の実測は各節の記録を参照。通知側は回帰124件と2か所の実EXEでWindows Shell activation/二重実行防止/終了済みAppletのcallback抑止/cold起動を確認。最終WebソースGUIは11群成功。物理的なGmail通知クリック/実受信は未自動検証、更新前の通知には以前の起動先が残る。
- 0.24.1のコミット後に、[Release手順](docs/RELEASING.md)のPrepare→Draft→Publish→Verifyで正式検証/公開を行う。新規証跡は`artifacts/release-0.24.1-web-notification-20261009/plan.json`と隣のログへ保存する。Prepareで固定したEXEに対しWeb/既存ページ/通知/単一EXEの追加GUIを直列確認し、公開後は匿名取得ハッシュと実PortableUpdates.checkを照合する。実利用先deployは依頼範囲外。

## 2026-10-09: Webアカウント名のフォーカス確定・Escape取消

- 名前欄のフォーカスが外れた時にも即時確定し、確定前のEscapeで保存済みの名前へ戻す。Enter/専用ボタンを維持し、空欄/IME変換中の確定と同じ値の重複送信を避ける。名前変更と直後の削除/クリアを直列化し、非同期反映中に入力した次の編集を保つ。一般設定の保存とは独立する。
- 型検査/TS/Vite build成功。隔離した最終ソースのWeb GUIは`artifacts/web-applets-1791514657911/result.json`でok:true、11検証群。Tab/マウスのフォーカス移動、Enterと続くblur、Escape後の表示復元とaccounts.jsonのbyte不変、および既存の独立操作/下書き保持/警告/実Cookie削除/次回起動回収を確認。
- 最初のローカルpublishはwin-unpackedディレクトリのEBUSYで停止（`artifacts/web-account-name-edit-publish.log`）。同じrepoで「Gmail通知の起動先を修正」の作業が進行していることを確認し、ユーザーが通知修正の完了を待ってまとめて新バージョンのReleaseへ進むよう指定した。別作業の変更やプロセスを破棄/停止せず、完了後にcleanな統合ソースから新規Release Prepareを行う。

## 2026-10-09: 枠の削除で保存データを消去・回収し、ローカルpublishへ発行

- ユーザーの改善承認により、枠除去だけだった削除を保存データも消す動作へ変更。警告は取り消せない削除と次回起動時の後処理を説明し、キャンセルを既定とする。生成済みsessionはCookie/サイト/cache/HTTP認証cacheを消去して接続を閉じ、枠とpendingDeletionを同じatomic writeで保存する。未生成のsessionディレクトリは即時物理削除、生成済み/ロック中は次回起動のsession生成前へ回収を延期する。失敗は削除待ち記録を保持して再試行、登録/参照/同プロセス生成済みの枠は回収せず、削除済みsessionの終了時再flushも避ける。旧版の削除記録がない残存領域は自動削除しない。
- project-local Node/pnpmで型検査/build成功、全回帰121/121・失敗/skip0（`artifacts/web-account-delete-regression.log`）。追加の隔離試験ではロック失敗の注入→保存→再起動→回収、参照/生成済みガード、パストラバーサル・root/対象junction拒否・nested junctionの外側保持を確認。ソースWeb GUIは`artifacts/web-applets-1791513133518/result.json`でok:true。
- 最終固定win-unpackedのWeb GUIは`artifacts/web-applets-1791513398956/result.json`でok:true、11検証群。実Cookieの削除、取消での保持、削除待ち通知/記録、終了/次回起動後のディレクトリ消失、別枠Cookie/Gmail領域/設定byteの保持を追加確認。既存ページ/Gmail GUIは`artifacts/applet-pages-1791513407222/result.json`でok:true、5群。旧0.24.0の実Cookie移行も`artifacts/web-profile-migration-1791513596748/result.json`でok:true。
- ユーザー指定により`publish.bat`で本体/更新情報/全6Applet入りZIPをローカル発行。初回はZIPの最後のFile.Replace(null backup)だけが「置換されるファイルを削除できません」で終了1（`artifacts/web-account-delete-publish.log`）。対象の排他open/属性/ACLを確認し、同じ完成ZIPをstage内backup付きFile.Replaceで安全に置換できたため、発行スクリプトもこの方法へ修正。既存の再発行/不正入力時の前ZIP保持テスト1件成功、`pack:all-in-one`を再実行して終了0（`artifacts/web-account-delete-publish-recovery.log`）。PS1はUTF-8 BOM/CRLFを確認、BAT/ACLは変更しない。
- 最終単一EXEは`artifacts/web-portable-1791513417496/result.json`でok:true。`publish/AppDock.at365.exe`は100607357bytes、SHA256 `83a3de4872933cfa4415f86d23cb0e3b26c592b59aa1980f6daa614bb2d27cfc`、update.jsonと一致。ZIPは275730805bytes、SHA256 `18908c1bcb66c7e95e00e0855d3c4739089f35c30d3c5c72a97c5a2b2be95fc9`。既存verify-all-in-one.ps1で全inventoryのsize/hashを照合・隔離展開し、本体単体EXEと一致、6Applet収録を確認（`artifacts/web-account-delete-bundle-result.json`）。版は0.24.0の開発用ローカル生成物、今回の変更は未コミット、ユーザー指定によりGitHub公開は最後にまとめる。実利用先deploy/実サイトログインは実施していない。

## 2026-10-09: Webアカウント管理を独立ページ・即時操作へ変更

- 追加のソース確認: ユーザーの残存データへの質問により、deleteAccountは一覧からの除去だけでsessionディレクトリを削除せず、clearAccountもCookie等の消去APIのみでディレクトリ回収を行わないことを確認。削除した枠のIDは再利用されず、UIから操作できない残存データが生じる。自動回収は未実装と文書/AGENTSへ追記。今回の確認では製品コード/実利用データを変更せず、ビルド/GUIの再実行は不要と判断。

- 0.24.0公開後の追加依頼。設定に独立した「Webアカウント」カテゴリを設け、WebApplet側には使用枠の選択と管理ページへのリンクを残した。枠の一覧を`.appdock/web-applets/accounts.json`へ分離し、追加/名前変更/登録削除を設定draft/revision/saveと独立して即時保存する。削除/クリアはキャンセルを既定とするwarning dialogで確認する。保存済み/下書きの使用中枠の削除ガード、保存時の参照検証、旧設定のID/sessionを保つ初回移行を追加。詳細は[WebApplet](docs/web-applets.md)。
- project-local Node 24.21.0/pnpm 12.10.1で型検査、TS/Vite build、`dev.bat run dist:host`が終了0。回帰118/118・失敗/skip0（`artifacts/web-account-settings-regression.log`）、最終ビルドでWeb関連8件も成功。GUI/実EXEは隔離profileを使う通常Windows実行で確認した。最終GUI追加チェックの初回は試験側のボタン探索範囲が狭くtimeoutしたため、正しいサイドバーへ修正して再実行した。
- 最終win-unpacked GUIは`artifacts/web-applets-1791512094425/result.json`でok:true、10検証群。独立ページに保存バー/フォーム・JSON切替がないこと、即時追加/名前変更/削除と再起動、settingsのbyte/revision不変、正常/不正JSONの下書き保持とAppDock設定への帰還、削除/クリアのwarning・取消/確認、使用中枠のガード、共有枠の画面終了/Cookie消去と別枠/Gmail領域の保持、従来のWeb表示/遷移/入力保持を確認。dark/lightの管理ページPNGを目視確認。
- 既存ページ/Gmail GUIは`artifacts/applet-pages-1791511074248/result.json`でok:true、5検証群。旧0.24.0 EXEで実Cookieを作って新ソースへ引き継ぐ移行GUIは`artifacts/web-profile-migration-1791511299195/result.json`でok:true。旧一覧から専用ファイルへの移行、ID/session/Cookieの保持、移行後の即時名前変更でsettingsのbyte/revision不変を確認した。旧版の検証用コピーは`artifacts/web-account-legacy-0.24/win-unpacked`へ保持。
- 最終単一EXEは`artifacts/web-portable-1791512101750/result.json`でok:true。UI登録、リボン複数、Cookie分離/再起動/停止、WebContents/input保持、Gmail保存領域保持を確認。ローカルEXEは100608492bytes、SHA256 `d3550e719d5d9a916fb99afb5b117ee22127ef5ffb31d7400a2498eee4b12768`でupdate.jsonと一致。版は0.24.0のままの開発用生成物であり、公開済み0.24.0のEXEとは異なる。今回の変更は未コミット、GitHub公開/実利用先deploy/オールインワン再発行は未実施。実サイト認証・HTTP認証サイト固有挙動・長期背景動作は今回確認していない。

## 2026-10-09: WebApplet（0.24.0）の実装と公開前検証

- URLごとに本体管理のWebAppletを追加し、Applet一覧/リボン/コマンド/共有設定へ統合。最大64件、専用アカウント32枠、page/windowの載せ替え、固定/同じorigin/HTTP(S)遷移、認証用の明示originを実装。Gmailの設定・アカウント・session保存先を流用せず、リモートにはNode/preload/ホストIPCを公開しない。詳細は[WebApplet](docs/web-applets.md)。版は0.23.0→0.24.0。
- project-local Node 24.21.0/pnpm 12.10.1でmain/renderer型検査、TS/Vite build成功。回帰115/115、失敗/skip 0（`artifacts/web-applets-regression-final.log`）。通常sandboxでは既存.NET/TEMP置換試験のEPERMやElectron起動の制約が出たため、隔離profileを使う通常Windows実行で判定した。グローバルツールは追加していない。
- 最終ソースのWeb GUIは`artifacts/web-applets-1791491534872/result.json`でok:true、9検証群。UI登録とmanifestの自動name/icon/navigation、手動変更の再取得保持、same-origin redirect後の相対パス、別originへ取得要求を送らないこと、JSON容量制限、トップレベルのリンク/redirect/popup/固定モード、追加origin/any/履歴/ローカルキー、同じWebContentsでのpage/window切替と入力保持、専用Cookie分離/共有/保存、消去の取消/確認、無効化/削除時の破棄を確認。消去dialogの回答は試験profileのmain内でだけ置換し、製品の確認手順は維持した。dark/light画像と1000px幅の画面を目視確認。
- 既存ページ/Gmail GUIは`artifacts/applet-pages-1791491048430/result.json`でok:true、5検証群。ローカルページの所有command bridge、UI/session/input保持、Gmailの選択アカウント/検索/背景監視、リボン非表示/並べ替え、再起動・停止をオフラインfixtureで確認。Web GUIと単一EXE試験ではGmail保存領域のmarkerバイトも不変。実利用の認証情報を読み込まず、実メール送信/実サイトログインはしていない。
- コミット前の0.24.0単一EXE試験は`artifacts/web-portable-1791491242393/result.json`でok:true。実配布EXEの隔離コピー（SHA256 `9f8ee6a9bcd8067c77dee20965e19b48f83a99e7dbcc15dae4bc6f87667162e6`）を通常起動し、UI登録、well-known JSON、遅延生成、リモートのbridge不存在、page/window入力保持、toolbar履歴、複数ボタン、専用Cookie、再起動、停止、Gmail保存領域の保持を確認。このEXEは以後の終了時保存/取得処理の仕上げ前の検証物であり、最終配布物のハッシュとして扱わない。
- 正式公開にはclean mainを対象に[Release手順](docs/RELEASING.md)のPrepare→Draft→Publish→Verifyを使用する。今回の最終ソース/配布物/115件回帰/単一EXE更新/進捗/8停止点復旧/全Applet同梱とGitHub匿名取得照合の結果は`artifacts/release-0.24.0-web-20261009/plan.json`と隣のログへ保存する。Prepare後に固定したEXEでWeb GUI、既存ページ/Gmail GUI、Web portableも直列確認する。実利用先へのdeployは依頼範囲外、サイト固有の認証可否と長期背景動作は未確認。

## 2026-10-09: 更新通知変更をコミットしpublish.batで発行

- ユーザーの承認により、成功通知変更と関連文書/指示をmainの`3c8b4ef`へコミット。続けて`publish.bat`を実行し終了0、通常EXE/update.json/6Applet入りオールインワンZIPを発行。ログは`artifacts/update-notice-publish-2026-10-09.log`。版は0.23.0を維持、GitHub公開/push/実利用先deployは未実施。
- 通常EXEは100599103bytes、SHA256 `7b4486595d71bdf3d86cf6eb7bf860c02821aadc97c0d8cb897836248d31c9ce`。update.jsonのsize/hashと一致。ZIPは275723984bytes、SHA256 `cc2aaf9b7eedfd4fcdf699a731dc7082828dcac7650f51d0b006645b591f2594`。`artifacts/update-notice-publish-hashes-2026-10-09.json`へ保存。
- 固定した発行物でGUI試験を直列実行。配布win-unpackedの通知チェックは`artifacts/update-notice-1791486954229/result.json`でok:true。dark/light、自動/手動消去、main領域不変、フォーカス非奪取、失敗結果の継続表示、トレイ開始から開いたときの通知を確認。
- 単一EXEの隔離smokeは`artifacts/smoke-1791486973286/smoke-result.json`でok:true。オールインワンは全収録ファイルのsize/hash・本体単体EXEとの一致・各Applet更新ZIPとの一致を照合し、新規隔離フォルダーへ展開して通常起動。`artifacts/update-notice-bundle-result-2026-10-09.json`はok:true、6AppletすべてのID/版一致・初期無効・EXE隣に設定生成を確認。各Applet固有機能/実ログイン操作は今回再試験していない。

## 2026-10-09: 更新適用後のお知らせをステータスバーへ移動

- mainの既存cleanなcheckoutで、起動時結果の成功だけを左下のミント色のピル型通知へ変更。本文/リボン/ネイティブWebページの領域に重ねず、約5秒でフェードアウトし、×で即時に閉じる。失敗結果と更新中の進捗は従来の上部表示を維持。配布形式・更新用helper・設定保存形式は変更していない。
- project-local Nodeでmain/rendererの型検査とTS/Vite build成功。既存`tests/portable-updates.test.cjs`12件成功、失敗/skip0。sandbox初回の4件はhelperのTEMP操作にAccess denied/EPERMが出たため、通常Windows環境で再実行して12/12を確認。
- 隔離したElectron開発起動のGUI検証は`artifacts/update-notice-1791485945591/result.json`でok:true。dark/lightで22pxの通知がfooter内に収まり、隣の操作と重ならないこと、表示時のフォーカスを奪わないこと、自動消去前後のmain領域一致、手動消去、失敗結果の継続表示、トレイ開始から5秒以上後にWindowを開いても通知が表示されることを確認。両テーマのPNGを目視確認。
- 非表示でもdocument.hiddenがfalseだったため、BrowserWindow実状態をsnapshotへ渡してtimerを制御。初回GUI起動はsandboxで失敗、通常Windows環境で検証。GUIで更新結果fixtureだけを書き、実ファイル交換・実メール/ログイン操作は今回実行していない。単一EXE再発行・実利用先deploy・commit・push・Releaseは未実施。

## 2026-10-09: publish.batでオールインワンZIPを生成

- ユーザー指定の「Appletは拡張として同梱」に対応。cleanなmain 8a4d96eから`codex/all-in-one-package`を作成。`publish.bat`が呼ぶ`dist`を本体発行`dist:host`と`pack:all-in-one`へ分割し、単一EXEと更新JSONに加えて`extensions/<repo名>`入りZIPを生成する。BAT自体・文字コードは未変更。本体の版/API/UIコードは0.23.0のまま。
- 新しいPowerShell処理は兄弟直下の`.git`/manifestを持つ全repoを対象とし、各publish.batを直列実行。ID/正式版/最低本体版の事前検査、feed/ZIPのsize/SHA256、展開後manifest/entry照合、commit/dirty/全ファイルhashのbundle.json、完成後のZIP置換を実装。失敗時に以前の完成ZIPを保持する。本体側の設定/認証/ログは収録しない。
- `publish.bat`の実実行は終了0（`artifacts/all-in-one-publish-final.log`）。本体/.NET helper/TS/Vite/portableと全6Appletの再発行、オールインワン生成まで通した。初回はWindows PowerShellの環境でGet-FileHashが解決できず失敗したため、.NET stream/SHA256へ変更して最初から再実行した。pnpm/依存/グローバル設定の変更なし。
- `tests/all-in-one.test.cjs`成功、終了0（`artifacts/all-in-one-tests.log`）。実helperを使った隔離fixtureで正常発行、変更したAppletの再発行/既存ZIP置換、発行exit19・改変ZIP・最低host不足・ID重複による失敗と以前のZIPのhash保持を確認。
- ZIPは275724048bytes、SHA256 `92a17694df699133353dc43160b68dc76eded545b4766b8b9621f13ac45f345c`。`artifacts/all-in-one-package-result.json`はok:true。本体EXE/bundle.json/6Appletの計22ファイル、収録一覧/全size/hash、本体単体EXEとの一致、各Appletの更新ZIP全ファイルとのバイト一致を確認。発行時のローカルソースを記録しており、GitHub既存assetとの一致を要求するものではない。
- ZIPから新しい隔離profileへ展開して通常起動。`artifacts/all-in-one-ui-1791481347816/result.json`はok:true、終了0。Gmail0.9.0、Wallpaper0.4.0、Watch0.1.1、WebBrowserTools0.2.4、WindowMover0.2.1、WindowsTools0.1.1をすべて認識、初期無効/エラーなし/EXE隣に設定生成/既定GitHub更新元を確認。about画面の画像を目視確認。各Appletの固有機能・実ログイン操作は今回再試験しない。
- README/DEVELOPMENT/[発行ガイド](docs/all-in-one.md)を更新。通常更新feedは単体EXEのまま、オールインワンZIPは初回導入用の追加assetとする。既存GitHub Releaseの上書き・新規公開・実利用先deploy・main統合は未実施。

## 2026-10-09: v0.23.0 更新配布物・進捗・中断復旧

- ユーザーの「順番に」「2は全部が終わったら確認する」指定に従い、1のApplet発行標準化、3の進捗/キャンセル、4の異常中断復旧を実施。2の実GitHub/HTTP(S)/UNC配布先確認はユーザー担当として[チェックリスト](docs/update-checklist.md)へ分離。AppDockは既存`codex/portable-updates`の5460b1e、6Appletは各cleanなmainから同checkoutの`codex/update-packages`で作業。worktreeは作らない。
- 全6Appletの`publish.bat`に共通.NETパッカーを接続し、各repoの`publish/update.json`と`publish/update.zip`を生成。6件終了0、ID/版/entry・サイズ/SHA256・ZIP内全ファイルと発行元のバイト一致を確認。Gmail8、Wallpaper2、Watch2、WebBrowserTools2、WindowMover3、WindowsTools3ファイル。Watchの旧DLL/埋込済みフォント、DLL型2種の同梱不要SDKを明示名で整理して再発行。`artifacts/applet-update-packages.json`と各`*-update-publish.log`に結果。Applet本体の版変更・deploy対象の追加なし。
- 共通進捗UI、取得容量/全体/件数とキャンセルを追加。HTTP/ローカルstream・展開子プロセス・ハッシュ読込へ中断を伝播し、インストール先交換前のTEMP準備だけを停止する。確認ダイアログへ進んだ後はその取消ボタンを使う。準備中断後の再試行とチェックのみの取消を追加テストで確認。
- helperは準備前のjournal、全交換後のcommitted記録、JSONのFlush(true)、全復旧対象の事前検証を追加。commit前は旧版へ戻し、commit後は新版を検証して後片付け。ロック等で復旧できないときはjournalと旧ファイルを保持する。
- main/renderer型検査、TS/Vite、.NET helperとportable発行成功。プロジェクト内Node24.21.0と既存依存を使用。最終回帰103/103、失敗/skip0（`artifacts/update-completion-regression.log`）。更新専用12件には実HTTP中断とsocket終了、再試行、metadata取消、危険なjournalの全体検証も含む。パッカーや旧交換/ZIP検証も成功。
- `artifacts/update-progress-1791476360616/result.json`はok:true。配布win-unpackedの隔離profileとループバックHTTPで、実IPC/streamの進捗、dark/lightの容量とprogressbar、キャンセル→再試行→最終確認取消、元ファイル保持を確認。両テーマ画像を目視確認。初回のDOM進捗待ち不足は、mainの進捗に加えてDOMのprogress値も待つよう試験を修正した。
- `artifacts/update-recovery-1791476324622/result.json`は8停止点すべてok:true。artifactsへコピーしたhelperソースにだけ停止点を挿入し、実プロセスを停止→製品helperで復旧。7点は旧版、commit後1点は新版、再実行の同じ結果、設定/認証fixture保持を確認。7点目では本体ファイルを別プロセスが使用中の失敗→journal/backup保持→解除後復旧も成功。初回の試験用ロック処理の挿入失敗はCRLFを正規化して修正。製品に故障注入スイッチなし。実電源断/ディスク障害の試験ではない。
- `artifacts/portable-updates-1791476387252/result.json`は9条件ok:true、終了0。実.NET Applet一括交換、実単一EXE交換/再起動、個別同版再適用、設定/認証fixture/無効状態保持、起動時metadata確認だけ、トレイ開始ONからの更新/通常再起動でabout/一般/Appletページ復元を確認。最終native確認ダイアログだけ試験内で差替え。`artifacts/navigation-1791476399630/result.json`も成功。
- 最終EXEは100596899bytes、SHA256 `71FAA4C6670D2662F195936F45D9FBFFDE13F73D9136BB9869CDC14CE1B8BF02`。feedの版/サイズ/hashと一致、最終asarのmain/portable-updates JSおよび同梱helperが検証した出力とバイト一致。ビルドログは`artifacts/update-completion-build.log`。Prettier、Git差分、ローカル文書リンク、PowerShellのBOM/CRLFを確認。BATは未編集。
- 実利用先deploy・main統合・push・GitHubへの公開は行っていない。実GitHub/HTTP(S)/UNC配布先の到達性・公開設定・実ログインデータでの確認はユーザーの後日確認として残す。

## 2026-10-09: v0.22.1 更新UIと再起動先の復元

- ユーザーが0.22.0の実再起動成功を報告。既存codex/portable-updatesのcleanな0369100から継続し、同じcheckoutで実装。更新/一括/個別の主操作をラベンダー色にし、共通設定/実行環境/各Applet更新元を折りたたみ、Applet更新元をインストール済みカードへ移動。本体/各Appletに既定復帰、未保存時は確認も含めて操作を無効化。下端のステータスバーは小さいボタンを維持。
- 通常再起動/helper再起動で--restore-viewを渡し、トレイ開始ONでも表示。ページ/設定カテゴリ/選択Applet/タブ/ログ対象をプロフィール内へ保存。Appletページは起動完了後に既存コマンドで開く。終了時のsurface破棄通知が保存先をホームへ変えていた不具合も修正。
- main/renderer型検査、TS/Vite、portable発行成功。取得済みプロジェクト内Node/TypeScript/Viteを使用（dev.batのpnpmポリシー検証は停止していたため中断、依存/ポリシーの変更なし）。既存.NETホスト/helperは変更せず再使用。回帰100/100成功（artifacts/update-ui-regression.log）。
- GUI: navigation-1791474293115、preferences-1791474300038、ui-1791474721303、host-commands-1791474669899はいずれもok:true。既存設定共有/保存/JSON/ショートカット/正常終了/多重再起動防止を確認。
- 最終portable試験 artifacts/portable-updates-1791474708972/result.json はok:true、終了0。通常起動はトレイ非表示、dark/light・900pxの横はみ出しなし、初期折りたたみ/主操作/本体とAppletの既定復帰/保存・破棄/下書きガードを確認。実helperで.NET DLLを含む一括更新→本体EXE交換→個別同版更新を通し、毎回の設定/認証fixture保持と更新画面復元を確認。通常再起動で一般カテゴリとlocal Appletページも復元し、元のPID終了と新PIDを確認。
- 試験の最初の通常再起動visibility検査はstartupReadyを待たず失敗し、待機条件を修正。続くAppletページ復元の失敗は製品側の終了通知による上書きを修正して解消。最終native確認dialogだけ試験内で承認に差替え、製品の確認処理は維持。
- 単一EXE100596499 bytes、SHA256 2E6C7540E17A5593AE18F999BCFB27694A017826EC7F27AD7D654D6ACC24C43E。update.jsonの版/サイズ/hash一致。packaged main/core JS・helperのバイト一致と文書27 local linksを確認。画面画像を目視確認、Prettier/diff check成功。
- 境界: 実UNC/実GitHub配布の取得、実Gmail内の操作/メール状態は今回試していない。画面復元は新版が保存する画面選択が対象で、旧0.22.0から初めて更新するときの未記録の画面やWebページ内部の状態/未保存フォームは復元しない。実利用先deploy/main統合/pushなし。

## 2026-10-08: worktree削除後のpublish.bat失敗を修復

- 原因は共有node_modules内のpnpm生成参照。削除済みの`AppDock.at365.worktrees/applet-settings-panel`を指す12個のパッケージjunctionと24個の`.bin`起動スクリプトがmainに残り、ビルドツールを解決できなくなっていた。既存パッケージ本体・依存版・lockfileを維持し、存在するmain側の同一パッケージへの参照へ修復。全置換先の存在と対象パスを事前確認し、古い参照が残っていないことを確認。
- `dev.bat run typecheck`と、ユーザーが実行した入口の`publish.bat`が終了コード0。.NET framework-dependent発行、TypeScript/Vite、portableの単一EXE作成まで成功。Electron/TypeScript/Vite/electron-builder/Playwrightはmain配下から解決できる。
- 発行後の単一EXEをコピーして`dev.bat exec node scripts/smoke.cjs publish/AppDock.at365.exe`を実行。`artifacts/smoke-1791469453906/smoke-result.json`はok:true、終了コード0。起動・トレイ操作・設定/プロフィール画像保存・キー・正常終了を確認。初回`smoke-1791469407880`だけ設定ファイルrenameのEPERMで失敗し、同じEXE・スクリプトでの再試行は成功。初回の一時エラーの原因は確定していない。
- 発行版win-unpackedの`navigation-1791469464113/result.json`はok:true。設定アクション、未保存下書き/JSON/外部競合、説明/設定切替の座標と見た目、dark/light・大小画面、ログの既存遷移を確認。
- 最終`publish/AppDock.at365.exe`: 100574613 bytes、SHA256 `CEED52AE034DAE0867DD0846DF740A14951822BC6DD668551F07B760EBA6609F`。portable試験へコピーしたEXEとのSHA256一致を確認。実利用deploy・外部pushなし。
- 前の統合作業はmainの071fa3bまで完了。worktreeは削除済み、`codex/applet-settings-panel`ブランチとmainへ引き継いだ検証資料は保持。今回の依存参照修復はGit管理外で、再発防止手順をDEVELOPMENT.mdへ記載。

## 2026-10-08: Applet設定パネルへ最新mainを取り込んで統合

- ユーザーの指定により、共通設定パネルと説明/設定ボタン配置の変更をdc49658へ保存し、mainのc9b185a（設定アクション）をcodex/applet-settings-panelへ取り込み。自動マージで競合なし。既存のsettingActionsの型/検証/フォーム実行と文書・試験を保持し、共通設定パネルでも利用できる状態を確認。
- main/renderer型検査、TS/Vite build、framework-dependent .NETホスト発行成功。ホスト回帰91/91、失敗0（worktreeのartifacts/integration-regression.log）。依存更新なし。
- worktreeの隔離GUI navigation-1791468074781/result.jsonはok:true。mainのsettingActionsを宣言するNode fixtureで、詳細設定パネルの操作成功/失敗と未保存値の保持・自動保存されないことを確認。ボタン/見出しの位置と装飾、大小画面・両テーマ、JSON・下書き・競合・ログの既存動作も成功。
- ui-1791468081369/result.jsonとpreferences-1791468083979/result.jsonもok:true。Node/.NET起動・停止・設定保存と再読込、プロフィール画像、キー、再起動後の永続化を確認。Prettier/diff check成功。mainから入ったCSSの空白を整形し、再ビルド後のrenderer資産ハッシュはGUI確認時と同一。
- 検証済みのブランチをmainへfast-forward統合。検証結果・画像・回帰ログをmainのartifactsへ引き継ぎ、ユーザーの追加指定でworktreeを削除する。作業ブランチは履歴として保持。実利用の設定・認証・壁紙・Windows設定は操作せず、今回の単一EXE再発行/deploy/外部pushは実施しない。
- main統合後のTS/Vite buildも成功し、renderer資産はworktreeで検証したものと同一。mainのtray-ui-1791468482091もok:true。追加smokeはWindowsのwindowsHide:trueで初回表示判定に失敗し、3秒待機でも解消しなかった。試験の起動をwindowsHide:falseへ変えるとsmoke-1791468728937/smoke-result.jsonでトレイ・フォーム保存・アバター・キー・終了が成功。製品の表示処理は変更せず、scripts/smoke.cjsのUI試験起動だけを修正。待機処理の試作と生成JS診断は除去。途中の旧0.21.0単一EXEによる対照試験は設定renameのEPERMで未達となり、今回の成功結果には含めない。

## 2026-10-08: v0.21.0 Applet詳細の共通設定パネル

- 追加調整: 「設定を開く／説明に戻る」をヘッダー直下の共通操作列へ移動し、同一のsecondaryボタン・アイコン・幅でラベルと動作を切り替えます。ボタンより下だけ説明/設定が変わります。ログは従来の移動先・フィルター・説明側の入口を維持。ユーザーの将来の説明/設定/ログタブ案は今回は実装しません。
- 追加調整のmain/renderer型検査とVite build成功。隔離Electronの`artifacts/navigation-1791467373616/result.json`はok:true。dark/light・1280/900pxで切替前後のボタン座標/サイズ/背景/文字色/枠/余白と見出しの座標/サイズが一致し、長いフォームの保存ボタン表示、下書き・JSON・外部競合・ログ移動の既存確認も成功。切替前後の画像を目視確認、Prettier/diff check成功。初回GUIで設定側の見出し幅が縮むことを検知し、旧grid由来のalign-items:startをflexのstretchに変更して解消。今回の変更は既存worktree内だけで、main/他の未完了作業には触れず、追加発行/deploy/commit/統合/pushなし。
- AppDock mainのe4b32e7から専用worktree `AppDock.at365.worktrees/applet-settings-panel`、ブランチ`codex/applet-settings-panel`を作成。元の作業ツリーで進行中の別作業には触れていません。
- 「設定を開く」はAppletページ内の説明→設定切替へ変更。「説明に戻る」で復帰し、詳細のショートカット入口は削除。設定ページのApplet別設定は保持し、同じAppletSettingsPanelと共通編集セッション/保存操作を使用します。全下書き・JSON・プロフィール画像・revision競合を保持します。
- main/renderer型検査、Vite build、既存.NETホストのframework-dependent発行に成功。ホスト回帰90/90、失敗0（artifacts/regression.log）。追加API/設定形式/依存更新はありません。
- 隔離Electron画面 `artifacts/navigation-1791464805381/result.json` はok:true。説明/設定切替、ショートカット入口統一、双方での下書き共有・保存・破棄、複数Appletの編集、数値検証、停止中のキー保持、正しいJSONの引継ぎと不正JSONの保持、外部変更競合時の上書き拒否、24Applet、長いフォーム、dark/light、1280/900px、保存ボタンの常時表示、横はみ出しなしを確認。画像も目視確認。
- 既存UI回帰 `artifacts/ui-1791464724997/result.json` とプロフィール/キー/保存/再起動回帰 `artifacts/preferences-1791464764546/result.json` はok:true。後者は名前・画像選択/上書き・不正画像拒否と再起動後の永続化を含みます。
- Prettier、git diff --checkに成功。変更したREADME/DEVELOPMENT/host-developmentのローカルリンク64件で欠落0（worktree外の兄弟Applet参照は元repo配置で照合）。
- 検証時の修正: JSON編集後に保持済み詳細設定へ復帰した際も表示前に変換する処理を追加。不正JSONは説明へ戻して修正を案内。既存ui-testのリボン期待値に、既に存在する「テーマを切り替え」を追加。新しいJSON試験の2つのalertは表示先を指定して照合。
- 実行環境の制限: dev.batのpnpm検証が進まなかったため中断し、取得済みプロジェクト内Node/TypeScript/Viteで同じビルド・検査を実行（依存取得/ポリシー変更なし）。sandboxの.NET発行は失敗し、許可されたWindows環境で成功。回帰の初回sandbox TEMPでのrename等の失敗は、worktree内TEMPを指定して90件すべて成功。
- 今回はworktree内のソースと隔離fixtureによる確認です。単一EXEの発行・実利用先deploy・実Applet/実アカウント操作・main統合・commit・pushは行っていません。

## 2026-10-08: v0.20.0 Gmailのナビゲーション・リンク設定

- ユーザーが今回の動作を確認したと報告し、マージを指定（2026-10-08 JST）。両repoのcodex/gmail-toolbar-commandsをmainへfast-forward統合（AppDock a737ae5 / Gmail d3fc1c4）。統合直後のGit treeは検証済みブランチと一致。報告は今回全体の動作確認として記録し、個別のWindows通知などの検証範囲は推測しない。追加の製品コード変更・再発行・deploy・pushなし。
- ユーザーの正常動作報告とマージ指示を受け、前回0.19.0をmainへFF統合（327a88a）。Gmailも0.8.0をmainへFF統合（918fb59）。今回は両repoのcodex/gmail-toolbar-commandsで実施。
- Node APIにcontext.webAccounts.navigate(back/forward/reload/inbox)を追加。自身の実行中Appletだけを対象にし、UIのnavigateと同じ選択中Viewを操作する。invalid actionはView作成前に拒否。snapshot.navigationRevisionで操作画面が受信トレイへ戻れるようにする。
- webAccounts.externalLinkSettingは自身のboolean設定キーとsettings capabilityを必須にする。既定の確認を保持し、対応Appletのダイアログへ「次回から聞かずに開く」を追加。開く＋チェック時のみ設定を保存。trueならHTTP(S)/mailtoの確認を省略し、資格情報や他スキームは従来どおり拒否。重複した確認を抑制し、外部起動の失敗はログへ報告する。
- main/renderer型検査・Vite・framework-dependent .NET host/portable発行成功。ホスト回帰90/90、Gmail型検査/Vite/21/21成功。Prettier・diff check、文書ローカルリンク109件でmissing0。
- 最終win-unpackedとGmail0.9.0の../Applet.Gmail.at365/artifacts/toolbar-1791463003042/result.jsonはok:true。アイコン/tooltip/版、4コマンドと既存clear、選択枠の履歴・reload・受信トレイ・変更キー、全タブのtoolbar/一覧位置、UI↔host設定、外部リンクの取消/一度開く/記憶/再確認/再起動、未読だけ保存・再起動保持を確認。外部アプリはshell呼出しを記録するfixtureへ置換し実起動しない。
- 通知は既にGmail openコマンドを指定していたため契約を継続。新GUIは実Electron Notificationオブジェクトのshowだけを抑止し、clickイベントから実ホスト・workerコマンドを通して、本体最小化からGmailページを復元、Window設定では隠れたGmailを表示、停止後の古い通知はAppletを起動しないことを確認。Windowsネイティブ通知の実表示/人手クリックは今回未実施。
- 最終版のaccounts-1791463014150、ui-features-1791463063443もok:true。既存の設定同期/再起動/監視/音/検索/未読・削除/切替キー/位置保持を確認。画像を目視確認。
- 最終単一EXE+未改変Applet: ../Applet.Gmail.at365/artifacts/portable-1791463095688/result.jsonはok:true/host0.20.0/exitCode0。ページ・新着・履歴・クリア・停止/再開・隔離・正常終了を確認。
- publish/AppDock.at365.exeは100573045 bytes、SHA256 F777FCCF41408145C5DBD77B61BD8E0577DD303EC82EEC6CDB2E52BB3F4F54C9。実利用deploy/外部push/実Google操作は未実施。
- 初期GUIの修正: ElectronApplication.evaluateはElectron moduleが第1引数なので、カウンター比較用の引数を第2引数へ直した。ロード完了を待ち、変更キーはWebContents.sendInputEventで確認。停止状態名は既存stoppedを使用。初期の型エラーと未読フィルター解除箇所を修正し、最終版の全試験で成功。

## 2026-10-08: v0.19.0 リボンの上下配置・セパレーター

- 指示により前回のcodex/applet-pages-ribbonをmainへfast-forward統合（da2bdc1）。Gmail側もdbe84beをmainへ統合。新しい作業は両repoのcodex/ribbon-layout-gmail-polishで実施。
- リボン設定へ上寄せ/下寄せ、グループ内順番・表示、セパレーターの追加/削除/配置を実装。登録と参照を検証し、削除時はorder/hidden/bottomからも除去。未導入Appletの設定を保持。古いorder/hiddenを持つ設定は既存配置を保持し、初期化はtheme/profileを下寄せにする。
- 「AppDockのキー」を「AppDock」へ変更し、「Applet別の設定」の先頭へ移動。下書き・JSON保持・全保存・検索・所属/競合処理は既存経路を使用。
- main/renderer型検査・Vite build、ホスト回帰89/89、Gmail型検査/Vite/21/21成功。Prettier、git diff --check成功。ローカルツールによるpublish.batも成功。
- 最終win-unpackedのscripts/ribbon-layout-ui-test.cjs: artifacts/ribbon-layout-1791458897839/result.json（ok:true）。上下の実配置、セパレーター追加/削除/移動、グループ間ドラッグ、上下順番、再起動保持、削除時の参照除去、初期化、本体キーの名称/位置/検索、Gmail UIの不要要素削除と本文/先頭アカウントの上端を検証。通常幅と900×640、本体ページで横はみ出しなし。画像も目視確認。
- 開発版設定GUI: artifacts/navigation-1791458862311/result.json（ok:true）。24 Applet、複数下書き、JSON/外部更新保持、所属/競合/停止後のキー、検索/フィルター/狭幅/両テーマを確認。Gmail別Window GUIは../Applet.Gmail.at365/artifacts/gui-1791458866882、UI機能はui-features-1791458910659で成功（切替キー・個別session・音・新着/削除・位置/最大化保持）。
- 最終単一EXE: ../Applet.Gmail.at365/artifacts/portable-1791458903951/result.json（ok:true/host0.19.0/exitCode0）。未改変Gmail0.8.0でページ表示・新着・履歴・クリア・停止/再開・隔離・正常終了を確認。
- publish/AppDock.at365.exe: 100576430 bytes、SHA256 816DE9044DA45A44B361182FA0044ED08F4B2FC664CA796416743ACD31787842。.NET hostは既存手順のframework-dependent発行。実利用deploy/外部push、実Google操作・実メール送信は未実施。
- GUI初回のグループ間drag試験は移動元/先が別スクロール領域になり誤った行へ入力したため失敗。試験中のみzoomを下げて両端を可視化し、drag-handleから実マウス操作を再実行して成功。最後のGUIはzoomを通常へ戻して配置/画像を確認。Gmailボタンの同名設定入口はリボン内にscopeを限定。

## 2026-10-08: v0.18.0 Appletページとリボン

- 専用ブランチ`codex/applet-pages-ribbon`。manifestのpages（local/web-accounts）、Node/.NETのページopen API、限定ローカルUI、共通AppletSurfaceを追加。リボンの標準/導入Appletボタンを表示・非表示/ドラッグ/上下で編集し、設定と並び順を保存。設定ボタンを隠しても右クリックから戻れる。Appletごとの表示方法と独立Window状態を保存する。
- 同じUI WebContentsViewとアカウントWebContents/sessionをpage/window間で共用。ページのclient領域、command palette中のView取り外し、非選択/最小化のbackground parkを確認。ホームを表示中のcycleは、ホストWindowがアクティブでも入力を奪わないようSurfaceの表示状態を検査する。
- TypeScript main/renderer型検査・Vite、ホスト回帰88/88、Gmail回帰21/21、SDK/Runtime Release（警告0/エラー0）成功。publish.bat成功、.NET ExtensionHostはframework-dependentでcoreclr等のRuntime混入なし。プロジェクト内の既存Node/pnpmのみ使用。
- 最終win-unpackedの`scripts/applet-pages-ui-test.cjs`: `artifacts/applet-pages-1791456311809/result.json` ok:true。汎用ローカルページ、実幅、同じページ再open、入力保持、page→window→page、UI/remoteのbridge分離、Gmailの検索/選択/同一WebContents/Cookie保持、ホーム/最小化中の新着、ホーム中のcycleフォーカス保持、リボン設定の再起動保持、非表示ページのcommand起動、停止時全View破棄とホーム復帰を確認。リボン設定画像を目視確認。
- 同じ変更の発行版Gmail GUI `../Applet.Gmail.at365/artifacts/gui-1791455738683/result.json`、UI/キー/音/位置保存 `../Applet.Gmail.at365/artifacts/ui-features-1791455988932/result.json` はok:true。通常Electron・Playwrightなしのpacked-core試験 `../Applet.Gmail.at365/artifacts/native-background-1791455805763/result.json` はok:trueで、2枠の初回描画/サイト自身の継続更新/非表示reload/認証先で解除/停止時破棄を確認。
- 最終EXE: 100574904 bytes、SHA256 `E21E8A05CFBE35CC5281F6825CC867739D2325CFA43DDCC0FEE89D2C9E997EF4`。単一EXEの通常起動/CDP試験 `../Applet.Gmail.at365/artifacts/portable-1791456361645/result.json` はok:true/version0.18.0/exitCode0。未改変Gmailのページ表示/新着履歴/クリア/停止・再開/正常終了を確認。
- Prettier/diff check、更新文書のローカルリンク96件を確認。既に消えていた旧Applet.GmailCheckerへのリンク4件も現行Gmailの案内へ更新。
- 検証上の修正: ページ領域が既存max-width/margin:autoにより幅1pxへ縮んだためwidth:100%/max-width:noneを指定。GUIの旧Window直下View/仮名セレクターを現在の構成へ更新。再起動fixtureはアカウント起動前に登録し、Cookieは永続期限を指定。sandboxのTEMPではrename権限が不足するためプロジェクト内TEMPを使用。Electron GUI/発行は許可されたWindows実行環境で確認。単一EXEをElectron.launchへ直接渡す詳細試験は起動フックで180秒timeoutしたため除外し、win-unpacked詳細試験と通常EXE起動後のCDP接続を使用。
- 実Googleのログイン/実受信・実複数アカウント操作・長時間/スリープは今回未実施。実利用先deploy・mainへの統合・外部pushは行っていない。

## 2026-10-08: v0.17.1 WebアカウントUIから自身の設定を変更

- ユーザーが設定タブの正常動作を確認したと報告し、Gmail側と合わせたコミットを明示指定（2026-10-08）。検証済みコードを変更せず、確認報告と今回の実装・文書をコミット対象にした。

- ローカルUIへsnapshot.settings/setSettingを追加。自身のmanifestの宣言済みboolean/静的selectとsettings capabilityに限定し、既存SettingsStoreの保存/競合検出/変更通知を使用。停止時は購読解除。リモートページ・他Applet・ホスト全体の設定は非公開。
- dev.bat run typecheck、dev.bat run test（85/85）、dev.bat run dist成功。変更したコードのPrettierとgit diff --check成功。.NETホストは既存スクリプトでクリーンなframework-dependent発行、DLLはAppDock.ExtensionHost/Runtime/SDKのみ。
- Gmail0.6.0の発行版GUI ../Applet.Gmail.at365/artifacts/accounts-1791452824168/result.json成功。設定共有・双方向同期・監視停止/再開・保存後再起動・未宣言キー/型拒否・既存アカウント管理を確認。
- 実単一EXEの../Applet.Gmail.at365/artifacts/portable-1791452888173/result.jsonはok:true/version0.17.1/exitCode0。EXE100567486 bytes、SHA256 19C334ECEBFC849AA821DC361F77D3B275939A84AD757BF60FE6D2674E2BFD6D。実利用先への配置・実Google操作・commit/pushなし。

## 2026-10-08: v0.17.0 ウィジェット機能を削除

- ユーザーが変更内容の確認完了を報告し、コミットを明示指定（2026-10-08）。今回の削除・回帰確認・文書をmainへコミット。コードは上記依頼で検証したままで、コミット時の追加変更はこの確認記録のみ。
- ユーザー指定により、ウィジェット画面・ホームの表示・配置設定・専用IPC/preload・フォント配信・デスクトップ固定/移動・日時描画・Node API・.NET SDK/Runtime・専用試験/ガイドを削除。互換APIは残さない。Watchの現行native EXEに合わせて利用者/開発文書を修正。過去の検証記録は当時の実測として保持。
- `dev.bat run typecheck`成功、`dev.bat test`は85/85成功。設定保存の回帰では旧トップレベル配置を除去し、テーマ・キー・ピン・トレイ・プロフィール・Applet固有データ（同名のwidgetsキーを含む）が保持されることを確認。定義済みのトップレベル項目だけを保存し、Applet設定内部は変えない。
- `dotnet build AppDock.at365.slnx -c Release`成功（警告0・エラー0）。復元済みWatchも新SDK/Runtimeに対するRelease build成功（警告0・エラー0）、回帰8/8成功。Watchリポジトリのソース・manifest・発行物は変更しない。
- `publish.bat`成功。生成済み`out/main`を整理してからコンパイルするbuild-main.cjsを追加し、古いモジュールの同梱を防止。最終app.asarはversion=0.17.0、名前にwidgetを含むモジュール0件。framework-dependent .NETホストにcoreclr/hostfxr等のランタイム混入なし。
- 発行版win-unpackedを使う`ui-1791443748554`成功。ホーム/同梱専用fixtureによるNode/.NETの起動・コマンド・停止、フォーム/JSON保存、不正JSON保護、手動再読込を確認。ナビゲーションはホーム・Applet・設定・ログの4ページ、widget操作API/HostSnapshot/設定の配置項目なし、BrowserWindowは本体1つ。home.pngでホームとサイドバーを目視確認。
- 発行版`navigation-1791443751234/result.json`はok:true。設定編集中の画面移動・変更保持・キー・パレット・ログ・24Appletの一覧・大小画面・両テーマのレイアウト成功。`tray-ui-1791443823904`もok:true、既存の表示選択・単クリック/ダブル・Windows判定時間・再起動保持成功。
- 最終単一EXEの`smoke-1791443817043/smoke-result.json`はok:true。設定/アバター/ピン/キー/トレイ/正常終了成功。試験コピーと発行EXEのSHA256一致を確認。`smoke-1791443919058`では復元済みWatch 0.1.1 native EXEを隔離配置し、起動・3コマンド・表示/非表示・visible保存・パネル・終了を確認。実利用の設定/認証/プロセスは操作しない。
- 最終EXEは100566507bytes、SHA256 `16AD48FA3175AA33CE844E550F0A878E1B1DFEF00E6E05D06A681B9DDBCE186C`、FileVersion/ProductVersion 0.17.0。Prettierとgit diff --check成功。実装内のwidget参照0件、残る言及は削除説明と回帰確認だけ。実利用先へのdeploy・pushなし。
- 検証途中の失敗は成功扱いしない。publish完了前の最初のportable smokeは旧0.16.4のコピーだったため除外し、最終EXEで再実行してハッシュ一致を確認。Watch buildの最初のcsproj名誤指定は正しいApplet.Watch.csprojで修正。asarの直接requireはpnpmの依存境界で失敗し、electron-builder→app-builder-libのcreateRequire経由で検査。復元されたWatchの旧test-ui.cjsはProcess failed to launchで実行できず、現UIと古いセレクターも異なるため、そのGUI試験の成功は主張しない。新ホストとのnative接続/コマンドは既存のportable smokeで確認。全モニター/DPI・実デスクトップ描画の詳細・長期常駐/スリープは今回未検証。
- 通常execのhelper_unknown_errorは許可されたWindows実行環境で作業・検証。開始時mainはclean、既存Applet/別作業の変更破棄なし。

## 2026-10-08: v0.16.4 通知領域のアイコン識別を更新間で維持

- ユーザーが修正版の正常動作を確認したと報告（2026-10-08）。その確認を受け、今回の修正と検証記録をコミット。利用者の確認は自動試験の結果と区別し、全OS版の表示位置や将来の実利用更新まで検証済みとは扱わない。
- 旧版はTrayのGUIDがなく、electron-builder26.15.3のportable展開先がbuildごとに変わっていた。Windows NotifyIconSettingsでも複数の旧TEMPパスに個別のIsPromoted=1があり、ユーザーの毎回ピン留めの報告と整合。タスクバーの固定AppUserModelId/元EXE参照は維持。
- 新ランチャーはTEMP/外側EXE/test-profileから版番号を含まないSHA256の展開先を生成し、Trayは実行パス/保存先からUUID v5を生成。異なる配置/隔離profileには別ID。gateとkernel leaseで使用中の再展開を避け、子へleaseをDuplicateHandleする。再起動/二重起動/ランチャーだけの強制終了後も保護し、最後の終了で生成領域を整理。
- 型検査・Vite・ホスト93/93成功。最終通常圧縮EXEを使う`tray-identity-1791441890232/日本語 profile/result.json`はok:true。0.16.4から別metadata版0.16.4-tray-updateへの置換前後で、実行パス・GUID・Windowsの登録キー・IsPromoted=1が一致。通常再起動、2つの同時起動で本体PID/資産保持、コマンド再起動、ランチャーだけの終了後の本体保護/再接続、次回の回復と最後の生成領域削除を確認。専用アイコンのテスト表示設定は元へ復元し、実利用の設定は変更していない。Windows設定画面での利用者のピン操作/全OS版の表示位置は未確認。
- 既存トレイGUIのtray-ui-1791441841077はok:true。クリック/ダブルクリック/メニュー/保存/再起動後の設定が成功。最終配布EXEのhost-commands-1791441961159もok:true/portable:true。パレット再起動、新PID、重複再起動防止、設定保持、終了キー、Applet deactivateと全host/worker終了を確認。
- 初期の検証エラー: StdUtilsのプロセスハンドルはhProc:<hex>というタグ形式だった。数値HANDLEへ検証/変換してからWin32の待機・終了コード取得・解放/DuplicateHandleを使うよう修正。レジストリ確認用JSのパスエスケープも修正。直接NodeでのAPI発行はpnpm環境不足で失敗したため、既存dev.batのローカルツール環境で実施。最終試験の実成功を採用し、途中の終了コード0でもエラー出力があった試験は成功扱いしない。最終CLIの失敗は明示のprocess.exit(1)で返す。
- 最終EXE100581824bytes、SHA256 E4785E4B6F0E77773B9A4E7662C9B22252E6A22CB5C98FAB2EA7FC7B755207BE。.NETホストはframework-dependent、SDK/Runtime/APIは変更なし。今回の更新後は初回のみ必要に応じてWindows側のピン設定を行う。同じ配置/EXE名/TEMPの更新間で維持し、移動/改名/Windows自身の設定リセットは対象外。実利用先deploy/commit/pushなし。
- 途中の失敗試験が残した6つのTEMP実行領域は、各専用profileのハッシュ・親TEMP・reparse pointなし・稼働プロセスなしを検証して削除し、全対象の消失を確認。最終試験の自動整理は正常。一時診断コードは配布版から除去済み。

## 2026-10-08: v0.16.3 Gmail連続切替と仮名の自動設定

- ユーザー補足の「1回目は効くが、クリックせず2回目が効かない」を旧0.16.2配布版で再現。以前のGUI試験は切替ごとに対象wc.focusを呼んでおり、入力先の消失を隠していた。新試験は初回だけfocusし、その後はgetFocusedWebContentsへキーを送る。修正は既にアクティブなGmail WebContentsの入力先だけを接続済みの切替先へ引き継ぐ。
- `dev.bat run typecheck`、build、`dev.bat test`成功（92/92）。仮名/旧番号名の置換、無効な観測拒否、手動rename優先、一度取得した名前の保持、ローカル入力と別Windowのフォーカス保持を検証。
- 最終win-unpackedのaccounts-1791438434630で新規仮名、日本語の名前、英語のメールのみ、取得後の変更抑止、ログイン前の手動名、再起動保持、前面別Window/未表示/表示/非表示/最小化、順序/監視/音/画像を確認。ui-features-1791438511879で再クリックなしの次キー4回・前キー2回と入力先、変更キー、既存の検索/削除/音/テーマ/位置保存が成功。最終単一EXE portable-1791438593328は0.16.3/ok:true/exitCode0、停止・再開・正常終了成功。
- 保存済み開発profileの実Gmailは2枠とも本人ヘッダーからaccountName取得に成功。既存accounts.jsonのハッシュ不変、認証保持/GPUオフ/本文を開く操作なし/送信・削除・既読変更なし。診断はGmailのartifacts/gmail-dev/live-result.jsonで、名前/メール/認証値は出力していない。新規の実Googleログインからの自動改名、長期常駐/スリープは未確認。
- `publish.bat`成功、framework-dependent .NETホストにRuntime混入なし。EXE100580178bytes、SHA256 A86DBFD0F350C6F4589869DCC560E57AE962D9C3F37E9DF14AFB254F55B56586。Gmail0.5.2は最低host0.16.3。実利用先deploy・commit・pushなし。通常exec/Node REPLのhelper_unknown_errorは許可されたWindows実行環境で検証。追加fixtureの未ロードへのアクセス/再起動前の古いlocatorは試験待機と再取得で解消し、最終試験が成功した。

## 2026-10-08: 実利用先へのdeploy

- 配置後の実利用について、ユーザーが正常動作を確認したと報告（2026-10-08）。

- ユーザーの明示指示により、AppDockと全6Appletの`deploy.bat`を引数なしで実行し、7件すべて終了コード0。配置先は`A:\00.ESSENTIAL\00.MainTools\AppDock.at365`。5つの.NET Appletは現ソース/SDKで`publish.bat`を先に実行し、Gmailはdeploy内で再発行した。
- AppDock0.16.2、Gmail0.5.1、WallpaperSlideshow0.3.0、Watch0.1.1（native）、WebBrowserTools0.2.4、WindowMover0.2.1、WindowsTools0.1.1を配置。Watchの古いDLL版manifestを配置せず、現ソースのnative版へ更新。
- 配置対象21ファイルのSHA256はすべて発行元と一致。現ソースと配置manifestの版/runtime/entry、minimumHostVersionも照合。settings.json・avatar.png・Gmail accounts.jsonの3ファイルは配置前後のハッシュ不変。
- 配置前後とも関連プロセスなし。実利用アプリは起動していないため、次回起動で反映する。旧ファイル退避は行わず、設定・認証領域を配置スクリプトで変更していない。結果は`../AppDock.at365/artifacts/deploy-2026-10-08-result.json`（本体では`artifacts/deploy-2026-10-08-result.json`）。

## 2026-10-08: v0.16.2 依存パッケージ更新

- npm公式レジストリのlatestタグを照会し、Electron 44.5.1→44.6.0、Vite 8.3.2→8.3.3、@vitejs/plugin-react 6.1.1→6.1.2へ更新。間接依存はpostcss 8.5.28→8.5.29、nanoid 3.3.19→3.3.20へ更新し、pnpm-lock.yamlを再生成。React/React DOM・型定義・TypeScript・Playwright・electron-builder・Prettierは既に最新。最終`dev.bat outdated --format json`は`{}`、終了コード0。
- ローカルpnpmは11.25.0→12.10.1。Node 24.21.0は公式indexで最新24 LTSと確認して維持（Currentの26.11.1へは変更なし）。グローバルインストール/PATH変更なし。
- pnpm 12のnative EXE化により、従来のnpm --ignore-scripts取得ではWindows shimが起動できなかった。取得後にpnpm自身の公式install.jsだけを実行し、npm rebuild --ignore-scriptsでWindows shimを再生成するようsetup-tools.ps1を修正。初回クリーン取得・連続再実行・dev.bat --version=12.10.1成功。旧版ローカルツールは保持。参考: [pnpmの公式導入手順](https://pnpm.io/installation/)。
- 新Electronはインストール時の依存postinstallを持たず、通常CLIの初回起動時に取得する。Playwright等は直接EXEを使うため、プロジェクトのpostinstallにinstall-electronを追加。`dev.bat install --frozen-lockfile --config.optimisticRepeatInstall=false`でroot postinstallとlockfileの再現インストールを確認。`dev.bat run postinstall`でも44.6.0実体を確認。参考: [Electronの公式バイナリ取得仕様](https://www.electronjs.org/docs/latest/tutorial/installation)。
- 型検査・Vite build・ホスト90/90・Gmail20/20成功。5つの.NET AppletのRelease buildは最終警告0/エラー0、既存回帰成功。WallpaperSlideshowは4グループ、Watch8/8、WebBrowserTools13/13、WindowMover23/23、WindowsTools11/11。各slnxのNuGet更新照会では更新なし、ソースにも外部PackageReferenceなし。Gmailはホストの依存を共有する。
- WindowsToolsのテスト用FakeContextが現SDKのIUiService.GetImageDirectoryAsyncに未追従でCS0535。未使用メソッドをNotSupportedExceptionとして追加し、新しいbuildから11/11を再実行。最初の失敗後に--no-buildで旧出力が成功した結果は最終検証として扱わない。
- トレイGUIの設定見出しlocatorがh1/h2の2件に一致して失敗。ページh1（level:1）を指定して再実行成功。製品の設定画面やトレイ動作は変更なし。
- AppDock隔離GUI: `artifacts/ui-1791435600421`（React移動、.NET起動/操作/停止、設定保存・無効JSON、暗号化secrets）、トレイ`artifacts/tray-ui-1791435643517`（実メニュー、single/double、OS間隔、再起動保存）、Widget `artifacts/widgets-ui-1791435647510`（時計tick・全9文字揃え・透過画面・Shell接続・配置保存・再起動）が成功。Widget検証はfixture DLLを使用し、native Watch実画面とは区別する。
- Gmailの最新依存でのオフラインUI: `../Applet.Gmail.at365/artifacts/accounts-1791435471926/result.json`と`ui-features-1791435496597/result.json`成功。画像/枠分離・切替の前面保持・個別監視・入力/順序保存・検索/未読・削除反映・キー・音コピー・テーマ・位置/サイズ保存を確認。通常Electron/Playwrightなしの最終app.asar背景試験`native-background-1791435598245/result.json`も成功（初回未表示の2枠更新・非選択枠・reload・認証解除・終了）。実Gmailのアカウントやメールは操作していない。
- 最終単一EXEの`../Applet.Gmail.at365/artifacts/portable-1791435656782/result.json`はhost0.16.2、ok:true/exitCode0。実EXE展開・隔離WebContentsView・到着判定・停止/再開・正常終了成功。最終EXE100,579,516 bytes、SHA256 `48E647F7C7631C13D8176A554829035CE2E3916210E01C5223E20EB0D19D4EB1`。.NETホストはframework-dependentクリーン発行、coreclr/hostfxr/hostpolicy等Runtime混入なし。
- README/DEVELOPMENT/本記録と各Appletの検証記録を更新。package.jsonのPrettier、setup-tools.ps1のPowerShell構文解析成功（PrettierはPS1非対応なので対象外）。通常隔離シェルはhelper_unknown_errorで起動できず、許可された通常Windows実行環境で検証した。実利用先deploy・外部pushなし。実メール到着、実ブラウザー操作、壁紙変更、ディスプレイOFF/ロック、長期常駐・スリープ復帰は今回の検証対象外。

## 2026-10-08: v0.16.1 認証済みアバター・非アクティブなアカウント切替

- 画像要求を当該アカウントのsession/credentials:includeへ変更。0.16.0の未認証取得ではGoogleの設定済みアバターURLが標準画像へ置き換わることを実Gmailで再現した。Cookieの適用はChromiumの各sessionへ閉じ、他枠へコピーせず、UI/Node/ログへ値を出さない。origin/転送数/時間/サイズ制限は維持する。
- cycleはselectedの保存と既存Viewの切替だけを行い、openとWebContents.focusを呼ばない。Gmailウィンドウの未作成・表示・最小化・非表示の状態と現在の前面Windowを保持する。明示openの表示動作は維持。
- main/renderer型検査・Vite、ホスト90/90・Gmail20/20成功。cycleのunit fakeはopen/focus呼出しで失敗する。最終配布版の`../Applet.Gmail.at365/artifacts/accounts-1791424612946/result.json`で、別Windowの前面/フォーカス保持と認証依存のセッション別画像を確認。最終既存UI/キー回帰は`../Applet.Gmail.at365/artifacts/ui-features-1791424637416/result.json`、単一EXEは`../Applet.Gmail.at365/artifacts/portable-1791424613849/result.json`（0.16.1、exitCode0）成功。
- 実Gmail右上の画像領域だけを読み取り、匿名/認証済み/修正版を照合して設定済みアバターとの一致を目視確認。以前のPNG取得有無だけの確認を補完した。詳細は[Gmail検証記録](../Applet.Gmail.at365/VERIFICATION.md)。メール状態や認証値を操作/出力せず、画像はローカルのGit対象外artifactだけへ保存した。
- 最終EXE100,446,218 bytes、SHA256 `8D5243653108108368DD5E04CC2C12DCBA688B4C028D07A53E6CF2CFF02C4B7F`。.NET framework-dependentクリーン発行、Runtime混入なし。Gmail0.5.1/最低host0.16.1を開発用配布先へハッシュ照合して配置。Prettier/diff check成功。既存の未配置GmailCheckerへの文書参照は確認不可。実利用先deploy/外部pushなし。長期常駐・スリープ復帰は未確認。

## 2026-10-08: v0.16.0 Webアカウント管理と画像取得

- WebアカウントUIへmove/setMonitoring、snapshot/readへmonitoring/avatar、readへmonitoringResetsを追加。旧accounts.jsonは個別監視ONを既定とし、順番の保存でselected/UUID/セッションを変更しない。OFFはUI data/attentionを直ちに消去し、遅いreportも再計上しない。ON/OFFの遷移を次のreadまで保持する。
- avatarOriginsを最大10個の厳密なHTTPS originとして検証。画像取得はNodeへのreadを待たせず、CookieなしのClientRequestで転送先を逐次検証（最大3転送/合計5秒）。入力64KBのストリーム上限、raster MIME、デコード後64px PNG/64KB、削除・停止時のabortを実装。UI snapshotだけへdata画像を返し、Nodeの1MB RPCへ画像バイトを送らない。実GmailでのSession.fetch manual redirectの取消エラーを確認し、ClientRequestへ修正した。[公式ClientRequest仕様](https://www.electronjs.org/docs/latest/api/client-request)と[関連するElectron issue](https://github.com/electron/electron/issues/43715)を参照。
- 最終main/renderer型検査・Vite・ホスト90/90・Gmail20/20成功。新しい回帰は並べ替え・OFFと古いreport・read間の再開、画像の厳密origin/MIME/サイズ、転送/取消を含む。Gmailの最終配布版アカウントUI試験`../Applet.Gmail.at365/artifacts/accounts-1791404902870/result.json`、通常Electronの最終app.asar背景試験`../Applet.Gmail.at365/artifacts/native-background-1791404906576/result.json`、単一EXE`../Applet.Gmail.at365/artifacts/portable-1791404908006/result.json`（0.16.0、exitCode0）成功。
- 実Gmailの保存済み2アカウントで両アバターをUI未表示の通常起動から取得、GPUオフ/認証保持。画像と監視のboolean・件数だけを診断し、本文/認証値を出力せず、メール状態を変更していない。実メールによる個別監視OFF/ON、長期常駐・スリープは未確認。詳細は[Gmail検証記録](../Applet.Gmail.at365/VERIFICATION.md)。
- 最終EXE100,447,550 bytes、SHA256 `55860971131436395A82378679A93AC6CF766A5B90F44CFC9936A14E3C423BB7`。.NETはframework-dependentクリーン発行、Runtime混入なし。Gmailは0.5.0/最低host0.16.0。開発配置のみ更新、外部push・実利用先deployなし。文書リンク88件・Prettier・diff check成功。

## 2026-10-08: v0.15.2 背景同期の再開・通常フォーカス

- 実利用版0.15.1/Gmail0.4.1でも、未表示の受信側は同期せず、表示しても反映せず、手動更新だけで反映するとの報告を受領。実Gmailでpaint/rAF/タイマー/document.hasFocusが正常でも受信同期が止まることを再現。DOMのreadyを待つだけの候補も実送信では不足したため、背景のアクティブ状態を30秒ごとに250msだけ解除して再適用する方式へ変更した。
- keepActiveはobserver.ready:trueの後だけ開始。native focus中はエミュレーションを解除し、通常のfocus/blurを優先する。同一文書のhash/history移動で接続を切らず、別文書の移動・認証・停止・破棄で周期/待機/接続を解除。Windowsのフォーカス移動・画面切替・定期reloadは行わない。
- main/renderer型検査・Vite、ホスト86/86・Gmail15/15成功。活動状態の7回帰には準備待ち、周期更新、native focus、認証へ移る途中の取消、破棄済みgetterへの非アクセスを含む。最終app.asarの通常Electron試験: `../Applet.Gmail.at365/artifacts/native-background-1791399095693/result.json`。DOMの準備より受信処理が遅れて初期化される2枠で、初回未表示・状態更新・hash/history移動・reload・認証・正常終了を確認。
- ユーザーがログインした開発用2アカウント間で5通を送信。最終候補は再起動を挟んだ両方向の実メールを、受信側を一度も表示せず検知し、未読件数も反映。詳細と観測時刻の範囲は[Gmail検証記録](../Applet.Gmail.at365/VERIFICATION.md)参照。長期常駐・実スリープ復帰は未確認。
- 最終単一EXE: `../Applet.Gmail.at365/artifacts/portable-1791399100255/result.json`（0.15.2、exitCode0、停止/再開/正常終了）。認証: `../Applet.Gmail.at365/artifacts/auth-redirect-1791399111873/result.json`（Google/YouTube/日本向けGoogle/Workspace、類似origin遮断、GPUオフ、認証中のアクティブ化解除）。
- 最終EXE100,442,774 bytes、SHA256 `11D9CABB02DAF33388768D1E227DEB9DD1FEB990B1657EE4D03AAB203C8C4D95`。.NETはframework-dependentクリーン発行、Runtime混入なし。開発配置のみ更新し、保存認証を保持したGPUオフの通常テストアプリを起動。外部push/実利用先deployなし。

## 2026-10-08: v0.15.1 通常起動のWeb初期化・アクティブ維持・終了処理

- 初回未表示のGmailが0.15.0でも更新されないとユーザーが報告。Playwrightの自動focus emulationが通常起動の条件を変えていたことをローカル実装で確認し、背景関連の検証に通常Electron起動を追加した。
- WindowsのCalculateNativeWinOcclusionを起動前に無効化し、既存のdisable-featuresを保持。任意のwebAccounts.keepActive（既定false）を追加し、observeOriginのロード停止後だけChromiumのページアクティブ状態を維持。メインフレーム移動/認証では解除、他Debugger/ユーザーDevToolsへ干渉せず、OSのフォーカス/選択/入力を移動しない。
- 実Gmailの2通目のユーザー送信メールは、Gmail画面を開かずopacity0/OSフォーカスfalseのまま、ページアクティブ化後に16行/未読3へ更新。修正版も通常起動でUI未表示・初期新着3・保存認証/GPUオフを確認。実受信トレイは1枠で、実複数アカウント/スリープ/長期常駐は未確認。[Gmail検証記録](../Applet.Gmail.at365/VERIFICATION.md)に詳細。
- ユーザーの終了エラー画像はWebContents.dispose / Object has been destroyed。WebContentsの破棄後にdebugger getterへ触れていた箇所を、生存中に参照取得・削除/停止前に解放する方式へ修正。破棄済みgetter・認証境界・外部Debuggerとの競合を3回帰で確認。
- main/renderer型検査・Vite、ホスト82/82、Gmail15/15成功。通常Electronから最終app.asarの実装を使った2枠の初回未表示/未読更新/reload/認証時解除/正常破棄: `../Applet.Gmail.at365/artifacts/native-background-1791394005659/result.json`。最終単一EXE: `../Applet.Gmail.at365/artifacts/portable-1791394017868/result.json`（0.15.1、exitCode0、エラーダイアログなし）。
- 最終EXEは100,443,530 bytes、SHA256 `D246228B7F8EB393FAA51E4ECAC25E4BD85EED0914C851AE764B755382ADAB8F`。.NETはframework-dependentクリーン発行でRuntime混入なし。開発配置だけを更新し、外部push/実利用先deployは行わない。

## 2026-10-08: v0.15.0 Web初回描画・テーマ・音声コピー・バージョン情報

- 未表示のWebContentsViewはrAFが動いても初回描画が成立しないことを追加実測。透明・全ディスプレイ外・非フォーカス・タスクバー非表示の親WindowでshowInactiveし、非表示/最小化中もViewを背景へ移す。display変更時は画面外へ再配置し、停止時は購読とWindowを解放する。
- Web snapshot.darkとnativeTheme変更通知でローカルUIのテーマを同期。sound.nameとsoundErrorを追加し、WAVを16MB/RIFF/WAVEで検証してsounds/<SHA256>.wavへコピー。旧設定を起動時に移行し、失敗時は元設定保持・実効音OFF・再選択案内。停止時は未参照の管理hash名WAVだけを削除する。
- 設定に「バージョン情報・更新」を追加。HostSnapshot.runtimeで実行環境を表示し、既存更新確認APIを再利用。表示時の自動通信なし、手動確認とリリースページ案内。本体/各Appletの版・確認時刻・結果/エラーを表示し、未保存の設定draftを保持する。
- main/renderer型検査・Vite・ホスト回帰79/79、Gmail回帰15/15成功。新しい音声コピー2回帰を含む。`dev.bat run dist`成功。.NETはframework-dependentクリーン発行でRuntime混入なし。
- 配布版のテーマ/音声コピー・旧設定移行/更新確認: `../Applet.Gmail.at365/artifacts/ui-features-1791389267393/result.json`。未表示・非表示reload・背景同期/透明/画面外/非フォーカス・破棄: `../Applet.Gmail.at365/artifacts/background-1791389201924/result.json`。既存GUI: `../Applet.Gmail.at365/artifacts/gui-1791389317671/result.json`。単一EXE: `../Applet.Gmail.at365/artifacts/portable-1791389361232/result.json`（0.15.0、exitCode 0）。
- 設定ナビゲーション: `artifacts/navigation-1791389280500/result.json`。about往復時のdraft保持、複数Applet/入力型/保存競合/無効JSON/両テーマ/狭い画面の既存操作が成功。同名の非表示保存ラベルを拾う旧locatorを可視toolbarへ限定した。
- 実Gmailは操作UIを開く前の初回描画、保存済み認証、GPUオフを確認。ログイン済み1枠が9行/未読2/起動時新着2、2枠目は受信トレイ未到達。実複数アカウント・別ブラウザーからの実同期・音の聞こえ方・スリープ/長期常駐は別途確認。詳細と制約は[Gmail検証記録](../Applet.Gmail.at365/VERIFICATION.md)。
- 最終EXE: 100,441,388 bytes、SHA256 `AA28B2BC11EBD62333221B43D90F71302A1D49EB27652D242515D6F321093212`。開発配置だけを更新し、実利用先へのdeploy・外部pushは行っていない。

## 2026-10-07: v0.14.0 Webアカウントの操作・個別音・ウィンドウ保存

- 任意のitemOpener資産をApplet内/100KBの関数式として検証し、限定ローカルUIのopenItem(id,key)からだけ実行。読込済みobserveOrigin・isolated world 1001・JSON文字列化した200文字以内の引数で、remoteへHost bridgeを渡さない。cycle(1|-1)をNodeと限定UIへ追加し、現在の枠から循環して同じWebContentsViewを選ぶ。
- アカウントsoundはenabled:false/file:""が既定。WAV絶対パス・4096文字以内・制御文字なしで検証し、accounts.jsonへ保存。設定/試聴にはaudio、親付きWAV選択にはfile-dialogを要求。既存queueSoundとWindowStateStoreを再利用し、位置/サイズ/最大化はweb-accounts/<Applet>/window-state.jsonへ保存。Gmailの復元下限は900×640。モニター切断/縮小・DIP丸め・最小化/非表示・終了時flushは共通処理を維持。
- Gmailの次/前コマンドへ既定Ctrl+Tab/Ctrl+Shift+Tabを追加。自身のAppletの登録済みコマンドだけをローカルUI/remoteのbefore-input-eventで処理し、利用者設定を毎回参照。global指定時は重複実行を避ける。旧設定へ既定キーを補い、明示の空配列/変更は保持する。
- main/renderer型検査・Vite・ホスト回帰77/77、Gmail回帰15/15成功。新しい境界でJSONキーのコード注入、音パス/資産の制限、循環と削除中/停止、最大10枠の観測＋音パスが1MB RPC内であることを確認。
- 発行版Gmail 0.3.0の追加UI: `../Applet.Gmail.at365/artifacts/ui-features-1791382644378/result.json`。検索/未読絞り込み、同じIDを持つ別セッションの正しいメールを開く操作と消えたメールの案内、Web/ローカルキー・キー変更、音選択/試聴/ON/OFF・保持、通常枠と最大化の再起動復元、900×640のレイアウトが成功。ホスト/Appletの通知OFFでも音ONの1枠だけ無音WAVの実プレーヤーが起動し、音/位置保存のエラーログなし。
- 既存GUI `../Applet.Gmail.at365/artifacts/gui-1791382808256/result.json`、背景描画 `../Applet.Gmail.at365/artifacts/background-1791382726283/result.json`、portableと未改変Applet `../Applet.Gmail.at365/artifacts/portable-1791382860793/result.json`（version 0.14.0、exitCode 0）成功。
- 保存済み実GmailはGPUオフ/認証保持・既読7行/未読0。既読行だけのitemOpenerで実ページ移動を確認して戻り、本文は取得せず未読を操作していない。裏側のrAFも継続。実新着の音の聞こえ方、別ブラウザーからの状態変更/実受信による背景同期、実複数アカウント/スリープ/長期常駐は別途確認。
- `dev.bat run dist`成功。framework-dependent .NETクリーン発行でRuntime混入なし。最終EXE: 100,441,648 bytes、SHA256 `B13FD8556362975E7100DB443DC8C3FA50AF66F955CA4E2A8D329B5008F42B05`。Gmailは開発用publish/extensionsへの配置のみで、実利用先へのdeploy・外部pushは行っていない。

## 2026-10-07: v0.13.1 非選択Webページの描画継続

- ユーザーはGmail 0.2.1の未読集計を確認した一方、非アクティブなGmail側の更新が止まると報告。監視のタイマー停止とは区別して調査した。`backgroundThrottling:false`だけでは、nativeで非表示/取り外したWebContentsViewのrequestAnimationFrameが止まることをオフラインで再現。document.visibilityStateはvisibleのままでも停止する。記録: `../Applet.Gmail.at365/artifacts/visibility-1791372924502/result.json`。
- Appletごとの非表示・非フォーカス・タスクバー非表示の背景BrowserWindowへ、非選択/ローカル一覧表示中のWebContentsViewを移す。View自体はvisibleと実サイズを保ち、初めて選択する前も描画を継続。UIへ戻す際は同じViewを移動する。削除/停止時にはViewと背景ウィンドウを破棄する。
- main/renderer型検査・Vite build、ホスト回帰75/75、Gmail回帰14/14成功。発行版の2アカウントでサーバーfixtureの変更をfetchし、ページ自身のrequestAnimationFrameで行状態へ適用する検証に成功。未選択アカウント・新着一覧・トレイ非表示・最小化で未読/既読が同期し、選択アカウントは変わらず、停止で背景ウィンドウも破棄。記録: `../Applet.Gmail.at365/artifacts/background-1791373818907/result.json`。以前のDOMを直接変更する検証だけでは、ページ自身の描画停止を確認できなかった。
- 発行版の既存GUI検証: `../Applet.Gmail.at365/artifacts/gui-1791373823236/result.json`。未読集計/履歴・初回未読・セッション保持/分離/削除・remote権限制限・停止/再開を確認。実portableと未改変Gmail 0.2.2: `../Applet.Gmail.at365/artifacts/portable-1791373893030/result.json`（version 0.13.1、exitCode 0）。
- 保存済み実Gmailの認証保持・GPUオフ・受信トレイ7行（既読7/未読0）と、新着一覧の裏側でrequestAnimationFrameが実行されることを読み取りだけで確認。実メールの状態は変更していない。別ブラウザーからの実既読/未読変更・実受信による背景同期はユーザー確認待ち。実複数アカウント・スリープ・長期常駐は未確認。
- `dev.bat run dist`成功。.NETはframework-dependentクリーン発行でRuntime混入なし。最終EXE: 100,440,091 bytes、SHA256 `32D58EF733AA4F91F2C53BB2FA85D09B7F26B3E1162F08DBE900D3C75F2B33D7`。Gmail 0.2.2を開発用publish/extensionsへ配置し全ファイルSHA256を照合。実利用先への配置・外部pushは行っていない。

## 2026-10-07: v0.13.0 Web表示領域と一時UIデータ

- Node `webAccounts.report(id,status,attention,data?)`に50KB以下のJSON化可能な一時データを追加。アカウントsnapshotへ渡し、ファイル/ログへ保存しない。ローカルUIの限定IPCに`viewport`を追加し、整数/DIPの矩形をclient領域へ切り詰める。nullはView非表示でページ・背景監視を継続。旧UIの未指定時は236/146の既定レイアウトを維持する。
- main/renderer型検査・Vite、ホスト回帰75/75成功。新しい境界テストで不正矩形・多バイトJSON上限・循環JSONを確認。最大10枠の履歴をNodeへ再送せず、観測結果をJSON-RPCの1MB以内で返すことも検証。既存Node/.NET起動・異常終了・再起動・設定・終了も成功。
- Gmail 0.2.0の発行版GUI: `../Applet.Gmail.at365/artifacts/gui-1791368517560/result.json`。新着一覧/設定中のView非表示と背景検知、復帰とリサイズ、送信元/件名、複数アカウントの絞り込みとクリア、ログインCookieの分離/再起動保持/削除、停止時破棄、remote Node/IPC非公開を確認。
- 最終portableと未改変Applet: `../Applet.Gmail.at365/artifacts/portable-1791368914954/result.json`（version 0.13.0、exitCode 0）。新UIとメタデータ、クリア、停止/再有効化、終了が成功。オフライン認証/GPU回帰は`../Applet.Gmail.at365/artifacts/auth-redirect-1791368563012/result.json`。
- 実開発Gmailで保存済み認証の復帰・受信トレイ2行の送信元/件名抽出・初回履歴0・GPUオフを確認。今回の新着一覧での実受信・実返信やスリープは未確認。旧版の実到着→Windows通知とWorkspaceログアウト/再ログインのユーザー確認を引き続き区別して保持する。
- .NETホストは既存手順でframework-dependentクリーン発行（coreclr.dll等のRuntimeなし）。単独electron-builderはpnpm PATH不足で失敗したが、プロジェクトの`dev.bat exec electron-builder --win portable --x64`で成功。最終発行EXE: 100,437,982 bytes、SHA256 `C6509735B60E29F09D3AD63FB5BB42E6461A18FAE4D264701648A356A210860C`。実利用先へのdeployは行っていない。

## 2026-10-07: v0.12.0 Webアカウントの共通管理

- Nodeへ`webAccounts.start/open/read/report`と`web-accounts` capabilityを追加。Gmail固有のDOM観測は新しいAppletへ置き、ホストはWebContentsView・アカウント別永続セッション・限定UI IPC・破棄を担当。.NET/nativeの既存APIは維持し、今回は.NET SDK専用ラッパーは追加していない。
- main/renderer型検査・Vite build成功、既存70＋境界3回帰で73/73成功。URL/capability/Web資産の境界、既存Node/.NETライフサイクルを確認。
- 発行win-unpacked版の隔離オフラインGUIでDOM新着/未読返信、既読変更、フォルダー復帰時基準、背景監視、900×640のレイアウト、Cookie分離と再起動保持、削除、停止、リモートのNode/bridge非公開を検証。結果: `../Applet.Gmail.at365/artifacts/gui-1791363761348/result.json`。
- portable＋未改変Gmail Appletで、明示コマンド起動、WebContentsView、新着/クリア、無効化/再有効化、正常終了コード0を確認。結果: `../Applet.Gmail.at365/artifacts/portable-1791363831174/result.json`。通信はオフラインfixtureへ差し替え。
- 開発用Gmailの旧テストprofileを元を残して隔離コピーし、再入力なしで実受信トレイと識別子解析を確認。同日、ユーザー自身が試しに送信したメールでWindowsの新着通知表示を確認したと報告。実メール到着から検知・通知表示までをユーザー確認済みとして記録。 同日のGmail 0.1.3/GPUオフの開発版で、ユーザーがGoogle Workspaceアカウントのログアウト→ログイン→受信トレイ表示も確認。実スレッド返信/複数実アカウント/セッション失効後の追加認証・組織独自SSO/実空受信トレイ/通知クリック・音/スリープ復帰/長期常駐は未確認。
- `publish.bat`で.NETホストをクリーン発行し、portableを生成。EXEは100,437,305 bytes、SHA256 `7D9168E11D6194F2B87F689354D62A0D5E3AD83546947DF71C0732FDF76D7CC4`。実利用先へは配置していない。

## 環境の.NET 10 Runtimeを使用（2026-10-06 JST）

.NETホストの発行を `win-x64` / `--self-contained false` に変更しました。発行前に専用の `artifacts/dotnet-host` を削除して再生成し、以前の同梱ランタイムが残らないようにしています。READMEとApplet開発ガイドに、利用先の.NET 10 Runtime（Windows x64）の要件とnative Appletとの違いを反映しました。

- `publish.bat`: .NETホスト・TypeScript・Reactのビルドとportable EXE作成が成功。
- 発行先と完成版 `publish/win-unpacked/resources/dotnet-host` に、`coreclr.dll`・`hostfxr.dll`・`hostpolicy.dll`などのランタイム本体がないことを確認。runtimeconfigは `Microsoft.NETCore.App 10.0.0` を参照。
- 実ホストの読み込みモジュールを確認し、`C:\Program Files\dotnet` 配下の.NET 10.0.12を使用していることを確認。`--hotkeys` モードの空のキー同期とEOFでの終了コード0も成功。記録: `artifacts/framework-dependent-validation.json`。
- `dev.bat test`: 33件すべて成功。実Node/.NET拡張の起動、コマンド実行、異常終了後の再起動、停止を含みます。
- 完成win-unpacked版の専用プロファイルでNode/.NET拡張の起動、.NETの状態更新、Storage / Secrets APIの往復、正常終了が成功。記録: `artifacts/framework-package-lnHWWO/result.json`。初回の確認はテスト側が起動完了を待てず失敗したため、待機方法を修正して再確認しました。
- portable EXEを別の専用フォルダーへコピーし、初回起動、設定・アバター保存と画像表示、正常終了が成功。Applet一覧は空。記録: `artifacts/smoke-1791270101603/smoke-result.json`。
- ビルドスクリプトのPrettier確認とGit差分空白検証が成功。

成果物: `publish/AppDock.at365.exe`、100,405,280 bytes、Version 0.4.0。
SHA256: `73DE381C8DD292FEB084A9440BE20E2ED41E0D09EC0F94276864F3A40B08DBE2`。

最初の発行はSandboxのNuGet.Config読み取り制限で失敗し、通常実行環境で上記の成功を確認しました。実利用先への配置はしていません。.NET未導入の別PCでの確認とOS全体へのキー送信は未実施です。native時計Applet自身のランタイム同梱設定は変更していません。

## サンプルAppletの同梱解除・タスクバーアイコン（2026-10-06 JST）

Welcomeと.NET Connection Demoの同梱・初期設定・通常ビルド対象を削除。Node／.NETの拡張機能は維持し、既存のサンプル実装は`tests/fixtures`に移して回帰検証だけで使用します。通常起動ではEXE隣の`extensions`のみを読み込みます。既存settings.jsonの保存済みApplet設定は削除しません。

WindowsのウィンドウアイコンをICOに統一し、[ElectronのsetAppDetails](https://www.electronjs.org/docs/latest/api/browser-window#winsetappdetailsoptions-windows)でタスクバーのAppUserModelID・アイコン・再起動先を指定。ICOをapp.asar外へ配置し、portable版のタスクバーアイコンと再起動先には、一時展開先ではなく元のportable EXEを使用します。

- 型チェック、回帰テスト33件、既存UI・プロフィール／ショートカット・完成win-unpacked版ナビゲーション11項目が成功。
- 初回起動のApplet一覧が空であること、古いサンプルの設定を残して再起動してもサンプルが復活しないことを確認。
- 完成win-unpacked版・portable EXE双方で、Windowsの大小ウィンドウアイコン（150% DPIで24×24／48×48）を取得し、アプリICOと全画素一致を確認。ShellのAppUserModelID、RelaunchIconResource、RelaunchCommandも検証。portable版は元の`publish/AppDock.at365.exe,0`を参照。
- portable EXEを別フォルダーへコピーした起動、設定・アバター保存、画面からの読み込み、ホストコマンドのピン保存、正常終了が成功。Applet同梱なし。
- Prettier・Git差分空白検証が成功。実利用先への配置、既存ピン留めの更新、OS全体へキーを送るホットキーテストは未実施。

記録: `artifacts/icon-removal-validation/profile-1791226237683/result.json`（win-unpacked・再起動）、`artifacts/icon-removal-validation/profile-1791226252327/portable-result.json`（portable・実アイコン画像）、`artifacts/ui-1791226064526/`、`artifacts/preferences-1791226067365/`、`artifacts/navigation-1791226070088/`、`artifacts/smoke-1791226417380/smoke-result.json`。

最初の.NET検証はSandboxのNuGet.Config読み取り制限で失敗し、通常実行環境で成功。初回UI検証は継承した`ELECTRON_RUN_AS_NODE`で起動できず、子シェル内だけ解除して成功。portableランチャー経由のPlaywright起動はデバッグ接続待ちとなったため、検証専用プロファイルの起動済みアプリへCDP接続し、Windows APIによる実アイコン検証と正常終了を完了しました。恒久環境変数や実利用の設定は変更していません。

成果物: `publish/AppDock.at365.exe`、125,269,111 bytes、Version 0.4.0。
SHA256: `0875F8354245AF00ABC6177AD9AAE57F066F2D8671CC41034E09BBD9A7F09E66`。

## ショートカット一覧の行をコンパクト化（2026-10-06 JST）

通常行を「コマンド名」「Applet名＋コマンドID」「グローバルチェック＋有効範囲・登録状態」の3段へ整理。キー入力と操作ボタンは右側に保持し、行の上下余白を20pxから12pxへ縮小しました。長いIDは省略表示し、ホバーで全文を確認できます。登録エラー・キー競合は下に全文を表示します。狭い画面では状態表示を折り返し、IDは10pxを維持します。保存形式と割り当て処理の変更はありません。

- 型チェック・production build、既存`test:navigation`の11項目、`test:preferences`が成功。
- 1280×840・900×620、ライト／ダークで画面を撮影し、文字・キー入力・状態の配置を目視確認。通常の1キー行は89 CSS px（グループ見出し・エラー・複数キーを含まない行）。
- 画面確認: `artifacts/compact-1791224463318/`。操作検証: `artifacts/navigation-1791224273940/result.json`、`artifacts/preferences-1791224294874/`。
- 最終の小画面向けID文字サイズ調整後も型チェックと画面確認に成功。再ビルド時にpnpmの非対話依存確認が失敗したため、準備済みのNode.jsからViteを実行。梱包の直接実行では一度pnpmのPATH指定を誤り失敗したが、`environment.bat`と同じパスへ修正して再実行。依存パッケージの再インストールや設定ファイルの変更は行っていません。
- 最終portable EXEの作成と、別フォルダーへのコピー後の起動・設定／画像保存・Node/.NET起動・終了が成功。pnpmの非対話依存確認が再度失敗したため、既存`smoke.cjs`をプロジェクト内Node.jsから直接実行しました。記録: `artifacts/smoke-1791224641797/smoke-result.json`。実利用先への配置は未実施。

成果物: `publish/AppDock.at365.exe`、125,263,290 bytes、Version 0.3.1。
SHA256: `FAA88D7042DEF34B568CDBDBC6E3DA6D388C292085E6E9F66DDEC915ADEC0698`。

## Applet別の設定・ショートカットと画面構成の改善（2026-10-06 JST）

ページ移動を左ツールバーに集約し、重複したナビゲーション・Applet一覧・固定のMy Dock表記を削除。Applet別の設定フォームとショートカット、対象設定とログへの直接移動、設定・コマンドの検索、キー重複相手の表示、未保存印と固定保存バーを追加。ホームは状態の概要とピン留めコマンドを中心にしました。既存のsettings.json形式、割り当て、保存時の競合保護は維持しています。

| 検証 | 結果 |
| --- | --- |
| TypeScript型チェック・production build | 成功 |
| 自動回帰テスト | 31件成功 |
| 既存UIテスト | Applet起動・停止・コマンド、フォーム保存、不正JSON、外部設定変更の反映と保護が成功 |
| ショートカット・ピン・プロフィールUIテスト | 記録・重複拒否・再割り当て、Node/.NETコマンド実行、画像保存・不正画像の保護・再起動後の保持が成功 |
| ウィンドウ状態UIテスト | 位置・サイズ・最大化・最小化・トレイ格納・非表示起動が成功 |
| 新設 `test:navigation`（完成版win-unpacked EXE） | 下記11項目の検証が成功 |
| `publish.bat` | .NET発行・Reactビルド・portable EXE作成が成功 |
| portable EXEを別の専用フォルダーにコピーして起動 | Node/.NET起動、設定・画像保存、正常終了が成功 |
| Prettier・差分空白検証 | 成功 |

新設テストでは、24個のテスト用Appletと同梱の2個を使用し、次を確認しました。

1. ナビゲーションが各1個で、選択表示とApplet詳細が一致し、対象設定へ直接移動する。
2. Applet名・設定項目の検索、複数Appletの未保存編集、戻る操作、全変更の一括保存。
3. 真偽値・選択肢・利用できない動的選択肢の表示、数値の空欄拒否と修正後の保存。
4. 設定項目なし・コマンドなしの表示、ショートカットへの直接移動。
5. Applet別・ホスト別・全体のキー表示、別Appletとの重複相手表示、状態絞り込み、所属未確認の保存済みキーの保持。
6. 停止したAppletの既知コマンドの所属・割り当て保持。
7. 不正JSON編集中にAppletから設定へ移動しても入力を失わない。
8. 外部更新後の古い設定による上書きを拒否し、編集中の値を保持する。
9. Applet詳細から対象Appletのログへ直接移動する。
10. コマンドパレットのApplet名検索、矢印キー選択、Enter実行、Escape終了とフォーカス復帰。
11. 1280×840・900×620、ライト／ダーク、長い設定フォームと多数のAppletで保存バーを表示し、横方向にはみ出さない。画面画像を目視確認。

記録: `artifacts/navigation-1791220776737/result.json`（完成版と画面画像）、`artifacts/ui-1791220758458/`（既存UI）、`artifacts/preferences-1791220437191/`（設定・プロフィール）、`artifacts/smoke-1791220793168/smoke-result.json`（portable）。

成果物: `publish/AppDock.at365.exe`、125,267,896 bytes、Version 0.3.1。
SHA256: `81E56C7F9A05B4A32455BC2A1ABA363705808F163438152CB96195A884D8EA70`。

実利用の配置先・設定・Appletは変更していません。OS全体へのPause送信を使うホットキーテストと実時計Appletの操作は今回再実施していません。初回のElectronテストは`ELECTRON_RUN_AS_NODE=1`の継承とSandboxアクセス制限、初回発行はNuGet.Configの読み取り制限で失敗しました。環境変数を子シェル内で解除し、通常実行環境で上記の成功を確認しました。ACL・恒久環境変数は変更していません。

## deploy.bat のpwsh切替（2026-10-06 JST）

`deploy.bat` の呼び出し先を `powershell` から `pwsh.exe` に変更。インストール済みのMicrosoft Store版PowerShell 7.6.6を通常PATHで使用し、テスト用フォルダーで引数なしの配置設定・CLI引数の優先・空白と日本語を含む配置先へのEXEコピー・既存settings.jsonの保持・不正な相対パスの終了コード1を確認しました。実利用の配置先にはコピーしていません。確認先: `artifacts/deploy-compat-44866c9c2ffb48b894dea4c8917d8f3d/`。

## mainへの統合確認（2026-10-06 JST）

グローバルホットキー・プロジェクト内Node.js／pnpmと、ウィンドウ位置・サイズ保存を統合。dev.bat経由の型チェック、production build、自動回帰テスト31件、test:window-stateの実Electron再起動・最大化・最小化・トレイ格納・非表示起動がすべて成功。今回の統合ではportable EXEの発行・配置は未実施。

## プロジェクト内のNode.js／pnpm（2026-10-06 JST）

Node.js 24.21.0とpnpm 11.25.0をAppDockの `.tools` 内に準備。Node.js ZIPは公式SHA256と一致しました。mise設定は作成せず、ツールのバージョンは `toolchain.json` で指定します。旧バージョンを残し、両ツールの動作確認後に利用バージョンを切り替える方式です。

Codexが追加するPATHを外し、Windowsの通常PATHだけを渡した子プロセスで次を確認しました。永続PATHとグローバルNode.js／pnpmは変更していません。

- `setup-tools.bat` の初回準備と再実行: 成功。
- `dev.bat exec node --version` / `dev.bat --version`: 24.21.0 / 11.25.0。
- `dev.bat install --frozen-lockfile` / `dev.bat run typecheck`: 成功。
- `dev.bat test`: 23件成功。
- `publish.bat`: .NET発行、Reactビルド、portable EXE作成に成功。
- `dev.bat exec node scripts/smoke.cjs publish/AppDock.at365.exe ../Applet.Watch.at365/publish/Applet.Watch.at365`: Node/.NET/native時計、設定保存・画像表示・終了まで成功。記録は `artifacts/smoke-1791215308632/smoke-result.json`。
- BAT 4ファイル（生成された `.tools/environment.bat` を含む）: CP932往復とCRLFを確認。差分空白検証も成功。

今回の成果物: `publish/AppDock.at365.exe`、125,270,147 bytes、Version 0.3.1。
SHA256: `0E121B1B714EA02D7BECB3A4F16272F7C1C959EFB634773492951E5317DF225D`。
別バージョンへの実際の更新・切り戻しは未実施です。pnpmの依存パッケージストアは通常のユーザーキャッシュを使います。

## v0.3.1 グローバルホットキー（2026-10-06 JST）

Windows x64、テスト専用profileで確認。元Watchはユーザーが終了し、実利用のAppDock設定は変更していません。

| 検証 | 結果 |
| --- | --- |
| TypeScript型チェック・React production build | 成功 |
| .NET ExtensionHost / Runtime発行 | 成功、警告0・エラー0 |
| 自動回帰テスト | 23件成功 |
| 既存のショートカット・ピン・プロフィールUIテスト | 成功 |
| `at365.watch.toggle` の既定グローバルPause登録 | 成功 |
| トレイ格納相当の非表示状態でWindowsのPause入力による時計の表示／非表示 | 双方向で成功 |
| AppDock前面でのグローバルキー | 1回だけ実行されることを確認 |
| キー入力欄の一時解除・単独F24への変更・Pauseの解放 | 成功 |
| 別ホストによるPause競合・設定画面への理由表示・再試行 | 成功 |
| グローバルOFF・既定に戻す・Applet停止／再有効化・AppDock終了時の登録解除 | 成功。別ホストがPauseを取得できることでも確認 |
| 背面からのTypeScriptコマンド実行・ホストコマンドで画面とパレットを開く | 成功 |
| 完成版 `publish/win-unpacked/AppDock.at365.exe` のホットキーUIテスト | 上記9項目成功 |
| portable EXEを別フォルダーにコピーして起動・Node/.NET/native時計・設定と画像保存 | 成功 |
| 両プロジェクトの差分空白検証 | 成功 |

成果物: `publish/AppDock.at365.exe`、125,270,146 bytes、Version 0.3.1。
SHA256: `38E7159990FC549F222CF6B82540A0666CADF30845502C8329C99FAA58F0879B`。

記録: `artifacts/hotkeys-1791212601125/result.json`（完成版の9項目）、`artifacts/preferences-1791212138244/`（既存UI）、`artifacts/smoke-1791212633700/smoke-result.json`（portable）。Pause等の入力はWindowsのSendInputで送信しました。手で押す実キーボード、別の配列・リモートデスクトップ、長期常駐は未検証です。Sandbox内のNuGet／Electron起動テストはアクセス制限で失敗したため、通常実行環境で成功を確認しています。


## ウィンドウ位置・サイズの保存と復元（2026-10-05）

専用Worktreeとテストプロファイルで確認。main / rendererの型チェック、Viteビルド、.NETホスト・Demoビルドが成功。自動回帰テストは28件すべて成功。

`node scripts/window-state-ui-test.cjs` で実Electronの位置・サイズの再起動復元、最大化の復元と解除、最小化中の終了、×でのトレイ格納、最大化状態を保存したままの非表示起動を確認した。Windowsの表示倍率で復元サイズが増える問題も補正し、再起動でサイズが一致することを確認。

負のモニター座標、モニター切断・作業領域縮小時の補正、不正JSON、保存失敗、初回表示直後の最小化はユニットテストで確認。実際のモニター着脱・異なるDPI間の移動は未検証。この変更のportable EXE発行・配置は未実施。

環境のPATHにNode.js / pnpmがないため、既存Electron同梱のNode.js（`ELECTRON_RUN_AS_NODE=1`）でコンパイラー・ビルドスクリプト・テストを実行した。Electron起動時はその環境変数を除去。最初の全回帰テストでは.NET成果物が未生成のため1件失敗したが、ビルド後は全件成功。

## 既存v0.3.0の検証

2026-10-05 JST、Windows x64の通常実行環境でv0.3.0を確認。実利用の設定と画像は変更せず、テスト専用のフォルダーを使用。

| 検証 | 結果 |
| --- | --- |
| TypeScript strict型チェック（main / renderer） | 成功 |
| React / Viteのproduction build | 成功 |
| .NET SDK・Runtime・ExtensionHost・Demo build | 成功、警告0・エラー0 |
| 自動回帰テスト | 20件成功 |
| 実Node/.NET拡張の起動・コマンド・停止 | 成功 |
| 拡張プロセス異常終了後の他拡張継続・再起動 | 成功 |
| React画面での操作テスト | 成功 |
| 設定フォーム・表示／一般／拡張のカテゴリ | 成功 |
| JSON保存・不正JSONの既存設定保護 | 成功 |
| 手動JSON編集の反映・不正編集時の有効設定継続 | 成功 |
| コマンドパレットからのC#コマンド実行 | 成功 |
| 0.1.0の設定を維持した読み込み・Ctrl+Pの既定キー | 成功 |
| キー記録・重複割り当ての拒否・保存と再割り当て | 成功 |
| TypeScriptと.NETの拡張コマンドのキー割り当て・実行 | 成功 |
| ピン留め・上下の並べ替え・検索時の順序保持・解除 | 成功 |
| 名前変更・画像アップロード・1枚への上書き | 成功 |
| 不正画像の拒否・既存プロフィールと画像の保持 | 成功 |
| JSONの書き込み失敗時の画像復元・古い設定での画像変更拒否 | 成功 |
| 再起動後の名前・画像・キー割り当て・ピンの保持 | 成功 |
| TypeScript/C#双方のStorage・Secrets往復 | 成功 |
| Chromium画面にNodeのrequireが公開されていないこと | 成功 |
| pnpm run dist | 成功 |
| 完成portable EXEを別フォルダへコピーして起動 | 成功 |
| portable EXEの隣へのsettings.json保存 | 成功 |
| portable EXEの隣へのavatar.png保存・画面からの読み込み | 成功 |
| portable内部のNode/.NET拡張・設定保存・暗号化保存 | 成功 |
| native EXEの起動・時計の3コマンド・Appletのトレイ項目なし | 成功 |
| 動的なモニター選択肢・設定値の型／範囲検証 | 成功 |
| 設定変更の.NET／Node購読API | 実装、時計の再起動なしの反映をUIで確認 |
| 完成portable EXEと外部時計Appletの接続・表示／非表示の保存 | 成功 |
| 時計の実画面操作・2台のモニター切り替え・停止時のプロセス終了 | 成功。詳細は隣のApplet.Watch.at365/VERIFICATION.md |
| 実装ガイド・API・READMEのローカルリンク | 48件の参照先の存在を確認 |
| ガイドの最小C#サンプル | ビルド成功、警告0・エラー0。manifest・起動・コマンド・設定購読・停止を実プロセスで確認 |
| publish.bat / deploy.bat | 0.1.0でCP932・CRLFと往復確認済み。今回変更なし |

成果物: `publish/AppDock.at365.exe`、125,254,942 bytes、Version 0.3.0、ProductName AppDock.at365。未署名。

SHA256: `BD8390D14ADAB655033167229FEA3A0BB16960110CA80AA0510F53B722BE93F0`。

最終portableテストは `artifacts/smoke-1791209958264/smoke-result.json`。既存画面のUIテストは `artifacts/ui-1791208806421/`、ショートカット・ピン・プロフィールのUIテストは `artifacts/preferences-1791208808973/`。時計のUIテストはAppletプロジェクトの記録を参照。

実装ガイドのC#コード例は `artifacts/docs-sample-1791210707074/` へ抽出し、ProjectReferenceだけ現行SDKの絶対パスへ置換してビルドしました。実際のDLLランナーとの接続、設定変更時の表示更新、終了を確認しています。

Watchの時計だけを外部Appletとして移行済みです。GmailChecker、Watchの入力フック・クリップボード・AutoLock、WallpaperSlideshowの移行は対象外です。別のクリーンPCでの実行、OS起動時の自動起動、長期常駐、配布署名は未検証です。このv0.3.0の検証時点ではElectronと.NETランタイムを同梱していました。現在の.NETランタイム要件は冒頭の「環境の.NET 10 Runtimeを使用」を参照してください。
## WindowsTools対応（2026-10-06）

`codex/windows-tools` worktreeで動的コマンド置換APIと`shortcut-list`設定UIを追加。v0.4.0。

- 型チェック・ビルド成功、既存分を含む33/33テスト成功。
- WindowsTools発行DLLとの実UI連携: 設定画面からの追加／名前変更／削除、対応するグローバルホットキーの登録／解除、削除済みコマンドの拒否、再起動／停止を確認。
- ポータブルEXE生成成功。展開済み配布アプリでも実UIテスト成功。ポータブルEXE自体のスモークテストは、初回の設定ファイル置換EPERM後、再実行で成功（WindowsTools running、panelあり、終了コード0）。
- 自動ロック・実消灯は実行していない。WindowsTools側の模擬APIで検証。実利用の設定は変更していない。

## 2026-10-06: v0.5.0 壁紙Applet・共通遅延開始・最低ホストバージョン

- TypeScript main/renderer型検査、Vite build、.NET Release build成功。自動テスト39/39。
- 遅延はプロセスを作る前に実施し、ほかのAppletを待たせない。既定値・保存上書き・設定変更時の再予約・無効化・再起動・今すぐ開始・終了時の解放を確認。
- 最低ホストバージョン不足は遅延待機前・実プロセス起動前に拒否。旧設定は遅延0のまま読み込む。
- JSON設定と画像付きパネルを検証。画像は4件まで・base64 rasterのみ、拒否した入力で既存パネルを維持。既存.NET Panelコンストラクターは保持。
- パッケージ版AppDockで壁紙Appletの隔離GUIテスト成功（履歴・ページ送り・設定保存・遅延取消・今すぐ開始・最低バージョン拒否・各更新チェック）。履歴画像はAppDock内に表示。外部への更新問い合わせは模擬化。
- portable完成EXEを隔離フォルダーへコピーしたsmoke成功。bridge / sandbox / 設定・avatar・ピン・ショートカット保存 / 正常終了を確認。smokeのElectron子プロセスだけELECTRON_RUN_AS_NODEを除去。
- SDK/Runtime v0.5.0。Watch v0.1.1（8/8）、WindowMover v0.2.1（23/23）、WindowsTools v0.1.1（11/11）は再publishと回帰テスト成功。
- 成果物: publish/AppDock.at365.exe、100,409,300 bytes、ProductVersion 0.5.0。
- SHA256: E0E9646499693F5D550086EFB8D537CA69F39195DB6C99A5E55EE0BB5B497C18。
- 詳細と壁紙APIの実機検証境界: ../Applet.WallpaperSlideshow.at365/VERIFICATION.md。

## 2026-10-06: v0.7.0 トレイコマンド設定

- main/rendererのTypeScript型検査、Vite build、.NETホストpublish成功。回帰テスト48/48。
- `trayCommands`の既定は空、`host.trayClickCommand`の既定は`appdock.open`。旧設定への補完、不正ID・型・重複・件数上限、動的置換時のメニュー名と可用性を確認。
- 未インストールの旧サンプル設定・空の`appdock.dotnet-demo.refresh`割り当てを起動時に整理。明示的にインストールしたfixtureと本来のApplet設定・未知コマンドは保持。
- 専用Node AppletのUIテスト成功: コマンドごとのON/OFF、ホストopenのON/OFF、保存直後の実Menu反映、実MenuItemのコールバックとTrayのclickイベントからの実プロセス実行、停止時の無効表示・クリック失敗時のログとウィンドウ復旧、再起動後の保持、追加のdouble-clickハンドラーがないこと。
- 開発版UI: `artifacts/tray-ui-1791290538638/`。発行済みパッケージ版UI: `artifacts/tray-ui-1791290613999/`。1280/900 DIPの画面をPNGで確認。Windows sandboxでのElectron起動はAppContainer ACL制約で失敗したため、ACLを変更せずsandbox外で再実行して成功。
- 単一EXE生成の正常終了後、コピーしたv0.7.0製品EXEのsmoke成功: `artifacts/smoke-1791290651412/smoke-result.json`。Tray clickから既定open・設定・検索、未知コマンド失敗時の復旧、bridge/sandbox、settings/avatars/pinsの保存と正常終了を確認。
- 自動化は実Trayオブジェクトのイベントと実MenuItemのコールバックを使用。Windows通知領域へ物理マウス入力を送る操作、消灯・ロック・壁紙変更などの実機副作用は行っていない。実利用先のEXE・設定の上書き、外部公開・pushは行っていない。
- 成果物: `publish/AppDock.at365.exe`、100,415,159 bytes、ProductVersion 0.7.0。
- SHA256: `83BFB8A0CFF147CFA2F880A7F3F5C535D02ADEBB7894D0F369339A0F7A1D406E`。

## 2026-10-06: v0.8.0 ハードウェアアクセラレーション

- 一般設定にON/OFFを追加。既定true、旧設定もtrueで補完、不正型は保存・起動時に拒否。変更の反映にはAppDockの完全終了・再起動が必要。
- 設定読込を単一インスタンスのロック取得後・Electron ready前へ移し、falseのときだけ`app.disableHardwareAcceleration()`を呼ぶ。不正な既存設定のエラー表示とファイル保持は継続。
- TypeScript main/renderer型検査、Vite build成功。回帰49/49成功。
- 開発版UI: `artifacts/hardware-acceleration-1791291279414/`。発行済みパッケージ版UI: `artifacts/hardware-acceleration-1791291320721/`。ON→OFF→ONを保存して3回起動し、Electronの`isHardwareAccelerationEnabled()`がtrue→false→trueとなること、保存直後は実行中の状態を変更しないことを確認。OFF時のGPU合成は`disabled_software`。フォームと再起動説明をPNGで確認。
- 早期設定読込後もパッケージ版のトレイUI回帰成功: `artifacts/tray-ui-1791291322655/`。
- 単一EXEのsmoke成功: `artifacts/smoke-1791291399989/smoke-result.json`。隔離profileで起動、bridge/sandbox、設定・avatar・ピン保存、トレイコマンドと正常終了を確認。ON/OFFの実状態検証は上記の発行済みパッケージ版で実施。
- 実利用のEXE・設定、Applet、GPUドライバーは変更していない。外部公開・pushなし。
- 成果物: `publish/AppDock.at365.exe`、100,412,458 bytes、ProductVersion 0.8.0。
- SHA256: `517053B6460EDB1477A7A418E6BD9D2B4D41C4C8B66DFA812DB83E893F0FF0F9`。

## 2026-10-06: v0.9.0 トレイのダブルクリック設定

- 一般設定に`host.trayDoubleClickCommand`を追加。既定null、旧設定も未設定で補完。未設定時のシングルクリックは即時実行、割り当て時は待機し、double-clickが来れば対応するsingleだけを取り消す。
- Electron v44.5.1のWindows実装のmouse-down / double-click通知順と、Windows GetDoubleClickTimeの仕様を確認。判定時間は読取専用の.NETホスト補助コマンドで毎回取得。この環境では340ms。通知順への25ms余裕を加え、取得時間を待機時間から差し引く。取得失敗時はwarnと最大5000msの待機にする。
- TypeScript main/renderer型検査、Vite build、.NETホストpublish成功。回帰55/55。単クリック即時/待機、二重実行抑止、ネイティブ取得完了前の取消、独立した複数クリック、設定変更・メニュー・終了時の取消、取得失敗を確認。
- 開発版UI: `artifacts/tray-ui-1791292040494/`。発行済みパッケージ版UI: `artifacts/tray-ui-1791292062264/`。別コマンドのsingle/double、ダブル時に単クリック側が動かないこと、単クリックの遅延実行、保存直後の反映、再起動後の両設定保持、停止時の復旧、未設定へ戻した際の即時実行を実TrayイベントとNode Appletで確認。1280/900 DIPの画面をPNGで確認。
- Windows通知領域への物理マウス入力は送っていない。確認したElectron実装と同じclick→double-clickイベント順で検証した。
- 単一EXEの初回smokeは設定置換のEPERMで失敗（`artifacts/smoke-1791292123270/`）。新しい隔離profileで再実行して成功（`artifacts/smoke-1791292140961/smoke-result.json`）。bridge/sandbox、設定・avatar・ピン保存、既定トレイコマンド、正常終了を確認。ダブルクリックの実行検証は上記パッケージ版で実施。
- 実利用のEXE・設定、Windowsのマウス設定、各Appletは変更していない。SDK/Runtime API変更、外部公開・pushなし。
- 成果物: `publish/AppDock.at365.exe`、100,414,619 bytes、ProductVersion 0.9.0。
- SHA256: `5A052C4D7D1E004B5BDF26EC3E5DCA4FCDC8381C23DF826F7D51BBB2D781DD6A`。

## 2026-10-06: タスクマネージャーの表示名修正

- portable起動用EXEの`FileDescription`にpackage.jsonの長い英語のdescriptionが使われていたため、descriptionを`AppDock.at365`へ変更。製品名・EXE名・バージョン0.9.0は維持。
- プロジェクト内Node.js/pnpmと既存Electron配布ファイルを使用して再パッケージ。portable起動用EXEとwin-unpacked本体の`FileDescription` / `ProductName`がともに`AppDock.at365`であることを確認。PE Machineは起動用EXEが0x014C（x86）、本体が0x8664（x64）。
- 単一EXEの隔離smoke成功: `artifacts/smoke-1791293112989/smoke-result.json`。起動、bridge/sandbox、設定・avatar・ピン保存、既定トレイ操作と正常終了を確認。タスクマネージャー画面自体は未確認。
- Sandboxでの初回起動は結果なし・終了コード2147483651。通常実行環境での初回はテスト設定置換のEPERM、新規profileでの再実行は成功。初回パッケージ処理のElectron取得はネットワーク制限で失敗し、既存ローカルElectronを指定して成功。
- SHA256: `F332E5CE2AB3DF065724CA62030232BAE6379DCCBADBC099364CD8E62598C7F3`。
- ユーザーの完全終了後、実利用先へEXEを配置。配置済みEXEのSHA256が発行元と一致し、`FileDescription` / `ProductName`は`AppDock.at365`、settings.jsonのSHA256は配置前後で不変。旧EXEは`artifacts/process-name-deployment`へ退避。配置スクリプトは実行ポリシー制限で起動できず、pwsh.exeもPATHにないため、スクリプトと同じCopy-Itemで配置。実利用アプリは再起動していない。外部公開・pushなし。

### 表示名の実画面確認

- 修正版を再起動しても、修正前から開いていたタスクマネージャーでは古い英文が残っていた。配置済みEXEのFileDescription/ProductNameはAppDock.at365で、確認したMuiCache内のAppDock表示名にも古い英文はなかった。
- ユーザーがタスクマネージャーを閉じて開き直し、AppDockホストウィンドウを表示した状態でもAppDock.at365になることを確認。タスクマネージャー側の古い表示が再起動で解消した。キャッシュやレジストリの削除、追加のEXE修正は行っていない。

## 2026-10-06: ビルトインの再起動・終了コマンド

- `appdock.restart`（再起動）と`appdock.quit`（終了）をホストのコマンド一覧へ追加。パレット・ピン留め・ショートカット・トレイ設定が同じ一覧を利用し、既定キーは追加しない。既存トレイの終了とwindowActionのquitも同じ終了処理を利用する。
- 再起動はElectronのrelaunchを予約してからquitし、既存のbefore-quitでホットキー・Applet・設定監視・トレイを終了する。終了開始後の再要求は無視する。portable版は元の配布EXEへ戻り、削除される展開先を作業ディレクトリに残さない。
- main/rendererのTypeScript型検査とビルド成功。既存回帰55/55成功。変更したTypeScriptと新検証スクリプトのPrettier確認成功。
- 開発版の実プロセス検証成功: `artifacts/host-commands-1791294664778/result.json`。パレットから再起動し、ホストPIDの切り替えと旧ホスト・workerの終了を確認。同時に2回の再起動要求でも1回だけ再起動。保存済み設定を保持し、割り当てたショートカットでcloseToTray設定にかかわらず完全終了。非同期deactivateの完了記録が各再起動・終了前に残り、最後にプロセスが残らないことを確認。
- 単一EXEでも同じ検証成功: `artifacts/host-commands-1791294787489/result.json`。3回のホストPIDは52236 → 50272 → 54616。再起動後も隔離プロファイルを保持し、2回の再起動と完全終了を確認。パレットの表示はPNGでも確認。
- GUI起動はWindows sandbox内で完了せず、許可された通常実行環境の隔離プロファイルで検証。パッケージはプロジェクト内Node/pnpmと既存Electronを指定して生成。実利用先のEXE・設定・Appletは変更していない。
- 成果物: `publish/AppDock.at365.exe`、100,498,304 bytes。SHA256: `7909549E145F4229A20FEC56608499B6F7825EFFEF372A6D3DBC3DAC526FC9E9`。

## 2026-10-06: トレイのビルトインコマンドを最上位へ移動

- 選択されたビルトインをAppDockサブメニューから最上位へ移動。Appletサブメニュー→セパレータ→ビルトイン（フラット）→セパレータ→固定の設定/終了の順とし、空の区画では余分なセパレータを省く。グループの所有者IDで区別し、Appletの表示名に依存しない。既存の表示選択とコマンドIDを維持。
- TypeScript main build、renderer型検査、Prettier、トレイ回帰4/4成功。開発版実トレイUI成功: `artifacts/tray-ui-1791295415722/`。
- 発行したwin-unpacked版の実トレイUI成功: `artifacts/tray-ui-1791295488202/`。Appletのみ/両方/ビルトインのみ/選択なしの実Menu階層と区切り位置、最上位の開くコールバック、既存Applet実行、表示切り替え、単/ダブルクリック、保存・再起動を確認。物理的なWindows通知領域への入力は送っていない。
- 更新した単一EXEの隔離smoke成功: `artifacts/smoke-1791295545430/smoke-result.json`。bridge/sandbox、設定・avatar・ピン保存、トレイコマンドと正常終了を確認。
- 最新成果物: `publish/AppDock.at365.exe`、100,500,097 bytes。SHA256: `E9A5F315042CB71759231D28F3DB597CAED93F5BF234FB6F22F06EF37C8B7C65`。実利用先への配置は行っていない。
# 2026-10-07 Settings scroll layout

- Keep the settings heading and save toolbar outside the scrolling body. Reserve scrollbar space and reset category/Applet/tab/mode scroll before paint.
- Renderer TypeScript check and Vite build passed.
- `scripts/settings-scroll-ui-test.cjs`: isolated Electron profile, 1280/900/760px widths; heading/toolbar bounds remain unchanged during scrolling and general-to-appearance switching, form width stays stable, JSON switching works.
- Initial sandbox launch was blocked by Electron install-directory ACL restrictions; the UI checks passed outside that sandbox without changing ACLs. Packaged EXE and deployed installation were not updated.

- Deployment completed after user shutdown confirmation: portable smoke passed (artifacts/smoke-1791327621153); deployed EXE SHA-256 matches publish output, settings.json SHA-256 unchanged. Previous EXE retained in artifacts/settings-scroll-deployment-20261007-075937. App was not restarted.

## Settings display cleanup (2026-10-07 JST)

- Removed the settings subtitle and bottom settings-file path; the heading omits its paragraph when no subtitle is supplied.
- Renderer typecheck/build and existing 1280/900/760px settings-scroll UI checks passed. Screenshot inspected at 900px.
- Portable smoke passed (artifacts/smoke-1791328207131). Deployed with matching EXE SHA-256 and unchanged settings.json; previous EXE backed up in artifacts/settings-cleanup-deployment-20261007-081014. App was not restarted.

## 2026-10-07: 設定とAppletの一覧を統一・検索フィルターをボタン化

- 設定カテゴリとApplet別設定の一覧をshellの左パネルへ移動。Appletと背景・余白・文字・選択表示を共通化し、既存の保存済み一覧幅を両画面で共有。フォームとJSON編集、未保存印、画面移動時のdraft保持、固定見出し・保存バーは維持。
- ホーム・Applet・ログのタイトル下の案内文を削除。ショートカットの検索欄と状態フィルターを同じ行へ配置し、「すべて／割り当て済み／未設定／競合・エラー」の排他的な切り替えボタンへ変更。選択状態はaria-pressedで表示し、領域不足時は折り返す。
- main/renderer TypeScript型検査、Vite build、変更コードのPrettier、git diff --check成功。
- 既存の一覧幅UI検証を拡張し、両画面のスタイル一致、ドラッグ・キー操作・幅の上限下限、幅の相互反映と再起動後の復元、未保存データ保持、3画面の案内文削除を確認。開発版: `artifacts/applet-sidebar-1791328926715`、発行win-unpacked版: `artifacts/applet-sidebar-1791329187617`。
- 設定スクロールUI検証成功。1280/900/760pxで見出し・保存バーを固定し、カテゴリ切り替え・JSON表示・フォーム幅を確認。
- ナビゲーションUI検証成功。検索・全4種類の絞り込み・Spaceでのボタン選択、複数Appletの編集保存、JSON不正時の保持、外部変更との競合保護、24 Applet、ライト/ダーク、1280/900/700pxでの検索とフィルターの同一行配置・同じ高さ・横はみ出しなしを確認。開発版: `artifacts/navigation-1791329154290`、発行版: `artifacts/navigation-1791329206049`。既存検証の古い期待件数を共通開始遅延設定と現行5件のホストコマンドに合わせた。
- 900pxの設定フォーム・ショートカットと700pxの設定をPNGで確認。初回のsandbox GUI起動はElectronのinstall-directory ACL制限で失敗したため、ACLを変更せず許可された通常実行環境の隔離profileで検証した。
- プロジェクト内の既存ツールとElectron、既存.NET host成果物で単一EXEを再発行。portable smoke成功: `artifacts/smoke-1791329218130/smoke-result.json`。bridge/sandbox、設定・avatar・ピン保存、トレイ操作、正常終了を確認。実利用先への配置は行っていない。
## 2026-10-07: Appletウィジェット基盤 v0.10.0

- manifest宣言、widgets capability、Node/.NET SDKの登録・配置取得・表示操作API、配置JSON検証を追加。時計・日付・テキスト/値一覧を共通Reactで描画し、ホームのピン留めとデスクトップを独立管理。9アンカー、自由位置、モニター、前面/デスクトップ、サイズ/色/不透明度、移動完了/取消/期限を実装。
- モニター/階層ごとに透過画面を共有。画面単位の日時タイマーを使い、Appletとの毎秒通信なし。バックグラウンドのShell確認時、親・座標が変わっていれば再接続し、変わっていなければSetParent/再配置を省く。背面表示を使うときだけ共通のShellブリッジを起動し、停止時に解放。専用preload、登録済みフォントの実パス検証、設定revisionで境界を維持。
- Watch 0.2.0をDLLへ移行。SDKのnull省略値（地域設定・パネル）を受け付ける互換処理も確認。既存のnative/.NET/Node Appletを維持。UIテストのElectron子プロセスからだけELECTRON_RUN_AS_NODEを外す。
- main/renderer型検査・Vite build成功。ホスト回帰64/64（ウィジェット6件を含む）、Watch回帰14/14成功。実Nodeウィジェットの内容更新とクラッシュ時の内容解放、配置の保持を検証。
- 最終開発版UI: `artifacts/widgets-ui-1791331213323`、最終win-unpacked版UI: `artifacts/widgets-ui-1791331254254`。Watch DLL実通信、初回移行/再登録時の配置保持、ピン/フォーム、共有画面、秒更新、透明画素、専用IPC、移動保存/取消、表示コマンド、停止/有効化/再起動、下書きの画面移動時保持、ライト/ダーク、900pxでの横はみ出しなしを確認。
- 接続済み2画面へ時計と日付を独立配置し、前面・デスクトップの両方で確認。未接続IDを保持してメインへ退避。Win32の親クラスProgman、WS_CHILD、WS_EX_LAYERED/TRANSPARENT/NOACTIVATE、前面と背面のTOPMOST状態、固定前後のフォーカス不変、実ピクセル座標を確認。PNGを目視確認。
- 既存Applet/設定/JSON/コマンドのGUI: `artifacts/ui-1791331012145`、設定スクロール1280/900/760pxも成功。単一EXE+Watch DLLの最終smoke: `artifacts/smoke-1791331259893/smoke-result.json`（ok=true）。
- Windows sandbox内のGUI起動、NuGet設定アクセスは制限されたため、ACL/グローバルツールを変更せず、許可された環境で隔離profileを使って検証。プロジェクト内Node/pnpmと既存Electronで発行。
- `publish/AppDock.at365.exe`: 100,511,894 bytes、SHA256 `18B06407B4B761734F3AB409E96895927F27E65B97C6DF07A80B12AC9E93A15D`。framework-dependentの.NETホストにcoreclr.dll同梱なし。プロジェクトの`publish/extensions/Applet.Watch.at365`だけDLLに更新し、発行元との4ファイルのハッシュ一致、旧Watch EXEなしを確認。実利用先への配置・公開・pushは行っていない。
- 未確認: 物理マウスによるドラッグと下側ウィンドウの操作、実モニター着脱、異なるDPI間の移動、Explorer強制再起動、RDP、スリープの実往復、長期常駐。配置ドラッグの保存検証はウィンドウ座標をプログラムから変更して実施。Shell表示面はWindows依存。
## 2026-10-07: v0.10.1 日付書式・文字配置・保存バー修正

- 元Watchの`Watch.xaml.cs`で`CultureInfo.InvariantCulture` / `M/d ddd`を確認。Intlの自動書式による曜日先行・カンマを除去し、Watchは`10/7 Wed`の書式に復元。タイムゾーン指定は保持。
- ウィジェットごとに左右（左/中央/右）・上下（上/中央/下）揃えを追加。既存設定はautoで読み込み、デスクトップではアンカー側、ホームでは中央に配置。プレビューは揃えの下書きを反映する。
- 日時を実描画境界のSVGで描画し、フォントの行高/サイドベアリングと中央基準のtransformによる余白を除去。時分と半サイズの秒をそれぞれ一続きの文字列で描画し、文字単位の等幅化は行わず、元の比例幅・字間を保持。秒で全体幅が変わっても、左端/右端/中心の選択位置を固定する。計測結果は上限256件のキャッシュで再利用。
- ウィジェットの見出しと保存/再読み込みを設定ページと同じ共通レイアウトへ移動。上部右側のバーを固定し、フォームだけスクロール。設定画面の既存UI検証は表示中のページへ絞り込むよう更新。
- main/renderer型検査・Vite build・.NET host publish成功。ホスト回帰67/67、Watch回帰14/14成功（日付/タイムゾーン、旧配置の揃え移行、比例幅の維持と実描画境界を追加）。
- 開発版UI: `artifacts/widgets-ui-1791333446251`、発行win-unpacked版UI: `artifacts/widgets-ui-1791333558608`。Playwrightの時計制御で00～59秒の自然な全体幅変化と、固定した左端/上端を確認。全9通りの揃えで各60秒進め、選択した端/中央とウィジェットの端/中央の距離が0.5DIP以内で一定。Hatten.ttfの実描画境界がSVG端から2px以内（実測は左右1px以内・上下0px）、日付`10/7 Wed`、揃え保存/再起動復元を確認。1280/900/760pxでスクロール前後の保存ボタン矩形不変、管理画面PNGを確認。実時刻での秒更新も確認。
- 既存設定スクロールUIは1280/900/760pxで成功。単一EXE+Watch DLL smoke: `artifacts/smoke-1791333566349/smoke-result.json`（ok=true）。Windowsの一時的なJSONファイル占有（EPERM）が途中のUIテスト中に1回発生し、テスト内の配置操作だけ最大2回再試行するよう調整。本体の保存処理・失敗報告は変更していない。
- `publish/AppDock.at365.exe`: 100,515,435 bytes、SHA256 `7C332C142040FB9D3669DFBA7227ADD068B1E4C65AFCD212D3AC170ED2818A38`。Watch Appletのソース・実利用先の設定/EXEは変更せず、プロジェクトの発行版だけ更新。外部公開/pushなし。

## 2026-10-07: v0.10.2 デスクトップ固定の描画開始を修正・デプロイ

- デスクトップ固定後のWin32親・座標・可視フラグは正常でも、実画面では表示されない症状を隔離fixtureで再現（`artifacts/widget-visibility-1791334244597`）。以前の親/スタイル検証と`capturePage()`だけではこの欠落を検出できなかった。
- Shell接続後、初回と非表示からの復帰時にElectronの`showInactive()`も呼んでChromiumの描画を開始し、親と座標を再確認する。通常の5秒ごとの確認でshowを繰り返さない。デスクトップ固定は維持し、GPUやShellの設定は変更していない。
- 新しい`test:widget-desktop`は隔離Node fixtureを使い、露出したデスクトップの180×120pxだけに色マーカーを描画して実画面を撮影。緑/紫の表示更新、通常のテストウィンドウによる遮蔽と復帰、非表示からの再接続、マーカー除去後の透明部分を確認。利用者のウィンドウ・壁紙を変更しない。画面の色管理を考慮し、色相と領域の90%以上の画素で判定。
- 開発版の実描画検証: `artifacts/widget-visibility-1791334489928/result.json`。発行win-unpacked版: `artifacts/widget-visibility-1791334630152/result.json`。21,600画素中、緑21,309画素、紫21,301画素、通常ウィンドウの黒21,150画素。除去後は元の背景の画素集計に戻る。
- main/renderer型検査・Vite build・Prettier・git diff --check、ホスト回帰67/67成功。Watchウィジェットの開発版UI: `artifacts/widgets-ui-1791334419882`、発行版UI: `artifacts/widgets-ui-1791334637705`。DLL起動、全9通りの文字寄せの秒更新、2モニターの親と座標、フォーカス維持、移動/保存/取消、停止/再起動、テーマ/保存バーを確認。単一EXE+Watch DLLの隔離smoke: `artifacts/smoke-1791334645561/smoke-result.json`（ok=true）。Explorer強制再起動、実モニター着脱、RDP、長期常駐は今回も未検証。
- `publish/AppDock.at365.exe`: 100,512,630 bytes、SHA256 `5571AAF9B070E88F4DA9583AC08422FB5871F22538B894847399B596296AADED`。ローカルNode/pnpmと既存Electron/.NET host成果物で再発行。native bridge/APIとWatchソースに変更なし。
- ユーザーから完成後の`deploy.bat`実行指示を受け、実行直前のAppDock/ExtensionHostプロセス0件を確認してデプロイ。デプロイ先のProductVersion 0.10.2と発行元SHA256一致、settings.jsonの前後SHA256不変を確認。旧EXEと結果を`artifacts/widget-desktop-deployment-20261007-095802`へ退避。実利用のアプリは起動していない。外部公開/pushなし。

## 2026-10-07: ウィジェットの実利用確認・mainへ統合

- ユーザーがデプロイ済み0.10.2で正常動作を確認。ユーザーの指示により、AppDockの`codex/widgets`（e04584a）とWatchの`codex/widgets`（90b3e2e）を各`main`へfast-forwardで統合。マージ前後のGit treeが同一で、検証済みコードへの変更がないことを確認。
- 旧EXEのSHA256と配置済み0.10.2のSHA256を確認してから、今回の退避先`artifacts/widget-desktop-deployment-20261007-095802`の旧EXE・結果JSON・空フォルダーを削除し、消失を確認。以前のデプロイや別作業の退避物は対象外。
- 両リポジトリのマージ済み`codex/widgets`を削除。実利用先のEXE・設定・Applet、発行版には変更なし。外部公開/pushなし。

## 2026-10-07: テキスト入力のスペルチェックを無効化

- メイン画面とウィジェット画面の`webPreferences.spellcheck`をfalseにし、画面作成前に共有セッションも`setSpellCheckerEnabled(false)`で無効化。設定JSONへの追加・移行は不要。
- ローカルTypeScriptによるmainビルド・renderer型検査、Vite build成功。既存Electron/.NET host成果物からportable EXEを再発行。
- win-unpacked版の隔離起動で`session.isSpellCheckerEnabled() === false`とプロフィール欄への文字入力を確認。スクリーンショットでもスペルチェックの赤い下線がないことを確認。結果: `artifacts/spellcheck-1791347487183/result.json`。
- 完成した単一EXEの隔離smokeも成功: `artifacts/smoke-1791347529413/smoke-result.json`（ok=true）。この検証で実利用の設定やAppletは読み書きしていない。
- `publish/AppDock.at365.exe`: 100,512,311 bytes、SHA256 `91005CC49BC2501A9A5367E5DBB8BED5203D91EC327CA6C430049A9B4B3090BB`。AppDockプロセス0件を確認して実利用先へ配置し、発行元とのハッシュ一致とsettings.jsonの前後SHA256不変を確認。旧EXEは`artifacts/spellcheck-deployment-20261007-133309`へ退避。実利用アプリの再起動は行っていない。

## 2026-10-07: ダブルクリック判定時間の取得失敗時は既定500ms

- 取得失敗時の判定時間を5000msからWindowsの既定値500msへ変更。ログ側とDispatcher側で定数を共有し、正常時のOS設定値と既存の25ms余裕は維持。READMEとホスト開発ガイドを更新。
- 根拠: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setdoubleclicktime
- mainビルド・renderer型検査・Vite build、関連回帰10件、変更したTypeScript/テストのPrettier、git diff --check成功。回帰では取得失敗後の単一操作、ダブルクリックによる取消、メニュー/設定変更/終了時の取消を確認。
- portable発行と隔離smoke成功: artifacts/smoke-1791350201920/smoke-result.json。Watchの.NET拡張running、パネル/コマンド/設定保存を確認。
- 元の配布EXEの7zip一覧にはruntimeconfig/depsが存在するが、稼働中のTemp展開先には両JSONとPDBが欠けていた。起動済み.NET拡張は存在しており、起動後の消失が疑われる。削除原因は未特定。PCのMicrosoft.NETCore.App 10.0.12と発行元の判定時間取得340msを確認。
- ユーザーのdeploy依頼後、AppDock/ExtensionHostプロセス0件を確認して既存deploy.ps1で実利用先へ配置。SHA256 CF656034E722EC2B24FBC6D1EA86887BBA108D8688E553F9851F3AC2F89CC9AAが発行元と一致。settings.json不変。旧EXE退避: artifacts/tray-fallback-deployment-20261007-141726。実利用アプリの自動再起動は行っていない。
- 500msフォールバック修正版について、ユーザーがdeploy後の実利用で正常動作を確認（2026-10-07 JST）。設定ファイル消失の原因は引き続き未特定。
- ユーザーの依頼で今回の退避フォルダーartifacts/tray-fallback-deployment-20261007-141726を削除。旧EXE・配置結果JSONを照合後に削除し、空フォルダーも除去、消失を確認。実利用EXE/settings.jsonは削除前後のSHA256一致。他作業の退避物は対象外。
## 2026-10-07: v0.11.0 GmailChecker向けの共通通知API

- Node APIへファイル選択（JSON/WAV）、短いWAVの順次再生、Appletごとのトレイattention、デスクトップ通知のsilent/クリックコマンドを追加。既存API v1/.NET呼出しは維持。停止・異常終了でattentionを解除し、音声は起動世代を確認して中止する。
- main/rendererのTypeScript型検査・Vite build成功。ホスト回帰70/70（既存67＋追加3）成功。Gmail側は16/16。既存Node/.NETの実プロセス起動・異常終了・再起動の回帰も成功。
- 実Electronで暗号化fixtureとGmail AppletのNode workerを接続し、新着表示、クリア、監視切替、削除取消、WAV選択、無音WAV再生、設定保持、停止を確認。発行版の結果は`../Applet.GmailChecker.at365/artifacts/ui-1791355520145/result.json`。通常幅/900px幅の画面を目視確認。
- 完成したportable EXEと未改変のAppletでも、初回案内、設定、消音、無効化/再有効化、終了コード0を確認。結果は`../Applet.GmailChecker.at365/artifacts/portable-1791355697468/result.json`。
- .NETホストを既存build-dotnet手順でクリーン発行し、ローカルElectronからportableを作成。単独electron-builder実行はpnpm PATH不足で失敗したが、dev.bat経由で成功。EXE SHA256: `4A6B3D6DBD4302C7A6A3015731344E8795CE7473CC760909EBB580F9C89F4275`。
- Gmail Appletを開発用publish/extensionsに配置し、5ファイルのハッシュ一致を確認。実利用先へのdeploy・外部pushは実施していない。実Google OAuth/新着、Windows通知の実表示とクリック、実音の聴感、スリープ復帰・長時間常駐は未確認。

## 2026-10-08: 0.21.0 設定ページの操作ボタン

- settingActionsを宣言して自身の宣言済みコマンドを実行。結果表示、実行中の無効化、停止中の可用性、未保存draftの維持を追加。settingActionsは設定データへ保存しない。
- ローカルツールによる型検査、TS/Vite build、ホスト回帰91/91、publish.bat成功。.NET発行物はframework-dependentで、hostpolicy/coreclr等のランタイムファイル混入なし。
- WallpaperSlideshowの隔離native fixture＋最終win-unpackedを使ったGUI: `../Applet.WallpaperSlideshow.at365/artifacts/background-settings-1791464780421/result.json`。手動案内、成功/失敗、実行中のボタン無効化、未保存77秒の維持、paused維持、操作データ非保存、停止時無効化、900×720 DIP横はみ出しなしを確認。success/small画像を目視確認。
- 最終単一EXEの隔離起動: `artifacts/smoke-1791464853687/smoke-result.json`、ok:true。初回smokeは発行完了前のコピーで最終ハッシュと違ったため、発行完了後に再実行した。最終EXE/検証コピーのハッシュ一致を確認。
- 実利用先deploy、commit、pushなし。実Windows背景を変更する検証ではない。
- 通常sandboxのpnpm呼出しはポリシー確認で進まず中断。プロジェクト内の既存Nodeで検査し、許可された通常Windows環境のdev.bat/publish.batでは成功。グローバルツールの導入なし。
- 最終EXE: 100574539 bytes、SHA256 DDCCF49D9702CB8A2E879AD44552DF2AE36114EFA6E1A43BB841A0BDB7A05A7D。

## 2026-10-09: v0.22.0 単一EXEとAppletの共通自己更新

- mainのクリーンな状態から、同じcheckoutにcodex/portable-updatesブランチを作成。worktreeは作成せず、本体単一EXEを維持。更新元は本体/各Appletごとのローカル絶対パス・UNC・HTTP(S) feed・GitHub Releases。起動時の本体/各Applet確認、待ち時間、通知、同版再適用を保存できる。起動時確認はmetadataだけで、download/installは呼ばない。
- framework-dependent .NET 10単一ファイルhelper（197666 bytes）を本体内に同梱。交換前の準備・SHA256/サイズ・ID/版/最低host/manifest・ZIP範囲検証、実PID/外側ランチャー終了待ち、全候補交換・逆順復元、journalと結果記録を実装。設定/.appdock/ほかのAppletは交換対象外。
- main/renderer型検査、TS/Vite build、.NET host/updater Release発行、dev.bat run dist終了0。回帰100/100、失敗0（artifacts/portable-updates-regression.log）。新規9回帰は旧設定移行/更新元/ID/版/互換性/起動時確認のみ/HTTP-GitHub metadata/実helper2Applet交換と途中失敗時復元/ZIP traversal拒否。sandboxのTEMP制約はプロジェクトartifacts/test-tempで確認し、Electron GUIは許可された通常Windows環境で実行。
- 既存ui/navigation/preferences GUI成功。navigationでは新しい更新設定の保存バー表示を確認し、未保存のApplet設定を保持する既存試験を継続。
- 実portableのartifacts/portable-updates-1791472687891/result.jsonはok:true。起動時metadata確認のみ、無効Appletも対象、下書き時更新禁止、設定保存、実.NET DLL Appletの稼働/停止/一括交換/再起動、無効状態保持、obsolete.dll除去、設定/ログインfixture保持、同じhelperで本体EXE交換・再起動、個別ボタンから同版再適用が成功。最終確認native dialogだけ隔離試験内で応答を差替え、交換/終了/起動は実処理。updates-settings.pngを目視確認。
- 最終EXEは100595163 bytes、SHA256 DB67DBC642612535381D90CF37801027E7686D9454B5889ECF9CC93C06D86584。publish/update.jsonのsize/hashと一致。自己更新helperとframework-dependent .NET hostを同梱し、.NET runtimeは既存の利用要件のまま。本体/各Appletが実利用されている配置先にはdeployしていない。
- 試験の途中失敗は保存ボタンの旧名、inspector内のrequire参照、終了するrendererのIPC完了待ち/CDP再接続が原因。保存名を現UIへ変更し、createRequireと再起動後Node inspectorで実snapshot/個別ボタンを確認する方式へ修正。製品の確認ダイアログを省略するコードは追加していない。最終試験は終了0。
- 未確認: 実UNC共有からの取得、GitHub上での公開/実Release asset取得、実Webサーバーからの全パッケージ取得、更新通知の実toast表示/人手クリック、電源断中の本体復元、各製品Appletの独自保存データ。対応経路は実装済みだが、公開や実利用操作で検証したとは扱わない。非公開GitHub認証とprereleaseは非対応。
- 最終確認: 起動時確認を待ち時間中にOFFにした場合の取得抑止、破損ダウンロード時に確認/終了へ進まない回帰を追加して100/100成功。未保存時のガードは更新操作だけに限定し、従来の有効化/通常操作を保持。最終版で再度実portable更新試験が終了0。整形・diff check、更新文書27リンク、packed JS/helperと現在のbuildのバイト一致を確認。

## 2026-10-09: Release手順のリポジトリ内保存

- AGENTS.mdからdocs/RELEASING.mdをリリースの正本として参照。成功済み7repoのplan/public-verificationとオールインワン追加結果、GitHub v0.23.0の3assetのsize/digest/targetを照合し、コマンド・成果物・例外を記録した。
- scripts/release.ps1はSetVersion/Prepare/Draft/Publish/Verifyを分離。Prepareは既存の型検査/回帰/publish/実EXE更新/進捗/中断復旧/全体ZIP起動を直列実行し、全ソースclean・commit・ノート・3asset・証跡を固定。Draft/Publishはremote mainとtag、下書きとasset digestを再照合。公開済み上書きや自動clobberはしない。
- tests/release.test.cjs 6件成功: 全添付後だけ公開、未完了準備拒否、ソース/asset/remote main変更拒否、アップロード中断と不足分再開、remote digest不一致/asset欠落で公開停止、版の増加と正式版制約。GitHub操作はfixtureであり、この作業で実Releaseは変更していない。
- tests/all-in-one.test.cjs成功: 従来の異常時ZIP保持に加え、新しい兄弟repoを追加するとスクリプトの一覧編集なしで同梱されることを確認。WindowsのZIP区切りを正規化するverify-all-in-one.ps1で全収録hash/sizeと展開を検査。
- sandbox内のTEMPファイルrenameはEPERM。許可された通常Windows環境で同じfixtureテストを実行して成功。製品コードや権限制約を回避する変更は行っていない。
- 実Prepare通し検証: cleanなd142d62に対して `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/release.ps1 -Mode Prepare -NotesFile artifacts/github-releases-0.23.0/AppDock.at365.md -PlanPath artifacts/release-workflow-validation/plan.json` が終了0。型検査、回帰110/110、publish.bat、本体/一括/個別の実portable交換と再起動、進捗/取消/再試行、8停止点の復旧、全6Applet入りZIPの通常起動まで成功。plan.phase=prepared、全7ステップのログ/証跡/ハッシュを保存した。
- 同梱ZIPの全ファイル照合・通常EXEとの一致・初期無効/版/エラーなしを検証。`artifacts/release-workflow-validation/bundle-ui.json` はok:true、profileは`artifacts/bundle-verify-37aa59db-7962-41b4-8856-b79fd7bd56b6`。EXE 100598967 bytes/SHA256 4ee27650e20d5a94701d7f241b2961fbaa2e2684b17933b0e98db3b3608bd92b、ZIP 275723780 bytes/SHA256 ff66809c47707ebcd591c3436e36bd04d62b832423c1d06d789d2454e9e0a951。これは今回のローカル検証物であり、既存GitHub v0.23.0の配布物とは別。
- GitHubの新しいDraft/Publish/Verifyモードを実サービスへ実行して新Releaseを作る試験は行っていない。公開操作の順序/停止/再開はfixture、過去の実公開値は読み取りで確認。今回の版更新・main統合・push・Release変更・実利用deployはなし。
- この検証記録を追加するコミットでもソースSHAが変わるため、上記planは当時の成功証跡として保持し、将来の公開には再Prepareを必須とする。PS1はUTF-8 BOM/CRLF、BATは未変更。文書リンクと差分を確認。

## 2026-10-09: AppDock固有の運用情報をリポジトリへ移管

- ALICE/TOOLS.mdのAppDock運用注意とWebAppletの未実装相談をAGENTS.mdへ集約。今後の仕様/運用/検証/発行変更時に、この指示と参照文書の更新要否を確認するルールを追加。
- 旧版ごとの実装・検証経緯はdocs/implementation-history.mdへ本文を保持して移動。当時の未実装/未確認を現状と区別する注記を追加し、現行のAppletページ/共有設定/自己更新と照合。WebAppletのGmail保存領域分離と未決定事項も保持。
- 共通TOOLSにはサービス環境、汎用GitHub CLI、Computer Useの環境診断を残し、AppDock記述は0件。移動先へ無関係なtailnet/サービス設定が混入していないことを確認。移行時に元のAppDock本文と保存先、WebApplet節と保存先の包含一致を確認してから元を整理。
- AGENTS/DEVELOPMENT/履歴のローカルリンク36件とgit diff --check成功。文書のみの変更のためビルド/製品試験は実行していない。Release・deploy操作なし。

## 2026-10-09: Windows通知からテストEXEが起動する問題

- ユーザー報告: 配布版のApplet.GmailのWindows通知クリックでテストアプリが起動。Gmailは登録済み`at365.gmail.open`を本体通知APIへ渡しており、Appletの変更は不要。全起動でAUMID `at365.appdock`を共有し、実HKCUのElectron通知CLSID `{06A54B3B-33F5-45DF-AFDB-E9B640783044}` のLocalServer32は`publish/win-unpacked/AppDock.at365.exe`だった。Electron 44.6.0の自動登録は製品名の共通shortcutからCLSIDを読み、現在の実EXEを登録するため、テスト/配布の経路が混ざる。公式実装の参照はDEVELOPMENTへ記載。
- 修正: notifications.tsをApplet/更新通知で共用。Windows toastXmlに配置専用protocol URIを埋め込み、元のportable EXE・profile・packaged状態でschemeを分離。最初の通知時だけ元のEXEと必要な隔離profile引数をHKCUへ登録。second-instance/初回起動でUUID callbackを一度だけ処理し、外部URIの任意commandを受け付けない。同じApplet子プロセスの稼働ガードを維持。古い/前プロセスのトークンは本体を開く。単一EXE・既存AUMID/通知設定・Gmail保存データを維持。
- 検証: typecheck/build/Prettier/diff-check成功。通常Windows環境の全回帰124/124（artifacts/notification-regression-windows.log）。新規3試験は配置/開発の分離、URI検証/一度限り処理、XML escape/無音保持を確認。sandboxでは既存一時ファイルrename EPERM・子プロセス制限により失敗/停止したため、通常Windowsで実施。残存sandbox試験PID 59180と子46104を終了。
- 発行: `dev.bat run dist:host`成功、publish/AppDock.at365.exe 100608538 bytes、SHA256 `89A1D78522D9A2CE4B18BC737F6FAFA6B02BBADA8F38D6820C254E355AB92D30`。update.jsonを再生成。版は0.24.0のまま、本体だけのローカル発行。既存の別作業変更を保持、実利用deploy/commit/push/Release公開は行っていない。
- 実EXE: artifacts/notification-portable-1791514866382/result.json、最終試験終了0。2つの隔離単一EXEに合成通知を表示しWindows通知履歴のXML/起動登録を確認、通知内のURIをWindows Shellから起動。配置先ごとのcallback・他方のcount不変・一度限り処理・停止Appletガード・終了後の元EXE/profile起動を確認、コピーSHA一致。物理toastクリック/実Gmail受信は未実施。
- 後片づけ: 通知履歴の古いContent=null項目で初期のcleanupが失敗。null項目を対象外にして最終試験終了0。途中試験を含む合成URIを限定削除、試験前のCOM起動先とAppDock shortcutのtarget/cwdを復元。artifacts/notification-cleanup.logで全試験URI消去/元target照合、関連プロセス0を確認。ユーザーの実利用通知を消去していない。
- 更新前の既存通知は旧launchを持つため、修正後の新しい通知で確認が必要。README/DEVELOPMENT/AGENTSへ仕様と実通知clickの検証境界を記載。

## 2026-10-09: v0.26.0 汎用マウスジェスチャー

- ユーザー承認に従いmainへ実装。InputHostが右押下中の上下左右・左/中クリック・ホイール・キー入力を受け、本体/ブラウザ/指定exe/ページ/提供元/選択Applet/グローバル条件、保存順、同一コマンド重複抑制、除外、一時停止を管理する。WebBrowserToolsの11コマンドと送信キーは維持。旧設定の一回移行、Applet初期値のID衝突回避、開始対象/取消情報、共通ショートカット予約を追加。
- 最終型検査と全回帰141/141成功（artifacts/gestures-typecheck-final.log、gestures-regression-final.log）。WPF入力プロセスを自己完結で収録し、追加Desktop Runtimeを要求しない。publish.bat終了0、AppDock 0.26.0、WebBrowserTools 0.3.0、6Applet同梱ZIPを発行。実利用deploy/commit/push/Releaseは未実施。
- InputTestsの専用Windowで実SendInput/カーソル操作17項目成功（artifacts/gestures-native-final.log）。単方向、方向転換取消、通常右クリック再送、左/中と対応解放、キーrepeat/解放/通常キー、細粒度ホイール/逆転/間隔/滞留破棄、設定変更、除外、browser/exe条件、別HWND拒否、前面変更と取消通知を確認。入力表示をフック登録前に初期化、初回設定同期の完了をstartupReady前に待つ。
- 最終単一EXEの実ジェスチャーGUI8群成功: artifacts/gestures-ui-1791535182689/result.json（portable:true）。グローバル/本体の順次実行と重複抑制、pages/owner/指定Applet、独立Appletウィンドウ、埋込み/独立WebApplet、キー/Ctrl付きキー、共有draft・保存・複製・順番・ブラウザ一覧を確認。dark/light画像を保存し目視確認。実EXEのSHA256/試験コピー一致。
- 既存GUI: keybindings-1791535140820は10群、applet-pages-1791535150999は6群成功。Windowsの実グローバルキー、Gmail UI/本文とページ切替/入力保持も確認。artifacts/bundle-verify-509e8e39-c6bf-4eb0-81c5-c795775f710aは全ZIP収録hash/size・単一EXE一致・全6Appletの版/初期無効/エラーなしでok:true。
- WebBrowserTools回帰14/14、専用native WindowのWM_APPCOMMAND/SendInput/最前面変更取消と20回の連続キー送信成功。発行済みAppletのhost-1791535311624で旧7割り当て/操作感移行、旧UI除去、本体設定の編集、11コマンド、キー即時反映/再起動後保持、無効化、エラーなしを確認。
- 途中のGUIでは初回入力未到達や前面取得失敗が発生。ユーザーからRDPの接続/切断中と確認。診断付き試験では操作全群が通ったものの診断をerrorログとして出したため末尾のno-error検査で失敗。診断コードを除去。portable試験は対象を明示的に表示/前面化し、最終配布物で終了0。RDPだけを原因と断定しない。試験は直列、隔離profile、カーソル復元で実施。
- 未確認: 人手の物理操作、実Chrome/Edge/Firefoxの履歴・タブ受理、管理者権限差、複数DPIモニター、RDP切替をまたぐ連続操作、他ジェスチャーソフトとの併用。OSへ送信済みの操作や、取消非対応の任意Applet内の副作用は取り消せない。
- 最終EXE: 142505370 bytes、SHA256 3edc9a6fe1e17547be70676f0d4bc3c2804617e13cfda3fec9691d4665aaa4f2。publish/update.jsonと一致。新しい入力用WPFランタイムが本体内に加わるため、以前の約100MBから増加。

## 2026-10-09: v0.26.1 ジェスチャー編集と共通パレット

- ユーザーの試用結果を反映し、同一gesture単位のグループ表示、グループ内だけのドラッグ/ハンドル上下キー並べ替え、共通Toggleのスイッチを実装。保存形式は既存bindingsのまま。別グループの相対順/設定値を保持し、キー違いも個別グループ。複製/削除は右端のメニューへ分離し、削除は確認後だけ下書きに適用する。
- CommandPaletteを実行/選択/ピン留めで共用。検索・提供元/完全ID・矢印/Enter・IMEガード・Escape/フォーカス復帰・Tab移動を共通化。選択モードでは実行せず、停止中のコマンドも選択可能。選択内のピン変更は共有draft、実行用は従来の即時保存。Icon/Toggleをmainから共通部品へ移動。キー記録欄が別グループへ移動して消える時の記録停止も保証。
- typecheck成功、dev.bat testは142/142成功（artifacts/gestures-ui2-typecheck-final.log、gestures-ui2-regression.log）。追加回帰はグループ内の実行順、異なるジェスチャー間の移動拒否、別行の位置と元配列の保持を確認。Prettierとdiff checkも成功。
- ソースGUI: artifacts/gestures-ui-1791540085907/result.json。最終単一EXE GUI: artifacts/gestures-ui-1791540351063/result.json（portable:true、下記SHAと一致）。ドラッグ、上下キー、複製、削除取消/確認、スイッチ、保存前のdraft保持、検索/矢印/IME、選択で実行しないこと、フォーカス復帰、ピン共有、キー変更後のCtrl+P復帰、実行モード、ブラウザ設定を確認。dark/lightとpalette-select画像を保存し目視確認。
- 今回の実OS入力を含む試験は最初のジェスチャー未到達（source）、前面HWND取得失敗（portable）で停止。入力フック自体は今回変更していない。APPDOCK_GESTURE_UI_ONLY=1で今回の編集/パレットを分離して成功したものであり、0.26.1の実マウスジェスチャー全群の再成功とは扱わない。RDP接続/切断の既知の状況はあるが原因を断定しない。前版0.26.0の実入力17項目/単一EXE8群成功は前節の証跡。
- 既存配布版GUI: preferences-1791540312996の7群成功（ピン留め/順番/絞込み/解除、設定、キー、再起動保持）、applet-pages-1791540315870の6群成功（Gmail/ローカル/独立ページとパレット重ね表示等）。WBTのhost-1791540326790も旧設定移行/本体スイッチ/送信キー/再起動保持で成功。WBTの試験を新スイッチと安定ID参照へ追従し、Applet製品版0.3.0は据置。
- publish.bat終了0。AppDock 0.26.1、単一EXE 142504831 bytes、SHA256 152073654baf11fbadc44a3b68c02b459653a1a20c1a2077b0e8f3f5fedbd2b4、update.json/GUI検証コピー一致。全6Applet入りZIPの全ファイルsize/hashと通常起動も成功（bundle-verify-d600028e-662d-4c37-adc3-4113a23829aa）。初回bundle試験はrenderer未準備時に接続済みbrowserを閉じてしまい接続不能になったため、接続を保ってrendererを待つ試験処理へ修正して同じ配布物で再確認。
- 途中のドラッグ試験は移動先への自動スクロールで開始位置が変わったため、同じグループが見える位置へスクロールしてから実施。キー変更試験は移動後の配列先頭ではなく安定IDを照合。最終GUIは終了0。sandboxのtypecheckはpnpmポリシー確認で停滞したため中断し、通常Windows環境の同じtypecheckで成功。
- mainの既存未コミット変更へ継続実装。ローカルpublishのみで、実利用deploy/commit/push/Release公開は未実施。

## 2026-10-09: 0.26.2 行メニューのドロップダウン化

- ジェスチャー行の「…」をボタンと浮動メニューへ変更。スクロール表の外へ描画し行の高さを維持、画面端で位置を補正。外側クリック/Escape/スクロール/リサイズで閉じ、上下/Home/Endキーで移動。Escapeでボタンへ戻り、削除は確認とキャンセルを維持。
- typecheck終了0、回帰142/142（artifacts/gestures-dropdown-regression.log）。初回整形は依存未配置で失敗し、既存dev.batのローカル依存復元後に同じPrettierを再実行して成功。新たな依存追加なし。
- ソースGUI（gestures-ui-1791541764462）と固定単一EXE（gestures-ui-1791541935557）で、メニュー表示中の行高不変/画面内配置、上下キー、Escape/フォーカス復帰、再クリック/外側クリック、複製/削除確認/キャンセル、既存グループ並べ替え/スイッチ/共通パレット/保存を確認。スクリーンショットgestures-dropdown.pngも目視確認。今回はUI変更のためAPPDOCK_GESTURE_UI_ONLY=1を明示し、OS入力試験は再実施していない。
- publish.bat終了0、0.26.2単一EXE/update.json/6Applet入りZIPを配置。EXE142516690 bytes、SHA256 f3cebdb6b932aa4041e357df0cfe70517bba15c71695853448a74a0ef8102298、feedと実試験コピーが一致。all-in-one-ui-test.cjs終了0、ZIP全収録size/hash/本体一致と隔離通常起動を確認（artifacts/gestures-dropdown-bundle-result.json）。
- ユーザーの追加指示に従い、発行・検証後に今回までの汎用ジェスチャー/UI変更をAppDockとWebBrowserToolsのmainへコミットする。push/Release/実利用deployは依頼範囲外。

## 2026-10-09: 0.26.4 本体・全Appletの同時更新と確認日時

- 更新ページに「本体と全Appletを更新」を追加。installUpdates('all')で本体と全ファイル型Applet（有効/無効を含む）の適用可能な候補を1つのjobへ準備し、1回の確認・再起動で交換する。既存の本体のみ/全Appletのみ/個別更新を維持。WebAppletは本体管理のため個別候補に含めない。
- 本体metadataを先に確認し、同時適用する本体候補の版でAppletのfeed/ローカルmanifest/展開後manifestの最低host版を照合。本体が未設定・取得失敗・再適用不可・旧版なら現行版で判定する。準備途中で本体/ZIPのハッシュが不一致の場合は、確認/終了/交換へ進まない。
- 最終確認日時を各「更新を確認」の隣へ移動。「すべての更新を確認」の隣には直近の対象checkedAtを表示。日時とボタンを同じグループにし、結果本文を間へ挟まない。
- 型検査終了0（artifacts/combined-update-typecheck.log）、回帰164/164（artifacts/combined-update-regression.log）、Prettier checkとgit diff --check成功。追加試験はlocal/feedの同時互換性、新本体が利用不能/同版/旧版/不足の場合、host/ZIP破損時の両対象保持と最終確認取消を検証。
- publish.bat終了0（artifacts/combined-update-publish.log）。AppDock 0.26.4、publish/AppDock.at365.exe 142503045 bytes、SHA256 a1673c06287c0f1ef126ea2fb938bc8424bb1af01c73139c97bcc3ea3b82cb11。publish/update.jsonのversion/size/hashと隔離検証コピーが一致。
- 固定した実単一EXEのGUI11群成功（artifacts/portable-updates-1791544025489/result.json、combined-update-portable-ui.log）。新ボタンを実クリックして本体+稼働中.NET Applet+無効Node Appletの3対象を1jobで交換・再起動。設定/認証fixture/有効状態保持、旧ファイル除去、画面復元、既存本体のみ/全Appletのみ/個別更新・通常再起動を検証。最終native確認だけ試験内で承認へ差し替え、交換・終了待ち・ランチャー・再起動は製品処理を使用。
- dark/light/900pxの画像を保存・目視確認。各本体/Applet/全体確認のボタンと日時の横並びを座標照合し、狭い設定本文に横スクロールがないことを確認。
- 初回sandbox型検査はpnpmの供給網ポリシー確認で停止したため中断。通常Windows権限で同じ既存dev.batを再実行して成功。製品や依存設定を回避目的で変更していない。
- 実GitHub/UNC取得、実利用先の更新、物理native確認操作は今回未検証。通常publishのみで本体EXE/feedを更新し、未変更Applet再発行/全体ZIP作成・整理/commit/push/Release/実利用deployなし。
- ユーザーの動作確認: ユキちゃんが「うまくうごいてる」と確認し、今回の変更のコミットを依頼（2026-10-09）。上記の未コミット状態は検証時点の記録。


## 2026-10-10: タスクトレイ設定と一時停止コマンド（0.26.10）

- 実装: タスクトレイ専用カテゴリ、クリック/ダブルクリックの検索式選択、自由グループ/トップレベル/区切り線、ドラッグ/上下ボタン/キー/配置先変更、グループ解除時の子保持。設定/終了はホストが末尾固定。ショートカットのトレイチェックを撤去。appdock.gestures.togglePauseを共通の検索/キー/トレイ/クリック経路へ登録しチェック状態を同期。共有draft/JSON/revision/saveを維持。
- 保存: trayMenuを正本とし旧trayCommandsは派生値。旧設定だけdiscover後に変換して原子的に保存、未知IDと明示空配列を保持。旧上限500コマンド＋500グループ＋一時停止も移行可能（新形式全項目上限1500）。
- 最終型検査・ビルド・Prettier・git diff --check成功。回帰171/171成功（artifacts/tray-menu-regression.log）。更新文書のローカルリンク100件に欠落なし。
- ソースGUI: tray-menu-ui-1791558765880で移行/不正名拒否/固定項目追加拒否/混在グループ/改名/区切り/移動/並べ替え/ドラッグ/共有draft/保存/破棄/停止コマンド保持/空配列/再起動を確認。実Tray構造とcallback、単/ダブルクリックの別実行、一時停止のIPC/メニュー/キー実行とチェック、利用不可クリック時のWindow復帰も成功。両テーマ、1280/1000/900幅のはみ出し/左揃えと画像を確認。
- 既存GUI: navigation-1791558771295の17群、shortcuts-ui-1791558780461の7群（実Windows登録競合/解放/再試行を含む）、host-commands-1791558786125のrestart/quit/プロセス終了、gestures-ui-1791558788649の編集4群成功。ジェスチャーは明示UI-only、入力フックの実操作は今回再検証していない。
- 初回sandbox回帰はTemp内renameのEPERM等で失敗。プロジェクト内TEMP/通常権限で再実行し最終成功。sandboxのpnpm supply-chain検証待ちは中断し、ローカルNodeと通常権限のdev.batで検証を完了。GUI試験の未保存マーク付きカテゴリの検索、停止snapshotから画面反映までの待機、追加コマンド分の旧件数期待値を修正。共通buttonスタイルによる中央寄せを修正し最終GUIへ反映。
- publish.bat終了0。publish/AppDock.at365.exeは142527598 bytes、SHA256 020357ea0447823e66e53f411ac9d0d71199dec3c2c328d88210944d34bdb1ea。update.jsonの版0.26.10/size/hashと一致（artifacts/tray-menu-publish-result.json）。単一EXEのコピーによるtray-menu-ui-1791558966808はok:true、コピーhash一致。移行/全編集/保存/破棄/両テーマ3幅/停止時保持/空構成/再起動を確認。portableはCDP経由のrenderer検証、実Trayイベント検査はソース版で実施。
- 既存AppDock.at365-all-in-one-0.26.2.zipはhash/size/mtimeMs不変（artifacts/tray-menu-bundles-before.json）。未変更Applet再発行、全体ZIP生成/整理、実利用deploy、commit/push/GitHub Releaseは実施していない。

## 2026-10-10 AppDock 0.26.11 保存導線とWebApplet管理

- 設定/Applet詳細のページ見出し下に共通SettingsToolbarを配置し、タブ内・並べ替え欄の保存を集約。全共有draftを保存する。Webアカウント操作は専用ファイルで即時反映を維持。
- 未保存で他ページへ移ると本体Window上部へnative WebContentsView通知を表示。背景レイアウトを変えず、保存・キャンセル既定dialog付き破棄・入力不備/競合から編集元へ戻る。保存失敗は浮動通知に表示して本文を押し下げない。専用preload/送信元mainFrame/URL照合と二重操作ガードを実装。
- WebAppletの追加/管理をApplet一覧の組み込み管理項目へ移動。設定タブ=サイト、ショートカットタブ=将来のサイト用初期値。個別サイトID/リボン/設定/sessionは維持し、管理項目はruntime snapshot/更新/並べ替えへ混ぜない。設定カテゴリを指定の9項目順へ変更。別Appletへ切り替えても4タブの選択を保持。
- 型検査、build、変更ファイルのPrettier、git diff --check成功。全本体回帰171/171成功（artifacts/settings-notice-unit.log）。初回sandboxではTEMP内のrenameがEPERM、Electronの起動も拒否された。project内の隔離TEMPと通常Windows実行で成功し、製品不具合として扱わない。
- 既存GUI: navigation 17群、applet-order 4群、web-applets 12群、applet-pages 7群成功。新仕様で変更した試験はタブ保持/保存入口/カテゴリ導線/role=statusの表示先を更新。navigationの旧「選択で説明へ戻る」期待値とWeb管理移動後のstatus locatorを修正した。GUIは直列・隔離profile、製品ソース/固定EXEのビルドを重ねていない。
- source最終専用GUI9群: artifacts/settings-notice-1791562372910/result.json。共通保存の同位置、4タブ保持、Web追加/初期キーのコピー、ホーム/Web上の保存、入力保持、無効JSONとrevision競合の拒否/下書き保持/本文位置不変、通知に一般host/Nodeブリッジがないこと、破棄dialog応答のキャンセル/確定、両テーマ/サイズ/--restore-view起動を確認。
- Gmailは既存Appletのオフラインfixtureで入れ子のWebContentsView上に通知が最前面となり、検索/選択account/メールWebContentsを保ったままhost draftを保存できた（artifacts/applet-pages-1791562206131/result.json）。実サイト認証/実メール到着・物理dialogのクリックは今回の範囲外。親Windowのcaptureだけでは子Viewが写らないため通知/remoteを個別確認、native View順も確認。
- publish.bat最終終了0。EXE=142,517,882 bytes、SHA256=4e68d7b1e55c7d5ce0d049a52247e3b8d80e175bd8c27f66af6d4bef7a024a82。publish/update.jsonのkind/id/version/payload/size/hashを照合。途中の表示調整も同じ版へ再発行し、同じ変更で重ねて版更新していない。
- 固定配布EXEの隔離コピーhash一致。専用GUI8群（artifacts/settings-notice-1791562376022/result.json）、WebApplet portable3群（artifacts/web-portable-1791562393375/result.json）、Applet順序portable4群（artifacts/applet-order-1791562418737/result.json）が終了0。保存/競合/復元起動、Web page/window入力/session、Gmail保存領域の保持、両テーマ/幅、並び順保持を確認。配布EXEの破棄dialogはGUI応答fixtureを使えるsource側で検証したものと区別する。
- 通常publishは本体だけ。旧AppDock.at365-all-in-one-0.26.2.zipのsize=317655348、SHA256=4819317bf7f49aa852515bb85543058f93a290adc0742f8491882fbbe17cbda6とmtimeを保持。未変更Appletの再発行・commit/push/公開/実利用deployは未実施。他チャットで追加されたartifacts整理文書を保持。
- 作業完了時の整理: 今回作成し終了/成功が確認できたsource通知試験だけ、直近3回を保持。旧settings-notice-1791561449412、settings-notice-1791561783732の2件を削除。対象の絶対パス/通常ディレクトリ/全配下非再解析ポイント/該当process不在を確認。1857230/2047485/2372910をsourceとして、2376022のportableと失敗/不明/他チャット/固定ビルド/Release証拠を保持（artifacts/settings-notice-cleanup.json）。artifacts改名・除外設定は変更なし。

## 2026-10-10 0.26.11のコミット・正式リリース依頼

- 上記の保存導線/WebApplet管理変更をユキちゃんの確認後、mainへコミットして正式Releaseへ公開する依頼を受領。既存のartifacts整理文書も保持してコミット対象へ含める。本体版は0.26.11を継続し、未変更Appletの版は増やさない。
- 正式Prepareは本体回帰/発行と6Appletの再発行・オールインワン検証・更新UI/復旧検証を行う。準備/アセットhash/公開後の匿名取得と更新チェック・保持3件の整理の実結果は、artifacts/release-0.26.11-settings-20261010-01/plan.jsonおよび隣接チェックログを正本とする。未完の結果を成功として扱わない。実利用先へのdeployは含めない。

## 2026-10-10 本体と同梱AppletのまとめたRelease

- ユーザーの追加指定により、リリースは未公開の本体（3asset）と全体ZIP内の未公開版Applet（各repoのupdate.zip/update.json）をまとめて判定・公開し、公開後検証に成功した今回の全repoを最新3件へ整理する手順へ更新。30.PROJECT/AGENTS.md、本体AGENTS/DEVELOPMENT/docs/RELEASING.mdへ反映。公開済み同版はskip、同梱だけの版更新や同版asset上書きはしない。release.ps1は本体用のままで、作業者がApplet個別公開まで行うことを明記した。
- 既存の本体0.26.11 planはverifiedで、通常EXE/feed/フルパッケージは公開済み。この本体と6Appletの製品ソース・版・配布物は再ビルド/変更せず、検証済みbundleと各Appletの元ZIP全ファイルをsize/SHA256で再照合した。6件すべて一致（artifacts/release-bundled-applets-20261010/bundle-match.json）。初回のWindows PowerShell 5.1ではUTF-8 JSONを既定文字コードで誤読して停止、-Encoding UTF8を明示して再実行後に成功。製品ファイルの文字コードは変更なし。
- 全6repoのremote main・タグ・公開版を確認し、未公開のGmail0.9.1（b3bc366）、Watch0.1.2（d21d6b4）、WebBrowserTools0.3.1（f7bdbd8）を自身のrepoで下書き/2asset照合/正式公開。既存のclean mainとbundle commitが一致し、追加commit/push不要。WallpaperSlideshow0.4.0、WindowMover0.2.1、WindowsTools0.1.1は同梱版の公開タグ/commit/feed ID・版を確認してskipした。
- 公開3repoの全6assetを匿名で取得しsize/SHA256を検証、各tag/remote main/latest/ノート/digest一致。実PortableUpdates.check()の一括結果は3件すべてavailable、同梱version、installable:true（host0.26.11、実インストールなし）。成功をrepo別に保存後、共通release-retention.cjsで各repoは2件保持/削除0・complete。既に整理済み本体は3件、skipした3repoは各1件。全7repoの最終latest/保持件数を読み取りで確認し、公開済み本体/skip repoは変更なし。
- 公開URL: [Gmail0.9.1](https://github.com/5ynonym/Applet.Gmail.at365/releases/tag/v0.9.1)、[Watch0.1.2](https://github.com/5ynonym/Applet.Watch.at365/releases/tag/v0.1.2)、[WebBrowserTools0.3.1](https://github.com/5ynonym/Applet.WebBrowserTools.at365/releases/tag/v0.3.1)。ノートと封印した配布物、draft/public/verified状態、個別更新結果、整理レポートはartifacts/release-bundled-applets-20261010/plan.jsonと各*-verified.json/*-retention-*.json、全7repo一覧はfinal-roster.json。plan.phaseはcomplete。
- 手順文書の相対リンク69件と追加見出しリンク3件、git diff --check成功。今回は製品ソース変更なしで、新しいruntimeテスト/本体版更新/本体再発行/実利用deployは不要。既存の正式Prepareと各Applet版の検証を使用した。Release記録と失敗/不明/他作業のartifactは保持し、今回の手順作業でテストフォルダー削除は行っていない。

## 2026-10-10 設定のPC間同期・保存領域の設計相談（未実装）

- 現ソースのSettingsStoreは親フォルダーをfs.watchで監視し、250ms後にJSON/スキーマ検証してchangedを発行する。index.tsはテーマ/ページ/トレイ/WebApplet/キー/Applet設定へ反映し、useSettingsEditorはdirtyな下書きを保持する。revisionは各プロセス内の値であり、未到着の別PC更新の競合を解決する仕組みではない。
- 隔離コンパイルした現SettingsStoreで6項目を確認（終了0）: 外部の直接編集、壊れたJSON中の直近正常値保持/元ファイル保持、壊れた編集後のrename置換、監視通知前の古い下書き保存拒否、壊れたJSONでの新Store起動失敗、永続backupなし。証跡は`.artifacts/settings-sync-review-20261010/result.json`。TypeScript CLIでsettings.tsを独立出力へnoCheckで変換した動作確認であり、全体型検査/実Electron GUI/実2台同期を行った結果ではない。既存out/publish/実利用設定は未変更。
- 調査手順の修正: TypeScript 7はtranspileModule APIを提供しないため最初のrequireがMODULE_NOT_FOUNDで停止。個別ファイル指定CLIのTS5112は--ignoreConfigで解消。最終隔離コンパイルと動作確認は成功、製品変更不要。
- `.appdock`はChromium、WebApplet/Gmailの永続session、暗号化secrets、Applet storage、Window状態、ログ、更新journalなどを含む。丸ごとの稼働中PC間同期は避ける。WebAppletはsettings.json内のaccountIdと別accounts.jsonを対応させるため、settings.jsonだけの同期では相手PCに同じ枠がなくなる場合がある。accounts.jsonのpendingDeletionはPC内の物理回収記録で、共有する枠名/IDと分離が必要。Gmailのselected/音声絶対パス等もそのまま共有しない。
- アリスの提案（未承認/未実装）: EXE隣のsettings.jsonを共有し、同期利用時のPC専用データ/override/正常設定backupをLOCALAPPDATAへ保存。配置ごとに分離し従来portable保存も維持。Webの枠名/IDは共有名簿へ抽出できるが、Cookie/token/session/secretsはPC専用。ファイル到着順が異なる名簿/設定は参照待ちにし、外部削除を認証データの即時物理削除へ直結させない。
- 監視に書込み安定待ち/有限再試行/定期照合/復帰時照合/同値抑制を追加し、受信設定を書き戻さない。正常値だけのPC内世代backupと起動時fallback/明示復元を追加する。未保存draftの競合を通知し、PC固有起動登録/画面/絶対パス等は共有希望値と実際のPC状態を分離する。単一JSONのファイル同期だけでは2台の未同期同時編集を完全に自動mergeする保証はない。
- 参照: Electron safeStorage公式 https://www.electronjs.org/docs/latest/api/safe-storage 、DPAPI公式 https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata （通常は同じユーザー/PCで復号）、Node fs.watch公式 https://nodejs.org/api/fs.html#fswatchfilename-options-listener （通知方式の環境依存）。
- 実装する場合の確認項目: 2個の隔離profileの双方向編集/rename・削除再作成・途中JSON・ロック・復帰、dirty draftと受信競合、backup/壊れた状態からの再起動、別PC相当の名簿到着順/未ログイン枠、同PC旧保存先からの停止中移行とrollback、Gmail/WebApplet分離/削除、実単一EXEでの反映/再起動専用項目。今回製品ソース/版/発行/同期サービス設定の変更なし。

## 2026-10-10 スタートアップ登録・管理者起動（0.26.13）

- 一般設定へスタートアップ/常に管理者/現在の実権限・登録状態/状態確認/管理者再起動を追加。共有draft/JSON/revision/saveを使用し、既定OFF。元portable EXE・配置先・SIDの専用タスク、InteractiveToken/LogonTrigger/3秒遅延/電池制限なし/実行時間制限なし/IgnoreNew/対象ユーザー限定DACLを使用する。保存競合/失敗は元XMLへ戻し、管理者再起動は同一ユーザーのヘルパー確認後に元PID終了を待つ。仕様はdocs/launch-settings.md。
- 最終型検査成功、全回帰181/181（launch追加10件含む）。生成した通常/管理者/再起動スクリプトを実Windows PowerShellのParserで構文確認。UACキャンセル・同時保存・競合・別ユーザー応答・標準ユーザー拒否を回帰で確認。最初のsandbox回帰は一時フォルダー/Windows APIのアクセス制約で失敗し、通常Windows環境で再実行成功。旧設定期待値の新しい既定2項目も更新した。
- SetVersionで0.26.13へ更新、publish.bat最終終了0。単一EXE142,516,995bytes/SHA256 61a05c72bf5969111669f797b6eb3ab89e1a22e8d6211283237276970e2e20f4。feed/隔離コピー一致。梱包asarのwindows-launch.jsが最終outと完全一致し、pipe確認を含むことも照合。文書相対リンク107件成功。証跡.artifacts/launch-publish-final.log、launch-regression-final.log、launch-final-check.json。
- 固定単一EXEの専用GUI6群成功（.artifacts/launch-settings-1791608067689/result.json）。日本語/空白/引用符を含むEXEパスで共有draftの副作用なし→保存→実タスク登録→Task Scheduler.Runで実EXE起動/既存instanceへの復帰/終了結果0→保存・再起動保持→登録解除を確認。通常ユーザーの管理者設定拒否でsaved値/タスク/draftを保持。持ち込んだ管理者希望値は通常起動を継続し、起動ループを作らず結果表示/希望OFF/状態再確認が成功。dark/lightの実反映を待ち、1280/900/700pxの表示・操作・非はみ出しを画像でも確認。全検証タスクを解除済み。
- 既存の共通保存・未保存通知GUI8群も同じ発行EXEで成功（.artifacts/settings-notice-1791607825044/result.json）。タブ/共有draft、Web表示上の通知、JSONエラー/競合、テーマ/幅、保存・再起動を確認。実Windowsの保存失敗注入では以前のタスクXMLが完全一致で復元され、検証タスクを解除（.artifacts/launch-rollback-check/result.json）。
- Windows実機でSIDがユーザー名へ、空のArgumentsがnullへ変換される動きを確認し、同一SIDへの解決/string正規化へ対応。途中のGUI停止は試験側の未保存マーク付きカテゴリのexact照合、既定RunLevelのXML省略、テーマ/状態確認の反映待ちを修正して最終成功。初回発行後にヘルパー確認/長い引数対策を加えたため、同じ版を最終再発行して固定し、その後は製品ソースを変更していない。
- 未確認: 検証Windowsユーザーは管理者グループに所属しないため、UAC承認後の実管理者トークン・Highest登録/解除・管理者上のジェスチャー動作は未実施。実Windowsサインインも未実施。これらを実行済みと扱わず、UAC承認は自動化していない。通常ユーザーへHighestが管理者権限を付与するとは案内しない。
- テスト整理: 今回方式のlaunch-settings成功3回、settings-noticeはsource3/portable3を保持し、古い成功の削除候補0/削除0。試験終了と専用プロセス終了・タスク解除を確認。途中失敗4回/完了証拠なしの以前の記録/単独rollback証拠/固定ビルド/Release/他作業資料は保持。通常publishのみで未変更Applet再発行・全体ZIP生成/整理・commit/push/Release/実利用deployなし。並行する同期設計相談の文書差分を保持。

### 同期設計の追加相談: Gmail専用枠とユーザー登録アセット

- ユーザーはWebAppletの枠を同期し、Applet.Gmail専用枠自体と枠に紐づく設定を同期しない構成を希望。プロフィール画像等のユーザー登録アセットはAppDockフォルダーごと同期したいと明示。現コードはWebAppletのWebProfileStoreとGmail等のWebAccountControllerが別保存領域なので、保存先をホスト側で分けられる構造。Gmail専用accounts.jsonは枠ID/名前/選択/枠別sound/monitoringを保存し、全体のunreadOnly等はextension settingsにある。
- 現profile.tsはavatar.pngをbaseDirectoryへ保存し、settings.jsonでは固定相対名を参照する。index.tsのsnapshotは画像mtimeをURLへ付加するが、独立した画像変更を通知する監視はない。素材だけの同期変更にも再表示通知と参照キャッシュ更新が必要。画像より先に設定が届いても入力や参照を削除しない設計にする。
- 現sound-assets.tsのimportSoundは指定root内soundsへコピーし絶対パスを返す。pruneSoundsはそのrootのローカル参照外音声を削除するので、そのまま共有素材rootに向けない。登録素材は共有root内の相対パス/安定IDで参照し、Gmailの枠ごとの割当はPC専用のまま保持。共有素材の物理削除は明示操作等の別方針が必要。
- 提案の保存分離: AppDock配置内settings.json/avatar.png/.appdock内共有枠名簿・ユーザー登録assets、LOCALAPPDATA内Gmail枠/全Webのsession/秘密情報/PC状態/キャッシュ/更新journal/backup。生成キャッシュとユーザー登録素材は区別する。現PCの旧認証/枠は停止中移行で保持し、別PCへ枠を転送しない。今回コード・版・発行・実利用データへ変更なし、ソース読取確認のみ。

## 2026-10-10 パスキー認証の実現性調査（製品実装なし）

- ユーザー報告: WebAppletの https://auth.openai.com でWindows Helloパスキー認証に一度失敗したが、製品コードを変更せずパスキーボタンを再度押すと指紋認証が表示され、ログインに成功した。追加確認では新しいアカウント枠でも成功。初回はパスキーボタン押下後、指紋画面が表示されないまま失敗画面へ遷移した。指紋照合中の失敗とは区別し、サイトの認証要求準備からWebAuthn/Windowsの画面表示までを切り分け対象とする。実WebAuthn呼出しやOSへの到達はログ未取得で不明。現在の環境・同サイトで使用可能なことをユーザーが確認。原因は未特定。Gmailの実Google認証は未検証。
- 現ソース/ローカルruntimeはElectron 44.6.0。WebAppletはWebAppletManager/AppletSurface、GmailはWebAccountControllerで、いずれもホストのWebContentsViewと専用sessionを使用。通常のPermissionRequest/Checkは全拒否。select-webauthn-accountの処理は製品ソースに存在しない。WebAppletは許可origin外の認証遷移を止め、新規Window要求を現在のViewへ読み替えるので、別サイトへの対応では遷移・popup依存も切り分ける。
- 隔離試験: .artifacts/passkey-investigation-20261010/probe.cjs / result.json。ローカルHTTP localhost、専用userData/メモリsession、非表示WebContentsView、Node無効/sandbox/contextIsolation有効。通常の権限を全拒否したままCDP仮想CTAP2 resident credentialを作成し、作成成功→選択listenerなしのgetはNotAllowedError→fixture用選択listenerありでget成功。通常のPermissionRequest/Check呼出しは0、select-webauthn-accountは1回。試験用だけでfocus emulationを有効化。実サイトへの通信、実パスキー作成/取得/列挙、実アカウントへの認証は行っていない。
- 仮想authenticatorを追加する前の能力判定はsecure/api/platform/conditionalすべてtrue。ただし能力判定や仮想authenticator成功は、実Windows Helloや入力欄の自動候補UIの成功を意味しない。sandbox内起動は0x80000003で終了し結果未生成。通常Windows環境で同一probeを実行しexit 0、結果を読戻し確認。
- 結論: Windows Helloパスキーは現構成で利用可能（上記OpenAIサイトはユーザー実証）。一律権限拒否をパスキー失敗の原因と断定できず、全権限を許可する修正は不要。選択eventが必要な認証経路にはホスト共通の選択UI/取消処理を追加する余地があるが、今回の初回失敗の原因とは未確認。Windows標準UI側で選択済みの応答はChromiumが選択eventを経由せず成功させる場合がある。Chrome/Google Password Manager保存とWindows Hello保存は区別する。
- 初回失敗の候補（推測）: 認証challenge/セッションの期限・取消、ページ遷移やフォーカスのタイミング、Windows/WebAuthnの一時的な状態。再発時は時刻、画面のエラー文、指紋画面が出る前/後、再押下/再読込での変化を記録し、秘密値・認証URLのquery・credential IDをログへ出さない。Windows 11 24H2以降は設定「プライバシーとセキュリティ > パスキーへのアクセス」のアプリ許可も確認対象。ただし今回の成功後に許可拒否を原因と断定しない。
- 参照: [Electron session/選択event](https://www.electronjs.org/docs/latest/api/session#event-select-webauthn-account)、[Windowsパスキーとアプリ許可](https://learn.microsoft.com/en-us/windows/security/identity-protection/passkeys/)、[Googleの保存環境](https://developers.google.com/identity/passkeys/supported-environments)、[Chromiumの選択済み応答分岐](https://raw.githubusercontent.com/chromium/chromium/main/content/browser/webauth/authenticator_common_impl.cc)。オンラインmainのソースは設計理解の補助で、同梱版の根拠はローカルelectron.d.tsと44.6.0実行結果。OpenAI公式ログインURLを確認したが、初回失敗を特定する公開資料は得られていない。
- 製品ソース・版・publish・実利用ログイン情報は変更なし。既存の同期対応差分を保持。調査記録とAGENTSだけ追記し、commit/push/Release/deployなし。
## 2026-10-10: 0.26.16 共有フォルダーをdataへ変更

- 共有名簿・登録音声・アバター原素材の保存先をEXE隣の小文字dataへ変更。settings.jsonの配置、LOCALAPPDATA/at365/AppDock/profiles/配置IDのPC専用rootは維持。旧.appdockの自動移行・削除なし。古い画像参照は読み取り互換のみ残す。旧領域のPC専用データ検出を維持し、固定EXE試験で旧ファイルの不変も確認。
- 最終型検査と190/190回帰成功（.artifacts/data-folder-typecheck.log、data-folder-regression.log）。source同期GUI11項目、プロフィールGUI7項目、Gmail総合GUIが成功。固定0.26.16 EXEの通常起動2配置GUI11項目も成功（settings-sync-ui-1791615128338/result.json）。LOCALAPPDATAをfixture内へ向け、実利用データを変更しない。Gmail音声一覧の両テーマ画像を保存、lightを目視確認。実2台・実同期サービス・Google認証は未確認。
- 固定EXE smoke成功（smoke-1791615191737/smoke-result.json）、data/assets/profile/avatar.pngの保存と実表示を確認。publish.bat終了0。最終EXE142527588bytes、SHA256 456014e1295b6d3f8d66cafbcb359f60933195454b0399e534999c204485ac1e。feed/梱包59ファイル/updater一致、文書ローカルリンク182件確認（.artifacts/data-folder-final-check.json）。既存オールインワンZIPと未変更Gmail0.9.2配布ZIPは不変。
- 完了時整理: source同期成功3回、portable-production-path成功2回、旧portable成功1回を保持。旧smoke/プロフィール/Gmailの実行方式不明、失敗・再利用・認証資料を保持し、今回削除0。Wallpaperのprotocol一時画像はランナー終了時に削除済み。固定ビルド/Release出力を整理対象にしない。
- ユーザーの追加指定により今回対応したAppDock/Gmail/WallpaperSlideshowを各repoでコミットする。各モジュール自身のpublishへ発行済み。外部公開・push・実利用deploy・同期設定変更なし。
## 2026-10-10: 0.26.17 空のWebアカウント枠からの復旧と操作エラーログ

- 旧settings.jsonのWebApplet参照が残り共有accounts.jsonが未到着の場合、同期待ちガードが0件からの追加も拒否していた。WebProfileStore.addで0枠からの明示追加だけを許可し、起動時の空名簿自動生成・旧参照の自動置換は行わない。直前に届いた未反映名簿・破損名簿・既存枠がある一時欠落は上書きを拒否し、既存Cookie等を削除しない。
- ホスト画面のdock:* callbackの同期throw/非同期rejectを共通handleでerrorログへ記録し、元のエラーも返す。操作名とエラーメッセージだけを追加し、IPC引数は記録しない。既存の送信元/Frame/URLガードを維持。
- 型検査と191/191回帰成功（.artifacts/web-account-recovery-typecheck.log、web-account-recovery-regression.log）。一時欠落保護の追加assert後、設定同期6/6の対象回帰も成功。直接sandbox実行はTEMPのatomic renameでEPERMとなり、許可された通常Windows実行で成功。失敗ログをweb-account-recovery-sync-regression-sandbox-failed.logへ保持。
- 新scripts/web-account-recovery-ui-test.cjsはsourceと固定EXEの両方で5項目成功。旧登録の保持、画面での0枠からの追加/再割当/保存、同期・非同期エラーのログページとPC専用host.logへの記録、再起動、既存の空名簿からの再追加、旧ログインmarkerの保持を確認。sourceはweb-account-recovery-1791617699286、通常起動EXEはweb-account-recovery-1791617848978。各errors-in-log-page.pngを保存しsource画像を目視確認。初回fixtureは起動時の既定値初期化を考慮しないraw settings不変assertで失敗し、旧items保持の検証へ修正。失敗フォルダーを保持。
- 固定EXEの従来2配置同期GUI11項目も成功（settings-sync-ui-1791617905884/result.json）。ログ記録によるdirty保存拒否・正常backup/破損起動・共有枠/素材・Gmail個別枠等の挙動を維持。実2PC/同期サービス/実ログインは未確認、LOCALAPPDATAをfixture内へ隔離。
- publish.bat終了0。最終EXE0.26.17は142527632bytes、SHA256 ee7ad7302691926e801b686eb190ff7f8e901fba3a7776c3cdb2f8d05a2cf1c8。feed/梱包59ファイル/updater一致、182ローカルリンク確認（web-account-recovery-final-check.json）。旧全体ZIP不変、未変更Appletの再発行なし。
- 完了時整理: recovery成功はsource/portable各1回、従来2配置portable-production-path成功3回を保持。失敗/方式不明/認証・再利用資料/固定ビルド/Release記録を保持し削除0。前の継続依頼の範囲で本修正をAppDockへコミットする。push/Release/実利用deploy/同期設定変更なし。

## 2026-10-10 ショートカット画面の再設計（0.26.19）

- 設定ページをキー別グループへ変更。同キー内の保存順を表示番号・上下操作・ドラッグに揃え、他キーの保存位置を保持。未割り当てのコマンド行を撤去し、未知/無効/停止中の保存済み割り当てを保持。検索/登録エラーはグループ全行表示。
- 上部はキー/特殊キー/条件の入力後にコマンドを選択し、同キー末尾へ追加。グループ追加はコマンドの既定条件を使用。追加後は入力・絞り込み・表示位置を保持し、元ボタンへpreventScrollでfocusを戻す。4項目メニュー、条件プレビュー付きコマンド変更、確認付き削除を実装。
- Applet詳細は独立した表示専用一覧。宣言/動的カタログ順、キーと条件の組、未割り当て/無効/利用不可、互換別名の割り当てを表示。共有draftへ追従し、一括初期化を含む編集操作を撤去。組み込みWebApplet管理のテンプレートは維持。
- 型検査/build/変更コードのPrettier/差分検査成功。関連回帰25/25（keybindings、dynamic-commands、applet-order、gestures）。標準回帰全体は今回の実装段階では未実行。文書ローカルリンク125件の存在を確認。
- ソースGUI成功: shortcuts-ui-1791642534882（7群）、applet-order-1791642624600（4群）、applet-default-shortcuts-1791642627712（3項目）、keybindings-1791642639367（10群）、navigation-1791642774093（17群）、gestures-ui-1791642873291（編集UI4群）、ribbon-layout-1791642875831（3群）。Windowsグローバル実入力/登録競合・再試行、Applet Web/Gmailオフライン本文、共有draft/JSON/競合/破棄、両テーマ/3幅を含む。実メール認証・全IME/キーボード配列は未検証。
- 初回Electronはsandbox内のプロセス起動拒否で停止し、通常権限の隔離profileで成功。旧試験の再起動期待値と停止中の非宣言コマンドの表示先を新仕様に修正して最終成功。通常ジェスチャー試験gestures-ui-1791642840196は入力先HWNDを前面化できず停止。製品の入力処理は変更せず、既存APPDOCK_GESTURE_UI_ONLY=1で今回影響する編集UIを確認。物理ジェスチャー入力は今回未確認として区別する。
- publish.bat終了0。本体単一EXEは142522091 bytes、SHA256 `e11b923b947f86d1ae2dc97a96d3be2242f542f29da179ca3312438302dfc41f`。update.jsonの0.26.19/size/hashと一致。既存all-in-one-0.26.11.zipはsize/hash不変、未変更Applet再発行/新全体ZIP/commit/push/Release/deployなし。
- 固定発行単一EXEの隔離コピーでshortcuts-ui-1791643039848の7群成功。同キーの跨提供元移動、上部/グループから連続追加して表示位置とfocus保持、条件変更プレビュー、キー移動とDelete記録、空グループ消去、Appletの複数ペア/無効/互換別名、両テーマ/1280・900・700px、保存/再起動を確認。EXEコピーのSHA256は発行物と一致。追加フォームとApplet一覧のスクリーンショットを目視確認。
- 発行/型検査/関連回帰/固定EXEのログと成果物照合は`.artifacts/shortcut-redesign-20261010/`、各GUIのresult.jsonは上記profile内。旧試験の失敗/起動不明資料は保持。
- 完了時整理: 方式と成功が確認できるsource/UI-onlyの古いgestures-ui-1791555815134だけ削除（3891583 bytes）。絶対パス/配下reparseなし/現旧パスprocess参照なし/関連processのcommandline取得/全ファイル排他openを確認。直近成功3回を保持。他方式の不明資料・過去配布版/再利用資料・Release/固定ビルドは保持。cleanup-audit.json/cleanup-result.jsonに記録。

## 2026-10-11 Appletショートカットの編集パネル（0.26.20）

- 既存の提供元コマンド順一覧へ＋、キー/条件ペアの編集、編集/確認付き削除メニューを追加。小さなnative dialogでキーキャップ表示、Ctrl/Alt/Shiftと特殊キーの選択、条件、有効状態を編集する。適用は共有draftへ反映、保存は既存toolbar。Applet画面に実行順操作/導線は追加しない。
- 新規はowner/有効、追加とキー変更は同キー末尾。空キー/対象0件の適用を拒否、元行が外部更新されたら上書きしない。取消で変更を残さず、追加後の表示位置と操作元focusを保持。dialog中はglobal登録と画面ショートカットを抑止し、終了時に復帰する。Tabは移動、Escapeは取消、Enter/Delete等は記録欄ではキー入力として扱う。
- 型検査/build/変更コードPrettier/git diff --check、文書ローカルリンク124件成功。関連回帰19/19（keybindings/dynamic-commands/applet-order）成功。標準全回帰は未実行。
- ソースGUI: shortcuts-ui-1791644537426の10群、navigation-1791644544867の17群、applet-default-shortcuts-1791644871267の3項目、applet-order-1791644872131の4群成功。キー記録/特殊キー/対象選択/無効状態/取消/外部更新拒否/共有draft保存/削除確認/連続追加/実行順保持/再起動、両テーマ3幅、既存設定とジェスチャー編集の列境界を確認。
- 初回sandbox Electron起動失敗は通常Windowsの隔離profileで解消。版更新後のsandbox pnpm自動依存確認がstack overflowしリンク生成が中断、通常Windowsでdev.bat install --frozen-lockfileを実行して固定依存を復元。lockfile/依存版を変更せず、型検査/整形/通常publishを再実行し成功。失敗ログも保持。
- publish.bat終了0、単一EXE0.26.20は142534752 bytes、SHA256 b309ca51e3dcf13d5b734c5d062a01e60c776cdf24e87a7bd019921dc5f12fcd。update.jsonと一致。固定EXEコピーのshortcuts-ui-1791644835150の10群成功、コピーhash一致。最終EXEの編集パネルを目視確認。旧all-in-one-0.26.11.zipはsize/hash不変、未変更Applet再発行なし。
- 全IME/キーボード配列、実サイト認証、物理ジェスチャーは今回未検証。製品の保存形式/dispatcher/入力フックは変更しない。commit/push/Release/実利用deployなし。
- 証跡は.artifacts/applet-shortcut-edit-20261010（開始時の日付）に型検査/回帰/publish/GUIログ/成果物照合/文書リンク/整理監査を保存。試験プロセス終了確認済み、既知のソースshortcuts最新3件を保持。旧版/再利用検証・方式不明・失敗・固定ビルド/Release記録を保護し、追加の安全な削除候補はなく削除0。

## 2026-10-11 Applet一覧の左寄せと即時削除（0.26.21）

- 割り当てペアのbuttonに残っていた共通justify-content:centerをflex-startへ上書きし、左右paddingを揃えて未割り当てとキーの左端を統一。
- AppletShortcutOverviewのBindingActionsだけconfirmDelete=falseを指定し、削除を選ぶと対象IDを共有draftから直接除く。保存前は全体破棄で復元できる。設定ページとジェスチャーの確認動作は既定値trueで保持。
- 型検査/build/整形/差分検査成功、文書リンク43件成功。低影響のUI変更のため標準単体全回帰は再実行せず、発行した固定EXEのshortcuts-ui-1791645381775で10群を検証。左端座標の一致、確認dialogなしの削除、保存前の破棄による復元、連続削除・保存再起動、既存の設定ページ確認、両テーマ3幅が成功。Applet一覧のスクリーンショットを目視確認。
- publish.bat終了0。単一EXE0.26.21は142518132 bytes、SHA256 72785c150c80343f124db51595a74d69550ce5e453b8c72e2d90ee673ded5fa6。feedと検証コピー一致、旧全体ZIP hash不変。証跡は.artifacts/applet-shortcut-polish-20261011。
- 完了時整理は試験終了を確認しportable最新3件（1791645381775/1791644835150/1791643039848）を保持。旧版/再利用/方式不明/失敗資料を保護して削除0。未変更Applet再発行/commit/push/Release/deployなし。

## 2026-10-11 設定ショートカットを全コマンド一覧へ統一（0.26.22）

- 設定ページを未割り当ても含むフラットなコマンド一覧へ変更。AppletとShortcutCommandList/編集dialogを共用し、提供元・ID・複数のキー/条件・無効状態を表示。停止中/未確認の保存済みコマンドと割り当て済み互換別名も保持。キー別グループ、上部追加フォーム、実行順操作を撤去した。
- 検索/割り当て状態/件数/解除を一覧の見た目に揃えた。＋から追加、ペアから編集、確認なしの削除を共有draftへ反映し、既存toolbarで保存する。追加後の自動スクロールなし。条件変更は既存順序を維持、追加/キー変更は同キー末尾。フィルターで削除行が消えた場合は一覧へfocusを戻す。登録エラーの表示・再試行と入力中の表示キャッシュを維持。
- 型検査/build/整形/差分検査成功。keybindings/dynamic-commands/applet-orderの関連回帰19/19成功。標準全回帰は今回未実行。従来UIセレクターを更新したhotkeys/preferencesのスクリプトは構文・整形確認のみで、実GUIは今回未実行。文書ローカルリンク126件の存在を確認。
- ソースGUI: shortcuts-ui-1791646130507の7群、navigation-1791645939592の17群、applet-order-1791645882978の4群、keybindings-1791645886142の10群、ribbon-layout-1791645896744の3群が成功。全コマンド/未割り当て/検索/複数ペア/既定条件/追加・変更・即時削除/共有draft・破棄/実行順の保持/保存再起動、Windows実入力と登録競合・再試行、Applet Web/Gmailオフライン本文を確認。実サービス認証、全IME/キーボード配列、物理ジェスチャーは今回未検証。
- publish.bat終了0。固定単一EXE 0.26.22は142531222 bytes、SHA256 `ba07c8fdd84549614e2538f2ad50e567c15d035f2ea75ae2c079a2d22ca63817`。update.jsonの版/size/hashと一致。固定EXEの隔離コピーshortcuts-ui-1791646515381の7群成功、コピーhash一致。設定一覧とApplet編集を両テーマ/1280・900・700pxで確認し、最終EXEのdark900/light700画像を目視確認。既存all-in-one-0.26.11.zipはsize/hash不変。
- 初回固定EXE試験shortcuts-ui-1791646427423は、競合用の別hostを閉じた後に対象Windowが非アクティブのままCDPで編集を開き、一時停止assertが失敗。hostは非アクティブ時のキー記録を意図的に拒否する。試験で既存appdock.openから対象を前面へ戻すよう修正し、同一hashのEXEで再実行成功。製品のfocus/入力ガードを変更せず、失敗記録も保持。ソース試験の曖昧な検索語と旧UIラベルのassertも新仕様へ修正して成功。
- 証跡: `.artifacts/shortcut-command-list-20261011/`に型検査/回帰/GUI/publishログ、成果物照合、文書リンク、整理監査を保存。完了時整理では成功済み中間sourceのshortcuts-ui-1791644461438だけ削除（12244169 bytes）。絶対パス/配下reparseなし/process参照なし/全ファイル排他openを確認。source/portable各直近成功3件を保持し、旧版再利用・方式不明・失敗・固定ビルド・Release記録は保護。未変更Applet再発行/commit/push/Release/実利用deployなし。
## 2026-10-11 ショートカット再設計のコミット前検証（0.26.22）

- 対象は0.26.19〜0.26.22の設定/Appletショートカット再設計と関連仕様・試験（33ファイル）。本体/SDK/保存領域/依存版への追加変更なし。型検査、標準dev.bat testの194/194、変更コードのPrettier、差分検査が最終ステージ済みtree `5cafdb13f22e250f8dd27c47e72aca06b49bc76b`で成功。検証後の追加差分は本記録のみ。
- GUIは直列・隔離profileでpreferences7群、hotkeys9群、navigation17群、applet-order4群、applet-default-shortcuts3項目、keybindings10群、ribbon-layout3群、gestures編集4群、固定EXE shortcuts7群を確認。各結果と全ログは`.artifacts/commit-validation-shortcuts-20261011/`。標準回帰の再ビルド前後でGUI対象のout内容は同一。初期値試験の整形修正後は当該GUIも再確認した。
- hotkeysの旧fixtureはApplet状態を先に保存したため初期割り当てが追加されなかった。初回インストールの初期化を適用してから有効状態を設定するよう試験だけ修正。実利用中のPause等と競合するため、既存登録を維持したまま隔離fixtureをF16/F20/Ctrl+Alt+F9へ変更する明示モードを追加。実Windows入力、native Watch実行、登録競合と再試行、記録中停止、条件切替、Applet停止/再開、終了後解放が成功。Pauseそのものの実入力試験は実施せず、初回/競合失敗ログを保持。
- ジェスチャーは共通メニュー/パレットのUI変更範囲をAPPDOCK_GESTURE_UI_ONLY=1で確認。入力フックは変更しておらず、物理ジェスチャーは今回のコミット検証対象外。実サイト認証・全IME/キーボード配列も未検証として区別。
- 確認済みpublishの0.26.22を再梱包せず、固定EXEのshortcuts-ui-1791646977579で編集/保存再起動/両テーマ3幅を再確認。142531222bytes、SHA256 `ba07c8fdd84549614e2538f2ad50e567c15d035f2ea75ae2c079a2d22ca63817`はfeedとコピーに一致。製品ソース/配布物は動作確認後の内容を維持。
- Node24.21.0/pnpm12.10.1、OS/.NET、検証tree、コマンド・終了コード・ログhash、Watch/Gmailの依存commitと使用fixture hashを上記証跡へ記録。現在の検証を将来再利用する際は最終treeと証跡を照合する。試験プロセス終了を確認し、最新3件/今回の再利用証跡/旧版・不明・失敗資料を保持、追加削除0。commitのみ実施し、push/Release/deployなし。
## 2026-10-11 実行順の専用パネル（0.26.23）

- 現在のコマンド一覧を維持し、設定上部の「実行順…」と設定/Appletの割り当てメニュー「このキーの実行順…」からShortcutOrderDialogを開く。キー選択、番号、コマンド/提供元/完全ID/条件/状態、ドラッグ・上下ボタン・つまみのAlt＋上下を実装。元の検索やApplet範囲に依存せず同じキーの全割り当てを表示。空/1件/無効/未確認にも対応し、多数の割り当ては一覧だけをスクロールする。
- キーを切り替えてもパネル内の変更を保持。適用で変更キーの既存スロットだけを共有draftへ反映し、別キー/他設定の新しい変更を保持。編集対象キーに外部追加/削除/状態変更/並べ替えが届いた場合は全適用を拒否する。取消/Escape/×では一時変更を捨て、元focusへpreventScrollで戻す。永続化は既存の全体保存。パネル表示中のキー抑止、同一コマンドの重複除去/押下時条件/dispatcherは維持。
- 型検査/build/変更コード整形/差分確認が成功。keybindings/dynamic-commands/applet-orderの関連回帰21/21成功。ソースGUI shortcuts-ui-1791647694490の8群、navigation-1791647794011の17群、keybindings-1791647802959の10群成功。初回の外部競合試験は保存IPC後にrenderer更新を待つ前に適用していたため待機を修正し、旧メニューの期待値も新仕様へ更新して成功。失敗ログは保持。
- publish.bat終了0。固定単一EXE0.26.23は142529981bytes、SHA256 `c7fa3277a7043b93027f0a646d87eccce8587e621a5eae0faa4b4d588f461848`。update.jsonの版/size/hash一致。隔離コピーshortcuts-ui-1791647948640の8群成功、コピーhash一致。設定/Appletの全提供元表示、ドラッグ/上下/Alt＋上下/Escape取消とfocus復帰、複数キーの適用、無関係キーとのマージ、対象キーの外部更新拒否、空/1件、22行のスクロール、順序変更を保存して再起動、既存編集/登録競合を確認。両テーマ1280/900/700pxと高さ540pxを確認、最終EXEのlight700/長い一覧を目視確認。
- 証跡は`.artifacts/shortcut-order-20261011/`。文書ローカルリンク127件確認。今回の標準全回帰・全IME/キーボード配列・実サービス認証・物理ジェスチャーは未実行。前回コミット時の194件成功を今回の全回帰成功とは扱わない。既存全体ZIPのsize/hash不変、未変更Appletの再発行なし。
- 完了時整理は試験終了を確認。source/portable各最新成功3件と過去版/コミット再利用/状態不明/失敗記録を保持し、保護資料以外に安全な削除対象がなく追加削除0。commit/push/Release/実利用deployなし。

## 2026-10-11 実行順パネルのコミット前検証（0.26.23）

- 利用者確認済みの変更22ファイルを対象に、型検査と標準回帰196/196件が成功。ソースGUIはnavigationの17群、keybindingsの10群、applet-orderの4群が成功。実Windowsキー入力、共有draft、Applet一覧と実行順の独立性を確認。
- 発行済み単一EXEのshortcuts-ui-1791648774806で8群が成功。並べ替え/取消/条件/競合処理/保存再起動/両テーマ3幅を再確認。EXEは利用者確認後から不変、142529981bytes、SHA256 `c7fa3277a7043b93027f0a646d87eccce8587e621a5eae0faa4b4d588f461848`が検証コピーと一致。再梱包・版の追加更新はなし。
- 証跡は`.artifacts/commit-validation-shortcut-order-20261011/`。検証前後のtree `035109bac770d355544c8149f6380db19ef4382a`と入力hashが一致。コマンド/時刻/終了コード/全ログhash、Node24.21.0/pnpm12.10.1/.NET10.0.401/Windows x64、Gmail依存commit/treeとfixture hashを記録。検証後の変更はこの記録のみで、最終tree/commitは同証跡へ記録する。
- 隔離試験プロセスの終了を確認。最新3件、今回/前回のコミット再利用証跡、旧版検証、不明/失敗資料を保護し、追加削除0。実サービス認証・全IME/キーボード配列・物理ジェスチャーは対象外。commitのみ実施し、push/Release/実利用deployなし。
