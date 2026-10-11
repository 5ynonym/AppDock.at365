# Shellのページ表示（0.26.42）

本文領域の表示基盤を追加し、全体のログページ・Applet詳細のログタブ・WebApplet管理のログタブをDefault Shellへ移した。本体rendererにログの描画は残さない。既存の起動後500件、Applet/source・レベル・文字検索、保存先を開く操作、ファイルの1MBローテーションは維持する。過去ファイルの閲覧、日付フィルター、保存期間変更は今回の範囲外。

## 部分差し替え

通常Appletへ`shell` capabilityと次の宣言を追加する。`minimumHostVersion`は`0.26.42`以上。通常のコマンド・設定・ページと併用できる。

```json
"shell": {
  "apiVersion": 1,
  "views": { "page.logs": "logs.html" }
}
```

選択したShell Appletの`page.logs`は全体・詳細の両方に適用する。未提供領域はDefault Shellを使う。リボンとパレットの実装は不要。選択値は既存の`host.shellProvider`を維持し、複数Appletの領域別同時選択と複数Windowは未対応。

## 責務と寿命

| 部分 | 責務 |
| --- | --- |
| `HostLog` | ログの記録、起動中の直近500件、既存ファイル保存 |
| `LogPageSession` | 表示対象、検索条件、表示モデル、操作の検証。表示用のコピーだけを公開 |
| `ShellPageHost` | primary本文の1枠、提供元選択、遅延生成、ready、寸法・zoom、IPC送信元、表示順序、復旧、破棄 |
| 本体の`ShellPageSlot` | 空の表示枠、領域報告、Tabによるフォーカス移動。ログUIを持たない |
| Default Shell / Shell Applet | 見出し、検索・絞り込み、一覧、エラー表示 |

ページは非モーダルで、設定通知と共通オーバーレイより下に置く。ページ上からも共通ショートカットが使え、検索欄の通常入力やIMEは描画が扱う。Tab/Shift+Tabは本体の前後の操作へつなぐ。Windowの非表示・最小化ではViewを隠し、復帰後は同じセッションを表示する。ページ・詳細タブ・対象Appletの変更、所有rendererの再読込・終了ではViewとタイマーを回収する。別ページへの遷移で他Appletの既存Viewや設定draftを破棄しない。

本文の表示モデルと操作は`ShellPageController`に分離する。次のページを追加するときは、機能サービスと公開モデル/操作を定義し、内容ControllerとShell描画を追加する。ページ固有の検索や業務判断を`ShellPageHost`へ追加しない。Default Shell専用の分岐や内部importを設けず、双方を同じmanifest・loader・bridgeで起動する。

## 公開bridge

型の正本は[src/shared/shell-pages.ts](../src/shared/shell-pages.ts)。HTMLには`window.appdockPage`を公開し、Nodeや`window.dock`は渡さない。

1. `onChanged(callback)`を登録し、`connect()`から`sessionId/providerAppletId/snapshot`を取得する。
2. snapshotを描画してから`ready(sessionId)`を呼ぶ。
3. `act({ id, type: 'filters', filters: { source, level, text } })`で絞り込む。`level`は`all/info/warn/error`。
4. `act({ id, type: 'open-directory' })`は本体管理のログ保存先を開く。任意パスは受け取らない。
5. `getSettings/onSettingsChanged/executeCommand`は他のShell領域と同じ自己設定・自己登録コマンドの契約。任意の他Appletコマンド実行には使えない。
6. `onFocus`で先頭/末尾のコントロールへ移り、端のTabでは`focusHost('before'|'after')`を呼ぶ。`shortcut(key)`は本体の共通キー割り当てに従う。実行先をShellから指定しない。

モデルは`schemaVersion:1/id/contextId:primary/kind:logs/revision/dark/content`。同じ`id`では古いrevisionを無視する。`content`は`scope/filters/sources/entries/limit`を持ち、entriesは本体が絞り込んだ記録順の配列。現在のDefault Shellは従来どおり新しい順で描画する。

`scope.type`が`all`ならsourceを選択できる。`applet`なら`scope.id`に固定し、`web`なら`web.*`と`web-applets`に固定する。詳細画面からsourceを広げる操作は拒否する。提供元Applet自身のIDと、ログの表示対象AppletのIDは別物として扱う。全体ページのsource選択は既存の再起動時表示状態へ反映する。文字検索とレベルはそのページの寿命に従い、提供元切替・復旧では保持し、ページを離れると終了する。

WebContents・main frame・登録URL・現在route・readyを照合し、旧ページIDの操作を拒否する。新しい表示枠の後に届いた古い枠のcloseは無視する。ログの本体snapshot契約は既存互換のため維持するが、Shellへ全設定や認証状態を渡さない。MCP/worker向けのログ照会APIは今回追加していない。

## 復旧

ready期限は10秒。読込失敗・renderer終了/応答不能では同じControllerを使ってDefault Shellへ復帰する。検索条件と対象を保持し、リボンやパレットの提供元は変更しない。同じ領域・提供元・版の故障はプロセス中に記憶し、「Shellを再試行」または提供元の新版で再試行する。意図的な無効化・再起動は故障扱いにしない。

表示中のShell選択変更はページにも反映する。`--safe-shell`ではDefault Shellへ固定する。Default Shellも使えない場合は本体から最小ネイティブ通知を出し、設定にあるShell再試行などの操作を残す。第二のログ描画は作らない。

## 検証

`tests/log-page.test.cjs`は絞り込み・範囲固定・500件・revision・古い操作の拒否を確認する。`scripts/shell-page-ui-test.cjs [固定EXE]`は全体/詳細/Web管理・部分差し替え・自己コマンド/設定・復旧・ready期限・safe起動・テーマ・寸法・フォーカスを隔離profileで確認する。既存navigation、Shell、overlay、settings-noticeの回帰も影響範囲に含む。実行結果と未確認事項は[VERIFICATION](../VERIFICATION.md)へ記録する。
