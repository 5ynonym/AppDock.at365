# 条件付きショートカット

## 設定

`Settings.keybindings`は最大2000件の配列。配列順が実行順で、各行に安定IDを持つ。フォーム/JSON/各Appletの入口は既存SettingsEditorを共用する。
Appletの`extension.json`には`defaultKeybindings`で、自身の`commands`に宣言したコマンドの初期割り当てを指定できる。ID以外の`command`/`key`/`enabled`/`when`を各行へ書き、未宣言のコマンドはmanifest読込時に拒否する。初回発見時だけsettings.jsonにコピーし、適用済みIDは`keybindingDefaultsInitialized`へ記録する。旧設定の`extensions[id]`に登録済みのAppletは利用者の編集を優先して初期値を差し込まない。行を消した後の再起動やApplet更新でも再追加しない。
新しいWebAppletは`webApplets.shortcutDefaults`から追加時の保存トランザクションでコピーする。このテンプレートのコマンドは`open`/`reload`/`back`/`forward`/`home`に限定し、コマンドIDの`web.<UUID>.`を追加時に補う。既存WebAppletの行は変更しない。Applet詳細の一括初期化は、そのAppletのコマンドの行だけ置き換え、WebAppletでは現在のテンプレートを使う。
未割り当てコマンドへの初回キー入力では、登録元extensionIdがあればowner、なければappを既定にする。既存行のキー変更と割り当ての複製は条件を保持する。コマンドIDはショートカット表・パレット・ホームのピン留め・トレイ動作選択で完全な文字列を表示し、表示名による検索も維持する。

```json
{
  "id": "binding.example",
  "command": "at365.gmail.nextAccount",
  "key": "Ctrl+Tab",
  "enabled": true,
  "when": { "scope": "applets", "appletIds": ["at365.gmail"] }
}
```

scopeはglobal/app/pages/owner/applets。globalは常時、appはホスト管理Windowのフォーカス、pagesはさらに表示中Appletページ、ownerはコマンド登録元のAppletページ、appletsは対象ID内のいずれかを満たす。UIでは「グローバル」「AppDock全体」「すべてのApplet」「Gmailなどの提供元名だけ」「指定したApplet」の順。AppDock本体のコマンドには提供元の選択肢を出さない。ownerは保存したIDやコマンド名の接頭辞から推測せず、現在のコマンドカタログのextensionIdで判定する。提供元がない/不明/ページを持たない場合は一致しない。提供元の名前変更も現在の表示名を使う。applets以外のscopeはappletIdsを空にする。指定Appletは1件以上必要。未知の条件を黙って無視せず拒否する。条件追加時はshared/keybindingsの型・検証・評価・UI候補・試験を一緒に追加する。連続キー（chord）とユーザー記述の式は対象外。

keybindings未指定時のみ旧shortcuts/globalShortcutCommandsを割り当てへ変換する。旧非グローバルはappとなる。キー編集後はkeybindingsを保存し、旧フィールドはコマンドパレット等の表示用に派生させる。空配列を未指定扱いにして既定割り当てを復活させない。新形式を旧バージョンで編集する往復互換は保証しない。設定全体の1MiB上限・atomic write・revision保護を維持する。

## 入力と実行

- shared/keybindingsのresolverで全候補を保存順に判定し、利用可能なコマンドに絞り、同一IDを重複除去する。
- main/core/shortcut-dispatcherは開始前に全対象を予約する。コマンドによるキー送信の再入・同じキーの実行中再押下を抑止し、逐次awaitする。コマンド失敗は記録して続行し、終了・再起動では打ち切る。
- mainの本体IPCとpageHostShortcutが共通resolver/dispatcherを呼ぶ。PageHostはSurfaceの可視状態と実Windowフォーカスを参照し、別Windowと埋め込み表示で同じApplet IDを使う。Surface破棄時に登録を除去する。native Appletの独自Windowは含めない。
- WindowsHotKeyBackendはキーを重複除去して一度だけ登録。OSイベント時にはglobalを含む条件一致行を全評価する。同じキーがOS登録済みならローカル経路では実行しない。登録エラーは既存statusとして表示する。
- キー記録欄にフォーカスすると誤実行防止のため全グローバル登録を一時解除し、statusesを空にする。blur後は保存済み設定で再登録する。0.26.8から正常時の「登録済み／未登録」を表示せず、有効なglobal行で利用可能なコマンドの登録エラーだけを示す。空のstatusesは記録/再同期の一時状態でもあるため、直近の非空statusを表示専用に保持し、同じコマンド/キーのエラーを再検査結果が届くまで表示する。エラーの絞り込みも同じ表示statusを使う。無効行/別scope/利用不能コマンドへ古いエラーを表示しない。backendの登録状態/入力判定や設定draftへこの表示用キャッシュを戻さない。
- 同じキーの複数割り当ては正常な使い方なので、行ごとの「同じキーの割り当てあり」を表示しない。共通の説明で全一致/順次実行を案内する。操作メニューは「全体の実行順を上げる/下げる」と表示し、グループ内番号と操作範囲を区別する。
- ローカル入力はkeyDownのみ、repeat/IME中/記録中を除く。本体はDOMの入力先判定を保つ。Applet Web画面はCtrl/Alt付きまたはF1〜F24/Pauseに限定して文字入力を守る。リモートへのpreload/IPC追加は行わない。グローバルはOS登録でありIME状態は参照できない。
- アクティブページの条件は押下時に確定する。コマンドがページやフォーカスを変えても捕捉済みの対象を再評価しない。各コマンド自体の実行先（前面アプリ等）はそのコマンドの実装に従う。

## 検証

`tests/keybindings.test.cjs`は移行、検証、空配列、複数対象、全一致と重複除去、順序、エラー継続、再入、終了、OS登録集約を確認する。

`dev.bat exec node scripts/keybindings-ui-test.cjs [win-unpacked EXE]`は隔離profile/local Applet/HTTP WebAppletで本体・埋め込み・別Window・ページ切替・実Windowsキー・非表示・一覧保存を確認する。Fキー単独の既存登録との競合を避け、Ctrl+Alt+F10を試験用に使う。競合時は製品動作と区別する。実Gmail認証を使わず、既存のapplet-pages-ui-testを併用してGmailのオフラインViewを確認する。

実入力ヘルパーは押下中の修飾キーを解除せず、最大3秒待つ。専用GUIは非同期起動したヘルパーの`-ScanCode`でCtrl/Alt/F10をスキャンコードとして送り、Chromiumの合成入力より先に実OS入力を検証する。仮想キー送信が未到達になる試験環境で、この方式の実行を確認した。各押下/解放間に20ms置く。この試験用待機や方式を製品のショートカット処理へ持ち込まない。

## 編集画面と表示順

Applet個別のキー編集は詳細上部の「ショートカット」タブへ集約します。全体の設定ページではAppDockを先頭、以降をsettings.appletOrderに従うAppletグループとして表示し、提供元不明の保存済みコマンドは末尾の「未確認のコマンド」に残します。検索と割り当て状態のフィルターは全グループに適用します。Appletの並べ替えは表示だけで、keybindings配列や実行順を変更しません。各行の番号はグループごとに1から採番し、検索/状態フィルター中も元のグループ内番号を保ちます。実行順は従来の全体保存順を使います。両画面はuseSettingsEditorの下書き/JSON/revision/saveを共有します。

## マウスジェスチャーと共通の編集UI

- ショートカットの削除操作は「キーのクリア…」と表示する。確認後に選んだIDの行だけを共有draftから除き、空キーを保存へ通すために検証を緩めない。最後の割り当てを外した登録済みコマンドは未設定行として残り、同じコマンドの別行/トレイ設定は保持する。無効行/停止中Appletでも使え、保存/再起動後に解除を維持する。Deleteキーは通常のキー記録として扱う。BindingActionsのremovalKindはclear-keyを渡し、ジェスチャーの既定delete文言/確認は保持する。
- 各表は共通colgroupとtable-layout: fixedを使う。順番64px/有効52px/入力180px/条件200px/その他48pxを全グループで揃え、コマンド列が残りの幅を使う。表は最小720pxとして内部で横スクロールする。グループ名は表の外に置き、コマンド名/IDは列内で折り返す。グループごとの内容から列幅を自動計算しない。
- 6列の表・共通Toggle・行頭のドラッグハンドル・行末のBindingActionsを使用する。行の操作メニューはportalで表の外へ表示し、複製・キー割り当てのクリア確認・既定へ戻す・全体の実行順を上下へ動かす操作を提供する。ジェスチャーも同じ部品を使い、無効な項目を飛ばしてキーボードで選択する。両方のその他列は幅48px指定と狭い共通余白を使い、長い説明文はコマンド列へ置く。
- 追加ボタンはCommandPaletteのselectモードを使う。グループの追加はその提供元だけ、Applet詳細はそのAppletだけを候補にする。選択で空のキーを持つ未完成draftを追加し、記録欄へフォーカスする。キー指定前は設定の保存検証で拒否し、保存済み設定へ書かない。特別な既定キーを発明しない。既存の未設定コマンド行から直接キーを記録する動作も保持する。
- 特殊キーの選択欄はTab/Ctrl+Tab/Ctrl+Shift+Tab/Escape/Enter/Space/Pauseを提供する。通常のキー記録のTab移動・Escape終了・IME保護を保持する。複製は選択行の直後へ同じキー/有効状態/条件をコピーし、新しいIDを発行する。
- moveKeybindingInGroupは同じ提供元の保存配列内の位置だけを並べ替え、ほかの提供元の行の位置を維持する。提供元は現在のコマンドカタログから判定し、ID接頭辞から推測しない。グループ外へのdropは拒否する。表示番号は提供元グループ内の順番。全体の隣接位置へ動かす操作はメニューに保持する。Applet一覧の表示順とは独立する。
- 検証はtests/keybindings.test.cjs、scripts/shortcuts-ui-test.cjs、既存keybindings/navigation/gestures GUI。実単一EXEは既存のportable試験と同じ隔離CDPで接続する。
