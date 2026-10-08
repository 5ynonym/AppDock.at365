# WebアカウントAPI（v0.16.1）

0.18.0では[Appletページ](applet-pages.md)の`source:"web-accounts"`宣言により、既存のReact UIを本体ページ/別ウィンドウで共用できます。IPCの送信元はWindowのrootではなく、専用UIのWebContentsで照合します。以下の旧版説明の「操作Window」は現在の表示先と読み替えてください。ローカルUIのviewportはそのUI内の座標のまま、ホストが本体ページへの配置を管理します。アカウントView/永続セッション/背景描画の契約は継続します。

Node Appletへ、Webサービスのアカウント別画面と永続セッションを提供します。WebContentsViewの生成・ログイン領域・アカウント切替・UI IPC・破棄はホスト、サービス固有のDOM観測と通知はAppletの責務です。.NET SDKには今回専用ラッパーを追加していません。既存API v1/Node/.NET/nativeの契約は維持します。

## manifest

任意の`keepActive:boolean`は既定falseです。0.15.2ではobserveOriginの観測JSが`ready:true`を返した後、Chromiumの`Emulation.setFocusEmulationEnabled`を適用します。背景では30秒ごとに250msだけ解除して再適用し、DOMの準備後に初期化される受信処理の同期開始・再開を促します。native focusがあるWebContentsではエミュレーションを解除し、利用者の通常のfocus/blurを優先します。Windowsのフォーカス・選択枠・入力を動かさず、ページを再読み込みしません。同一文書のhash/history移動では維持し、別文書へのメインフレーム遷移開始時にタイマーと自身のDebugger接続を解除します。認証等の他originには適用しません。利用者がDevToolsを開いている間は干渉せず、閉じたときに再適用します。他のDebugger接続を切断しません。この契約を使うAppletの最低ホスト版は0.15.2です。

Windowsでは起動前に`CalculateNativeWinOcclusion`をdisable-featuresへ追加します。既存のfeature指定を保ち、画面外/透明Windowに対する描画停止を防ぎます。0.15.0の透明Windowだけでは、通常起動の初回描画/アクティブ状態が不足する場合がありました。GmailはkeepActiveを明示的に有効にしています。

参照: [Chromiumのページアクティブ設定](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setFocusEmulationEnabled)、[Electron Debugger](https://www.electronjs.org/docs/latest/api/debugger)。アクティブ維持の接続はWebContentsの破棄より前に解放し、破棄後にWebContents.debuggerを再取得しません。

基本APIは`minimumHostVersion: "0.12.0"`と`capabilities: ["web-accounts"]`が必要です。`report`のdataやUIの`viewport`を使用するAppletは`minimumHostVersion: "0.13.0"`を指定してください。

初回未表示からWebページの描画を継続するAppletは、0.15.1以降を指定してください。非選択Viewは専用Windowへ可視・実寸で接続したまま保持します。この親Windowはopacity:0・全ディスプレイ外・frameなし・taskbar/フォーカス対象外でshowInactiveし、初回ネイティブ描画を開始します。ディスプレイ構成変更でも画面外へ配置し直します。0.13.1の一度も表示しない親WindowはrAFを維持してもfirst-contentful-paintを抑制することが追加実測で分かりました。操作Windowと背景WindowはbackgroundThrottling=false。選択中Viewのみ可視の操作Windowへ移し、非選択・viewport(null)・非表示・最小化では背景Windowへ戻します。全Viewと背景Windowを停止時に破棄します。

```json
{
  "webAccounts": {
    "url": "https://mail.google.com/mail/u/0/#inbox",
    "origins": ["https://mail.google.com", "https://accounts.google.com", "https://myaccount.google.com"],
    "observeOrigin": "https://mail.google.com",
    "ui": "web/index.html",
    "observer": "web/observer.js"
  }
}
```

URLは宣言したHTTPS origin内、観測先もその1つに限定します。ui/observerは実パスでもApplet内のファイルだけを許可し、observerは100KB以内。任意の`itemOpener`も同じ資産境界・100KB上限の関数式ファイルです。既定の画面枠は左236px・上146pxを予約します。0.13.0ではUIが`viewport`で変更できます。最小ウィンドウ900×640、既定1280×900です。

## Node/RPC

0.16.1の画像要求は各アカウントのsessionとcredentials:includeを使用します。Googleの認証依存画像URLは未認証で取り直すと標準画像を返すためです。Cookieの適用と送信先はChromiumの当該セッションに閉じ、他アカウントのCookieをコピーしません。転送先の厳密なorigin制限とサイズ/時間上限は維持します。cycleは保存と既存Viewの切替だけを行い、未表示のUIは作成せず、非表示/最小化や現在のフォーカスを保ちます。明示的なopenは従来どおりウィンドウを表示します。

0.16.0はローカルUIに`move(id, 1|-1)`（隣の枠と順番を交換、端では変更なし）と`setMonitoring(id, boolean)`を追加します。並べ替えはaccountsの配列順だけを保存し、UUID・選択枠・セッション・通知音を維持します。snapshot/readの各枠には`monitoring:boolean`を追加し、旧保存形式の未指定はtrueです。OFFではホストもattentionとdataを直ちにクリアし、遅延reportからの再計上を抑制します。ページ更新と読取は保持し、検知・通知・音を止める判断はNode Appletが行います。

`read`は`monitoringResets:string[]`も返します。ON/OFFの遷移を次のreadまで保持し、OFF→ONが読取間隔内に発生しても基準を消去できます。Appletは該当するmonitorをresetし、個別/全体の監視OFFなら履歴・件数を消去してください。再開時の未読取り込みはAppletの方針です。

任意のmanifest `avatarOrigins:string[]`は最大10個の厳密なHTTPS originです。観測結果のトップレベル`avatar:string`から、そのoriginの画像だけをホストが[ClientRequest](https://www.electronjs.org/docs/latest/api/client-request)で取得します（各アカウント固有のログイン済みセッション・全要求で配信先を再検証・最大3回の転送・合計5秒上限）。PNG/JPEG/WebP/GIFのみ、ストリームを含め64KBまで。デコード後64×64のPNGへ変換し、snapshotの`avatar`へdata URLを返します。失敗・画像未取得は空文字、originを離れたら破棄します。停止・削除時に待機を中断し、保存ファイル/ログ/Node readへ画像バイトを出しません。UIのCSPは外部画像を許可せず、data画像だけで表示できます。Session.fetchのmanual redirectは転送レスポンスを返さず取消エラーとなるため、ClientRequestのredirectイベントから転送先を検証します。取得はDOM読取を待たせず、同じURLは成功後キャッシュ、失敗時は最短60秒で再試行します。この契約を使うAppletの最低ホスト版は0.16.0です。

| Node | RPC | 処理 |
| --- | --- | --- |
| `context.webAccounts.start()` | `host.webAccounts.start` | 全枠を非表示で読込開始、UIを開かない |
| `context.webAccounts.open()` | `host.webAccounts.open` | 操作用ウィンドウを表示・復帰 |
| `context.webAccounts.cycle(1|-1)` | `host.webAccounts.cycle` | 次/前の枠へ循環して選択。ウィンドウ表示/復元/フォーカス移動なし（0.16.1） |
| `context.webAccounts.read()` | `host.webAccounts.read` | 各枠の観測結果とUIからのクリア要求を返す |
| `context.webAccounts.report(id, status, attention, data?)` | `host.webAccounts.report` | アカウントの状態表示と一時UIデータを更新 |

`read`の戻り値は`{ dark, selected, accounts, acknowledged, monitoringResets }`。アカウントは`id/name/monitoring/avatar/url/loading/error/canGoBack/canGoForward/observation/status/attention/data/sound/soundError`を持ちます。型は[src/shared/web-accounts.ts](../src/shared/web-accounts.ts)、Node contextは[src/main/node-worker.ts](../src/main/node-worker.ts)が正本です。dataはJSON化可能な50KB以下の値で、ローカルUIのsnapshotへ渡します。省略時はnull。ホストはファイルやログに保存せず、Applet停止時に破棄します。Nodeへの`read`ではdataをnull、avatarを空文字にし、最大10枠の観測と履歴の二重送信でJSON-RPCの1MB制限を超えないようにします。

観測JSは式としてJSON化可能な値を返します。ページがobserveOrigin内で読み込み済みの場合だけ、**isolated world 1001**で実行します。1枠の観測結果は60KBまで、待機は800msまで。同じ枠で未完了の観測を並行起動しません。逐次読取で最大10枠を扱い、ナビゲーション世代/URLの変化・停止・削除があれば遅い結果を捨てます。ページの再読込や通信APIポーリングは行いません。ページ遷移/プロセス終了でisolated worldのObserverも破棄されます。

0.16.3では、観測の任意の`accountName`（制御文字なしの1〜60文字）を仮名の置換に使います。新規枠は`name:"新しいアカウント"/temporaryName:true`で保存します。取得成功または明示的なrenameで`temporaryName:false`とし、以後は自動変更しません。旧保存形式でフラグがない場合は「新しいアカウント」または「アカウント N」の完全一致だけを仮名と扱い、利用者の名前・UUID・ログイン・順番・音・監視設定を保持します。Gmail固有の名前/メール抽出はAppletのobserverへ置きます。受信トレイのreadyとは独立して処理し、監視OFFでも本人情報を取得できます。

ローカルReact UIのpreloadは`window.webAccounts`へ`snapshot/add/select/rename/remove/navigate/acknowledge/viewport/onChanged`を公開します。0.14.0は`cycle/openItem/setSound/pickSound/testSound`を追加します。ホストはsenderのWebContents・main frame・厳密なローカルUI URLを検証し、そのUI自身のAppletへ割り当てます。パネルの任意HTML実行機能とは独立しています。

`openItem(id,key): Promise<boolean>`は任意のitemOpenerを宣言したAppletのみが使えます。アカウントを選択し、読込済みのobserveOriginページへ、JSON文字列化した1〜200文字のkeyをisolated world 1001で渡します。UIから任意のソース/URLを受け取りません。itemOpenerは関数式として対象の可視行を探し、ユーザーが求めた項目だけを開いてtrueを返します。対象を確認できない場合はfalse。未宣言・認証ページ・読み込み中もfalseです。サービス固有のセレクターとフォルダー復帰/代替案内はAppletへ置きます。項目を開く操作でサイトの既読状態等が変わり得るため、背景監視からは実行しません。

0.14.0以降のアカウントsnapshotは`sound:{enabled:boolean,file:string,name?:string}`も返します（nameは0.15.0追加）。初期値はfalse/空文字（標準ビープ）。`setSound(id,sound)`で保存し、`pickSound(id)`は親付きWAV選択ダイアログでfileを変更、取消は変更なし。設定/試聴にはaudio、選択にはfile-dialogも必要です。`testSound(id)`はON/OFFにかかわらず既存queueSoundで試聴します。Nodeではsoundをreadから受け取り、通知と独立した条件でaudio.playを呼びます。Windows通知の音との二重再生はsilent:trueで抑制してください。

0.15.0では選択した絶対パスのWAVをRIFF/WAVE・16MB以下で検証し、保存領域の`sounds/<SHA256>.wav`へコピーします。同じ内容は共有し、元ファイルは変更しません。nameは元のファイル名です。startで旧外部パスも移行し、失敗した枠は元設定を保持し、soundErrorと実効的なOFF/空パスを返します。再選択で復旧できます。コピーは一時ファイルからrenameし、停止時はアカウントが参照していない管理用hash名のWAVだけを削除します。利用者の任意ファイルは削除しません。

0.15.0のsnapshot/readには`dark:boolean`も含まれます。AppDockのテーマを反映したnativeTheme.shouldUseDarkColorsで、テーマ変更時にローカルUIへonChangedを通知します。サービス自身のWebページのCSSは変更しません。

操作UIと各WebContentsのbefore-input-eventで、自分のAppletの登録済みコマンドに一致するローカルshortcutだけを実行します。利用者設定を毎回参照し、global指定済みのコマンドはここから実行しません。キー長押し・IME入力中は実行せず、同じキーに複数の自身のコマンドが一致した場合も実行しません。Gmailの初期Ctrl+Tab/Ctrl+Shift+Tabはホストの既定shortcutsで、明示の空配列/変更を保持します。

0.16.3のcycleは、切替前に操作Windowがアクティブかつ表示中で、選択中WebContents自身が入力フォーカスを持つ場合だけ、接続後の切替先WebContentsへ入力を渡します。Windowのshow/focus/restoreは呼びません。ローカルUIの入力欄、別Windowの前面、未表示/非表示/最小化は保持します。切替後に毎回wc.focusを呼んでからキーを送る試験は不具合を隠すため、最初の1回だけフォーカスを設定し、以後はgetFocusedWebContentsに連続してキーを送る試験を使います。

`viewport({x,y,width,height})`はローカルUIのclient座標・DIPで表示領域を指定し、ホストがclient領域内へ切り詰めます。各値は0〜100000の整数（幅・高さは1以上）です。`viewport(null)`は操作WindowからViewを外して背景Windowへ戻し、アカウント切替後も操作画面へ表示せず、ページと監視を続けます。UIではResizeObserver等で実領域を再送してください。未呼出しの旧UIは既定レイアウトを維持します。

[Electron WebPreferences](https://www.electronjs.org/docs/latest/api/structures/web-preferences)のbackgroundThrottling=falseだけでは、非表示・切り離しされたViewのrAFを維持できないことを実測しました。document.visibilityStateがvisibleでもrAFが止まるため、DOMの可視性判定だけを検証して済ませません。背景保持はGmailのスクリプト改変やフォーカス移動・周期的reloadを行わず、サイト側の通常の更新を待ちます。描画を維持する資源コストはアカウント数に応じます。

## 保存とライフサイクル

0.17.1ではローカルUIのsnapshotに`settings?: Record<string, boolean | string>`、preloadに`setSetting(key, value): Promise<void>`を追加しました。settings capabilityを持つ自身のAppletのmanifestで宣言したboolean/静的select項目だけを公開し、未保存時はmanifestのdefault（未指定はbooleanならfalse、selectなら空文字）を使います。未宣言キー・定義の型・選択肢に合わない値は拒否します。ホスト全体や他Applet、未宣言の保存項目は読み書きできません。NodeのreadにはこのUI用設定を追加しません。

保存は既存SettingsStoreのupdateExtensionで行い、ほかの項目・有効化状態を保持します。既存の競合検出とatomicWriteを使い、失敗は呼び出し元へ返します。AppDockからの変更もonChangedでローカルUIへ通知し、停止時に購読を解除します。Gmail 0.6.0の設定タブがこのAPIを使います。

`.appdock/web-accounts/<extension-id>/accounts.json`に安定したUUIDと表示名、`sessions/<account-id>/`にChromiumの永続セッションを保存します。`session.fromPath`を使うので複数のApplet・アカウント間でCookieを共有しません。アカウント保存はatomicWrite、不正な既存JSONは上書きせず起動エラーとして報告します。停止・異常終了でWebContents/UIを明示破棄し、Cookieをflushします。ウィンドウの×は非表示にし、Appletを止めるまで背景のページ更新を維持します。

soundはaccounts.jsonの各枠へ追加し、旧データは未指定ならOFFで扱います。0.14.0は同じ保存先のwindow-state.jsonへ通常の位置・サイズ/最大化を記録します。共通WindowStateStoreで300ms遅延保存、終了時flush、DIP丸め補正とモニター作業領域への復帰を再利用します。最小化/非表示では通常枠を上書きしません。保存失敗はホストログへ内容を含まない診断を残し、ページを閉じません。

削除は利用者確認後、対象枠のWebContentsを閉じ、storage/cache/Cookieを消去して一覧から外します。最後の枠は残します。削除処理中の枠は観測から除外します。Webページ内のアカウント切替はGoogle自身の操作で、追加枠とは異なります。

リモートページはpreloadなし、Nodeなし、contextIsolation/sandbox/webSecurityを有効にします。権限要求は拒否し、トップレベル移動先を宣言originへ制限します。子フレームのリダイレクトにトップレベル制限を適用しません。認証URLのquery/fragmentは診断へ記録せず、ローカルUIでは認証originだけ表示します。外部リンクは利用者確認後に開きます。認証偽装・User-Agent変更はしません。

Appletは通常のNodeプロセスと同じ権限を持つ信頼済みコードであり、capabilitiesはOSのサンドボックスではありません。observer/itemOpenerにもその信頼境界が適用されます。observerは読取に限定し、項目を開く操作はitemOpenerへ分離して明示的なUI操作でだけ実行してください。

## 検証

ホストの`tests/web-accounts.test.cjs`でorigin・資産の境界とcapabilityを検証します。[Gmailの開発ガイド](../../Applet.Gmail.at365/DEVELOPMENT.md)の`test-gui.cjs`で実Electronのセッション分離、DOM変化、背景監視、再起動保持、削除、停止を確認します。実Googleログイン・実メール到着・スリープ復帰は別の検証として扱います。

公式仕様: [WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view)、[session.fromPath](https://www.electronjs.org/docs/latest/api/session#sessionfrompathpath-options)、[webContents](https://www.electronjs.org/docs/latest/api/web-contents)。
