import {
  appletSettingsPageId,
  appletCommonDescriptions,
} from '../../../src/shared/settings-catalog';
import { settingAnchor } from '../../../src/shared/settings-ui/setting-anchor';
import {
  SettingsInput,
  SettingsTextarea,
  numberInput,
} from '../../../src/shared/settings-ui/SettingsInput';
import { settingsControls } from '../../../src/shared/settings-ui/api';
import { useRef, useState } from 'react';
import type { ExtensionSnapshot, Settings } from '../../../src/shared/contracts';
import { ShortcutListSetting } from '../../../src/shared/settings-ui/ShortcutListSetting';
import { ObjectListSetting } from '../../../src/shared/settings-ui/ObjectListSetting';

/** Both entry points render this complete page against the main editing session. */
export function AppletSettings({
  applet,
  settings,
  onChange,
}: {
  applet: ExtensionSnapshot;
  settings: Settings;
  onChange(value: Settings): void;
}) {
  const pageId = appletSettingsPageId(applet.id);
  const executing = useRef(false);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [result, setResult] = useState<{ command: string; message: string; error: boolean } | null>(
    null,
  );
  const actions = applet.settingActions ?? [];
  const executeAction = async (item: NonNullable<ExtensionSnapshot['settingActions']>[number]) => {
    if (executing.current) return;
    executing.current = true;
    setRunningAction(item.command);
    setResult(null);
    try {
      await settingsControls.executeCommand(item.command);
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
  const definitions = applet.settings ?? [];
  return (
    <div className="applet-settings">
      {(applet.pages ?? []).map((page) => (
        <div
          className="setting-row"
          key={`page-${page.id}`}
          {...settingAnchor(pageId, `page:${page.id}`)}
        >
          <div>
            <strong>{page.title}の表示方法</strong>
            <p>{appletCommonDescriptions.display}</p>
          </div>
          <select
            aria-label={`${page.title}の表示方法`}
            value={
              settings.extensions[applet.id]?.pages?.[page.id]?.display ??
              page.defaultDisplay ??
              'page'
            }
            onChange={(event) =>
              onChange({
                ...settings,
                extensions: {
                  ...settings.extensions,
                  [applet.id]: {
                    ...(settings.extensions[applet.id] ?? { enabled: false, settings: {} }),
                    pages: {
                      ...settings.extensions[applet.id]?.pages,
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
      <div className="setting-row" {...settingAnchor(pageId, 'startupDelaySeconds')}>
        <div>
          <strong>開始までの秒数</strong>
          <p>{appletCommonDescriptions.startupDelaySeconds}</p>
        </div>
        <SettingsInput
          aria-label="開始までの秒数"
          type="number"
          min={0}
          max={86400}
          step={1}
          value={
            settings.extensions[applet.id]?.startupDelaySeconds ?? applet.startupDelaySeconds ?? 0
          }
          onChange={(event) =>
            onChange({
              ...settings,
              extensions: {
                ...settings.extensions,
                [applet.id]: {
                  ...(settings.extensions[applet.id] ?? { enabled: false, settings: {} }),
                  startupDelaySeconds:
                    event.target.value === ''
                      ? ('' as unknown as number)
                      : numberInput(event.target.value),
                },
              },
            })
          }
        />
      </div>

      {actions.map((item) => {
        const available =
          applet.enabled &&
          applet.state === 'running' &&
          applet.commands.some((command) => command.id === item.command && command.available);
        const descriptionId = `setting-action-help-${item.command}`;
        return (
          <div
            className="setting-row setting-action-row"
            key={item.command}
            {...settingAnchor(pageId, `action:${item.command}`)}
          >
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
        <p className="empty">このAppletには設定項目がありません。</p>
      )}
      {definitions.map((item) => {
        const value = settings.extensions[applet.id]?.settings[item.key] ?? item.default;
        const set = (next: unknown) =>
          onChange({
            ...settings,
            extensions: {
              ...settings.extensions,
              [applet.id]: {
                ...(settings.extensions[applet.id] ?? { enabled: false, settings: {} }),
                settings: { ...settings.extensions[applet.id]?.settings, [item.key]: next },
              },
            },
          });
        const options = applet.settingOptions[item.key] ?? item.options ?? [];
        const descriptionId = `setting-help-${applet.id}-${item.key}`;
        return (
          <div
            className="setting-row"
            key={item.key}
            {...settingAnchor(pageId, `setting:${item.key}`)}
          >
            <div>
              <strong>{item.title}</strong>
              <p id={descriptionId}>{item.description}</p>
            </div>
            {item.type === 'object-list' ? (
              <ObjectListSetting definition={item} value={value} onChange={set} />
            ) : item.type === 'json' ? (
              <SettingsTextarea
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
              <SettingsInput
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
                        : numberInput(event.target.value)
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
