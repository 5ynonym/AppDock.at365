# 新しいAppletを作る

AppDock v0.3.0 / API v1を基準にした実装手順です。まずこのガイドで構成を決め、個々のAPIは[Applet API](extensions.md)、ホストへの機能追加は[AppDockの実装ガイド](host-development.md)を参照してください。

新しいAppletにも[ドキュメント方針](documentation.md)を適用し、利用者向けの`README.md`と開発者向けの`DEVELOPMENT.md`を分けて作成します。最低ホスト版・導入・操作・設定・利用上の制約はREADME、ビルド・テスト・発行・内部構造はDEVELOPMENT、実測結果はVERIFICATIONへ記載してください。

## 1. 機能と実行方式を決める

Appletは1つの道具として有効化・停止・再起動できる単位です。時計、マウスジェスチャー、AutoLockなど、独立して切り替えたい機能は別Appletにします。次の機能のために、Applet内へ汎用的な拡張機構を先に作る必要はありません。

| runtime | 選ぶ場面 | 実装と参照例 |
| --- | --- | --- |
| `dotnet` | C#の処理、監視、Windows API。独自のWPF/WinForms画面が不要 | net10.0 DLL。`AppDock.SDK`を参照。[C#検証用拡張](../tests/fixtures/dotnet/AppDock.Extensions.Demo/DemoExtension.cs) |
| `native` | WPF/WinFormsの画面、STAや専用メッセージループが必要 | 自身のランタイムを持つEXE。[WebBrowserTools](../../Applet.WebBrowserTools.at365/DEVELOPMENT.md)。現在のWatchはDLLウィジェット方式 |
| `node` | TypeScriptで実装する処理。Electron同梱Nodeを利用 | コンパイル済みCommonJS。[Node検証用拡張](../tests/fixtures/extensions/welcome/index.ts) |

独自画面が不要なら、設定フォーム、コマンド、状態パネルをSDKでホストへ提供できます。API v1のパネルはタイトル・説明・事実一覧・コマンドボタンです。AppletからReactコンポーネントやHTMLを注入するAPIはありません。アカウント一覧等の専用画面が必要になった場合は、ホスト側の型とUIを追加します。

各Appletは別プロセスで動きます。これは障害の分離で、OS権限の制限ではありません。ローカルの信頼できる実装を対象にします。

## 2. 最小のC# DLL Appletを作る

次の3ファイルで、メッセージを設定できるAppletになります。ソースの配置例は `A:\30.PROJECT\Applet.Sample.at365\Applet.Sample`、manifestはその親フォルダーです。実際の名前・IDに置き換えてください。

`Applet.Sample/Applet.Sample.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <AssemblyName>Applet.Sample</AssemblyName>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="../../AppDock.at365/dotnet/AppDock.SDK/AppDock.SDK.csproj" />
  </ItemGroup>
</Project>
```

`Applet.Sample/Applet.cs`:

```csharp
using AppDock.SDK;

namespace Applets.Sample;

public sealed class Applet : IAppDockExtension
{
    private IDisposable? subscription;

    public async Task ActivateAsync(IExtensionContext context, CancellationToken token)
    {
        Task Refresh(CancellationToken ct) => context.Ui.ShowPanelAsync(
            new Panel("Sample", context.Settings.Get("message", "こんにちは")), ct);

        context.Commands.Register(context.ExtensionId + ".refresh", "表示を更新", Refresh);
        subscription = context.Settings.OnChanged(Refresh);
        await Refresh(token);
    }

    public Task DeactivateAsync(CancellationToken token)
    {
        subscription?.Dispose();
        subscription = null;
        return Task.CompletedTask;
    }
}
```

`extension.json`:

```json
{
  "apiVersion": 1,
  "id": "at365.sample",
  "name": "Applet.Sample.at365",
  "displayName": "Sample.at365",
  "version": "0.1.0",
  "runtime": "dotnet",
  "entry": "Applet.Sample.dll",
  "type": "Applets.Sample.Applet",
  "capabilities": ["ui", "settings"],
  "settings": [
    { "key": "message", "title": "メッセージ", "type": "string", "default": "こんにちは" }
  ]
}
```

Appletのルートでビルドします:

```powershell
dotnet build .\Applet.Sample\Applet.Sample.csproj -c Release
```

AppDockのEXEの隣の `extensions\Applet.Sample.at365` へ、manifestと `Applet.Sample/bin/Release/net10.0/Applet.Sample.dll` を配置します。追加の依存DLLがある場合は、そのDLLやdeps.json等も配置してください。SDKはホストランナーと型を共有するため、AppDockと同じSDKでビルドします。

AppDockを起動し直し、「Applet」でSampleを有効にします。「設定 → Applet設定」でメッセージを保存すると、パネルへ反映されます。Ctrl+Pで「表示を更新」を実行できます。

## 3. ID・コマンド・設定を設計する

- `id`は小文字英数字・`.`・`-`による安定した識別子です。コマンドIDは必ず `<id>.` で始め、機能名や表示名を変えても既存IDを維持します。ショートカットとピンはIDで保存されます。
- コマンドはActivate時に登録します。有効なAppletが登録したコマンドは、パレットとショートカット設定に自動表示されます。通常のショートカットはAppDockの画面操作中に有効です。v0.3.1以降では、ユーザーが「グローバル」を有効にするとWindowsのホットキーとして登録します。登録・解除はホストが担当し、Appletの停止時に解除します。`at365.watch.toggle` は既定でグローバルPauseです。
- 設定値は `context.Settings` 経由で扱います。保存先はAppDockの `settings.json` の `extensions.<id>.settings` です。Appletから設定ファイル全体を直接書き換えません。
- manifestの既定値はフォーム表示用です。SDKの読み取りにも同じfallbackを指定します。空の設定で起動できるようにしてください。manifestの既定値が自動的に全項目保存されるわけではありません。
- boolean / number / string / selectを宣言し、説明・数値の上下限・刻み幅を付けます。フォームとHost API保存時は検証されますが、手動JSON編集の値をApplet側でも検証・補正します。
- 設定変更は `Settings.OnChanged` / `settings.onChanged` で購読し、タイマー間隔や表示へ反映します。`SetAsync`は保存成功後に自分のキャッシュも更新しますが、自分の購読処理が必ず呼ばれることには依存せず、操作後に必要な表示更新を明示的に行います。
- モニター等の動的なselectは、manifestに `dynamic: true` と初期optionsを宣言し、Activate時と構成変更時に `SetOptionsAsync` / `setOptions` を呼びます。選択肢は保存値を上書きしません。未接続時の代替先はApplet側で決めます。
- 環境設定はSettings、処理データはStorage、認証トークンはSecretsへ分けます。ログへ秘密情報を出しません。必要なcapabilitiesだけを宣言します。
- トレイ操作が不要なら `Tray.Add` を呼びません。時計Appletは3コマンドを登録し、トレイ項目は0件です。

## 4. native / WPF Appletを作る場合

現在のnative実装例はWebBrowserToolsの[プロジェクト](../../Applet.WebBrowserTools.at365/Applet.WebBrowserTools/Applet.WebBrowserTools.csproj)、[起動処理](../../Applet.WebBrowserTools.at365/Applet.WebBrowserTools/Program.cs)、[SDK接続](../../Applet.WebBrowserTools.at365/Applet.WebBrowserTools/WebBrowserToolsApplet.cs)を参照してください。画面やブラウザー操作を丸ごと複製する必要はありません。Watch 0.2.0以降はDLLウィジェット方式のため、native EXEの雛形には使いません。

1. `net10.0-windows` / `WinExe` / `UseWPF`で専用EXEを作り、`AppDock.Runtime`をProjectReferenceします。Runtime経由でSDKも参照されます。manifestは `runtime: native`、entryはEXE、typeは省略します。
2. `[STAThread]`のMainでWPF Applicationを作り、`ShutdownMode.OnExplicitShutdown`でDispatcherを維持します。`AppletSession.RunAsync`はバックグラウンドで実行し、画面操作は `Dispatcher.InvokeAsync`へ渡します。接続処理をUIスレッドで待機しません。
3. stdoutはUTF-8のJSON-RPC専用です。元の `Console.Out` を保存してセッションへ渡し、通常のConsole出力はstderrへ転送します。自作通信や生のstdout出力を追加すると接続が壊れます。
4. セッション終了・stdinのEOF・異常時はApplicationを終了します。Deactivateでウィンドウ、タイマー、設定購読、SystemEvents、フックを解放します。非表示と終了を区別し、非表示の時計はタイマーも停止します。
5. WebBrowserToolsと同様にself-containedの `win-x64` でpublishできます。単一EXEにするなら同プロジェクトのpublish設定を参照し、nativeライブラリや必要なコンテンツも含めます。`extension.json`は別ファイルです。AppDockのDLL用ホストは環境の.NET 10 Runtimeを使用します。native / WPF Appletをframework-dependentで配布する場合は、別途.NET 10 Desktop Runtime（Windows x64）が必要です。
6. AssemblyName、namespace、StartupObject、XAMLのx:Class、manifestのentry、リソースのpack URIを一緒に整合させます。時計の `Watch.ico` やフォントを別機能へ無条件に流用しません。

AppDockはdeactivateを最大2秒待ってからプロセスを停止します。終了処理は短く、複数回呼ばれても安全にしてください。強制停止もあるため、大切な状態を終了時だけ保存する設計は避けます。子プロセスを独自に起動する場合、その終了管理もAppletの責任です。

## 5. 初期のnative時計Appletで得られた注意点

以下は0.1.xのWPF時計で得た設計上の知見です。現在のWatch 0.2.0以降では描画・配置・フォントをホストのウィジェット機構へ移しています。現行の実装方法は[ウィジェット開発ガイド](widgets.md)と[Watchの開発ガイド](../../Applet.Watch.at365/DEVELOPMENT.md)を参照してください。

| 項目 | 実装時の扱いと参照先 |
| --- | --- |
| 表示状態 | 設定UIと表示／非表示コマンドが同じ `visible` を保存する。再起動後も状態を維持する |
| モニター | 配列番号ではなくDeviceNameを保存。切断時はメインへ退避し、元の保存値を保持する |
| 座標・DPI | 物理ピクセルとDIPを分け、負のモニター座標も扱う。対象モニターへ移動後にウィンドウのDPIを読み、幅と上下位置を決める |
| Windowsイベント | DPI／表示構成変更で再配置し、SystemEventsの購読を解除する。Dispatcherへ送った遅延処理にもclosed確認と例外処理を置く |
| オーバーレイ | 時計ではクリック透過・非アクティブ化・タスクバー非表示・topmostを設定。入力を必要とするAppletへそのまま適用しない |
| フォント | WPF Resourceとして明示的に埋め込み、AssemblyNameを含むpack URIで参照。ビルド成功だけで判断せず、実際の描画も確認する |
| 型と画面 | internalなWPFクラスにはXAMLの `x:ClassModifier="internal"` も揃える。WinForms Screenだけの利用で出るDPI警告は、WPFのmanifestによる設定を確認して理由付きで対象警告だけ扱う |
| 同時処理 | .NETのコマンドと設定変更はRuntimeが直列化する。タイマー・OSイベントは別なので、画面はDispatcher、処理データは必要な排他で守る。Nodeのコマンド／通知は自動直列化されない |
| テストの待機 | main側のrunningだけではReactへ登録コマンドが届いた保証にならない。ショートカット検証前はパレットの行が現れるまで待つ |
| 描画テスト | 一時的なPNG書き込みロックは待機して読み取る。必要なら描画出力を原子的に置換する。大量の描画記録はテスト時だけ有効にする |

動的select・Runtime抽出・native接続をホストへ足した場所は[ホスト実装ガイドの時計の変更一覧](host-development.md#時計を載せるために追加した機能)にまとめています。

## 6. ビルド・配置・検証する

ソースは独立したAppletフォルダーで管理し、publish成果物だけをEXE隣の `extensions/<Appletフォルダー>`へ配置します。追加・削除・manifest変更後はAppDockを起動し直します。新しいAppletは既定で無効です。他のAppletと重複しないIDを使います。

時計の[発行スクリプト](../../Applet.Watch.at365/scripts/publish.ps1)と[ローカル配置スクリプト](../../Applet.Watch.at365/scripts/install-local.ps1)は、DLL・deps.json・manifest・フォントを配置し、AppDockの設定を変更しない例です。配置前に対象のAppDockを終了してください。native EXEの発行・配置は[WebBrowserToolsの開発ガイド](../../Applet.WebBrowserTools.at365/DEVELOPMENT.md)を参照してください。既存Watch等の実行中出力やソースには上書きしません。

最低限、次を確認して `VERIFICATION.md`へ実測と未検証事項を残します:

- 空の設定での初回有効化、登録コマンド、パネル、設定保存と再起動後の保持。
- フォーム保存とコマンド保存の同一状態、起動中の設定反映、不正値・手動編集時の挙動。
- 無効化、Applet再起動、ホスト完全終了、異常終了時に、ウィンドウ・独自タスク・旧プロセスが残らないこと。
- 他Appletやホストが動作を継続すること。OS全体に作用する機能は、隔離できる範囲と実機で必要な範囲を分ける。
- publish成果物と完成AppDock EXEの組み合わせ。開発実行だけでは依存DLLやランタイムの欠落を検出できない。

UIテストは一意の `artifacts` フォルダーを作り、ホストへ `--test-profile=<絶対パス>` を渡します。実利用のsettings.jsonや認証データを変更しません。[時計のUIテスト](../../Applet.Watch.at365/scripts/test-ui.cjs)は隔離profileにDLLを配置し、ホストのウィジェット検証を実行します。[検証結果と限界](../../Applet.Watch.at365/VERIFICATION.md)も参照してください。

時計のテストはマウスジェスチャー・OSホットキー・AutoLock等を検証しません。モニターの抜き差し、異なるDPIの実機、RDP、スリープ復帰、長期常駐も、次の機能で必要なら別途確認します。

## v0.6.0のApplet設計

モニターごとのフォームには`object-list`とフィールド内の`string-list`を使います。旧Folderや数値enumの移行を宣言でき、JSON文字列からも設定を引き継げます。ロード前に設定したいコマンドはmanifestの`commands`へ宣言し、即時ロードを許す開始操作だけ`activateOnExecute`を指定します。旧IDは`aliases`で維持できます。

履歴画像など件数が変わる操作は`PanelAction.ActionId`と`IPanelActionHandler`を使用します。パネルの`Tabs`でモニターを切り替え、画像ごとの操作を一般コマンドへ増やさずに済みます。大きなサムネイルは`local-images`と`Ui.GetImageDirectoryAsync`、`PanelImage.ImageFile`を使い、ページ変更・終了時に自分のキャッシュを削除します。画像プレビューはホストが提供します。

契約と範囲は[拡張API](extensions.md#v060-宣言コマンド構造化一覧パネル操作)、実装例と検証は[WallpaperSlideshowの開発ガイド](../../Applet.WallpaperSlideshow.at365/DEVELOPMENT.md)を参照してください。必要ホストをv0.6.0へ上げ、SDK・Runtimeを含めて再publishします。

## v0.7.0のトレイ表示

登録・宣言した一般コマンドは、ユーザーがホスト設定の「トレイに表示」を有効にするとトレイメニューへ追加されます。既定はOFFです。Applet側の`context.Tray.Add` / `context.tray.add`はメニューラベルの提案で、表示を強制しません。これらを呼ばないAppletでも登録コマンドを選択できます。クリック時のコマンドもホスト設定から選べるため、Appletごとに独自トレイを追加する必要はありません。安定したコマンドIDを維持し、実行中の動的置換には従来の`ReplaceAsync`を使います。

v0.9.0ではシングルクリックとダブルクリックを別々の一般コマンドへ割り当てられます。ダブルは既定未設定。割り当てた場合はホストが単クリックを判定時間だけ待機し、ダブル時に単クリックを取り消します。Applet側の実装・API変更は不要です。

表示名はmanifestの任意の`displayName`で指定します（1～100文字、空白のみは不可）。AppDock v0.9.1以降は一覧・設定・コマンド候補・トレイ等でこの名前を使います。省略時は`name`の先頭の`Applet.`を除去します。元の名前・ID・実行ファイル名は維持し、manifest更新後はホストを再起動します。詳細は[Applet API](extensions.md)を参照してください。
## ウィジェットの提供

AppDock 0.10.0以降は、manifestの`widgets`宣言と`widgets` capability、.NETの`IWidgetService`／Nodeの`context.widgets`で、ホームと透過デスクトップに共通の内容を提供できます。画面を自作しないAppletは.NET DLLで実装できます。Watch 0.2.0が移行例です。[ウィジェットの契約・移行・検証](widgets.md)を参照してください。
