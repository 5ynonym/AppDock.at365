# AppDock.at365 開発ガイド

利用方法は[README.md](README.md)、実測結果と未確認事項は[VERIFICATION.md](VERIFICATION.md)を参照してください。

## 文書の入口

- [AppDock実装ガイド](docs/host-development.md): ホスト・設定・React UIの変更箇所と検証。
- [Applet実装ガイド](docs/applet-development.md): 新しいAppletの実装・設定・コマンド・終了処理。
- [Applet API](docs/extensions.md): APIと通信の契約。
- [WebアカウントAPI](docs/web-accounts.md): WebContentsView・永続セッション・DOM観測（0.12.0）、一時UIデータと表示領域（0.13.0）、背景描画（0.13.1）、項目を開く操作・切替キー・通知音・画面位置保存（0.14.0）、テーマ同期・音声コピー（0.15.0）、通常起動の描画・ページのアクティブ維持（0.15.1）。
- [ウィジェット開発ガイド](docs/widgets.md): ウィジェットSDK、描画方式、Watch DLLへの移行。
- [移行メモ](docs/migration.md): 既存アプリからの分割案と当時の設計記録。
- [ドキュメント方針](docs/documentation.md): READMEと開発文書の分担、新規リポジトリの構成。
- [GmailCheckerの開発ガイド](../Applet.GmailChecker.at365/DEVELOPMENT.md): 0.11.0のNode通知APIを使うAppletと、隔離GUI・portable検証。

## 構成

ホスト本体はTypeScript、画面はReactです。C#/.NETとTypeScript/Node.js、ネイティブ表示を持つ専用EXEのAppletをそれぞれ別プロセスで実行します。設定JSONやAPIの `extensions` は互換性のため名前を維持します。

## 開発環境・ビルド・テスト

ウィジェットのSDK、描画方式、配置設定とWatch DLLへの移行は[ウィジェット開発ガイド](docs/widgets.md)を参照してください。AppDock 0.10.0以降では日時を表示側で更新し、同じモニター・階層の透過画面を共有します。

Windows x64と.NET 10 SDKが必要です。Node.jsとpnpmは **このプロジェクトの `.tools` 内**に配置できます。グローバルインストール、管理者権限、永続的なPATH変更は不要です。[toolchain.json](toolchain.json)でNode.jsとpnpmのバージョンを固定し、依存ライブラリは `pnpm-lock.yaml` で固定しています。

初回は次の手順で準備します。公式Node.js ZIPのSHA256を照合し、npmでpnpmをプロジェクト内にインストールします。

```powershell
.\setup-tools.bat
.\dev.bat install --frozen-lockfile
.\publish.bat
```

次回からの発行は `.\publish.bat` です。`dev.bat` はローカルのNode.jsとpnpmを、そのコマンドの実行中だけPATHへ追加します。開発コマンドもこの入口から実行できます。

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
.\dev.bat run test:widget-desktop
.\dev.bat run smoke
.\dev.bat run dist
.\dev.bat exec node scripts/smoke.cjs publish/AppDock.at365.exe
```

Node.js／pnpmの更新は、`toolchain.json` の完全なバージョン番号を変更してから `.\setup-tools.bat` を再実行します。両ツールの取得・動作確認が成功した後にだけ利用バージョンを切り替えます。以前のバージョンは `.tools/node/<version>` と `.tools/pnpm/<version>` に残すので、設定を戻してsetupを実行すると切り戻せます。winget等の更新対象にはなりません。更新後は `.\dev.bat run typecheck`、`.\dev.bat test`、`.\publish.bat` で確認してください。

`.tools` のツール本体とnpmキャッシュはGit管理・EXEへの同梱対象外です。pnpmの依存パッケージストアはpnpmの通常のユーザーキャッシュを使います。

`pnpm run dist` は.NETホストのframework-dependent発行（`win-x64`、`--self-contained false`）、TypeScriptのコンパイル、React/Viteのビルド、Windows x64 portable EXE作成を行います。`publish.bat` からも発行できます。`build:dotnet` は発行前に `artifacts/dotnet-host` を削除して再生成し、以前のself-contained発行で残ったランタイムファイルの混入を防ぎます。このフォルダには手作業のファイルを置かないでください。`AppDock.at365.slnx` はSDK・Runtime・.NETホスト用です。Electron部分はプロジェクトルートのpackage.jsonを使います。

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
