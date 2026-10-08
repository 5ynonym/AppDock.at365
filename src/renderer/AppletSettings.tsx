import { useRef, useState } from 'react';
import type { ExtensionSnapshot, Settings } from '../shared/contracts';
import { ShortcutListSetting } from './ShortcutListSetting';
import { ObjectListSetting } from './ObjectListSetting';

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
  const executing = useRef(false);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [result, setResult] = useState<{ command: string; message: string; error: boolean } | null>(
    null,
  );
  const actions = (applet.settingActions ?? []).filter((item) =>
    `${item.title} ${item.description ?? ''}`.toLowerCase().includes(filter.toLowerCase()),
  );
  const executeAction = async (item: NonNullable<ExtensionSnapshot['settingActions']>[number]) => {
    if (executing.current) return;
    executing.current = true;
    setRunningAction(item.command);
    setResult(null);
    try {
      await window.dock.executeCommand(item.command);
      setResult({
        command: item.command,
        message: item.successMessage ?? '実行しました。',
        error: false,
      });
    } catch (error) {
      setResult({ command: item.command, message: String(error), error: true });
    } finally {
      executing.current = false;
      setRunningAction(null);
    }
  };
  const definitions = (applet.settings ?? []).filter((item) =>
    `${item.title} ${item.description ?? ''} ${item.key}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  return (
    <div className="applet-settings">
      {(applet.pages ?? []).map((page) => (
        <div className="setting-row" key={`page-${page.id}`}>
          <div>
            <strong>{page.title}の表示方法</strong>
            <p>同じ画面をAppDock本体のページ、または別ウィンドウで表示します。</p>
          </div>
          <select
            aria-label={`${page.title}の表示方法`}
            value={
              draft.extensions[applet.id]?.pages?.[page.id]?.display ??
              page.defaultDisplay ??
              'page'
            }
            onChange={(event) =>
              onChange({
                ...draft,
                extensions: {
                  ...draft.extensions,
                  [applet.id]: {
                    ...(draft.extensions[applet.id] ?? { enabled: false, settings: {} }),
                    pages: {
                      ...draft.extensions[applet.id]?.pages,
                      [page.id]: { display: event.target.value as 'page' | 'window' },
                    },
                  },
                },
              })
            }
          >
            <option value="page">AppDock本体のページ</option>
            <option value="window">別ウィンドウ</option>
          </select>
        </div>
      ))}
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
      {actions.map((item) => {
        const available = applet.commands.some(
          (command) => command.id === item.command && command.available,
        );
        const descriptionId = `setting-action-help-${item.command}`;
        return (
          <div className="setting-row setting-action-row" key={item.command}>
            <div>
              <strong>{item.title}</strong>
              <p id={descriptionId}>{item.description}</p>
              {!available && <p>Appletを開始してから操作できます。</p>}
              {result?.command === item.command && (
                <p role={result.error ? 'alert' : 'status'}>{result.message}</p>
              )}
            </div>
            <button
              className="secondary"
              aria-describedby={descriptionId}
              disabled={!available || runningAction !== null}
              aria-busy={runningAction === item.command}
              onClick={() => void executeAction(item)}
            >
              {runningAction === item.command ? '実行中…' : item.title}
            </button>
          </div>
        );
      })}
      {!definitions.length && !actions.length && (
        <p className="empty">
          {applet.settings?.length || applet.settingActions?.length
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
            {item.type === 'object-list' ? (
              <ObjectListSetting definition={item} value={value} onChange={set} />
            ) : item.type === 'json' ? (
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
