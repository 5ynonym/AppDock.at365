# Appletページとリボン（ページAPI: AppDock 0.18.0、リボン配置: 0.19.0）

Appletは画面のHTML/React・操作・データ処理を実装し、ホストは左のリボン、表示先、UIプロセス、画面領域、ウィンドウ状態、終了処理を管理します。同じローカルUIのWebContentsViewを本体ページと別ウィンドウへ移動し、表示先の変更で再ロードしません。既存のWPF/WinForms/nativeウィンドウを自動変換する契約ではありません。

## manifestと起動

`minimumHostVersion: "0.18.0"`、`capabilities: ["pages"]`と`pages`を宣言します。最大10ページ、安定したApplet内ページID、80文字までのtitleです。iconは`mail / clock / image / folder / extensions`、省略時はextensions。HTML/画像をリボンへ直接挿入しません。openCommandは自身の宣言済みコマンドで`activateOnExecute:true`を必須にします。無効化中はリボンから隠しますが、コマンドの明示実行による起動は引き続き可能です。

```json
{
  "commands": [{ "id": "example.applet.open", "title": "画面を開く", "activateOnExecute": true }],
  "pages": [{
    "id": "main", "title": "画面", "icon": "folder", "source": "local",
    "ui": "web/index.html", "openCommand": "example.applet.open", "defaultDisplay": "page"
  }]
}
```

`source:local`のuiはApplet内の実HTMLファイルです。実パスを照合し、シンボリックリンクを含むフォルダ外参照を拒否します。相対資産とCSPはApplet側に置きます。

Nodeのコマンドハンドラーは`context.pages.open('main')`、.NET/nativeは`context.Pages.OpenAsync("main", cancellationToken)`を呼びます。RPCは`host.pages.open`と`{id:"main"}`です。自身のローカルページのみ対象です。

WebアカウントUIでは`source:"web-accounts"`を使い、uiを重複指定しません。webAccounts定義とweb-accounts capabilityも必要で、1つのAppletにつきこのsourceは1ページまでです。既存`context.webAccounts.open()`を呼ぶコマンドをopenCommandへ指定します。ページ宣言のない既存WebアカウントAppletは別ウィンドウのままです。

## ローカルページ用の限定ブリッジ

ホストのpreloadが`window.appletPage`を公開します。sandbox/contextIsolationを有効、Nodeと`window.dock`は非公開です。

- `snapshot(): Promise<{dark:boolean,settings:Record<string,unknown>}>`: 本体テーマと自身のmanifest設定値。settings capabilityがなければ空です。
- `executeCommand(id): Promise<unknown>`: 自身の実行中の登録コマンドのみ。任意RPCや他Applet/本体コマンドは渡しません。
- `onChanged(callback): () => void`: テーマ/設定の変更通知。UI側は返された解除関数を使います。

画面の操作は自身のコマンドからNode/.NETの処理を呼びます。IPCはホストがUIのWebContents、main frame、厳密なローカルURLを照合し、リモートWeb画面には公開しません。Webアカウントsourceは既存の限定`window.webAccounts`を継続します。

## 表示先と保存互換性

本体の「設定 → 対象Applet」にページごとの表示方法を追加します。保存先は`settings.json`の`extensions.<id>.pages.<pageId>.display`（page/window）。省略時はmanifestのdefaultDisplay、さらに省略時はpage。既存のApplet設定とは別のホスト管理領域です。表示先変更は次のopenへ反映し、表示中の画面なら直ちに載せ替えます。非表示の画面を設定変更だけで前面へ出しません。

独立ウィンドウの通常位置/サイズ/最大化は保存します。Webアカウントは既存`web-accounts/<id>/window-state.json`を引き続き使用し、localは`pages/<id>/<pageId>/window-state.json`です。閉じる操作では隠し、停止/異常終了時に画面を破棄します。表示中のページを停止した場合は本体をホームへ戻します。

本体Reactのページ領域はホストpreloadの`pageViewport`経由でDIP/整数座標を報告し、ホスト側でも検証・client領域へclipします。AppletのUIにはページ内の0,0から始まる座標を見せます。リボン・タイトルバー・ステータスバーを覆いません。コマンドパレット中はページViewを外し、本体overlayへの入力を確保します。GmailのviewportはそのローカルUI内の座標のままです。

GmailのアカウントViewとsessionを表示先の変更で再作成しません。別ページ・UI内の新着一覧・非表示/最小化では従来の背景Windowへparkし、keepActive/観測/通知を維持します。フォーカス引継ぎは現在アクティブな操作画面内に限定します。

## リボン

標準6項目（home/extensions/settings/logs/theme/profile）と、導入Appletのpagesを一覧にします。AppletページのリボンIDは`page:<extensionId>:<pageId>`です。配置位置はホストが決め、名前・選択状態・キーボード操作は本体ボタンとして描画します。

すべてのApplet（Gmail/WebAppletを含む）は無効化中だけ実リボンから隠し、有効化時に元の配置へ戻します。リボン設定の一覧と保存済みの表示・配置は保持します。開始待ちやエラー状態でも、有効なAppletのリボンは表示します。

「設定 → リボン」で表示チェック、上下配置、ドラッグ、上下ボタン、セパレーターの追加・削除、初期化を提供します。各グループの順番はorderを絞り込んで表示します。保存は既存の設定下書き/revision/全保存に従います。`ribbon:{order:string[],hidden:string[],bottom:string[],separators:string[]}`のbottomは下寄せのID、separatorsは`separator:<stable-id>`の登録です。セパレーターも順番・非表示・配置の対象です。重複/不正ID/未登録セパレーターへの参照を拒否し、各配列は500件、separatorsは50件までです。ribbon全体が未指定ならテーマ/プロフィールを下寄せにします。0.18.0の既存order/hiddenを持つ設定はbottom/separatorsを空配列として移行し、既存の上寄せを保ちます。初期化すると新しい既定配置へ戻ります。order未指定の新しいボタンは追加し、未導入Appletの設定は保持します。設定ボタンを隠してもリボンの右クリックか本体の設定コマンドから復帰できます。

## 検証

`scripts/applet-pages-ui-test.cjs [win-unpackedのEXE]`は隔離profile・ローカルページfixture・GmailのオフラインHTTPS fixtureを使います。画面の実幅、UI/入力/remote WebContentsの同一性、ページ/Window切替、コマンド検索、背景/最小化監視、Cookie再起動保持、リボンの保存/復帰、停止時破棄を確認します。実GmailのOAuth/実受信とは区別します。単一EXEのラッパーへElectron.launchを直接使用せず、Gmailのscripts/test-portable.cjsによる通常起動後のCDP接続を使います。

既存のWebアカウントGUI試験はUIをBrowserWindowのrootとして想定していたため、UIページの取得はElectron contextの全pagesを使い、親Windowの操作はview所有関係を照合してください。ローカルUIのcapturePageは子WebContentsViewの合成画面を含まないため、各Viewのキャプチャと実領域も照合します。

`scripts/ribbon-layout-ui-test.cjs [win-unpackedのEXE]`は上下配置・セパレーター操作・グループ間ドラッグ・再起動保持・削除/初期化と、Gmailの余白/本文の上端を確認します。ドラッグの試験時だけ画面を縮小し、移動元と移動先を同時に可視領域へ収めます。
