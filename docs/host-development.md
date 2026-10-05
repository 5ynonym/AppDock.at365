# AppletのためにAppDockへ機能を追加する

AppDock v0.3.0の実装を基準に、どの層へ変更を入れるかと検証方法をまとめます。Appletを作り始める手順は[Applet実装ガイド](applet-development.md)、通信契約は[Applet API](extensions.md)を参照してください。

## まず変更範囲を決める

設定項目の追加だけなら、Appletのmanifestと設定読み取りを追加します。boolean / number / string / select、説明、範囲、動的選択肢はすでに対応しています。コマンド・ピン・ショートカットも登録から利用できます。

機能固有の時計描画、画像処理、WindowsフックなどはAppletへ置きます。複数Appletで共有したい操作、ホストの保存・通知・アカウント管理、ユーザー向けの共通画面はHost APIやReact UIを拡張します。Appletのために任意のElectron APIやファイル操作をrendererへ公開しません。

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
6. **互換性を記録する。** 既存ID・メソッド名・設定名は維持します。新APIを使うAppletのREADMEには必要なAppDockバージョンを記載します。現行manifestに最小ホストバージョンやAPIの能力交渉はありません。`apiVersion: 1`だけで旧ホストが新APIを提供すると判断しません。既存引数の意味やSDKの契約を壊す場合は、移行方法とAPIバージョンを別途設計します。

新APIがAppletプロセスからだけ使われる場合、preload/renderer IPCへの追加は不要です。Applet通信とReact用IPCは別の境界です。

時計で追加した `host.settings.options` が、この手順の具体例です。C#の `SettingOption(Label, Value)` は共通のJSON設定でcamelCaseへ変換され、Nodeと同じ `{label, value}` を送ります。mainはsettings capability、宣言済みのdynamic select、重複・長さ・件数を検証してから `ExtensionInstance.settingOptions` を更新し、変更通知を送ります。Reactはsnapshotの候補を使い、保存された未接続の値も別optionとして保持します。候補の更新ではsettings.jsonを書き換えません。

## React UIとIPCを追加する手順

ユーザーがAppDock画面から操作する機能だけを対象にします。

1. [共有契約](../src/shared/contracts.ts)へ表示データや `DockApi`メソッドを追加します。秘密情報・プロセス内部オブジェクト・任意コードは渡しません。
2. [preload](../src/main/preload.ts)に、固定したIPCメソッドの橋渡しを追加します。任意のチャンネルや任意のElectron操作を呼べる汎用口は作りません。
3. [mainのregisterIpc](../src/main/index.ts)の既存handleラッパーで受けます。送信元webContents・mainFrame・`appdock://host/index.html`の確認を維持し、引数も実行時に検証します。
4. [React](../src/renderer/main.tsx)で読み込み・操作・保存・エラーを実装します。設定編集はdraftとrevisionを使い、他の変更が起きた際の古い内容による上書き拒否、画像の保存／復元処理を保ちます。
5. 購読はunmount時に解除し、UIテストでは通知の到着まで待ちます。Applet名・項目名・単位・説明を表示し、ユーザーが判断に使わない通信名やプロセス情報を設定画面へ出しません。

`nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`、CSP、外部navigationの禁止を維持します。Appletから提供するパネルはReactでテキストとして描画し、生HTMLやスクリプトを受けません。

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

変更に合う検証だけを選び、通ったものと未検証事項を記録します。

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

完成後は必要なホストバージョン、配置するファイル、検証コマンド、実機条件と限界、成果物のVersion／SHA256をREADME・VERIFICATIONへ更新します。Gitではsourceとdocsをコミットし、publish・artifacts・設定・秘密情報は除外します。
