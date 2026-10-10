# マウスジェスチャー

AppDock 0.26.0で入力基盤をWebBrowserToolsから本体へ移した。ブラウザ操作コマンドと送信キーはWebBrowserToolsに残す。設定は`Settings.gestures`、画面は`GesturesEditor`、保存は既存SettingsEditorのdraft/JSON/revision/atomic writeを共用する。

## 保存と移行

- `bindings`は最大2000行。各行は安定した`id`、`command`、`gesture`、`enabled`、`when`。配列順が実行順。同じ入力の全一致を順次実行し、同一コマンドIDは1回だけ。
- gestureは`move-up/down/left/right`、`click-left/middle`、`wheel-up/down`、`key:<キー>`。キーは既存ショートカットの正規化（Ctrl/Alt/Shift、英数字、F1〜F24、矢印、対応する記号・特殊キー）を使う。WinやOS専用の保護された入力は対象外。Tabは設定画面の特殊キー選択から登録できる。
- whenは`global/browser/exe/app/pages/owner/applets`、`appletIds`、`processes`。exe名はパスなし、`.exe`省略可、大文字小文字を区別せず、一覧内はOR。browserは共通`browsers`を使用。Applet条件はキーバインドの`matchesWhen`を共用し、非アクティブなページでは一致しない。
- `excludedProcesses`は全条件より優先。`enabled`は永続設定。トレイの一時停止は稼働中だけで、再起動で解除する。
- `gestures`がない旧設定だけ、WebBrowserToolsの8割り当て、ON/OFF、対象exe、Chromium制限、距離、ホイール間隔、表示位置・透明度を取り込む。空の割り当て配列を既定値に戻さない。元のApplet設定を破棄しない。
- manifestの`defaultGestureBindings`は同じAppletの宣言コマンドのみ・最大100件。新規Appletの初回発見でコピーし、`gestureDefaultsInitialized`で再追加を防ぐ。既存Appletへ更新時の既定値を押し込まない。WebBrowserTools 0.3.0は8操作の初期値を宣言する。
- hostはWebBrowserToolsへの設定通知で旧`gestures.enabled`を常にfalseにし、`hostManagedGestures=true`と本体の対象ブラウザ設定を渡す。保存済み送信キーとコマンドIDは維持する。旧Appletと本体の二重フックを防ぐ。

## 入力・実行

`AppDock.InputHost`は本体の子プロセス。自己完結.NET/WPFで配布EXE内に収録し、利用者へDesktop Runtime追加を要求しない。マウス/キーボードフックと非アクティブ・クリック透過の待機表示を所有する。表示の初期化はフック登録前に行う。コールバック内でコマンドやRPCを待たない。

本体は実Windowフォーカスと表示中Appletに対応する行を入力プロセスへ同期する（40ms間隔、内容が変化した時のみ送信）。ネイティブ側は押下時に最前面HWND・exe・カーソル下のWindow・除外・ブラウザクラス条件を確認。ローカル条件は通知済みHWNDにも限定する。状態の同期前に入力した場合に誤ったコマンドを実行しないよう、本体側も受信時と各コマンドの開始前に最新のページ/Window文脈を照合する。

右ボタン解放で一方向の移動を実行。距離は5〜500px、方向転換で解除まで取消。何も認識せずに解放した場合だけ通常右クリックを再送し、取消・未割当ストロークでは再送しない。右ドラッグを使うアプリは除外または一時停止する。

左/中クリックは押下時、ホイールはdelta 120を1刻みとして細かい入力を積算、キーは押下時に実行。捕捉した押下に対応する解放も消費し、右を先に解放しても対象アプリへ漏らさない。キーのOS repeatを捨て、未割当キーは通常入力へ渡す。対応する修飾キーを待機中に押した場合も対で捕捉する。Escapeは割り当てがあればコマンド、なければ取消。

実行中/予約中の追加操作は溜めない。ホイール間隔0〜5000msは上下共通で、間隔内の入力を捨てる。ホイールの未送信処理は最後の入力から100ms、右の解放、対象変更、設定変更、停止で取り消す。移動で確定した処理は右解放後に開始できるが、対象変更時には中止する。OSへ送信済みの操作は取り消せない。

キーとジェスチャーは同じShortcutDispatcherのコマンド予約を使う。`command.execute`の任意`invocation`（session/window/process/source）と`command.cancel`を追加し、.NETでは`CommandExecution.Current`とハンドラーのCancellationTokenに伝える。登録前に届いた取消も保持する。WebBrowserToolsは開始対象HWNDを実送信直前まで照合し、ジェスチャーに通常キー送信経路の150ms待機を加えない。再入経路のみ150msガードを維持する。任意のApplet内部の操作先や取消対応を自動変更する契約ではない。

入力プロセスの停止はログに報告し、設定変更/再起動で再接続可能。終了・接続断で入力フックと表示を解放する。別のジェスチャーソフトとの同時利用、管理者権限のアプリ、UAC/ロック画面は通常デスクトップと同一に保証しない。

## 検証

- `tests/gestures.test.cjs`: 移行、明示的な空配列、検証、条件、初期値、共通予約と取消。
- `dotnet run --project tests/InputTests/InputTests.csproj -c Release -- .artifacts/dotnet-host/input/AppDock.InputHost.exe`: 専用Windowで実OS入力を使った移動・クリック・キー・ホイール・通常入力復元・取消・除外の試験。カーソルを終了時に戻す。
- `dev.bat exec node scripts/gestures-ui-test.cjs [win-unpacked EXE]`: 隔離AppDock、試験Applet、実入力と設定画面。先にInputTestsをビルドする。`--portable`を指定するとpublishの単一EXEを隔離コピーして同じ試験を行い、前後のSHA256を照合する。
- ショートカット/ページの既存GUI回帰も併用し、試験は直列で行う。実測と未確認範囲はVERIFICATION.mdに記録する。

## コマンド一覧と編集パネル（0.26.24）

- 設定ページは全コマンドをカタログ順に表示し、未割り当ても残す。非表示の互換コマンドは割り当てがある場合だけ、未確認のコマンドは保存済みIDを使って表示する。検索はコマンド/完全ID/提供元/入力/条件、状態はすべて・割り当て済み・未割り当て。Windowsホットキーの登録エラーはジェスチャーには表示しない。
- CommandBindingToolbar/CommandBindingListはショートカットと共用する。コマンドと割り当ての2列、＋で直接追加、入力と条件のペアをクリックして編集する。行のメニューは編集・このジェスチャーの実行順・削除。削除確認はなく、保存前は全体の変更破棄で戻せる。追加後に自動スクロールせず、検索/表示位置/focusを保持する。
- GestureBindingDialogはBindingEditDialogの枠と入力停止/取消/適用を共用する。移動4方向、左/中クリック、ホイール上下を選択ボタンで指定し、キーボードはShortcutCaptureFieldで記録/修飾キー付き特殊キー選択を行う。種類を切り替えてもパネル内の各種類の選択を保持する。Tabは項目移動、Escapeは取消、対応キー自体は特殊キーから指定できる。
- 条件の共通部分とApplet検索/複数選択はShortcutConditionFieldを使用し、Webブラウザ/指定したexeを追加する。exe名はパスなし、カンマ/改行区切り、1件以上必須。未導入Appletの選択を保持する。新規Appletコマンドはowner、本体/不明コマンドはapp。条件/有効状態だけの変更は元の保存位置、追加/入力変更は移動先入力の末尾へ反映する。
- パネル内の一時入力は追加/適用時だけ共有draftへ反映し、キャンセル/×/Escapeで破棄する。外部更新で対象行が変わった場合は適用を拒否する。保存形式、2000行上限、JSON/revision/save、入力フック/dispatcherを維持する。編集/実行順パネルの表示中は既存setShortcutRecording契約でホットキーとジェスチャーの実行を停止する。
- GestureOrderDialogはBindingOrderDialogをショートカットと共用する。元一覧の検索にかかわらず同じgestureの全提供元/条件/無効/不明行を表示。入力選択、番号、ドラッグ・上下ボタン・Alt＋上下、複数入力の一時変更を扱う。同じgestureの既存スロットだけを入れ替え、変更した入力の外部更新は適用全体を拒否し、他入力/他設定の最新変更は保持する。key:Aとkey:Ctrl+Aは別入力で、ショートカットの順序とも独立する。
- 全体のON/OFFと折りたたみ「動作設定」は一覧上部。対象ブラウザ・除外・距離・ホイール間隔・待機表示を既存共有draftへ反映する。OFF中も一覧と編集は利用できる。
- scripts/gesture-command-checks.cjsをgestures-ui-test.cjsから呼び、一覧/編集/並べ替え/保存再起動/両テーマ3幅を検証する。APPDOCK_GESTURE_UI_ONLY=1は物理入力試験を省略する明示モードで、実入力の成功とは区別する。ショートカット側の共用部品もshortcuts-ui-test.cjsで検証する。

0.26.1〜0.26.23の入力別グループ表・インライン編集・コマンドパレットによる追加・複製/確認付き削除は、0.26.24で上記UIへ置き換えた。保存済みbindingsと実行順は引き継ぐ。

一時停止/再開は本体コマンド`appdock.gestures.togglePause`で切り替えます。トレイ内はチェック付き項目で、検索・キーからの実行も同期します。保存されない実行中の状態で、再起動後は解除します。配置の仕様は[タスクトレイ](tray-menu.md)を参照してください。
