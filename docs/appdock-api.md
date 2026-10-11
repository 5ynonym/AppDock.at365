# AppDock共通操作API（0.26.36以降）

MCPとAppletは同じ操作名・引数・結果・設定revision・dryRun・保存処理を使います。機能別の契約は[共通操作APIの各操作](automation.md)を正本とし、この文書はAppletの接続・許可・互換性を説明します。

## 構造と公開範囲

- `src/main/core/appdock-api.ts`のAppDockApiはMCPの起動状態から独立した単一インスタンスです。MCPはHTTPアダプター、Appletは既存JSON-lines RPCの`host.appdock.call`から呼びます。AppletにHTTPポート・Bearer token・Codex登録は不要です。
- 操作カタログは`src/shared/appdock-api.ts`のappDockOperationsへ集約します。MCPツール名・説明・入力schemaをここから生成し、Node SDKの操作名にも使います。操作追加時は共通カタログとAppDockApiの処理を追加します。既存のcommands.executeから公開コマンドを増やす場合は、新しいMCPツールやSDKメソッドは不要です。
- 現在の11操作すべてにAppletから接続できます。公開情報の取得、公開設定、公開コマンド、Applet管理、ショートカット・ジェスチャー・リボン・トレイ編集が対象です。非公開コマンド、秘密情報、全settings.jsonをこの入口から取得することはできません。
- 自分のStorage/Secrets、通知、UI登録等の既存APIは引き続き用途別の入口を使います。これらをMCPへ自動公開しません。リモートWebページにはこのAPIやホストIPCを渡しません。

## 宣言と許可

新しいAPIを使うAppletのmanifestに`"capabilities": ["appdock-api"]`と`"minimumHostVersion": "0.26.36"`を指定します。従来のsettings/UI等も使う場合は、そのcapabilityも残します。

Applet詳細の「設定」→「このAppletからのAppDock操作」で許可を変更します。初期値はすべてOFF。変更はその場でPC専用の`applet-api.json`へ保存され、通常設定の未保存draftとは独立しています。Applet IDとインストールフォルダーに紐づくため、異なるフォルダーへの移動後は再度許可します。設定を読み取れない場合はすべて拒否し、画面へエラーを表示します。Codex側の許可設定や登録は変更しません。

| 操作 | 必要なApplet側の許可 |
| --- | --- |
| 読取り | 公開情報の取得（read） |
| 通常の公開コマンド | read + execute |
| 公開設定変更・生成ON/OFF/toggle | read + execute + write |
| Appletの有効・無効・再起動 | read + execute + manageApplets |
| ショートカット等の編集 | read + execute + write + 対象のeditShortcuts/editGestures/editRibbon/editTray |

許可を変更できるのはホストの設定画面だけです。MCPやAppletから自分の許可を追加できません。呼び出し元のApplet IDはホストが接続から決定し、リクエストから受け取りません。監査ログは呼び出し元Appletのログへ`[Applet API]`として操作名・リクエストID・成否を記録し、引数や秘密値を含めません。

CodexとAppletの権限は独立しています。MCPから公開されたAppletコマンドを実行し、そのハンドラーが共通APIを呼ぶ場合、内側の呼出しにはそのAppletの許可を適用します。MCPの設定変更をOFFにしても、設定変更を許可したAppletの処理までは制限しません。Applet作者は外部公開コマンドの作用を説明してください。Appletプロセス自体はOSサンドボックスではなく、信頼できるローカル実装を対象にします。

## SDK

Nodeの`NodeExtensionContext.appdock.call(method, params?)`が結果オブジェクトを返します。失敗時は`AppDockApiError`の`code`と`message`を確認します。

```ts
const current = await context.appdock.call('settings.get');
await context.appdock.call('commands.execute', {
  id: 'appdock.settings.update',
  args: {
    changes: { notifications: false },
    expectedRevision: current.revision,
    dryRun: true,
  },
});
```

.NETは`IExtensionContext.AppDock`の`IAppDockService.CallAsync`を使用します。結果は`JsonElement`、失敗は`AppDockApiException.Code`です。0.26.36のSDK/Runtimeは従来のAssemblyVersionを維持し、既存IExtensionContext実装向けに既定のプロパティ実装を備えます。新APIを使うnative Appletは新Runtimeも組み込んで再発行してください。

```csharp
var current = await context.AppDock.CallAsync("settings.get", cancellationToken: token);
await context.AppDock.CallAsync("commands.execute", new {
    id = "appdock.settings.update",
    args = new {
        changes = new { notifications = false },
        expectedRevision = current.GetProperty("revision").GetString(),
        dryRun = true
    }
}, token);
```

生のRPCは`host.appdock.call`へ`{method, params}`を渡します。成功は`{ok:true,value}`、失敗は`{ok:false,error:{code,message}}`です。SDKがこの包みを取り外します。未対応ホストや通信断は従来のRPCエラーとなります。タイムアウトや応答消失後は状態を読み直し、変更を自動再送しないでください。

## 再入・起動と互換性

- 共通APIはAppDockの起動完了後に利用できます。activate時点ではNOT_READYとなる場合があるため、起動時の必須処理に依存させず、起動後のコマンド等から呼びます。
- MCP→Appletハンドラー→共通APIの読取り・同期的な設定変更は利用できます。別のAPIコマンドが処理中の追加の非同期コマンド実行・Applet管理はBUSYで拒否し、待ち合う循環を作りません。自分の通常コマンドや自分の有効・無効・再起動はSELF_CALLで拒否します。自分の公開設定変更は可能です。
- 既存の`context.settings.set`/`Settings.SetAsync`/`host.settings.set`は互換入口を維持します。settings capabilityと自分自身の設定範囲を保ち、非公開/従来の未宣言キーやactivate中の更新に新しい許可を要求しません。
- 互換入口の設定値検証・Applet設定への変更適用をSettingsCommandsへ集約しました。公開設定更新も同じ処理を使用し、同じSettingsStoreのrevisionを進めます。公開APIには引き続き公開フィールド制限・expectedRevision・dryRun・通常の設定保存検証を適用し、互換入口には従来の保存契約を残します。

## 検証

型検査、`tests/appdock-api.test.cjs`と設定/API回帰を使用します。実プロセス試験は先に`dev.bat run build:dotnet`と`dotnet build tests/fixtures/dotnet/AppDock.Extensions.ApiProbe/AppDock.Extensions.ApiProbe.csproj -c Release`を実行してから、`dev.bat node scripts/applet-api-ui-test.cjs`を直列で実行します。引数に発行EXEを渡すと隔離コピーで検証します。旧SDKでコンパイル済みのDemo DLLを`APPDOCK_TEST_LEGACY_DEMO_DLL`へ指定すると旧DLL互換も検査します。fixtureは製品へ同梱しません。
