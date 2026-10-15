import { useRef, useState } from 'react';
import type { SettingDefinition, SettingOption } from '../contracts';
import { normalizeObject, objectFieldValue, readObjectList, setObjectField } from '../object-list';
import { validateSettingValue } from '../setting-definitions';
import { SettingsDialog } from './SettingsModal';
import { SettingsInput, SettingsUrlInput, SettingsTextarea, numberInput } from './SettingsInput';
import { SettingsListTable, ListIcon } from './SettingsListTable';

export function ObjectListDialogSetting({
  definition,
  value,
  options = {},
  onCommit,
  onOpen,
}: {
  definition: SettingDefinition;
  value: unknown;
  options?: Record<string, SettingOption[]>;
  onCommit(value: Record<string, unknown>[], before: Record<string, unknown>[]): Promise<unknown>;
  onOpen?(entry: Record<string, unknown>): Promise<unknown>;
}) {
  let entries: Record<string, unknown>[] = [],
    loadError = '';
  try {
    entries = readObjectList(value ?? definition.default ?? []);
  } catch {
    loadError = '保存された一覧を読み取れません。JSON設定を確認してください。';
  }
  const view = definition.list!,
    fields = definition.fields ?? [];
  const [dialog, setDialog] = useState<{
    kind: 'edit' | 'delete' | 'order';
    index: number;
    before: Record<string, unknown>[];
    draft: Record<string, unknown>;
    order: number[];
  } | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const running = useRef(false),
    drag = useRef<number | null>(null);
  const commit = async (next: Record<string, unknown>[], before: Record<string, unknown>[]) => {
    if (running.current) throw Error('保存の完了を待ってください。');
    running.current = true;
    setPending(true);
    setError('');
    try {
      validateSettingValue(definition, next);
      await onCommit(next, before);
    } finally {
      running.current = false;
      setPending(false);
    }
  };
  const immediate = (next: Record<string, unknown>[]) =>
    void commit(next, entries).catch((e) => setError(String(e.message ?? e)));
  const open = (kind: 'edit' | 'delete' | 'order', index = -1) => {
    const draft = structuredClone(index < 0 ? normalizeObject({}, fields) : entries[index]);
    if (index < 0 && view.idKey) draft[view.idKey] = crypto.randomUUID();
    if (index < 0)
      for (const field of fields)
        if (field.optionSource && options[field.key]?.length)
          setObjectField(draft, field, options[field.key][0].value);
    setDialog({
      kind,
      index,
      before: structuredClone(entries),
      draft,
      order: entries.map((_, i) => i),
    });
  };
  const update = (field: SettingDefinition, next: unknown) => {
    if (!dialog) return;
    const draft = structuredClone(dialog.draft);
    setObjectField(draft, field, next);
    setDialog({ ...dialog, draft });
  };
  const move = (from: number, to: number) => {
    if (!dialog || to < 0 || to >= dialog.order.length) return;
    const order = [...dialog.order],
      [item] = order.splice(from, 1);
    order.splice(to, 0, item);
    setDialog({ ...dialog, order });
  };
  if (loadError) return <p role="alert">{loadError}</p>;
  return (
    <>
      <SettingsListTable
        definition={definition}
        entries={entries}
        options={options}
        busy={pending}
        extra={onOpen ? (entry) => <button type="button" className="settings-list-icon" title="開く" aria-label={`${String(entry[view.titleKey])}を開く`} disabled={!entry.enabled || pending} onClick={() => void onOpen(entry).catch((error) => setError(String(error.message ?? error)))}><ListIcon kind="open"/></button> : undefined}
        onAdd={() => open('edit')}
        onEdit={(i) => open('edit', i)}
        onOrder={() => open('order')}
        onDelete={(i) =>
          view.confirmDelete ? open('delete', i) : immediate(entries.filter((_, n) => n !== i))
        }
        onToggle={(i) =>
          immediate(
            entries.map((entry, n) =>
              n === i ? { ...entry, [view.enabledKey!]: !entry[view.enabledKey!] } : entry,
            ),
          )
        }
      />
      {error && <p role="alert">{error}</p>}
      {dialog && (
        <SettingsDialog
          title={
            dialog.kind === 'order'
              ? `${definition.title}の並べ替え`
              : `${definition.itemTitle ?? '項目'}を${dialog.kind === 'delete' ? '削除' : dialog.index < 0 ? '追加' : '編集'}`
          }
          onClose={() => setDialog(null)}
          applyLabel={dialog.kind === 'delete' ? '削除' : 'OK'}
          onApply={async () => {
            const next =
              dialog.kind === 'order'
                ? dialog.order.map((i) => dialog.before[i])
                : dialog.kind === 'delete'
                  ? dialog.before.filter((_, i) => i !== dialog.index)
                  : dialog.index < 0
                    ? [...dialog.before, dialog.draft]
                    : dialog.before.map((entry, i) => (i === dialog.index ? dialog.draft : entry));
            await commit(next, dialog.before);
          }}
        >
          {dialog.kind === 'delete' ? (
            <p>
              「{String(dialog.draft[view.titleKey])}
              」を削除します。関連するアカウントやログイン情報は削除しません。
            </p>
          ) : dialog.kind === 'order' ? (
            <>
              <p>一覧の表示順を変更します。</p>
              <ol>
                {dialog.order.map((index, position) => (
                  <li
                    key={index}
                    draggable
                    onDragStart={() => {
                      drag.current = position;
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (drag.current !== null) move(drag.current, position);
                      drag.current = null;
                    }}
                  >
                    <span aria-hidden="true">⠿ </span>
                    {String(dialog.before[index][view.titleKey])}
                    <button
                      disabled={!position}
                      aria-label={`${position + 1}番目を上へ`}
                      onClick={() => move(position, position - 1)}
                    >
                      ↑
                    </button>
                    <button
                      disabled={position === dialog.order.length - 1}
                      aria-label={`${position + 1}番目を下へ`}
                      onClick={() => move(position, position + 1)}
                    >
                      ↓
                    </button>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            fields
              .filter((field) => field.key !== view.idKey)
              .map((field) => {
                const current = objectFieldValue(dialog.draft, field),
                  choices = options[field.key] ?? field.options ?? [];
                return (
                  <label key={field.key} className="settings-list-editor-field">
                    {field.title}
                    {field.type === 'boolean' ? (
                      <input
                        type="checkbox"
                        checked={Boolean(current)}
                        onChange={(e) => update(field, e.target.checked)}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        aria-label={field.title}
                        value={String(current ?? '')}
                        onChange={(e) => update(field, e.target.value)}
                      >
                        {!choices.some((choice) => choice.value === current) && (
                          <option value={String(current ?? '')}>
                            {current ? `現在の値: ${current}` : '選択してください'}
                          </option>
                        )}
                        {choices.map((choice) => (
                          <option key={choice.value} value={choice.value}>
                            {choice.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'string-list' ? (
                      <SettingsTextarea
                        aria-label={field.title}
                        value={((current as string[]) ?? []).join('\n')}
                        onChange={(e) => update(field, e.target.value.split('\n').filter(Boolean))}
                      />
                    ) : field.format === 'url' ? (
                      <SettingsUrlInput
                        aria-label={field.title}
                        value={String(current ?? '')}
                        onChange={(e) => update(field, e.target.value.trim())}
                      />
                    ) : (
                      <SettingsInput
                        aria-label={field.title}
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={String(current ?? '')}
                        onChange={(e) =>
                          update(
                            field,
                            field.type === 'number' ? numberInput(e.target.value) : e.target.value,
                          )
                        }
                      />
                    )}
                    {field.description && <small>{field.description}</small>}
                  </label>
                );
              })
          )}
        </SettingsDialog>
      )}
    </>
  );
}
