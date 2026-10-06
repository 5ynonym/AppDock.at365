import { useState } from 'react';
import type { ExtensionSnapshot, Settings } from '../shared/contracts';
import { ShortcutListSetting } from './ShortcutListSetting';

/** The host draft stays above this component, so filtering never discards edits. */
export function AppletSettings({
  applet,
  draft,
  onChange,
}: {
  applet: ExtensionSnapshot;
  draft: Settings;
  onChange(value: Settings): void;
}) {
  const [filter, setFilter] = useState('');
  const definitions = (applet.settings ?? []).filter((item) =>
    `${item.title} ${item.description ?? ''} ${item.key}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  return (
    <div className="applet-settings">
      <div className="setting-row">
        <div>
          <strong>開始までの秒数</strong>
          <p>
            有効化・再起動からAppletを起動するまで待ちます。0で即時開始。実行中の変更は次の起動から適用します。
          </p>
        </div>
        <input
          aria-label="開始までの秒数"
          type="number"
          min={0}
          max={86400}
          step={1}
          value={
            draft.extensions[applet.id]?.startupDelaySeconds ?? applet.startupDelaySeconds ?? 0
          }
          onChange={(event) =>
            onChange({
              ...draft,
              extensions: {
                ...draft.extensions,
                [applet.id]: {
                  ...(draft.extensions[applet.id] ?? { enabled: false, settings: {} }),
                  startupDelaySeconds:
                    event.target.value === '' ? Number.NaN : Number(event.target.value),
                },
              },
            })
          }
        />
      </div>
      <input
        className="shortcut-filter"
        aria-label="Appletの設定項目を検索"
        placeholder="設定項目を検索…"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      {!definitions.length && (
        <p className="empty">
          {applet.settings?.length
            ? '該当する設定項目はありません。'
            : 'このAppletには設定項目がありません。'}
        </p>
      )}
      {definitions.map((item) => {
        const value = draft.extensions[applet.id]?.settings[item.key] ?? item.default;
        const set = (next: unknown) =>
          onChange({
            ...draft,
            extensions: {
              ...draft.extensions,
              [applet.id]: {
                ...(draft.extensions[applet.id] ?? { enabled: false, settings: {} }),
                settings: { ...draft.extensions[applet.id]?.settings, [item.key]: next },
              },
            },
          });
        const options = applet.settingOptions[item.key] ?? item.options ?? [];
        const descriptionId = `setting-help-${applet.id}-${item.key}`;
        return (
          <div className="setting-row" key={item.key}>
            <div>
              <strong>{item.title}</strong>
              <p id={descriptionId}>{item.description}</p>
            </div>
            {item.type === 'json' ? (
              <textarea
                aria-label={item.title}
                aria-describedby={descriptionId}
                rows={12}
                value={String(value ?? '')}
                onChange={(event) => set(event.target.value)}
              />
            ) : item.type === 'shortcut-list' ? (
              <ShortcutListSetting title={item.title} value={value} onChange={set} />
            ) : item.type === 'boolean' ? (
              <button
                className="toggle"
                role="switch"
                aria-label={item.title}
                aria-describedby={descriptionId}
                aria-checked={Boolean(value)}
                onClick={() => set(!value)}
              >
                <span />
              </button>
            ) : item.type === 'select' ? (
              <select
                aria-label={item.title}
                aria-describedby={descriptionId}
                value={String(value ?? '')}
                onChange={(event) => set(event.target.value)}
              >
                {!options.some((option) => option.value === value) && value !== undefined && (
                  <option value={String(value)}>
                    保存された選択（現在利用できません）: {String(value)}
                  </option>
                )}
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-label={item.title}
                aria-describedby={descriptionId}
                type={item.type === 'number' ? 'number' : 'text'}
                min={item.minimum}
                max={item.maximum}
                step={item.step ?? 'any'}
                value={String(value ?? '')}
                onChange={(event) =>
                  set(
                    item.type === 'number'
                      ? event.target.value === ''
                        ? ''
                        : Number(event.target.value)
                      : event.target.value,
                  )
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
