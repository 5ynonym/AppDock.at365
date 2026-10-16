# WebアカウントグループとGmailの移行

2026-10-17。対象はAppDockの共通基盤と既存Gmail。Google Calendarの画面・監視・通知・API連携は次の工程で要件を決める。実装・検証状況は各repoのVERIFICATIONを参照する。

## 目的と責務

同じグループを宣言した信頼済みAppletが、共通のアカウント名簿と同じPCのログインセッションを利用する。Gmailを停止しても他の参加Appletは動作する。本体にGoogle固有のURL、DOM処理、Applet IDの分岐を追加しない。

| 情報 | 所有者・保存 |
| --- | --- |
| UUID、表示名、仮名フラグ、順序 | グループ。EXE隣のdata/web-account-groups/<group-id>/accounts.json |
| Cookie、キャッシュ、サイト内ストレージ | グループのアカウントごと、PC専用root。別アカウント・別グループ間は隔離 |
| 選択中のUUID、枠別監視、通知音割当 | PC専用のグループ状態内、Applet IDごと |
| 一般設定、通知種類設定 | 従来のsettings.json |
| 登録通知音 | 従来のdata/assets/applets/<Applet ID>/sounds |
| WebContentsView、履歴、未読、観測、アバター | 各Appletの実行中メモリー |

名簿の同期は既存observeFileの安定読取を使う。有効な受信名簿を優先し、競合を自動mergeしない。PC間で認証情報を同期しない。名簿だけが届いたPCではそのPCでログインする。

## 宣言と公開契約

`webAccounts.accountGroup: { id, title }`を追加する。Gmailは`{ "id": "at365.google", "title": "Googleアカウント" }`。IDは安全な小文字の名前空間付き識別子、titleは表示名。同じIDを明示したAppletだけが同じグループを使う。省略したAppletは従来の専用枠を継続する。

従来のweb-accounts capability、Nodeのstart/open/read/report/cycle/navigate、ローカルUIのadd/rename/move/remove/select等を継続する。呼出し先グループはホストがmanifestから確定し、IPC引数で任意のグループ・パスを指定させない。UI snapshotにgroupのid/titleを追加する。Cookieやパスは返さない。

これは信頼済みNode Appletが宣言する共用契約であり、任意のWebページへの権限付与ではない。Node Applet自体をOSサンドボックスと扱わない。各Viewのorigin制限・observer・itemOpener・preloadなし・Nodeなしを維持する。共通sessionのpermission handlerはサービス固有の許可を追加せず、一律拒否を維持する。

## 操作と寿命

- 追加・改名・順序変更は全参加Appletへ反映する。選択の変更は呼出し元だけ。通知音と監視も呼出し元だけに保存する。
- 追加時は既存上限の10枠。新規グループは空で開始し、明示的な追加で最初の枠を作る。同期未到着時に既定名簿を作らない。最後の1枠は従来どおり削除しない。
- 仮名の自動更新は最初の有効な観測だけ。利用者が決めた名前を後から上書きしない。
- 削除確認は全参加Appletの共通一覧から消えることと、このPCの共通ログイン情報を消去することを明記する。確認中の別変更を再照合する。実行中はグループの変更を排他し、全参加Viewを閉じてからセッションを消去し、名簿を保存する。失敗は報告し、成功したと表示しない。
- 外部名簿から消えた枠は全Viewを閉じるが、このPCのCookieを自動削除しない。別PCの名簿操作をローカル認証の破棄許可と解釈しない。
- Applet停止では自身のView・購読だけを破棄する。他の参加Appletや永続名簿・sessionを削除しない。最後の購読終了時にファイル監視を閉じる。
- グループを使うWeb画面内でのログアウトは、同じアカウントを使う他Appletにも影響する。Gmail UIで共有範囲を説明する。

## 旧Gmailの移行と復旧

1. 初回接続時に従来のPC専用web-accounts/<Applet ID>/accounts.jsonを検証する。UUID・表示名・順序・仮名状態を保持して共通名簿へ取り込む。同じUUIDが既にあれば共通名簿の表示値を優先する。名前やメール文字列から別UUIDを同一人物と推定しない。合計10枠を超える場合は停止し、元データを保持する。
2. 選択、監視、通知音はPC専用web-account-groups/<group-id>/state.jsonのApplet別状態へ移す。移行完了を同じファイルに記録し、次回起動で削除済み枠を再取り込みしない。
3. 旧sessions/<UUID>は移動・コピーせず、検証済みApplet IDによる参照をPC専用state.jsonへ記録する。新規枠はグループ側sessions/<UUID>を使う。同じセッションを二つのグループへ割り当てないよう、旧Applet領域のgroup-binding.jsonで初回グループを固定する。グループ変更を自動移行しない。
4. 複数ファイルの保存はPC専用state.jsonのpending記録に名簿の変更前bytes・変更後bytes・次のローカル状態を置いてから行う。再起動時に変更前/変更後のどちらかに一致する場合だけ完了する。別の名簿が届いていれば競合を報告し、上書きしない。不正JSON・読取不能・不完全保存で旧ファイルを初期化しない。
5. 元のaccounts.jsonは移行元として保持する。移行後は書き換えない。旧版に戻して同じデータを並行編集する運用には戻さない。実装後の後戻りは保存先全体のバックアップから、AppDockを終了して復旧する。

新PCで旧Gmailがある場合もUUIDを維持して一度だけ取り込む。同期による名簿欠落・破損は操作を止め、直近の正常値を表示する。セッションのパスはホストが固定rootと検証済みIDから組み立てる。生の任意パスを名簿へ持たせない。

## Gmailの変更

manifestのグループ宣言、最低ホスト版、アカウント設定画面の共有範囲の説明を追加する。メール観測と新着判定、通知、ショートカット、登録音のAPIは継続する。グループの削除後に遅れて届く観測・reportは破棄する。既存UIのアカウント設定から共通名簿を操作できるようにし、今回専用の管理Appletは増やさない。

## 実装・検証

共通のグループストア、Controllerの接続、Gmail UIを実装済み。本体0.56.0・Gmail0.12.0として、既存の単一EXEとApplet個別ZIPの発行経路を使用した。変更・検証の記録は[本体](../VERIFICATION.md)と[Gmail](../../Applet.Gmail.at365/VERIFICATION.md)を参照する。

必須検証は、旧データ移行と再起動、途中保存からの復旧・競合拒否、破損/欠落/上限、二つのテスト用Appletによる名簿共有・選択/監視/通知音の独立、同一sessionのCookie共有と別グループ/別アカウントの隔離、片方停止後の継続、削除時の全View終了と遅延結果破棄、外部名簿の変更、固定発行物での起動とGmail操作。実Google認証・実メール・実スピーカーとオフラインfixtureの結果は区別する。

Calendar用の本番AppletやGoogle APIのOAuth権限は今回作成しない。将来Web画面方式なら同じグループを宣言して参加できる。API方式の追加認証はその時点で設計する。
