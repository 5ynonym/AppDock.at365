# オールインワンパッケージの発行

利用者の導入方法は[README](../README.md#オールインワン版)を参照してください。各Appletの実装は独立リポジトリに置き、AppDock側で配布物を組み立てます。

## 発行コマンド

```powershell
.\publish.bat
# 本体EXE・更新JSONだけを発行する場合
.\dev.bat run dist:host
# 発行済み本体からオールインワンを組み立て直す場合（Appletは毎回再発行）
.\dev.bat run pack:all-in-one
```

`publish.bat → dev.bat run dist → dist:host → pack:all-in-one`の順に処理します。本体の単一EXE形式と通常更新JSONは維持します。オールインワンの組み立ては`scripts/build-all-in-one.ps1`です。

対象は、AppDockリポジトリの親フォルダー直下にある、`.git`と`extension.json`を持つリポジトリすべてです。各repoの`publish.bat`が必要で、足りない場合は失敗します。ネストした試験fixtureや実利用先の`extensions`は探索しません。別の場所を探索する場合はPowerShellから`-AppletRoot <絶対パス>`を指定できます。

「最新版」は実行時点で各ローカルcheckoutから発行した内容です。GitHubのlatest取得やgit pull、ブランチ変更は行いません。未コミット変更もビルド対象になり、`bundle.json`へcommitとdirty状態を記録します。リリース時は意図したブランチ・変更状態で発行してください。

## 内容と検証

```text
AppDock.at365-all-in-one-<version>.zip
  AppDock.at365.exe
  bundle.json
  extensions/
    Applet.Gmail.at365/
      extension.json
      ...実行ファイル・画面資産
    ...各Applet
```

- ID重複、正式版のバージョン、最低本体版、発行スクリプトを先に検査します。
- 各Appletのpublish.batを直列実行し、終了コードを確認します。生成した更新JSONとZIPのID・版・サイズ・SHA256を照合します。
- ZIPは共通helperでリンク/パストラバーサル/サイズ等を検査して、専用stageの`extensions/<repo名>`へ展開します。展開後のmanifest・entry・最低本体版も元ソースと照合します。
- 本体EXEだけをコピーし、各Appletは検証した更新ZIPの内容だけを収録します。AppDockの設定・認証領域・ログ・実利用先の拡張は取り込みません。Appletのpublishフォルダーは生成物専用とし、個人データを置かないでください。
- `bundle.json`に本体/各Appletの版・commit・dirty状態・Applet ZIPハッシュと収録ファイルのサイズ/SHA256を記録します。初期設定は同梱せず、初回起動時の通常動作ですべてのAppletが無効になります。

出力は`publish/AppDock.at365-all-in-one-<version>.zip`。専用stageは`artifacts/all-in-one-<ID>/package`に残します。完成後だけ同じ版の出力ZIPを置換します。途中で失敗した場合、以前の完成済みZIPは残るため、終了コードが失敗の発行物を新しいものとして公開しないでください。Appletが0件でも失敗します。

## リリース

通常の`AppDock.at365.exe`と`update.json`に加え、オールインワンZIPを同じAppDock Releaseへ添付します。`update.json`のpayloadは通常EXEのままとし、オールインワンZIPへ向けません。Applet個別のリリース・更新処理も従来どおりです。publish.bat自体はGitHubへの公開や実利用先deployを行いません。

## 検証

`dev.bat exec node --test tests/all-in-one.test.cjs`は事前に発行したhelperを使い、隔離したGitリポジトリと配布物で、再発行、失敗時の既存ZIP保持、改変ZIP拒否、最低本体版不足、ID重複を確認します。Windows/.NET 10/Gitが必要です。

実パッケージではZIPの収録一覧・全ファイルのhash、各Applet更新ZIPとの一致を確認し、新しい隔離フォルダーへ展開してEXEを起動します。全Appletが一覧に表示され、版が同梱一覧と一致し、初期無効であることを確認してください。通常smoke-testモードはAppletなしを想定するため、同梱状態は通常起動の隔離profileで検証します。結果は[検証記録](../VERIFICATION.md)へ残します。
