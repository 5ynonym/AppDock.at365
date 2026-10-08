# WebApplet（AppDock 0.24.0）

WebAppletはURLから追加する本体管理のAppletです。配布用のextension.jsonや別プロセスは不要で、Applet一覧・リボン・コマンド・ショートカットに表示します。1つのURLにつき1つの安定した`web.<UUID>`を発行し、最大64件を登録できます。ファイルとして導入するAppletにはこのID接頭辞を使いません。

## 設定と保存

「Applet → WebAppletを追加」または「設定 → WebApplet」から追加し、名前・HTTP(S)の開始URL・本体ページ/別ウィンドウ・ページ遷移・アカウントを指定して「変更をすべて保存」を押します。既存の共有draft/JSON/revision/競合検出を使い、Applet詳細の設定にも同じ編集内容を表示します。追加・削除は再起動なしで反映します。

`settings.json`の`webApplets`は`accounts:[{id,name}]`と`items:[{id,name,url,accountId,enabled,display,navigation,allowedOrigins,icon,imported?}]`です。旧設定では空の一覧を補います。名前/URLを変えてもIDを維持し、リボン配置・ショートカット・表示先を保持します。WebAppletは本体に含まれるため、個別のバージョン確認/更新対象にはしません。

アイコンは32pxのPNGとして設定へ保存します。Web側のmanifestから取り込むか、4MB以下のPNG/JPEG/WebPを選択できます。設定全体の既存1MB上限を維持するため、大量の画像では64件未満でも上限に達する場合があります。

## アカウント

専用のログイン保存枠を最大32件作れます。`account.<UUID>`ごとの永続sessionをEXE隣の`.appdock/web-applets/sessions/<id>`へ置きます。同じ枠を選んだWebApplet間でCookie/サイトデータを共有し、異なる枠では分離します。初回は各サイトでログインします。

Gmailの`.appdock/web-accounts/at365.gmail`、アカウント一覧、認証情報、観測処理は参照・変更しません。既存Gmailのログイン移行/コピーも行いません。WebAppletの削除/無効化は対象画面を破棄し、ログイン枠は残します。

「ログイン情報を消去」は確認後、その枠を使うWebAppletを閉じてCookie/サイトデータ/cacheを消去します。「枠の登録を削除」は使用中の枠では無効です。登録だけの削除では保存済みサイトデータを残すので、完全消去するときは先に消去操作を使います。IDを再利用しません。

## 遷移と表示

- `none`（開始ページに固定）：開始URLと同じ文書のhash移動を許可し、別ページへの遷移を止めます。
- `same-origin`（既定）：scheme/host/portが開始URLと一致するページを許可します。兄弟サブドメインや別ポートは許可しません。
- `any`：HTTP(S)ページへの移動を許可します。資格情報付きURL、file/javascript/data等は常に拒否します。

`allowedOrigins`は認証先等を完全なoriginで追加する明示設定です。固定モードでもこの例外は許可します。トップレベルのクリック/redirect/新しいWindow要求を検証し、許可された新規Window要求は現在のViewへ読み込みます。子フレームにはトップレベル制限を適用しません。同一文書内のhistory移動も検査します。これはトップレベル遷移の規則で、画像やAPI通信を限定するネットワークフィルターではありません。

Webページにはpreload/Node/ホストIPCを公開せず、sandbox/contextIsolation/webSecurityを維持します。サイトのデバイス権限は拒否します。Electron内での認証可否は各サイトに依存します。許可されていない転送を偽装や証明書検証の解除で回避しません。

画面は明示的に開いたときに作成し、同じWebContentsViewをpage/window間で再利用します。独立Windowの位置は`.appdock/web-applets/windows/<webId>.json`へ保存します。Windowの×は非表示です。非選択時の常時描画/新着監視は汎用WebAppletでは保証しません。Gmailの既存背景描画契約は継続します。

本体ページの上部には戻る/進む/再読み込み/開始ページと状態を表示します。別Windowでも同じ操作をコマンド検索や割り当てたキーから実行できます。Webページにフォーカス中のローカルキーはCtrl/Alt付き、F1～F24、Pauseを扱い、通常の文字入力キーを取りません。URLのquery/fragmentをエラーログへ記録しません。

## Web側の推奨設定JSON

追加時に開始URLから`<link rel="manifest" href="...">`を検出します。見つからなければ同じoriginの`/.well-known/appdock.json`を試します。新規URLの入力を終えると取得し、手動の「Web側の推奨設定を取得」でも再取得できます。不在/取得失敗/不正JSONでも手動設定で追加できます。

```json
{
  "name": "ユキのWebアプリ",
  "short_name": "Webアプリ",
  "start_url": "/app/",
  "icons": [{ "src": "/icon.png" }],
  "appdock": {
    "schemaVersion": 1,
    "navigation": "same-origin"
  }
}
```

`name/short_name/start_url/icons`はWeb App Manifestに沿い、`appdock`はAppDock独自の初期設定項目です。`navigation`は`none`または`same-origin`だけを取り込み、`any`/追加許可origin/使用アカウント/実行コマンド/ホスト設定は取り込みません。標準`scope`は遷移を遮断するものではないため、許可規則には変換しません。

取得元・start_url・アイコン・転送先は登録URLと同じoriginに限定します。取得はログイン状態を持たない一時sessionで行い、HTML/画像256KB、JSON64KB、各要求5秒、転送最大3回を検査します。転送後のURLを相対パスの基準にし、別originへ取得要求を送りません。Web提供アイコンはPNG/JPEG、最大2048pxです。取得後に一時sessionのサイトデータを消去します。

取り込んだ値を`imported`へ保存し、再取得では前回の初期値のままの項目だけ更新します。手動で変えた名前/アイコン/URL/遷移を上書きせず、バックグラウンドでJSONを定期反映しません。アイコンは検証したPNGへ変換します。外部JSONをextension.jsonやsettings.jsonとして直接実行・mergeしません。

## 開発検証

`tests/web-applets.test.cjs`は設定移行、ID/参照、危険なURL、origin比較、Web提供JSONの権限境界を確認します。`scripts/web-applets-ui-test.cjs [win-unpackedのEXE]`はローカルHTTP fixtureと隔離profileで追加/取込/手動上書き保持/移動/入力保持/セッション分離/消去確認/再起動/停止/削除を確認します。`scripts/web-applets-portable-test.cjs [単一EXE]`は配布EXEのSHA256を保つ隔離コピーを通常起動し、UI登録・well-known JSON・表示切替・専用Cookie・再起動・停止を確認します。実サイトのログインや長時間動作とは区別します。
