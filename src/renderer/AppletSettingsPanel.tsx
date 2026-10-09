import type { ExtensionSnapshot, GlobalHotKeyStatus } from '../shared/contracts';
import type { UiCommand } from '../shared/commands';
import { AppletSettings } from './AppletSettings';
import { WebAppletSettings } from './WebAppletSettings';
import { ShortcutsEditor } from './ShortcutsEditor';
import type { SettingsEditor } from './useSettingsEditor';
import type { WebProfile } from '../shared/web-applets';
import { useLayoutEffect, useRef } from 'react';
import { resetAppletKeybindings } from '../shared/keybindings';

/** Separate detail tabs edit the same host settings session. */
export function AppletSettingsPanel({
  applet,
  applets,
  extensions,
  editor,
  commands,
  globalHotKeys,
  tab,
  onWebAccounts,
  webAccounts,
}: {
  applet: ExtensionSnapshot;
  applets: { id: string; title: string }[];
  extensions: ExtensionSnapshot[];
  editor: SettingsEditor;
  commands: UiCommand[];
  globalHotKeys: GlobalHotKeyStatus[];
  tab: 'settings' | 'shortcuts';
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
      {tab === 'settings' ? (
        applet.runtime === 'web' ? (
          <WebAppletSettings
            key={applet.id}
            editor={editor}
            itemId={applet.id}
            onAccounts={onWebAccounts}
            accounts={webAccounts}
            applets={applets}
          />
        ) : (
          <AppletSettings key={applet.id} applet={applet} draft={draft} onChange={edit} />
        )
      ) : (
        <>
          <div className="actions">
            <button
              className="secondary"
              onClick={() => edit(resetAppletKeybindings(draft, applet))}
            >
              このAppletのショートカットを初期値に戻す
            </button>
          </div>
          <ShortcutsEditor
            key={applet.id}
            commands={commands}
            owner={applet.id}
            settings={draft}
            onChange={edit}
            applets={applets}
            extensions={extensions}
            statuses={globalHotKeys}
          />
        </>
      )}
    </div>
  );
}
