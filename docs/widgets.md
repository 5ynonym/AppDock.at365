# Appletウィジェット（AppDock 0.10.0以降）

Appletは内容を提供し、ホストが描画・更新・ホームへのピン留め・デスクトップ配置を担当します。Applet独自のウィンドウやHTMLを埋め込む方式ではありません。Node、.NET DLL、native EXEのどのruntimeでも同じAPIを使えます。

## 提供する側

`extension.json`の`capabilities`に`widgets`を追加し、停止中にも一覧を表示できるよう、安定したIDと内容を`widgets`に宣言します。IDはApplet IDで始めます。1 Appletに16定義、内容は128KB以内です。

```json
{
  "capabilities": ["widgets"],
  "widgets": [
    { "id": "example.status", "title": "状態", "content": { "kind": "text", "body": "待機中" } }
  ]
}
```

Node:

```ts
await context.widgets.replace([
  { id: 'example.status', title: '状態', content: { kind: 'text', body: '稼働中', facts: [{ label: '処理済み', value: '12件' }] } }
]);
```

.NET:

```cs
await context.Widgets.ReplaceAsync([
    new("example.status", "状態", new("text") {
        Body = "稼働中", Facts = [new("処理済み", "12件")]
    })
], cancellationToken);
```

`ReplaceAsync` / `replace`はAppletの現在の定義をまとめて置き換えます。宣言していないIDは拒否します。表示内容の変更に必要なときだけ呼び出してください。停止・通信断・再起動時は実行中の定義を解放し、停止中のカタログはmanifestに戻ります。取り外されたウィジェットの保存済み配置は保持します。

`content.kind`は`text`（`body`と`facts`）、`clock`（24時間制、`showSeconds`）、`date`（月日と曜日）です。日時は`locale`と`timeZone`を省略でき、タイムゾーン未指定時は端末の現地時刻です。日付は地域別の並び替えをせず`M/d ddd`の順に表示し、Watchのen-USは元のInvariantCultureと同じ`10/7 Wed`になります。任意のHTML、CSS、スクリプト、外部ページは受け取りません。

日時の更新はホスト画面内で行い、毎秒のRPC、画像生成、Appletタイマーは不要です。表示中のウィジェットで秒が必要なら画面全体で1本の秒タイマー、不要なら分タイマーを使います。ホームを離れたりホスト画面が非表示になったりすると更新を止め、再表示で現在時刻を取得します。

`fontFile`にはAppletフォルダー内のTTF/WOFF2相対パスを指定できます（5MB以内）。ホストは実パスを検証して、登録済みのフォントだけを専用ローカルURLから提供します。Appletはファイルを発行物に含めてください。

`initialPlacement`は初回登録時だけの既定配置です。一般のAppletは省略するとホーム・デスクトップとも非表示です。既存アプリの移行に使う場合も、保存済みの配置は上書きしません。

ウィジェットのデスクトップ表示をコマンドから操作する場合は、`Widgets.GetPlacementsAsync` / `widgets.placements`で現在の配置を取得し、`Widgets.SetDesktopAsync(ids, enabled)` / `widgets.setDesktop(ids, enabled)`を使います。自分のAppletのIDだけを操作でき、ピン留め・位置・表示順は保持します。

## 表示する側

ホームへのピン留めとデスクトップ表示は独立しています。`settings.json`の`widgets`にIDごとの配置を保存し、既存のsettingsは空の`widgets`を補って読み込みます。保存には設定revisionを使い、手動編集や別画面の変更との競合時は上書きを拒否します。

主な配置項目は`home`、`order`、`desktop`、`monitor`、`layer`（`front` / `desktop`）、`position`（`anchor` / `free`）、9方向の`anchor`、`x` / `y`、`width` / `height`、`fontSize`、`opacity`、`color`です。位置・サイズ・文字サイズの単位はDIPです。アンカーが右端・下端なら正のオフセットは内側へ、中央なら右・下へ加算します。自由位置は選択モニターの左上からの座標です。

モニター未接続時はメインへ退避し、選択したIDを保持します。画面からはみ出す配置は表示時に補正します。再接続、解像度・DPI変更、resumeで配置を再評価します。

0.10.1以降の`horizontalAlign`は`auto` / `left` / `center` / `right`、`verticalAlign`は`auto` / `top` / `center` / `bottom`です。省略した既存設定は`auto`として読み込みます。デスクトップのautoはアンカー側に文字を寄せ、ホームのautoは中央です。明示的な文字揃えはホームとデスクトップで共通です。アンカーを左上、オフセットを0、文字揃えをautoにすると、文字の左上が画面左上に揃います。

時計は時分と半サイズの秒をそれぞれ一続きの文字列で描画し、フォント本来の比例幅・字間を保ちます。秒で全体幅が変わっても、左寄せなら左端、右寄せなら右端、中央寄せなら中心がウィジェット内の設定位置に固定されます。日時のSVGは実描画の境界で切り出し、フォントのサイドベアリングや行高の空白を配置に含めません。寸法取得には[TextMetricsの実描画境界](https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics)を使い、同じフォント・サイズ・文字列の計測結果を上限付きで再利用します。指定サイズに収まらないときは全体を縮小します。

ウィジェット管理の見出しと保存バーは設定ページと同じレイアウトで、上部に固定します。下のフォームだけをスクロールし、保存・再読み込みは右側に配置します。文字揃えの下書きはプレビューへ即時反映します。

透過デスクトップはモニターと表示階層ごとに1枚の画面で描画します。同じ画面上で日時タイマーと描画資源を共有し、非表示・停止で不要になった画面を破棄します。前面表示はElectronのalways-on-top、デスクトップ表示は既存.NETホストの専用モードがWindows Shellのアイコン表示面に子ウィンドウとして固定します。背景の表示を使うときだけ、全画面で共通のShellブリッジを起動します。壁紙は変更しません。

通常のデスクトップ画面はタスクバーに出さず、フォーカスを奪わず、クリックを透過します。ドラッグ移動時だけ1つの編集ウィンドウを一時的に前面表示し、「完了」で自由位置として保存します。「取消」、Esc、2分の期限、Applet停止で保存せず閉じます。編集中にほかの設定が変わった場合は保存を拒否し、編集画面を保持します。

Shellの表示先が見つからない／固定に失敗した場合は管理ページに理由を表示し、5秒ごとに再試行します。成功したように前面へ代替表示しません。Explorer再起動で表示面が失われた場合も再作成・再接続します。このShell表示面はWindowsの実装に依存するため、将来のWindows変更時には実機で再確認してください。

## Watchの移行

Watch 0.2.0は`runtime: dotnet`のDLLです。時計・日付を別IDで提供し、元のHatten.ttfを外部リソースとして同梱します。旧`visible` / `showDate` / 上下配置 / 余白 / 文字サイズ / 不透明度は初回配置に引き継ぎ、以後はホストのウィジェットページが配置の正本です。旧モニターDeviceNameは新しいElectron画面IDと異なるため、初回はメインへ退避します。ウィジェットページで画面を選び直してください。旧設定値そのものは消しません。

`at365.watch.show` / `.hide` / `.toggle`と既定のPauseを維持します。コマンドは時計と日付のデスクトップ表示をまとめて操作し、ホームのピン留めには影響しません。Applet設定には秒表示を残します。独自WPFウィンドウが必要なほかのAppletは引き続きnative EXEを使えます。

## 検証

```powershell
.\dev.bat test
dotnet run --project ..\Applet.Watch.at365\Applet.Watch.RegressionTests -c Release
..\Applet.Watch.at365\publish.bat
.\dev.bat run test:widgets
.\dev.bat exec node scripts/widgets-ui-test.cjs publish/win-unpacked/AppDock.at365.exe
```

UI検証は隔離profileを作成し、Watchの発行済みDLLをコピーして使用します。実利用先の設定・Applet・壁紙を変更しません。移動検証ではWindowsのウィンドウ座標をプログラムから変更し、完了・取消を実画面で操作します。物理マウスでのドラッグ、実モニター着脱、Explorerの強制再起動、RDP、長期常駐は別途実機確認が必要です。

APIの参照: [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window)、[Microsoft SetParent](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setparent)。SetParentのDPI制約に従い、固定の失敗を利用者に表示します。
