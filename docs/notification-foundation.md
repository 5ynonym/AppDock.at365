# 通知基盤とDefault Shellへの移行設計

状態: 段階1を本体0.29.0として実装済み。段階2以降は未実装。現行の型・bridge・保存契約は[通知基盤](notifications.md)、実測と制約は[検証記録](../VERIFICATION.md)を正本とする。本書は今回確定した設計と次の実装範囲を記す。

設定は将来、未保存状態を管理しない即時保存へ移行する。今回の未保存警告は通知基盤の最初の発行元であり、基盤の前提にはしない。通知センターなどの追加と即時保存化は独立して進める。

## 要件と設計判断

調査時の0.28.2では未保存バナーが本体専用renderer/View/preloadに属していた。今回、その専用経路を撤去し、Default Shellと追加Shellが同じ公開契約で描画するnotification.bannerへ移した。

レベル、操作、寿命、表示先指定、履歴、複数表示という要求は整合する。通知を表示先ごとに作り直さず、サービスが1件のID・状態・期限を所有し、表示先はその射影を描く。非表示、配送失敗、OSの消去と業務上の解消を分離する。

| 段階 | 状態 | 対象 |
| --- | --- | --- |
| 1 | 実装済み | 通知サービス、操作管理、履歴保存、複数バナー、Default Shell、既存未保存警告の接続 |
| 2・次回の推奨範囲 | 未実装 | 通知センター、active/履歴一覧、既読、検索、終了履歴削除 |
| 3 | 未実装 | トレイ付近の独自デスクトップ通知、表示先adapterの共通化 |
| 4 | 未実装 | Windows表示先、旧通知APIの接続、Node/.NET Applet公開 |
| 独立した移行 | 未実装 | 設定の即時保存、未保存警告発行元の削除 |

段階3・4の順序は変更可能。未実装の表示先を製品UIで選択可能にせず、新APIをMCPへ自動公開しない。

## 実装済みの構成

| 実装 | 責務 |
| --- | --- |
| [NotificationService](../src/main/core/notification-service.ts) | Electron非依存の通知ID/revision、期限、所有者内集約、状態遷移、操作関数・要求ID・通知単位ロック |
| [NotificationHistoryStore](../src/main/core/notification-history.ts) | 安全な履歴の投影、読込・原子的保存、保持上限、破損・未知schema時の退避 |
| [NotificationBannerController](../src/main/core/notification-banner-controller.ts) | バナーモデル、表示中通知の操作受付、配送状態 |
| [NotificationBannerHost](../src/main/core/notification-banner-host.ts) | 非モーダルView、provider解決、接続/ready、寸法・zoom・重なり順、Shell切替・復旧 |
| [Default Shell](../shells/default/notifications.tsx) | プレーンテキスト、操作、縦スタック、展開・スクロール、キーボード・読み上げ |
| [SettingsNotificationSource](../src/main/core/settings-notification-source.ts) | 設定の通知条件、文言、保存/破棄/編集へ戻る処理、表示文脈 |

SettingsEditingSession→SettingsNotificationSource→NotificationService→BannerController→BannerHost→Shellという接続とし、サービスから履歴ストアへ安全な記録を投影する。操作管理はサービス内部に実装した。別のNotificationActionRegistryクラスは作っていない。

本体からDefault ShellのReact部品をimportせず、復旧時にも同じDefault Shell entryを使用する。[Shell基盤](shell-foundation.md)に従い、内容ControllerとネイティブViewの寿命を分離する。dirty、draft、保存/破棄という操作種別、SettingsEditingSessionへの参照は汎用サービスへ置かない。設定固有の接続は削除可能な発行元へ閉じ込める。

## 実装済みの通知と操作契約

型は [src/shared/notifications.ts](../src/shared/notifications.ts)、発行入力はNotificationInputを正本とする。

| 項目 | 現行契約 |
| --- | --- |
| id / revision | ホスト発行IDと内容更新番号。複数表示先へ拡張しても通知は1件 |
| source / dedupeKey | 信頼された本体呼出元が指定する所有者と、その所有者内の安定キー |
| level | info / warning / error |
| title / body | 最大200文字/2,000文字のプレーンテキスト。HTML不可 |
| actions | 最大3件。発行元は安定key/label/primary/disabled/runを指定し、Shellには不透明なidのみ渡す |
| lifetime | timed / manual / condition。timedは1〜2,147,483,647ms |
| dismissible / busy | 全体dismissの許可と操作中状態。conditionはdismissible:false |
| targets | 現行受付はbannerまたは空配列。型のdesktop/windowsは将来用で、受付時に拒否 |
| history / historyText | persistent / session / none。persistentには安全な保存用title/bodyが必須 |
| status | active / resolved / dismissed / expired / withdrawn / interrupted |
| delivery | 表示先ごとのpending / showing / hidden / failed / ended |
| read | 将来の既読操作用。現行はfalseで作成し、変更API/UIは未実装 |

空targetsは表示なしで管理できる内部契約。段階1には閲覧ページがないため、製品通知の唯一のユーザー導線にはしない。段階2では通知センターだけに表示する通知として使用する。

同じ所有者・キーのactive通知は同じIDで更新し、終了後の再発は新IDになる。同一通知のhistory方針は変更できない。通常更新はtimedの期限を延長せず、restartTimerを明示した場合に受付時刻から再設定する。期限はmainで実時間として管理し、非表示時間も進み、期限・一覧・操作を再照合する。

内部APIはupsert/list/bannerItems/historyEntries/end/withdrawSource/invoke/subscribe等で構成する。endは発行元がresolved/withdrawnを指定する。Shellへ関数、任意コマンド、任意URL、設定値を渡さない。

操作要求はnotificationId/revision/requestId/typeと、invoke時のactionIdを持つ。BannerHostはWebContents/mainFrame/URL/現sessionを、Controllerは表示中の通知を、Serviceはactive/revision/操作ID/busyを検査する。要求IDを最大512件保持し、同じ内容の再送には同じ結果を返す。違う内容での再利用は拒否する。この重複排除は起動中の有限キャッシュであり、再起動をまたぐexactly-once保証ではない。

通知単位のロックで別要求からの同時押下も防ぐ。ボタンを押しただけでは解消せず、発行元が成功後にendする。失敗・確認キャンセルは通知を維持し、再試行は新しい要求IDで行う。終了時に操作関数を回収し、開始済み副作用を巻き戻さない。遅い完了で終了通知を再表示しない。

アクティブ上限は全体200件/所有者50件。本体以外の新規受付は全体180件までとし、本体用20件を確保する。同一キー更新は上限到達時も可能。現在は内部sourceのhost.接頭辞で本体を区別する。外部公開時は呼出元がこの識別を偽装できないadapterを追加する。

## 実装済みのバナー

Shell領域はnotification.banner、bridgeはwindow.appdockNotifications。minimumHostVersion:0.29.0以上の追加Shellが通知領域だけを提供でき、未提供/故障領域はDefault Shellへ戻る。モデルはschemaVersion/contextId/sessionId/revision/dark/items/viewport、APIはconnect/ready/onChanged/act/resize/onFocus/focusHostと自Applet用共通Shell API。実際の署名は[現行契約](notifications.md#shellの領域とbridge)を参照する。

既存OverlayHostはモーダル1件・入力停止・route変更取消という契約のため共用しない。バナーはroute変更でも通知IDを維持する。小さな独立ViewをWindow上部48 CSS pxに置き、本文を押し下げず、ページ/WebのViewより上、モーダルより下へ再配置する。

幅最大680 CSS px、左右余白16 CSS px、利用可能高さ40%を上限の目安とし、zoomとDIPへ変換する。発行順に縦スタックし、3件を超える分は「ほかN件を表示」で展開して領域内スクロールする。更新やレベル変化で並び替えない。

新規通知でfocusを奪わず、タイトルバーの「通知」で明示移動する。Escape/Tab境界で元のViewへ戻る。色・アイコン・レベル名と新規通知の読み上げを持つ。スクリーンリーダーと物理DPI/IMEの実機確認は検証記録の未確認事項として残す。

ready期限10秒。切替先のreadyまでは旧Viewを保持し、サービス側の期限・操作ロックは交換しない。故障した同provider/版を起動中に記憶し、明示再試行/新版で再評価する。safe起動はDefault Shellへ固定する。Default Shellも利用不能なら最小ネイティブdialog/ログを使用し、壊れた通知基盤へ故障通知を再発行しない。

バナーの×はdismissible通知全体を終了する操作。ページやWindowの非表示はdismissではない。条件の解消、全体dismiss、期限切れは将来の全表示先にも終了を要求する。

## 実装済みの設定発行元

未保存期間をhost.settings内の固定キーで1通知へ集約する。通常はwarning「未保存の変更があります」、parseError/saveError時は同じ通知をerrorへ更新する。すべて保存、確認付き全体破棄、直前の設定/Applet編集画面へ戻る操作を持つ。

保存/破棄はrendererとShellの入力反映待ち、および最新SettingsEditingSession/editRevision/operationIdを使う。保存成功・破棄確定・既存操作での未保存解消はresolved、保存失敗・確認キャンセルは維持する。設定/AppletページではbannerVisibleだけをfalseにし、通知はactiveのまま保持する。×や自動消去は発行元として指定しない。

draft、設定JSON、画像を通知へ複製せず、永続履歴は安全な固定要約だけを保存する。既存host.notificationsのApplet通知スイッチでこの警告を無効化しない。旧SettingsNotice renderer/View/preload/IPC/CSSは除去済み。

## 実装済みの履歴と再起動

PC専用dataDirectory配下のnotifications/history.jsonにschemaVersion:1を保存する。共有settings.jsonへ混ぜず、[設定同期の配置別root](settings-sync.md)に従う。保存ファイル追加のため本体を0.29.0へマイナー更新した。

persistentは画面用詳細と別の安全なtitle/body、ID/source/レベル/時刻/終状態/read/targets/deliveryを保存する。callback、操作ID、認証情報、draft、生の例外を保存しない。sessionは起動中だけ、noneはactive終了時に削除する。終了済みメモリー記録は最大1,000件。

永続終了履歴は30日/1,000件/5MiBの上限で古い記録から整理し、activeを保持期限で解消しない。150msの集約とtempからの原子的置換を使う。保存不能でも通知・操作を継続しログへ記録する。破損は.corrupt-UUIDへ隔離、未知schemaは上書きせずメモリー運用に退避する。監査ログではなく、障害直前の未flush更新の保存は保証しない。

再起動時の過去activeはinterruptedとし、操作を復元しない。現在の発行元が条件を再評価して新IDで通知する。現在のhistoryEntriesは保存ストアとsession記録の内部取得口であり、通知センターの一覧・検索・既読・削除APIはまだない。

## 段階2: 次回の通知センター

次回は通知センターを独立した本文ページとして追加し、バナーの既存契約・設定の保存方式を維持する。以下は後続実装の設計であり、現在利用できるAPIではない。

### ページとShell契約

本体に通知センターへのナビゲーションを追加する。既存タイトルバーの「通知」はバナーへのfocus操作として維持し、センターを開く操作とは区別する。新しい本文領域page.notificationsを候補とし、NotificationCenterControllerが一覧・操作を所有し、既存ShellPageHostがView/切替/復旧を所有する。追加領域の名前と署名は実装開始時にshared型・manifest・minimumHostVersionをそろえて確定する。

Default Shellと追加Shellへ同じモデル/bridgeを提供する。モデルにはsession/revision/theme、active項目、終了履歴、検索条件、件数、続きを取得するcursorを含める。bridgeは取得/購読、検索・絞込、既読操作、終了履歴削除、active操作を提供する。Shell内でサービスへ直接アクセスせず、mainFrame/URL/sessionの検査と自Applet限定の共通契約を維持する。

### 一覧・既読・操作

- 「アクティブ」と「履歴」を分ける。activeはhistory:noneも含め、同じ通知IDの履歴と重複表示しない。バナー非表示のactiveやtargets空配列もセンターに表示する。
- activeは現在の文言と操作、終了履歴は安全な保存用文言と終了理由を表示する。再起動後のinterruptedや古い記録に操作ボタンを復活させない。
- active操作は既存invokeと通知単位ロックへ接続する。画面間の同時操作、古いrevision、終了との競合を同じ規則で処理する。履歴削除と通知dismissを別操作にする。
- 全体は新しいものから表示する。レベル/発行元/状態/未読、プレーンテキスト検索を提供する。絞込で通知状態を変えず、新着でスクロール/focusを奪わない。
- 開いただけで全件既読にしない。1件/選択範囲/現在の絞込範囲の明示既読を提供し、バナー表示・OS配送とも分離する。既読は通知の解消や期限延長を起こさない。

一覧用にサービスと履歴のID単位統合を追加する。終了履歴にはページ取得と安定した並び順を設け、最大1,000件を全件描画して更新しない。更新中cursorの失効時は明示再取得する。Service/HistoryStoreに既読と終了記録削除の操作を追加し、persistentは保存、sessionはメモリー更新、noneはactive中だけ更新する。schemaVersion:1のread欄は利用できるが、追加フィールドの要否と後方互換を実装時に確認する。

削除対象は指定IDまたは条件に一致する終了記録だけ。主処理の通知解消・設定変更・activeの削除を行わない。単一終了記録の削除は直接実行、範囲/全履歴消去は確認して実行する。終了済み記録がServiceとHistoryStoreの両方に残る場合も一括して取り除き、再表示を防ぐ。削除中に新たに終了した記録まで巻き込まないよう対象IDを確定する。未知schema保護中は保存できない状態を表示し、永続消去成功を返さない。

### 実装順と受入条件

1. ID統合、一覧射影、既読・終了履歴削除・検索/ページ取得をElectron非依存で追加する。
2. 通知センターController、Shell本文領域、Default Shell画面、mainのページ導線を追加する。
3. activeと安全な履歴、空targets、none/session/persistent、バナーとの同時操作をGUIで検証する。
4. 再起動・interrupted、削除後の再表示防止、保存不能/未知schema、Shell切替/故障、検索中の新着とスクロール保持を確認する。
5. 現行契約・README・検証記録を更新し、版更新区分を判断、通常publishと固定EXEを検証する。

この段階では独自デスクトップ/Windows配送と外部Applet公開を追加しない。通知センターだけの通知が操作可能であること、history:noneがactive中だけ見えること、履歴から終了通知を再実行できないことを必須条件とする。

## 段階3: 独自デスクトップ通知

まず表示先adapterを導入し、サービスから表示・更新・終了を要求し、adapterから配送状態を返す。現在のsetBannerDeliveryをこの契約へ接続する。通知の終状態と表示先の状態は別のまま保持する。未対応、抑制、失敗の理由をモデルに追加する場合は共有型・履歴読込との互換を同時に更新する。

本体が専用Windowを管理し、Shellの候補領域notification.desktopがカードを描く。View寿命と内容Controllerを分離し、Default Shell内でカード表現を共用できる。通知ID・期限・操作要求とロックをバナー/センターと共有し、新規表示でfocusを奪わない。

トレイ座標を取得できればその作業領域内に配置し、取れなければ選定した画面の作業領域端へ置く。複数通知は積み、超過分はセンターへ到達する導線を設ける。タスクバー方向、DPI/複数画面、画面変更、全画面/ロック時の抑制、クリック時のfocus方針は実装前に実機条件で確定する。抑制中もtimed期限は進み、抑制解除を理由に終了通知を再表示しない。

## 段階4: Windows通知とApplet公開

既存の [notifications.ts](../src/main/core/notifications.ts) と [notification-routing.ts](../src/main/core/notification-routing.ts) は現段階で別経路を維持している。段階4でWindows adapterへ接続し、portable用protocol、配置/profile識別、クリック起動の安全性を保つ。

旧notifications.show(title, body, options)は通知設定/silent/command/戻り値を保つadapterとして移行する。OS受付・ユーザー既読・条件解消を混同しない。Windows側で表現できないボタン/期限/撤去は通知センターへ案内し、別表示先へ無断配送しない。古い起動世代のクリックから失効した操作を実行せず、履歴のcallbackを復元しない。固定Electron版と実Windowsの配送・クリック・再起動で能力差を検証する。

外部Applet公開時はnotifications capability、呼出元IDと起動世代、サイズ・件数・頻度、所有者限定の更新/終了を検査する。sourceと本体予約枠は認証済みadapterが決定し、Applet入力として受け付けない。停止/異常終了で旧世代の操作を失効し、条件通知をwithdrawnへ移す。別Appletの履歴・操作へアクセスさせない。Node/.NET双方の型・RPC・実プロセス試験をそろえ、MCP公開は別途要求された範囲のみとする。

## 即時保存への独立した移行

移行済み機能では通常の変更ごとに未保存警告や「保存しました」を出さない。該当発行接続を外して旧条件通知をwithdrawnにし、全設定移行後にSettingsNotificationSourceを削除する。通知サービス、履歴、Shell、表示先は作り直さない。

必要な通知は保存失敗や追加操作が必要な場合に限定する。再試行可能なら保存サービス所有の操作を渡し、成功後にresolveする。再試行する値と処理は保存サービスが所有し、通知へコピーして別の未保存管理を作らない。入力途中/バリデーション、保存失敗時の値と画面、外部同期競合は即時保存の別設計で確定する。

## 検証と実装時の補足

今回の受入確認は汎用発行元の状態・期限・履歴・操作競合、複数表示/スクロール/focus、Shell切替/復旧、設定の入力反映待ち/保存/破棄/失敗保持、モーダルとの重なり順、固定単一EXEを対象にした。試験の範囲と未確認事項を[検証記録](../VERIFICATION.md)で区別する。後続段階では既存回帰を維持し、上記の段階別受入条件を追加する。

実装中、開発ドライブの祖先ボリュームマウントで更新packが失敗したため、packに限りWindows登録済み祖先マウントを認識した。入力/出力自身・通常junction祖先・配布物内のリンク拒否、apply/recover/extractの検査は維持する。これは通知設計の変更ではなく発行互換性の修正で、詳細は[更新仕様](updates.md)を参照する。通知基盤の大枠は当初設計を維持し、実装上の契約と将来契約を本書で明確に分けた。
