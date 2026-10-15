import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { LegacyLocalDataState } from '../../shared/legacy-local-data';
import { legacyLocalDataInstructions } from '../../shared/legacy-local-data';
import type { WarningReporter, WarningEpisode } from './warning-reporter';
import type { NotificationInput } from './notification-service';

const legacyNames = ['chromium', 'web-accounts', 'storage', 'secrets', 'web-applets/sessions'];
/** Inspect fixed legacy locations, including empty directories; never read or mutate their contents. */
export function inspectLegacyLocalData(
  base: string,
  shared: string,
  local: string,
): LegacyLocalDataState {
  const state: LegacyLocalDataState = { targets: [], scanFailed: false };
  if (path.resolve(shared).toLowerCase() === path.resolve(local).toLowerCase()) return state;
  for (const root of [shared, path.join(base, '.appdock')]) {
    for (const name of legacyNames) {
      const target = path.resolve(root, name);
      try {
        fs.lstatSync(target);
        state.targets.push(target);
      } catch (error) {
        if (!['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? ''))
          state.scanFailed = true;
      }
    }
  }
  return state;
}

export class LegacyLocalDataMonitor {
  private state: LegacyLocalDataState = { targets: [], scanFailed: false };
  private warning?: { id: string; episode: WarningEpisode };
  private timer?: ReturnType<typeof setInterval>;
  private closed = false;
  constructor(
    private options: {
      inspect(): LegacyLocalDataState;
      warnings: WarningReporter;
      actions: NotificationInput['actions'];
      changed(): void;
    },
  ) {}
  snapshot(): LegacyLocalDataState {
    return structuredClone(this.state);
  }
  refresh = () => {
    if (this.closed) return;
    let next: LegacyLocalDataState;
    try {
      next = this.options.inspect();
    } catch {
      next = { targets: [], scanFailed: true };
    }
    // An unreadable path is not evidence that previously detected data has gone away.
    if (next.scanFailed) next.targets = [...new Set([...this.state.targets, ...next.targets])];
    const changed = JSON.stringify(next) !== JSON.stringify(this.state);
    this.state = next;
    if (next.targets.length || next.scanFailed) {
      this.warning ??= { id: randomUUID(), episode: this.options.warnings.episode() };
      this.warning.episode.update(
        {
          eventId: this.warning.id,
          source: 'storage',
          title: '旧保存領域の確認が必要です',
          code: next.scanFailed ? 'LEGACY_LOCAL_DATA_UNREADABLE' : 'LEGACY_LOCAL_DATA',
          message: [
            next.targets.length ? `旧PC専用データを${next.targets.length}か所検出しました。` : '',
            next.scanFailed
              ? '一部の旧保存先を確認できません。アクセス権と保存先を確認してください。'
              : '',
            '対象は「設定 → 一般 → 旧PC専用データ」と本体ログで確認できます。',
            legacyLocalDataInstructions,
          ]
            .filter(Boolean)
            .join('\n'),
          logDetails: next.targets.map((target) => `整理対象: ${target}`),
        },
        this.options.actions,
      );
    } else {
      this.warning?.episode.resolve();
      this.warning = undefined;
    }
    if (changed) this.options.changed();
  };
  start() {
    if (this.timer) return;
    this.refresh();
    this.timer = setInterval(this.refresh, 2000);
    this.timer.unref();
  }
  dispose() {
    this.closed = true;
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
