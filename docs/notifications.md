# 通知基盤とShellバナー

本体0.29.0から、通知状態と描画を分離する。公開契約は[notifications.ts](../src/shared/notifications.ts)、段階的な拡張と即時保存への方針は[移行設計](notification-foundation.md)を参照する。

## 本体のサービス

NotificationServiceはinfo/warning/error、timed/manual/condition、操作、所有者単位のdedupeKey、通知状態、表示先状態を管理する。timedは受付時からの実時間で期限切れとなり、表示されない時間も進む。通常の更新では期限を延長せず、restartTimerを明示した更新で再設定できる。conditionは発行元のresolve/withdrawで終了する。

初版のtargetsはbannerまたは空配列。空配列は将来の通知センター用のストア管理であり、初版に閲覧ページはない。desktop/windowsは未実装として拒否する。旧Windows通知APIは別経路を維持する。新たなApplet/MCP公開は行っていない。

同じ所有者・dedupeKeyのactive通知を更新し、終了後の再発は新IDになる。所有者は本体側が決定する。操作のホスト発行IDは現在の通知revisionと照合し、要求IDを最大512件記憶する。同じ要求の再送は同じ結果、異なる内容でのID再利用はエラーになる。通知単位のロックで別表示先からの二重押下を拒否し、失敗後は明示的に再試行できる。終了・撤回時に操作関数を回収する。

アクティブ通知は全体200件・所有者50件まで。本体用に20件を確保するため、本体以外の所有者の新規受付は全体180件まで。同一キー更新は受付上限でも可能。終了後のメモリー記録は最大1,000件とする。

## 履歴

PC専用dataDirectory内のnotifications/history.jsonにschemaVersion:1の履歴を保存する。persistentの発行元は保存用の安全なtitle/bodyを指定し、画面用の詳細とは分離する。callback、操作ID、認証、設定draftを保存しない。sessionは起動中だけ保持し、noneはactive終了時に除去する。

終了履歴は30日・1,000件・ファイル5MiBの上限で古い終了記録から整理する。activeを保持期限で解消しない。原子的置換と150msの保存集約を用いる。保存不能時も表示/操作を継続し、失敗をログへ記録する。破損ファイルは同じフォルダーに.corrupt-UUIDを付けて隔離する。未知schemaは上書きせずメモリー内で運用する。

再起動で過去のactive履歴をinterruptedへ変換し、操作を復活させない。現在の発行元が条件を評価して新規通知を作る。通知センター、既読操作、検索、履歴削除UIは後続段階。

## Shellの領域とbridge

minimumHostVersion:0.29.0以上のShell Appletは、shell.viewsで次を宣言できる。

```json
{ "notification.banner": "notifications.html" }
```

専用preloadはDefault Shellと追加Shellの両方にwindow.appdockNotificationsを公開する。通常のwindow.dockとNode APIは渡さない。接続元のWebContents、mainFrame、URLと現sessionを検査する。

1. onChangedを購読し、connectでsessionId/providerAppletId/snapshotを取得する。
2. themeを適用してsnapshotを描画後、ready(sessionId)を送る。
3. actへnotificationId/revision/requestId/type:invoke/actionId、またはtype:dismissを渡す。表示中のactive通知だけ操作できる。
4. resizeで描画した高さをCSS pxで報告する。ホストが最大高さを制限する。
5. onFocusに応じて先頭操作へ移動し、focusHostで元のWebContentsへ戻す。
6. getSettings/onSettingsChanged/executeCommandは他のShellと同じ自Applet用契約を使う。executeCommandは自身の登録済みコマンドに限定する。

モデルはschemaVersion:1/contextId:primary/sessionId/revision/dark/items/viewport。itemsは発行順。viewportはCSS pxのwidth/maxHeight。古いrevisionを無視する。NotificationBannerControllerが表示モデルと操作を持ち、NotificationBannerHostはネイティブViewの寿命・ready・位置・復旧だけを管理する。

## 配置と復旧

Window上部48 CSS pxへ、幅最大680 CSS px/左右余白16 CSS pxの小さなWebContentsViewを重ねる。幅・高さとzoomをDIPへ変換する。本文レイアウト、Web/AppletのView、入力、sessionを維持する。ページより上、モーダルパレットより下へ置き、ページの追加とバナー更新の後もモーダルを最後に配置する。

Default Shellは最大3カードを通常表示し、超過分を「ほかN件を表示」で展開する。利用可能高さ40%を目安に領域内をスクロールする。新規通知でfocusを奪わず、タイトルバーの「通知」から操作へ移れる。EscapeとTab境界で元の画面へ戻る。色・アイコン・レベル名を使い、新規通知の読み上げを行う。

ready期限は10秒。Shell切替先のreadyまでは旧Viewを保持し、同じ通知ID・期限・操作ロックを引き継ぐ。未提供/無効/停止/故障領域はDefault Shellへ戻す。通知領域の同じ提供元・版の故障はプロセス内で記憶し、「Shellを再試行」または新版で再試行する。safe起動はDefault Shellへ固定する。Default Shellも利用不能な場合は最小ネイティブdialogとログを使い、通知を再帰的に発行しない。

## 現在の未保存警告

SettingsNotificationSourceだけがSettingsEditingSessionと接続する。dirty状態の1期間を1通知に集約し、通常はwarning、parseError/saveError時はerror。同じ通知で保存・確認付き全体破棄・直前編集ページへの移動を提供する。入力の反映待ち、最新session/revision、既存の保存・確認処理を使う。

設定/Appletページではバナーだけ非表示にし、保存成功/破棄確定/未保存解消でresolvedにする。保存失敗/確認キャンセルでは維持する。設定値・JSON・画像を通知へ複製しない。履歴は固定の安全な要約だけを保存する。host.notificationsの既存Applet向けスイッチでこの警告を無効化しない。

将来の即時保存化ではこの発行元を削除できる。保存失敗・再試行の通知も保存サービスへ委譲し、通知基盤で編集内容を管理しない。

## 検証

単体回帰はtests/notification-foundation.test.cjs、関連するsettings-editing/shell-boundaries/ui-presentation/notification-routing/notification-services。scripts/notification-banner-ui-test.cjsは汎用発行元の隔離Electron fixtureで複数通知、期限、操作、フォーカス、provider切替と復旧を確認する。scripts/settings-notice-ui-test.cjs [publish/AppDock.at365.exe]は実際の設定連携をソース/固定EXEで検証する。shell-page-ui-test.cjsとnavigation-ui-test.cjsは重なり順と入力反映待ちの関連回帰。実測と制約はVERIFICATIONへ記録する。
