# 本体とAppletの共通更新

利用者向けの操作は[README](../README.md#アップデート)を参照。0.22.0以降はframework-dependent .NET 10単一ファイル`AppDock.Updater.exe`をportable本体のresourcesへ同梱する。.NET 10 Runtimeの従来要件以外の導入は不要。

## 設定と取得

起動時の結果読取では`UpdateState.completion`へ成否とメッセージを渡す。成功だけを`UpdateCompletionNotice`でステータスバーへ表示し、`UpdateProgress`の上部進捗欄から外す。失敗・進行中・取消等は従来の進捗欄を使う。新しい更新操作の開始時にcompletionをクリアする。結果ファイルとログの保存形式は変えない。

`settings.updates`はhostSource、checkHostOnStartup、checkAppletsOnStartup、startupDelaySeconds（0～3600）、notifyOnStartup、allowSameVersion。Appletは`extensions.<id>.updateSource`を使い、未指定ならmanifest.updateRepositoryを継承、空文字は無効。

ローカル/UNCはupdate.jsonまたは発行フォルダー。Appletフォルダーにupdate.jsonがなければextension.jsonを読む。HTTP(S)はfeed URLまたは末尾/の配布ベースURL。GitHubはリポジトリ/Release URLからAPIとRelease assetsを使い、Source code ZIPは使わない。IDと正式版SemVer、最低本体版を照合する。非公開の認証トークンとプレリリースは扱わない。

## 発行

本体のpublish.bat/dev.bat run distはhelperをビルドし、portable EXEの発行後にpublish/update.jsonを生成する。外部公開はしない。

0.23.0の共通`scripts/pack-applet-update.ps1`は.NET 10 SDKでパッカーを増分ビルドして実行する。全6Appletのpublish.batは発行後にこれを呼び、各リポジトリのpublish/update.jsonとpublish/update.zipを生成する。通常のpublish/各Applet名フォルダーは配置用のまま保持する。Applet側でOutputDirectoryを指定した場合も、その内容をパッケージ化してJSON/ZIPはリポジトリ内publishへ出力する。.NET AppletではNode.js不要。

ZIPは一時ファイルへ完成させてから置換し、feedを最後に保存する。出力先が入力フォルダー自身でも、生成前に収録一覧を固定し、既存update.json/update.zipを除外する。manifestのAPI/entryと配布量上限を検査する。配布先確認は[チェックリスト](update-checklist.md)を参照。個別に生成するときは次も利用できる。

```powershell
.\dev.bat run build:updater
.\dev.bat run pack:update applet ..\Applet.Watch.at365\publish\Applet.Watch.at365 .artifacts\watch-update
```

生成したupdate.jsonとupdate.zipを同じWeb配布場所/GitHub Releaseに置く。本体はupdate.jsonとAppDock.at365.exe。JSONはschemaVersion=1、kind=host/applet、id=host/実Applet ID、version、任意minimumHostVersion、payload={file,sha256,size,format=exe/zip}。ZIP直下にextension.jsonと実行ファイル一式を置く。情報JSONを配布物の最後に公開する。

## 交換と復元

PortableUpdatesが上限付き取得、SHA256/サイズ照合、ID/版/entry/最低host照合を行う。ローカルAppletも専用TEMPへコピーして固定する。helperを交換対象外のTEMPへコピーし、対象と再起動引数をjob.jsonへ記載する。

helperは範囲・リンク/ジャンクション・ZIP traversal/重複/サイズを検証する。ready→本体commit後、本体・外側ランチャー・AppletのPID終了を最大60秒待つ。manager.stopのタイムアウトを終了証拠にしない。同じvolumeへ準備を始める前に全対象のjournalを保存し、準備・再ハッシュ照合→旧版一時退避→新しい版を移動する。全交換後にcommitted=trueをjournalへ記録し、結果保存→backup整理→journal削除の順に完了する。JSONはFlush(true)後に一時ファイルから置換する。commit前の失敗は逆順に復元し、commit後の中断は新しい版を検証して保持する。これは論理的な中断からの回復であり、物理的な電源断やディスク故障に対する完全な永続性を保証する試験ではない。

結果は.appdock/update-result.json、再起動後の画面・ログへ表示。TEMPは再起動後に専用パスを検証して整理。強制終了で残ったjournalは起動時にhelper --recoverで復旧を試す。復旧前に全対象の範囲・重複・退避名の対・リンクを検証し、commit済みならインストール先のハッシュも照合する。commit前は旧版へ復元、commit後は旧版/準備ファイルの整理を完了する。途中でロック等のエラーになった場合はjournalと必要なファイルを残し、同じ復旧を再試行できる。本体EXEが使用中で復元できない場合は起動を止める。完全終了後、journalのhelperが示す一時EXEへ`--recover <元の配置先>`を渡して復元してから起動する。復元前に一時EXE/journalを削除しない。

Appletフォルダーは配布単位で交換。保存データはSDK/ホストの.appdockへ置く。一括は適用可能な候補だけをまとめ、失敗/未設定は各行へ残す。

`installUpdates('all')`は本体と全ファイル型Appletを同じjobへまとめる。更新元一覧の順序に関係なく本体のmetadataを先に確認し、適用候補に入った本体版でAppletのfeed・ローカルmanifest・展開後manifestの最低host版を照合する。本体が未設定/取得失敗/同版の再適用不可/旧版なら現行host版を使う。通常の確認・Appletだけの更新では現行host版を使い、互換性不足は本体を先に更新するよう表示する。全候補の取得・検証に成功した後だけ1回の確認とhelperへの引渡しを行い、1回再起動する。準備中の破損や取消で本体/Appletを交換しない。WebAppletは本体管理のため個別候補に含めない。

UpdateSettingsの先頭は「本体と全Appletを更新」。本体のみ・Appletのみ・個別の操作も維持し、全体操作はAppletが0件でも本体更新に使用できる。VersionCheckの日時は更新確認ボタンと同じ`.update-check-control`へ置き、全体確認の隣にはUpdateState.resultsの直近のcheckedAtを表示する。結果本文を日時とボタンの間に挟まず、狭い画面でも操作と日時をひとまとまりで折り返す。

## 検証

tests/portable-updates.test.cjsは隔離ディレクトリーで設定移行、ローカル/URL/GitHub metadata、起動時確認だけ、同版再適用、互換性、helper交換/復元/ZIP拒否を検証する。helperは事前にbuild:updaterする。

scripts/portable-updates-ui-test.cjsは配布EXEを.artifactsの専用profileへコピーし、実helper/ランチャーで本体/一括/個別交換と再起動を確認する。DevTools/Node inspectorは隔離試験に明示指定し、最終のnative確認ダイアログだけ試験内で差し替える。通常起動にdebug/inspector引数を追加しない。結果/画像は専用profileへ保存。

## 0.22.1 の操作画面と再起動

更新・一括更新を先頭に置き、UpdateSettingsの共通設定と各AppletカードのAppletUpdateSourceをdetailsで折りたたむ。既定復帰は本体ではcreateDefaultSettings().updates.hostSource、AppletではupdateSource overrideの削除。既存useSettingsEditorの下書き・revision付き保存へ統一する。

通常のrelaunchとhelperのrestartArgsへ`--restore-view`を付ける。ホストはこの起動時だけstartMinimizedを上書きしてshowし、信頼済みホスト文書の固定URLへrestoreViewクエリーを付ける。IPCはその完全一致URLと送信元WebContents/mainFrameを照合する。通常起動の設定は変更しない。

useRestartViewはページ・選択Applet・設定カテゴリ/タブ・ログの対象だけをプロフィール内localStorageへ保存し、復元指定の起動時だけ読み取る。フォームの未保存値やWebページ内の状態は復元対象外。AppletページはstartupReadyと対象のrunning状態を待ち、既存openAppletPage経路で再表示する。削除/無効/起動失敗した対象はホームへ戻す。更新前の旧版が画面状態を保存していない場合、その状態は復元できない。

portable-updates-ui-testはトレイ開始ONの通常起動非表示、更新後の設定/更新ページへの復帰、通常再起動で別カテゴリとAppletページへの復帰、dark/light・900px・折りたたみ/既定復帰/下書きガードも検証する。

## 0.23.0 の進捗とキャンセル

UpdateStateはbusy/cancellable/phaseと、対象ID・名前・件数・取得bytes・任意の全体bytesを持つ。UpdateProgressを共通画面へ置き、ページ移動後も経過/結果を表示する。通知は取得中100msごとを目安に抑え、最終bytesは通知する。

IPCのcancelUpdatesは取得/検証中のAbortControllerだけを停止する。HTTPとローカルstream、コピーのファイル境界、ZIP展開子プロセス、ハッシュ読込へsignalを渡す。キャンセルはoriginエラーにせず、TEMPを整理してbusyを解除する。確認ダイアログ直前から共通キャンセルを無効にし、ダイアログでの取消だけを受け付ける。交換開始後は停止しない。起動時確認は引き続きmetadataのみ。

`scripts/update-progress-ui-test.cjs`は専用profileとループバックHTTPを使い、dark/lightの実progress/容量表示、キャンセル、再試行、最終確認での取消と元ファイル保持を確認する。

`scripts/update-recovery-test.cjs`はhelperソースを.artifactsへコピーし、そのコピーだけに停止点を挿入して試験用EXEをビルドする。準備前、2対象の準備後、各退避/移動後、commit後の8箇所で実プロセスを停止し、製品helperで復旧する。7箇所は旧版、commit後は新版を保持し、journal再実行、使用中ファイルによる復旧失敗→解除後再試行、設定/認証fixture保持を確認する。交換対象は隔離した検査用ファイルで、実portable EXE交換は既存portable-updates-ui-testが担当する。製品helperに故障注入機能は含めない。

```powershell
.\dev.bat exec node scripts/update-progress-ui-test.cjs
.\dev.bat exec node scripts/update-recovery-test.cjs
.\dev.bat exec node scripts/portable-updates-ui-test.cjs
```

いずれも本体とhelperを先に発行してから実行する。実配布先GitHub/HTTP(S)/UNCの検証とは区別する。
