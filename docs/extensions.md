# Extension API v1

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

フォームの設定定義は `boolean` / `number` / `string` に対応します。数値は `minimum` / `maximum` を定義できます。拡張は設定値を読み取る際にも妥当性を確認してください。

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

任意のWPF/WinFormsアプリEXEを読み込むものではありません。.NETホストはMicrosoft.NETCore.Appを同梱しており、WindowsDesktopランタイムは同梱していません。WPF/WinFormsの画面やSTAメッセージループを必要とする部分は、将来のネイティブ表示用ヘルパー等として設計する必要があります。P/InvokeのようなWindows API処理をCore拡張に置くことは可能です。

## TypeScript / Node.js

`extensions/welcome/index.ts` が完全な例です。型は `src/main/node-worker.ts` の `NodeExtensionContext` / `NodeExtension` を `import type` で参照できます。コンパイル済みCommonJSコードを配置してください。`pnpm run build` は同梱サンプルを自動コンパイルします。

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

設定変更はキャッシュへ通知します。設定に依存するタイマー間隔等は、都度読み取りまたは拡張再起動で反映してください。UIへHTML/JavaScriptは渡せません。Reactがテキストとして描画します。API v1は1拡張1パネルです。

## 通信

UTF-8のJSON-RPC 2.0をstdin/stdoutに1行1メッセージで送ります（上限1MB、通常タイムアウト15秒）。ホスト→拡張は `activate` / `settings.changed` / `command.execute` / `deactivate`。activateは `{commands:[{id,title}],tray:[{title,command}]}` を返します。

拡張→ホストは `host.settings.get/set` / `host.notifications.show` / `host.ui.panel` / `host.browser.open` / `host.log` / `host.storage.get/set` / `host.secrets.get/set/delete` です。SDKがこの通信を隠蔽します。無効化・終了時はdeactivateを最大2秒待ち、残った子プロセスを終了します。異常終了した拡張はエラー状態にし、他の拡張は動作を継続します。自動再起動のループは行わず、画面の「再起動」で復旧します。
