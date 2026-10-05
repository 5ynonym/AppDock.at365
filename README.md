# AppDock.at365

自作の常駐ツールを拡張として集める、Windows x64向けのElectronホストです。ホスト本体はTypeScript、画面はReactです。C#/.NETとTypeScript/Node.jsの拡張をそれぞれ別プロセスで実行します。

## 起動

`publish\AppDock.at365.exe` を、書き込み可能な好きなフォルダに置いて起動してください。インストール不要です。Electronと.NET 10の実行環境を内部に同梱しているので、利用するPCにNode.jsや.NETを別途入れる必要はありません。

初回起動でEXEの隣に `settings.json` が作成されます。「設定」からフォームとJSONの両方で編集できます。ウィンドウの×は既定でトレイへ格納します。完全終了はトレイメニューの「終了」です。この動作は設定で変更できます。

- **ホーム**: 拡張の状態とコマンド数。
- **拡張機能**: 有効・無効、再起動、拡張が提供する画面と操作。
- **設定**: メイン画面内のカテゴリ式編集画面。テーマ（Dark / Light / System）、常駐動作、通知、拡張の設定、ショートカット、プロフィール。
- **ログ**: 直近500件、検索、レベルでの絞り込み。ファイルログは1MBで1世代ローテーション。
- **コマンドパレット**: 既定は `Ctrl+P` / `Ctrl+Shift+P`。`Ctrl+,` で設定を開きます。☆でピン留め、↑／↓でピンの順番を変更できます。ピンと順番は操作時に保存します。

最初はTypeScript製のWelcome拡張だけが有効です。.NET Connection Demoを有効にすると、C# DLLからの画面表示、定期実行、コマンド、通知、トレイ登録を確認できます。

「設定 → ショートカット」で、ホストと拡張が登録したコマンドにキーを割り当てられます。欄を選んでキーを押し、「保存」で確定します。Ctrl / Altとの組み合わせ、F1〜F24に対応し、1つのコマンドに5個まで登録できます。Backspace / Deleteまたは×で解除します。同じキーの重複割り当ては保存時に拒否します。ショートカットはAppDockの画面を操作している間に有効です。無効になった拡張のキー設定とピンの順番も保持します。

「設定 → プロフィール」でユーザー名とアバターを変更できます。左下のアバターからも開けます。PNG / JPEG（5MB以下）を選択して「保存」すると、設定ファイルの隣に `avatar.png` を保存します。長辺256px以内のPNGに変換し、次の画像を保存すると同じファイルを上書きします。元画像や過去の画像は残しません。「画像を削除」を保存するとファイルも削除します。

## 「EXEひとつ」の意味

electron-builderの**portable**形式です。配布するアプリ本体はEXEひとつですが、起動時にElectronや同梱.NETランタイムをWindowsの一時フォルダへ展開します。展開せず直接実行する.NETの単一ファイルと同一の方式ではありません。設定は一時フォルダに保存せず、`PORTABLE_EXECUTABLE_DIR` を使って元のEXEの隣に保存します。

```text
任意の配置先/
├─ AppDock.at365.exe
├─ settings.json          一般・拡張・ショートカット・ピン・プロフィール設定
├─ avatar.png             アバターを設定した場合のみ。常に最新の1枚
├─ extensions/            追加拡張（初回起動で空フォルダを作成）
└─ .appdock/
   ├─ chromium/           Chromiumのユーザーデータ
   ├─ logs/               ホスト・拡張ログ
   ├─ storage/            拡張固有の永続データ
   └─ secrets/            暗号化したトークン等
```

設定項目は1つのJSONに集約します。トークン等の秘密情報と処理データは設定JSONに混ぜず、上記の専用領域へ保存します。Secrets APIはElectron safeStorageによるWindowsの暗号化を利用し、同じWindowsユーザーでの利用を前提にします。EXEをコピーしても認証情報の別PCへの移行は保証されません。

JSONはUTF-8の標準JSONです。コメントを含むJSONCには対応していません。保存は一時ファイルから置換します。手動編集は起動中にも反映されます。壊れたJSONは上書きせず、起動中は最後の有効な設定を維持してログに記録します。起動時に壊れていた場合は、場所とエラーを表示して終了します。編集中に他の場所で設定が変更された場合は、古い内容による上書きを拒否します。

0.1.0の設定ファイルもそのまま読み込めます。新しい項目は既定値で補われ、次の保存で書き込まれます。`shortcuts` はコマンドIDとキー文字列の配列、`pinnedCommands` は表示順のコマンドID配列、`profile` は `name` と `avatar`（`"avatar.png"` または `null`）です。[設定例](settings.example.json) を参照してください。

## 開発

Windows、Node.js 24以降、pnpm 11、.NET 10 SDKが必要です。依存バージョンは `pnpm-lock.yaml` で固定しています。

```powershell
pnpm install --frozen-lockfile
pnpm run build:dotnet
pnpm start

pnpm run typecheck
pnpm test
node scripts/ui-test.cjs
pnpm run test:preferences
pnpm run smoke
pnpm run dist
node scripts/smoke.cjs publish/AppDock.at365.exe
```

`pnpm run dist` は.NETホストのself-contained発行、TypeScriptのコンパイル、React/Viteのビルド、Windows x64 portable EXE作成を行います。`publish.bat` からも発行できます。`AppDock.at365.slnx` はSDK・.NETホスト・C#サンプル用です。Electron部分はプロジェクトルートのpackage.jsonを使います。

ソースの主な配置:

```text
src/main/                  Electron本体・IPC・拡張管理・Node拡張ランナー
src/renderer/              React UI
src/shared/                UI/ホスト間の型と設定検証
dotnet/AppDock.SDK/        .NET拡張向けインターフェース
dotnet/AppDock.ExtensionHost/  DLLを読み込むプロセス・JSON-RPC・SDK実装
dotnet/AppDock.Extensions.Demo/  C#拡張サンプル
extensions/welcome/        TypeScript拡張サンプル
extensions/dotnet-demo/    C#サンプルのmanifestと発行DLL
tests/                     設定・通信・実プロセスの回帰テスト
scripts/                   ビルドと実機UI/portable検証
```

テストは専用の一時フォルダ／`artifacts` を使い、実利用の設定・メール認証・クリップボード・壁紙に触れません。Windowsの実行制限がある環境では、通常のWindows実行環境でElectronの起動テストを行ってください。アプリ側ではChromiumのサンドボックスを有効にしています。

## 拡張を書く

[拡張APIとプロトコル](docs/extensions.md) を参照してください。外部拡張はEXEの隣の `extensions\<拡張フォルダ>\extension.json` と実装ファイルで構成します。追加・削除後はホストを起動し直してください。新規拡張は既定で無効です。同梱拡張と同じIDは同梱側を優先し、重複をログに記録します。

ローカルの信頼できる拡張を対象にしています。拡張はユーザー権限で動く.NET/Nodeコードです。別プロセス化は障害の分離であり、OSの権限制限ではありません。manifestのcapabilitiesはHost APIの使用宣言・検査であり、拡張の直接のファイル操作やネットワーク通信を制限する仕組みではありません。React画面はNodeを公開せず、画面に渡せる拡張UIはテキスト・状態・コマンドに限定しています。

## 既存3アプリの移行

現在は**ホストと接続サンプルまで**です。GmailChecker、Watch、WallpaperSlideshow本体の移行は行っていません。既存アプリのソースや設定も変更していません。

[移行メモ](docs/migration.md) に現行コードを確認した分割案をまとめました。既存EXEを単に起動する方式ではなく、CoreロジックをSDK対応DLLに移し、設定・通知・トレイ等をホストに集約する方針です。Watchのオーバーレイと壁紙のWorkerWのようなWindows固有の表示は、ネイティブ表示処理を残す必要があります。

## 配置

`deploy.bat "配置先の既存フォルダ"` でEXEのみコピーします。引数省略時は `deploy.local.txt` の先頭行を使います。`deploy.local.txt.example` を参考にしてください。設定や追加拡張はコピーしません。配置先で実行中の場合は先に終了してください。既存EXEを置換する操作なので、配置はユーザーが必要な時に実行してください。

## 公式仕様

- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security)
- [electron-builder portable](https://www.electron.build/nsis/)
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)

署名証明書は設定していないため、このビルドは未署名です。
