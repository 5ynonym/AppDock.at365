# WebアカウントAPI（v0.13.0）

Node Appletへ、Webサービスのアカウント別画面と永続セッションを提供します。WebContentsViewの生成・ログイン領域・アカウント切替・UI IPC・破棄はホスト、サービス固有のDOM観測と通知はAppletの責務です。.NET SDKには今回専用ラッパーを追加していません。既存API v1/Node/.NET/nativeの契約は維持します。

## manifest

基本APIは`minimumHostVersion: "0.12.0"`と`capabilities: ["web-accounts"]`が必要です。`report`のdataやUIの`viewport`を使用するAppletは`minimumHostVersion: "0.13.0"`を指定してください。

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

URLは宣言したHTTPS origin内、観測先もその1つに限定します。ui/observerは実パスでもApplet内のファイルだけを許可し、observerは100KB以内。既定の画面枠は左236px・上146pxを予約します。0.13.0ではUIが`viewport`で変更できます。最小ウィンドウ900×640、既定1280×900です。

## Node/RPC

| Node | RPC | 処理 |
| --- | --- | --- |
| `context.webAccounts.start()` | `host.webAccounts.start` | 全枠を非表示で読込開始、UIを開かない |
| `context.webAccounts.open()` | `host.webAccounts.open` | 操作用ウィンドウを表示・復帰 |
| `context.webAccounts.read()` | `host.webAccounts.read` | 各枠の観測結果とUIからのクリア要求を返す |
| `context.webAccounts.report(id, status, attention, data?)` | `host.webAccounts.report` | アカウントの状態表示と一時UIデータを更新 |

`read`の戻り値は`{ selected, accounts, acknowledged }`。アカウントは`id/name/url/loading/error/canGoBack/canGoForward/observation/status/attention/data`を持ちます。型は[src/shared/web-accounts.ts](../src/shared/web-accounts.ts)、Node contextは[src/main/node-worker.ts](../src/main/node-worker.ts)が正本です。dataはJSON化可能な50KB以下の値で、ローカルUIのsnapshotへ渡します。省略時はnull。ホストはファイルやログに保存せず、Applet停止時に破棄します。Nodeへの`read`ではdataをnullにし、最大10枠の観測と履歴の二重送信でJSON-RPCの1MB制限を超えないようにします。

観測JSは式としてJSON化可能な値を返します。ページがobserveOrigin内で読み込み済みの場合だけ、**isolated world 1001**で実行します。1枠の観測結果は60KBまで、待機は800msまで。同じ枠で未完了の観測を並行起動しません。逐次読取で最大10枠を扱い、ナビゲーション世代/URLの変化・停止・削除があれば遅い結果を捨てます。ページの再読込や通信APIポーリングは行いません。ページ遷移/プロセス終了でisolated worldのObserverも破棄されます。

ローカルReact UIのpreloadは`window.webAccounts`へ`snapshot/add/select/rename/remove/navigate/acknowledge/viewport/onChanged`だけを公開します。ホストはsenderのWebContents・main frame・厳密なローカルUI URLを検証し、そのUI自身のAppletへ割り当てます。パネルの任意HTML実行機能とは独立しています。

`viewport({x,y,width,height})`はローカルUIのclient座標・DIPで表示領域を指定し、ホストがclient領域内へ切り詰めます。各値は0〜100000の整数（幅・高さは1以上）です。`viewport(null)`は選択中のViewを隠すだけで、アカウント切替後も非表示を維持し、ページと監視は続きます。UIではResizeObserver等で実領域を再送してください。[Electron View](https://www.electronjs.org/docs/latest/api/view)の可視制御を使用しています。未呼出しの旧UIは既定レイアウトを維持します。

## 保存とライフサイクル

`.appdock/web-accounts/<extension-id>/accounts.json`に安定したUUIDと表示名、`sessions/<account-id>/`にChromiumの永続セッションを保存します。`session.fromPath`を使うので複数のApplet・アカウント間でCookieを共有しません。アカウント保存はatomicWrite、不正な既存JSONは上書きせず起動エラーとして報告します。停止・異常終了でWebContents/UIを明示破棄し、Cookieをflushします。ウィンドウの×は非表示にし、Appletを止めるまで背景のページ更新を維持します。

削除は利用者確認後、対象枠のWebContentsを閉じ、storage/cache/Cookieを消去して一覧から外します。最後の枠は残します。削除処理中の枠は観測から除外します。Webページ内のアカウント切替はGoogle自身の操作で、追加枠とは異なります。

リモートページはpreloadなし、Nodeなし、contextIsolation/sandbox/webSecurityを有効にします。権限要求は拒否し、トップレベル移動先を宣言originへ制限します。子フレームのリダイレクトにトップレベル制限を適用しません。認証URLのquery/fragmentは診断へ記録せず、ローカルUIでは認証originだけ表示します。外部リンクは利用者確認後に開きます。認証偽装・User-Agent変更はしません。

Appletは通常のNodeプロセスと同じ権限を持つ信頼済みコードであり、capabilitiesはOSのサンドボックスではありません。observer.jsにもその信頼境界が適用されます。ページ上で動かすコードはサービスの読取目的に限定してください。

## 検証

ホストの`tests/web-accounts.test.cjs`でorigin・資産の境界とcapabilityを検証します。[Gmailの開発ガイド](../../Applet.Gmail.at365/DEVELOPMENT.md)の`test-gui.cjs`で実Electronのセッション分離、DOM変化、背景監視、再起動保持、削除、停止を確認します。実Googleログイン・実メール到着・スリープ復帰は別の検証として扱います。

公式仕様: [WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view)、[session.fromPath](https://www.electronjs.org/docs/latest/api/session#sessionfrompathpath-options)、[webContents](https://www.electronjs.org/docs/latest/api/web-contents)。
