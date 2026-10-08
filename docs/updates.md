# 本体とAppletの共通更新

利用者向けの操作は[README](../README.md#アップデート)を参照。0.22.0はframework-dependent .NET 10単一ファイル`AppDock.Updater.exe`をportable本体のresourcesへ同梱する。.NET 10 Runtimeの従来要件以外の導入は不要。

## 設定と取得

`settings.updates`はhostSource、checkHostOnStartup、checkAppletsOnStartup、startupDelaySeconds（0～3600）、notifyOnStartup、allowSameVersion。Appletは`extensions.<id>.updateSource`を使い、未指定ならmanifest.updateRepositoryを継承、空文字は無効。

ローカル/UNCはupdate.jsonまたは発行フォルダー。Appletフォルダーにupdate.jsonがなければextension.jsonを読む。HTTP(S)はfeed URLまたは末尾/の配布ベースURL。GitHubはリポジトリ/Release URLからAPIとRelease assetsを使い、Source code ZIPは使わない。IDと正式版SemVer、最低本体版を照合する。非公開の認証トークンとプレリリースは扱わない。

## 発行

本体のpublish.bat/dev.bat run distはhelperをビルドし、portable EXEの発行後にpublish/update.jsonを生成する。外部公開はしない。

```powershell
.\dev.bat run build:updater
.\dev.bat run pack:update applet ..\Applet.Watch.at365\publish\Applet.Watch.at365 artifacts\watch-update
```

生成したupdate.jsonとupdate.zipを同じWeb配布場所/GitHub Releaseに置く。本体はupdate.jsonとAppDock.at365.exe。JSONはschemaVersion=1、kind=host/applet、id=host/実Applet ID、version、任意minimumHostVersion、payload={file,sha256,size,format=exe/zip}。ZIP直下にextension.jsonと実行ファイル一式を置く。情報JSONを配布物の最後に公開する。

## 交換と復元

PortableUpdatesが上限付き取得、SHA256/サイズ照合、ID/版/entry/最低host照合を行う。ローカルAppletも専用TEMPへコピーして固定する。helperを交換対象外のTEMPへコピーし、対象と再起動引数をjob.jsonへ記載する。

helperは範囲・リンク/ジャンクション・ZIP traversal/重複/サイズを検証する。ready→本体commit後、本体・外側ランチャー・AppletのPID終了を最大60秒待つ。manager.stopのタイムアウトを終了証拠にしない。全対象を更新先の同じvolumeへ準備・再ハッシュ照合し、journal保存→旧版一時退避→新しい版を移動する。途中失敗は逆順に復元。成功時のbackupは削除する。

結果は.appdock/update-result.json、再起動後の画面・ログへ表示。TEMPは再起動後に専用パスを検証して整理。強制終了で残ったjournalは起動時にhelper --recoverで復元を試す。本体EXEが使用中で復元できない場合は起動を止める。完全終了後、journalのhelperが示す一時EXEへ`--recover <元の配置先>`を渡して復元してから起動する。復元前に一時EXE/journalを削除しない。

Appletフォルダーは配布単位で交換。保存データはSDK/ホストの.appdockへ置く。互換性不足は本体を先に更新するよう表示。一括は適用可能な候補だけをまとめ、失敗/未設定は各行へ残す。

## 検証

tests/portable-updates.test.cjsは隔離ディレクトリーで設定移行、ローカル/URL/GitHub metadata、起動時確認だけ、同版再適用、互換性、helper交換/復元/ZIP拒否を検証する。helperは事前にbuild:updaterする。

scripts/portable-updates-ui-test.cjsは配布EXEをartifactsの専用profileへコピーし、実helper/ランチャーで本体/一括/個別交換と再起動を確認する。DevTools/Node inspectorは隔離試験に明示指定し、最終のnative確認ダイアログだけ試験内で差し替える。通常起動にdebug/inspector引数を追加しない。結果/画像は専用profileへ保存。

## 0.22.1 の操作画面と再起動

更新・一括更新を先頭に置き、UpdateSettingsの共通設定と各AppletカードのAppletUpdateSourceをdetailsで折りたたむ。既定復帰は本体ではcreateDefaultSettings().updates.hostSource、AppletではupdateSource overrideの削除。既存useSettingsEditorの下書き・revision付き保存へ統一する。

通常のrelaunchとhelperのrestartArgsへ`--restore-view`を付ける。ホストはこの起動時だけstartMinimizedを上書きしてshowし、信頼済みホスト文書の固定URLへrestoreViewクエリーを付ける。IPCはその完全一致URLと送信元WebContents/mainFrameを照合する。通常起動の設定は変更しない。

useRestartViewはページ・選択Applet・設定カテゴリ/タブ・ログの対象だけをプロフィール内localStorageへ保存し、復元指定の起動時だけ読み取る。フォームの未保存値やWebページ内の状態は復元対象外。AppletページはstartupReadyと対象のrunning状態を待ち、既存openAppletPage経路で再表示する。削除/無効/起動失敗した対象はホームへ戻す。更新前の旧版が画面状態を保存していない場合、その状態は復元できない。

portable-updates-ui-testはトレイ開始ONの通常起動非表示、更新後の設定/更新ページへの復帰、通常再起動で別カテゴリとAppletページへの復帰、dark/light・900px・折りたたみ/既定復帰/下書きガードも検証する。
