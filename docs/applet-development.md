# 新しいAppletを作る

AppDock v0.3.0 / API v1を基準にした実装手順です。まずこのガイドで構成を決め、個々のAPIは[Applet API](extensions.md)、ホストへの機能追加は[AppDockの実装ガイド](host-development.md)を参照してください。

新しいAppletにも[ドキュメント方針](documentation.md)を適用し、利用者向けの`README.md`と開発者向けの`DEVELOPMENT.md`を分けて作成します。最低ホスト版・導入・操作・設定・利用上の制約はREADME、ビルド・テスト・発行・内部構造はDEVELOPMENT、実測結果はVERIFICATIONへ記載してください。

## 1. 機能と実行方式を決める

Webアカウントの独自ローカルUIに自身のboolean/静的select設定を置く場合は、AppDock 0.17.1のsnapshot.settings/setSettingを使えます。manifestへ設定とsettings capabilityを宣言し、[WebアカウントAPI](web-accounts.md)の保存・同期契約に従ってください。

Appletは1つの道具として有効化・停止・再起動できる単位です。時計、マウスジェスチャー、AutoLockなど、独立して切り替えたい機能は別Appletにします。次の機能のために、Applet内へ汎用的な拡張機構を先に作る必要はありません。

| runtime | 選ぶ場面 | 実装と参照例 |
| --- | --- | --- |
| `dotnet` | C#の処理、監視、Windows API。独自のWPF/WinForms画面が不要 | net10.0 DLL。`AppDock.SDK`を参照。[C#検証用拡張](../tests/fixtures/dotnet/AppDock.Extensions.Demo/DemoExtension.cs) |
| `native` | WPF/WinFormsの画面、STAや専用メッセージループが必要 | 自身のランタイムを持つEXE。[Watch](../../Applet.Watch.at365/DEVELOPMENT.md)、[WebBrowserTools](../../Applet.WebBrowserTools.at365/DEVELOPMENT.md) |
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

現在のnative実装例は[Watchの開発ガイド](../../Applet.Watch.at365/DEVELOPMENT.md)、WebBrowserToolsの[プロジェクト](../../Applet.WebBrowserTools.at365/Applet.WebBrowserTools/Applet.WebBrowserTools.csproj)、[起動処理](../../Applet.WebBrowserTools.at365/Applet.WebBrowserTools/Program.cs)、[SDK接続](../../Applet.WebBrowserTools.at365/Applet.WebBrowserTools/WebBrowserToolsApplet.cs)を参照してください。画面やブラウザー操作を丸ごと複製する必要はありません。

1. `net10.0-windows` / `WinExe` / `UseWPF`で専用EXEを作り、`AppDock.Runtime`をProjectReferenceします。Runtime経由でSDKも参照されます。manifestは `runtime: native`、entryはEXE、typeは省略します。
2. `[STAThread]`のMainでWPF Applicationを作り、`ShutdownMode.OnExplicitShutdown`でDispatcherを維持します。`AppletSession.RunAsync`はバックグラウンドで実行し、画面操作は `Dispatcher.InvokeAsync`へ渡します。接続処理をUIスレッドで待機しません。
3. stdoutはUTF-8のJSON-RPC専用です。元の `Console.Out` を保存してセッションへ渡し、通常のConsole出力はstderrへ転送します。自作通信や生のstdout出力を追加すると接続が壊れます。
4. セッション終了・stdinのEOF・異常時はApplicationを終了します。Deactivateでウィンドウ、タイマー、設定購読、SystemEvents、フックを解放します。非表示と終了を区別し、非表示の時計はタイマーも停止します。
5. WebBrowserToolsと同様にself-containedの `win-x64` でpublishできます。単一EXEにするなら同プロジェクトのpublish設定を参照し、nativeライブラリや必要なコンテンツも含めます。`extension.json`は別ファイルです。AppDockのDLL用ホストは環境の.NET 10 Runtimeを使用します。native / WPF Appletをframework-dependentで配布する場合は、別途.NET 10 Desktop Runtime（Windows x64）が必要です。
6. AssemblyName、namespace、StartupObject、XAMLのx:Class、manifestのentry、リソースのpack URIを一緒に整合させます。時計の `Watch.ico` やフォントを別機能へ無条件に流用しません。

AppDockはdeactivateを最大2秒待ってからプロセスを停止します。終了処理は短く、複数回呼ばれても安全にしてください。強制停止もあるため、大切な状態を終了時だけ保存する設計は避けます。子プロセスを独自に起動する場合、その終了管理もAppletの責任です。

## 5. native時計Appletの注意点

Watchは独自のWPFウィンドウで時計を描画し、配置とフォントをApplet側で管理します。現行の実装方法は[Watchの開発ガイド](../../Applet.Watch.at365/DEVELOPMENT.md)を参照してください。

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

時計の[発行スクリプト](../../Applet.Watch.at365/scripts/publish.ps1)と[ローカル配置スクリプト](../../Applet.Watch.at365/scripts/install-local.ps1)は、native EXEとmanifestを配置し、AppDockの設定を変更しない例です。配置前に対象のAppDockを終了してください。[WebBrowserToolsの開発ガイド](../../Applet.WebBrowserTools.at365/DEVELOPMENT.md)も参照できます。既存Watch等の実行中出力やソースには上書きしません。

最低限、次を確認して `VERIFICATION.md`へ実測と未検証事項を残します:

- 空の設定での初回有効化、登録コマンド、パネル、設定保存と再起動後の保持。
- フォーム保存とコマンド保存の同一状態、起動中の設定反映、不正値・手動編集時の挙動。
- 無効化、Applet再起動、ホスト完全終了、異常終了時に、ウィンドウ・独自タスク・旧プロセスが残らないこと。
- 他Appletやホストが動作を継続すること。OS全体に作用する機能は、隔離できる範囲と実機で必要な範囲を分ける。
- publish成果物と完成AppDock EXEの組み合わせ。開発実行だけでは依存DLLやランタイムの欠落を検出できない。

UIテストは一意の `artifacts` フォルダーを作り、ホストへ `--test-profile=<絶対パス>` を渡します。実利用のsettings.jsonや認証データを変更しません。[時計のUIテスト](../../Applet.Watch.at365/scripts/test-ui.cjs)は隔離profileにnative EXEを配置し、設定・コマンドと独自WPF画面を検証します。[検証結果と限界](../../Applet.Watch.at365/VERIFICATION.md)も参照してください。

時計のテストはマウスジェスチャー・OSホットキー・AutoLock等を検証しません。モニターの抜き差し、異なるDPIの実機、RDP、スリープ復帰、長期常駐も、次の機能で必要なら別途確認します。

## v0.6.0のApplet設計

モニターごとのフォームには`object-list`とフィールド内の`string-list`を使います。旧Folderや数値enumの移行を宣言でき、JSON文字列からも設定を引き継げます。ロード前に設定したいコマンドはmanifestの`commands`へ宣言し、即時ロードを許す開始操作だけ`activateOnExecute`を指定します。旧IDは`aliases`で維持できます。

履歴画像など件数が変わる操作は`PanelAction.ActionId`と`IPanelActionHandler`を使用します。パネルの`Tabs`でモニターを切り替え、画像ごとの操作を一般コマンドへ増やさずに済みます。大きなサムネイルは`local-images`と`Ui.GetImageDirectoryAsync`、`PanelImage.ImageFile`を使い、ページ変更・終了時に自分のキャッシュを削除します。画像プレビューはホストが提供します。

契約と範囲は[拡張API](extensions.md#v060-宣言コマンド構造化一覧パネル操作)、実装例と検証は[WallpaperSlideshowの開発ガイド](../../Applet.WallpaperSlideshow.at365/DEVELOPMENT.md)を参照してください。必要ホストをv0.6.0へ上げ、SDK・Runtimeを含めて再publishします。

## v0.7.0のトレイ表示

登録・宣言した一般コマンドは、ユーザーがホスト設定の「トレイに表示」を有効にするとトレイメニューへ追加されます。既定はOFFです。Applet側の`context.Tray.Add` / `context.tray.add`はメニューラベルの提案で、表示を強制しません。これらを呼ばないAppletでも登録コマンドを選択できます。クリック時のコマンドもホスト設定から選べるため、Appletごとに独自トレイを追加する必要はありません。安定したコマンドIDを維持し、実行中の動的置換には従来の`ReplaceAsync`を使います。

v0.9.0ではシングルクリックとダブルクリックを別々の一般コマンドへ割り当てられます。ダブルは既定未設定。割り当てた場合はホストが単クリックを判定時間だけ待機し、ダブル時に単クリックを取り消します。Applet側の実装・API変更は不要です。

表示名はmanifestの任意の`displayName`で指定します（1～100文字、空白のみは不可）。AppDock v0.9.1以降は一覧・設定・コマンド候補・トレイ等でこの名前を使います。省略時は`name`の先頭の`Applet.`を除去します。元の名前・ID・実行ファイル名は維持し、manifest更新後はホストを再起動します。詳細は[Applet API](extensions.md)を参照してください。
## Node Appletのファイル選択・通知音（0.11.0）

TypeScript/Nodeの現行実利用例は[Gmail](../../Applet.Gmail.at365/DEVELOPMENT.md)です。ローカルReact UIとWebアカウントのDOM観測を分け、ログイン領域はホストへ任せます。別途APIクライアントを実装する場合は、一般設定をホストフォーム、秘密をSecrets、履歴をStorageへ分けます。認証やポーリングはコマンド受付から切り離し、停止時にAbortControllerで中止してください。


ファイル選択・WAV音声・トレイの通知表示には`file-dialog`、`audio`、`tray-attention`を宣言します。`notifications.show`の`silent`で独自音との二重再生を防げます。[追加API](extensions.md#v0110-node-appletの通知ファイル選択)を参照してください。Node SDKの型は`src/main/node-worker.ts`が正本で、任意のパネルHTMLは実行しません。

Webサービスの対話ログインとアカウント別ページが必要なNode Appletは、0.12.0の[WebアカウントAPI](web-accounts.md)を使用できます。Gmail固有のDOM観測はAppletへ置き、WebContentsViewと永続セッションの管理はホストへ委ねます。0.13.0の`report(..., data)`でローカルUIへ一時データを渡し、`window.webAccounts.viewport`で表示領域・非表示を切り替えられます。これらを使用するAppletの最低ホスト版は0.13.0です。.NET専用ラッパーは未提供です。

初回未表示からページの描画を背景で継続する必要がある場合、最低ホスト版は0.15.1としてください。ホストは透明・画面外・非フォーカスの専用WindowへViewを保持し、可視の操作Windowを選択した場合だけ移します。サービス固有の通知・観測処理は引き続きApplet側です。snapshot.darkでホストテーマを受け取り、通知音は管理領域へコピーします。

通常起動でGmailの初回更新を維持する場合は0.15.2を指定し、webAccounts.keepActive:trueを宣言します。observerのready:trueを受けたobserveOriginだけを対象にし、背景では30秒ごとに同期再開を促します。native focusがあるWebContentsは通常のfocus/blurを使い、認証originではタイマーも解除します。Windowsのフォーカス/選択を自動変更する方式ではありません。通常起動での検証はテストツールによるfocus overrideを避けてください。

0.14.0では`webAccounts.cycle(1|-1)`とローカルUIの`openItem/setSound/pickSound/testSound`を追加し、ウィンドウ位置・サイズを保存します。項目を開く処理は任意で宣言するitemOpenerの関数式へkeyを渡し、明示的なUI操作でだけ実行します。音はアカウントごとのsoundをreadから参照して既存audio APIで再生してください。APIと境界は[WebアカウントAPI](web-accounts.md)を参照します。

0.16.0はローカルUIの`move/setMonitoring`と、readの`monitoring/monitoringResets`を追加します。Appletは個別OFFで基準・履歴・件数をresetし、read間のOFF→ONにも対応します。ヘッダー画像を観測結果のavatar URLへ置く場合は、manifestのavatarOriginsに画像のHTTPS originを明示してください。画像取得・変換・ローカルUIへのdata画像はホストが担当し、Nodeへ画像バイトを送りません。

0.16.1のwebAccounts.cycleはウィンドウを開かず、既存の表示/最小化/非表示とフォーカスを維持します。表示が必要な明示操作だけでopenを呼んでください。アバターは当該アカウントのログイン済みsessionから取得します。

0.16.3では、操作中のWebContentsでcycleを繰り返すときだけ入力を切替先へ引き継ぎます。ログイン後の自動命名にはobserverのaccountName（1〜60文字・制御文字なし）を返し、最低ホスト版を0.16.3にしてください。新規名は「新しいアカウント」で、明示rename後や一度取得した名前は自動変更しません。Gmailの日本語/英語ヘッダー抽出と連続キー入力の実装例は[Gmail開発ガイド](../../Applet.Gmail.at365/DEVELOPMENT.md)を参照します。
## Appletページの追加（0.18.0）

HTML/Reactで独自画面を作り、リボンから本体ページまたは独立Windowとして開く場合は[Appletページとリボン](applet-pages.md)を参照してください。manifestのpages、安定したページIDとopenCommand、pages capabilityを宣言します。Nodeはcontext.pages.open、.NET/nativeはcontext.Pages.OpenAsyncを利用します。WebアカウントUIはsource:web-accountsと既存openを再利用します。

AppDock 0.19.0ではページボタンを上寄せ/下寄せへ利用者が配置し、間にセパレーターを置けます。Appletのページ宣言やopen APIは0.18.0から変わらず、配置はホストが管理します。

0.20.0はWebアカウントのNode navigateコマンドと、外部リンク確認を自身のboolean設定へ保存するexternalLinkSettingを追加します。契約と移行は[WebアカウントAPI](web-accounts.md)を参照してください。
