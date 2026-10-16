import type { Settings, SettingsSnapshot, ExtensionSnapshot } from '../../shared/contracts';
import { ribbonItems, orderRibbon } from '../../shared/applet-pages';
import type { SettingsStore } from './settings';
import { SettingsCommands, SettingsCommandError } from './settings-commands';
import type { AutomationCommand } from './automation-commands';
import {
  editRibbon,
  RibbonLayoutError,
  ribbonParent,
  ribbonPlacement,
  ribbonVisible,
  ribbonRetainedIds,
  ribbonPresentation,
} from '../../shared/ribbon-layout';
import { ribbonGroupIcons } from '../../shared/ribbon';

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
const operation = (kind: string, properties: Record<string, unknown>, optional: string[] = []) => ({
  type: 'object',
  properties: { kind: { const: kind }, ...properties },
  required: ['kind', ...Object.keys(properties).filter((key) => !optional.includes(key))],
  additionalProperties: false,
});
// Limit external reads to the documented fields, retaining extra local fields on save.
const layoutOf = (settings: Settings): Layout => {
  const { order, hidden, bottom, separators, groups = [], itemOverrides = {} } = settings.ribbon;
  return structuredClone({ order, hidden, bottom, separators, groups, itemOverrides });
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
                      maxItems: 550,
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
                  operation('removeMissing', { id: idSchema }),
                  operation('updateItem', {
                    id: idSchema,
                    changes: {
                      type: 'object',
                      minProperties: 1,
                      additionalProperties: false,
                      properties: {
                        title: { type: 'string', maxLength: 80 },
                        iconOnly: { type: 'boolean' },
                      },
                    },
                  }),
                  operation(
                    'addGroup',
                    {
                      id: idSchema,
                      title: { type: 'string', maxLength: 80 },
                      icon: { enum: ribbonGroupIcons },
                      expansion: { enum: ['persistent', 'temporary'] },
                      placement: placementSchema,
                      iconOnly: { type: 'boolean' },
                    },
                    ['iconOnly'],
                  ),
                  operation('updateGroup', {
                    id: idSchema,
                    changes: {
                      type: 'object',
                      minProperties: 1,
                      additionalProperties: false,
                      properties: {
                        title: { type: 'string', maxLength: 80 },
                        icon: { enum: ribbonGroupIcons },
                        expansion: { enum: ['persistent', 'temporary'] },
                        iconOnly: { type: 'boolean' },
                      },
                    },
                  }),
                  operation('ungroup', { id: idSchema }),
                  operation('reorderChildren', {
                    id: idSchema,
                    ids: { type: 'array', maxItems: 500, uniqueItems: true, items: idSchema },
                  }),
                  {
                    type: 'object',
                    additionalProperties: false,
                    required: ['kind', 'id', 'parentId', 'beforeId'],
                    properties: {
                      kind: { const: 'moveItem' },
                      id: idSchema,
                      parentId: { anyOf: [idSchema, { type: 'null' }] },
                      beforeId: { anyOf: [idSchema, { type: 'null' }] },
                      placement: placementSchema,
                    },
                  },
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
      ribbonItems(this.options.ribbonApplets?.() ?? [], layout.separators, layout.groups),
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
        title: ribbonPresentation(layout, item).title,
        kind: item.kind ?? (item.extensionId ? 'page' : 'builtin'),
        appletId: item.extensionId ?? null,
        pageId: item.pageId ?? null,
        parentId: ribbonParent(layout, item.id)?.id ?? null,
        placement: ribbonPlacement(layout, item.id),
        visible,
        enabled,
        displayed: ribbonVisible(layout, item.id) && enabled,
      };
    });
    return {
      layout,
      items,
      retainedIds: ribbonRetainedIds(layout, this.catalog(layout)),
    };
  }
  get() {
    return {
      ...this.describe(layoutOf(this.options.settings.value)),
      revision: this.options.settingsCommands.revision(),
      warning: this.options.settings.syncError ?? null,
    };
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
        next = editRibbon(next, this.catalog(next), op);
      }
    } catch (error) {
      if (error instanceof SettingsCommandError) throw error;
      if (error instanceof RibbonLayoutError)
        throw new SettingsCommandError(error.code, error.message);
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
