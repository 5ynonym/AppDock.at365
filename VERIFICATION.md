# 検証記録

## 環境の.NET 10 Runtimeを使用（2026-10-06 JST）

.NETホストの発行を `win-x64` / `--self-contained false` に変更しました。発行前に専用の `artifacts/dotnet-host` を削除して再生成し、以前の同梱ランタイムが残らないようにしています。READMEとApplet開発ガイドに、利用先の.NET 10 Runtime（Windows x64）の要件とnative Appletとの違いを反映しました。

- `publish.bat`: .NETホスト・TypeScript・Reactのビルドとportable EXE作成が成功。
- 発行先と完成版 `publish/win-unpacked/resources/dotnet-host` に、`coreclr.dll`・`hostfxr.dll`・`hostpolicy.dll`などのランタイム本体がないことを確認。runtimeconfigは `Microsoft.NETCore.App 10.0.0` を参照。
- 実ホストの読み込みモジュールを確認し、`C:\Program Files\dotnet` 配下の.NET 10.0.12を使用していることを確認。`--hotkeys` モードの空のキー同期とEOFでの終了コード0も成功。記録: `artifacts/framework-dependent-validation.json`。
- `dev.bat test`: 33件すべて成功。実Node/.NET拡張の起動、コマンド実行、異常終了後の再起動、停止を含みます。
- 完成win-unpacked版の専用プロファイルでNode/.NET拡張の起動、.NETの状態更新、Storage / Secrets APIの往復、正常終了が成功。記録: `artifacts/framework-package-lnHWWO/result.json`。初回の確認はテスト側が起動完了を待てず失敗したため、待機方法を修正して再確認しました。
- portable EXEを別の専用フォルダーへコピーし、初回起動、設定・アバター保存と画像表示、正常終了が成功。Applet一覧は空。記録: `artifacts/smoke-1791270101603/smoke-result.json`。
- ビルドスクリプトのPrettier確認とGit差分空白検証が成功。

成果物: `publish/AppDock.at365.exe`、100,405,280 bytes、Version 0.4.0。
SHA256: `73DE381C8DD292FEB084A9440BE20E2ED41E0D09EC0F94276864F3A40B08DBE2`。

最初の発行はSandboxのNuGet.Config読み取り制限で失敗し、通常実行環境で上記の成功を確認しました。実利用先への配置はしていません。.NET未導入の別PCでの確認とOS全体へのキー送信は未実施です。native時計Applet自身のランタイム同梱設定は変更していません。

## サンプルAppletの同梱解除・タスクバーアイコン（2026-10-06 JST）

Welcomeと.NET Connection Demoの同梱・初期設定・通常ビルド対象を削除。Node／.NETの拡張機能は維持し、既存のサンプル実装は`tests/fixtures`に移して回帰検証だけで使用します。通常起動ではEXE隣の`extensions`のみを読み込みます。既存settings.jsonの保存済みApplet設定は削除しません。

WindowsのウィンドウアイコンをICOに統一し、[ElectronのsetAppDetails](https://www.electronjs.org/docs/latest/api/browser-window#winsetappdetailsoptions-windows)でタスクバーのAppUserModelID・アイコン・再起動先を指定。ICOをapp.asar外へ配置し、portable版のタスクバーアイコンと再起動先には、一時展開先ではなく元のportable EXEを使用します。

- 型チェック、回帰テスト33件、既存UI・プロフィール／ショートカット・完成win-unpacked版ナビゲーション11項目が成功。
- 初回起動のApplet一覧が空であること、古いサンプルの設定を残して再起動してもサンプルが復活しないことを確認。
- 完成win-unpacked版・portable EXE双方で、Windowsの大小ウィンドウアイコン（150% DPIで24×24／48×48）を取得し、アプリICOと全画素一致を確認。ShellのAppUserModelID、RelaunchIconResource、RelaunchCommandも検証。portable版は元の`publish/AppDock.at365.exe,0`を参照。
- portable EXEを別フォルダーへコピーした起動、設定・アバター保存、画面からの読み込み、ホストコマンドのピン保存、正常終了が成功。Applet同梱なし。
- Prettier・Git差分空白検証が成功。実利用先への配置、既存ピン留めの更新、OS全体へキーを送るホットキーテストは未実施。

記録: `artifacts/icon-removal-validation/profile-1791226237683/result.json`（win-unpacked・再起動）、`artifacts/icon-removal-validation/profile-1791226252327/portable-result.json`（portable・実アイコン画像）、`artifacts/ui-1791226064526/`、`artifacts/preferences-1791226067365/`、`artifacts/navigation-1791226070088/`、`artifacts/smoke-1791226417380/smoke-result.json`。

最初の.NET検証はSandboxのNuGet.Config読み取り制限で失敗し、通常実行環境で成功。初回UI検証は継承した`ELECTRON_RUN_AS_NODE`で起動できず、子シェル内だけ解除して成功。portableランチャー経由のPlaywright起動はデバッグ接続待ちとなったため、検証専用プロファイルの起動済みアプリへCDP接続し、Windows APIによる実アイコン検証と正常終了を完了しました。恒久環境変数や実利用の設定は変更していません。

成果物: `publish/AppDock.at365.exe`、125,269,111 bytes、Version 0.4.0。
SHA256: `0875F8354245AF00ABC6177AD9AAE57F066F2D8671CC41034E09BBD9A7F09E66`。

## ショートカット一覧の行をコンパクト化（2026-10-06 JST）

通常行を「コマンド名」「Applet名＋コマンドID」「グローバルチェック＋有効範囲・登録状態」の3段へ整理。キー入力と操作ボタンは右側に保持し、行の上下余白を20pxから12pxへ縮小しました。長いIDは省略表示し、ホバーで全文を確認できます。登録エラー・キー競合は下に全文を表示します。狭い画面では状態表示を折り返し、IDは10pxを維持します。保存形式と割り当て処理の変更はありません。

- 型チェック・production build、既存`test:navigation`の11項目、`test:preferences`が成功。
- 1280×840・900×620、ライト／ダークで画面を撮影し、文字・キー入力・状態の配置を目視確認。通常の1キー行は89 CSS px（グループ見出し・エラー・複数キーを含まない行）。
- 画面確認: `artifacts/compact-1791224463318/`。操作検証: `artifacts/navigation-1791224273940/result.json`、`artifacts/preferences-1791224294874/`。
- 最終の小画面向けID文字サイズ調整後も型チェックと画面確認に成功。再ビルド時にpnpmの非対話依存確認が失敗したため、準備済みのNode.jsからViteを実行。梱包の直接実行では一度pnpmのPATH指定を誤り失敗したが、`environment.bat`と同じパスへ修正して再実行。依存パッケージの再インストールや設定ファイルの変更は行っていません。
- 最終portable EXEの作成と、別フォルダーへのコピー後の起動・設定／画像保存・Node/.NET起動・終了が成功。pnpmの非対話依存確認が再度失敗したため、既存`smoke.cjs`をプロジェクト内Node.jsから直接実行しました。記録: `artifacts/smoke-1791224641797/smoke-result.json`。実利用先への配置は未実施。

成果物: `publish/AppDock.at365.exe`、125,263,290 bytes、Version 0.3.1。
SHA256: `FAA88D7042DEF34B568CDBDBC6E3DA6D388C292085E6E9F66DDEC915ADEC0698`。

## Applet別の設定・ショートカットと画面構成の改善（2026-10-06 JST）

ページ移動を左ツールバーに集約し、重複したナビゲーション・Applet一覧・固定のMy Dock表記を削除。Applet別の設定フォームとショートカット、対象設定とログへの直接移動、設定・コマンドの検索、キー重複相手の表示、未保存印と固定保存バーを追加。ホームは状態の概要とピン留めコマンドを中心にしました。既存のsettings.json形式、割り当て、保存時の競合保護は維持しています。

| 検証 | 結果 |
| --- | --- |
| TypeScript型チェック・production build | 成功 |
| 自動回帰テスト | 31件成功 |
| 既存UIテスト | Applet起動・停止・コマンド、フォーム保存、不正JSON、外部設定変更の反映と保護が成功 |
| ショートカット・ピン・プロフィールUIテスト | 記録・重複拒否・再割り当て、Node/.NETコマンド実行、画像保存・不正画像の保護・再起動後の保持が成功 |
| ウィンドウ状態UIテスト | 位置・サイズ・最大化・最小化・トレイ格納・非表示起動が成功 |
| 新設 `test:navigation`（完成版win-unpacked EXE） | 下記11項目の検証が成功 |
| `publish.bat` | .NET発行・Reactビルド・portable EXE作成が成功 |
| portable EXEを別の専用フォルダーにコピーして起動 | Node/.NET起動、設定・画像保存、正常終了が成功 |
| Prettier・差分空白検証 | 成功 |

新設テストでは、24個のテスト用Appletと同梱の2個を使用し、次を確認しました。

1. ナビゲーションが各1個で、選択表示とApplet詳細が一致し、対象設定へ直接移動する。
2. Applet名・設定項目の検索、複数Appletの未保存編集、戻る操作、全変更の一括保存。
3. 真偽値・選択肢・利用できない動的選択肢の表示、数値の空欄拒否と修正後の保存。
4. 設定項目なし・コマンドなしの表示、ショートカットへの直接移動。
5. Applet別・ホスト別・全体のキー表示、別Appletとの重複相手表示、状態絞り込み、所属未確認の保存済みキーの保持。
6. 停止したAppletの既知コマンドの所属・割り当て保持。
7. 不正JSON編集中にAppletから設定へ移動しても入力を失わない。
8. 外部更新後の古い設定による上書きを拒否し、編集中の値を保持する。
9. Applet詳細から対象Appletのログへ直接移動する。
10. コマンドパレットのApplet名検索、矢印キー選択、Enter実行、Escape終了とフォーカス復帰。
11. 1280×840・900×620、ライト／ダーク、長い設定フォームと多数のAppletで保存バーを表示し、横方向にはみ出さない。画面画像を目視確認。

記録: `artifacts/navigation-1791220776737/result.json`（完成版と画面画像）、`artifacts/ui-1791220758458/`（既存UI）、`artifacts/preferences-1791220437191/`（設定・プロフィール）、`artifacts/smoke-1791220793168/smoke-result.json`（portable）。

成果物: `publish/AppDock.at365.exe`、125,267,896 bytes、Version 0.3.1。
SHA256: `81E56C7F9A05B4A32455BC2A1ABA363705808F163438152CB96195A884D8EA70`。

実利用の配置先・設定・Appletは変更していません。OS全体へのPause送信を使うホットキーテストと実時計Appletの操作は今回再実施していません。初回のElectronテストは`ELECTRON_RUN_AS_NODE=1`の継承とSandboxアクセス制限、初回発行はNuGet.Configの読み取り制限で失敗しました。環境変数を子シェル内で解除し、通常実行環境で上記の成功を確認しました。ACL・恒久環境変数は変更していません。

## deploy.bat のpwsh切替（2026-10-06 JST）

`deploy.bat` の呼び出し先を `powershell` から `pwsh.exe` に変更。インストール済みのMicrosoft Store版PowerShell 7.6.6を通常PATHで使用し、テスト用フォルダーで引数なしの配置設定・CLI引数の優先・空白と日本語を含む配置先へのEXEコピー・既存settings.jsonの保持・不正な相対パスの終了コード1を確認しました。実利用の配置先にはコピーしていません。確認先: `artifacts/deploy-compat-44866c9c2ffb48b894dea4c8917d8f3d/`。

## mainへの統合確認（2026-10-06 JST）

グローバルホットキー・プロジェクト内Node.js／pnpmと、ウィンドウ位置・サイズ保存を統合。dev.bat経由の型チェック、production build、自動回帰テスト31件、test:window-stateの実Electron再起動・最大化・最小化・トレイ格納・非表示起動がすべて成功。今回の統合ではportable EXEの発行・配置は未実施。

## プロジェクト内のNode.js／pnpm（2026-10-06 JST）

Node.js 24.21.0とpnpm 11.25.0をAppDockの `.tools` 内に準備。Node.js ZIPは公式SHA256と一致しました。mise設定は作成せず、ツールのバージョンは `toolchain.json` で指定します。旧バージョンを残し、両ツールの動作確認後に利用バージョンを切り替える方式です。

Codexが追加するPATHを外し、Windowsの通常PATHだけを渡した子プロセスで次を確認しました。永続PATHとグローバルNode.js／pnpmは変更していません。

- `setup-tools.bat` の初回準備と再実行: 成功。
- `dev.bat exec node --version` / `dev.bat --version`: 24.21.0 / 11.25.0。
- `dev.bat install --frozen-lockfile` / `dev.bat run typecheck`: 成功。
- `dev.bat test`: 23件成功。
- `publish.bat`: .NET発行、Reactビルド、portable EXE作成に成功。
- `dev.bat exec node scripts/smoke.cjs publish/AppDock.at365.exe ../Applet.Watch.at365/publish/Applet.Watch.at365`: Node/.NET/native時計、設定保存・画像表示・終了まで成功。記録は `artifacts/smoke-1791215308632/smoke-result.json`。
- BAT 4ファイル（生成された `.tools/environment.bat` を含む）: CP932往復とCRLFを確認。差分空白検証も成功。

今回の成果物: `publish/AppDock.at365.exe`、125,270,147 bytes、Version 0.3.1。
SHA256: `0E121B1B714EA02D7BECB3A4F16272F7C1C959EFB634773492951E5317DF225D`。
別バージョンへの実際の更新・切り戻しは未実施です。pnpmの依存パッケージストアは通常のユーザーキャッシュを使います。

## v0.3.1 グローバルホットキー（2026-10-06 JST）

Windows x64、テスト専用profileで確認。元Watchはユーザーが終了し、実利用のAppDock設定は変更していません。

| 検証 | 結果 |
| --- | --- |
| TypeScript型チェック・React production build | 成功 |
| .NET ExtensionHost / Runtime発行 | 成功、警告0・エラー0 |
| 自動回帰テスト | 23件成功 |
| 既存のショートカット・ピン・プロフィールUIテスト | 成功 |
| `at365.watch.toggle` の既定グローバルPause登録 | 成功 |
| トレイ格納相当の非表示状態でWindowsのPause入力による時計の表示／非表示 | 双方向で成功 |
| AppDock前面でのグローバルキー | 1回だけ実行されることを確認 |
| キー入力欄の一時解除・単独F24への変更・Pauseの解放 | 成功 |
| 別ホストによるPause競合・設定画面への理由表示・再試行 | 成功 |
| グローバルOFF・既定に戻す・Applet停止／再有効化・AppDock終了時の登録解除 | 成功。別ホストがPauseを取得できることでも確認 |
| 背面からのTypeScriptコマンド実行・ホストコマンドで画面とパレットを開く | 成功 |
| 完成版 `publish/win-unpacked/AppDock.at365.exe` のホットキーUIテスト | 上記9項目成功 |
| portable EXEを別フォルダーにコピーして起動・Node/.NET/native時計・設定と画像保存 | 成功 |
| 両プロジェクトの差分空白検証 | 成功 |

成果物: `publish/AppDock.at365.exe`、125,270,146 bytes、Version 0.3.1。
SHA256: `38E7159990FC549F222CF6B82540A0666CADF30845502C8329C99FAA58F0879B`。

記録: `artifacts/hotkeys-1791212601125/result.json`（完成版の9項目）、`artifacts/preferences-1791212138244/`（既存UI）、`artifacts/smoke-1791212633700/smoke-result.json`（portable）。Pause等の入力はWindowsのSendInputで送信しました。手で押す実キーボード、別の配列・リモートデスクトップ、長期常駐は未検証です。Sandbox内のNuGet／Electron起動テストはアクセス制限で失敗したため、通常実行環境で成功を確認しています。


## ウィンドウ位置・サイズの保存と復元（2026-10-05）

専用Worktreeとテストプロファイルで確認。main / rendererの型チェック、Viteビルド、.NETホスト・Demoビルドが成功。自動回帰テストは28件すべて成功。

`node scripts/window-state-ui-test.cjs` で実Electronの位置・サイズの再起動復元、最大化の復元と解除、最小化中の終了、×でのトレイ格納、最大化状態を保存したままの非表示起動を確認した。Windowsの表示倍率で復元サイズが増える問題も補正し、再起動でサイズが一致することを確認。

負のモニター座標、モニター切断・作業領域縮小時の補正、不正JSON、保存失敗、初回表示直後の最小化はユニットテストで確認。実際のモニター着脱・異なるDPI間の移動は未検証。この変更のportable EXE発行・配置は未実施。

環境のPATHにNode.js / pnpmがないため、既存Electron同梱のNode.js（`ELECTRON_RUN_AS_NODE=1`）でコンパイラー・ビルドスクリプト・テストを実行した。Electron起動時はその環境変数を除去。最初の全回帰テストでは.NET成果物が未生成のため1件失敗したが、ビルド後は全件成功。

## 既存v0.3.0の検証

2026-10-05 JST、Windows x64の通常実行環境でv0.3.0を確認。実利用の設定と画像は変更せず、テスト専用のフォルダーを使用。

| 検証 | 結果 |
| --- | --- |
| TypeScript strict型チェック（main / renderer） | 成功 |
| React / Viteのproduction build | 成功 |
| .NET SDK・Runtime・ExtensionHost・Demo build | 成功、警告0・エラー0 |
| 自動回帰テスト | 20件成功 |
| 実Node/.NET拡張の起動・コマンド・停止 | 成功 |
| 拡張プロセス異常終了後の他拡張継続・再起動 | 成功 |
| React画面での操作テスト | 成功 |
| 設定フォーム・表示／一般／拡張のカテゴリ | 成功 |
| JSON保存・不正JSONの既存設定保護 | 成功 |
| 手動JSON編集の反映・不正編集時の有効設定継続 | 成功 |
| コマンドパレットからのC#コマンド実行 | 成功 |
| 0.1.0の設定を維持した読み込み・Ctrl+Pの既定キー | 成功 |
| キー記録・重複割り当ての拒否・保存と再割り当て | 成功 |
| TypeScriptと.NETの拡張コマンドのキー割り当て・実行 | 成功 |
| ピン留め・上下の並べ替え・検索時の順序保持・解除 | 成功 |
| 名前変更・画像アップロード・1枚への上書き | 成功 |
| 不正画像の拒否・既存プロフィールと画像の保持 | 成功 |
| JSONの書き込み失敗時の画像復元・古い設定での画像変更拒否 | 成功 |
| 再起動後の名前・画像・キー割り当て・ピンの保持 | 成功 |
| TypeScript/C#双方のStorage・Secrets往復 | 成功 |
| Chromium画面にNodeのrequireが公開されていないこと | 成功 |
| pnpm run dist | 成功 |
| 完成portable EXEを別フォルダへコピーして起動 | 成功 |
| portable EXEの隣へのsettings.json保存 | 成功 |
| portable EXEの隣へのavatar.png保存・画面からの読み込み | 成功 |
| portable内部のNode/.NET拡張・設定保存・暗号化保存 | 成功 |
| native EXEの起動・時計の3コマンド・Appletのトレイ項目なし | 成功 |
| 動的なモニター選択肢・設定値の型／範囲検証 | 成功 |
| 設定変更の.NET／Node購読API | 実装、時計の再起動なしの反映をUIで確認 |
| 完成portable EXEと外部時計Appletの接続・表示／非表示の保存 | 成功 |
| 時計の実画面操作・2台のモニター切り替え・停止時のプロセス終了 | 成功。詳細は隣のApplet.Watch.at365/VERIFICATION.md |
| 実装ガイド・API・READMEのローカルリンク | 48件の参照先の存在を確認 |
| ガイドの最小C#サンプル | ビルド成功、警告0・エラー0。manifest・起動・コマンド・設定購読・停止を実プロセスで確認 |
| publish.bat / deploy.bat | 0.1.0でCP932・CRLFと往復確認済み。今回変更なし |

成果物: `publish/AppDock.at365.exe`、125,254,942 bytes、Version 0.3.0、ProductName AppDock.at365。未署名。

SHA256: `BD8390D14ADAB655033167229FEA3A0BB16960110CA80AA0510F53B722BE93F0`。

最終portableテストは `artifacts/smoke-1791209958264/smoke-result.json`。既存画面のUIテストは `artifacts/ui-1791208806421/`、ショートカット・ピン・プロフィールのUIテストは `artifacts/preferences-1791208808973/`。時計のUIテストはAppletプロジェクトの記録を参照。

実装ガイドのC#コード例は `artifacts/docs-sample-1791210707074/` へ抽出し、ProjectReferenceだけ現行SDKの絶対パスへ置換してビルドしました。実際のDLLランナーとの接続、設定変更時の表示更新、終了を確認しています。

Watchの時計だけを外部Appletとして移行済みです。GmailChecker、Watchの入力フック・クリップボード・AutoLock、WallpaperSlideshowの移行は対象外です。別のクリーンPCでの実行、OS起動時の自動起動、長期常駐、配布署名は未検証です。このv0.3.0の検証時点ではElectronと.NETランタイムを同梱していました。現在の.NETランタイム要件は冒頭の「環境の.NET 10 Runtimeを使用」を参照してください。
## WindowsTools対応（2026-10-06）

`codex/windows-tools` worktreeで動的コマンド置換APIと`shortcut-list`設定UIを追加。v0.4.0。

- 型チェック・ビルド成功、既存分を含む33/33テスト成功。
- WindowsTools発行DLLとの実UI連携: 設定画面からの追加／名前変更／削除、対応するグローバルホットキーの登録／解除、削除済みコマンドの拒否、再起動／停止を確認。
- ポータブルEXE生成成功。展開済み配布アプリでも実UIテスト成功。ポータブルEXE自体のスモークテストは、初回の設定ファイル置換EPERM後、再実行で成功（WindowsTools running、panelあり、終了コード0）。
- 自動ロック・実消灯は実行していない。WindowsTools側の模擬APIで検証。実利用の設定は変更していない。
