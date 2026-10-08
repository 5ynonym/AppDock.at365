# AppDock・関連Appletの過去の実装記録

2026-10-09にALICE/TOOLS.mdから移した履歴です。以下の本文は、当時の検証範囲や判断を失わないよう保持しています。各行の版・日付・「未実装」「未確認」「未統合」は**その記録時点**の状態であり、現在の作業指示ではありません。後の記録によって更新された内容も含みます。

現在の作業ルールは[AGENTS.md](../AGENTS.md)、実装仕様は[開発ガイド](../DEVELOPMENT.md)とそこから参照する各文書、公開手順は[RELEASING.md](RELEASING.md)、新しい検証結果は[VERIFICATION.md](../VERIFICATION.md)を正本とします。現ソース・現在のbranch/差分を確認してから作業してください。この履歴へ新しい作業ルールや実行記録を継ぎ足しません。

移行時に照合した更新点:

- Appletページは0.18.0で実装済み、共通設定パネル/settingActionsは0.21.0で実装済みです。前段の「未実装」の相談を再実装の指示として扱いません。
- 自己更新は0.22.0以降に実装済みで、現在の手順は更新/Release文書を参照します。「Releaseページを開くだけ」の記録は旧仕様です。
- GitHubの実取得/隔離インストールは後段の2026-10-09記録で確認済みです。UNC、任意Webサーバー、実利用環境へのdeployとは区別します。
- バージョン・依存・ブランチ・権限・配布物ハッシュは当時の値です。現在の値はpackage.json/toolchain.json/Git/対象Release等で確認します。
- WebAppletの設計相談とGmailとの保存領域分離は[AGENTS.md](../AGENTS.md)へ移しました。既存のAppletページAPIと動的WebAppletの構想を混同しません。

以下のパスは相談当時のワークスペースを基準とする履歴で、削除・改名されたrepoやGit管理外artifactsを含みます。

---

## AppDock

- メインの`BrowserWindow`は`webPreferences.spellcheck: false`、共有セッションは画面作成前に`session.defaultSession.setSpellCheckerEnabled(false)`でスペルチェックを無効化。設定JSONの項目追加は不要。無効状態は隔離起動した配布版の`session.isSpellCheckerEnabled() === false`と入力欄で確認する。

- AppDock0.17.0（2026-10-08）: ウィジェット基盤は全削除、旧API互換不要。build-main.cjsでout/mainを再生成する。.NET SDK/Runtimeの変更後はnative WatchのRelease buildとportable smokeの接続/表示・非表示/保存を確認。Watchの復元済み旧test-ui.cjsには起動環境と旧UIセレクターの問題があるため、その成功を前提にしない。asar検査はpnpmの境界に沿ってelectron-builder→app-builder-libのcreateRequireから@electron/asarへアクセスする。

- AppDockトレイのダブルクリック判定は`--double-click-time`でOS設定を取得し、取得失敗時のフォールバックはWindows既定500ms（通知順の余裕25msを別途加算）。runtimeconfig欠落エラーでは.NET再導入前に、発行元・portable EXEの7zip一覧・稼働中Temp展開先の内容を比較する。EXE内部にJSONがある一方でTempだけ欠ける場合、起動後の消失原因は別途調査する。
- deploy.batの配置先は常時同期と変更履歴で全ファイルを復元できるとユーザーが明示（2026-10-07）。今後その配置先へのdeployでは旧EXEなどを別フォルダーへ退避しない。配置後のハッシュ照合と設定保持の確認は続ける。この指定はdeploy.batの配置先に適用する。AppDockの既存deploy.ps1はCopy-Itemのみで退避処理を持たないため変更不要。
- GmailChecker Applet 0.1.0はNode方式、必要AppDock 0.11.0。設定はEXE隣settings.json、アカウント状態/暗号化トークンはEXE隣`.appdock/storage`と`.appdock/secrets`。独立アプリのRoaming保存先とは別で自動移行なし。Nodeのfile-dialog/audio/tray-attentionはホスト共通API。Windows PowerShell用PS1はUTF-8 BOMにし、Get-FileHashが解決されない環境ではSHA256.CreateとFile.OpenReadで配置照合できる。
- Gmail Web方式の第一弾（2026-10-07）: `30.PROJECT/Applet.GmailChecker.at365/test-web.bat`で独立した対話テストアプリを起動。AppDock内のElectronを使用、ユーザーログイン用profileは同repoの`artifacts/gmail-web-test`。オフライン自動テストは`artifacts/web-fixture-*`に限定。Google画面のpreloadなし、UA変更なし。Googleログイン可否の手動結果確認後にAppDock統合とDOM差分検知へ進む。WebContentsViewを含む画面はBrowserWindow.capturePageだけでは実画面を証明できない。
- 同日の手動確認で、will-redirectの制限対象をメインフレームに絞った修正後に、ユーザーが実Gmail受信トレイ表示を確認。Electronのwill-redirectは子フレームにも発生する。未対応の転送先の診断はoriginだけとし、認証URLのqueryなどを記録・共有しない。

- Gmail Web Applet 0.1.0（2026-10-07）: 新規repoは30.PROJECT/Applet.Gmail.at365、必要ホストAppDock 0.12.0。共通web-accounts APIでWebContentsView/独立session.fromPath/限定IPC/破棄をホスト、isolated world 1001のMutationObserverとGmail新着判定をAppletが担当。保存先はEXE隣.appdock/web-accounts/at365.gmail（accounts.json、sessions/<id>）。start-dev.batはartifacts/gmail-devの隔離AppDockをGmail表示で起動。旧Webテストからのprepare-dev.cjs --import-test-profileは両アプリを停止して新規profileへだけローカルコピーし、元を保持。実ログインの再入力なし復帰と実DOM識別子は確認済み。新着判定は受信トレイ先頭ページ限定、初回/再読込/復帰は基準を作り直す。同日ユーザーが試しに送信したメールでWindows新着通知の表示を確認したと報告。実受信から検知/表示はユーザー確認済み、実スレッド返信・通知クリック/音・Google再認証・複数実アカウント・長期常駐は別確認。ローカルUIのスクリーンショットは子WebContentsViewを含まないため、remote.capturePageと表示枠・実ウィンドウを併せて確認する。

- Gmail 0.1.1の認証修正: accounts.youtube.comはGoogleログイン用の認証先で、manifest.webAccounts.originsへhttps://accounts.youtube.comを正確に追加。通常のYouTubeサイトやワイルドカードは許可せず、observeOriginはGmail専用のまま。manifestはAppDock起動時に読むので、更新後はApplet再起動だけでなくホストの完全終了/起動が必要。実利用先はMainTools/AppDock.at365/extensions/Applet.Gmail.at365。ログイン領域は維持。

- Gmail 0.1.2: workspace.google.comはログアウト後のGmail案内・ログイン入口として正確なoriginを許可。Gmail開発profileとGmail GUI/portable/認証fixtureはGPUオフ。prepare-devが既存設定を保ってhost.hardwareAcceleration=falseを保存。旧Applet.GmailChecker/test-appもready前にdisableHardwareAccelerationを呼ぶ。ユーザーは現ElectronとGPUドライバの相性問題を報告しており、このテストではソフトウェア描画を使う。変更後はプロセスの完全終了/再起動が必要。

- Gmail 0.1.3: accounts.google.co.jpを正確なGoogle認証originとして許可。 同日、ユーザーがGPUオフの開発版でGoogle Workspaceのログアウト→ログイン→受信トレイ表示を確認。確認対象アカウントはユーザー申告でGoogle Workspace。地域向けの認証転送があり、個人Gmailだけの事前確認とは区別する。新旧テストのGPUオフを維持し、アカウントの種類だけから外部SSOや転送原因を断定しない。

- Gmail Web 0.2.0 / AppDock 0.13.0（2026-10-07）: React UIは受信トレイ・新着一覧・アカウント設定。Gmail行の.yW送信元/.bog件名だけを抽出し、.y2プレビュー/本文は取得しない。検知したスレッド更新数を表示し、未読総数/正確なメッセージ数とは区別。履歴は起動中のみ最大50件/48KBで、クリア後は残し、停止/監視OFFで消去。通知への送信元・件名はnotificationDetails=falseを既定とする。実Gmailで2行の読取対応・認証保持・GPUオフを確認済みだが、今回の実到着一覧/実返信/複数実アカウント等は別確認。
- WebアカウントUIの追加契約: report(...,data)はJSON50KB以内の一時データをローカルsnapshotへ渡す。Node readではdata:nullとして、10枠の観測＋履歴が1MB JSON-RPCを超える二重送信を避ける。viewportは信頼済みローカルUIのみ、client DIP矩形をclipし、nullでViewを隠して背景監視を続ける。ResizeObserverで領域を更新する。新API使用時のminimumHostVersionは0.13.0、旧UI未指定は236/146の既定枠を維持。

- Gmail0.2.1 未読方針（2026-10-07）: ユーザーは新着件数を未読だけにし、起動時の未読も新着として扱う方針。初回受信トレイ/監視再開時の未読を取り込む。zE/yOで行の未読/既読、未知/非表示は未確認。件数は未クリアの確認済み未読スレッドの集合で、履歴上限50件とは独立。同じスレッドへの返信は1件、既読化で減らす。状態だけの未読変更は再通知せず、表示クリアはGmailの状態を変えない。メール本文/他フォルダー中は最後の値を維持、受信トレイで再確認して更新。先頭ページ可視行のみでGmail全体/個別メッセージの未読総数ではない。実Gmailの既読6行・未読0/件数0、GPUオフ・認証保持を確認。実未読操作はユーザー確認待ち。

- Gmail0.2.2 / AppDock0.13.1 背景描画（2026-10-07）: WebContentsViewをnative非表示/未接続にすると、backgroundThrottling:falseかつdocument.visibilityState=visibleでもrequestAnimationFrameが停止することを再現。非選択アカウントやviewport(null)ではViewを非表示にせず、Applet別のnever-shown BrowserWindowへvisible・実サイズで接続して保持する。選択時は同じViewをUIへ移し、停止時は背景Windowも破棄。UI未表示/未選択/新着一覧/トレイ非表示/最小化を、サーバーfixture変更→fetch→ページ自身のrAFで検証する（DOM直接変更だけでは描画停止を検知できない）。実Gmailの裏でrAF継続/GPUオフ/認証保持は確認済み。別ブラウザーからの実状態変更・実受信の背景同期はユーザー確認待ち。新Appletは最低ホスト0.13.1、既存未読判定の意味は維持。

- Gmail0.3.0 / AppDock0.14.0（2026-10-07）: ユーザーはGmail画面の位置/サイズ保存、次/前アカウント（Ctrl+Tab/Ctrl+Shift+Tab）、Windows通知と連動しない枠ごとの音ON/OFFを要望。WindowStateStoreをweb-accounts/<id>/window-state.jsonへ再利用し、通常枠/最大化・モニター作業領域復帰を保持。アカウントsoundはaccounts.jsonに保存（初期OFF）。通知音は未読到着/初回未読にaudio.playを独立して呼び、toastにはsilent:trueを指定する。Web/ローカルのキーは自身の登録コマンドと利用者設定を参照し、global指定の二重処理を避ける。
- Gmailのメールを開く操作は、itemOpener関数式のJSONキーをisolated world1001へ渡し、可視受信トレイの一致スレッドの件名だけをクリックする。非公開thread URLの組立てを避け、消えた行は受信トレイへ案内。実Gmailの既読行で画面移動を確認済み（本文を取得せず、未読を操作しない診断）。Playwright主プロセスevaluateではrequireがないため、音の統合検証はモジュール差し替えでなく実プレーヤー生成＋失敗ログなしで行う。再起動するオフライン試験は、fixture登録前に保存設定のAppletを有効化しない。制御されたチェックボックスの保存待ちは楽観反映＋失敗時復帰で操作感を保つ。

- Gmail0.4.0 / AppDock0.15.0（2026-10-08）: never-shown親WindowはrequestAnimationFrameが動いてもfirst-contentful-paintが発生しない場合がある。初回未表示ページの更新検証はrAFだけで済ませず、paintを条件にサイト自身がfetchを始めるfixtureも使う。背景Windowをopacity:0・全ディスプレイ外・focusable:false・skipTaskbar:true・frame:falseでshowInactiveすると初回描画が成立した。非表示/最小化時もViewを背景へ移す。実Gmailは操作UIを開く前のpaintを読み取り診断できる。実複数アカウント/別ブラウザー同期とは検証範囲を区別する。
- Webアカウントの通知音はsounds/<SHA256>.wavへコピーし、元の名前をsound.nameに保存。同じ内容は共有し、旧外部パスは起動時移行・失敗時は元設定保持/実効OFF/soundErrorで再選択を案内。停止時は未参照の管理hash名WAVだけを整理する。UIテーマはsnapshot.darkで本体nativeThemeへ同期。本体「設定 → バージョン情報・更新」は既存更新APIを再利用し、表示だけでは通信しない。

- Gmail0.4.1 / AppDock0.15.1（2026-10-08）: PlaywrightはページへEmulation.setFocusEmulationEnabledを自動設定するため、未表示Webの通常起動検証には使わない。主プロセスNode Inspectorの読み取りと通常Electron fixtureを使い、paintだけでなくページ自身の更新開始と実受信を確認する。Windowsではready前に既存disable-featuresを保ちCalculateNativeWinOcclusionを追加。manifest.keepActive:trueのobserveOriginだけ製品側でページアクティブ状態を維持し、認証/メインフレーム移動で解除する。OSのフォーカスは移さない。実Gmail1枠の未表示到着とオフライン2枠は検証済み、実複数枠/長時間/スリープは別確認。本体EXE0.15.1への更新も必要。
- WebContents.destroyedの処理でwc.debugger getterを呼ぶとObject has been destroyedになり得る。生存中にDebugger参照を捕捉し、view.close前に明示dispose、destroyed時も冪等に解放する。ユーザー画像のWebContents.dispose/emitエラーと同じ破棄済みgetterを回帰に入れ、実単一EXEの停止/再開/完全終了も確認する。

- Gmail0.4.2 / AppDock0.15.2（2026-10-08）: paint/タイマー/hasFocus正常やobserver.readyは、実Gmailの継続受信開始の証拠にならない。ready後1回だけのアクティブ化も実送信で不足。背景では30秒ごとに250ms解除→再適用し、native focus中はエミュレーションを解除して通常focus/blurを優先する。同一文書のhash/history移動は接続を保ち、別文書/認証/破棄では周期と待機を取り消す。通常Electron fixtureではDOM準備より遅れて受信処理を初期化する。実2アカウントも再起動を挟んだ両方向・受信側未表示で検証済み。通信時間も加わり到着は30秒を超え得る。長期常駐/実スリープは別確認。
- Gmail起動診断の--manualは自動終了せず、主プロセスInspector接続先をstartup-inspector.txtへ保存する。終了は診断のquitで正常終了し、親プロセスだけ止めても子アプリが残るとは仮定しない。最終確認後は通常start-dev.batで起動して診断タイマーを残さない。実メール送信の検証は明示許可された開発用アカウント間だけで、送信直前に宛先チップ1件・未確定の入力残りなし・固定件名/本文・送信元を照合する。



- Gmail0.4.3（2026-10-08）: 実Gmailの空状態はtable.TB tr.TD > td.TC「新着メールはありません。」で、旧.aRvだけではready:false/no-row-idsとなる。最後の削除時だけでなく空状態で起動したkeepActiveにも影響するため、空の受信トレイ→実受信も検証する。.Dj .tsの開始/終了/総数と全可視行の識別一致でcompleteを根拠付け、切り詰め/ID不明は全件取得と断定しない。履歴とpendingのscopeを保ち、カテゴリ変更・ページ外への押し出しと確認範囲からの消失を区別する。履歴上限より多いpendingも整理する。見つからないメールに無条件reloadしない。readyな受信トレイなら直ちに案内、他フォルダー/更新中だけ待機する。正常メールを開く途中のWeb画面切替はタイミングに影響するため、openItem完了後に表示を切り替え、削除直後のクリックも配布版GUIで検証する。

- Gmail 0.5.0 / AppDock 0.16.0: accounts.jsonの配列順とmonitoring（未指定true）をUUID/セッションを保ったまま保存。moveはselectedを変えず、monitoringResetsはread間のOFF→ONにも基準resetを渡す。OFF後の古いreportはホストでもattention/dataを抑制する。追加は設定中だけ、表示名はEnter保存/取消に対応。
- Gmailヘッダーのアバター配信先はlh3〜lh6.googleusercontent.comとlh3〜lh6.google.com。0.16.1では当該アカウントのsession/credentials:includeのClientRequestで取得する。未認証で取り直すと設定済みアバターURLでもGoogle標準画像になることを実Gmailで再現し、右上画像との照合で修正確認。Session.fetchのmanual redirectは取消エラーなのでClientRequestのredirectイベントから宣言済みoriginへ逐次検証。最大3転送/5秒/入力64KB・64pxPNG、画像バイトはUIだけへ渡しNode readへ送らない。
- Gmail 0.5.2 / AppDock 0.16.3の切替コマンドはWindowを開く/復元/アクティブ化しない。Gmail WebContents自身に入力フォーカスがあり操作Windowもアクティブな場合だけ、切替先の接続済みViewへ入力を渡す。旧0.16.2は初回切替で入力フォーカスを失い、2回目のキーが効かなかった。検証で毎回wc.focusを呼ぶと隠れるため、初回だけfocusし、以後はgetFocusedWebContentsへキーを送る。別Window/ローカル入力欄/未表示/非表示/最小化のフォーカスは保持。
- Gmailの新規仮名は「新しいアカウント」。本人ヘッダーのaria-label（Google アカウント/Google Account）から名前、なければメールをaccountNameへ返す。ホストはtemporaryName:trueだけを一度変更し、手動rename/取得後はfalse。旧フラグなしの「アカウント N」は仮名判定、カスタム名は保持。実開発2枠で取得可否とaccounts.jsonハッシュ不変を確認し、本人名/メール/認証値は診断へ出さない。

- AppDock依存更新（2026-10-08）: pnpm12はnative EXEなので、ローカルnpm --ignore-scripts取得後にpnpm自身のinstall.jsを明示実行し、npm rebuild --ignore-scriptsでWindows shimを再生成する。初回取得と再実行を両方確認する。Electron44.6.0は通常CLIで初回取得するため、直接EXEを使うPlaywright等の前にはroot postinstallのinstall-electronを実行する。pnpmの変更なしinstallではoptimisticRepeatInstallによりroot scriptも省略され得るので、必要時はdev.bat run postinstall（またはinstall --config.optimisticRepeatInstall=false）。現ツールはNode24.21.0/pnpm12.10.1、全て.tools内。

- AppDock0.16.4のトレイ表示維持（2026-10-08）: 旧26.15.3 portableはbuildごとにTEMP展開名を生成し、GUIDなしのWindowsアイコンが別登録になっていた。build-portable.cjsがビルド内だけでcustom portable.nsiへ差し替え、TEMP/外側EXE/test-profileのSHA256で版を含まない実行領域を生成。Trayは実行EXE/保存先のUUID v5。未署名GUIDは実行パスに紐付くので両方安定化する。配置/名前/TEMP変更は別ID、今回の移行後は初回だけピン設定が必要。実Windows登録キーとIsPromotedの別版更新保持、再起動/同時起動/ランチャー終了後の本体保護/最終削除を専用アイコンで検証済み。実利用のOS設定は変更しない。
- portable.nsiはgateで展開/整理を直列化し、名前付きkernel leaseをDuplicateHandleで子へ渡す。StdUtils.ExecShellWaitExの戻りはhProc:<hex>であり、そのままWin32 HANDLEへ渡さず検証して0x<hex>へ変換する。明示のWaitForSingleObject/GetExitCodeProcess/CloseHandleで終了を扱う。26.15.3はportable.script/includeを無視するため、ビルダーの固定版/元テンプレートを検証し、更新時は連携を再確認する。発行はpublish.bat/dev.bat run dist、API試験もdev.batでpnpm環境を継承。直接CLI発行を使わない。

- Gmail0.6.0 / AppDock0.17.1: Gmailの「設定」タブでmanifestの全体boolean設定3項目と新着履歴保存件数（10〜50件の静的select）をホストsettings.jsonと共有する。WebAccountUi.snapshot.settings/setSettingは自身の宣言済みboolean/静的select＋settings capabilityに限定。ホスト変更もonChangedへ通知、停止時に購読解除。GUI再起動を含む検証中にout/mainを削除再生成するビルドを重ねるとnode-worker.js欠落が起きるため、発行完了後の固定した配布版を使い直列化する。

- Appletページ設計調査（2026-10-08、AppDock0.17.1/Gmail0.6.0時点）: GmailのReact UIはAppletのweb/index.html、ホストWebAccountControllerがBrowserWindow・アカウントWebContentsView・背景Windowを管理。現行IPCはwindow.webContentsと厳密なUI URL/main frameで送信元を照合し、changed/viewport/cycle/ダイアログ親もWindow依存。ページ対応時はUI WebContentsと表示先Window/領域を分離し、本体ページのオフセット・非選択時のpark・input focus・本体コマンド検索overlay・停止時closeを検証する必要がある。表示先切替でsession/Viewを再作成しない設計を候補とする。これは未実装の設計知見。
- AppDock0.18.0/Gmail0.7.0（2026-10-08）: local React UIをAppletSurfaceのWebContentsViewとして保持し、host page/windowへ載せ替える。GmailのIPC/変更通知はUI WebContentsに結び付け、viewportはUI内座標のままgroup Viewへ配置する。本体page-contentはwidth:100%/max-width:none/margin:0で縮みを防ぐ。Home表示中も本体Windowはvisible/focusedなので、cycleとUIキーはsurface.visibleを必須にして入力を奪わない。hidden standaloneにはUI containerを残しremoteだけをparkする。GUIのUI取得はapp.context().pages、Windowの照合はcontentView内のUI所有関係。単一EXEはElectron.launch直渡しでなく通常起動後CDP接続、詳細GUIはwin-unpacked。再起動fixtureは保存したAppletを一時OFFにしてprotocol登録後にcommandで起動する。今回は全てオフライン試験で、実Gmailのログイン・受信は別確認。
- AppDock0.19.0/Gmail0.8.0（2026-10-08）: リボンのbottom/separatorsはホスト設定。既存order/hiddenのみは全て上寄せ維持、ribbon未指定/初期化はtheme/profile下寄せ。GUI dragToは別スクロール位置のsource/targetで誤行を掴むことがあるため、試験時だけzoomを縮小して同時可視化しhandleから操作、通常zoomへ復帰して実配置を確認する。Gmailの左余白と右本文topは共通header/toolbar CSS変数で整列し、inbox130DIP/他タブ146DIP。切替バー除去後も安定した次/前コマンドとキーボードを検証。
- Applet詳細/設定共用の設計調査（2026-10-08、0.19.0）: AppletSettings.tsxとShortcutsEditor.tsxはpropsでdraft/編集を受ける独立部品。main.tsxのSettingsPageがdraft/revision/dirty/JSON/検証/save/avatarを持ち、非表示でもmountを保持。Applet詳細で同じ編集パネルを表示する場合は設定タブ/見出し等を共用化し、編集状態と保存を両表示先の共通親へ集約して未保存内容を保つ。二重draftは避ける。これは未実装の設計知見。

- AppDock0.20.0/Gmail0.9.0（2026-10-08）: Node navigate(back/forward/reload/inbox)は選択Viewの操作、snapshot.navigationRevisionでUIがinboxへ戻る。externalLinkSettingは自身のdeclared boolean+settings capability限定、checked開くのみ保存、外部HTTP(S)/mailto境界保持。showToolbar/unreadOnly等は既存setSetting保存で共有。account-list-offsetはinbox基準で固定（toolbar有130/無66DIP）。ElectronApplication.evaluateのcallback第1引数はElectron module、任意値は第2引数。通知clickのfixtureは実Notificationオブジェクトのshowのみ抑止してemit(click)から実command/page/Window/stale guardを試験、実Windows toastとは区別する。

- WallpaperSlideshow背景準備の設計調査（2026-10-08、未実装）: Applet0.3.0は起動時にWallpaperStyle=22/TileWallpaper=0を書くだけで背景種類/適用結果を確認しない。正式APIのIDesktopWallpaper.SetPosition(DWPOS_SPAN)と画像適用を候補にするが、Windowsスライドショー/Spotlight→設定UI「画像」への切替は実機確認が必要。wallpaper.bmpは適用後に黒く上書きされるため、既存BMPの再適用は避け、新しい描画と協調する。AppDock0.19.0の設定スキーマに実行アクションはなく、設定ボタンにはホスト共通の宣言/描画とexecuteCommandへの接続が必要。Windows背景ページ入口はms-settings:personalization-background。
- Applet共通設定パネル実装（2026-10-08、AppDock0.21.0専用worktree）: useSettingsEditorをAppで1つ保持しdraft/JSON/revision/dirty/avatar/save/resetを共有。AppletSettingsPanelとSettingsActionsをApplet詳細/SettingsPageから使う。非表示SettingsPageは選択用hookだけを保持してreturn nullとし、入力ID/キー記録を二重描画しない。保持済み詳細設定へJSON編集後に戻る場合もuseLayoutEffectで表示前にフォーム変換し、不正なら説明へ戻して入力を保持。隔離navigation/UI/preferences GUIと90回帰で確認。元mainへの統合と単一EXE発行は未実施。

- WallpaperSlideshow0.4.0/AppDock0.21.0（2026-10-08）: settingActionsは自身の宣言済みcommandのみ、結果表示/実行中無効化/未保存draft維持を共通化。背景準備はSTAとcommandGateで直列化し、SetWallpaper/SetPositionとBackgroundType0、GetStatusのDSS_SLIDESHOW（0x02）がないこと・GetPositionを読み戻す。DSS_ENABLED（0x01）はスライドショー可否で背景画像の有効化ではない。現在の表示画像はThemes/TranscodedWallpaperから保存、停止時黒画像・pause維持。OS依存値とcache失敗は手動案内付きerror。91回帰/nativefixtureGUI/portable成功、COM読み取り成功。実Spotlight/OSスライドショー/単色からの変更は未確認。発行完了前のEXEコピーは最終SHAと異なり得るので、portable検証は完了後のコピーと最終EXEのSHAを照合する。

- AppDock自己更新の設計確認（2026-10-08）: 現行はelectron-builder26.15.3のportable targetで更新ライブラリ未導入。標準electron-updaterのWindows経路はNSISで、portable維持時は外側EXEを終了後交換する独自helperが必要。既存portable.nsiのlease/展開mutex、index.tsのmanager.shutdown・設定flushと連携し、ランチャーも終了してから同名/同パス交換。settings.json/.appdock/extensionsは保持。公式: https://www.electron.build/v26/docs/targets/ 、https://www.electronjs.org/docs/latest/api/auto-updater 。相談段階、未実装。

- AppDock/Applet共通更新helperの設計（2026-10-08、未実装）: 本体EXE交換とApplet配布フォルダ交換の2モードを共用できる。dotnet/native/node Appletは別プロセスで、対象だけの更新は本体再起動必須ではないがmanifest再読込/起動との排他制御が要る。現stopはkill後最大2秒待ちでタイムアウトでもstoppedへ進むため、更新処理では実際のプロセス終了を別途確証する。初版の全終了→交換→再起動は既存discoverと親ランチャー終了に合わせやすい。helperは交換対象外TEMPへ展開、Appletはmanifest/DLL/依存/資産を一式で交換し、settings/.appdockを保持。独自Appletが配布フォルダ内に作る設定は保持対象を別途定義する。

- AppDock更新確認の現ソース（2026-10-08）: src/main/core/updates.tsはupdateRepository(owner/repo)からGitHub releases/latestをnet.fetchし正式版tagを比較。VersionCheck.tsxは更新確認とリリースページを開く操作のみ。自己更新実装時はこの入口をlocal/UNC/HTTP(S)/GitHubへ拡張する案で、配布物取得/検証/共通helperでの交換は未実装。publishに更新情報JSONを生成すると単一EXE本体とApplet配布一式を各取得先で共通扱いできる。GitHubのSource codeアーカイブではなくビルド済みRelease assetsを選ぶ。

- AppDock worktree削除（2026-10-08）: mainのnode_modulesをjunction共有したworktreeでpnpmを実行すると、main内のパッケージjunction/.bin shimがworktree絶対パスへ書き換わり得る。トップjunctionを外すだけでは修復されない。依存インストールを行うworktreeは独立node_modulesを使う。削除前後にmainのTarget/.bin旧パスを検査し、mainの存在する同版パッケージへの置換を境界付きで行い、元ツリーのdev.bat typecheckとpublish.batを検証する。Targetは@($item.Target)[0]で単一文字への誤indexを避ける。junction解除はRemove-Item -LiteralPath -Forceで再帰しない。

- AppDock0.22.0共通自己更新（2026-10-09）: PortableUpdatesは各更新元からmetadataだけをcheckし、明示install時だけ取得/検証。AppDock.Updaterは既存.NET10 Runtimeを使うframework-dependent singlefileを本体へ同梱。job ready/commitと実PIDのHandleを事前取得して本体・outer launcher・Applet終了を確証してから交換、全候補一時準備/逆順復元/journal/result。updateSettingsは独立トップレベル、Applet.updateSourceはmanifest.updateRepository継承/空欄無効。publishはfeedを自動生成、pack-updateで既存AppletフォルダをWeb用ZIP+feed化。保存先は配布Appletフォルダ外とする。テスト時のmain inspectorにはglobal requireがないのでprocess.getBuiltinModule('module').createRequire(resourcesPath+'/app.asar/package.json')でElectronを取る。終了rendererのIPC Promiseを無期限に待たず、再起動後はmain inspector経由の実snapshotで確認。helperは製品のnative確認dialogを省略しない。

- AppDock0.22.1再起動UI（2026-10-09）: 通常relaunchと更新helperのargsに--restore-view、host URLは固定のrestoreView query込みでIPC完全一致を照合。useRestartViewはプロフィールlocalStorageの画面選択だけを復元。AppletSurface.closeはselected(null)を送るため、終了中はホストからrendererへ選択変更を送らない（送ると復元先がホームへ上書きされる）。AppletページはstartupReady/対象runningを待つ。GUIのvisibility判定もsnapshot取得だけで済ませずstartupReadyを待つ。旧版から最初の更新では未保存の旧画面状態は復元できない。

- AppDock0.23.0更新補強（2026-10-09）: helperのjournalは同volumeへの準備前に作り、全交換後committedをFlush(true)→置換で記録してから結果/backupを整理する。回復時は全対象の範囲・対になる退避名・リンクを先に検証し、commit前は逆順復元、commit後は新payloadを検証してcleanup。使用中なら記録を残して再試行。故障注入はartifactsにコピーしたソースだけへ追加し、製品helperで8停止点の回復を検証する。実portable交換は別の実EXE試験で確認する。
- 全Appletのpublishは共通scripts/pack-applet-update.ps1で各repoのpublish/update.json+update.zipを生成し、通常配置用サブフォルダー外へ出す。Gmail以外は追加Node不要、共通packerに.NET10SDK必要。古いpublish出力にSDK DLLや埋込済fontが残ることがあるため、既存deploy対象とZIP内容を照合する。取消確認はmainの進捗だけでなくrendererのprogress値も待ち、HTTP接続中断/再試行/インストール先保持を確認する。実GitHub/HTTP(S)/UNC配布先はユーザーの後日確認、手順はAppDock/docs/update-checklist.md。

- GitHub CLI（2026-10-09）: C:\Program Files\GitHub CLI\gh.exe、確認時2.102.0。現CodexプロセスPATHにない場合は絶対パス使用。sandboxでauth statusがinvalidでも通常Windows環境のkeyringでは認証成功する場合あり、ログインやtoken再設定の前に実行境界を確認。5ynonym/AppDock.at365のADMINとRelease一覧の読取を確認済み。公開/pushはユーザーの対象/公開指示に従う。秘密値は表示・保存しない。

- AppDock/6AppletのGitHub初回Release公開済み（2026-10-09）: 本体v0.23.0、Gmail v0.9.0、Wallpaper v0.4.0、Watch v0.1.1、WebBrowserTools v0.2.4、WindowMover v0.2.1、WindowsTools v0.1.1。各5ynonymリポジトリの正式latest、EXEまたはupdate.zipとupdate.jsonをassetsへ添付。draftでdigest照合後公開し、匿名の全payloadダウンロードhashと製品PortableUpdates.checkを全7件成功。検証記録はAppDock/artifacts/github-releases-0.23.0/public-verification.json。実インストールやUNC/任意Webは別確認。次回は既存タグ/Releaseを再照合し、公開済み同版assetを無条件に上書きしない。

- GitHub実更新検証（2026-10-09）: artifacts/github-install-1791480155823/result.jsonで公開6Applet ZIPの実一括交換/単一EXE0.23.0同版交換/WindowMover個別交換と再起動成功。旧版Appletは隔離manifest0.0.0 fixture、.NET DLL1つ有効/他5つ無効、実認証ではなく保存fixture。確認dialogだけ差替え。ZIP配布との比較は再帰ファイル一覧とbytesで行い、publishに残る空ディレクトリーは一致条件にしない。取得から交換までGitHub経路を確認済み、実利用deployとUNC/任意Webは別範囲。

- オールインワン発行（2026-10-09）: codex/all-in-one-package c84b4e9。publish.bat→dist:host→pack:all-in-oneで兄弟repoを再発行し、EXE+extensions+bundle.jsonのpublish/AppDock.at365-all-in-one-<version>.zipを生成。本体のみはdev.bat run dist:host。Windows PowerShellがpwsh由来のPSModulePathでGet-FileHashを解決できない環境では.NET FileStream/SHA256を用いる。File.ReplaceのbackupPath nullはPowerShell5.1でNullString.Valueを渡す。bundleは生成時commit/dirtyを記録、初期Applet無効、通常feedは単体EXEを指す。既存同版Releaseのassetは自動上書きしない。異常系fixtureと実ZIP全ファイル一致/6Applet通常起動を検証済み。

- オールインワンZIPはユーザー指定で既存AppDock v0.23.0 Releaseへ追加公開済み（2026-10-09）。275724048bytes/SHA256 92a17694df699133353dc43160b68dc76eded545b4766b8b9621f13ac45f345c、匿名実ダウンロード一致。元EXE/update.jsonはID/size/digest保持。結果AppDock/artifacts/all-in-one-release-result.json。発行実装ブランチcodex/all-in-one-packageのmain統合は別途未実施。

- AppDock v0.5.0: manifestのminimumHostVersionを遅延予約前・起動前に照合。startupDelaySecondsはホスト共通で、待機中はプロセスなし・無効化/終了で取消。Applet.WallpaperSlideshowは既定30秒、モニターごとにFolders配列で複数ソース、履歴はAppDockの画像パネル。実機の壁紙・ロック/RDPを試していないテスト結果とは区別する。

- AppDockのRelease運用の正本（2026-10-09）: A:\30.PROJECT\AppDock.at365\AGENTS.md → docs/RELEASING.md。次回はここを読み、scripts/release.ps1のPrepare/Draft/Publish/Verifyを使う。全ローカルApplet同梱、cleanなソース/成果物/証跡の照合、失敗時の下書き保持、公開結果不明時の確認手順をrepo側へ集約。共通TOOLSへ手順を重複コピーしない。
