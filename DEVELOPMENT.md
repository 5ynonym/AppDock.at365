# AppDock.at365 開発ガイド

0.26.32のショートカット外部編集と0.26.33のジェスチャー外部編集は[共通操作API](docs/automation.md)を参照してください。`ShortcutCommands`/`GestureCommands`は既存の割当検証・保存形式とSettingsCommandsのrevisionを共有します。回帰は`tests/shortcut-commands.test.cjs`/`tests/gesture-commands.test.cjs`、GUI/実キー/MCPは`scripts/automation-ui-test.cjs`（ジェスチャー編集は`automation-gesture-checks.cjs`）です。ジェスチャー物理入力の試験とは区別します。

0.26.31のApplet管理コマンドは[共通操作API](docs/automation.md#applet管理02631以降)を参照してください。共通処理は`src/main/core/applet-management.ts`、登録は`src/shared/applet-management.ts`、回帰は`tests/applet-management.test.cjs`と`tests/automation.test.cjs`、実プロセス/UI/MCPは`scripts/automation-ui-test.cjs`で確認します。

利用方法は[README.md](README.md)、実測結果と未確認事項は[VERIFICATION.md](VERIFICATION.md)を参照してください。

## 文書の入口

- [実装・コミット・リリースの共通手順](docs/development-workflow.md): 実装時のテスト選択、コミット前の必要回帰、リリース前のコミット漏れ/プッシュ確認、検証証跡の再利用条件。本体と全Appletに適用します。以下の試験一覧は、この手順に従って必要な段階で実行します。

- [設定同期・登録素材・PC専用保存](docs/settings-sync.md): 0.26.14の保存境界と0.26.15のat365/profile保存先、ファイル名ID、受信監視、バックアップ、隔離GUI検証。

- [作業ルール](AGENTS.md): このrepo固有の運用上の注意と未実装の相談事項。[過去の実装記録](docs/implementation-history.md)は当時の検証範囲を調べる際に参照。

- [GitHub Release手順](docs/RELEASING.md): 本体の通常版/オールインワンと未公開の同梱Appletをまとめて公開・取得確認し、今回公開した各repoを最新3件へ整理。

0.18.0のAppletページ宣言・Node/.NET API・限定UIブリッジ・表示先・リボン設定と検証は[Appletページとリボン](docs/applet-pages.md)を参照してください。

実リボンは有効なAppletのページだけを表示します。停止中もリボン設定の一覧と保存済み配置は保持します。停止/再開の回帰はWebApplet・既存ページ/Gmail・リボン配置のGUI試験で確認します。

0.17.1ではWebアカウントのローカルUIへ、自身のAppletの宣言済みboolean/静的select設定の読み書きと変更通知を追加しました。保存は既存SettingsStore、詳細は[WebアカウントAPI](docs/web-accounts.md)を参照してください。

0.16.3のWebアカウント変更は、操作中のWebContents間だけの入力フォーカス引継ぎと、観測のaccountNameによる仮名の一度だけの置換です。詳細と保存互換性は[WebアカウントAPI](docs/web-accounts.md)を参照してください。

- [AppDock実装ガイド](docs/host-development.md): ホスト・設定・React UIの変更箇所と検証。
- [共通操作APIとCodex連携](docs/automation.md): MCP、PC専用接続設定、Codex登録、基本設定の外部操作と検証。
- [Applet実装ガイド](docs/applet-development.md): 新しいAppletの実装・設定・コマンド・終了処理。
- [Applet API](docs/extensions.md): APIと通信の契約。
- [WebアカウントAPI](docs/web-accounts.md): WebContentsView・永続セッション・DOM観測（0.12.0）、一時UIデータと表示領域（0.13.0）、背景描画（0.13.1）、項目を開く操作・切替キー・通知音・画面位置保存（0.14.0）、テーマ同期・音声コピー（0.15.0）、通常起動の描画（0.15.1）、準備完了後の背景同期再開・操作中の自然なフォーカス（0.15.2）。
- [移行メモ](docs/migration.md): 既存アプリからの分割案と当時の設計記録。
- [ドキュメント方針](docs/documentation.md): READMEと開発文書の分担、新規リポジトリの構成。
- [Gmailの開発ガイド](../Applet.Gmail.at365/DEVELOPMENT.md): Node通知・Webアカウント・ページ表示と、隔離GUI・portable検証。

## Applet設定パネル

0.26.11のページ共通保存・未保存の浮動通知・Applet切替時のタブ保持は[設定パネルの共用](docs/host-development.md#applet設定パネルの共用)、組み込み管理入口への移動は[WebApplet](docs/web-applets.md)を参照してください。専用GUIは`dev.bat exec node scripts/settings-notice-ui-test.cjs [publish/AppDock.at365.exe]`です。

0.21.0ではApplet詳細に設定パネルを埋め込み、設定ページのApplet別設定とも共用します。画面・編集状態・保存処理の分担と検証は[AppDock実装ガイド](docs/host-development.md#applet設定パネルの共用)を参照してください。

## 構成

ホスト本体はTypeScript、画面はReactです。C#/.NETとTypeScript/Node.js、ネイティブ表示を持つ専用EXEのAppletをそれぞれ別プロセスで実行します。設定JSONやAPIの `extensions` は互換性のため名前を維持します。

0.17.0ではウィジェット機能・配置設定・Node/.NET APIを削除しました。WPF等の独自ウィンドウは`native`、WebサービスはWebアカウントAPI、宣言的な表示はPanelを使用します。0.18.0からHTML/Reactの独自操作画面にはAppletページAPIも利用できます。Watchは独自WPF画面のnative EXEです。

## 開発環境・ビルド・テスト

スタートアップ登録・管理者起動の仕様と保存処理は[起動設定](docs/launch-settings.md)を参照してください。実Windowsタスクと発行した単一EXEの専用検証は`dev.bat exec node scripts/launch-settings-ui-test.cjs publish/AppDock.at365.exe`です。UAC承認・実サインインの確認範囲は検証記録で区別します。

Windows x64と.NET 10 SDKが必要です。Node.jsとpnpmは **このプロジェクトの `.tools` 内**に配置できます。グローバルインストール、管理者権限、永続的なPATH変更は不要です。[toolchain.json](toolchain.json)でNode.jsとpnpmのバージョンを固定し、依存ライブラリは `pnpm-lock.yaml` で固定しています。

初回は次の手順で準備します。公式Node.js ZIPのSHA256を照合し、npmでpnpmをプロジェクト内にインストールします。

```powershell
.\setup-tools.bat
.\dev.bat install --frozen-lockfile
.\publish.bat
```

次回からの発行は `.\publish.bat` です。本体EXEと更新JSONを本体のpublishへ生成します。変更したAppletは、それぞれのrepoでpublish.batを実行します。実装・修正の完成時に対象モジュールの版を上げて発行し、同じ変更の発行・リリースだけでは版を重ねて増やしません。オールインワンZIPの作成・検証と旧版ZIP整理は、[GitHub Release手順](docs/RELEASING.md)のPrepareで行います。通常publishからは呼び出しません。対象リポジトリ・出力・検証方法は[オールインワン作成](docs/all-in-one.md)を参照してください。`dev.bat` はローカルのNode.jsとpnpmを、そのコマンドの実行中だけPATHへ追加します。開発コマンドもこの入口から実行できます。

Git worktreeでは`node_modules`を元の作業ツリーへのjunctionとして共有したまま、pnpmの依存インストールを実行しないでください。パッケージのjunctionや`.bin`の起動スクリプトにworktreeの絶対パスが生成され、worktree削除後に元の作業ツリーの発行も失敗します。依存を更新するworktreeは独立した`node_modules`を用意し、削除後は元の作業ツリーで`dev.bat run typecheck`と`publish.bat`が通ることを確認してください。

```powershell
.\dev.bat run build:dotnet
.\dev.bat start

.\dev.bat run typecheck
.\dev.bat test
.\dev.bat run test:ui
.\dev.bat run test:navigation
.\dev.bat run test:preferences
.\dev.bat run test:hotkeys
.\dev.bat run test:window-state
.\dev.bat run smoke
.\dev.bat run dist
.\dev.bat exec node scripts/smoke.cjs publish/AppDock.at365.exe
```

Node.js／pnpmの更新は、`toolchain.json` の完全なバージョン番号を変更してから `.\setup-tools.bat` を再実行します。両ツールの取得・動作確認が成功した後にだけ利用バージョンを切り替えます。以前のバージョンは `.tools/node/<version>` と `.tools/pnpm/<version>` に残すので、設定を戻してsetupを実行すると切り戻せます。winget等の更新対象にはなりません。更新後は `.\dev.bat run typecheck`、`.\dev.bat test`、`.\publish.bat` で確認してください。

現在の固定ツールはNode.js 24.21.0（最新24 LTS）とpnpm 12.10.1です。pnpm 12はネイティブEXEになったため、setupはnpmで依存のスクリプトを無効にして取得した後、pnpm自身の公式`install.js`だけを実行し、Windowsの起動用shimを再生成します。初回取得・再実行・古いpnpmへの切り戻しもプロジェクト内で完結します。グローバルのツールやPATHは変更しません。

Electron 44.6.0はバイナリを初回実行時に取得するため、[公式手順](https://www.electronjs.org/docs/latest/tutorial/installation)の`install-electron`をプロジェクトの`postinstall`で明示実行します。pnpmが変更なしのインストールを省略する場合、バイナリが必要なら次を実行してください。

```powershell
.\dev.bat run postinstall
```

依存更新は`.\dev.bat update --latest`、残りの確認は`.\dev.bat outdated --format json`です。安定版の直接依存と、それが要求する間接依存をlockfileに固定します。GmailはこのホストのTypeScript・Vite・Reactを共有し、他の5つの.NET Appletは外部NuGet参照を持ちません。各Appletの既存回帰テストも合わせて実行してください。

### 依存とツールの公開後待機

通常更新は各バージョンの公開から7日待機します。`pnpm-workspace.yaml`の`minimumReleaseAge: 10080`（分）、`minimumReleaseAgeStrict: true`、`minimumReleaseAgeIgnoreMissingTime: false`を使い、実行時・開発用・間接依存へ適用します。条件を満たす版がなければ停止し、公開日時がない場合も停止します。既存lockfileを使ったインストールにも適用するため、若い版を別環境から持ち込んでも待機を回避できません。`outdated`に新版が残っても、待機中なら無理に導入しません。日数を変える場合は`toolchain.json`の`minimumReleaseAgeDays`も揃えます。setupは両設定の一致を確認します。

`verifyDepsBeforeRun: error`により、ビルド・試験前に依存の不整合があれば自動インストールせず停止します。導入・復元は明示的な`dev.bat install --frozen-lockfile`、版更新は`dev.bat update --latest`で行います。

2026-10-11の導入時は、既存0.26.25で導入・検証済みのlockfileに7日未満の6件が含まれていました。版とlockfileを変えず現状を維持する移行例外として`@vitejs/plugin-react@6.1.2`、`electron@44.6.0`、`http-cache-semantics@4.3.0`、`nanoid@3.3.20`、`postcss@8.5.29`、`vite@8.3.3`だけを完全な版で除外しています。通常の新版には適用されません。全6件が成熟する2026-10-14 07:39:15 JST以降にこれらを取り除けます。`minimumReleaseAgeExcludePrune: true`でlockfileから消えた版の除外は更新時に自動整理します。pnpm本体12.10.1は導入済みのものを再利用し、新規取得は成熟するまで拒否します（ツールの例外は追加していません）。

Node.jsは`toolchain.json`で完全な版を固定し、`nodeChannel: "lts"`を維持します。現在の24.21.0はKrypton LTSです。自動でCurrentや新しいLTSへ移行しません。新規取得前に公式の`dist/index.json`で対象版のLTS表示と公開日を確認します。公開日が日単位なので、そのUTC日が終わってから7日待ちます。導入済みNodeは実行ファイル自身のLTS表示を確認して再利用します。

pnpm本体はnpmで導入するため、workspace設定だけでは保護されません。setupは公式npmレジストリで固定版のpnpmとWindows x64ネイティブパッケージの公開日時を確認し、npmにも`--min-release-age=7`を渡します。新規取得でメタデータの取得・検証に失敗したら停止します。導入済みの固定ツールは再利用し、通常ビルドのたびにツール公開情報を取得しません。

重大なセキュリティ修正を急いで導入する場合は、出所・告知・差分を確認し、対象の完全な版だけを例外にします。npm依存は`pnpm-workspace.yaml`の`minimumReleaseAgeExclude`へ`package-name@1.2.3`を追加し、理由をコメントとVERIFICATIONへ記録します。名前だけやワイルドカードで全バージョンを除外しません。ツールは`toolchain.json`の`releaseAgeExceptions`へ`{"package":"pnpm","version":"12.10.1","reason":"確認した修正内容"}`形式で記録します（これは書式例で、現在の例外は空です）。対象は`node`、`pnpm`、`@pnpm/exe.win32-x64`です。pnpmとそのバイナリはそれぞれ確認し、必要ならそれぞれ版指定で例外にします。Nodeの例外は待機日数だけを免除し、LTS要件や公開日時の確認は維持します。待機期間経過後や対象版の不使用時に例外を取り除きます。

待機は不正コードの検出を保証する機能ではありません。lockfile固定、導入前の告知・差分確認、導入後の必要な回帰確認も継続します。仕組みの回帰は`node --test tests/release-age.test.cjs`（ローカルNodeを使用）で、公開時刻の境界、版限定例外、非LTS拒否、pnpm実体の直接・間接・日時欠落・lockfile復元時の拒否を隔離レジストリで確認します。

`.tools` のツール本体とnpmキャッシュはGit管理・EXEへの同梱対象外です。pnpmの依存パッケージストアはpnpmの通常のユーザーキャッシュを使います。

`pnpm run dist` は.NETホストのframework-dependent発行（`win-x64`、`--self-contained false`）、TypeScriptのコンパイル、React/Viteのビルド、Windows x64 portable EXE作成を行います。`publish.bat` からも発行できます。`build:dotnet` は発行前に `.artifacts/dotnet-host` を削除して再生成し、以前のself-contained発行で残ったランタイムファイルの混入を防ぎます。このフォルダには手作業のファイルを置かないでください。`AppDock.at365.slnx` はSDK・Runtime・.NETホスト用です。Electron部分はプロジェクトルートのpackage.jsonを使います。

`build`は`scripts/build-main.cjs`で生成済みの`out/main`を整理してからTypeScriptをコンパイルします。削除したモジュールが次の配布物に残ることを防ぎます。React/Viteも`out/renderer`を再生成します。設定の読み込み・保存は定義済みのトップレベル項目のみを返し、Applet固有の`extensions.<id>.settings`は保持します。

0.16.4のportable発行は`scripts/build-portable.cjs`を経由します。electron-builder 26.15.3がportableのscript/includeを無視するため、ビルドプロセス内だけでNsisTarget.computeFinalScriptへ`scripts/portable.nsi`を渡し、終了時に復元します。node_modulesは編集しません。ビルダーの固定版と元テンプレートのライフサイクルを検証し、依存更新時は明示的に見直します。直接electron-builder CLIを使うとこのランチャーを含まないため、発行にはpublish.batまたはdev.bat run distを使ってください。APIからビルドする試験もdev.batのローカルNode/pnpm環境を使います。

ランチャーはWindows TEMP・外側EXEの正規化パス・test-profileを小文字化してSHA256を取り、`TEMP/AppDock.at365-<hash>`へ展開します。版番号は含めません。起動/展開/最終削除をGlobalの名前付きmutexで直列化し、別の名前付きカーネルオブジェクトの生存を実行領域のleaseとして使用します。leaseは子のElectron本体へDuplicateHandleで渡すため、ランチャーだけの強制終了後も本体を保護します。二重起動は使用中の資産をそのまま使用し、全leaseがなくなった時だけ生成領域を削除します。設定や認証領域は削除対象外です。

StdUtils.ExecShellWaitExの戻り値は`hProc:<hex>`というタグ形式です。これを検証して`0x<hex>`へ変換してから、Win32の待機/終了コード取得/CloseHandle/DuplicateHandleへ渡します。タグを数値ポインターとして扱うと待機やleaseの解放が壊れるため、実portableの停止/更新試験を省略しないでください。

TrayのGUIDは`src/main/core/tray-identity.ts`で実行EXEパスと保存先からUUID v5を生成します。未署名ではGUIDが実行パスに紐付くため、実行領域と併せて安定化し、移動した配置や隔離profileには別GUIDを割り当てます。[Electronの仕様](https://www.electronjs.org/docs/latest/api/tray/)を参照してください。

`dev.bat exec node scripts/tray-identity-portable-test.cjs`は別版のmetadataを持つ隔離EXEを発行し、同じ配置先で更新します。専用アイコンのWindows登録とIsPromotedだけを確認し、試験設定は終了時に元へ戻します。再起動/同時起動/ランチャー強制終了/生成領域の最終削除も実EXEで検証します。実利用アイコンのWindows設定は変更しません。

ソースの主な配置:

```text
src/main/                  Electron本体・IPC・拡張管理・Node拡張ランナー
src/renderer/              React UI
src/shared/                UI/ホスト間の型と設定検証
dotnet/AppDock.SDK/        .NET拡張向けインターフェース
dotnet/AppDock.Runtime/     .NET共通のJSON-RPC・SDK実装・セッション
dotnet/AppDock.ExtensionHost/  DLLを読み込むプロセス
tests/fixtures/            Node・C#拡張の検証用データ（同梱対象外）
tests/                     設定・通信・実プロセスの回帰テスト
scripts/                   ビルドと実機UI/portable検証
```

テストは専用の一時フォルダ／`.artifacts` を使い、実利用の設定・メール認証・クリップボード・壁紙に触れません。Node・C#の検証用拡張は `build:test-extensions` で `.artifacts/test-extensions` に生成し、UIテストの専用プロファイルにだけ配置します。通常のビルド・発行・起動では読み込みません。Windowsの実行制限がある環境では、通常のWindows実行環境でElectronの起動テストを行ってください。アプリ側ではChromiumのサンドボックスを有効にしています。

### 作業完了時のテストフォルダー整理

制限付きエージェント環境での実行権限については[共通手順](docs/development-workflow.md#制限付き実行環境)を参照してください。

実装・修正に必要なテストと、発行した固定EXEの動作確認がすべて成功した後、作業者が以下を行います。リリースまで待たず、各作業の完了手順として実施します。調査・手順書だけの変更でテストを行っていない場合は、整理対象なしで構いません。

1. テストスクリプトの出力先と結果形式を確認し、`.artifacts`直下のテスト専用フォルダーを列挙します。`smoke-<timestamp>`や`navigation-<timestamp>`などの名前は候補の抽出にだけ使います。
2. 結果JSON・ログ・既存の検証記録から、そのフォルダーの試験が終了し成功したことを確認します。結果形式は試験ごとに異なります。終了だけでは成功と扱わず、成功の証拠がないもの、失敗記録があるもの、調査中のものは保持します。解決済みの失敗記録の整理は別途判断します。
3. 同じテストスクリプト・実行方式ごとに、確認済みの成功分を実行日時順に並べ、直近3回分を残します。それより古い成功分だけを削除候補にします。移行試験用の旧版EXE、今後使うfixture、検証記録から再利用を指定された資料は候補から除きます。
4. テストランナーと起動したElectron/.NET子プロセスが終了し、ほかの作業・チャットで使用されていないことを確認します。候補のパスを参照する実行中プロセスがないことも確認し、確認権限不足や状態不明なら保持します。
5. 削除直前に絶対パスと対象を再確認します。対象は当該repoの`.artifacts`直下にある通常のテスト専用ディレクトリに限定します。対象と配下にjunction・シンボリックリンク等の再解析ポイントがある場合は除外し、repo外へたどりません。PowerShellの`Remove-Item -LiteralPath`など同じシェル内で処理し、使用中や削除失敗時は強制終了・制限迂回をせず残します。
6. 残す直近分と保護対象が保持され、削除対象がなくなったことを確認します。削除名・件数、保持したものの理由、未実施や失敗を`VERIFICATION.md`の当該作業記録へ簡潔に残します。

`dotnet-host`、`updater`、`test-extensions`、`node-extensions`などの固定ビルド出力、`release-*`、`all-in-one-*`、単独の調査ファイルは、この手順の削除対象に含めません。`.artifacts`全体への再帰削除や、更新日時だけを使った一括削除は行いません。publishの旧版ZIP整理・GitHub Release保持数とは別の手順です。

この手順は通常publishや製品起動に自動削除を追加するものではありません。開発生成物の保存先は2026-10-10に本体と各Appletで`artifacts`から`.artifacts`へ改名しました。既存の検証記録内の旧`artifacts/`パスは当該repoの`.artifacts/`へ読み替えてください。保存済みJSON/ログにある実行当時の絶対パスやハッシュは履歴として保持し、旧planを無条件に再実行せず、再開前にパス・phase・実状態を照合します。同期・バックアップ・スナップショットの設定はユキちゃんが担当します。

## 配置

共通ログAPIは[Applet API](docs/extensions.md#sdkで使えるサービス)を参照してください。0.26.18では停止処理中のhost.logだけを許可し、クリーンアップエラーをホストファイルへ保存します。tests/logging.test.cjsで開始/稼働/停止中のログ・停止後拒否・他API拒否を確認します。WallpaperSlideshowのscripts/test-host-logging-ui.cjsは発行した単一EXEとnative fixtureで全体/個別ログ画面・終了時ログを確認します。

`deploy.bat` はPowerShell 7（`pwsh.exe`）を使用します。

`deploy.bat "配置先の既存フォルダ"` でEXEのみコピーします。引数省略時は `deploy.local.txt` の先頭行を使います。`deploy.local.txt.example` を参考にしてください。設定や追加拡張はコピーしません。配置先で実行中の場合は先に終了してください。既存EXEを置換する操作なので、配置はユーザーが必要な時に実行してください。

## 公式仕様

### Windows通知の起動先

`src/main/core/notifications.ts`でAppletと更新通知を共用します。Windowsは`toastXml`のprotocol activationを使い、元のportable EXEパス・保存先・packaged状態のSHA256から配置専用URI schemeを生成します。最初の通知時にだけ`app.setAsDefaultProtocolClient`で元の単一EXEを登録し、開発起動にはrepoパス、隔離試験には`--test-profile`を付けます。Electron 44.6.0が共有の製品名ショートカットからCLSIDを読み、LocalServer32を現在の実行EXEへ書き換える自動登録にクリック先を依存させません。

クリックは`second-instance`または初回起動の引数から処理します。URIは配置専用schemeとUUIDトークンだけを受け付け、外部URIから任意コマンドを実行しません。実行中のコールバックは一度だけ消費し、Appletの同じ子プロセスが稼働中であることを再確認します。終了後/古いトークンは本体を開くだけです。履歴用コールバックは最大512件保持します。既存の`at365.appdock`通知設定と単一EXE配布を維持します。

`dev.bat exec node scripts/notification-portable-test.cjs`は2つの隔離portableで合成通知を表示し、Windows通知履歴のXMLとURI登録を確認して、Windows Shell経由で同じURIを起動します。稼働中/終了後/停止Applet/同じURIの再実行を検証し、試験URIと合成通知を削除、Electronが触る既存のショートカット/COM登録を復元します。物理的な通知クリックと実Gmail受信は別途確認が必要です。

参照: [Electron通知](https://www.electronjs.org/docs/latest/api/notification#new-notificationoptions)、[Windows toastのprotocol activation](https://learn.microsoft.com/en-us/uwp/schemas/tiles/toastschema/element-toast)、[Electron 44.6.0の自動登録](https://github.com/electron/electron/blob/v44.6.0/shell/browser/notifications/win/windows_toast_activator.cc)。

- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security)
- [electron-builder portable](https://www.electron.build/nsis/)
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)

## 配布・保存・Appletの実装上の補足

electron-builderのportable形式を使用します。起動時にElectronと.NETホストを一時フォルダーへ展開し、`PORTABLE_EXECUTABLE_DIR`で元のEXEの隣に設定を保存します。.NETの単一ファイルと同じ方式ではありません。

Secrets APIはElectron safeStorageによるWindowsの暗号化を利用します。React画面にはNodeを公開せず、Appletのパネルはホストの宣言的な契約で描画します。Webアカウント対応Appletの操作画面は、限定preloadを持つ別BrowserWindowとリモートのWebContentsViewを組み合わせます。manifestのcapabilitiesはHost APIの使用宣言・検査であり、直接のファイル操作やネットワーク通信の権限制限ではありません。

`minimumHostVersion`を宣言したAppletは起動前にホストバージョンを検査します。既存のAPI v1、設定・コマンドIDは維持します。manifestで宣言したコマンドはロード前から公開し、旧IDは別名として維持できます。履歴画像のボタンやモニター切替は一般コマンドではなく専用のパネル操作です。

`displayName`はホスト画面・設定・コマンド候補・トレイの表示に使い、省略時は`name`の先頭の`Applet.`を除去します。manifest変更後はホストの再起動が必要です。

未インストールの旧サンプル`appdock.welcome` / `appdock.dotnet-demo`の設定・ショートカット・ピン留め等は起動時に整理します。明示的にインストールしたテスト用サンプルは保持します。

トレイの設定・再起動後の保持・実Trayのメニューとイベント・停止時の扱いは`dev.bat run test:tray`、GPU設定のON→OFF→ONと再起動後のElectron実状態は`dev.bat run test:hardware-acceleration`で検証します。GPU無効化はElectronの初期化前に行います。

リボンの上寄せ/下寄せ・セパレーターと既存設定の移行は[Appletページとリボン](docs/applet-pages.md)を参照してください。隔離GUIは`scripts/ribbon-layout-ui-test.cjs`、本体ショートカットは「設定 → ショートカット」のコマンド一覧で編集します。Applet個別設定/キー編集は詳細上部の独立したタブへ集約します。表示順・共有編集は[ホスト開発ガイド](docs/host-development.md#appletの表示順)、隔離GUIは`scripts/applet-order-ui-test.cjs`を参照してください。

0.20.0はWebアカウントのNode navigateコマンドと、外部リンク確認を自身のboolean設定へ保存するexternalLinkSettingを追加します。契約と移行は[WebアカウントAPI](docs/web-accounts.md)を参照してください。

0.21.0はmanifestのsettingActionsで設定ページに操作ボタンを表示します。自身の宣言済みコマンドだけを実行し、結果表示・二重実行防止・未保存draft維持を共通化します。[Applet API](docs/extensions.md)を参照してください。WallpaperSlideshowの`scripts/test-background-settings-ui.cjs`がnative fixtureを使った統合GUI検証です。

## 本体・Appletの自己更新

0.24.0の本体管理WebApplet・Gmailから独立したログイン枠・Web提供JSONの初期設定・保存形式・隔離試験は[WebApplet](docs/web-applets.md)を参照してください。

0.24.1はWebアカウント管理を独立ページ/専用ファイル/即時操作へ移し、名前のblur確定/Escape取消と削除待ちsessionの次回起動回収を追加します。同じ文書の移行・操作・削除境界を参照してください。

0.22.0の取得元・更新情報JSON・共通ミニプログラム・発行・復元・隔離試験は[更新の開発ガイド](docs/updates.md)を参照してください。`publish.bat`は本体EXEと`publish/update.json`を生成します。

0.23.0は全6Appletの更新ZIP/JSON生成、共通進捗とキャンセル、journalのcommit記録・中断復旧を追加します。`scripts/update-progress-ui-test.cjs`と`scripts/update-recovery-test.cjs`の実行方法・隔離範囲は上記ガイド、実GitHub/HTTP(S)/UNCでの確認は[配布先のチェックリスト](docs/update-checklist.md)を参照してください。

## 条件付きショートカット

0.25.0の[保存形式・判定・検証](docs/keybindings.md)を参照してください。全画面の入力とWindowsホットキーをホスト共通の条件判定/逐次実行へ集約します。新規割り当ては提供元条件を既定にし、本体コマンドはapp条件にします。

0.26.23の[ショートカット画面の設計](docs/shortcut-ui-redesign.md)を参照してください。設定ページの全コマンド一覧とApplet詳細で一覧・小さな編集パネルを共用し、検索/状態フィルターと追加時の表示位置を保持します。

## マウスジェスチャー

本体の入力プロセス、設定移行、コマンド文脈・取消、試験は[マウスジェスチャー](docs/gestures.md)を参照してください。0.26.24からショートカットと一覧/編集の枠/実行順パネルを共用し、ジェスチャー選択とbrowser/exe条件だけを専用に構成します。

ショートカット/マウスジェスチャーの共通操作UIは[割り当て操作UI](docs/host-development.md#割り当て操作uiの共用)を参照してください。scripts/shortcuts-ui-test.cjsは全コマンド/フィルター/メニュー/保存/登録エラー/両画面のdark/light全3幅を検証し、単一EXEのパスを引数で渡すと隔離コピーをCDPで検証します。

同じGUIで、未割り当てとキーの左端、複数割り当て、検索中のコマンド一覧、一覧操作で保存済みの実行順が変わらないことも照合します。shortcut-order-checks.cjsで専用パネルのドラッグ/上下/Alt＋上下、全提供元の表示、複数キーの一時編集、取消、外部更新の競合保護、無効/未確認/空/1件/長い一覧、両テーマ3幅を検証し、同じGUIの再起動で適用後の順序を照合します。

隔離した2つの実ホストによるWindows登録競合、記録中のエラー絞り込み/表示保持と再試行成功後の解消も確認します。

`scripts/hotkeys-ui-test.cjs`は実Windows入力で登録・競合・解除とnative Appletの実行を確認します。実利用中のPause/F23/F24を避ける場合は`APPDOCK_HOTKEY_TEST_ISOLATED=1`で隔離fixtureだけをF16/F20/Ctrl+Alt+F9へ変更します。試験キーが空いていることを事前に確認し、実利用設定を変更しません。

ショートカットの即時削除と保存前の破棄による復元、停止中Appletの無効行を解除して保存/再起動後も解除を保つこと、他の割り当ての保持、Deleteキーを記録できることも同じGUIで確認します。

タスクトレイの保存形式・移行・編集UI・一時停止コマンドと検証は[タスクトレイ仕様](docs/tray-menu.md)を参照してください。

0.26.25の更新確認/進捗は共通のステータスバー通知へ統一しています。表示時間・確認結果・実Windowの可視状態の扱いは[更新ガイド](docs/updates.md#設定と取得)を参照してください。リボンのアバター用CSSは配置用の中間要素があっても一致するセレクターとし、画像の余白なし・正円を維持します。

## 設定コマンド（0.26.30）

変更操作はcommands.executeのid/argsに統一し、旧settings.patchを削除。読取りはsettings.get/getSchemaに任意appletIdを追加しました。設定定義のautomation/generateCommandsから本体・Appletの更新schemaと引数なしコマンドを生成します。仕様と利用例は[共通操作API](docs/automation.md#設定宣言と自動生成コマンド)、保存競合は[設定同期](docs/settings-sync.md)を正本とします。主な回帰はtests/settings-commands.test.cjs、tests/automation.test.cjs、scripts/automation-ui-test.cjsです。
