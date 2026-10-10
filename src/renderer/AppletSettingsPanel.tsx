import type { ExtensionSnapshot } from '../shared/contracts';
import { AppletSettings } from './AppletSettings';
import { WebAppletSettings } from './WebAppletSettings';
import { AppletShortcutOverview } from './AppletShortcutOverview';
import type { SettingsEditor } from './useSettingsEditor';
import type { WebProfile } from '../shared/web-applets';
import { useLayoutEffect, useRef } from 'react';

/** Separate detail tabs edit the same host settings session. */
export function AppletSettingsPanel({
  applet,
  applets,
  editor,
  tab,
  onWebAccounts,
  webAccounts,
}: {
  applet: ExtensionSnapshot;
  applets: { id: string; title: string }[];
  editor: SettingsEditor;
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
        <AppletShortcutOverview
          key={applet.id}
          applet={applet}
          settings={draft}
          applets={applets}
          onChange={edit}
        />
      )}
    </div>
  );
}
