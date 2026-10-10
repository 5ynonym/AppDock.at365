# 共通操作APIとCodex連携

0.26.26から、本体に共通操作APIとローカルMCPを持ちます。利用者の手順は[README](../README.md#codex連携)、設定保存は[設定同期](settings-sync.md)を参照してください。App Serverによる会話UIとCLIは未実装です。

## 構成

- `src/main/core/automation-api.ts`: 通信に依存しない操作、公開カタログ、実行権限、引数、受付状態。
- `settings-commands.ts`: 設定宣言から読取りschema/更新コマンドを構築し、型検証・revision・保存を共通化。
- `src/shared/settings-commands.ts`: 本体の公開設定定義とboolean派生コマンドの生成。
- `automation-mcp.ts`: 公式MCP TypeScript SDKによるstateless Streamable HTTP。JSON応答、GET/DELETEは405。1要求64KiB、同時8要求、要求受信10秒・socket無通信60秒。API呼出しの監査ログを既存HostLogへ渡します。
- `automation-commands.ts`: 提供元の公開宣言を共通の条件で照合し、Applet情報を限定投影。
- `automation.ts`: PC専用設定、暗号化、起動/停止、登録状態、接続テスト。
- `codex-registration.ts`: smol-tomlで構文・意味を検証した限定範囲の編集。既存ファイル全体を再シリアライズしません。
- `CodexSettings.tsx`: 設定内の専用ページ。PC専用操作を即時反映し、既存の共有draft/全体保存バーは保持します。

`dock:automation` IPCは本体Window/mainFrame/URL検査を通し、WebAppletやAppletページへ公開しません。本体のprepareSettings/commitSettingsを共有して保存します。APIからWindows起動登録・UACを呼びません。

## API v2（0.26.30以降）

| 内部メソッド | MCPツール | 引数と結果 |
| --- | --- | --- |
| system.getInfo | appdock_get_info | 引数なし。apiVersion/version/instanceId/methods/writable/executable |
| applets.list | appdock_list_applets | 引数なし。applets配列（id/name/version/state/enabled） |
| settings.getSchema | appdock_get_settings_schema | 任意appletId。fields/scope/appletId/writable。省略時は本体 |
| settings.get | appdock_get_settings | 任意appletId。values/revision/warning。省略時は本体 |
| applets.get | appdock_get_applet | id。applet（基本情報/description/runtime/errorSummary）と公開commands/executable/writable |
| commands.list | appdock_list_commands | 引数なし。commands/executable |
| commands.execute | appdock_execute_command | id/任意args。id/completion/effectVerified=falseと操作結果 |

旧settings.patch/appdock_patch_settingsは削除しました。設定変更はすべてcommands.executeに集約します。本体はappdock.settings.update、各Appletは`<appletId>.settings.update`です。changes/valuesは公開項目の平坦なオブジェクトで、hostやsettingsで囲みません。本体の対象は次の4項目です。

| キー | 値 | 適用タイミング |
| --- | --- | --- |
| theme | dark/light/system | immediate |
| notifications | boolean | immediate |
| closeToTray | boolean | nextClose |
| startMinimized | boolean | nextStart |

`{"id":"appdock.settings.update","args":{"changes":{"theme":"light"},"expectedRevision":"<取得したrevision>","dryRun":true}}`で検証します。dryRunでもコマンド実行・書込の両許可とrevision照合が必要です。未知項目・余分な引数・型不一致・空changesを拒否し、指定外を保持して一括保存します。同じ値だけなら書きません。

revisionは実行ごとのUUIDとSettingsStoreの変更番号からなる不透明な文字列です。本体再起動前の値は使えません。本体の設定コマンドサービスをローカル操作とMCPで共有するため、MCPの停止・再開だけではrevisionの実行IDは変わりません。保存直前にディスクも確認し、未通知の外部更新・破損を上書きしません。GUIのdirty draftを保持し、API更新後に古いGUI版を保存すると既存の競合検査で拒否します。GUI入力を自動保存/破棄しません。ファイル同期の未到着な変更までmergeする保証はありません。

エラーコードはINVALID_ARGUMENT、NOT_FOUND、NOT_READY、WRITE_DISABLED、REVISION_CONFLICT、SAVE_FAILEDです。MCPはisErrorとtext/structuredContentにコードと説明を返し、秘密値や全設定を返しません。保存完了と全Appletの非同期reconcile完了は区別します。

未公開コマンド/設定、Appletプロセスの起動停止、アカウント/認証、キー/ジェスチャー編集、更新適用、任意画面操作は公開しません。将来の入口も共通APIの検証と保存を使います。

## 公開コマンド

設定変更とは独立したallowExecuteをPC専用設定に保存し、初期値/未保存時はfalse。MCPの一覧には許可前も公開コマンドを載せ、executableで実行権限を示します。commandsの各項目はid/title/appletId（本体はnull）/available/unavailableReason/completion/inputSchemaです。設定変更にはpermission=settings.writeが付き、一覧のwritableとexecutableで必要な両許可を確認します。接尾辞・表示名・aliasから許可を推測しません。

- 本体: appdock.open、appdock.settings.open、appdock.commands.searchと公開設定コマンド。
- ファイル型Applet: 各manifestでautomation: trueを宣言した正規コマンド。
- 本体管理のWebApplet: 提供元のweb-applets.tsがopenだけを宣言。

Appletは有効かつrunningかつ現在のcommand.availableがtrueの場合だけ実行します。既存のactivateOnExecuteで停止中Appletを有効化する経路には入りません。実行直前に一覧を再構築し、通常コマンドは既存executeCommandへ、設定コマンドは共通SettingsCommandsへ渡します。通常のApplet RPCコマンドは引き続き引数なしで、argsに値を渡すと拒否します。APIコマンドの同時実行は1件、重複時はBUSY。設定変更許可だけでは実行できず、実行許可だけでは設定変更できません。許可の取消は次の要求から反映し、既に始めた操作の取消は保証しません。

本体の表示要求はcompletion=accepted、Appletの処理応答はhandlerReturned。設定保存はsettingsSaved、dryRunはvalidatedです。いずれも操作先の効果を別途検証していないのでeffectVerified=falseです。settingsSavedは永続化を表し、非同期settings.changedの反映完了は表しません。生のコマンド戻り値/例外は返しません。EXECUTION_DISABLED/UNAVAILABLE/BUSY/COMMAND_FAILEDを追加。応答消失や失敗時は処理済みの可能性があるため、自動再試行せず効果を確認します。MCPの実行ツールはreadOnlyHint=false/idempotentHint=false/destructiveHint=trueです。設定値によって履歴の縮小などを伴うため、実行入口全体を非破壊とは宣言しません。

Applet詳細には全設定・認証・パス・panelを含めません。WebAppletのURLと生の起動エラーも出さず、説明/エラー概要へ置き換えます。

## Appletによる公開宣言

0.26.29以降、外部公開はAppletのextension.jsonのcommandsにbooleanのautomationで指定します。省略/falseは非公開です。本体はApplet名やIDごとの一覧を持ちません。

```json
{
  "id": "example.tool.run",
  "title": "処理を実行",
  "automation": true
}
```

この機能を使うAppletはminimumHostVersionを0.26.29以上にします。自身の名前空間の正規IDだけを宣言し、公開IDは200文字以内の英数字・ピリオド・ハイフン・アンダースコア（先頭英数字）に限定します。不正な型/IDはmanifest読込時に拒否します。aliasesへ公開権限を継承しません。MCP固有のフラグではなく、共通操作APIからの公開宣言です。

runtime登録やhost.commands.replaceのautomation値は採用せず、manifestの正規IDと現在の登録コマンドを照合します。表示名は現在の登録値を使用します。未登録・動的に削除されたコマンドは利用不可、同じ宣言済みIDが再登録されたら再び利用可能です。宣言追加/削除はAppletファイルを更新してAppDockを再起動すると反映されます。新しいAppletの公開対象追加に本体の変更は不要です。

本体は宣言の検証・実行許可・稼働状態・同時実行制御・監査ログを管理します。公開宣言は実行許可を有効にするものではありません。現在はPC単位のコマンド実行許可を全Appletで共有し、Applet/コマンド個別の許可スイッチはありません。

0.26.28以前の固定一覧による互換公開は行いません。Gmail 0.9.4はopenと公開設定、WallpaperSlideshow 0.4.5はnextと公開設定を宣言します。Codexの登録方法は同じですがMCPは7ツールになりました。更新後はCodexを再読み込みしてください。

## 設定宣言と自動生成コマンド

この宣言にはminimumHostVersion=0.26.30以上、settings capabilityが必要です。各Applet自身のextension.jsonのsettingsへ、必要な項目だけautomation=trueを付けます。型は最上位のboolean/number/string/静的selectに限定し、既存の型・最小最大・選択肢検証を共有します。入れ子、JSON、動的select、アカウント情報を一括公開する機能はありません。

```json
{
  "key": "monitoring",
  "title": "監視",
  "type": "boolean",
  "default": true,
  "automation": true,
  "generateCommands": ["on", "off", "toggle"]
}
```

公開項目がある提供元には、複数項目を一括指定できるsettings.updateを1件生成します。各コマンドのinputSchemaはcommands.list/get_appletから取得できます。settings.get/getSchemaへappletIdを渡すと、そのAppletの公開項目だけを取得します。設定全体で同じrevisionを使い、別の提供元への更新でも以前のrevisionは無効になります。

booleanのgenerateCommandsは任意で、on/off/toggleから必要なものだけを指定します。型がbooleanのdefaultを必須とし、実行時の保存値が未設定ならdefaultを使用します。IDは`<owner>.settings.<key>.on|off|toggle`、表示名は設定titleから生成します。ONはtrue、OFFはfalseです。「停止」設定のONは停止を意味します。toggleはディスク検査後の最新値を反転して同じ同期処理内で保存し、競合時に再試行しません。

生成した引数なしコマンドは、通常の検索・ショートカット・ジェスチャー・トレイ候補へ自動追加します。実キーやトレイ項目は自動割当しません。AppletのdefaultKeybindings/defaultGestureBindings/settingActionsからも生成IDを参照できます。停止中も候補に残しますが実行は有効かつrunningに限ります。automationを省略した生成コマンドはローカル専用です。MCP公開時には両許可が必要です。

生成IDとsettings.updateは宣言・alias・runtime登録/置換との重複を拒否します。提供元IDのappdockは本体専用です。生成IDは180文字以内。引数付きsettings.updateを引数なしショートカットの候補へは追加しません。

初期対応: Gmailは監視/通知/ツールバー/未読のみと履歴件数、壁紙は停止と更新間隔を公開します。Gmailの外部リンク確認省略・通知内容表示、認証や画像フォルダーは非公開です。壁紙の旧start/stop/toggle/resume/pauseは廃止し、paused.off/on/toggleへ置換しました。既存割当の自動移行は行わないため、必要なキーを新コマンドへ割り当て直してください。

## API監査ログ

認証後にMCPのtools/callハンドラーへ届いた全API呼出しを、既存HostLogのsource=automationへ記録します。成功はinfo、拒否/失敗はwarn。MCP/API名/ホスト生成requestId/公開一覧に実在する対象ID/結果/処理時間を記録し、コマンド実行は受付時にもstartedを残します。未知ツール名はunknownに置き換えます。要求引数、設定値、token、コマンド戻り値、生のエラー文は記録しません。認証前の要求やMCP初期化・一覧取得はAPI操作ログの対象外です。

MCPは接続経路の表示であり、接続元をCodex固有の本人確認として断定しません。ログ画面の絞込みと既存host.log（1MBローテーション）を共用し、別の無制限ログは作りません。終了や切断でstartedだけが残る場合は完了を断定しません。

## 通信と保存

初期無効・初期読取り専用。本体は127.0.0.1だけにbindし、Host/Origin/専用Bearer tokenを検査します。CORS許可は付けません。32byte乱数のトークンを、AppDock側ではElectron safeStorageで暗号化してPC専用rootのautomation.jsonへ保存します。共有設定や配布物へ含めません。

初回は空きポートを選び、以後保存した値を使います。競合時は勝手に変えずエラーにします。詳細のポートに0を指定して適用すると空きポートを選び直せます。変更後はCodex登録を修復してください。EXE配置の絶対パス由来のIDは内部識別と登録範囲の所有判定に使い、Codexへの登録名とは分離します。移動は別配置として扱い、旧登録を自動削除しません。

書込許可の切替は接続を切らず、各呼出しで許可を確認します。停止/終了は接続を閉じ、認証再発行後は旧トークンを拒否します。自己接続テストの日時はクライアント接続日時に混ぜません。日時は認証したクライアントのinitializeの観測であり、現在も接続中という保証やCodex固有の本人確認ではありません。

## Codex登録

対象は同じWindowsホストのCodex。CODEX_HOME/config.toml、未指定ならホームの.codex/config.tomlを候補とし、絶対パスを画面で変更できます。WSL/リモートの自動設定はしません。

0.26.27から登録名の既定値はAppDockで、mcp_servers.AppDockのurl/enabled/required/http_headersだけを追加します。接続の詳細で登録名を変更できます（英字で始まる64文字以内の英数字・ハイフン・アンダースコア）。複数配置にはAppDock_Testなど別の名前を指定します。同名の他登録は上書きしません。serverIdはCodexへの登録名、APIのinstanceIdと管理コメントは配置IDです。

0.26.26の登録名を自動移行しません。旧登録や名前変更前の登録は「登録を解除」してから登録し直します。解除は保存済みの所有hashを照合して旧名の管理範囲だけを削除します。ローカルserverNameが未保存の場合はAppDockを既定値にします。

required=falseなのでAppDock停止をCodex全体の必須起動失敗にしません。Bearer tokenはCodexのローカルconfig.tomlにも平文で保存されます。画面・IPC状態・ログには出しません。

管理用コメントと範囲hashを使い、全TOMLの構文と範囲外の意味を検査します。現在の正確な登録内容または保存済みhashと一致するときだけ修復/解除します。複数行文字列内の偽コメント・外部編集・同名衝突・不正TOMLを上書きしません。直前bytesを照合しatomic置換します。既存内容があれば同じ場所のconfig.toml.appdock-backupへ復旧用コピーを保存します（既存認証値が含まれ得ます）。解除は管理範囲だけを除き、過去の全ファイルを復元しません。

登録状態はファイルから確認し、MCP稼働と実接続日時を別表示します。登録/修復/解除後はCodex再読み込み/再起動を案内します。組織ポリシーや別profileの上書きまで、この画面だけで確認できるとは限りません。

## 検証

- `dev.bat run typecheck` / `dev.bat run build`
- `dev.bat exec node --test tests/automation.test.cjs tests/settings-commands.test.cjs tests/settings-sync.test.cjs`
- `dev.bat exec node scripts/automation-ui-test.cjs [publish/AppDock.at365.exe]`
- APPDOCK_TEST_CODEX_EXEへインストール済みCodexの絶対パスを指定すると、GUI生成の隔離configを実Codexで読み込み、7ツールの発見と取得/変更/再取得/復元・公開コマンド実行を確認します。検証にだけapp-serverのMCP呼出しを使い、モデル推論や実利用の認証値は使いません。GUIのコマンド試験は製品にないIDの専用Appletを使い、実デスクトップ壁紙は変更しません。

証跡は.artifacts/automation-source-* / automation-portable-*とVERIFICATIONに記録します。ビルドをGUI検証と同時実行しません。

参考: [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)、[Codex設定](https://learn.chatgpt.com/docs/config-file/config-reference)、[MCP transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)。
