# AppDock.at365

自作の常駐ツールを**Applet**として集める、Windows x64向けのElectronホストです。ホスト本体はTypeScript、画面はReactです。C#/.NETとTypeScript/Node.js、ネイティブ表示を持つ専用EXEのAppletをそれぞれ別プロセスで実行します。設定JSONやAPIの `extensions` は互換性のため名前を維持しています。

## 起動

`publish\AppDock.at365.exe` を、書き込み可能な好きなフォルダに置いて起動してください。AppDock自体のインストールは不要です。Electronは内部に同梱していますが、.NETランタイムは同梱せず、利用するPCにインストール済みの **.NET 10 Runtime（Windows x64）** を使用します。Node.jsの別途インストールは不要です。

.NET 10 RuntimeがないPCでは、[Microsoftの.NET 10ダウンロードページ](https://dotnet.microsoft.com/download/dotnet/10.0)から「.NET Runtime」のWindows x64版をインストールしてください。.NET 10 SDKや.NET 10 Desktop Runtimeが入っているPCは、含まれる.NET Runtimeを利用できます。`dotnet --list-runtimes` に `Microsoft.NETCore.App 10.0.x` が表示されることを確認してください。.NETホストはDLL Appletとグローバルショートカットの両方で使用します。native Appletのランタイム要件は、そのAppletの配布方法に従います。

初回起動でEXEの隣に `settings.json` が作成されます。「設定」からフォームとJSONの両方で編集できます。ウィンドウの×は既定でトレイへ格納します。完全終了はトレイメニューの「終了」です。この動作は設定で変更できます。

AppDock内のテキスト入力では、スペルチェックを無効にしています。

メインウィンドウの位置・サイズ・最大化状態は自動保存し、次回起動時に復元します。最小化中は通常表示の位置・サイズを保持し、「起動時に最小化」の設定も優先します。モニターの取り外しや解像度変更で画面外になる場合は、現在の画面内へ補正します。

- **ホーム**: ピン留めしたウィジェット、実行中・エラーのApplet数、コマンド数、ピン留めしたコマンドとApplet一覧。
- **ウィジェット**: Appletが提供するウィジェットを一括管理。ホームへのピン留め、表示順、透過デスクトップ、モニター、9方向のアンカー／自由位置、文字の左右・上下揃え、サイズ・文字色・不透明度を設定できます。前面表示とデスクトップへの固定を選べます。「ドラッグで移動」から一時的に操作可能にし、完了・取消で確定します。保存・再読み込みは設定ページと同じ上部固定バーです。
- **Applet**: 検索付き一覧から選択。有効・無効、再起動、Appletが提供する画面と操作。詳細からそのAppletの設定・ショートカット・ログを直接開けます。
- **設定**: ホスト設定のカテゴリと、Applet名で検索できる個別設定。Appletを選ぶと「設定項目／ショートカットキー」を切り替えられます。設定項目も検索できます。選択式設定と動的なモニター一覧に対応。
- **ログ**: 直近500件、検索、レベルでの絞り込み。ファイルログは1MBで1世代ローテーション。
- **コマンドパレット**: 既定は `Ctrl+P` / `Ctrl+Shift+P`。`Ctrl+,` で設定を開きます。コマンド名・Applet名・IDで検索し、↑／↓キーで選択、Enterで実行、Escapeで閉じます。☆でピン留め、各行の↑／↓ボタンでピンの順番を変更できます。ピンと順番は操作時に保存します。

ページ移動は左ツールバーに集約しています。AppletページにはApplet一覧、設定ページには設定カテゴリとApplet別の一覧を表示し、ホームとログは広い表示領域を使います。

ビルトインコマンドの「再起動」（`appdock.restart`）と「終了」（`appdock.quit`）は、AppDock本体を再起動・完全終了します。コマンドパレット、ピン留め、ショートカット、トレイ表示・クリックへの割り当てに対応し、既定のキー割り当てはありません。どちらもAppletを停止してから終了し、再起動は保存済みの設定で起動し直します。単一EXE版は元の配布EXEから再起動します。

設定の「変更をすべて保存」は、表示中のAppletだけでなく、すべてのカテゴリの未保存変更をまとめて保存します。変更したカテゴリ・Applet名には印が付き、ページやAppletを切り替えても編集内容を保持します。保存バーはスクロール中も表示します。「変更を破棄して再読み込み」は全カテゴリの下書きを破棄します。JSONの構文や内容に誤りがある場合、Appletからの直接移動でもJSONを保持し、修正後にフォームへ切り替えられます。

Appletは同梱していません。初回起動時のApplet一覧は空で、必要なAppletをEXEの隣の `extensions` に追加して使用します。

「設定 → ショートカット」で、ホストとAppletが登録したコマンドにキーを割り当てられます。欄を選んでキーを押し、「保存」で確定します。Ctrl / Alt / Shiftとの組み合わせと、Pause・F1〜F24・文字キーなどの単独キーに対応し、1つのコマンドに5個まで登録できます。×で解除、Escapeで入力終了、Tabで次の欄へ移動します。同じキーの重複割り当ては保存時に拒否します。通常はAppDock操作中に有効で、修飾なしのキーはテキスト入力中に実行しません。

全体のショートカット一覧はAppletごとに分類し、「割り当て済み／未設定／競合・登録エラーあり」で絞り込めます。「AppDockのキー」ではホスト本体だけ、各Appletの「ショートカットキー」ではそのAppletだけを表示します。どの入口でも同じ編集データを使い、別Appletとのキー重複も相手の名前・操作名とともに表示します。起動中に取得したコマンドはApplet停止後も所属を保持します。再起動後など、まだ所属を取得できない保存済みコマンドは「未確認のコマンド」に表示し、割り当てを維持します。

コマンドの「グローバル」を有効にして保存すると、ほかのアプリを操作中やトレイ格納中にも使えます。`at365.watch.toggle` の既定キーは **Pause**、既定でグローバルです。Appletが実行中のときだけWindowsに登録し、停止・キー変更・解除・AppDock終了時に登録を解放します。キー入力欄を選択中は一時解除します。ほかのアプリとの競合などで登録できないキーは、設定画面とログに理由を表示します。元のWatchがPauseを登録している場合は、元Watchを終了するか割り当てを変えてください。既存の明示的なキー設定・解除状態は保持し、未設定のコマンドに既定値を補います。

「設定 → プロフィール」でユーザー名とアバターを変更できます。左下のアバターからも開けます。PNG / JPEG（5MB以下）を選択して「保存」すると、設定ファイルの隣に `avatar.png` を保存します。長辺256px以内のPNGに変換し、次の画像を保存すると同じファイルを上書きします。元画像や過去の画像は残しません。「画像を削除」を保存するとファイルも削除します。

## 「EXEひとつ」の意味

electron-builderの**portable**形式です。配布するアプリ本体はEXEひとつですが、起動時にElectronと.NETホストのアプリファイルをWindowsの一時フォルダへ展開します。.NETランタイムはPCの環境から読み込みます。展開せず直接実行する.NETの単一ファイルと同一の方式ではありません。設定は一時フォルダに保存せず、`PORTABLE_EXECUTABLE_DIR` を使って元のEXEの隣に保存します。

```text
任意の配置先/
├─ AppDock.at365.exe
├─ settings.json          一般・拡張・ショートカット・ピン・プロフィール設定
├─ avatar.png             アバターを設定した場合のみ。常に最新の1枚
├─ extensions/            追加拡張（初回起動で空フォルダを作成）
└─ .appdock/
   ├─ window-state.json   メインウィンドウの位置・サイズ・最大化状態
   ├─ chromium/           Chromiumのユーザーデータ
   ├─ logs/               ホスト・拡張ログ
   ├─ storage/            拡張固有の永続データ
   └─ secrets/            暗号化したトークン等
```

設定項目は1つのJSONに集約します。トークン等の秘密情報と処理データは設定JSONに混ぜず、上記の専用領域へ保存します。Secrets APIはElectron safeStorageによるWindowsの暗号化を利用し、同じWindowsユーザーでの利用を前提にします。EXEをコピーしても認証情報の別PCへの移行は保証されません。

JSONはUTF-8の標準JSONです。コメントを含むJSONCには対応していません。保存は一時ファイルから置換します。手動編集は起動中にも反映されます。壊れたJSONは上書きせず、起動中は最後の有効な設定を維持してログに記録します。起動時に壊れていた場合は、場所とエラーを表示して終了します。編集中に他の場所で設定が変更された場合は、古い内容による上書きを拒否します。

0.1.0の設定ファイルもそのまま読み込めます。新しい項目は既定値で補われ、次の保存で書き込まれます。`shortcuts` はコマンドIDとキー文字列の配列、`globalShortcutCommands` はグローバルに登録するコマンドID配列（`[]` で全解除）、`pinnedCommands` は表示順のコマンドID配列、`profile` は `name` と `avatar`（`"avatar.png"` または `null`）です。[設定例](settings.example.json) を参照してください。

## 開発

ウィジェットのSDK、描画方式、配置設定とWatch DLLへの移行は[ウィジェット開発ガイド](docs/widgets.md)を参照してください。AppDock 0.10.0以降では日時を表示側で更新し、同じモニター・階層の透過画面を共有します。

Applet画面と設定画面の左側の一覧は、同じ背景・余白・選択表示で名前を左揃えに表示します。左パネルの右端をドラッグすると幅を変更でき、両画面で共通の幅を使います。変更した幅は自動保存されて次回起動時も復元します。境界にフォーカスして左右キーでも調整できます。幅は220～480pxで、小さいウィンドウでは表示幅を抑えます。幅の保存先は `.appdock/chromium/` 内のブラウザ保存領域です。ショートカット設定のコマンド検索と「すべて／割り当て済み／未設定／競合・エラー」の切り替えボタンは同じ行に表示します。表示領域が足りない場合は折り返します。

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

## Appletを書く

[Applet実装ガイド](docs/applet-development.md)に実行方式の選択、最小C#実装、設定・コマンド・終了処理、時計で得た注意点と検証手順をまとめています。[AppDock実装ガイド](docs/host-development.md)は、必要なAPI・設定・React UIをホストへ足す際の変更先と注意点です。個々のAPIと通信は[Applet API](docs/extensions.md)を参照してください。

外部AppletはEXEの隣の `extensions\<Appletフォルダ>\extension.json` と実装ファイルで構成します。追加・削除後はホストを起動し直してください。新規Appletは既定で無効です。IDが重複した場合は先に見つかったAppletを優先し、重複をログに記録します。

ローカルの信頼できる拡張を対象にしています。拡張はユーザー権限で動く.NET/Nodeコードです。別プロセス化は障害の分離であり、OSの権限制限ではありません。manifestのcapabilitiesはHost APIの使用宣言・検査であり、拡張の直接のファイル操作やネットワーク通信を制限する仕組みではありません。React画面はNodeを公開せず、画面に渡せる拡張UIはテキスト・状態・コマンドに限定しています。

## 既存3アプリの移行

**Watchの時計をApplet.Watch.at365として実装しました。** 隣の `../Applet.Watch.at365` で作成し、その `publish/Applet.Watch.at365` をEXEの隣の `extensions` に置くと使えます。「Applet」で有効にし、詳細の「設定を開く」または「設定 → Applet別の設定 → Applet.Watch.at365」で表示・モニター・位置・余白・文字サイズ・不透明度などを設定します。表示／非表示コマンドにも対応します。

GmailChecker、WallpaperSlideshow、Watchの時計以外の機能は移行していません。既存アプリのソースや設定も変更していません。

[移行メモ](docs/migration.md) に現行コードを確認した分割案をまとめました。既存EXEを単に起動する方式ではなく、CoreロジックをSDK対応DLLに移し、設定・通知・トレイ等をホストに集約する方針です。Watchのオーバーレイと壁紙のWorkerWのようなWindows固有の表示は、ネイティブ表示処理を残す必要があります。

## 配置

`deploy.bat` はPowerShell 7（`pwsh.exe`）を使用します。

`deploy.bat "配置先の既存フォルダ"` でEXEのみコピーします。引数省略時は `deploy.local.txt` の先頭行を使います。`deploy.local.txt.example` を参考にしてください。設定や追加拡張はコピーしません。配置先で実行中の場合は先に終了してください。既存EXEを置換する操作なので、配置はユーザーが必要な時に実行してください。

## 公式仕様

- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security)
- [electron-builder portable](https://www.electron.build/nsis/)
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)

署名証明書は設定していないため、このビルドは未署名です。

## v0.5.0: 遅延開始・バージョン確認・画像付きパネル

すべてのAppletに「開始までの秒数」を設定できます。有効化・再起動から指定秒数後にプロセスを起動し、待機中もAppDockの設定は編集できます。0で即時、最大86400秒。無効化・AppDock終了で取り消し、待機中の秒数変更で待ち直します。実行中の変更は次回から適用します。manifestの既定値がない既存Appletは即時起動のままです。開始待ちの詳細画面には予定時刻と「今すぐ開始」が表示されます。

ホストの画面下部、Appletの詳細画面に「更新を確認」を追加しました。クリック時だけGitHubの最新正式リリースを問い合わせます。公開リリースがない場合、通信エラー、更新ありを区別し、更新があればリリースページを開けます。設定・画像・ログは問い合わせに含めず、公開リポジトリ名と標準HTTPヘッダーだけを送信します。自動更新は行いません。

`minimumHostVersion`を宣言したAppletは起動前にホストのバージョンを確認し、非対応ならエラーを表示します。画像付きパネルとJSON入力設定を追加し、[WallpaperSlideshow](../Applet.WallpaperSlideshow.at365/README.md)の履歴をAppDock内で表示できます。既存のAPI v1、Applet設定・コマンドIDは維持しています。

## v0.6.0: モニター設定フォーム・履歴ボタン

構造化一覧設定に対応しました。WallpaperSlideshowの複数ソースフォルダー・表示モード・タイル枚数・上下左右のPaddingをモニターごとのフォームで編集できます。旧JSON設定も読み取り、フォルダー選択・項目追加・並べ替え・削除に対応します。

manifestで宣言したコマンドはロード前からショートカットを設定できます。明示的な開始コマンドで即時ロードでき、旧コマンドIDは別名として維持できます。履歴画像のボタンやモニター切替は一般コマンドへ登録せず、専用のパネル操作で実行します。

履歴画像は専用キャッシュからローカルで表示し、通信量による画質・解像度の引き下げを行いません。画像プレビューとパネル上部のモニター切替に対応しました。本体・Appletの手動更新確認は継続しています。

## v0.7.0: コマンドのトレイ表示とクリック設定

「ショートカット」またはApplet別の「ショートカットキー」で、各コマンドの「トレイに表示」をONにすると、右クリックメニューへ追加します。既定はすべてOFF。AppletのコマンドはAppletごとのサブメニュー、AppDockのビルトインコマンドは最上位にフラット表示します。上からApplet、セパレータ、ビルトイン、セパレータ、固定の「設定…」「終了」の順に並び、空の区画と余分なセパレータは表示しません。停止中のコマンドは無効表示、明示起動できる宣言コマンドはそのまま実行できます。変更は保存直後に反映します。

「一般」の「トレイクリックのコマンド」で、クリック時に実行するコマンドを選べます。既定は新しいホストコマンド`appdock.open`（AppDockを開く）。ショートカット・ピン留め・トレイ表示にも使用できます。クリック先が利用できない場合はログに記録してウィンドウを開きます。右クリックの「設定…」「終了」は常に表示します。

JSONでは`trayCommands`に表示するコマンドIDの配列、`host.trayClickCommand`にクリック時のIDを保存します。旧設定は既定値で読み込みます。未インストールの旧サンプル`appdock.welcome` / `appdock.dotnet-demo`の設定・ショートカット・ピン留め等は起動時に整理し、`appdock.dotnet-demo.refresh`が未確認のコマンドとして残る問題を解消します。明示的にインストールしたテスト用サンプルは保持します。

`dev.bat run test:tray`で隔離profileの設定フォーム、再起動後の保持、実Trayのメニューとクリックイベント、停止時の扱いを検証します。

## v0.8.0: ハードウェアアクセラレーション

「一般」の「ハードウェアアクセラレーション」で、AppDockの画面描画にGPUを使用するか切り替えられます。既定はON。変更を保存後、トレイの「終了」でAppDockを完全終了し、起動し直すと反映します。ウィンドウを閉じてトレイへ格納するだけでは反映されません。

JSONでは`host.hardwareAcceleration`に`true` / `false`を保存します。項目がない旧設定はONで読み込みます。OFF時はElectronの初期化前に無効化します。Applet独自の描画設定は変更しません。`dev.bat run test:hardware-acceleration`でON→OFF→ONの保存と再起動後のElectron実状態を確認します。

## v0.9.0: トレイのシングル・ダブルクリック

「一般」で「トレイクリックのコマンド」と「トレイダブルクリックのコマンド」を別々に設定できます。ダブルクリックの既定は未設定。未設定の場合は従来どおりシングルクリックを即時実行します。

ダブルクリックに割り当てると、Windowsのマウス設定に応じた判定時間だけシングルクリックを待機させます。判定時間を取得できない場合は、Windowsの既定値500ms（0.5秒）を使用して警告を記録します。ダブルクリックが来れば待機中のシングルを取り消し、ダブル側だけを実行します。保存後すぐ反映し、再起動は不要です。JSONの`host.trayDoubleClickCommand`はコマンドIDまたは`null`（未設定）です。

## v0.9.1: Appletの表示名

各Appletのextension.jsonにdisplayNameを指定できるようになりました。ホスト画面・設定・コマンド候補・トレイには表示名を使い、省略時はnameの先頭のApplet.を自動で除去します。既存の設定・ショートカットを維持し、表示名・元の名前・IDのいずれでも検索できます。manifest更新後はAppDockを再起動してください。
