# AppletのためにAppDockへ機能を追加する

AppDock v0.3.1の実装を基準に、どの層へ変更を入れるかと検証方法をまとめます。Appletを作り始める手順は[Applet実装ガイド](applet-development.md)、通信契約は[Applet API](extensions.md)を参照してください。

## まず変更範囲を決める

0.17.1のWebアカウント設定連携はhost-apiのサービス経由で自身の宣言済みboolean/静的selectだけを公開し、WebAccountControllerがローカルUIの送信元を検証します。既存SettingsStoreの保存・変更通知を再利用し、停止時に購読を解除します。APIの詳細は[WebアカウントAPI](web-accounts.md)を参照してください。

Applet名の画面表示にはsnapshotの`displayName`を使用します。manifestの任意の`displayName`を優先し、省略時は`src/shared/applet-display-name.ts`で`name`の先頭の`Applet.`を除去します。元の`name`と`id`を識別・保存に使う契約は維持し、検索には表示名・元の名前・IDを含めます。manifestの検証、snapshot、renderer、トレイ、ログを一緒に整合させてください。

ホストのビルトインコマンドは`src/shared/commands.ts`の`hostCommands`へ登録し、`src/main/index.ts`の`executeCommand`で実行します。`appdock.restart` / `appdock.quit`はウィンドウを表示せず`quitHost`へ渡し、既存の`before-quit`でキー登録・Applet・設定監視・トレイを終了します。再起動予約は一度だけ行い、portable版は`PORTABLE_EXECUTABLE_FILE`を再起動先として、作業ディレクトリも元のEXEの隣へ移します。開発版はElectronの既定の起動引数を維持します。`dev.bat run test:host-commands`で実プロセスの再起動と終了、保存済み設定、Appletのdeactivateを確認できます。引数に配布EXEを指定するとportable版も検証します。

設定項目の追加だけなら、Appletのmanifestと設定読み取りを追加します。boolean / number / string / select、説明、範囲、動的選択肢はすでに対応しています。コマンド・ピン・ショートカットも登録から利用できます。

機能固有の時計描画、画像処理、WindowsフックなどはAppletへ置きます。複数Appletで共有したい操作、ホストの保存・通知・アカウント管理、ユーザー向けの共通画面はHost APIやReact UIを拡張します。Appletのために任意のElectron APIやファイル操作をrendererへ公開しません。

0.12.0の[WebアカウントAPI](web-accounts.md)では、ホストがWebContentsView・独立永続セッション・限定IPC・停止時の破棄を管理します。Gmailのセレクターと新着判定はApplet側です。Node APIは`webAccounts.start/open/read/report`で、.NET SDKのラッパーは提供していません。0.13.0では`report`の一時UIデータと、信頼済みローカルUIの`viewport`による表示領域変更・非表示を追加しています。

0.13.1では、非選択Viewを可視・実寸のまま非表示専用Windowへ保持し、rAF/レイアウトが止まらないようにします。選択中だけ操作Windowへ移し、停止/異常終了で背景Windowも破棄します。`test-background.cjs`は外部状態のfetch結果をページ自身のrAFで反映するため、テストがDOMを直接更新する場合では見逃した停止を検証できます。実Googleサーバーとの同期は別確認です。

0.14.0はcycleと限定UIのitemOpener呼び出し、アカウント別soundの保存/選択/試聴を追加。自身のAppletのローカルshortcutsをUI/WebContents双方で処理し、Nodeの循環コマンドへ接続します。Gmailの初期Ctrl+Tab/Ctrl+Shift+Tabはglobalにしません。操作Windowの位置・サイズ/最大化は既存WindowStateStoreで保存し、Gmailの高さ640pxを復元下限にします。静的な境界/ライフサイクル回帰とGmailのtest-ui-features.cjsを併用し、音は無音WAVで実プレーヤーまで確認します。

| 追加したいもの | 主な変更先 |
| --- | --- |
| Applet向けHost API | `src/main/core/host-api.ts` → .NET SDK/Runtime・Node SDK |
| 新しいmanifest／設定の種類 | `src/shared/contracts.ts`、`src/shared/setting-definitions.ts`、`src/main/core/extensions.ts`、renderer |
| 永続的なホスト設定 | `src/shared/contracts.ts`、`src/shared/settings-schema.ts`、`src/main/core/settings.ts`、設定フォーム・設定例 |
| Reactからの操作 | `DockApi` → `src/main/preload.ts` → `src/main/index.ts`のIPC → renderer |
| 表示する状態・パネル | 共有型、Host APIの検証、ExtensionSnapshot／HostSnapshot、renderer |
| 新しいプロセス／ライフサイクル | `src/main/core/extensions.ts`、各ランナー、ビルド・package.json・停止テスト |

## Host APIを追加する手順

1. **入出力と失敗条件を先に決める。** `host.<機能>.<操作>`、JSONで送れる引数、戻り値、必要なcapability、サイズ上限、キャンセルと停止時の挙動を[API仕様](extensions.md)へ記述します。通常のRPCは15秒以内です。長時間の処理は開始と状態確認に分け、UIを待たせ続けない設計にします。
2. **mainで入力を検証する。** [createHostApi](../src/main/core/host-api.ts)のswitchへ処理を追加します。`ExtensionInstance`から呼出元IDを取得し、引数の任意IDを信用して他Appletの設定・秘密領域へ書き込みません。型・範囲・URL・パス・キー・capabilityを処理前に確認します。rendererやSDKの型だけでは実行時の検証になりません。
3. **保存と表示更新をつなぐ。** 設定はSettingsStore経由で更新し、全JSONの独自書き込みを避けます。状態をメモリへ追加した場合はsnapshotへ含め、`changed()`またはmanagerのchangedイベントでrendererへ通知します。既存の変更通知はまとめて送られます。React側では更新が届くまで待つ必要があります。
4. **SDKへ公開する。** .NETは[Contracts.cs](../dotnet/AppDock.SDK/Contracts.cs)のインターフェースと型、[ExtensionContext](../dotnet/AppDock.Runtime/ExtensionContext.cs)の実装を対応させます。Nodeは[NodeExtensionContext](../src/main/node-worker.ts)とactivate時に渡すcontextの実装を対応させます。片方だけ対応する場合はAPI仕様に明記し、未対応なのに型だけ存在する状態を避けます。
5. **購読やリソースの寿命を定める。** 解除用IDisposable／関数を返し、deactivateと通信断で解除します。.NETのコマンド／設定変更を直列化する `commandLock`を保持したまま、同じロックを再取得する処理を呼ばないようにします。ホストへ要求するだけなら別方向のRPCで返答を処理できますが、逆方向の処理完了を相互に待つ循環を作らないでください。
6. **互換性を記録する。** 既存ID・メソッド名・設定名は維持します。新APIを使うAppletのREADMEには必要なAppDockバージョンを記載します。v0.5.0ではmanifestの`minimumHostVersion`で起動前に最小ホストバージョンを確認します。旧ホストにはこの検証がないため、新機能を使うAppletの配布時にも必要バージョンを明記してください。APIの能力交渉はありません。`apiVersion: 1`だけで旧ホストが新APIを提供すると判断しません。既存引数の意味やSDKの契約を壊す場合は、移行方法とAPIバージョンを別途設計します。

新APIがAppletプロセスからだけ使われる場合、preload/renderer IPCへの追加は不要です。Applet通信とReact用IPCは別の境界です。

時計で追加した `host.settings.options` が、この手順の具体例です。C#の `SettingOption(Label, Value)` は共通のJSON設定でcamelCaseへ変換され、Nodeと同じ `{label, value}` を送ります。mainはsettings capability、宣言済みのdynamic select、重複・長さ・件数を検証してから `ExtensionInstance.settingOptions` を更新し、変更通知を送ります。Reactはsnapshotの候補を使い、保存された未接続の値も別optionとして保持します。候補の更新ではsettings.jsonを書き換えません。

## React UIとIPCを追加する手順

0.16.0のWebアカウント管理は`web-accounts.ts`の原子的な配列保存と`web-account-preload.ts`の限定IPCを使います。moveはselected/UUIDを変更せず、setMonitoringは遅いworker reportも抑制します。monitoringResetsはreadで一度だけ渡します。`web-account-avatar.ts`はURLとストリーム上限を検証し、0.16.1のControllerが当該アカウントのsession/credentials:includeのnet.requestとnativeImageの64px変換を行います。取得/再試行/破棄の寿命をControllerに閉じ、画像バイトはUI snapshotだけへ渡します。Gmailのtest-accounts.cjsはオフラインの画像/2アカウントで並べ替え・個別監視・設定保持・表示を確認します。

window-rendering.tsはapp.readyより前にWindowsのNativeWinOcclusionを無効にし、既存feature引数を保持します。0.15.2のweb-page-activity.tsはkeepActiveのobserveOriginでobserver.readyを待ち、背景のアクティブ状態を30秒ごとに更新します。native focus中はエミュレーションを解除します。同一文書の移動では状態を保ち、別文書のメインフレーム遷移/破棄・認証originで周期/250ms待機/接続を解除します。別Debugger/DevToolsへ干渉せず、URLや認証値をログに出しません。Gmailのtest-native-background/probe-native-startupは通常のElectron起動を使い、DOM準備後に受信処理が遅れて始まる条件も検証します。Playwrightの自動focus emulationを背景更新の証拠として使わないでください。

0.15.0の設定「バージョン情報・更新」はSettingsPageのaboutカテゴリです。保存フォームを持たず、既存draftは保持します。HostSnapshot.runtimeでElectron/Chromium/Node/OS・アーキテクチャを受け、既存VersionCheckとcheckUpdates/openReleasesを再利用します。表示しただけでは問い合わせず、手動操作時だけ通信します。最終確認時刻はページ内の結果で、永続設定ではありません。Gmailのtest-ui-featuresでライト/ダーク/システムの連動、更新あり/最新版/未公開/未設定/HTTPエラーをオフライン検証します。

ユーザーがAppDock画面から操作する機能だけを対象にします。

Appletと設定の一覧は共通の`.sidebar`／`.sidebar-extensions`スタイルを使います。幅はAppで一度だけ呼ぶ`useAppletSidebar`の状態と既存の`appdock.applet-sidebar-width`で共有し、各画面で独立した幅を持たせません。設定一覧はportalでshellの左パネルへ表示しますが、SettingsPage自体は画面移動時も保持して未保存のdraftを失わないようにします。ショートカットの検索と状態フィルターは`.shortcut-filters`で一行にそろえ、表示領域不足時のみ折り返します。状態フィルターは排他的な4つのボタンで、選択状態を`aria-pressed`へ反映します。`scripts/applet-sidebar-ui-test.cjs`と`scripts/navigation-ui-test.cjs`で共通幅・再起動・編集保持・絞り込みとキーボード操作・両テーマと狭い画面の配置を確認できます。

1. [共有契約](../src/shared/contracts.ts)へ表示データや `DockApi`メソッドを追加します。秘密情報・プロセス内部オブジェクト・任意コードは渡しません。
2. [preload](../src/main/preload.ts)に、固定したIPCメソッドの橋渡しを追加します。任意のチャンネルや任意のElectron操作を呼べる汎用口は作りません。
3. [mainのregisterIpc](../src/main/index.ts)の既存handleラッパーで受けます。送信元webContents・mainFrame・`appdock://host/index.html`の確認を維持し、引数も実行時に検証します。
4. [React](../src/renderer/main.tsx)で読み込み・操作・保存・エラーを実装します。設定編集はdraftとrevisionを使い、他の変更が起きた際の古い内容による上書き拒否、画像の保存／復元処理を保ちます。
5. 購読はunmount時に解除し、UIテストでは通知の到着まで待ちます。Applet名・項目名・単位・説明を表示し、ユーザーが判断に使わない通信名やプロセス情報を設定画面へ出しません。

`nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`、CSP、外部navigationの禁止を維持します。Appletから提供するパネルはReactでテキストとして描画し、生HTMLやスクリプトを受けません。

メイン画面の`BrowserWindow`は、`webPreferences.spellcheck: false`でElectron内蔵スペルチェックを無効にします。画面作成前に共有セッションも`session.defaultSession.setSpellCheckerEnabled(false)`で無効にします（[Electron Session API](https://www.electronjs.org/docs/latest/api/session#sessetspellcheckerenabledenable)）。新しい入力欄にも共通で適用されるため、フォームごとの指定や設定JSONの項目追加は不要です。

## 設定スキーマと保存を変更する場合

- ホストの永続設定は `Settings`、`createDefaultSettings`、`parseSettings`、設定フォーム、[settings.example.json](../settings.example.json)を一緒に更新します。古いsettings.jsonに項目がない場合の既定値を用意し、実利用の設定ファイルをビルド時に変更しません。
- Appletの設定定義を増やす場合は `SettingDefinition`、`parseSettingDefinitions`、`validateSettingValue`、rendererの入力部を揃えます。main側IPCとHost API双方で同じ検証を使い、拒否された保存で既存値を失わないことを確認します。
- manifestの既定値とSDK読み取り時のfallbackを一致させます。手動JSON編集は汎用スキーマで読み込み、個別Appletの範囲を自動的にすべて検査するわけではありません。Applet側の補正も必要です。
- 動的selectの選択肢はExtensionInstance／snapshotのメモリ上で管理し、設定JSONへ候補一覧を毎回保存しません。現在ない選択値も保持し、代替動作はAppletへ任せます。
- SettingsStoreの原子的保存、revision確認、ファイル監視を利用します。秘密情報はSecrets、処理データはStorageへ分けます。
- 既存の内部名 `extensions` / `extension.json` / `IAppDockExtension`は画面の呼称Appletと区別して維持します。表示名を揃えるためだけに保存形式を変更しません。

## 時計を載せるために追加した機能

| 追加 | 実装場所と意図 |
| --- | --- |
| `runtime: native` | [ExtensionManager](../src/main/core/extensions.ts)。専用EXEをcwd・標準入出力付きで起動し、Node／DLLと同じコマンド検証・停止管理を使う |
| .NET接続処理の再利用 | [AppDock.Runtime](../dotnet/AppDock.Runtime/AppletSession.cs)。DLLランナーから接続・SDK実装を抽出し、WPF Applet自身のSTAメッセージループと両立する |
| 設定変更の購読 | [SDK](../dotnet/AppDock.SDK/Contracts.cs)、[Runtime](../dotnet/AppDock.Runtime/ExtensionContext.cs)、[Node](../src/main/node-worker.ts)。表示を再起動なしで更新する |
| 動的select・説明・刻み幅 | [共有型](../src/shared/contracts.ts)、[定義と値の検証](../src/shared/setting-definitions.ts)、[Host API](../src/main/core/host-api.ts)、React。接続中モニターを選択できるようにする |
| ローカルキャッシュの更新 | .NET SetAsync／Node settings.set。コマンドで保存した直後に新しい状態を読めるようにする。購読発火の保証とは分ける |
| 外部Appletの配布 | 時計はAppDock EXEへ固定同梱せず、EXE隣のextensionsへ配置。ホスト更新とApplet更新を別々に行える |

この変更で時計固有のウィンドウ、DeviceName、DPI、位置計算をAppDock mainへ持ち込んでいません。動的な選択肢の意味や代替先はAppletが決めます。別の画面付きAppletもnative接続と共通の設定フォームを利用できます。

## 検証と成果物を更新する

Node.jsとpnpmのグローバルインストールは不要です。プロジェクトの `setup-tools.bat` で `.tools` に準備し、下記のpnpmコマンドは `dev.bat` 経由で実行できます。直接のNodeコマンドは `dev.bat exec node ...` を使います。バージョンは `toolchain.json` で指定します。

グローバルホットキーは `src/main/core/global-hotkeys.ts` が設定とAppletの稼働状態に追従し、同梱.NETホストの `--hotkeys` モードがWindowsのRegisterHotKey / WM_HOTKEYを扱います。PauseはElectronのaccelerator対象外のため、Windows登録に統一しています。キー記録中は一時解除し、設定画面に登録結果・競合理由・再試行ボタンを表示します。`pnpm run test:hotkeys` で専用profileの時計Appletを使い、Windows入力、競合、再割り当て、停止と終了時の解除を確認します。先に元WatchなどのPause登録を解除してください。

変更に合う検証だけを選び、通ったものと未検証事項を記録します。

Windows portable起動用EXEの`FileDescription`は、electron-builderが`package.json`の`description`から生成します。タスクマネージャーの表示名を本体とそろえるため、この値は`productName`と同じ`AppDock.at365`を維持します。発行後はportable起動用EXEと`win-unpacked`内の本体の両方で`FileDescription`を確認してください。起動用EXEは32ビット、本体は64ビットです。

| 変更箇所 | 確認するもの |
| --- | --- |
| 型・React・main | `pnpm run typecheck` / `pnpm run build` |
| SDK・Runtime | `pnpm run build:dotnet`、該当Appletの再ビルド。SDKとRuntimeを参照するnative EXEも再publish |
| 設定・RPC・ライフサイクル | `pnpm test`。[core](../tests/core.test.cjs)、[lifecycle](../tests/lifecycle.test.cjs)、[Applet設定](../tests/applet-settings.test.cjs)の該当箇所 |
| UI・保存・コマンド | `pnpm run test:ui` / `pnpm run test:preferences`、該当AppletのUIテスト |
| 配布・依存ランタイム | `pnpm run dist`、完成EXEを別テストフォルダーへコピーしたsmoke |

API追加のテストは、正常系に加え、capability不足、不正型／範囲、他Applet領域への指定、停止後の要求、保存失敗を変更内容に応じて確認します。プロセス関連は無効化・再起動・ホスト終了・異常終了と、他Appletが継続することを確認します。Nodeと.NETに共通APIを足した場合は双方の実プロセスで往復させます。

`pnpm run dist`はDLLランナーのRuntime/SDKを含めてpublishします。外部native Appletの再publishは行わないため、そのAppletの発行も必要です。開発版の成功を完成EXEの成功と扱わず、次の組み合わせで確認します:

```powershell
# AppDockルートで
node scripts/smoke.cjs publish/AppDock.at365.exe
# 時計Appletも接続する検証
node scripts/smoke.cjs publish/AppDock.at365.exe ../Applet.Watch.at365/publish/Applet.Watch.at365
# Applet.Watch.at365ルートで、ビルド済みホストのUIを検証
node scripts/test-ui.cjs ../AppDock.at365/publish/win-unpacked/AppDock.at365.exe
```

テスト設定は専用profileへ保存します。設定保存を検証するために実利用のsettings.jsonを触らず、フック・壁紙・ロック等のOS全体に作用する処理は、そのテストに必要な範囲だけ扱います。時計のGUIテストが別AppletのOS動作まで検証するわけではありません。

Windows SDKへのアクセス制限がある環境はビルド未確認として扱い、許可された実行環境で再確認します。実行中EXEの書き込みロックがあれば、その配置先を通常終了するか別出力先を使います。無関係な既存アプリを止めません。

完成後は[ドキュメント方針](documentation.md)に従い、必要なホストバージョンと利用者が配置するファイルをREADMEへ、開発・検証の手順をDEVELOPMENTまたはこのガイドへ、実機条件と限界・結果・成果物のVersion／SHA256をVERIFICATIONへ記録します。Gitではsourceとdocsを管理し、publish・artifacts・設定・秘密情報は除外します。

## v0.6.0の追加契約と検証

ロード前コマンドは`parseDeclaredCommands` / `ExtensionManager.commandCatalog`で検証・公開します。通常のruntimeコマンドを優先し、起動可能な宣言だけ明示実行で有効化・即時起動します。互換性チェックと起動キューを共有し、遅延タイマーを取り消します。旧IDの別名は保存されたホットキーを維持し、新規候補に重複表示しません。

構造化フォームは`ObjectListSetting`と共有の`object-list`変換・設定検証で扱います。旧JSON・Folder・数値enum、モニター別Padding、未知のデータの保持を回帰確認します。フォルダー選択は既存のIPC呼び出し元検証を通します。

履歴専用操作は一般コマンドとは独立した`panel.action`です。現在のパネル（actions / tabs / images）にあるIDだけ許可します。ローカル画像は`panel-images.ts`で実パスの包含を確認し、CSPを緩めず`appdock://host/panel-images`で配信します。ホスト管理外のファイルや外部画像URLは受け付けません。

[panel-imagesのテスト](../tests/panel-images.test.cjs)は大きなローカル画像・キャッシュ外拒否・古いボタン拒否を確認します。[ライフサイクル](../tests/lifecycle.test.cjs)はロード前宣言・旧ID・同時開始・互換性・遅延解除を確認します。SDK既存コンストラクターは維持し、新機能のminimumHostVersionは0.6.0です。

## v0.7.0のトレイコマンド

トレイのグループは`extensionId: null`でビルトイン、AppletのIDでAppletを区別します。表示名には依存せず、`index.ts`はAppletサブメニュー→ビルトインの最上位項目→固定の設定/終了の順で構成します。セパレータは空でない区画の末尾だけに追加し、先頭や連続したセパレータを防ぎます。選択済みの設定/終了コマンドもビルトイン区画に含み、固定の末尾2項目は維持します。

表示可否はホスト設定`trayCommands`（既定`[]`）、クリック先は`host.trayClickCommand`（既定`appdock.open`）で管理します。`tray-commands.ts`はコマンドカタログとユーザーの選択からメニューを構成し、従来の`Tray.Add`はラベルの提案としてのみ参照します。設定保存・外部編集・Appletのコマンド置換・状態変更で再構成します。保存された未取得のIDは保持し、利用不可の宣言は無効表示、`activateOnExecute`は共通の実行経路を利用します。

トレイ、IPC、グローバルキーはmainの`executeCommand`でホスト/Appletを振り分けます。`appdock.open`はウィンドウ表示、検索・設定はrenderer通知。トレイは`click`だけを処理し、`double-click`に追加の実行を登録しません。クリック先の失敗はログとウィンドウ表示で復旧し、固定の「設定…」「終了」で管理画面への入口を確保します。

未インストールの旧サンプル設定はdiscover後に整理して既存の原子的な保存を使います。インストール済みfixtureとほかの未知コマンドは保持します。[回帰テスト](../tests/tray-commands.test.cjs)、[実トレイUIテスト](../scripts/tray-commands-ui-test.cjs)、完成EXEのsmokeで検証します。Applet API v1とSDKは変更しません。

## v0.8.0の描画設定

`host.hardwareAcceleration`はboolean、既定true。単一インスタンスのロック取得後、`app.whenReady()`より前に同じ`SettingsStore`で設定を読み込み、falseの場合だけ`app.disableHardwareAcceleration()`を呼びます。不正な設定は既存のエラー表示で起動を中止し、ファイルを保持します。設定保存・外部編集による変更は次の完全起動で適用し、実行中のGPUプロセスへ変更を加えません。

一般設定の説明には完全終了・再起動が必要なことを表示します。[設定回帰](../tests/preferences.test.cjs)は旧設定補完・OFF保持・不正型を確認し、[UIテスト](../scripts/hardware-acceleration-ui-test.cjs)は3回の起動でON→OFF→ONを実測します。GPU情報取得後の`app.isHardwareAccelerationEnabled()`とOFF時の`getGPUFeatureStatus().gpu_compositing`を確認します。Applet APIとSDKは変更しません。

## v0.9.0のクリック判定

`host.trayDoubleClickCommand`はコマンドIDまたはnull、既定null。v0.7.0のclickのみの処理を`TrayClickDispatcher`へ置き換え、Windowsのclick→double-click通知で後者が来たときに前者の待機を取り消します。未設定時は即時実行。設定変更・メニュー表示・終了では待機を取り消し、非同期の判定時間取得が後から完了しても復活させません。

ダブル割り当て時だけ.NETホストの`--double-click-time`で`GetDoubleClickTime`を取得します。設定変更を毎クリックで読み、Windows自体の設定は変更しません。取得中の時間を差し引き、通知の順序競合を避ける25msの余裕を加えます。取得失敗はwarnログに記録し、Windowsの既定判定時間500msを使います。`DEFAULT_DOUBLE_CLICK_TIME_MS`をログ側と`TrayClickDispatcher`側で共有し、待機には同じ25msの余裕を加えます。SDK/Runtime/Applet APIは変更しません。

[クリック回帰](../tests/tray-clicks.test.cjs)は即時実行、単クリック待機、ダブル時の単クリック取消、取得完了前の取消、複数単クリック、メニュー・設定・終了の取消、取得失敗を確認します。[トレイUIテスト](../scripts/tray-commands-ui-test.cjs)は実Trayイベント、別コマンドの実行と重複抑止、Windows時間取得、再起動後の保持を確認します。

0.16.3はWebアカウントの仮名とtemporaryNameフラグを保存し、観測accountNameで仮名だけを一度変更します。cycleはアクティブな操作Windowの選択中WebContentsに入力フォーカスがある場合だけ、新しいViewへ引き継ぎます。別Window・ローカル入力欄・非表示/最小化にはフォーカスを移しません。詳細と旧保存形式の互換性は[WebアカウントAPI](web-accounts.md)を参照してください。

0.16.4のportableランチャーは更新間で実行パスを固定し、tray-identity.tsのUUID v5と併せてWindowsの通知領域の識別を維持します。ビルドはbuild-portable.cjsを経由し、使用中の資産を削除しないkernel lease/gateをportable.nsiで扱います。内部のビルダー連携と再起動/二重起動/設定保持試験は[開発ガイド](../DEVELOPMENT.md)を参照してください。タスクバーのAppUserModelId/元EXEの再起動先とは別の仕組みです。

## GmailChecker対応（0.11.0）

- `node-worker.ts`: `ui.pickFile`、`audio.play`、`tray.attention`、通知オプションを追加。ファイル選択だけRPC期限を5分に拡張。
- `core/host-api.ts`: capabilityと引数を検証。通知クリックは所有Appletと起動世代を照合。
- `core/sounds.ts`: 上限付き順次再生。RIFF/WAVE確認、sandbox有効の短命な非表示renderer、停止・再起動時の中止。
- `core/extensions.ts` / `index.ts`: 各Appletのattentionを集約し、共通トレイの印とツールチップへ反映。停止・異常終了時は解除。
- `renderer/main.tsx`: タブのアクセシビリティ名をモニター専用から一般パネル向けに変更。

既存API v1/.NET Appletとの互換を維持します。ホスト回帰は`tests/notification-services.test.cjs`、現在の実Electron/Nodeの統合検証は[Gmailの検証スクリプト](../../Applet.Gmail.at365/scripts/test-gui.cjs)を参照してください。

## Appletページとリボン（0.18.0）

契約・検証手順は[Appletページとリボン](applet-pages.md)。shared/applet-pages.tsがmanifestとリボンID、settings-schema.tsが互換性と保存検証、core/applet-pages.tsが移動可能なUI Viewと表示先、renderer/RibbonSettings.tsxが下書き編集を担当します。WebアカウントIPCはUIのWebContentsに結び付け、本体ページの領域・overlay・最小化/背景parkを独立して扱います。

0.19.0はリボンを上寄せ/下寄せの2グループとして描画し、共有settings-schemaでseparator登録と参照を検証します。AppDock本体のキー設定は「Applet別の設定」の先頭へ移動し、既存の下書きとコマンド所属処理を使います。移行とGUIは[Appletページとリボン](applet-pages.md)を参照してください。

0.20.0はWebアカウントのNode navigateコマンドと、外部リンク確認を自身のboolean設定へ保存するexternalLinkSettingを追加します。契約と移行は[WebアカウントAPI](web-accounts.md)を参照してください。


## Applet設定パネルの共用

- `useSettingsEditor.ts`は`App`で一度だけ生成する編集セッションです。フォームとJSON、revision/dirty、プロフィール画像、設定検証、再読込、保存を両ページで共有します。既存SettingsStoreのrevision付き保存を使い、外部変更と競合した下書きを上書きしません。
- `AppletSettingsPanel.tsx`は「設定項目／ショートカットキー」の切替と既存`AppletSettings`/`ShortcutsEditor`をまとめます。`SettingsActions.tsx`の保存・再読込操作とエラー表示も両ページで共用し、保存/破棄対象は全編集内容です。Applet API/manifest/設定JSONの追加はありません。
- `ExtensionDetail`はヘッダーと共通の操作列を保ち、「設定を開く／説明に戻る」を同じ位置・同じsecondaryボタンで切り替えます。その下だけ説明と設定を描画します。スクロールバーの領域を両表示で確保し、設定側のflex配置は幅をstretchしてヘッダーの幅も保ちます。ログを見る操作は既存ログページへ移動します。別Appletの選択では説明へ戻ります。非表示の設定ページはカテゴリ等の選択状態を保持し、編集部品は表示中のページだけに描画して、同じ入力IDやキー記録を二重に持ちません。
- JSON編集中に詳細設定へ戻る際は、表示前にフォームへ変換します。不正なJSONは保持し、説明画面に戻して設定ページで修正するよう案内します。プロフィール画像の読み込み中に離れる場合は既存ProfileEditorの後始末で保存待ちを解除します。
- 詳細設定はパネル内をスクロールし、保存操作と説明へ戻る操作は長いフォームでも表示を保ちます。検証は`node scripts/navigation-ui-test.cjs`で行い、実Appletや実利用設定を使わず隔離fixtureへ保存します。
