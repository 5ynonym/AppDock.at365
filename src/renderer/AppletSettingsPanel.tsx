import type { ExtensionSnapshot } from '../shared/contracts';
import type { UiCommand } from '../shared/commands';
import { ShellPageSlot } from './ShellPageSlot';
import { appletSettingsPageId } from '../shared/settings-catalog';

import { AppletShortcutOverview } from '../shared/settings-ui/AppletShortcutOverview';
import type { SettingsEditor } from './useSettingsEditor';
import type { WebProfile } from '../shared/web-content';
import { useLayoutEffect, useRef } from 'react';

/** Separate detail tabs edit the same host settings session. */
export function AppletSettingsPanel({
  applet,
  applets,
  commands,
  editor,
  tab,
  onWebAccounts,
  webAccounts,
}: {
  applet: ExtensionSnapshot;
  applets: { id: string; title: string }[];
  commands: UiCommand[];
  editor: SettingsEditor;
  tab: 'settings' | 'shortcuts';
  onWebAccounts(): void;
  webAccounts: WebProfile[];
}) {
  const { value: settings, edit } = editor;
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (panel.current) panel.current.scrollTop = 0;
  }, [applet.id, tab]);
  return (
    <div
      className={`applet-settings-panel${tab === 'settings' ? ' shell-settings-panel' : ''}`}
      ref={panel}
    >
      {tab === 'settings' ? (
        <ShellPageSlot
          key={applet.id}
          kind="settings"
          settingsContext="applet"
          settingsPageId={appletSettingsPageId(applet.id)}
          navigationRequest={0}
        />
      ) : (
        <AppletShortcutOverview
          key={applet.id}
          applet={applet}
          allCommands={commands}
          settings={settings}
          applets={applets}
          onChange={edit}
        />
      )}
    </div>
  );
}
