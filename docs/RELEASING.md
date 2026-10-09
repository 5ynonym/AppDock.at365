# AppDockのGitHub Release手順

この文書をリリースの正本とします。ユーザーから「バージョンアップして一緒にリリースして」と依頼されたら、版・変更範囲を確認し、以下を最後まで実施します。単なるビルドや手順整備では公開しません。実測結果は[VERIFICATION.md](../VERIFICATION.md)へ記録します。

本体Releaseには必ず次の3ファイルを添付します。GitHubが自動生成するSource code ZIPは実行用配布物ではありません。

| ファイル | 用途 |
| --- | --- |
| `AppDock.at365.exe` | 通常の単一EXE版・本体自己更新 |
| `update.json` | 通常EXEの版・サイズ・SHA256を示す更新情報 |
| `AppDock.at365-all-in-one-<version>.zip` | 同じEXE + 全ローカルAppletを`extensions`へ配置 + `bundle.json` |

全体ZIPをupdate.jsonのpayloadに指定しません。Appletの個別更新は各repoのupdate.json/update.zipを継続します。

## 環境と事前確認

- Windows x64、.NET 10 SDK、Git、認証済みGitHub CLIが必要です。実行ユーザーに対象repoのRelease作成権限が必要です。
- `setup-tools.bat`で[toolchain.json](../toolchain.json)のローカルNode/pnpmを用意します。グローバルNode/pnpmは追加しません。ビルドは既存の`dev.bat`/`publish.bat`を使います。
- PowerShellからrepoルートで実行します。以下の`$taskRepo`は実際のcheckoutへ合わせます。Gitの所有権例外はコマンド単位とし、global設定を変更しません。
- hostと全対象Appletの作業ツリーはcleanにします。ユーザーの変更を破棄・勝手にstashしません。各Appletは意図した最新のローカルcommitか確認します。自動pullや自動branch切替はありません。
- 実利用フォルダーへdeployせず、GUI試験は隔離profileで直列実行します。ログイン情報やsettingsを配布物へコピーしません。

```powershell
$taskRepo = 'A:\30.PROJECT\AppDock.at365'
Set-Location $taskRepo
$taskGh = 'C:\Program Files\GitHub CLI\gh.exe' # PATH上なら gh も使用可
& $taskGh auth status
git -c "safe.directory=$taskRepo" -C $taskRepo status --short
git -c "safe.directory=$taskRepo" -C $taskRepo remote -v
```

スクリプトは各外部コマンドの非0終了を例外にします。手動実行でも各コマンド直後の`$LASTEXITCODE`を確認し、失敗したら次へ進みません。ネットワークや通常Windows権限が必要な操作をsandbox内の失敗だけで製品不具合と断定しません。

## 1. バージョンとリリースノート

1. 対象変更を実装し、必要な回帰試験を行います。安定版は`x.y.z`を使用し、公開済みの版・タグを再使用しません。
2. `scripts/release.ps1 -Mode SetVersion -Version <次の版>`でpackage.jsonを更新します。現在より大きい正式版だけを受け付けます。コミット・タグ・公開はまだ行いません。
3. READMEの利用者向け版/要件、関係する開発文書、検証記録を更新します。変更内容に応じた追加のGUI試験も行います。
4. UTF-8のリリースノートを`docs/releases/v<版>.md`などに保存します。変更点、Windows/.NET要件、3配布物の用途、導入/更新方法、最低対応版、既知の制約、検証範囲を記載します。古い件数やハッシュをコピーしません。
5. 変更をレビューしてコミットし、リリース対象をmainへ統合します。既存のユーザー変更・branch境界を守ります。通常のレビュー/承認フローがあれば従います。

package.jsonは本体バージョンの正本です。pnpm-lock.yamlには本体版の重複フィールドはありません。更新UI試験はpackage.jsonの版を読みます。Appletを変更した場合はそのrepoのmanifest・プロジェクト/パッケージの版とノートを整合させ、各repoで検証/コミットします。

## 2. ローカル準備（GitHubを変更しない）

```powershell
$taskNotes = Join-Path $taskRepo 'docs\releases\v<版>.md'
$taskPlan = Join-Path $taskRepo 'artifacts\release-<版>-<試行ID>\plan.json'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/release.ps1 `
  -Mode Prepare -NotesFile $taskNotes -PlanPath $taskPlan
```

プレースホルダーは実際の版と新しい試行IDへ置き換えます。PlanPathを省略すると固有のartifactsフォルダーを作ります。既存planの上書きは拒否します。

Prepareはソース/ノートの事前記録後、次を順番に実行します。

1. `dev.bat run typecheck`
2. `dev.bat test`（helper・本体・fixtureビルドと回帰テスト）
3. `publish.bat`（本体/.NET/helper/portable/feed → 全Applet再発行 → 全体ZIP）
4. ローカルNodeで`scripts/portable-updates-ui-test.cjs`
5. 同`scripts/update-progress-ui-test.cjs`
6. 同`scripts/update-recovery-test.cjs`
7. 同`scripts/all-in-one-ui-test.cjs`（ZIP全収録ファイルのhash/size、通常EXEとの一致、隔離展開起動、全Appletの版/初期無効/エラーなし、終了）

1件でも失敗するとそこで停止し、GitHubへ接続/公開しません。各ステップのログ、`checks.json`、`bundle-ui.json`をplan隣へ保存します。最後にhost/Appletのcommitとclean状態、同梱一覧、元Applet ZIPハッシュ、3アセット、ノート、検証ログのハッシュを照合し、planを`prepared`にします。

失敗したpublishの後には以前のZIPが残る場合があります。ファイルが存在するだけで成功扱いしません。修正後は新しいPlanPathでPrepareをやり直します。Prepare後のソース変更/コミット、ノート変更、再ビルド、Applet追加、証跡変更はplanを無効にするため、必ず再Prepareします。

## 3. mainのpush、下書きと添付

リリースを依頼された範囲で、検証済みcommitをmainへpushします。スクリプトはpushやマージを自動実行せず、GitHub mainのSHAとplanのSHAが一致することを要求します。

```powershell
git -c "safe.directory=$taskRepo" -C $taskRepo push origin main
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/release.ps1 `
  -Mode Draft -PlanPath $taskPlan -GhPath $taskGh
```

公開先は`5ynonym/AppDock.at365`です。originとremote main、既存タグの参照先、ローカルの準備物を再検査します。未作成なら`v<版>`/対象commit/ノートで**下書き**を作り、3ファイルを添付します。GitHubの各assetがuploaded状態で、sizeとSHA256 digestがplanに一致して初めて`draft`になります。タイトル・ノート・対象commit・余分なassetも検査します。GitHubからdigestが得られない場合も推測せず停止します。

同じplanの再実行は、一致する下書きの不足assetだけを添付します。`--clobber`は使いません。公開済みRelease、タグの別commit、既存asset不一致は拒否します。タグはGitHub Releaseの対象commitから作成し、既存タグの移動/強制pushは行いません。

## 4. 最後に正式公開、認証なしの取得確認

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/release.ps1 `
  -Mode Publish -PlanPath $taskPlan -GhPath $taskGh
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/release.ps1 `
  -Mode Verify -PlanPath $taskPlan -GhPath $taskGh
```

Publishは検証済み下書きと全アセットを再照合してから、最後の更新操作で`gh release edit ... --draft=false --latest`を実行します。Verifyは公開タグ/main/ノート/assets/latestを読み、認証なしで3ファイル全部を取得してsize/SHA256を照合します。本体の実`PortableUpdates.check()`でもGitHub元から対象版がavailable/installableになることを確認します。インストールは行いません。成功するとplanは`verified`、URLと製品のチェック結果を保存します。

自己更新処理や配布仕様を変更したReleaseでは、[配布先のチェックリスト](update-checklist.md)に沿って、隔離した旧版からGitHub更新も試験してください。Prepareの実EXE試験はローカル更新元です。Verifyの更新確認と実インストール試験は区別します。

## 失敗・中断時

- Prepare失敗: GitHub未変更。ログを確認して修正/コミットし、新しいplanで再実行。
- Draft失敗: 公開しない。不足assetだけなら同じplanのDraftを再実行。不一致asset/ノート/対象commitは自動修復しない。下書きの内容と所有関係を確認してから、人が修正・削除の範囲を判断する。
- Publish前の検査失敗: 下書きのまま停止。条件を緩めたり手動で公開を先に行ったりしない。
- Publishの通信切断/応答不明: 公開操作はサーバー側で完了している可能性がある。`gh release view <tag> --repo 5ynonym/AppDock.at365`とAPIで状態を読む。公開済みならVerifyへ進み、同じタグで再作成しない。下書きと確定できた場合だけ再Publishする。
- 公開後Verify失敗: 既に公開済みの可能性を明示し、原因と到達済み段階を報告する。自動削除・非公開化・asset上書きはしない。回線回復後のVerify再実行か、新しい修正版のReleaseを判断する。

「失敗時に公開しない」は**公開前の検査に失敗したものを公開しない**意味です。公開リクエストと世界中への反映をネットワーク越しに原子的に取り消せる保証ではありません。複数repoのReleaseも一括トランザクションではなく、repoごとの公開/下書き状態を報告します。

## 不具合のある旧Releaseの削除

ユーザーが旧Releaseの削除を指定した場合だけ実施します。まず修正版のPrepare→Draft→Publish→Verifyを完了させ、latestと匿名取得、本体更新チェックを確認します。その後、指定された旧タグのRelease ID・公開状態を再確認して、`gh release delete <旧タグ> --repo 5ynonym/AppDock.at365 --yes`でReleaseと添付アセットを削除します。`--cleanup-tag`は使わず、Gitタグとコミット履歴は残します。

削除後は旧タグのRelease APIが404、修正版がlatestで全アセットを持つこと、旧Gitタグが保持されていることを確認し、削除対象のmetadataと結果をartifactsへ記録します。削除結果が不明な場合は読み取りで状態を確認し、別のReleaseを推測で削除しません。公開後Verifyの失敗を理由に自動で削除する処理とは区別します。

## Appletを追加したとき

[オールインワン発行](all-in-one.md)の自動探索が正本です。AppDockの親フォルダー直下に独立repoを置き、`.git`、`extension.json`、失敗時非0終了の`publish.bat`を用意します。共通`pack-applet-update.ps1`で`publish/update.json`と`update.zip`を作ります。IDを重複させず、version/runtime/apiVersion/minimumHostVersion/entryを正しく記載します。

`publish.bat → dist → dist:host → pack:all-in-one`が毎回全対象を列挙するため、6件などの固定リストを更新する必要はありません。追加後はpublishと全体ZIPの起動検証で収録を確認します。ローカル最新版とはその時点のcheckoutです。リリース準備は全repoのcleanを要求します。

開発用`build-all-in-one.ps1 -AppletRoot`は別探索先も許可しますが、Releaseスクリプトは標準の兄弟配置を使用します。別配置を正式運用する場合は、発行とreleaseの探索を同時に変更/試験してください。新規repo自動追加の回帰は`tests/all-in-one.test.cjs`で検証します。

## Applet個別Release

本体のReleaseスクリプトは全体ZIPを作りますが、Applet repoのReleaseまで無条件に作りません。変更/公開を依頼されたAppletは、そのrepoの指示に従って版更新・テスト・publishを行い、clean mainをpushします。manifestと更新JSON、ZIPの全ファイル、size/SHA256を確認し、以下の既存手順を適用します。

```powershell
# 各変数は対象Appletの確認済み値。実行前に既存タグ/Releaseを確認する。
& $taskGh release create $taskTag $taskZip $taskFeed --repo $taskAppletRepo `
  --target $taskCommit --title $taskTitle --notes-file $taskAppletNotes --draft
& $taskGh api "repos/$taskAppletRepo/releases/tags/$taskTag"
# target、draft=true、ノート、update.zip/update.jsonのstate/size/digestを照合。
# すべて成功した場合だけ実行する。
& $taskGh release edit $taskTag --repo $taskAppletRepo --draft=false --latest
```

公開後はlatest metadata、認証なしのupdate.json/ZIP取得とhash、AppDockの個別/一括更新チェックを確認します。古いtagのassetを新版に置き換えません。Applet側のソースを変更した後は本体のPrepareも作り直し、同梱版と個別配布版を照合します。

## 2026-10-09に成功した公開の記録

次のローカル証跡とGitHubの実アセットを確認して、この手順へ移しました。artifactsはGit管理対象外なので、将来これらのファイルがなくても上の手順を実行できます。

- `artifacts/github-releases-0.23.0/plan.json`: 7repoのtag/commit/ノート/アセットsize/hash。
- 同`public-verification.json`: 全7repoの認証なし取得と実PortableUpdates.check成功。
- `artifacts/github-install-1791480155823/result.json`: 隔離EXEで全6Applet一括、本体同版、WindowMover個別のGitHub更新成功。
- `artifacts/all-in-one-release-result.json`: 全体ZIP取得検証と元のEXE/feedが不変である記録。

実行したCLI操作は`gh release create <tag> <payload> <feed> --repo <repo> --target <commit> --title <title> --notes-file <file> --draft`、下書きassetのAPI照合、`gh release edit <tag> --repo <repo> --draft=false --latest`です。全体ZIPの追加時は`gh release upload v0.23.0 <zip> --repo 5ynonym/AppDock.at365`（clobberなし）、`gh release edit v0.23.0 --repo 5ynonym/AppDock.at365 --notes-file <既存本文に説明を追記したファイル>`を使いました。今回のスクリプトは初回から3assetを下書きへ揃える手順です。

| repo | 公開タグ | commit（短縮） |
| --- | --- | --- |
| AppDock.at365 | v0.23.0 | 8a4d96e |
| Applet.Gmail.at365 | v0.9.0 | 89bcd76 |
| Applet.WallpaperSlideshow.at365 | v0.4.0 | 12524cb |
| Applet.Watch.at365 | v0.1.1 | 8a84ca1 |
| Applet.WebBrowserTools.at365 | v0.2.4 | b312404 |
| Applet.WindowMover.at365 | v0.2.1 | 630c84d |
| Applet.WindowsTools.at365 | v0.1.1 | 6e8ad2b |

[AppDock v0.23.0](https://github.com/5ynonym/AppDock.at365/releases/tag/v0.23.0)（Release ID 407083349）の確認値:

| アセット | bytes | SHA256 |
| --- | ---: | --- |
| AppDock.at365.exe | 100596899 | `71faa4c6670d2662f195936f45d9fbffde13f73d9136bb9869cdc14ce1b8bf02` |
| update.json | 270 | `2e814fab94ae42eccbbb4f295d56e83ce74658f1d924d29bece5485dd8b42222` |
| AppDock.at365-all-in-one-0.23.0.zip | 275724048 | `92a17694df699133353dc43160b68dc76eded545b4766b8b9621f13ac45f345c` |

この版だけは、公開後にオールインワン機能を実装してZIPを追加した経緯があります。ZIPは同版を再ビルドしたEXEを含むため、先に公開した通常EXEとはバイト一致しません。既存EXE/feedは保持しました。これは履歴上の例外であり、今後は同じPrepareで作ったEXEを通常版と全体ZIPに使い、hash一致を必須にします。既存v0.23.0を新スクリプトで再公開しません。
