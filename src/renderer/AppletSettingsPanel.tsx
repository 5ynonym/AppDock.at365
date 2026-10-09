import type { ExtensionSnapshot, GlobalHotKeyStatus } from '../shared/contracts';
import type { UiCommand } from '../shared/commands';
import { AppletSettings } from './AppletSettings';
import { WebAppletSettings } from './WebAppletSettings';
import { ShortcutsEditor } from './ShortcutsEditor';
import type { SettingsEditor } from './useSettingsEditor';
import type { WebProfile } from '../shared/web-applets';
import { useLayoutEffect, useRef } from 'react';

/** Both pages render this panel against the same host editing session. */
export function AppletSettingsPanel({
  applet,
  applets,
  editor,
  commands,
  globalHotKeys,
  tab,
  onTab,
  onWebAccounts,
  webAccounts,
}: {
  applet: ExtensionSnapshot;
  applets: { id: string; title: string }[];
  editor: SettingsEditor;
  commands: UiCommand[];
  globalHotKeys: GlobalHotKeyStatus[];
  tab: 'settings' | 'shortcuts';
  onTab(tab: 'settings' | 'shortcuts'): void;
  onWebAccounts(): void;
  webAccounts: WebProfile[];
}) {
  const { draft, edit } = editor;
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (panel.current) panel.current.scrollTop = 0;
  }, [applet.id, tab]);
  return (
    <div className="applet-settings-panel" ref={panel}>
      <div className="tabs" aria-label="Applet設定の表示">
        <button
          aria-pressed={tab === 'settings'}
          className={tab === 'settings' ? 'selected' : ''}
          onClick={() => onTab('settings')}
        >
          設定項目
        </button>
        <button
          aria-pressed={tab === 'shortcuts'}
          className={tab === 'shortcuts' ? 'selected' : ''}
          onClick={() => onTab('shortcuts')}
        >
          ショートカットキー
        </button>
      </div>
      {tab === 'settings' ? (
        applet.runtime === 'web' ? (
          <WebAppletSettings
            key={applet.id}
            editor={editor}
            itemId={applet.id}
            onAccounts={onWebAccounts}
            accounts={webAccounts}
          />
        ) : (
          <AppletSettings key={applet.id} applet={applet} draft={draft} onChange={edit} />
        )
      ) : (
        <ShortcutsEditor
          key={applet.id}
          commands={commands}
          owner={applet.id}
          settings={draft}
          onChange={edit}
          applets={applets}
          statuses={globalHotKeys}
        />
      )}
    </div>
  );
}
