# 検証記録

## 2026-10-07: v0.12.0 Webアカウントの共通管理

- Nodeへ`webAccounts.start/open/read/report`と`web-accounts` capabilityを追加。Gmail固有のDOM観測は新しいAppletへ置き、ホストはWebContentsView・アカウント別永続セッション・限定UI IPC・破棄を担当。.NET/nativeの既存APIは維持し、今回は.NET SDK専用ラッパーは追加していない。
- main/renderer型検査・Vite build成功、既存70＋境界3回帰で73/73成功。URL/capability/Web資産の境界、既存Node/.NETライフサイクルを確認。
- 発行win-unpacked版の隔離オフラインGUIでDOM新着/未読返信、既読変更、フォルダー復帰時基準、背景監視、900×640のレイアウト、Cookie分離と再起動保持、削除、停止、リモートのNode/bridge非公開を検証。結果: `../Applet.Gmail.at365/artifacts/gui-1791363761348/result.json`。
- portable＋未改変Gmail Appletで、明示コマンド起動、WebContentsView、新着/クリア、無効化/再有効化、正常終了コード0を確認。結果: `../Applet.Gmail.at365/artifacts/portable-1791363831174/result.json`。通信はオフラインfixtureへ差し替え。
- 開発用Gmailの旧テストprofileを元を残して隔離コピーし、再入力なしで実受信トレイと識別子解析を確認。実メール到着/複数実アカウント/Google再認証/実空受信トレイ/実Windows通知/スリープ復帰/長期常駐は未確認。
- `publish.bat`で.NETホストをクリーン発行し、portableを生成。EXEは100,437,305 bytes、SHA256 `7D9168E11D6194F2B87F689354D62A0D5E3AD83546947DF71C0732FDF76D7CC4`。実利用先へは配置していない。

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

## 2026-10-06: v0.5.0 壁紙Applet・共通遅延開始・最低ホストバージョン

- TypeScript main/renderer型検査、Vite build、.NET Release build成功。自動テスト39/39。
- 遅延はプロセスを作る前に実施し、ほかのAppletを待たせない。既定値・保存上書き・設定変更時の再予約・無効化・再起動・今すぐ開始・終了時の解放を確認。
- 最低ホストバージョン不足は遅延待機前・実プロセス起動前に拒否。旧設定は遅延0のまま読み込む。
- JSON設定と画像付きパネルを検証。画像は4件まで・base64 rasterのみ、拒否した入力で既存パネルを維持。既存.NET Panelコンストラクターは保持。
- パッケージ版AppDockで壁紙Appletの隔離GUIテスト成功（履歴・ページ送り・設定保存・遅延取消・今すぐ開始・最低バージョン拒否・各更新チェック）。履歴画像はAppDock内に表示。外部への更新問い合わせは模擬化。
- portable完成EXEを隔離フォルダーへコピーしたsmoke成功。bridge / sandbox / 設定・avatar・ピン・ショートカット保存 / 正常終了を確認。smokeのElectron子プロセスだけELECTRON_RUN_AS_NODEを除去。
- SDK/Runtime v0.5.0。Watch v0.1.1（8/8）、WindowMover v0.2.1（23/23）、WindowsTools v0.1.1（11/11）は再publishと回帰テスト成功。
- 成果物: publish/AppDock.at365.exe、100,409,300 bytes、ProductVersion 0.5.0。
- SHA256: E0E9646499693F5D550086EFB8D537CA69F39195DB6C99A5E55EE0BB5B497C18。
- 詳細と壁紙APIの実機検証境界: ../Applet.WallpaperSlideshow.at365/VERIFICATION.md。

## 2026-10-06: v0.7.0 トレイコマンド設定

- main/rendererのTypeScript型検査、Vite build、.NETホストpublish成功。回帰テスト48/48。
- `trayCommands`の既定は空、`host.trayClickCommand`の既定は`appdock.open`。旧設定への補完、不正ID・型・重複・件数上限、動的置換時のメニュー名と可用性を確認。
- 未インストールの旧サンプル設定・空の`appdock.dotnet-demo.refresh`割り当てを起動時に整理。明示的にインストールしたfixtureと本来のApplet設定・未知コマンドは保持。
- 専用Node AppletのUIテスト成功: コマンドごとのON/OFF、ホストopenのON/OFF、保存直後の実Menu反映、実MenuItemのコールバックとTrayのclickイベントからの実プロセス実行、停止時の無効表示・クリック失敗時のログとウィンドウ復旧、再起動後の保持、追加のdouble-clickハンドラーがないこと。
- 開発版UI: `artifacts/tray-ui-1791290538638/`。発行済みパッケージ版UI: `artifacts/tray-ui-1791290613999/`。1280/900 DIPの画面をPNGで確認。Windows sandboxでのElectron起動はAppContainer ACL制約で失敗したため、ACLを変更せずsandbox外で再実行して成功。
- 単一EXE生成の正常終了後、コピーしたv0.7.0製品EXEのsmoke成功: `artifacts/smoke-1791290651412/smoke-result.json`。Tray clickから既定open・設定・検索、未知コマンド失敗時の復旧、bridge/sandbox、settings/avatars/pinsの保存と正常終了を確認。
- 自動化は実Trayオブジェクトのイベントと実MenuItemのコールバックを使用。Windows通知領域へ物理マウス入力を送る操作、消灯・ロック・壁紙変更などの実機副作用は行っていない。実利用先のEXE・設定の上書き、外部公開・pushは行っていない。
- 成果物: `publish/AppDock.at365.exe`、100,415,159 bytes、ProductVersion 0.7.0。
- SHA256: `83BFB8A0CFF147CFA2F880A7F3F5C535D02ADEBB7894D0F369339A0F7A1D406E`。

## 2026-10-06: v0.8.0 ハードウェアアクセラレーション

- 一般設定にON/OFFを追加。既定true、旧設定もtrueで補完、不正型は保存・起動時に拒否。変更の反映にはAppDockの完全終了・再起動が必要。
- 設定読込を単一インスタンスのロック取得後・Electron ready前へ移し、falseのときだけ`app.disableHardwareAcceleration()`を呼ぶ。不正な既存設定のエラー表示とファイル保持は継続。
- TypeScript main/renderer型検査、Vite build成功。回帰49/49成功。
- 開発版UI: `artifacts/hardware-acceleration-1791291279414/`。発行済みパッケージ版UI: `artifacts/hardware-acceleration-1791291320721/`。ON→OFF→ONを保存して3回起動し、Electronの`isHardwareAccelerationEnabled()`がtrue→false→trueとなること、保存直後は実行中の状態を変更しないことを確認。OFF時のGPU合成は`disabled_software`。フォームと再起動説明をPNGで確認。
- 早期設定読込後もパッケージ版のトレイUI回帰成功: `artifacts/tray-ui-1791291322655/`。
- 単一EXEのsmoke成功: `artifacts/smoke-1791291399989/smoke-result.json`。隔離profileで起動、bridge/sandbox、設定・avatar・ピン保存、トレイコマンドと正常終了を確認。ON/OFFの実状態検証は上記の発行済みパッケージ版で実施。
- 実利用のEXE・設定、Applet、GPUドライバーは変更していない。外部公開・pushなし。
- 成果物: `publish/AppDock.at365.exe`、100,412,458 bytes、ProductVersion 0.8.0。
- SHA256: `517053B6460EDB1477A7A418E6BD9D2B4D41C4C8B66DFA812DB83E893F0FF0F9`。

## 2026-10-06: v0.9.0 トレイのダブルクリック設定

- 一般設定に`host.trayDoubleClickCommand`を追加。既定null、旧設定も未設定で補完。未設定時のシングルクリックは即時実行、割り当て時は待機し、double-clickが来れば対応するsingleだけを取り消す。
- Electron v44.5.1のWindows実装のmouse-down / double-click通知順と、Windows GetDoubleClickTimeの仕様を確認。判定時間は読取専用の.NETホスト補助コマンドで毎回取得。この環境では340ms。通知順への25ms余裕を加え、取得時間を待機時間から差し引く。取得失敗時はwarnと最大5000msの待機にする。
- TypeScript main/renderer型検査、Vite build、.NETホストpublish成功。回帰55/55。単クリック即時/待機、二重実行抑止、ネイティブ取得完了前の取消、独立した複数クリック、設定変更・メニュー・終了時の取消、取得失敗を確認。
- 開発版UI: `artifacts/tray-ui-1791292040494/`。発行済みパッケージ版UI: `artifacts/tray-ui-1791292062264/`。別コマンドのsingle/double、ダブル時に単クリック側が動かないこと、単クリックの遅延実行、保存直後の反映、再起動後の両設定保持、停止時の復旧、未設定へ戻した際の即時実行を実TrayイベントとNode Appletで確認。1280/900 DIPの画面をPNGで確認。
- Windows通知領域への物理マウス入力は送っていない。確認したElectron実装と同じclick→double-clickイベント順で検証した。
- 単一EXEの初回smokeは設定置換のEPERMで失敗（`artifacts/smoke-1791292123270/`）。新しい隔離profileで再実行して成功（`artifacts/smoke-1791292140961/smoke-result.json`）。bridge/sandbox、設定・avatar・ピン保存、既定トレイコマンド、正常終了を確認。ダブルクリックの実行検証は上記パッケージ版で実施。
- 実利用のEXE・設定、Windowsのマウス設定、各Appletは変更していない。SDK/Runtime API変更、外部公開・pushなし。
- 成果物: `publish/AppDock.at365.exe`、100,414,619 bytes、ProductVersion 0.9.0。
- SHA256: `5A052C4D7D1E004B5BDF26EC3E5DCA4FCDC8381C23DF826F7D51BBB2D781DD6A`。

## 2026-10-06: タスクマネージャーの表示名修正

- portable起動用EXEの`FileDescription`にpackage.jsonの長い英語のdescriptionが使われていたため、descriptionを`AppDock.at365`へ変更。製品名・EXE名・バージョン0.9.0は維持。
- プロジェクト内Node.js/pnpmと既存Electron配布ファイルを使用して再パッケージ。portable起動用EXEとwin-unpacked本体の`FileDescription` / `ProductName`がともに`AppDock.at365`であることを確認。PE Machineは起動用EXEが0x014C（x86）、本体が0x8664（x64）。
- 単一EXEの隔離smoke成功: `artifacts/smoke-1791293112989/smoke-result.json`。起動、bridge/sandbox、設定・avatar・ピン保存、既定トレイ操作と正常終了を確認。タスクマネージャー画面自体は未確認。
- Sandboxでの初回起動は結果なし・終了コード2147483651。通常実行環境での初回はテスト設定置換のEPERM、新規profileでの再実行は成功。初回パッケージ処理のElectron取得はネットワーク制限で失敗し、既存ローカルElectronを指定して成功。
- SHA256: `F332E5CE2AB3DF065724CA62030232BAE6379DCCBADBC099364CD8E62598C7F3`。
- ユーザーの完全終了後、実利用先へEXEを配置。配置済みEXEのSHA256が発行元と一致し、`FileDescription` / `ProductName`は`AppDock.at365`、settings.jsonのSHA256は配置前後で不変。旧EXEは`artifacts/process-name-deployment`へ退避。配置スクリプトは実行ポリシー制限で起動できず、pwsh.exeもPATHにないため、スクリプトと同じCopy-Itemで配置。実利用アプリは再起動していない。外部公開・pushなし。

### 表示名の実画面確認

- 修正版を再起動しても、修正前から開いていたタスクマネージャーでは古い英文が残っていた。配置済みEXEのFileDescription/ProductNameはAppDock.at365で、確認したMuiCache内のAppDock表示名にも古い英文はなかった。
- ユーザーがタスクマネージャーを閉じて開き直し、AppDockホストウィンドウを表示した状態でもAppDock.at365になることを確認。タスクマネージャー側の古い表示が再起動で解消した。キャッシュやレジストリの削除、追加のEXE修正は行っていない。

## 2026-10-06: ビルトインの再起動・終了コマンド

- `appdock.restart`（再起動）と`appdock.quit`（終了）をホストのコマンド一覧へ追加。パレット・ピン留め・ショートカット・トレイ設定が同じ一覧を利用し、既定キーは追加しない。既存トレイの終了とwindowActionのquitも同じ終了処理を利用する。
- 再起動はElectronのrelaunchを予約してからquitし、既存のbefore-quitでホットキー・Applet・設定監視・トレイを終了する。終了開始後の再要求は無視する。portable版は元の配布EXEへ戻り、削除される展開先を作業ディレクトリに残さない。
- main/rendererのTypeScript型検査とビルド成功。既存回帰55/55成功。変更したTypeScriptと新検証スクリプトのPrettier確認成功。
- 開発版の実プロセス検証成功: `artifacts/host-commands-1791294664778/result.json`。パレットから再起動し、ホストPIDの切り替えと旧ホスト・workerの終了を確認。同時に2回の再起動要求でも1回だけ再起動。保存済み設定を保持し、割り当てたショートカットでcloseToTray設定にかかわらず完全終了。非同期deactivateの完了記録が各再起動・終了前に残り、最後にプロセスが残らないことを確認。
- 単一EXEでも同じ検証成功: `artifacts/host-commands-1791294787489/result.json`。3回のホストPIDは52236 → 50272 → 54616。再起動後も隔離プロファイルを保持し、2回の再起動と完全終了を確認。パレットの表示はPNGでも確認。
- GUI起動はWindows sandbox内で完了せず、許可された通常実行環境の隔離プロファイルで検証。パッケージはプロジェクト内Node/pnpmと既存Electronを指定して生成。実利用先のEXE・設定・Appletは変更していない。
- 成果物: `publish/AppDock.at365.exe`、100,498,304 bytes。SHA256: `7909549E145F4229A20FEC56608499B6F7825EFFEF372A6D3DBC3DAC526FC9E9`。

## 2026-10-06: トレイのビルトインコマンドを最上位へ移動

- 選択されたビルトインをAppDockサブメニューから最上位へ移動。Appletサブメニュー→セパレータ→ビルトイン（フラット）→セパレータ→固定の設定/終了の順とし、空の区画では余分なセパレータを省く。グループの所有者IDで区別し、Appletの表示名に依存しない。既存の表示選択とコマンドIDを維持。
- TypeScript main build、renderer型検査、Prettier、トレイ回帰4/4成功。開発版実トレイUI成功: `artifacts/tray-ui-1791295415722/`。
- 発行したwin-unpacked版の実トレイUI成功: `artifacts/tray-ui-1791295488202/`。Appletのみ/両方/ビルトインのみ/選択なしの実Menu階層と区切り位置、最上位の開くコールバック、既存Applet実行、表示切り替え、単/ダブルクリック、保存・再起動を確認。物理的なWindows通知領域への入力は送っていない。
- 更新した単一EXEの隔離smoke成功: `artifacts/smoke-1791295545430/smoke-result.json`。bridge/sandbox、設定・avatar・ピン保存、トレイコマンドと正常終了を確認。
- 最新成果物: `publish/AppDock.at365.exe`、100,500,097 bytes。SHA256: `E9A5F315042CB71759231D28F3DB597CAED93F5BF234FB6F22F06EF37C8B7C65`。実利用先への配置は行っていない。
# 2026-10-07 Settings scroll layout

- Keep the settings heading and save toolbar outside the scrolling body. Reserve scrollbar space and reset category/Applet/tab/mode scroll before paint.
- Renderer TypeScript check and Vite build passed.
- `scripts/settings-scroll-ui-test.cjs`: isolated Electron profile, 1280/900/760px widths; heading/toolbar bounds remain unchanged during scrolling and general-to-appearance switching, form width stays stable, JSON switching works.
- Initial sandbox launch was blocked by Electron install-directory ACL restrictions; the UI checks passed outside that sandbox without changing ACLs. Packaged EXE and deployed installation were not updated.

- Deployment completed after user shutdown confirmation: portable smoke passed (artifacts/smoke-1791327621153); deployed EXE SHA-256 matches publish output, settings.json SHA-256 unchanged. Previous EXE retained in artifacts/settings-scroll-deployment-20261007-075937. App was not restarted.

## Settings display cleanup (2026-10-07 JST)

- Removed the settings subtitle and bottom settings-file path; the heading omits its paragraph when no subtitle is supplied.
- Renderer typecheck/build and existing 1280/900/760px settings-scroll UI checks passed. Screenshot inspected at 900px.
- Portable smoke passed (artifacts/smoke-1791328207131). Deployed with matching EXE SHA-256 and unchanged settings.json; previous EXE backed up in artifacts/settings-cleanup-deployment-20261007-081014. App was not restarted.

## 2026-10-07: 設定とAppletの一覧を統一・検索フィルターをボタン化

- 設定カテゴリとApplet別設定の一覧をshellの左パネルへ移動。Appletと背景・余白・文字・選択表示を共通化し、既存の保存済み一覧幅を両画面で共有。フォームとJSON編集、未保存印、画面移動時のdraft保持、固定見出し・保存バーは維持。
- ホーム・Applet・ログのタイトル下の案内文を削除。ショートカットの検索欄と状態フィルターを同じ行へ配置し、「すべて／割り当て済み／未設定／競合・エラー」の排他的な切り替えボタンへ変更。選択状態はaria-pressedで表示し、領域不足時は折り返す。
- main/renderer TypeScript型検査、Vite build、変更コードのPrettier、git diff --check成功。
- 既存の一覧幅UI検証を拡張し、両画面のスタイル一致、ドラッグ・キー操作・幅の上限下限、幅の相互反映と再起動後の復元、未保存データ保持、3画面の案内文削除を確認。開発版: `artifacts/applet-sidebar-1791328926715`、発行win-unpacked版: `artifacts/applet-sidebar-1791329187617`。
- 設定スクロールUI検証成功。1280/900/760pxで見出し・保存バーを固定し、カテゴリ切り替え・JSON表示・フォーム幅を確認。
- ナビゲーションUI検証成功。検索・全4種類の絞り込み・Spaceでのボタン選択、複数Appletの編集保存、JSON不正時の保持、外部変更との競合保護、24 Applet、ライト/ダーク、1280/900/700pxでの検索とフィルターの同一行配置・同じ高さ・横はみ出しなしを確認。開発版: `artifacts/navigation-1791329154290`、発行版: `artifacts/navigation-1791329206049`。既存検証の古い期待件数を共通開始遅延設定と現行5件のホストコマンドに合わせた。
- 900pxの設定フォーム・ショートカットと700pxの設定をPNGで確認。初回のsandbox GUI起動はElectronのinstall-directory ACL制限で失敗したため、ACLを変更せず許可された通常実行環境の隔離profileで検証した。
- プロジェクト内の既存ツールとElectron、既存.NET host成果物で単一EXEを再発行。portable smoke成功: `artifacts/smoke-1791329218130/smoke-result.json`。bridge/sandbox、設定・avatar・ピン保存、トレイ操作、正常終了を確認。実利用先への配置は行っていない。
## 2026-10-07: Appletウィジェット基盤 v0.10.0

- manifest宣言、widgets capability、Node/.NET SDKの登録・配置取得・表示操作API、配置JSON検証を追加。時計・日付・テキスト/値一覧を共通Reactで描画し、ホームのピン留めとデスクトップを独立管理。9アンカー、自由位置、モニター、前面/デスクトップ、サイズ/色/不透明度、移動完了/取消/期限を実装。
- モニター/階層ごとに透過画面を共有。画面単位の日時タイマーを使い、Appletとの毎秒通信なし。バックグラウンドのShell確認時、親・座標が変わっていれば再接続し、変わっていなければSetParent/再配置を省く。背面表示を使うときだけ共通のShellブリッジを起動し、停止時に解放。専用preload、登録済みフォントの実パス検証、設定revisionで境界を維持。
- Watch 0.2.0をDLLへ移行。SDKのnull省略値（地域設定・パネル）を受け付ける互換処理も確認。既存のnative/.NET/Node Appletを維持。UIテストのElectron子プロセスからだけELECTRON_RUN_AS_NODEを外す。
- main/renderer型検査・Vite build成功。ホスト回帰64/64（ウィジェット6件を含む）、Watch回帰14/14成功。実Nodeウィジェットの内容更新とクラッシュ時の内容解放、配置の保持を検証。
- 最終開発版UI: `artifacts/widgets-ui-1791331213323`、最終win-unpacked版UI: `artifacts/widgets-ui-1791331254254`。Watch DLL実通信、初回移行/再登録時の配置保持、ピン/フォーム、共有画面、秒更新、透明画素、専用IPC、移動保存/取消、表示コマンド、停止/有効化/再起動、下書きの画面移動時保持、ライト/ダーク、900pxでの横はみ出しなしを確認。
- 接続済み2画面へ時計と日付を独立配置し、前面・デスクトップの両方で確認。未接続IDを保持してメインへ退避。Win32の親クラスProgman、WS_CHILD、WS_EX_LAYERED/TRANSPARENT/NOACTIVATE、前面と背面のTOPMOST状態、固定前後のフォーカス不変、実ピクセル座標を確認。PNGを目視確認。
- 既存Applet/設定/JSON/コマンドのGUI: `artifacts/ui-1791331012145`、設定スクロール1280/900/760pxも成功。単一EXE+Watch DLLの最終smoke: `artifacts/smoke-1791331259893/smoke-result.json`（ok=true）。
- Windows sandbox内のGUI起動、NuGet設定アクセスは制限されたため、ACL/グローバルツールを変更せず、許可された環境で隔離profileを使って検証。プロジェクト内Node/pnpmと既存Electronで発行。
- `publish/AppDock.at365.exe`: 100,511,894 bytes、SHA256 `18B06407B4B761734F3AB409E96895927F27E65B97C6DF07A80B12AC9E93A15D`。framework-dependentの.NETホストにcoreclr.dll同梱なし。プロジェクトの`publish/extensions/Applet.Watch.at365`だけDLLに更新し、発行元との4ファイルのハッシュ一致、旧Watch EXEなしを確認。実利用先への配置・公開・pushは行っていない。
- 未確認: 物理マウスによるドラッグと下側ウィンドウの操作、実モニター着脱、異なるDPI間の移動、Explorer強制再起動、RDP、スリープの実往復、長期常駐。配置ドラッグの保存検証はウィンドウ座標をプログラムから変更して実施。Shell表示面はWindows依存。
## 2026-10-07: v0.10.1 日付書式・文字配置・保存バー修正

- 元Watchの`Watch.xaml.cs`で`CultureInfo.InvariantCulture` / `M/d ddd`を確認。Intlの自動書式による曜日先行・カンマを除去し、Watchは`10/7 Wed`の書式に復元。タイムゾーン指定は保持。
- ウィジェットごとに左右（左/中央/右）・上下（上/中央/下）揃えを追加。既存設定はautoで読み込み、デスクトップではアンカー側、ホームでは中央に配置。プレビューは揃えの下書きを反映する。
- 日時を実描画境界のSVGで描画し、フォントの行高/サイドベアリングと中央基準のtransformによる余白を除去。時分と半サイズの秒をそれぞれ一続きの文字列で描画し、文字単位の等幅化は行わず、元の比例幅・字間を保持。秒で全体幅が変わっても、左端/右端/中心の選択位置を固定する。計測結果は上限256件のキャッシュで再利用。
- ウィジェットの見出しと保存/再読み込みを設定ページと同じ共通レイアウトへ移動。上部右側のバーを固定し、フォームだけスクロール。設定画面の既存UI検証は表示中のページへ絞り込むよう更新。
- main/renderer型検査・Vite build・.NET host publish成功。ホスト回帰67/67、Watch回帰14/14成功（日付/タイムゾーン、旧配置の揃え移行、比例幅の維持と実描画境界を追加）。
- 開発版UI: `artifacts/widgets-ui-1791333446251`、発行win-unpacked版UI: `artifacts/widgets-ui-1791333558608`。Playwrightの時計制御で00～59秒の自然な全体幅変化と、固定した左端/上端を確認。全9通りの揃えで各60秒進め、選択した端/中央とウィジェットの端/中央の距離が0.5DIP以内で一定。Hatten.ttfの実描画境界がSVG端から2px以内（実測は左右1px以内・上下0px）、日付`10/7 Wed`、揃え保存/再起動復元を確認。1280/900/760pxでスクロール前後の保存ボタン矩形不変、管理画面PNGを確認。実時刻での秒更新も確認。
- 既存設定スクロールUIは1280/900/760pxで成功。単一EXE+Watch DLL smoke: `artifacts/smoke-1791333566349/smoke-result.json`（ok=true）。Windowsの一時的なJSONファイル占有（EPERM）が途中のUIテスト中に1回発生し、テスト内の配置操作だけ最大2回再試行するよう調整。本体の保存処理・失敗報告は変更していない。
- `publish/AppDock.at365.exe`: 100,515,435 bytes、SHA256 `7C332C142040FB9D3669DFBA7227ADD068B1E4C65AFCD212D3AC170ED2818A38`。Watch Appletのソース・実利用先の設定/EXEは変更せず、プロジェクトの発行版だけ更新。外部公開/pushなし。

## 2026-10-07: v0.10.2 デスクトップ固定の描画開始を修正・デプロイ

- デスクトップ固定後のWin32親・座標・可視フラグは正常でも、実画面では表示されない症状を隔離fixtureで再現（`artifacts/widget-visibility-1791334244597`）。以前の親/スタイル検証と`capturePage()`だけではこの欠落を検出できなかった。
- Shell接続後、初回と非表示からの復帰時にElectronの`showInactive()`も呼んでChromiumの描画を開始し、親と座標を再確認する。通常の5秒ごとの確認でshowを繰り返さない。デスクトップ固定は維持し、GPUやShellの設定は変更していない。
- 新しい`test:widget-desktop`は隔離Node fixtureを使い、露出したデスクトップの180×120pxだけに色マーカーを描画して実画面を撮影。緑/紫の表示更新、通常のテストウィンドウによる遮蔽と復帰、非表示からの再接続、マーカー除去後の透明部分を確認。利用者のウィンドウ・壁紙を変更しない。画面の色管理を考慮し、色相と領域の90%以上の画素で判定。
- 開発版の実描画検証: `artifacts/widget-visibility-1791334489928/result.json`。発行win-unpacked版: `artifacts/widget-visibility-1791334630152/result.json`。21,600画素中、緑21,309画素、紫21,301画素、通常ウィンドウの黒21,150画素。除去後は元の背景の画素集計に戻る。
- main/renderer型検査・Vite build・Prettier・git diff --check、ホスト回帰67/67成功。Watchウィジェットの開発版UI: `artifacts/widgets-ui-1791334419882`、発行版UI: `artifacts/widgets-ui-1791334637705`。DLL起動、全9通りの文字寄せの秒更新、2モニターの親と座標、フォーカス維持、移動/保存/取消、停止/再起動、テーマ/保存バーを確認。単一EXE+Watch DLLの隔離smoke: `artifacts/smoke-1791334645561/smoke-result.json`（ok=true）。Explorer強制再起動、実モニター着脱、RDP、長期常駐は今回も未検証。
- `publish/AppDock.at365.exe`: 100,512,630 bytes、SHA256 `5571AAF9B070E88F4DA9583AC08422FB5871F22538B894847399B596296AADED`。ローカルNode/pnpmと既存Electron/.NET host成果物で再発行。native bridge/APIとWatchソースに変更なし。
- ユーザーから完成後の`deploy.bat`実行指示を受け、実行直前のAppDock/ExtensionHostプロセス0件を確認してデプロイ。デプロイ先のProductVersion 0.10.2と発行元SHA256一致、settings.jsonの前後SHA256不変を確認。旧EXEと結果を`artifacts/widget-desktop-deployment-20261007-095802`へ退避。実利用のアプリは起動していない。外部公開/pushなし。

## 2026-10-07: ウィジェットの実利用確認・mainへ統合

- ユーザーがデプロイ済み0.10.2で正常動作を確認。ユーザーの指示により、AppDockの`codex/widgets`（e04584a）とWatchの`codex/widgets`（90b3e2e）を各`main`へfast-forwardで統合。マージ前後のGit treeが同一で、検証済みコードへの変更がないことを確認。
- 旧EXEのSHA256と配置済み0.10.2のSHA256を確認してから、今回の退避先`artifacts/widget-desktop-deployment-20261007-095802`の旧EXE・結果JSON・空フォルダーを削除し、消失を確認。以前のデプロイや別作業の退避物は対象外。
- 両リポジトリのマージ済み`codex/widgets`を削除。実利用先のEXE・設定・Applet、発行版には変更なし。外部公開/pushなし。

## 2026-10-07: テキスト入力のスペルチェックを無効化

- メイン画面とウィジェット画面の`webPreferences.spellcheck`をfalseにし、画面作成前に共有セッションも`setSpellCheckerEnabled(false)`で無効化。設定JSONへの追加・移行は不要。
- ローカルTypeScriptによるmainビルド・renderer型検査、Vite build成功。既存Electron/.NET host成果物からportable EXEを再発行。
- win-unpacked版の隔離起動で`session.isSpellCheckerEnabled() === false`とプロフィール欄への文字入力を確認。スクリーンショットでもスペルチェックの赤い下線がないことを確認。結果: `artifacts/spellcheck-1791347487183/result.json`。
- 完成した単一EXEの隔離smokeも成功: `artifacts/smoke-1791347529413/smoke-result.json`（ok=true）。この検証で実利用の設定やAppletは読み書きしていない。
- `publish/AppDock.at365.exe`: 100,512,311 bytes、SHA256 `91005CC49BC2501A9A5367E5DBB8BED5203D91EC327CA6C430049A9B4B3090BB`。AppDockプロセス0件を確認して実利用先へ配置し、発行元とのハッシュ一致とsettings.jsonの前後SHA256不変を確認。旧EXEは`artifacts/spellcheck-deployment-20261007-133309`へ退避。実利用アプリの再起動は行っていない。

## 2026-10-07: ダブルクリック判定時間の取得失敗時は既定500ms

- 取得失敗時の判定時間を5000msからWindowsの既定値500msへ変更。ログ側とDispatcher側で定数を共有し、正常時のOS設定値と既存の25ms余裕は維持。READMEとホスト開発ガイドを更新。
- 根拠: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setdoubleclicktime
- mainビルド・renderer型検査・Vite build、関連回帰10件、変更したTypeScript/テストのPrettier、git diff --check成功。回帰では取得失敗後の単一操作、ダブルクリックによる取消、メニュー/設定変更/終了時の取消を確認。
- portable発行と隔離smoke成功: artifacts/smoke-1791350201920/smoke-result.json。Watchの.NET拡張running、パネル/コマンド/設定保存を確認。
- 元の配布EXEの7zip一覧にはruntimeconfig/depsが存在するが、稼働中のTemp展開先には両JSONとPDBが欠けていた。起動済み.NET拡張は存在しており、起動後の消失が疑われる。削除原因は未特定。PCのMicrosoft.NETCore.App 10.0.12と発行元の判定時間取得340msを確認。
- ユーザーのdeploy依頼後、AppDock/ExtensionHostプロセス0件を確認して既存deploy.ps1で実利用先へ配置。SHA256 CF656034E722EC2B24FBC6D1EA86887BBA108D8688E553F9851F3AC2F89CC9AAが発行元と一致。settings.json不変。旧EXE退避: artifacts/tray-fallback-deployment-20261007-141726。実利用アプリの自動再起動は行っていない。
- 500msフォールバック修正版について、ユーザーがdeploy後の実利用で正常動作を確認（2026-10-07 JST）。設定ファイル消失の原因は引き続き未特定。
- ユーザーの依頼で今回の退避フォルダーartifacts/tray-fallback-deployment-20261007-141726を削除。旧EXE・配置結果JSONを照合後に削除し、空フォルダーも除去、消失を確認。実利用EXE/settings.jsonは削除前後のSHA256一致。他作業の退避物は対象外。
## 2026-10-07: v0.11.0 GmailChecker向けの共通通知API

- Node APIへファイル選択（JSON/WAV）、短いWAVの順次再生、Appletごとのトレイattention、デスクトップ通知のsilent/クリックコマンドを追加。既存API v1/.NET呼出しは維持。停止・異常終了でattentionを解除し、音声は起動世代を確認して中止する。
- main/rendererのTypeScript型検査・Vite build成功。ホスト回帰70/70（既存67＋追加3）成功。Gmail側は16/16。既存Node/.NETの実プロセス起動・異常終了・再起動の回帰も成功。
- 実Electronで暗号化fixtureとGmail AppletのNode workerを接続し、新着表示、クリア、監視切替、削除取消、WAV選択、無音WAV再生、設定保持、停止を確認。発行版の結果は`../Applet.GmailChecker.at365/artifacts/ui-1791355520145/result.json`。通常幅/900px幅の画面を目視確認。
- 完成したportable EXEと未改変のAppletでも、初回案内、設定、消音、無効化/再有効化、終了コード0を確認。結果は`../Applet.GmailChecker.at365/artifacts/portable-1791355697468/result.json`。
- .NETホストを既存build-dotnet手順でクリーン発行し、ローカルElectronからportableを作成。単独electron-builder実行はpnpm PATH不足で失敗したが、dev.bat経由で成功。EXE SHA256: `4A6B3D6DBD4302C7A6A3015731344E8795CE7473CC760909EBB580F9C89F4275`。
- Gmail Appletを開発用publish/extensionsに配置し、5ファイルのハッシュ一致を確認。実利用先へのdeploy・外部pushは実施していない。実Google OAuth/新着、Windows通知の実表示とクリック、実音の聴感、スリープ復帰・長時間常駐は未確認。
