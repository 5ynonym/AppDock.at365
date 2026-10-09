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
- `dotnet run --project tests/InputTests/InputTests.csproj -c Release -- artifacts/dotnet-host/input/AppDock.InputHost.exe`: 専用Windowで実OS入力を使った移動・クリック・キー・ホイール・通常入力復元・取消・除外の試験。カーソルを終了時に戻す。
- `dev.bat exec node scripts/gestures-ui-test.cjs [win-unpacked EXE]`: 隔離AppDock、試験Applet、実入力と設定画面。先にInputTestsをビルドする。`--portable`を指定するとpublishの単一EXEを隔離コピーして同じ試験を行い、前後のSHA256を照合する。
- ショートカット/ページの既存GUI回帰も併用し、試験は直列で行う。実測と未確認範囲はVERIFICATION.mdに記録する。

## グループ編集と共通コマンドパレット（0.26.1）

- 保存形式はbindings配列を維持し、表示をgestureの完全一致で分ける。key:A/key:Ctrl+Aは別グループ。groupGestureBindingsは各グループ内の元の相対順を保つ。moveGestureBindingは同じgestureの行だけを並べ替え、別グループの行を動かさない。ジェスチャー変更時は移動先グループ末尾へ入れる。
- ドラッグは行頭ハンドルだけで開始し、上下キーも同じ処理を使う。複製/削除は右端のメニュー、削除確認後だけdraftから除く。共通ToggleでON/OFFを表示する。キー記録でグループが変わると入力欄がunmountするため、blurに頼らず記録停止を通知する。
- renderer/CommandPalette.tsxが実行/選択/ピン留めを共用する。候補・検索・矢印/Enter・IME中Enter抑制・Tab移動・Escape・フォーカス復帰を一元化。mode=selectはonChooseだけを呼び実行APIを呼ばず、選択中のホスト入力を停止し終了時に復帰する。停止中コマンドも将来の割り当て用に選択可能。
- 実行モードのピン留めは従来通り即時保存、設定からの選択モードは共有draftを更新して「保存」で確定する。同じpinnedCommands形式と順位を使う。検索/行表示は提供元・完全IDを保つ。
- scripts/gestures-ui-test.cjsはAPPDOCK_GESTURE_UI_ONLY=1で入力フック試験だけを明示的に省き、編集/パレットを独立検証できる。省略をresult.jsonに記録し、実入力の成功として扱わない。

「…」は行の高さを変えないドロップダウンで複製・削除を表示します。画面下端では上側へ開き、外側のクリック・Escape・スクロールで閉じます。上下キーで項目を選択でき、Escapeで元のボタンへ戻ります。削除は確認後に行います。

ショートカットの操作メニューとBindingActions.tsxを共用します。「その他」列は両方とも幅48px指定・左右6pxの余白へ統一し、「…」は最小32px幅を保ちます。追加ボタンとメニューの選択状態には共通のアクセント色/角丸を使用します。入力フックや実行条件はこのUI共通化で変更しません。

BindingActionsのremovalKindはジェスチャーで既定のdelete、ショートカットでclear-keyを使います。ジェスチャーは従来の「削除…」と削除確認を保ちます。

表の列幅はショートカットと共通のcolgroupで指定し、すべてのグループで順番64px/有効52px/入力180px/条件200px/その他48pxを揃えます。コマンド列は残りの幅を使い、長い文字列は折り返します。最小720pxの表は内部で横スクロールし、グループ名や行の内容で「順番」列を広げません。

一時停止/再開は本体コマンド`appdock.gestures.togglePause`で切り替えます。トレイ内はチェック付き項目で、検索・キーからの実行も同期します。保存されない実行中の状態で、再起動後は解除します。配置の仕様は[タスクトレイ](tray-menu.md)を参照してください。
