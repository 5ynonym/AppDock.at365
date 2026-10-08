# AppDockの作業ルール

A:配下では最初に[A:\AGENTS.md](/A:/AGENTS.md)と参照先のALICE指示を読む。このファイルはAppDockリポジトリ全体に適用する。

## リリース

- バージョン更新・リリースを依頼されたら、作業前に[docs/RELEASING.md](docs/RELEASING.md)を読む。手順書を正本とし、過去チャットやartifactsだけに依存しない。
- 「バージョンアップして一緒にリリースして」という依頼は、その変更の検証・配布物作成・対象mainのpush・タグ/Release作成・アセット添付・公開後確認までの指示として扱う。対象や版が不明なら必要な点だけ確認する。単なる文書整備・ビルドの依頼で公開しない。
- 本体は単一EXEを維持する。通常EXE、update.json、全ローカルAppletを拡張として配置したオールインワンZIPを同じ本体Releaseへ含める。
- プロジェクト内のNode/pnpmを使う。既存のpublish.bat・更新JSON仕様・Applet個別更新を維持する。公開済みアセット/タグを自動上書きしない。
- `scripts/release.ps1`のPrepareでビルド・テスト・配布物検証を完了させ、Draftで全アセットを照合してからPublishへ進む。失敗時は非公開のまま停止し、手順書の復旧手順に従う。公開リクエストの結果が不明なら再作成せず状態を確認する。
- GUI試験は直列・隔離profileで行う。実利用設定・認証データは配布物へ入れない。

## Applet追加

- 新しいAppletはAppDockの親フォルダー直下の独立Gitリポジトリに置き、ルートに`extension.json`と`publish.bat`を用意する。既存の6件を固定リストとして扱わない。
- publish.batはビルドに失敗したら非0終了とし、共通`scripts/pack-applet-update.ps1`で、そのAppletの`publish/update.json`と`publish/update.zip`を生成する。manifestのIDは一意にし、版・minimumHostVersion・entryを正しく記載する。
- AppDockのpublish.batはこれらのrepoを自動検出するため、名前一覧の追記は不要。追加後は[オールインワン発行](docs/all-in-one.md)の検査と展開起動で、新Appletも含まれることを確認する。探索範囲外のrepoは勝手に無視せず、配置または明示のAppletRootを整える。
- READMEは利用者向け、開発/発行手順はDEVELOPMENT/docs、実測結果と未確認事項はVERIFICATIONへ記録する。BATはCP932/CRLFを保つ。
