import type { ExtensionSnapshot, Settings } from '../shared/contracts';
import { getKeybindings } from '../shared/keybindings';
import { ShortcutCommandList } from './ShortcutCommandList';

export function AppletShortcutOverview({
  applet,
  settings,
  applets,
  onChange,
}: {
  applet: ExtensionSnapshot;
  settings: Settings;
  applets: { id: string; title: string }[];
  onChange(settings: Settings): void;
}) {
  const bindings = getKeybindings(settings);
  const commands = applet.commands.map((command) => ({
    ...command,
    extension: applet.displayName,
    extensionId: applet.id,
  }));
  const normal = commands.filter((command) => !command.hidden);
  const aliases = commands.filter(
    (command) => command.hidden && bindings.some((row) => row.command === command.id),
  );
  return (
    <div className="applet-shortcuts">
      <h2>ショートカットキー</h2>
      <ShortcutCommandList
        commands={normal}
        settings={settings}
        applets={applets}
        onChange={onChange}
      />
      {!!aliases.length && (
        <>
          <h3>互換コマンドへの割り当て</h3>
          <ShortcutCommandList
            commands={aliases}
            settings={settings}
            applets={applets}
            onChange={onChange}
          />
        </>
      )}
    </div>
  );
}
