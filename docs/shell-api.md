# Shell Host / Default Shell

リボンとコマンドパレットの描画は`shells/default`のDefault Shellに集約する。本体は表示領域・状態・操作を管理する。ログ本文も[ページ用Shell](shell-pages.md)が描画する。タイトルバー・設定画面・共有設定draft・未移行の本文・AppletページのWebContentsは本体に残る。[オーバーレイと部分差し替え](shell-overlays.md)、[設計と後続計画](shell-foundation.md)も参照。

## 構成と拡張

- `src/main/core/ui-presentation.ts`: 描画モデル、操作ID、重複受付、共有ナビゲーション。
- `src/main/core/shell-host.ts`: primary bindingのView、接続、ready、切替、フォーカス、復旧。
- `src/shared/shell.ts`: 公開TypeScript契約。`src/shared/ui-icons.tsx`は名前付きアイコンの共通素材。
- `shells/default`: Default Shellのmanifest・通常Node worker・React renderer。ホスト内部や既存rendererをimportしない。

Default Shellは通常Appletと同じmanifest検証・ExtensionManager・Node worker・RPC経路で起動する。独立したVite成果物を`out/shells/default`へ生成し、worker/manifestとともにportable EXEへ同梱する。本体からDefault Shellのコンポーネントをimportしない。個別のupdate.zipや更新対象には含めず、本体版と同時更新する。

追加のShell Appletは通常の独立Appletと同じ場所へ配置する。`shell.views`に担当領域のHTMLだけを宣言する。従来の`shell.ui`はリボンの別名として維持し、`views.ribbon`があればそちらを優先する。相対パスの包含・APIメジャー版・minimumHostVersionを検証する。

```json
{
  "apiVersion": 1,
  "id": "example.shell",
  "name": "Example Shell",
  "version": "1.0.0",
  "minimumHostVersion": "0.26.41",
  "runtime": "node",
  "entry": "worker.cjs",
  "capabilities": ["shell"],
  "shell": { "apiVersion": 1, "views": { "ribbon": "index.html" } }
}
```

有効化と使用Shellの選択は別。「設定 → 表示 → Shell」で選択して保存する。保存値は`host.shellProvider`、省略時は`appdock.default-shell`。未導入・無効・失敗時も選択値は書き換えずDefault Shellを使用する。Default Shellの有効状態は本体が保証し、保存された無効指定や起動遅延は適用しない。出自は探索元から決定し、manifestの自己申告は破棄する。外部の予約ID偽装は拒否し、外部Appletの重複IDは両方とも起動しない。

## 描画モデルと共通操作

| 操作                | 引数と戻り値                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui.ribbon.get`     | 任意`contextId: "primary"`。`schemaVersion: 1`、`epoch`、表示用`revision`、`contextId`、`dark`、`route`、`contextActionId`、`items[]`を返す |
| `ui.assets.get`     | `id`にモデル内のassetId。PNG/WebPの`dataUrl`を返す。ファイルパス・任意URLは受け付けない                                                     |
| `ui.actions.invoke` | `epoch`、任意`contextId: "primary"`、`actionId`、一意の`requestId`。結果は`result`に入る。受付や保存と外部アプリ側の効果確認は区別する      |

各項目は`id/kind/title/tooltip/placement/selected/enabled/disabledReason/actionId/icon`を持つ。`kind`はbutton/separator、`placement`はtop/bottom。iconは名前、任意のopaque assetId、文字代替。画像1件はdata URLで1 MiB以下。構造化モデルにローカルパス・openCommand・認証情報を含めない。

表示用revisionは設定revisionと独立。完全snapshotを返し、設定・稼働状態・選択状態・画像等が変わったときに進む。旧`ribbon.get`は設定編集用として維持する。操作IDは返されたものをそのまま渡し、Shell側で項目IDから機能を推測しない。非表示項目や失効したepoch/context、実行時に利用できなくなった操作は拒否する。

通常Appletは既存の`host.appdock.call`（`appdock-api` capability）を使う。MCPのtool名は`appdock_get_ribbon_view`、`appdock_get_ui_asset`、`appdock_invoke_ui_action`。取得はread、操作はexecute、テーマ変更は追加でwriteが必要。Appletのページ操作は明示公開された利用可能コマンドだけを既存`commands.execute`へ渡す。非公開コマンドの項目は外部向けモデルで無効になる。MCPは完全snapshotの定期再取得で追随し、pushは提供しない。

重複受付は最大512件、完了から2分以内。実行中の記録は期限・容量で追い出さない。Shellはホスト発行session単位、通常Appletはworker起動単位。既存MCPはstateless HTTPのため本体epoch内のMCP呼出し全体でrequestIdを共有する。全クライアントでUUIDを使い、接続し直した後の変更操作は自動再送しない。同一IDの異なる操作は拒否する。ホスト再起動・期限切れ・容量超過をまたぐexactly-once保証はない。

## 選択されたShellの公開bridge

専用preloadはDefault Shell/Shell Applet共通の`window.appdockShell`を公開する。`window.dock`やNodeの直接アクセスは渡さない。送信元のWebContents・main frame・登録URL・現session・active状態を照合する。Shellのローカル操作権限は従来リボンと同じで、通常Applet/MCPの包括的な操作許可とは分離する。

1. `onChanged(callback)`を先に登録し、`connect()`で`providerAppletId/contextId/bindingId/sessionId/snapshot`を受け取る。
2. snapshotを描画し、`ready(sessionId)`を送る。旧epoch/contextの応答を混ぜず、同じepochの古いrevisionを無視する。
3. `get()`で再取得、`asset(id)`で登録画像取得、`invoke(request)`で操作。同じ共通サービスを使用する。
4. 購読の戻り値を呼ぶとrenderer側で解除。`dispose(sessionId)`またはView終了でホスト側の購読・キャッシュを回収する。

初期表示はconnectのsnapshot、以後は変更通知。通知は本体の変更通知と同じ60msで集約し、同じrevisionを再配信しない。Viewの全体再作成やAppletページの再表示は状態追随に使わない。

`executeCommand(id)`は接続元のShell Applet自身が登録した利用可能コマンドを通常のコマンド実行経路へ渡す。文字列の接頭辞で所有者を推測せず、登録元と現状態を照合する。他Appletや本体の任意コマンドは受け付けない。リボンの共通操作には`invoke`を使う。Shell Appletは通常のcommands/settings/pagesも併用でき、Shellとして選択されていない間も有効なAppletとして動作する。

`getSettings()`で自Appletの現在の設定を取得し、`onSettingsChanged(callback)`で変更を購読できる。購読してから取得する。通常workerの`context.settings.set`で更新した設定も反映されるため、例えば「コンパクト表示」コマンド→設定更新→Shellの再描画という経路を作れる。書込みは通常の設定API/生成コマンドと検証を使い、Shell専用の保存領域や第二の設定状態を作らない。APIはリボン/オーバーレイ共通の`ShellAppletApi`として定義する。

`onFocus(first/last)`は本体からのフォーカス移動、`focusHost(before/after)`はShellからの移動。Default ShellはTab/Shift+Tabで境界を越え、共通ショートカットはShell Hostが既存ディスパッチャへ渡す。パレット表示中は独立オーバーレイを最前面に置き、下のリボン・Appletページは同じViewを保持する。表示領域は本体の予約領域をzoom込みのDIPへ変換する。

## 切替・復旧と後続範囲

切替先がreadyになるまで旧Shellを保持し、成功時に旧session/Viewを破棄する。準備中に別選択へ変更した場合は準備中Viewも破棄する。ready期限は10秒。意図的な無効化・再起動は故障記録に含めず、再び有効で稼働中になれば保存された選択を使用する。worker停止・renderer終了/応答不能・HTML欠落・起動失敗ではDefault Shellへ戻す。PC専用`dataDirectory/shell-failures.json`で失敗した提供元と版を記録し、同じ版を次回起動で自動再試行しない。「Shellを再試行」または提供元の版更新で再試行できる。

AppDockを終了してから`--safe-shell`で起動すると、選択とリボン表示設定を一時的に既定値として扱う。保存設定・Applet設定・認証は初期化しない。Default Shell自身の起動失敗は本体の最小ネイティブ通知から再試行・ログ画面・終了を選ぶ。第二のリボンを本体へ戻さない。破損した同梱コードそのものを再起動だけで修復できるとはしない。

現在はprimary1件・本体1ウィンドウ。Default Shellのworkerは復旧用に稼働を維持し、Shell Appletの有効状態も選択とは独立。複数の同時Shell/Window、全画面の移植、Web本文の複製、内蔵チャットは未実装。検証の実測・未確認条件は[VERIFICATION](../VERIFICATION.md)へ記録する。
