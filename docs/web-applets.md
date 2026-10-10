# WebApplet

0.26.14の共有枠・PC専用sessionと旧保存先を移行しない方針は[設定同期](settings-sync.md)を参照してください。

WebAppletはURLから追加する本体管理のAppletです。配布用のextension.jsonや別プロセスは不要で、Applet一覧・リボン・コマンド・ショートカットに表示します。1つのURLにつき1つの安定した`web.<UUID>`を発行し、最大64件を登録できます。ファイルとして導入するAppletにはこのID接頭辞を使いません。

## 設定と保存

管理入口はApplet一覧の組み込み「WebApplet」です。設定タブに追加/編集、ショートカットタブに将来のサイト用初期値を置きます。設定カテゴリの旧WebApplet入口は削除しました。管理項目`appdock.web-manager`はrendererの選択状態だけに存在し、manifest/runtime snapshot/更新/起動順/リボン/コマンド提供元へ追加しません。各サイトの`web.<UUID>`と保存形式は変更しません。ログタブはWebAppletに関係するsourceだけを表示します。

「Applet → WebApplet → 設定」またはAppletページ上部の「WebAppletを追加」から追加し、名前・HTTP(S)の開始URL・本体ページ/別ウィンドウ・ページ遷移・アカウントを指定して「変更をすべて保存」を押します。既存の共有draft/JSON/revision/競合検出を使い、Applet詳細の設定にも同じ編集内容を表示します。追加・削除は再起動なしで反映します。

`settings.json`の`webApplets`は`items:[{id,name,url,accountId,enabled,display,navigation,allowedOrigins,icon,imported?}]`と`shortcutDefaults:[{command,key,enabled,when}]`です。アカウント枠の一覧は含めません。旧設定では空の一覧とリロード=F5・戻る=Alt+左・進む=Alt+右の初期テンプレートを補います。名前/URLを変えてもIDを維持し、リボン配置・ショートカット・表示先を保持します。WebAppletは本体に含まれるため、個別のバージョン確認/更新対象にはしません。

アイコンは32pxのPNGとして設定へ保存します。Web側のmanifestから取り込むか、4MB以下のPNG/JPEG/WebPを選択できます。設定全体の既存1MB上限を維持するため、大量の画像では64件未満でも上限に達する場合があります。

Appletページで停止（無効化）すると、対象WebAppletのリボンアイコンを自動で隠します。再開すると保存済みの表示・順序・上下配置に従って戻ります。「設定 → リボン」の一覧には停止中も残すため、配置を編集できます。有効なWebAppletのページエラーはアイコンを隠す条件にしません。

## アカウント

「設定 → Webアカウント」は設定保存と独立した管理ページです。追加・名前変更・削除は専用ファイル`data/web-applets/accounts.json`（`{schemaVersion:1,accounts:[{id,name}]}`）へ即時保存します。削除待ちはPC専用のpending-deletion.jsonへ保存します。名簿の外部更新は自動再読み込みし、外部削除ではこのPCのログイン情報を消しません。名前変更はフォーカスが外れた時・専用ボタン・Enterで確定し、確定前のEscapeは保存済みの名前へ戻します。空欄やIME変換中は確定せず、変換を終えてフォーカスが外れた場合に確定します。同じ名前の重複要求を避け、名前変更と直後の削除/クリアは順番に実行します。フォーム/JSON/保存バーを表示せず、ほかの設定の下書きやrevisionを変更しません。設定JSONが不正な編集中でも管理ページへ移動でき、戻ると元のJSONを保持します。

専用のログイン保存枠を最大32件作れます。WebApplet側には使用アカウントの選択と管理ページへのリンクを置きます。`account.<UUID>`ごとの永続sessionをPC専用rootの`web-applets/sessions/<id>`へ置きます。同じ枠を選んだWebApplet間でCookie/サイトデータを共有し、異なる枠では分離します。初回は各サイトでログインします。

枠がない状態でWebAppletを追加すると、既定の「個人用」を即時作成します。WebAppletの下書きを破棄しても枠は残り、管理ページで削除できます。

GmailのPC専用root内`web-accounts/at365.gmail`、アカウント一覧、認証情報、観測処理は参照・変更しません。既存Gmailのログイン移行/コピーも行いません。WebAppletの削除/無効化は対象画面を破棄し、ログイン枠は残します。

「ログイン情報をクリア」「枠を削除」はホストの警告dialog（default/cancelはキャンセル）で確認してから即時実行します。クリアは同じ枠の画面を閉じてCookie/サイトデータ/cache/HTTP認証cacheを消去し、接続を閉じます。枠は残します。削除は枠と保存データを消します。保存済みWebAppletで使用中なら拒否し、dialog中とデータ消去後に割り当てを再検査します。UIでは未保存の割り当ても削除ガードに含め、処理中の枠を参照する設定の保存も拒否します。設定の保存は不要、IDを再利用しません。

このPCでの明示削除は、先にPC専用のpending-deletion.jsonへ記録してから共有名簿を原子的に更新します。名簿保存失敗時は削除待ち記録を戻し、登録中・設定で参照中の枠を回収しません。未生成のsessionディレクトリはその場で物理削除し、生成済みのsessionは先にデータを消去して、ディレクトリ回収を次回起動まで待ちます。終了時に削除済みsessionを再flushしません。起動時はsession生成前に削除待ちだけを回収します。ロック/権限等で消せなければ記録を保持して後続の起動でも再試行し、UIにも後処理待ちを表示します。

回収対象はWebApplet専用sessions直下の検証済みaccount IDだけです。登録中/設定から参照中/同プロセスで生成済みのsessionは回収せず、転送されたroot/対象junctionを拒否して、外部へのパスをたどりません。削除記録のない旧版の残存ディレクトリは自動で削除しません。

0.24.0公開版のsettings.jsonにあるwebApplets.accountsは、最初の起動で検証して専用ファイルへ移します。移行先の保存成功後に旧フィールドを除去し、accountIdとsessionディレクトリを保ちます。既存の専用ファイルがある場合はそちらが正本で、古いsettings.jsonを戻しても枠を復活/上書きしません。不正な専用ファイルや外部変更は自動上書きせず、エラーとして保持します。設定保存時はitemsの参照先を生きた枠一覧で検証します。

この保存形式は0.24.0公開版から変更されています。旧版へ戻す場合は、終了後にaccounts.jsonのaccountsをsettings.jsonのwebApplets.accountsへ戻してください。Cookie/sessionの移動は不要です。

## 遷移と表示

- `none`（開始ページに固定）：開始URLと同じ文書のhash移動を許可し、別ページへの遷移を止めます。
- `same-origin`（既定）：scheme/host/portが開始URLと一致するページを許可します。兄弟サブドメインや別ポートは許可しません。
- `any`：HTTP(S)ページへの移動を許可します。資格情報付きURL、file/javascript/data等は常に拒否します。

`allowedOrigins`は認証先等を完全なoriginで追加する明示設定です。固定モードでもこの例外は許可します。トップレベルのクリック/redirect/新しいWindow要求を検証し、許可された新規Window要求は現在のViewへ読み込みます。子フレームにはトップレベル制限を適用しません。同一文書内のhistory移動も検査します。これはトップレベル遷移の規則で、画像やAPI通信を限定するネットワークフィルターではありません。

Webページにはpreload/Node/ホストIPCを公開せず、sandbox/contextIsolation/webSecurityを維持します。サイトのデバイス権限は拒否します。Electron内での認証可否は各サイトに依存します。許可されていない転送を偽装や証明書検証の解除で回避しません。

画面は明示的に開いたときに作成し、同じWebContentsViewをpage/window間で再利用します。独立Windowの位置はPC専用rootの`web-applets/windows/<webId>.json`へ保存します。Windowの×は非表示です。非選択時の常時描画/新着監視は汎用WebAppletでは保証しません。Gmailの既存背景描画契約は継続します。

本体ページの上部には戻る/進む/リロード/開始ページと状態を表示します。別Windowでも同じ操作をコマンド検索や割り当てたキーから実行できます。Webページにフォーカス中のローカルキーはCtrl/Alt付き、F1～F24、Pauseを扱い、通常の文字入力キーを取りません。URLのquery/fragmentをエラーログへ記録しません。

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

`tests/web-applets.test.cjs`は設定移行、ID/参照、危険なURL、origin比較、Web提供JSONの権限境界を確認します。`tests/web-profiles.test.cjs`は旧一覧の移行、設定byte/revision不変の即時保存、削除待ちの再起動/失敗再試行、参照/生成済みガード、junction/パスの削除境界と外部変更/不正ファイルの保持を確認します。`scripts/web-applets-ui-test.cjs [win-unpackedのEXE]`は独立ページ・即時操作・警告の取消/確認・下書き保持と従来のWeb表示を確認します。`scripts/web-profiles-migration-ui-test.cjs <保持した0.24.0のwin-unpacked EXE>`は旧版で作った実Cookieが移行後も残ることを隔離profileで確認します。旧配布物の再発行前に試験用コピーを保持し、現行EXEを旧版として試験しません。`scripts/web-applets-portable-test.cjs [単一EXE]`は実EXEの隔離コピーを通常起動して確認します。実サイトのログインや長時間動作とは区別します。
