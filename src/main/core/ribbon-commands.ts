import type { Settings, SettingsSnapshot, ExtensionSnapshot } from '../../shared/contracts';
import {
  defaultRibbon,
  parseRibbon,
  ribbonItems,
  orderRibbon,
  validRibbonId,
  validSeparatorId,
} from '../../shared/applet-pages';
import type { SettingsStore } from './settings';
import { SettingsCommands, SettingsCommandError } from './settings-commands';
import type { AutomationCommand } from './automation-commands';

type Layout = Settings['ribbon'];
const commandId = 'appdock.ribbon.update';
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> =>
  object(v) && Object.keys(v).every((k) => keys.includes(k));
const invalid = () =>
  new SettingsCommandError('INVALID_ARGUMENT', 'リボンの操作・ID・配置・順序を確認してください。');
const idSchema = {
  type: 'string',
  minLength: 1,
  maxLength: 190,
  description: 'ribbon.getで取得したリボンID。コマンドIDではありません。',
};
const placementSchema = { type: 'string', enum: ['top', 'bottom'] };
const operation = (kind: string, properties: Record<string, unknown>) => ({
  type: 'object',
  properties: { kind: { const: kind }, ...properties },
  required: ['kind', ...Object.keys(properties)],
  additionalProperties: false,
});
// Limit external reads to the documented fields, retaining extra local fields on save.
const layoutOf = (settings: Settings): Layout => {
  const { order, hidden, bottom, separators } = settings.ribbon;
  return structuredClone({ order, hidden, bottom, separators });
};
export class RibbonCommands {
  constructor(
    private options: {
      settings: SettingsStore;
      settingsCommands: SettingsCommands;
      save(value: Settings, revision: number): SettingsSnapshot;
      ribbonApplets?(): ExtensionSnapshot[];
    },
  ) {}
  commands(): AutomationCommand[] {
    return [
      {
        id: commandId,
        title: 'リボン設定を変更',
        appletId: null,
        available: true,
        unavailableReason: null,
        completion: 'settingsSaved',
        permission: 'ribbon.write',
        inputSchema: {
          type: 'object',
          properties: {
            expectedRevision: { type: 'string', description: 'ribbon.getで取得したrevision' },
            dryRun: { type: 'boolean', description: '保存せず結果を検証する' },
            operations: {
              type: 'array',
              minItems: 1,
              maxItems: 100,
              items: {
                oneOf: [
                  operation('update', {
                    id: idSchema,
                    changes: {
                      type: 'object',
                      properties: { visible: { type: 'boolean' }, placement: placementSchema },
                      minProperties: 1,
                      additionalProperties: false,
                    },
                  }),
                  operation('reorder', {
                    placement: placementSchema,
                    ids: {
                      type: 'array',
                      items: idSchema,
                      maxItems: 500,
                      uniqueItems: true,
                      description:
                        '指定配置の全itemsのID。非表示/無効Appletも含む。retainedIdsは含めない。',
                    },
                  }),
                  operation('addSeparator', {
                    id: {
                      type: 'string',
                      pattern: '^separator:[a-z0-9][a-z0-9-]{0,79}$',
                      description: '一意なseparator:<stable-id>',
                    },
                    placement: placementSchema,
                  }),
                  operation('removeSeparator', { id: idSchema }),
                  operation('reset', {}),
                ],
              },
            },
          },
          required: ['expectedRevision', 'operations'],
          additionalProperties: false,
        },
      },
    ];
  }
  private catalog(layout: Layout) {
    return orderRibbon(
      ribbonItems(this.options.ribbonApplets?.() ?? [], layout.separators),
      layout.order,
    );
  }
  private describe(layout: Layout) {
    const applets = this.options.ribbonApplets?.() ?? [];
    const items = this.catalog(layout).map((item) => {
      const enabled = item.extensionId
        ? applets.find((a) => a.id === item.extensionId)?.enabled === true
        : true;
      const visible = !layout.hidden.includes(item.id);
      return {
        id: item.id,
        title: item.title,
        kind: item.kind === 'separator' ? 'separator' : item.extensionId ? 'page' : 'builtin',
        appletId: item.extensionId ?? null,
        pageId: item.pageId ?? null,
        placement: layout.bottom.includes(item.id) ? 'bottom' : 'top',
        visible,
        enabled,
        displayed: visible && enabled,
      };
    });
    return {
      layout,
      items,
      retainedIds: [...new Set([...layout.order, ...layout.hidden, ...layout.bottom])].filter(
        (id) => !items.some((i) => i.id === id),
      ),
    };
  }
  get() {
    return {
      ...this.describe(layoutOf(this.options.settings.value)),
      revision: this.options.settingsCommands.revision(),
      warning: this.options.settings.syncError ?? null,
    };
  }
  private ordered(layout: Layout, ids: string[]) {
    const known = new Set(this.catalog(layout).map((i) => i.id));
    return [...ids, ...layout.order.filter((id) => !known.has(id))];
  }
  execute(args: unknown) {
    if (
      !exact(args, ['operations', 'expectedRevision', 'dryRun']) ||
      typeof args.expectedRevision !== 'string' ||
      !Array.isArray(args.operations) ||
      !args.operations.length ||
      args.operations.length > 100 ||
      (args.dryRun !== undefined && typeof args.dryRun !== 'boolean')
    )
      throw invalid();
    this.options.settingsCommands.checkRevision(args.expectedRevision);
    const store = this.options.settings,
      before = layoutOf(store.value);
    let next = structuredClone(before);
    try {
      for (const op of args.operations) {
        if (!object(op)) throw invalid();
        const items = this.catalog(next),
          ids = items.map((i) => i.id),
          placement = (id: string) => (next.bottom.includes(id) ? 'bottom' : 'top');
        if (op.kind === 'update') {
          if (
            !exact(op, ['kind', 'id', 'changes']) ||
            !validRibbonId(op.id) ||
            !exact(op.changes, ['visible', 'placement']) ||
            !Object.keys(op.changes).length
          )
            throw invalid();
          if (!ids.includes(op.id))
            throw new SettingsCommandError(
              'NOT_FOUND',
              '現在登録されているリボン項目ではありません。',
            );
          const c = op.changes;
          if (
            (c.visible !== undefined && typeof c.visible !== 'boolean') ||
            (c.placement !== undefined && !['top', 'bottom'].includes(c.placement as string))
          )
            throw invalid();
          if (c.visible !== undefined && c.visible === next.hidden.includes(op.id))
            next.hidden = [
              ...next.hidden.filter((id) => id !== op.id),
              ...(c.visible ? [] : [op.id]),
            ];
          if (c.placement !== undefined && c.placement !== placement(op.id)) {
            next.order = this.ordered(next, [...ids.filter((id) => id !== op.id), op.id]);
            next.bottom = [
              ...next.bottom.filter((id) => id !== op.id),
              ...(c.placement === 'bottom' ? [op.id] : []),
            ];
          }
        } else if (op.kind === 'reorder') {
          if (
            !exact(op, ['kind', 'placement', 'ids']) ||
            !['top', 'bottom'].includes(op.placement as string) ||
            !Array.isArray(op.ids) ||
            op.ids.length > 500 ||
            op.ids.some((id) => !validRibbonId(id))
          )
            throw invalid();
          const group = ids.filter((id) => placement(id) === op.placement),
            ordered = op.ids as string[];
          if (
            group.length !== ordered.length ||
            new Set(ordered).size !== ordered.length ||
            ordered.some((id) => !group.includes(id))
          )
            throw invalid();
          if (JSON.stringify(group) !== JSON.stringify(ordered)) {
            let index = 0;
            next.order = this.ordered(
              next,
              ids.map((id) => (placement(id) === op.placement ? ordered[index++] : id)),
            );
          }
        } else if (op.kind === 'addSeparator') {
          if (
            !exact(op, ['kind', 'id', 'placement']) ||
            !validSeparatorId(op.id) ||
            !['top', 'bottom'].includes(op.placement as string) ||
            next.separators.includes(op.id)
          )
            throw invalid();
          next.order = this.ordered(next, [...ids, op.id]);
          next.separators.push(op.id);
          if (op.placement === 'bottom') next.bottom.push(op.id);
        } else if (op.kind === 'removeSeparator') {
          if (!exact(op, ['kind', 'id']) || !validSeparatorId(op.id)) throw invalid();
          if (!next.separators.includes(op.id))
            throw new SettingsCommandError('NOT_FOUND', '指定された区切り線がありません。');
          for (const key of ['order', 'hidden', 'bottom', 'separators'] as const)
            next[key] = next[key].filter((id) => id !== op.id);
        } else if (op.kind === 'reset') {
          if (!exact(op, ['kind'])) throw invalid();
          next = defaultRibbon();
        } else throw invalid();
        next = parseRibbon(next);
      }
    } catch (error) {
      if (error instanceof SettingsCommandError) throw error;
      throw invalid();
    }
    const changed = JSON.stringify(before) !== JSON.stringify(next);
    if (changed && args.dryRun !== true) {
      try {
        this.options.save(
          {
            ...structuredClone(store.value),
            ribbon: { ...structuredClone(store.value.ribbon), ...next },
          },
          store.revision,
        );
      } catch {
        throw new SettingsCommandError(
          'SAVE_FAILED',
          'リボンを保存できませんでした。設定を再取得して確認してください。',
        );
      }
    }
    return {
      ...this.describe(next),
      dryRun: args.dryRun === true,
      changed,
      revision: this.options.settingsCommands.revision(),
      warning: store.syncError ?? null,
      applies: 'ribbonChanged',
      message: 'リボン設定を反映します。Appletの有効状態や起動状態は変更しません。',
    };
  }
}
