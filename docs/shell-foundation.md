# AppDock Shell Hostの仕様と実装計画

状態: 2026-10-11の設計案。製品への実装は未着手。基準ソースはAppDock 0.26.39。

目的は、今後の描画を伴う機能を「状態と操作」「表示情報」「描画」に分けて追加できる基盤を作ること。最初の移行対象をリボンに限定し、本体repo内のDefault Shellで描画・操作・状態追随・復旧まで成立させる。移行したUIの実装は本体rendererから除去し、標準・復旧時とも同じDefault Shellを使う。将来の複数Shellに備えて表示インスタンスを識別するが、今回提供する本体ウィンドウと有効なShell表示は各1つとする。

Default Shellは本体に同梱して更新・復旧を保証する役割を持つ。配布方法を理由に専用の描画実装や非公開APIを作らず、移行したUIの描画はDefault Shellへ集約する。

本書は今後の実装範囲と受入条件を定める案であり、現在の公開APIを説明する文書ではない。既存の契約は[共通操作API](appdock-api.md)、[Appletページ](applet-pages.md)、[Applet API](extensions.md)を参照する。

## 用語と命名

仕様・実装計画・開発文書・設定画面の正式名称は以下に統一する。

| 正式名称 | 意味 |
| --- | --- |
| Default Shell | 本体と一緒にビルド・配布する標準の描画実装。通常時と復旧時に同じ実装を使う |
| Shell Applet | Default Shellを差し替えるために追加する拡張機能 |
| Shell Host | 本体側にあるShellの起動・表示領域・切替・復旧・共通APIを担当する仕組み |

ShellはDefault ShellとShell Appletをまとめた総称としてのみ使う。双方に同じ公開Shell APIと実行境界を適用し、Default ShellをShell Appletと呼ばない。Shell Hostはリボンなど移行対象のUI描画実装を持たない。未移行の既存画面は本体rendererに残るが、Shell Hostの描画機能として扱わない。

ソース配置案はDefault Shellがshells/default、Shell Hostが本体のsrc/main等、Shell Appletが通常の独立Applet repoとする。内部のクラス名、manifestフィールド、sourceKind:builtin等は実装上の識別子であり、正式名称の別名として画面に出さない。今回の名称統一で実行契約・保存形式・公開範囲は変更しない。

## 今回完成させる範囲

| 対象 | 今回の到達点 |
| --- | --- |
| 表示と操作の共通契約 | 型付き表示モデル、意味を持つ操作ID、状態の取得と購読、接続寿命を実装 |
| リボン | 既存の見た目・項目・配置・操作を維持してDefault Shellへ移す |
| 本体の画面遷移 | リボンと既存入口が同じ状態・操作処理を使う。選択表示をShellが独自判定しない |
| Shellの選択と復旧 | Default Shellと導入済みShell Appletを選べる。準備後の切替と故障時のDefault Shell復帰を実装 |
| 外部利用 | 同じ表示モデルと操作をMCP/通常Applet APIへ公開し、独立した小さな検証クライアントで実証 |
| 今後の開発 | 新しい表示モデル・操作を足す手順と小さなfixtureを用意 |

複数Shellの同時表示、複数本体ウィンドウ、横リボンや自由配置、設定画面全体の移植、汎用UI記述言語、全WebContentsの多重表示、内蔵作成チャットは今回の対象外。これらの完成を基盤導入の前提にしない。

## 現状と移行が必要な箇所

| 現在の実装 | 移行する責務 |
| --- | --- |
| [renderer/main.tsx](../src/renderer/main.tsx) | リボン構築、項目別クリック分岐、選択ページ、プロフィール・リボン設定への移動が同居している |
| [shared/applet-pages.ts](../src/shared/applet-pages.ts) | 項目列挙・並び順・有効Applet判定・保存配置の検証を再利用する |
| [RibbonCommands](../src/main/core/ribbon-commands.ts) | ribbon.getは設定編集用。アイコン・選択・統一操作を揃えた描画APIは別に追加する |
| [main/index.ts](../src/main/index.ts) | 本体コマンドの一部をrendererへ通知している。リボンに関係する遷移は共通状態管理へ接続する |
| [AppletSurface](../src/main/core/applet-pages.ts) | 画面と表示先の分離を再利用する。現在の単一host/selected/boundsをそのまま新Shell契約へ公開しない |
| [applet-page-preload.ts](../src/main/applet-page-preload.ts) | 自分の設定・コマンド用の限定入口。新Shellには別の専用ブリッジを用意する |
| [useSettingsEditor](../src/renderer/useSettingsEditor.ts) | 共有draftと保存の唯一の所有者として維持する。今回Shellへ移さない |

## 責務と依存方向

本体の機能サービスが状態と操作を管理し、表示サービスがそれを描画可能なモデルへ変換する。Shellと外部クライアントはモデルを描き、操作IDを返す。本体・MCP・Shellごとに機能の判断を複製しない。

下表のUiPresentationService、UiActionService、NavigationCoordinator、ShellManager、ShellSurfaceはShell Hostの構成要素とする。既存機能サービスを呼び、Default ShellとShell Appletへ同じ契約を提供する。

| 層 | 責務 |
| --- | --- |
| 既存機能サービス | SettingsStore/SettingsCommands、コマンド実行、Applet管理、ページ起動、テーマ、ログ |
| UiPresentationService | 登録情報と状態から表示モデルを生成し、変更番号と変更通知を管理 |
| UiActionService | 操作IDを現在の登録内容へ解決し、呼出元・利用可否を検証して既存処理を実行 |
| NavigationCoordinator | 本体内の論理的なページ選択と設定カテゴリへの移動要求を管理 |
| ShellManager | providerの選択、表示インスタンス、準備完了、切替、終了、故障復旧 |
| ShellSurface | Electron View、割当領域、フォーカス、重なり、専用ブリッジを管理 |
| Default Shell / Shell Applet | TypeScript/Reactによる描画、キーボード移動、ホバー等の一時状態。初版のDefault Shellはリボンを担当 |
| MCP/通常Appletアダプター | 同じ表示・操作サービスを各接続の公開範囲と許可で呼ぶ |

クラス名と新規ファイル名は実装時の候補。責務と契約を優先し、小さな処理まで機械的に別クラスへ分割しない。本体に各Applet固有の名前や振る舞いを追加せず、提供元のページ・コマンド宣言を使う。

本体はShellのReactコンポーネント・描画関数・内部状態をimport/直接呼出ししない。Shellも本体のsrc/mainやsrc/rendererをimportしない。双方が依存できるのは公開SDK/契約だけとする。本体の汎用ローダーがmanifestと成果物を発見し、worker/Viewを起動する参照は必要であり許可する。参照禁止の対象はUI実装への依存であって、Appletを読み込むためのファイル参照ではない。

## 表示モデルと更新

描画用のUiRibbonSnapshot v1を定義する。保存用ribbon.getとappdock.ribbon.updateは現在の契約を維持する。

| フィールド | 意味 |
| --- | --- |
| schemaVersion | 表示契約のメジャー版。初版は1 |
| hostEpoch | 本体起動ごとの識別子。再起動前の状態・要求と区別する |
| contextId | 論理的な表示状態の識別子。初版はprimaryのみ |
| revision | この呼出元向けモデルの更新番号。設定保存revisionとは独立 |
| appearance | 現在のテーマ、表示名などリボンに必要な最小情報 |
| items | 順番を確定した表示対象項目。非表示・無効Appletを除く |
| actions | このモデルの操作一覧。enabledと利用不可理由を含む |

項目には安定したid、kind（button/separator）、label、tooltip、icon、placement（start/end）、selected、actionIdを持たせる。start/endは既存top/bottomを変換した配置意図であり、保存形式は変えない。将来の未読数等は必要な機能を実装する時に任意フィールドとして追加する。

初版では現在の標準6項目、導入Appletのページ、セパレーター、プロフィールのアバターと代替文字、テーマ別アイコン、右クリックからのリボン設定移動を維持する。無効なAppletは表示対象から外すが、開始待ち・エラーの有効Appletは残し、既存の起動待ち/エラー表示/再試行導線を保つ。保存配置の非表示項目や未導入IDは編集API側に保持する。

HTML、React要素、関数、任意JavaScript、OSパス、全settings、認証情報をモデルへ含めない。Shellが受け取る情報から本体の機能判定を再実装する必要がない形にする。

更新は次の方式とする。

1. Shellの接続時に購読を先に登録し、その購読の基準revisionを持つ初回snapshotを返す。
2. 以後は同じ型の完全なsnapshotを配信する。初版はJSON Patchや差分履歴を導入しない。
3. Shellは同一epoch/contextの古いrevisionを無視する。欠落は次の完全snapshotまたは明示再取得で解消する。
4. 切断後は再接続し、snapshotを取得し直す。購読の解除と終了後の配信停止を必須にする。
5. テーマ・配置・Applet状態・選択・許可・画像変更で、影響するモデルを更新する。変化のないモデルは通知しない。遅い読者向けには最新状態へまとめ、未処理通知を無制限に積まない。

状態通知と操作完了の応答を区別する。表示revisionが変わっても設定revisionは進めない。初期描画のためにAppletの起動処理がShellの準備完了を待つ循環を作らない。

## 操作と画面遷移

ShellはactionIdを指定して操作を要求し、本体がその時点の登録情報へ解決する。actionIdは項目IDからShell側で組み立てない。初版の引数は登録済み操作が持ち、クライアントから任意コマンドや任意設定値を差し込めない。

標準項目のホーム/Applet一覧/設定/ログ/プロフィール移動、テーマ切替、リボン設定移動、Appletページ起動を共通操作へ接続する。必要な本体操作IDは提供元定義へ明示追加する。テーマ保存はSettingsCommands等の共通保存経路を使い、古いsnapshotから全設定を上書きしない。

既存ボタン・ショートカット・トレイ・通常コマンド・MCPから同じ操作を呼べるようにする。操作本体が再び自分の公開入口を呼ぶ循環を避け、既存の実行予約・再入防止・取消・ログへ接続する。ShellのクリックごとにNode worker上の自身のコマンドを経由させない。

NavigationCoordinatorはprimary contextの選択ページと、プロフィール等の移動先を管理する。既存rendererをその状態の表示アダプターへ変更し、関係するsetPage/onHostCommand/onAppletPageとページ復元処理を接続する。状態通知の受信をページ起動コマンドの再実行に変換しない。ログ等の同じページへの再移動も扱えるよう、移動要求には識別子を持たせる。

現在のページ起動・待機・失敗・ホーム復帰の振る舞いを共通処理に保つ。別ウィンドウ表示に設定したAppletを開いても、本体に存在しない埋込みページを選択済みとしない。選択状態はクリック直後の推測ではなく、本体が確定した状態から描く。進行中は操作側のpending表示で区別する。

要求にはrequestIdを持たせ、同じ接続・同じID・同じ内容の重複受付を一定数/期間で抑止する。異なる内容のID再利用は拒否する。再接続・本体再起動をまたぐexactly-onceは保証せず、タイムアウト時の変更操作を自動再送しない。古いepochの要求は拒否し、実行直前にも対象の存在・利用可否・許可を調べる。

結果は既存のaccepted/handlerReturned/settingsSaved等の意味を維持する。ナビゲーション状態の反映と、描画完了・外部アプリへの効果確認を同じ成功として扱わない。

## 呼出元と公開範囲

共通の表示/操作サービスに、ホストが生成した呼出元文脈を渡す。専用ブリッジのshell、通常のapplet、mcpを区別し、リクエスト本文から権限・Applet ID・Shell IDを名乗らせない。

| 呼出元 | 読取りと操作 |
| --- | --- |
| 選択中のShell | 現在の本体リボンと同じ操作範囲。Default ShellとShell Appletの両方に同じ公開Shell契約を適用 |
| 通常Applet | 既存appdock-api capabilityと全Applet共通許可を使用 |
| MCP | 既存の接続認証・公開範囲・操作許可を使用 |

Shell用契約は一般Appletの許可を全開放する仕組みではない。一般Appletの許可をOFFにしても、本体の設定画面と復旧入口を操作できる。Shell宣言だけでは権限を与えず、ShellManagerが選択・準備したViewの接続へ限定する。既存applet-page/preloadやリモートWebページには追加しない。

Shell契約は通常の追加型Appletもshell capabilityを宣言し、使用Shellとして選択されれば使える公開Applet APIの一部とする。Default Shell専用メソッド、IDによる許可迂回、直結のwindow.dockを作らない。同じ宣言・選択状態なら同じ操作とエラーを返し、配布元によって権限を変えない。現状の通常Applet APIだけでは購読・ready等が足りないため、今回この契約を共通SDKへ追加する。

新しい描画用の取得/画像取得/操作APIは共通操作カタログへ登録する。共通サービスを再利用しつつ、Shell専用の接続/ready/配置/復旧操作を自動でMCPへ列挙しない。現AppDockApi.callの「Applet ID省略ならMCP」という前提をShellの識別に流用せず、型付きの呼出元境界を追加する。

MCPと通常Appletのモデルは同じschemaを使うが、実行可能なactionsを呼出元に応じて変える。非公開のAppletコマンドに対応する項目は表示できても操作不可とし、理由を返す。表示されていることを公開許可と解釈せず、actionId経由でも既存公開コマンドと同じ許可を要求する。

ホーム/プロフィール/リボン設定等の不足する本体操作は明示的な公開定義を追加する。テーマ切替には設定変更の許可を要求する。ナビゲーションだけの操作には実行許可を要求し、設定変更許可を不要とする。ここでの公開定義・Schema・分類を試験で固定する。

## APIと画像の持ち運び

名称は以下を実装案とする。新規操作は既存の名前・結果を変更せず追加する。

| API案 | 契約 |
| --- | --- |
| ui.ribbon.get | contextId省略時primary。schemaVersion/epoch/revision付き完全snapshotを返す |
| ui.assets.get | モデル内のassetIdに対応する画像を取得。pathやURLを引数にしない |
| ui.actions.invoke | hostEpoch/contextId/actionId/requestIdで現在の操作を要求 |
| Shell専用connect | ホスト発行sessionId/contextId、対応版、初回snapshotと購読を取得 |
| Shell専用ready | 初回snapshotを描画した後に通知。現在準備中のsessionにだけ有効 |
| Shell専用dispose | 購読解除。View側の切断時にもホストが必ず回収 |

初版のcontextIdはprimaryのみを受け付け、未知contextはエラーとする。Shellの接続先contextはホストが割り当て、任意Window IDを受け付けない。外部は論理contextを指定できても、埋込みViewやWindowを管理できない。

MCPは初版から取得・操作を実装する。状態追随はクライアントの定期再取得を使用し、MCP固有のpush通知・サブスクリプション履歴は今回実装しない。通常Appletも同じ取得APIを使い、新Shell専用の購読を既存Node/.NET SDKへ一律追加しない。

アイコンは安定したicon名かassetIdで表す。標準iconの描画一覧は契約に含め、未知iconは汎用代替表示にする。画像はホストが登録した画像だけを解決し、MIME/サイズ上限を検証したPNG/WebP等として返す。初版の応答上限は1画像1MiBを目安に実装時固定し、大きな原画像は表示用に縮小する。MCPでも取得できるbase64とcontentHashを提供し、同じ画像をsnapshotごとに送らない。アバターを含む公開フィールドを仕様に明記し、秘密値・原本パスを含めない。

schemaVersionの非対応は接続時に検出し、対応済みのDefault Shellへ復帰する。同じメジャー内は任意フィールド追加を基本とし、未知項目は無視/代替表示で復旧可能にする。初版Shellが受け付けるメジャーは1だけとし、ホスト版との整合はminimumHostVersionでも検査する。Default Shellもこの検査を省略しない。

## Default ShellとShell Appletの表示インスタンス

Default Shellは本体repo内のshells/defaultへ配置し、通常Appletと同じ実行経路で動く同梱モジュールとして実装する。既存runtime:nodeを使い、最小の起動/終了処理とビルド済みReact UIを持つ。新しいruntime種別は追加しない。通常Appletと同じmanifest検証・worker/RPC・Shell用View・API・ログ・終了処理を使う。

Default ShellとShell Appletの違いは出荷元とライフサイクル方針に限定する。Shell Hostの信頼できる同梱探索元からsourceKind:builtinを設定し、manifestの自己申告で本体同梱として扱われないようにする。配布したDefault ShellのIDを追加型Appletで上書きしない。重複は探索順任せにせず拒否・記録し、複製して改造するShellには別IDを使う。

Default Shellは初期選択され、手動導入や有効化が不要な復旧依存として管理する。一覧にもDefault Shellの名称で状態・ログを表示する。Shell Appletを使用中はDefault Shellのworker/Viewを停止できるが、復旧用パッケージは削除/恒久無効化できない。管理API/UI/更新候補はこの方針を明示し、通常Appletの無効化済み設定を無断で変更する処理とは区別する。起動時はAPI準備後に必要なShellを起動し、復旧用のDefault Shellには通常Appletの任意開始遅延を適用しない。

manifestへcapabilitiesのshellと、shell宣言（apiVersion:1、ui:ローカルHTML、regions:[ribbon]）を追加する。entryはNode worker用、shell.uiは描画用として区別する。独立ページを持たないShellはpages/openCommandを要求せず、自身を通常リボンへ自動追加しない。

manifestの重複ID・ローカルパス・最低本体版等は既存の検査を使う。初版はribbon以外の領域を宣言したら非対応として扱う。将来の領域名だけを先に機能として公開しない。

Shellの種別であるproviderAppletId、保存する割当のbindingId、起動ごとのsessionId、共有表示状態のcontextId、実際のWindow/Viewを区別する。providerAppletIdをWindowや選択ページの識別子として使わない。

保存する割当はhost.shell.bindings内のid:primaryとproviderAppletIdを実装案とする。Default Shellも通常のprovider IDを持ち、null専用の本体描画経路は作らない。初版は割当1件だけを許可し、未指定の旧設定はDefault Shellを既定値として解決する。実装されていない複数割当を黙って切り捨てない。sessionIdやWindowハンドルは保存しない。

選択UIは既存「設定 → 表示」に置き、現在の共有draft/revision/全体保存に参加させる。保存後に切替を始め、保存時に無効なproviderを暗黙に有効化しない。有効化・開始待ち・非対応・見つからない状態と、希望するprovider/実際に表示しているproviderを区別して表示する。

同期先で選択したShell Appletが未導入でも割当IDを保持し、そのPCではDefault Shellへ戻る。Shell Appletの開始遅延を維持し、待機中はDefault Shellを表示する。Shellの接続は共通APIの準備完了後に行い、activate中の必須API呼出しへ依存させない。

## ビルドと配布

本体の通常build/publishへDefault Shellのビルドを組み込み、manifest・Node entry・HTML/JS/CSSを独立した成果物として同梱する。ホスト側bundleへReact部品として取り込まない。開発時の出力と配布時のresources内の同梱Shell探索元をローダーへ渡し、ポータブルEXE内に収録する。追加型extensionsフォルダーへコピーして二重に登録しない。

Default Shellの版は本体版に連動し、本体更新で一緒に交換/切戻しする。個別Applet更新や独立publish/update.zip/Releaseの対象には含めない。manifestの最低本体版とShell API版を本体と同じビルドで検証する。Shellのビルドに失敗したら本体の発行も失敗させ、古いUI成果物を混ぜて出荷しない。

ビルド・実行の双方で依存境界を検査する。別tsconfig/ビルド入口で公開SDK以外の内部importを拒否し、本体からshells/defaultの描画実装へのimportも拒否する。検証用のShell Appletを同じSDKで動かし、Default Shellだけが動く専用経路がないことを確認する。リポジトリの場所・共通toolchain・同時ビルドは共有してよいが、実行時は通常のApplet境界を通す。

## 画面の載せ方と既存UIの保持

本体の既存rendererは未移行の画面のために存続させ、リボン領域だけをShellの専用WebContentsViewへ置き換える。リボンのJSX/CSS/項目描画/アクセシビリティ実装をDefault Shellへ移し、本体rendererから削除する。本文、設定サイドバー、タイトルバー、ステータスバーは既存のまま。リボンの幅と上下端は初版では現在の配置を維持する。以後の移行でも、完了したUIを本体へ復旧用として残さない。

ShellのViewはリボン全体で1つとし、ボタンごとにView/workerを作らない。本体内の状態追随は変更通知を使い、定期ポーリングやフレームごとのIPCを追加しない。Default Shellの追加メモリ・待機CPU・起動からreadyまでの時間を移行前の固定版と比較し、最終検証記録へ残す。

本体がリボン用の予約領域を持ち、既存rendererの同領域とDIP座標を照合してShell Viewを配置する。Shellは任意Windowへ自分を貼り付けたり、本文の領域を覆ったりできない。provider間の切替で本文の予約領域は変えず、二重表示とレイアウト移動を避ける。予約領域の確保は本体の責務だが、その領域に本体自身が代替リボンを描く処理は持たせない。

NativeのView管理はShellSurfaceへ分離する。現在のAppletSurfaceを継承してページ表示先の切替規則をそのままShellへ持ち込まない。共用する必要のある低水準処理だけ抽出し、既存AppletSurfaceはprimaryへのアダプターで接続する。既存の単一host/selected/boundsの全面的な複数Window化は後続作業とする。

リボンを再読み込みしても既存本文のrenderer、AppletSurface、Gmail/WebApplet session、共有draftを再生成しない。親DOMのz-indexだけで別WebContentsViewを覆えるとは仮定せず、コマンドパレット・未保存通知・dialogの表示中は本体がリボンViewの表示/入力と最前面順を調整する。

Shellへフォーカスが移った場合も、既存ShortcutDispatcherと実Window/表示Appletに基づく条件判定を使う。ShellのNode workerへ独自のグローバルキーや入力フックを追加しない。Tab/Shift+Tabで本体とShellの境界を移動でき、復旧や切替で別のアプリからフォーカスを奪わないことを確認する。

専用preloadは対応するローカルView/main frame/URL/現在のsessionを検証する。Node・任意IPC・既存window.dock全体をShellのページへ公開しない。この境界は信頼済み自作Appletを前提とする既存方針を保ち、誤接続・古い接続・リモートページへのAPI流出を防ぐために用いる。

## 起動と復旧

1. 本体の機能サービス・共通API・Appletローダーを先に利用可能にする。起動完了をShellのreadyに依存させない。
2. 希望providerが利用可能ならそのShellを、未指定/未導入/待機/故障の場合はDefault Shellを通常のApplet経路で起動し、非表示のShell Viewを準備する。通常は必要なproviderだけを起動する。
3. モデルの接続・初回描画・readyを確認し、現在の切替要求に一致する場合だけ表示を切り替える。
4. 旧表示の購読/Viewを破棄する。旧sessionからのreadyや操作は受け付けない。
5. Shell Appletの読込み失敗、ready期限超過、プロセス終了、継続的な応答不能、無効化、削除、再起動時はDefault Shellを起動して切り替える。ログと既存通知で理由を示す。

準備期限は初版10秒を基準にし、単一EXEの初回起動で測定して調整する。中断/終了時は期限待ちを取消す。応答不能の検出はrendererの応答監視とElectronイベントを使い、正常な非表示/最小化を故障と誤判定しない。

故障時に希望provider設定を勝手に消さず、同じ失敗版を無限に再起動しない。手動再試行または版更新後の再試行を入口にする。失敗状態はPC専用領域へ記録し、次回起動でもDefault Shellから再試行できる。復旧起動オプション（候補: --safe-shell）は保存設定を維持したまま、Shell Appletを選ばず出荷済みDefault Shellを既定の表示設定で起動する意味とする。全設定の初期化・本体内蔵リボンへの切替ではない。

本体単一EXEにDefault Shellの成果物を収録し、Shell Applet未導入でも従来機能を利用可能にする。標準と復旧で同じ成果物・描画実装を使い、別の復旧Shellを複製しない。Shell Appletの起動失敗が本体の起動失敗にならないことを受入条件にする。

Default Shell自体が動かない場合は、本体が独立した最小のネイティブエラー通知から再試行・ログ確認・終了を提供する案とする。これにはリボン/設定ページの再実装を含めない。safe起動と通常の本体更新/旧版への復元手段を用意し、Default Shellのコード不良や配布物欠損を同じShellの再起動だけで修復できるとはしない。本体の機能サービスまで停止した場合もShellだけの切替では復旧できない。

## 将来の複数Shellに残す境界

共有設定・Applet・コマンドの実行サービスは本体に1つ置き、Shell sessionを増やしてもworkerや処理を重複起動しない。状態サービスは複数の読者を許容し、1接続の終了で他の読者を解除しない。

将来は1つのcontextへ複数session/Windowを接続すれば選択ページを連動させられる。Windowの位置・サイズ・実フォーカス・ホバーはsession/Window側に保持する。今回のprimaryだけという制限は管理UIと起動ポリシーに置き、全サービスに単一Shellのグローバル変数を広げない。

実際の複数Windowへの画面配置、閉じると終了の分離、全Shell停止時の動作、Gmail/WebApplet本文の複数View化は後続で設計する。同一WebContentsの二重表示を契約に含めない。詳細は[Electron WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view)の所有制約に従う。

## 今後の機能を追加する手順

1. 機能を持つ本体サービスまたはAppletと、状態の保存先を決める。
2. 操作ID、入力検証、公開先、許可、完了の意味を定義する。
3. 描画に必要なモデルと更新条件を定義し、機能の判断をrendererへ持ち込まない。
4. Shellまたは機能Appletのページでモデルを描画し、操作を共通サービスへ返す。
5. モデル・操作の試験と、代表画面での実表示・実操作を確認する。

Shellだけで使う純粋な表示設定やホバーを本体へ無理に集めない。設定画面を移す際は共有編集セッションをShellの寿命から切り離すが、今回useSettingsEditorの全面移植は行わない。今後の新規機能にも同じ編集状態を複製しない原則を適用する。

Default ShellとShell Appletは本体rendererの内部ファイルを直接importしない。型と小さなクライアントブリッジを共通SDKとして提供し、React自体はAppletのUIビルドへ同梱する。新規グローバルツールや外部依存を増やすことを前提にせず、既存ローカルtoolchainと[依存ポリシー](../DEVELOPMENT.md#依存とツールの公開後待機)を使う。

## 実装の順序と完了条件

| 段階 | 変更対象と成果物 | 次へ進む条件 |
| --- | --- | --- |
| 1 契約と表示サービス | sharedにUI契約、coreにprojection/action/navigation。既存ribbon/commands/settingsの処理を再利用 | 表示・設定revision分離、公開範囲、登録解除、遷移がモデル/操作試験で確認できる |
| 2 移行準備 | 既存クリック/画面遷移を共通操作へ接続し、リボンを移動可能な表示部分へ整理 | 従来のページ復元、キー、未保存編集が同等に動作。ここは中間状態であり最終構成に本体リボンを残さない |
| 3 共通Applet経路 | 同梱Shell探索元/manifest/公開Shell SDK/専用preload/ShellManager/ShellSurface/選択/復旧 | Default Shell/Shell Appletのfixtureを同じ経路で起動し、ready切替・取消・故障・safe起動が成立 |
| 4 Default Shellへの移植 | shells/defaultへ唯一のリボン実装を移動、本体から削除。build/publishへの同梱と依存境界検査を追加 | 内部import/非公開APIなしで既存リボンが動き、Shell Appletなしの固定単一EXEでも起動・操作・復旧できる |
| 5 外部経路 | 共通カタログの3 API、MCP/通常Applet経路、独立表示fixture | 実MCPで表示/画像/操作/再取得が通り、非公開操作と権限取消を回避できない |
| 6 配布と記録 | 本体とDefault Shellの版整合、単一EXEへの収録、本体publish、仕様/試験記録更新 | 下記受入条件を固定配布物で満たし、生成物/終了/整理を確認 |

段階1〜6を今回の基盤実装の範囲とする。2で終えて「分離できた」とは扱わず、Default Shell・Shell Applet fixture・外部クライアントが公開契約を使えるところまで実証する。段階3のView/フォーカス試験をDefault Shell移植前に行い、画面合成の問題を早期に解消する。

新規ファイルの候補はsrc/shared/ui-presentation.ts、src/main/core/ui-presentation.ts、ui-actions.ts、navigation.ts、shell-manager.ts、shell-surface.ts、src/main/shell-preload.ts、およびSDKのShellクライアント型。既存appdock-api、contracts、extensions、main/index、renderer/main、settingsは責務に沿った接続変更に留める。

バージョン番号は実装開始時の最新状態に合わせて決定する。本体とDefault Shellの版を揃え、本体publishでShellを含む単一EXEを発行する。Default Shellの独立repo/publish/update.zipは作らない。未変更の追加型Appletの再発行・オールインワンZIP作成・commit/push/Release/deployは実装完了条件に含めない。実行段階は[共通手順](development-workflow.md)に従う。

## 受入条件と検証

| 分類 | 確認する振る舞い |
| --- | --- |
| リボン | 標準6項目、Applet、上下順、非表示、区切り、アバター、テーマ、右クリック、有効待機/エラー/無効化/再開 |
| 状態追随 | 設定外部更新、Applet追加/削除、他入口からのページ遷移、同一ページへの再要求、再接続/epoch更新、古い応答の無視 |
| 操作 | 重複要求、古い操作ID、実行直前の無効化、再入/取消、テーマの部分更新、受付と効果の区別 |
| 権限 | Shell/通常Applet/MCPの分離、未公開コマンド、writeなしテーマ変更、実行中の許可取消、偽の呼出元/古いsession/remoteページ拒否 |
| 既存画面 | 本体ページ/別Window、Gmail/WebAppletのViewとsession同一性、共有draft/選択タブ/未保存通知、再起動復元 |
| 入力と合成 | Tab境界、フォーカス復帰、条件付きキー、パレット/dialog/通知、両テーマ、狭幅、DPI変更、最小化/復帰 |
| 復旧 | Shell AppletのHTML欠落/非対応版/ready未到着/renderer・worker終了/応答不能、切替中の別選択、無効化/削除、未導入同期先、safe起動、Default Shell自体の失敗時の最小通知 |
| 外部 | 本体rendererをimportしないfixtureが実MCPから描画・画像取得・クリック・状態追随。切断時の操作自動再送なし |
| 寿命 | 2読者への同じ状態配信、片方の解除後も他方は継続、Shell再起動で機能の二重起動なし、購読/View回収 |
| 負荷 | 起動と切替の時間、移行前固定版との追加メモリ/待機CPU比較、再起動を繰り返してもView/購読が増え続けない |
| 依存と同梱 | 本体のリボン描画撤去、双方の内部import拒否、Default ShellとShell AppletのAPI同等性、単一EXE内のmanifest/asset整合、重複ID拒否、個別更新対象からの除外 |

複数読者の試験はサービスと外部クライアントで行い、製品の複数Shellウィンドウ対応を完了扱いにしない。

検証用Shell Appletや外部クライアントのfixtureソースはtests/fixtures、生成物はrepo直下の.artifactsへ隔離し、製品のAppletや配布物へ同梱しない。本番Shellの有効化とfixtureの導入を混ぜない。

既存のribbon-commands、appdock-api、automation、ページ/ナビゲーション、リボン配置、hotkeys、settings-notice、WebApplet/Gmail GUIを変更範囲に応じて選ぶ。新規試験はモデル/操作/接続寿命と故障復旧を中心とし、実装の形だけを固定する試験は作らない。GUIは隔離profileで直列実行する。

最終的にはDefault Shellを収録した本体の固定単一EXEを使用し、Shell Applet未導入の起動と、Shell Applet fixtureとの切替/Default Shellへの復旧を確認する。実ウィンドウの合成・入力を確認し、親画面のスクリーンショットだけで別Viewの表示成功としない。機能回帰・実認証・物理入力の確認範囲は区別してVERIFICATIONへ記録する。

## 実装開始時に再確認する事項

本文は2026-10-11のソースに基づく。着手時にAGENTS、作業ツリー、現在版、共通APIの公開定義を再確認する。Default Shellのビルドは本体ローカルtoolchainで分離した入口を用意する。Shellのready期限、画像上限、通知のまとめ方は実測で最終値を固定するが、操作・状態・寿命の分離とUI実装の単一所有は変更しない。

仕様更新時は本書を入口に、appdock-api/applet-pages/extensions/applet-development/host-developmentへ実装済み契約を反映する。現行仕様へ未実装APIを混ぜず、段階完了時に本書の状態表示と未実装範囲を更新する。
