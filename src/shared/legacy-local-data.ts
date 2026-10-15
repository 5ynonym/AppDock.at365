/** Local UI diagnostics only; never part of synchronized settings or external APIs. */
export interface LegacyLocalDataState {
  targets: string[];
  scanFailed: boolean;
}
export const legacyLocalDataInstructions =
  '同期する前にAppDockを完全終了し、必要なデータをバックアップしてから、表示された旧PC専用データだけを整理してください。旧ログイン情報は引き継がれません。settings.json、data全体、登録素材、共有名簿、現在のPC専用保存先は削除しないでください。自動移行・削除は行いません。';
