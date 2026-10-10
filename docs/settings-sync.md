# 設定同期と保存領域（0.26.14以降）

利用者向けの入口は[README](../README.md#設定とデータの保存先)。単一EXEの配布方式は維持し、同期できる登録データとPC専用の実行状態を分離する。

## 保存先

0.26.16から共有フォルダー名は小文字の`data`。旧`.appdock`の自動改名・移行・削除は行わない。古いアバター参照は読み取り互換として許可するが、新規登録は`data/assets/profile`へ保存する。

今後追加するAppletにもこの保存境界を適用する。同期する設定はホストSettings、登録原素材はEXE隣のApplet別assetsを使う。端末固有のStorage/Secrets/認証/生成キャッシュはホストのPC専用root内でApplet IDごとに分離する。

0.26.15からはドメイン名のat365配下に保存する。`data-paths.ts`はEXE配置先の絶対パスを小文字化してSHA256を計算し、`%LOCALAPPDATA%/at365/AppDock/profiles/<配置ID>/`をPC専用rootにする。配置が同じなら更新・再起動で同じrootを使う。配置先を変えると新しいrootになり、ログインをやり直す。IDとパスの対応表や追加のprofile manifestは持たない。

EXE隣の`settings.json`と`data/`の共有アカウント名簿・登録素材は同期対象。WebApplet名簿は`data/web-applets/accounts.json`の`schemaVersion/accounts`だけを共有する。Gmail等の`web-accounts/<Applet ID>/accounts.json`、全session、Chromium、secrets、storage、ページ/Window状態、ログ、更新journal/result、設定backupはPC専用rootに保存する。Gmail全体の設定・キーはsettings.jsonに残し、枠の名前・ID・選択・枠別監視・通知音割当だけをPC内に置く。

旧.appdockからのPC専用データの移行・削除は実装しないというユーザー指定。旧chromium/web-accounts/storage/secrets/web-applets/sessionsが残る場合は警告する。同期を始める前に完全終了して旧保存データを整理する。既存settings.jsonの読み取り互換性と、従来からある名簿の旧フィールド読み取りとは区別する。

## ファイル名を使う登録素材

- アバター原画像: `data/assets/profile/<元ファイル名>`。PNG/JPEG、5MB以下、従来の画像寸法上限を検証する。settingsにはこの相対パスを保存。表示名との対応表は不要。画像を外しても登録原画像を削除しない。
- Appletの通知音: `data/assets/applets/<Applet ID>/sounds/<元ファイル名>`。Gmailは`at365.gmail`。既存の16MB以下WAV検証を使い、512件まで登録する。ローカル枠の`{enabled,file}`のfileはファイル名だけ。保存された絶対パスをそのまま共有しない。
- 同一フォルダー内の大文字小文字を無視した同名照合を行う。同名同内容は既存素材を再利用、同名別内容は登録拒否。上書き・連番生成をしない。新規ファイルはexclusive create。登録元・用途の別フォルダーでは同名を使用できる。
- ファイル名はWindowsの禁止文字/予約名/末尾の空白・点/パス区切りを拒否し、登録rootから外れる参照や転送root/ファイルを受け入れない。任意パスをローカルUIの一覧選択から渡さない。
- 一覧は実ファイルから生成し、インデックスJSONやID対応表を作らない。Gmailのsnapshot.registeredSoundsはローカルUIだけに渡す。Node readへ素材一覧を含めない。枠の削除・停止時に共有素材を自動pruneしない。
- 素材だけ届く変更も監視する。Gmailの登録済み一覧は2秒ごとに照合。アバターは内容hashで表示URLを更新し、settingsが先に届いて素材が後から来ても表示を回復する。

## 設定と名簿の受信

`file-observer.ts`は親フォルダーのwatchと2秒のpollを併用する。イベント後100msから読み、同じbytesを180ms隔てて2回確認してから検証・反映する。途中JSON/一時的削除/ロック/通知欠落は直近正常値を維持して再照合する。同じ内容は再適用せず、受信ファイルを整形して書き戻さない。名簿とsettingsの到着順が違う場合は不足枠を同期待ちとして表示する。名簿未到着の起動時は空の共有accounts.jsonを生成せず、設定に既存枠の参照がある間は追加操作も待機させる。

SettingsStoreのchanged経由でホスト/キー/トレイ/WebApplet/実行中Appletへ適用する。useSettingsEditorのdirty draftは外部受信で消さず、revision違いの保存を拒否する。hardwareAcceleration等の起動専用項目、Windows起動タスクの明示保存契約は維持する。

WebProfileStoreのpendingDeletionはPC専用の別ファイル。共有名簿の外部削除は対象Viewを閉じるが、このPCのCookieの物理削除を予約しない。明示的なこのPCでの枠削除だけが当該PCの保存領域を回収する。回収で共有accounts.jsonを書き換えない。

## 正常設定のバックアップ

PC専用`settings-backups/`へ検証済み設定を保存し、`last-good.json`と直近20世代を保持する。同値は追加しない。破損・欠落状態からの起動では最新の読み取り可能な正常世代で継続し、共有ファイルはそのまま残す。正常設定が届けば復旧状態を解除する。バックアップ初回未作成で壊れた場合は従来通り起動エラー。

「バックアップで復元」は警告dialogで同期先にも届くことを確認する。直前に正常ファイルが到着していれば復元を中止し、その設定を採用する。復元前の破損bytesはローカルのinvalid-*.txtへ退避する。4MBを超える異常なファイルの退避は手動とする。バックアップ保存失敗は成功した設定保存と区別して表示する。

## 検証と制約

`tests/settings-sync.test.cjs`と`tests/registered-sounds.test.cjs`、updaterのローカルjournal復旧回帰、`scripts/settings-sync-ui-test.cjs`で検証する。GUIスクリプトは2個の隔離配置にファイルを配達して実挙動を確認し、単一EXE引数でも同じ手順を使う。`--test-profile`の既存隔離テストは従来のrootを維持し、新仕様の検証には配置内の`--test-local-state=<絶対パス>`を追加する。EXE引数の後ろへ`--production-path`を付ける試験ではtest-profileを使わず、fixture内にLOCALAPPDATAを向けて通常起動のat365保存先を検証する。実利用LOCALAPPDATAへテスト用のログイン領域を作らない。

この実装はファイル同期サービスを設定・代行しない。2台の未同期同時編集を自動mergeする保証はなく、受信した正常ファイルを適用する。2台で同名別素材を同時に登録するケースも同期サービスの競合になるため、別名での登録や競合コピーの確認が必要。バックアップでJSONの内容を回復できるが、PC間認証の移行・実Google認証・実同期サービスの動作保証とは別。
