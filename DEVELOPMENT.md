# AppDock.at365 開発ガイド

利用方法は[README.md](README.md)、実測結果と未確認事項は[VERIFICATION.md](VERIFICATION.md)を参照してください。

## 文書の入口

0.18.0のAppletページ宣言・Node/.NET API・限定UIブリッジ・表示先・リボン設定と検証は[Appletページとリボン](docs/applet-pages.md)を参照してください。

0.17.1ではWebアカウントのローカルUIへ、自身のAppletの宣言済みboolean/静的select設定の読み書きと変更通知を追加しました。保存は既存SettingsStore、詳細は[WebアカウントAPI](docs/web-accounts.md)を参照してください。

0.16.3のWebアカウント変更は、操作中のWebContents間だけの入力フォーカス引継ぎと、観測のaccountNameによる仮名の一度だけの置換です。詳細と保存互換性は[WebアカウントAPI](docs/web-accounts.md)を参照してください。

- [AppDock実装ガイド](docs/host-development.md): ホスト・設定・React UIの変更箇所と検証。
- [Applet実装ガイド](docs/applet-development.md): 新しいAppletの実装・設定・コマンド・終了処理。
- [Applet API](docs/extensions.md): APIと通信の契約。
- [WebアカウントAPI](docs/web-accounts.md): WebContentsView・永続セッション・DOM観測（0.12.0）、一時UIデータと表示領域（0.13.0）、背景描画（0.13.1）、項目を開く操作・切替キー・通知音・画面位置保存（0.14.0）、テーマ同期・音声コピー（0.15.0）、通常起動の描画（0.15.1）、準備完了後の背景同期再開・操作中の自然なフォーカス（0.15.2）。
- [移行メモ](docs/migration.md): 既存アプリからの分割案と当時の設計記録。
- [ドキュメント方針](docs/documentation.md): READMEと開発文書の分担、新規リポジトリの構成。
- [Gmailの開発ガイド](../Applet.Gmail.at365/DEVELOPMENT.md): Node通知・Webアカウント・ページ表示と、隔離GUI・portable検証。

## Applet設定パネル

0.21.0ではApplet詳細に設定パネルを埋め込み、設定ページのApplet別設定とも共用します。画面・編集状態・保存処理の分担と検証は[AppDock実装ガイド](docs/host-development.md#applet設定パネルの共用)を参照してください。

## 構成

ホスト本体はTypeScript、画面はReactです。C#/.NETとTypeScript/Node.js、ネイティブ表示を持つ専用EXEのAppletをそれぞれ別プロセスで実行します。設定JSONやAPIの `extensions` は互換性のため名前を維持します。

0.17.0ではウィジェット機能・配置設定・Node/.NET APIを削除しました。WPF等の独自ウィンドウは`native`、WebサービスはWebアカウントAPI、宣言的な表示はPanelを使用します。0.18.0からHTML/Reactの独自操作画面にはAppletページAPIも利用できます。Watchは独自WPF画面のnative EXEです。

## 開発環境・ビルド・テスト

Windows x64と.NET 10 SDKが必要です。Node.jsとpnpmは **このプロジェクトの `.tools` 内**に配置できます。グローバルインストール、管理者権限、永続的なPATH変更は不要です。[toolchain.json](toolchain.json)でNode.jsとpnpmのバージョンを固定し、依存ライブラリは `pnpm-lock.yaml` で固定しています。

初回は次の手順で準備します。公式Node.js ZIPのSHA256を照合し、npmでpnpmをプロジェクト内にインストールします。

```powershell
.\setup-tools.bat
.\dev.bat install --frozen-lockfile
.\publish.bat
```

次回からの発行は `.\publish.bat` です。通常の本体EXE・更新JSONに加え、ローカルAppletを再発行して同梱するオールインワンZIPも生成します。本体だけの発行は`.\dev.bat run dist:host`です。対象リポジトリ・出力・検証方法は[オールインワン発行](docs/all-in-one.md)を参照してください。`dev.bat` はローカルのNode.jsとpnpmを、そのコマンドの実行中だけPATHへ追加します。開発コマンドもこの入口から実行できます。

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

`.tools` のツール本体とnpmキャッシュはGit管理・EXEへの同梱対象外です。pnpmの依存パッケージストアはpnpmの通常のユーザーキャッシュを使います。

`pnpm run dist` は.NETホストのframework-dependent発行（`win-x64`、`--self-contained false`）、TypeScriptのコンパイル、React/Viteのビルド、Windows x64 portable EXE作成を行います。`publish.bat` からも発行できます。`build:dotnet` は発行前に `artifacts/dotnet-host` を削除して再生成し、以前のself-contained発行で残ったランタイムファイルの混入を防ぎます。このフォルダには手作業のファイルを置かないでください。`AppDock.at365.slnx` はSDK・Runtime・.NETホスト用です。Electron部分はプロジェクトルートのpackage.jsonを使います。

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

テストは専用の一時フォルダ／`artifacts` を使い、実利用の設定・メール認証・クリップボード・壁紙に触れません。Node・C#の検証用拡張は `build:test-extensions` で `artifacts/test-extensions` に生成し、UIテストの専用プロファイルにだけ配置します。通常のビルド・発行・起動では読み込みません。Windowsの実行制限がある環境では、通常のWindows実行環境でElectronの起動テストを行ってください。アプリ側ではChromiumのサンドボックスを有効にしています。

## 配置

`deploy.bat` はPowerShell 7（`pwsh.exe`）を使用します。

`deploy.bat "配置先の既存フォルダ"` でEXEのみコピーします。引数省略時は `deploy.local.txt` の先頭行を使います。`deploy.local.txt.example` を参考にしてください。設定や追加拡張はコピーしません。配置先で実行中の場合は先に終了してください。既存EXEを置換する操作なので、配置はユーザーが必要な時に実行してください。

## 公式仕様

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

リボンの上寄せ/下寄せ・セパレーターと既存設定の移行は[Appletページとリボン](docs/applet-pages.md)を参照してください。隔離GUIは`scripts/ribbon-layout-ui-test.cjs`、設定内の本体ショートカット入口は「Applet別の設定 → AppDock」です。

0.20.0はWebアカウントのNode navigateコマンドと、外部リンク確認を自身のboolean設定へ保存するexternalLinkSettingを追加します。契約と移行は[WebアカウントAPI](docs/web-accounts.md)を参照してください。

0.21.0はmanifestのsettingActionsで設定ページに操作ボタンを表示します。自身の宣言済みコマンドだけを実行し、結果表示・二重実行防止・未保存draft維持を共通化します。[Applet API](docs/extensions.md)を参照してください。WallpaperSlideshowの`scripts/test-background-settings-ui.cjs`がnative fixtureを使った統合GUI検証です。

## 本体・Appletの自己更新

0.22.0の取得元・更新情報JSON・共通ミニプログラム・発行・復元・隔離試験は[更新の開発ガイド](docs/updates.md)を参照してください。`publish.bat`は本体EXEと`publish/update.json`を生成します。

0.23.0は全6Appletの更新ZIP/JSON生成、共通進捗とキャンセル、journalのcommit記録・中断復旧を追加します。`scripts/update-progress-ui-test.cjs`と`scripts/update-recovery-test.cjs`の実行方法・隔離範囲は上記ガイド、実GitHub/HTTP(S)/UNCでの確認は[配布先のチェックリスト](docs/update-checklist.md)を参照してください。
