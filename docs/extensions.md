# Applet API v1

## v0.4.0: 動的コマンドとキー送信の一覧設定

`dynamic-commands` capabilityを宣言したAppletは、`.NET: context.Commands.ReplaceAsync(IReadOnlyList<CommandRegistration>, token)` またはRPC `host.commands.replace` の `{ commands: [{ id, title }] }` で起動中のコマンド一覧を置き換えられます。固定コマンドも含めた全件（最大100件）を渡します。IDの接頭辞・重複・表示名を検証してから変更します。変更はパレット、ショートカット設定、グローバルホットキーへ反映され、削除したコマンドのキー登録を解除します。保存済みの割り当てとピンは保持します。

.NETの`CommandRegistration`はID・タイトル・実行ハンドラーの3項目です。ActivateまたはSettings.OnChangedの中から呼び、更新をawaitしてください。コマンドは設定変更後にハンドラーを再取得するため、削除済みの処理を実行しません。ホストが更新を拒否するとRuntimeは元の一覧へ戻します。

設定定義の `type: "shortcut-list"` は `{ id, title, keys }` の配列を扱い、追加・削除UIを提供します。IDは小文字英数字とハイフン（先頭英数字、40文字以内）、名前は100文字以内、最大32件。既定値は `[]` です。キーは `Ctrl+Shift+T` や `Win+E` などの1組の組み合わせで、フォーム保存／Host API保存時に検証します。設定型はキーを送信せず、実行はApplet側の責任です。

実装例: [WindowsTools](../../Applet.WindowsTools.at365/README.md)。この型と動的APIを使用するAppletにはv0.4.0以降が必要です。既存API v1のAppletは引き続き使用できます。

画面上では拡張機能をAppletと呼びます。`extension.json`、`extensions`、`IAppDockExtension` などの既存API名は互換性を維持します。

新規実装の手順は[Applet実装ガイド](applet-development.md)、API・設定・UI等をホストへ足す手順は[AppDock実装ガイド](host-development.md)を参照してください。

## マニフェスト

```json
{
  "apiVersion": 1,
  "id": "at365.my-tool",
  "name": "My Tool",
  "version": "0.1.0",
  "runtime": "dotnet",
  "entry": "MyTool.dll",
  "type": "MyTool.Extension",
  "capabilities": ["ui", "settings", "notifications", "storage", "secrets", "browser"],
  "settings": [
    { "key": "intervalSeconds", "title": "確認間隔（秒）", "type": "number", "default": 30 }
  ]
}
```

`entry` はマニフェストがあるフォルダ内のファイルです。相対パスを指定し、必要な依存DLLも同じフォルダに置きます。`runtime: "node"` の場合はコンパイル済みCommonJSの `.js` を指定し、`type` は不要です。拡張IDとコマンドIDは安定した名前にしてください。コマンドIDは必ず `<extension-id>.` から始めます。

フォームの設定定義は `boolean` / `number` / `string` / `select` に対応します。`description` は項目の説明、数値の `minimum` / `maximum` / `step` は範囲と刻み幅です。型・範囲・静的な選択肢はUIとHost APIの保存時に検証します。手動JSON編集もあるため、Appletは設定値を読む際にも妥当性を確認してください。

`select` には `options: [{"label":"上端","value":"top"}]` を宣言します。`dynamic: true` の項目は、.NETの `Settings.SetOptionsAsync` / Nodeの `settings.setOptions` で選択肢を更新できます。未接続モニターなどの保存された選択は保持し、現在利用できない選択として表示します。動的な値の代替動作はApplet側で実装してください。

設定変更の通知は `.NET: Settings.OnChanged(async token => ...)` / `Node: settings.onChanged(async () => ...)` で購読します。購読解除のIDisposable／関数を返します。.NETでは同じAppletのコマンドと設定変更処理を直列化します。

## ネイティブ表示を持つApplet

WPF等で独自ウィンドウを表示するAppletは `runtime: "native"`、`entry: "Applet.Watch.at365.exe"` を指定します。AppDockが専用EXEを起動し、DLL拡張と同じ標準入力／出力のJSON-RPCで接続します。`type` は不要です。EXEは実行環境と依存関係を自身で持つ必要があります。

`.NET` 用の共通接続処理は `dotnet/AppDock.Runtime` の `AppletSession.RunAsync(IAppDockExtension, TextReader, TextWriter)` にあります。WPFではSTAのDispatcherを維持し、接続処理をバックグラウンドで動かします。`../Applet.Watch.at365` が実装例です。ホスト終了／無効化時はdeactivateの後にプロセスを停止し、通信断時もセッションを終了します。コマンド、設定、パネル、capabilitiesの検査は既存のAppletと共通です。

登録したコマンドは、ホストの「設定 → ショートカット」に自動的に表示され、ユーザーがキーを割り当てられます。コマンドパレットからピン留めと並べ替えもできます。設定はコマンドIDで保存するため、更新時にもIDを維持してください。拡張を無効にしてもキー設定とピンは保持され、有効にして再登録されると利用できます。

## .NET

`dotnet/AppDock.SDK/AppDock.SDK.csproj` を参照し、公開クラスに `IAppDockExtension` を実装します。実行用ランタイムはnet10.0です。UIライブラリに依存しないCoreをここへ移します。

```csharp
using AppDock.SDK;

namespace MyTool;
public sealed class Extension : IAppDockExtension
{
    private IDisposable? schedule;
    public async Task ActivateAsync(IExtensionContext context, CancellationToken token)
    {
        context.Commands.Register("at365.my-tool.check", "今すぐ確認", async ct =>
        {
            await context.Notifications.ShowAsync("My Tool", "確認しました。", ct);
        });
        context.Tray.Add("今すぐ確認", "at365.my-tool.check");
        schedule = context.Scheduler.Every(TimeSpan.FromSeconds(30), ct =>
            context.Log.InfoAsync("定期処理", ct));
        await context.Ui.ShowPanelAsync(new Panel("My Tool", "準備ができました。"), token);
    }
    public Task DeactivateAsync(CancellationToken token)
    {
        schedule?.Dispose();
        return Task.CompletedTask;
    }
}
```

1拡張ごとにホストランナーを1プロセス起動します。各DLLは独立したAssemblyLoadContextで読み込み、AppDock.SDKの型はランナーと共有します。コマンド処理は同一拡張内で直列化します。定期処理は前回の完了まで次回を重ねません。定期処理とコマンドの同時実行が問題になるロジックでは、拡張側にも排他を置いてください。定期処理はSDKから停止されますが、拡張が独自に作成したリソースはDeactivateAsyncで解放してください。CancellationTokenを処理へ渡してください。

DLL用の.NETホストはframework-dependentで発行し、PCにインストール済みのMicrosoft.NETCore.App 10.0（Windows x64）を使用します。AppDockは.NETランタイムを同梱せず、DLL用ホストはWindowsDesktopランタイムを要求しません。WPF/WinFormsの画面やSTAメッセージループが必要なAppletは、上記の `runtime: native` と専用EXEで実装します。時計Appletは自身のWindowsDesktopランタイムを同梱します。別のnative Appletをframework-dependentで配布する場合は、利用先に必要なWindowsDesktopランタイムを用意してください。任意の既存EXEを置くだけで接続されるものではなく、SDKの接続とライフサイクルへの対応が必要です。P/InvokeのようなWindows API処理をDLL Appletに置くことも可能です。

## TypeScript / Node.js

検証用の [Node拡張](../tests/fixtures/extensions/welcome/index.ts) が完全な例です。型は `src/main/node-worker.ts` の `NodeExtensionContext` / `NodeExtension` を `import type` で参照できます。コンパイル済みCommonJSコードを配置してください。検証用拡張は `pnpm run build:test-extensions` でコンパイルし、通常のビルド・発行には含めません。

```typescript
import type { NodeExtensionContext } from '../../src/main/node-worker';
export async function activate(context: NodeExtensionContext) {
  context.commands.register('at365.my-tool.check', '今すぐ確認', async () => {
    await context.notifications.show('My Tool', '確認しました。');
  });
  context.tray.add('今すぐ確認', 'at365.my-tool.check');
  await context.ui.showPanel({ title: 'My Tool', description: '準備ができました。' });
}
export async function deactivate() { /* 独自のリソースを解放 */ }
```

Node拡張はElectron同梱Nodeを子プロセスで利用します。ホスト本体のNode空間にはロードしません。stdoutはプロトコル専用です。通常のconsole.logはstderrへ転送します。

## SDKで使えるサービス

| API | 用途 | capabilities |
| --- | --- | --- |
| Commands | パレットとボタンから呼ぶ処理の登録 | 常時 |
| Tray | ホストトレイのサブメニューにコマンドを追加 | 常時 |
| Settings | 自分の拡張設定の読み取り・保存 | 書き込みに `settings` |
| Notifications | ホストの通知設定に従うデスクトップ通知 | `notifications` |
| UI | テキスト、説明、label/value、コマンドボタンのパネル | `ui` |
| Browser | 資格情報を含まないHTTPS URLを既定ブラウザで開く | `browser` |
| Logging | 拡張ID付きホストログ | 常時 |
| Scheduler | 定期実行、停止時のタイマー解除 | 拡張ランナー内 |
| Storage | 拡張ID・キー別のJSON永続データ（1件1MBまで） | `storage` |
| Secrets | 拡張ID・キー別の暗号化文字列 | `secrets` |

設定変更はキャッシュへ通知します。設定に依存する表示やタイマー間隔等は、OnChangedの購読または都度読み取りで反映してください。UIへHTML/JavaScriptは渡せません。Reactがテキストとして描画します。API v1は1拡張1パネルです。

## 通信

UTF-8のJSON-RPC 2.0をstdin/stdoutに1行1メッセージで送ります（上限1MB、通常タイムアウト15秒）。ホスト→拡張は `activate` / `settings.changed` / `command.execute` / `deactivate`。activateは `{commands:[{id,title}],tray:[{title,command}]}` を返します。

拡張→ホストは `host.settings.get/set/options` / `host.notifications.show` / `host.ui.panel` / `host.browser.open` / `host.log` / `host.storage.get/set` / `host.secrets.get/set/delete` です。SDKがこの通信を隠蔽します。無効化・終了時はdeactivateを最大2秒待ち、残った子プロセスを終了します。異常終了した拡張はエラー状態にし、他の拡張は動作を継続します。自動再起動のループは行わず、画面の「再起動」で復旧します。

## v0.5.0: manifestとホスト共通設定

- `minimumHostVersion`: 必要なホストの安定版SemVer (`0.5.0`など)。省略時は従来どおりAPI v1として起動。
- `startupDelaySeconds`: 既定の遅延秒数、0～86400の整数。省略は0。
- `updateRepository`: GitHubの`owner/repository`。省略時は更新確認非対応。更新比較には`major.minor.patch`の正式版タグ（先頭`v`も可）が必要。
- 保存先は`extensions[id].startupDelaySeconds`。Applet固有の`settings`とは別で、旧設定をそのまま読み込める。待機のタイマーを起動・RPCのキューで待たず、ほかのAppletの起動を妨げない。
- snapshotの`state: waiting`、`scheduledStartAt`（Unixミリ秒）で待機を表示。無効化・再起動・終了でタイマーを解放。再起動も遅延を適用し、「今すぐ開始」だけ即時にする。
- `type: json`の設定値は最大10000文字のJSON文字列。ホストで構文、Appletで意味と範囲を検証。

パネルの`images`は4件まで。各項目は`title`、任意の`description`、`image`（JPEG/PNG/WebPのbase64 data URL、200000文字以内）、名前空間内の`actions`（4件まで）。ホストは外部URL・SVG・HTMLを受け付けない。.NETの既存`Panel`コンストラクターは維持し、任意の`Images`プロパティと`PanelImage`を追加。Nodeの`ui.showPanel`でも同じJSON型を使用できる。

これらはホスト内部と既存パネルAPIの追加で、`.NET`/Nodeに新しいRPCメソッドは追加していない。外部native Appletは独自のSDKコピーを含むため、追加プロパティを使うAppletは再publishすること。
## v0.6.0: 宣言コマンド・構造化一覧・パネル操作

新しい機能を使うAppletは`minimumHostVersion: "0.6.0"`を指定してください。

manifestの`commands: [{ id, title, activateOnExecute?, aliases? }]`は、ロード前からパレット・ショートカットに表示するコマンドを宣言します。実行中はruntimeの登録内容を優先し、snapshotの`available`で使用可否を知らせます。`activateOnExecute: true`の明示実行は無効化・開始待ち状態から有効化して即時起動します。最低ホストバージョンはこの経路でも検証します。起動時に同じIDをruntimeへ登録してください。`aliases`は同じ名前空間の旧ID（8件まで）を受け付け、未割り当ての別名はコマンド候補に重複表示しません。既存の割り当ては保持します。

`type: object-list`の設定は`fields`と`itemTitle`を持つ64件までのオブジェクト配列です。フォームで追加・並べ替え・削除します。旧JSON文字列も読み取れます。フィールドはboolean / number / string / select / string-listで、一覧の入れ子は不可。`string-list`はフィールド内だけで使用し、64件までの文字列を追加・削除します。`format: directory`でフォルダー選択、`aliases: ["Folder"]`で旧単一文字列を統合します。`select`の`numericOptions: true`は旧数値enumをoptionsの順序で読み取ります。正規化時も未知のフィールドを保持します。

`Panel.Images`は1000件まで、`Tabs`は100件までに拡張しました。`PanelAction`は従来の`Command`、または`Command: ""`と`ActionId`のどちらかを指定します。`Selected`はタブの選択状態。`ActionId`はAppletの名前空間内のIDとし、.NETの`IPanelActionHandler.HandlePanelActionAsync` / Nodeの`onPanelAction`で処理します。ホストは現在表示中のパネルに存在するIDだけを`panel.action`で送ります。可変数の履歴ボタンを一般コマンドへ登録する必要はありません。ページ世代IDと表示対象の検証はApplet側でも行ってください。

`local-images` capabilityで`.NET: Ui.GetImageDirectoryAsync` / Nodeの`ui.getImageDirectory` / RPC `host.ui.imageDirectory`が専用キャッシュを作成します。そこにPNG/JPEG/WebPを作り、`PanelImage.ImageFile`へ絶対パスを指定します。ホストは実パスでキャッシュ内に含まれるファイルだけを登録し、同一オリジンの画像URLとして表示します。画像データはJSON-RPCへ載せず、画像バイト数による画質・解像度の制限はありません。従来のbase64 `Image`は200000文字上限のまま使用可能です。`Tooltip`で元ファイルパスを表示できます。キャッシュファイルの寿命と削除はAppletが管理します。
