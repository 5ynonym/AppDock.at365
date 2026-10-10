import type { Settings } from '../shared/contracts';
import {
  appendKeybinding,
  changeKeybindingKey,
  getKeybindings,
  keybindingConditionLabel,
  withKeybindings,
  type Keybinding,
} from '../shared/keybindings';
import { useLayoutEffect, useRef, useState } from 'react';
import { AppletShortcutDialog } from './AppletShortcutDialog';
import { ShortcutOrderDialog } from './ShortcutOrderDialog';
import { BindingActions } from './BindingActions';
import type { UiCommand } from '../shared/commands';

export function ShortcutCommandList({
  commands,
  allCommands = commands,
  settings,
  applets,
  onChange,
  showProvider = false,
  statusError,
  onRetry,
}: {
  commands: UiCommand[];
  allCommands?: UiCommand[];
  settings: Settings;
  applets: { id: string; title: string }[];
  onChange(settings: Settings): void;
  showProvider?: boolean;
  statusError?(row: Keybinding): string | undefined;
  onRetry?(): void;
}) {
  const bindings = getKeybindings(settings);
  const [orderKey, setOrderKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    row: Keybinding;
    title: string;
    ownerTitle?: string;
    adding: boolean;
  } | null>(null);
  const [notice, setNotice] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const restore = useRef<(() => void) | null>(null);
  const rememberPosition = (target?: HTMLElement | null) => {
    const scroll = root.current?.closest<HTMLElement>('.applet-settings-panel, .settings-body');
    const trigger =
      target ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const top = scroll?.scrollTop ?? 0;
    const left = scroll?.scrollLeft ?? 0;
    restore.current = () => {
      if (scroll) {
        scroll.scrollTop = top;
        scroll.scrollLeft = left;
      }
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      else root.current?.focus({ preventScroll: true });
    };
  };
  const open = (command: UiCommand, row?: Keybinding) => {
    rememberPosition();
    setNotice('');
    setEditing({
      title: command.title,
      ownerTitle: command.extensionId ? command.extension : undefined,
      adding: !row,
      row: structuredClone(
        row ?? {
          id: crypto.randomUUID(),
          command: command.id,
          key: '',
          enabled: true,
          when: { scope: command.extensionId ? 'owner' : 'app', appletIds: [] },
        },
      ),
    });
  };
  useLayoutEffect(() => {
    if (!editing && !orderKey && restore.current) {
      restore.current();
      restore.current = null;
    }
  }, [editing, orderKey, bindings]);
  const apply = (row: Keybinding) => {
    if (!editing) return;
    let next: Keybinding[];
    if (editing.adding) {
      if (bindings.length >= 2000) throw Error('キーバインドは2000件以内です。');
      next = appendKeybinding(bindings, row);
    } else {
      const current = bindings.find((binding) => binding.id === row.id);
      if (JSON.stringify(current) !== JSON.stringify(editing.row))
        throw Error('編集中に割り当てが変更されました。キャンセルして開き直してください。');
      next = changeKeybindingKey(bindings, row.id, row.key).map((binding) =>
        binding.id === row.id ? row : binding,
      );
    }
    onChange(withKeybindings(settings, next));
    setNotice(`${editing.title}の割り当てを${editing.adding ? '追加' : '変更'}しました。`);
    setEditing(null);
  };
  const table = (items: typeof commands) => (
    <table className="applet-shortcut-overview">
      <thead>
        <tr>
          <th>コマンド</th>
          <th>割り当て</th>
        </tr>
      </thead>
      <tbody>
        {items.map((command) => {
          const assigned = bindings.filter((row) => row.command === command.id);
          return (
            <tr key={command.id} data-shortcut-command={command.id}>
              <td>
                <div className="applet-shortcut-command">
                  <strong>{command.title}</strong>
                  <button
                    className="applet-shortcut-add"
                    aria-label={`${command.title}に割り当てを追加`}
                    title="割り当てを追加"
                    onClick={() => open(command)}
                  >
                    ＋
                  </button>
                </div>
                <small className="command-id">{command.id}</small>
                {showProvider && (
                  <small className="shortcut-provider">
                    {command.extension}
                    {command.hidden ? ' · 互換コマンド' : ''}
                  </small>
                )}
                {!command.available && <small>現在利用できません</small>}
              </td>
              <td>
                {assigned.length ? (
                  assigned.map((row) => (
                    <div className="applet-shortcut-pair" key={row.id} data-binding-id={row.id}>
                      <button
                        className="applet-shortcut-edit"
                        aria-label={`${command.title}の${row.key}を編集`}
                        onClick={() => open(command, row)}
                      >
                        <kbd>{row.key}</kbd>
                        <span>
                          {keybindingConditionLabel(
                            row.when,
                            command.extensionId ? command.extension : undefined,
                            applets,
                          )}
                        </span>
                        {!row.enabled && <small>無効</small>}
                        {statusError?.(row) && (
                          <small role="alert" className="shortcut-conflict">
                            {statusError(row)}
                          </small>
                        )}
                      </button>
                      {statusError?.(row) && (
                        <button className="text-button" onClick={onRetry}>
                          登録を再試行
                        </button>
                      )}
                      <BindingActions
                        label={`${command.title}の${row.key}のその他の操作`}
                        removalKind="binding"
                        confirmDelete={false}
                        extraActions={[
                          { title: '編集', onClick: () => open(command, row) },
                          {
                            title: 'このキーの実行順…',
                            onClick: () => {
                              rememberPosition();
                              setOrderKey(row.key);
                            },
                          },
                        ]}
                        onDelete={() => {
                          rememberPosition(
                            root.current?.querySelector<HTMLButtonElement>(
                              `[data-shortcut-command="${CSS.escape(command.id)}"] .applet-shortcut-add`,
                            ),
                          );
                          onChange(
                            withKeybindings(
                              settings,
                              bindings.filter((binding) => binding.id !== row.id),
                            ),
                          );
                          setNotice(`${command.title}の割り当てを削除しました。`);
                        }}
                      />
                    </div>
                  ))
                ) : (
                  <span className="muted">未割り当て</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
  return (
    <div className="shortcut-command-list" ref={root} tabIndex={-1}>
      <div className="applet-shortcut-notice" role="status">
        {notice || 'キーと条件をクリックして編集・＋で割り当てを追加'}
      </div>
      {commands.length ? table(commands) : <p className="muted">表示するコマンドはありません。</p>}
      {orderKey !== null && (
        <ShortcutOrderDialog
          settings={settings}
          commands={allCommands}
          applets={applets}
          initialKey={orderKey}
          onChange={onChange}
          onClose={() => setOrderKey(null)}
        />
      )}
      {editing && (
        <AppletShortcutDialog
          initial={editing.row}
          title={editing.title}
          ownerTitle={editing.ownerTitle}
          applets={applets}
          adding={editing.adding}
          onApply={apply}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
