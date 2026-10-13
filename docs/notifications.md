# 通知基盤とShell表示

通知状態と描画を分離する。バナー契約は[notifications.ts](../src/shared/notifications.ts)、本体0.30.0の種類定義・設定・方針契約は[notification-types.ts](../src/shared/notification-types.ts)。実装状態、次のWindows表示先と即時保存への方針は[移行設計](notification-foundation.md)を参照する。

## 本体のサービス

NotificationServiceはinfo/warning/error、timed/manual/condition、操作、所有者単位のdedupeKey、通知状態、表示先状態を管理する。timedは受付時からの実時間で期限切れとなり、表示されない時間も進む。通常の更新では期限を延長せず、restartTimerを明示した更新で再設定できる。conditionは発行元のresolve/withdrawで終了する。

targetsはbanner/desktopの複数指定、または空配列。空配列は通知センターだけに表示する指定。windowsは未実装として拒否する。旧Windows通知APIは別経路を維持する。種類指定Applet APIはNode/.NETで提供する。MCPへの新規公開は行っていない。

同じ所有者・dedupeKeyのactive通知を更新し、終了後の再発は新IDになる。所有者は本体側が決定する。操作のホスト発行IDは現在の通知revisionと照合し、要求IDを最大512件記憶する。同じ要求の再送は同じ結果、異なる内容でのID再利用はエラーになる。通知単位のロックで別表示先からの二重押下を拒否し、失敗後は明示的に再試行できる。終了・撤回時に操作関数を回収する。

アクティブ通知は全体200件・所有者50件まで。本体用に20件を確保するため、本体以外の所有者の新規受付は全体180件まで。同一キー更新は受付上限でも可能。終了後のメモリー記録は最大1,000件とする。

## 通知種類と設定

notificationCatalogは本体定義とmanifest.notificationTypesを集約する。未保存警告はhost/settings/unsaved-changesとして必須banner/condition。Appletはnotifications capabilityとminimumHostVersion:0.30.0以上が必要で、canDisable:falseを自己宣言できない。宣言のない旧通知を本文から分類しない。

「設定 → 通知」はpage.settingsの同じ編集セッションを使う。host.notificationsは「Appletからの通知を許可」として旧showと新APIの親スイッチになり、本体必須警告を止めない。種類単位の上書きは共有settings.jsonのnotificationPreferences.overridesに置く。enabled/targets/durationSecondsの省略は既定継承、durationSeconds:nullはmanual。時間は1〜86,400整数秒、userDurationだけ編集できる。必須項目を無効化/時限化できない。

未保存の編集では配送を変えない。オフの保存は既存activeをwithdrawn、再オンで過去通知を再送しない。表示先変更は同じIDと期限を保ち、表示時間変更は新しいepisodeまたは明示restartTimerから適用する。停止/世代変更は旧世代をwithdrawnにする。共有設定が未導入の種類や未対応先を含んでも保持し、配送できない場合は理由付きsuppressedとなる。現在の利用可能先はbanner/desktopで、windowsはフォームで操作不能。「通知センターのみ」はtargets:[]として選択できる。

TypedNotificationsは呼出元/宣言/現在世代を検証してrawサービスへ接続する。種類別dedupeでも上限50件はApplet全体で共有する。発行頻度はAppletごとにバースト20件、毎秒10件補充で、endは除外。API署名・manifest例は[種類指定Applet API](extensions.md#種類指定通知api)。

## 履歴

PC専用dataDirectory内のnotifications/history.jsonにschemaVersion:1の履歴を保存する。persistentの発行元は保存用の安全なtitle/bodyを指定し、画面用の詳細とは分離する。callback、操作ID、認証、設定draftを保存しない。sessionは起動中だけ保持し、noneはactive終了時に除去する。

終了履歴は30日・1,000件・ファイル5MiBの上限で古い終了記録から整理する。activeを保持期限で解消しない。原子的置換と150msの保存集約を用いる。保存不能時も表示/操作を継続し、失敗をログへ記録する。破損ファイルは同じフォルダーに.corrupt-UUIDを付けて隔離する。未知schemaは上書きせずメモリー内で運用する。

ownerKind/ownerId/typeId/endReasonを任意保存する。旧記録は種類不明のまま読める。schemaVersion:1を維持する。

再起動で過去のactive履歴をinterruptedへ変換し、操作を復活させない。現在の発行元が条件を評価して新規通知を作る。通知センターで既読・検索・終了履歴削除を提供する。

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

モデルはschemaVersion:1/contextId:primary/sessionId/revision/dark/items/viewportと任意のsurface:banner/desktop。itemsは発行順。viewportはCSS pxのwidth/maxHeight。古いrevisionを無視する。NotificationSurfaceControllerが表示モデルと操作を持ち、NotificationSurfaceHostはネイティブViewの寿命・ready・位置・復旧だけを管理する。

## 配置と復旧

Window上部48 CSS pxへ、幅最大680 CSS px/左右余白16 CSS pxの小さなWebContentsViewを重ねる。幅・高さとzoomをDIPへ変換する。本文レイアウト、Web/AppletのView、入力、sessionを維持する。ページより上、モーダルパレットより下へ置き、ページの追加とバナー更新の後もモーダルを最後に配置する。

Default Shellは最大3カードを通常表示し、超過分を「ほかN件を表示」で展開する。利用可能高さ40%を目安に領域内をスクロールする。新規通知でfocusを奪わず、タイトルバーの「通知」から操作へ移れる。EscapeとTab境界で元の画面へ戻る。色・アイコン・レベル名を使い、新規通知の読み上げを行う。

ready期限は10秒。Shell切替先のreadyまでは旧Viewを保持し、同じ通知ID・期限・操作ロックを引き継ぐ。未提供/無効/停止/故障領域はDefault Shellへ戻す。通知領域の同じ提供元・版の故障はプロセス内で記憶し、「Shellを再試行」または新版で再試行する。safe起動はDefault Shellへ固定する。Default Shellも利用不能な場合は最小ネイティブdialogとログを使い、通知を再帰的に発行しない。

## 独立デスクトップ表示

notification.desktopはminimumHostVersion:0.31.1以上の追加Shellで提供できる。同じwindow.appdockNotificationsとカードを使用し、openCenter()で通常の通知センターへ移動できる。接続/ready/操作は表示先ごとのIPCチャネルとsessionに束縛する。既存NotificationBannerApi/Modelという公開型名は互換のため維持する。

NotificationDesktopHostは通知がある間だけ独立Windowと表示可否query workerを作る。本体を隠しても表示し、最後のdesktop対象がなくなると両方を破棄する。showInactiveで新着時のfocusを保ち、カードをクリックした時だけ操作先としてfocus可能。Escapeはdesktopのfocusを解放し、センターを開く操作は本体を表示する。

トレイ座標の画面、取得できなければ本体の画面のworkAreaへ配置する。座標はDIP、幅最大440/高さ最大600または作業領域60%、余白12。トレイがある側の隅を選び、負の画面座標や狭い画面も範囲内へ収める。画面追加/削除/作業領域・scale変更で再計算する。

[SHQueryUserNotificationState](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shqueryusernotificationstate)のACCEPTS_NOTIFICATIONSだけを表示可能とし、desktop対象がある間に1秒ごと問い合わせる。ロック/サスペンドのイベントと本体の全画面化も抑制する。非表示はdelivery:hiddenで、通知自体はactiveを保ち、期限は進む。問い合わせ失敗はログへ記録し、センターの閲覧を継続する。自動worker再起動を繰り返さず「Shellを再試行」で再問い合わせできる。

Shell未提供/故障は同じ共通HostでDefault Shellへ戻る。Default Shellも利用不能なdesktopはdelivery:failedとログを使い、勝手にバナーへ配送しない。バナーのDefault Shell全故障時に使うネイティブdialogをdesktopへ複製しない。

## 現在の未保存警告

SettingsNotificationSourceだけがSettingsEditingSessionと接続する。dirty状態の1期間を1通知に集約し、通常はwarning、parseError/saveError時はerror。同じ通知で保存・確認付き全体破棄・直前編集ページへの移動を提供する。入力の反映待ち、最新session/revision、既存の保存・確認処理を使う。

設定/Appletページではバナーだけ非表示にし、保存成功/破棄確定/未保存解消でresolvedにする。保存失敗/確認キャンセルでは維持する。設定値・JSON・画像を通知へ複製しない。履歴は固定の安全な要約だけを保存する。host.notificationsの既存Applet向けスイッチでこの警告を無効化しない。

将来の即時保存化ではこの発行元を削除できる。保存失敗・再試行の通知も保存サービスへ委譲し、通知基盤で編集内容を管理しない。

## 検証

単体回帰はtests/notification-foundation.test.cjs、関連するsettings-editing/shell-boundaries/ui-presentation/notification-routing/notification-services。scripts/notification-banner-ui-test.cjsは汎用発行元の隔離Electron fixtureで複数通知、期限、操作、フォーカス、provider切替と復旧を確認する。scripts/settings-notice-ui-test.cjs [publish/AppDock.at365.exe]は実際の設定連携をソース/固定EXEで検証する。shell-page-ui-test.cjsとnavigation-ui-test.cjsは重なり順と入力反映待ちの関連回帰。実測と制約はVERIFICATIONへ記録する。
