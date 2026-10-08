import { PanelImageCard } from './PanelImageCard';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import type {
  DockApi,
  HostSnapshot,
  ExtensionSnapshot,
  Settings,
  SettingsSnapshot,
  GlobalHotKeyStatus,
} from '../shared/contracts';
import './style.css';
import {
  hostCommands,
  rankCommands,
  movePinnedCommand,
  shortcutFromEvent,
  defaultShortcuts,
  defaultGlobalShortcutCommands,
  type UiCommand,
} from '../shared/commands';
import { ShortcutsEditor } from './ShortcutsEditor';
import { ProfileEditor } from './ProfileEditor';
import { AppletSettingsPanel } from './AppletSettingsPanel';
import { SettingsActions, SettingsMessages } from './SettingsActions';
import { useSettingsEditor, type SettingsEditor } from './useSettingsEditor';
import { VersionCheck } from './VersionCheck';
import { useAppletSidebar } from './useAppletSidebar';
import { ribbonItems, orderRibbon, type RibbonItem } from '../shared/applet-pages';
import { RibbonSettings } from './RibbonSettings';
declare global {
  interface Window {
    dock: DockApi;
  }
}
type Page = 'home' | 'extensions' | 'settings' | 'logs' | `page:${string}`;
type AppletSettingsTab = 'settings' | 'shortcuts';
type IconName =
  | 'home'
  | 'extensions'
  | 'settings'
  | 'logs'
  | 'search'
  | 'arrow'
  | 'play'
  | 'refresh'
  | 'check'
  | 'folder'
  | 'chevron'
  | 'close'
  | 'minus'
  | 'square'
  | 'command'
  | 'mail'
  | 'clock'
  | 'image'
  | 'sun'
  | 'moon';
const paths: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
    </>
  ),
  extensions: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <path d="m17 2 5 5-5 5-5-5Z" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="3" />
      <circle cx="16" cy="17" r="3" />
    </>
  ),
  logs: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="m7 9 3 3-3 3m6 0h4" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </>
  ),
  play: <path d="m7 4 13 8-13 8Z" />,
  refresh: (
    <>
      <path d="M20 8a8 8 0 1 0 .3 7M20 3v5h-5" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  folder: <path d="M3 7V5a1 1 0 0 1 1-1h6l2 3h8a1 1 0 0 1 1 1v11H3Z" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  minus: <path d="M5 12h14" />,
  square: <rect x="6" y="6" width="12" height="12" rx="1" />,
  command: (
    <>
      <path d="M8 8h8v8H8Z" />
      <path d="M8 8H5a3 3 0 1 1 3-3v14a3 3 0 1 1-3-3h14a3 3 0 1 1-3 3V5a3 3 0 1 1 3 3Z" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1" />
      <path d="m3 17 5-5 4 4 4-6 5 7" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" />
    </>
  ),
  moon: <path d="M20 15A9 9 0 0 1 9 4 9 9 0 1 0 20 15Z" />,
};
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand-mark ${small ? 'small' : ''}`}>
      <span />
      <span />
      <span />
    </span>
  );
}
const labels: Record<string, string> = {
  home: 'ホーム',
  extensions: 'Applet',
  settings: '設定',
  logs: 'ログ',
};
const states = {
  waiting: '開始待ち',
  running: '実行中',
  stopped: '停止中',
  starting: '起動中',
  stopping: '停止処理中',
  error: 'エラー',
};
function StateBadge({ extension }: { extension: ExtensionSnapshot }) {
  return (
    <span className={`state ${extension.state}`}>
      <i />
      {states[extension.state]}
    </span>
  );
}
function Toggle({
  checked,
  label,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  label: string;
  onChange(v: boolean): void;
  disabled?: boolean;
}) {
  return (
    <button
      className="toggle"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span />
    </button>
  );
}
function App() {
  const appletSidebar = useAppletSidebar();
  const [settingsSidebarHost, setSettingsSidebarHost] = useState<HTMLDivElement | null>(null);
  const [snapshot, setSnapshot] = useState<HostSnapshot>();
  const [page, setPage] = useState<Page>('home');
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [profileRequest, setProfileRequest] = useState(0);
  const [ribbonRequest, setRibbonRequest] = useState(0);
  const appletPageRef = useRef<HTMLDivElement>(null);
  const [detailSettings, setDetailSettings] = useState(false);
  const [detailTab, setDetailTab] = useState<AppletSettingsTab>('settings');
  const editor = useSettingsEditor(snapshot?.settings, snapshot?.extensions ?? [], action);
  useLayoutEffect(() => {
    // The retained detail view may be revisited after editing the shared JSON draft.
    if (page === 'extensions' && detailSettings && editor.mode === 'json') {
      if (!editor.switchToForm()) {
        setDetailSettings(false);
        setError('設定ページのJSONの内容を修正してから、Appletの設定を開いてください。');
      }
    }
  }, [page, detailSettings, editor.mode]);
  const [appletFilter, setAppletFilter] = useState('');
  const [logSource, setLogSource] = useState('');
  const [paletteIndex, setPaletteIndex] = useState(0);
  const paletteRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!palette) return;
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    paletteRef.current?.querySelector('input')?.focus();
    return () => {
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
    };
  }, [palette]);
  useEffect(() => {
    setPaletteIndex(0);
  }, [query, palette]);
  const knownCommands = useRef(new Map<string, UiCommand>());
  const load = async () => {
    try {
      setSnapshot(await window.dock.snapshot());
    } catch (e) {
      setError(String(e));
    }
  };
  useEffect(() => {
    void load();
    return window.dock.onChanged(() => void load());
  }, []);
  useEffect(() => {
    return window.dock.onHostCommand((id) => {
      void execute(id);
    });
  }, []);
  useEffect(
    () =>
      window.dock.onAppletPage((key) => {
        setPalette(false);
        setPage(key ? (key as Page) : 'home');
      }),
    [],
  );
  useLayoutEffect(() => {
    const update = () => {
      const element = appletPageRef.current;
      const rect = element?.getBoundingClientRect();
      const key = page.startsWith('page:') ? page : null;
      void window.dock
        .pageViewport(
          key,
          key && rect && !palette
            ? {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.max(1, Math.round(rect.width)),
                height: Math.max(1, Math.round(rect.height)),
              }
            : null,
        )
        .catch((error) => setError(String(error)));
    };
    update();
    const observer = new ResizeObserver(update);
    if (appletPageRef.current) observer.observe(appletPageRef.current);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [page, palette, error, !!snapshot]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.isComposing ||
        e.repeat ||
        (e.target instanceof Element && e.target.closest('[data-shortcut-recorder]'))
      )
        return;
      const shortcut = shortcutFromEvent(e);
      if (
        snapshot?.globalHotKeys.some((status) => status.registered && status.shortcut === shortcut)
      )
        return;
      if (
        !e.ctrlKey &&
        !e.altKey &&
        e.target instanceof Element &&
        e.target.closest('input, textarea, select, [contenteditable="true"]')
      )
        return;
      const commandId =
        shortcut &&
        Object.entries(snapshot?.settings.value.shortcuts ?? {}).find(([, values]) =>
          values.includes(shortcut),
        )?.[0];
      if (commandId && commands.some((c) => c.id === commandId && c.available)) {
        e.preventDefault();
        if (!busy || hostCommands.some((c) => c.id === commandId)) void execute(commandId);
      }
      if (e.key === 'Escape') setPalette(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [snapshot, busy]);
  useEffect(() => {
    document.documentElement.dataset.theme = snapshot?.dark ? 'dark' : 'light';
  }, [snapshot?.dark]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function action(work: () => Promise<unknown>, message?: string) {
    setBusy(true);
    setError('');
    try {
      await work();
      await load();
      if (message) setToast(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  const goExtension = (id: string) => {
    setSelected(id);
    setDetailSettings(false);
    setDetailTab('settings');
    setPage('extensions');
  };
  const commands: UiCommand[] = [
    ...hostCommands.map((command) => ({ ...command, extensionId: null })),
    ...(snapshot?.extensions.flatMap((e) =>
      e.commands.map((c) => ({ ...c, extension: e.displayName, extensionId: e.id })),
    ) ?? []),
  ];
  for (const command of commands) knownCommands.current.set(command.id, command);
  const commandIds = new Set(commands.map((c) => c.id));
  const shortcutCommands: UiCommand[] = [
    ...commands,
    ...[
      ...new Set([
        ...knownCommands.current.keys(),
        ...Object.keys(snapshot?.settings.value.shortcuts ?? {}),
        ...(snapshot?.settings.value.trayCommands ?? []),
        ...(snapshot ? [snapshot.settings.value.host.trayClickCommand] : []),
        ...(snapshot?.settings.value.host.trayDoubleClickCommand
          ? [snapshot.settings.value.host.trayDoubleClickCommand]
          : []),
      ]),
    ]
      .filter((id) => !commandIds.has(id))
      .map((id) => ({
        ...(knownCommands.current.get(id) ?? { id, title: id, extension: '未確認のコマンド' }),
        available: false,
      })),
  ];
  const pins = snapshot?.settings.value.pinnedCommands ?? [];
  const filteredCommands = rankCommands(
    commands.filter(
      (c) =>
        !c.hidden &&
        (c.title + ' ' + c.extension + ' ' + c.id).toLowerCase().includes(query.toLowerCase()),
    ),
    pins,
  );
  useEffect(() => {
    setPaletteIndex((index) => Math.min(index, Math.max(0, filteredCommands.length - 1)));
  }, [filteredCommands.length]);
  const visiblePins = filteredCommands.filter((c) => pins.includes(c.id)).map((c) => c.id);
  const paletteKey = snapshot?.settings.value.shortcuts['appdock.commands.search']?.[0];
  async function execute(id: string) {
    if (id === 'appdock.commands.search') {
      setPalette((v) => !v);
      setQuery('');
      return;
    }
    if (id === 'appdock.settings.open') {
      setPalette(false);
      setPage('settings');
      return;
    }
    setPalette(false);
    await action(() => window.dock.executeCommand(id), 'コマンドを実行しました。');
  }
  const updatePins = (ids: string[]) => void action(() => window.dock.setPinnedCommands(ids));
  const selectedApplet =
    snapshot?.extensions.find((e) => e.id === selected) ?? snapshot?.extensions[0];
  const active = snapshot?.extensions.filter((e) => e.state === 'running').length ?? 0;
  const ribbon = orderRibbon(
    ribbonItems(snapshot?.extensions ?? [], snapshot?.settings.value.ribbon.separators ?? []),
    snapshot?.settings.value.ribbon.order ?? [],
  ).filter((item) => !snapshot?.settings.value.ribbon.hidden.includes(item.id));
  const renderRibbonItem = (item: RibbonItem) =>
    item.kind === 'separator' ? (
      <div
        key={item.id}
        className="ribbon-separator"
        role="separator"
        aria-label={item.title}
        data-ribbon-id={item.id}
      />
    ) : (
      <button
        key={item.id}
        data-ribbon-id={item.id}
        title={item.id === 'profile' ? snapshot?.settings.value.profile.name : item.title}
        aria-label={item.title}
        aria-current={page === item.id ? 'page' : undefined}
        className={item.id === 'profile' ? 'avatar' : page === item.id ? 'active' : ''}
        onClick={() => {
          if (item.extensionId) {
            void action(() => window.dock.openAppletPage(item.extensionId!, item.pageId!));
          } else if (item.id === 'theme') {
            if (snapshot)
              void action(() =>
                window.dock.saveSettings(
                  {
                    ...snapshot.settings.value,
                    host: {
                      ...snapshot.settings.value.host,
                      theme: snapshot.dark ? 'light' : 'dark',
                    },
                  },
                  snapshot.settings.revision,
                ),
              );
          } else if (item.id === 'profile') {
            setPage('settings');
            setProfileRequest((value) => value + 1);
          } else setPage(item.id as Page);
        }}
      >
        {item.id === 'profile' ? (
          snapshot?.avatarUrl ? (
            <img src={snapshot.avatarUrl} alt="ユーザーのアバター" />
          ) : (
            Array.from(snapshot?.settings.value.profile.name ?? 'ユキ')[0]
          )
        ) : (
          <>
            <Icon
              name={
                (item.id === 'theme' ? (snapshot?.dark ? 'sun' : 'moon') : item.icon) as IconName
              }
              size={21}
            />
            <span className="rail-label">{item.title}</span>
          </>
        )}
      </button>
    );
  return (
    <div
      className={`shell ${page === 'extensions' || page === 'settings' ? 'with-sidebar' : ''}`}
      style={{ '--applet-sidebar-width': `${appletSidebar.width}px` } as React.CSSProperties}
    >
      <header className="titlebar">
        <div className="title-brand">
          <Brand small />
          <span>
            AppDock<span className="muted">.at365</span>
          </span>
        </div>
        <button
          className="titlebar-search"
          onClick={() => {
            setPalette(true);
            setQuery('');
          }}
        >
          <Icon name="search" size={15} /> コマンドを検索 {paletteKey && <kbd>{paletteKey}</kbd>}
        </button>
        <div className="window-controls">
          {(['minimize', 'maximize', 'close'] as const).map((a, i) => (
            <button
              key={a}
              aria-label={['最小化', '最大化', '閉じる'][i]}
              className={a === 'close' ? 'window-close' : ''}
              onClick={() => void window.dock.windowAction(a)}
            >
              <Icon name={(['minus', 'square', 'close'] as const)[i]} size={14} />
            </button>
          ))}
        </div>
      </header>
      <aside
        className="activity-rail"
        aria-label="リボン"
        onContextMenu={(event) => {
          event.preventDefault();
          setPage('settings');
          setRibbonRequest((value) => value + 1);
        }}
      >
        <Brand />
        <div className="ribbon-buttons ribbon-top" aria-label="上寄せのリボン">
          {ribbon
            .filter((item) => !snapshot?.settings.value.ribbon.bottom.includes(item.id))
            .map(renderRibbonItem)}
        </div>
        <div className="rail-spacer" />
        <div className="ribbon-buttons ribbon-bottom" aria-label="下寄せのリボン">
          {ribbon
            .filter((item) => snapshot?.settings.value.ribbon.bottom.includes(item.id))
            .map(renderRibbonItem)}
        </div>
      </aside>
      {page === 'extensions' && (
        <aside className="sidebar" aria-label="Applet一覧">
          <h2>Applet</h2>
          <input
            aria-label="Appletを検索"
            placeholder="Appletを検索…"
            value={appletFilter}
            onChange={(event) => setAppletFilter(event.target.value)}
          />
          <div className="sidebar-extensions">
            {snapshot?.extensions
              .filter((e) =>
                (e.displayName + ' ' + e.name + ' ' + e.id)
                  .toLowerCase()
                  .includes(appletFilter.toLowerCase()),
              )
              .map((e) => (
                <button
                  key={e.id}
                  onClick={() => goExtension(e.id)}
                  aria-current={selectedApplet?.id === e.id ? 'true' : undefined}
                  className={selectedApplet?.id === e.id ? 'selected' : ''}
                >
                  <span title={e.displayName}>{e.displayName}</span>
                  <small>{states[e.state]}</small>
                </button>
              ))}
            {snapshot &&
              !snapshot.extensions.some((e) =>
                (e.displayName + ' ' + e.name + ' ' + e.id)
                  .toLowerCase()
                  .includes(appletFilter.toLowerCase()),
              ) && <p className="empty">該当するAppletはありません。</p>}
          </div>
          <div className="sidebar-resizer" {...appletSidebar.separatorProps} />
        </aside>
      )}
      <div
        className="settings-sidebar-slot"
        ref={setSettingsSidebarHost}
        hidden={page !== 'settings'}
      />
      <main
        className={
          page === 'settings'
            ? 'settings-main'
            : page === 'extensions'
              ? `applet-detail-main${detailSettings ? ' settings-main applet-detail-settings-main' : ''}`
              : page.startsWith('page:')
                ? 'applet-page-main'
                : undefined
        }
      >
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button aria-label="エラーを閉じる" onClick={() => setError('')}>
              <Icon name="close" size={14} />
            </button>
          </div>
        )}
        {!snapshot ? (
          <div className="loading">Dockに接続しています…</div>
        ) : (
          <div className="page-content">
            {page.startsWith('page:') && (
              <div className="applet-page-viewport" ref={appletPageRef} aria-label="Appletページ" />
            )}
            {page === 'home' && (
              <>
                <PageHeading title="ホーム" />
                <div className="stats">
                  <div>
                    <span className="stat-icon green">
                      <Icon name="play" />
                    </span>
                    <div>
                      <span>実行中のApplet</span>
                      <strong>
                        {active}
                        <small> / {snapshot.extensions.length}</small>
                      </strong>
                    </div>
                  </div>
                  <div>
                    <span className="stat-icon blue">
                      <Icon name="command" />
                    </span>
                    <div>
                      <span>使えるコマンド</span>
                      <strong>{commands.length}</strong>
                    </div>
                    <button onClick={() => setPalette(true)} aria-label="コマンド一覧">
                      <Icon name="arrow" />
                    </button>
                  </div>
                  <div>
                    <span className="stat-icon purple">
                      <Icon name="logs" />
                    </span>
                    <div>
                      <span>エラーのApplet</span>
                      <strong>
                        {snapshot.extensions.filter((e) => e.state === 'error').length}
                      </strong>
                    </div>
                    <button
                      aria-label="ログを開く"
                      onClick={() => {
                        setLogSource('');
                        setPage('logs');
                      }}
                    >
                      <Icon name="arrow" />
                    </button>
                  </div>
                </div>
                <section className="home-pins" aria-label="よく使うコマンド">
                  <h2>よく使うコマンド</h2>
                  <div className="actions">
                    {rankCommands(
                      commands.filter((c) => pins.includes(c.id)),
                      pins,
                    ).map((c) => (
                      <button
                        key={c.id}
                        className="secondary"
                        disabled={busy || !c.available}
                        onClick={() => void execute(c.id)}
                      >
                        {c.title}
                        <small>{c.extension}</small>
                      </button>
                    ))}
                  </div>
                  {!commands.some((c) => pins.includes(c.id)) && (
                    <p>コマンド検索の☆から、よく使う操作をピン留めできます。</p>
                  )}
                </section>
                <div className="section-heading">
                  <h3>
                    Applet<span>{snapshot.extensions.length}</span>
                  </h3>
                  <button className="text-button" onClick={() => setPage('extensions')}>
                    すべて見る
                    <Icon name="arrow" size={14} />
                  </button>
                </div>
                <div className="extension-grid">
                  {snapshot.extensions.map((e) => (
                    <button className="extension-card" key={e.id} onClick={() => goExtension(e.id)}>
                      <div className="card-top">
                        <span className={`extension-icon ${e.runtime}`}>
                          <Icon name={e.runtime === 'node' ? 'command' : 'extensions'} size={23} />
                        </span>
                        <StateBadge extension={e} />
                      </div>
                      <h3>{e.displayName}</h3>
                      <p>{e.description}</p>
                      <div className="card-bottom">
                        <span>
                          {e.runtime === 'node' ? 'TypeScript' : '.NET 10'}
                          <span className="divider">/</span>v{e.version}
                        </span>
                        <Icon name="arrow" size={16} />
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
            {page === 'extensions' && (
              <>
                <PageHeading
                  title="Applet"
                  action={
                    <button
                      className="secondary"
                      onClick={() => void action(() => window.dock.openPath('extensions'))}
                    >
                      <Icon name="folder" size={16} />
                      Appletフォルダを開く
                    </button>
                  }
                />
                <div className="extensions-layout">
                  <ExtensionDetail
                    extension={selectedApplet}
                    onSettings={() => {
                      if (editor.switchToForm()) setDetailSettings(true);
                      else
                        setError(
                          '設定ページのJSONの内容を修正してから、Appletの設定を開いてください。',
                        );
                    }}
                    onDescription={() => setDetailSettings(false)}
                    settingsPanel={
                      detailSettings && selectedApplet ? (
                        <>
                          <div className="settings-toolbar applet-settings-toolbar">
                            <SettingsActions editor={editor} busy={busy} />
                          </div>
                          <SettingsMessages
                            editor={editor}
                            currentRevision={snapshot.settings.revision}
                          />
                          <AppletSettingsPanel
                            applet={selectedApplet}
                            editor={editor}
                            commands={shortcutCommands}
                            globalHotKeys={snapshot.globalHotKeys}
                            tab={detailTab}
                            onTab={setDetailTab}
                          />
                        </>
                      ) : undefined
                    }
                    onLogs={(id) => {
                      setLogSource(id);
                      setPage('logs');
                    }}
                    busy={busy}
                    run={action}
                  />
                </div>
              </>
            )}
            <div className="settings-page" hidden={page !== 'settings'}>
              <SettingsPage
                snapshot={snapshot.settings}
                version={snapshot.version}
                runtime={snapshot.runtime}
                extensions={snapshot.extensions}
                run={action}
                busy={busy}
                commands={shortcutCommands}
                avatarUrl={snapshot.avatarUrl}
                profileRequest={profileRequest}
                ribbonRequest={ribbonRequest}
                editor={editor}
                onApplet={goExtension}
                globalHotKeys={snapshot.globalHotKeys}
                sidebarHost={settingsSidebarHost}
                sidebar={appletSidebar}
                active={page === 'settings'}
              />
            </div>
            {page === 'logs' && (
              <LogsPage
                snapshot={snapshot}
                run={action}
                source={logSource}
                onSource={setLogSource}
              />
            )}
          </div>
        )}
      </main>
      <footer className="statusbar">
        <span>
          <i />
          実行中 {active} Applet
        </span>
        <span>
          AppDock.at365 <span className="muted">v{snapshot?.version ?? '0.1.0'}</span>
          <VersionCheck />
        </span>
        <button onClick={() => setPalette(true)}>
          <Icon name="command" size={12} />
          コマンドパレット {paletteKey && <kbd>{paletteKey}</kbd>}
        </button>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={17} />
          {toast}
        </div>
      )}
      {palette && (
        <div className="modal-backdrop" onClick={() => setPalette(false)}>
          <div
            className="command-palette"
            ref={paletteRef}
            aria-modal="true"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                setPalette(false);
              }
              if (event.key === 'Tab') {
                const nodes = Array.from(
                  paletteRef.current?.querySelectorAll<HTMLElement>(
                    'input, button:not(:disabled)',
                  ) ?? [],
                );
                const first = nodes[0],
                  last = nodes[nodes.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }
            }}
            role="dialog"
            aria-label="コマンドパレット"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="palette-input">
              <Icon name="search" />
              <input
                aria-label="コマンドを検索"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-results"
                aria-activedescendant={
                  filteredCommands[paletteIndex] ? `palette-option-${paletteIndex}` : undefined
                }
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    event.stopPropagation();
                    const next = filteredCommands.length
                      ? (paletteIndex +
                          (event.key === 'ArrowDown' ? 1 : -1) +
                          filteredCommands.length) %
                        filteredCommands.length
                      : 0;
                    setPaletteIndex(next);
                    document
                      .getElementById(`palette-option-${next}`)
                      ?.scrollIntoView({ block: 'nearest' });
                  }
                  if (event.key === 'Enter' && !busy && filteredCommands[paletteIndex]?.available) {
                    event.preventDefault();
                    event.stopPropagation();
                    void execute(filteredCommands[paletteIndex].id);
                  }
                }}
                placeholder="コマンドを入力…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>Esc</kbd>
            </div>
            <div className="palette-label">COMMANDS</div>
            <div id="palette-results" role="listbox" aria-label="コマンド検索結果">
              {filteredCommands.map((c, commandIndex) => {
                const pinned = pins.includes(c.id);
                const index = visiblePins.indexOf(c.id);
                return (
                  <div
                    className={`palette-command ${pinned ? 'pinned' : ''} ${commandIndex === paletteIndex ? 'highlighted' : ''}`}
                    id={`palette-option-${commandIndex}`}
                    role="option"
                    aria-selected={commandIndex === paletteIndex}
                    key={c.id}
                    data-command-id={c.id}
                  >
                    <button
                      className="palette-execute"
                      disabled={busy || !c.available}
                      onClick={() => void execute(c.id)}
                    >
                      <Icon name="play" size={16} />
                      <div>
                        {c.title}
                        <small>
                          {c.extension}
                          {!c.available && <span> · Applet起動後に利用できます</span>}
                          {pinned && <span className="pin-badge">PINNED</span>}
                        </small>
                      </div>
                      {snapshot?.settings.value.shortcuts[c.id]?.[0] && (
                        <kbd>{snapshot.settings.value.shortcuts[c.id][0]}</kbd>
                      )}
                    </button>
                    <div className="palette-pin-controls">
                      {pinned && (
                        <>
                          <button
                            aria-label={`${c.title}を上に移動`}
                            disabled={busy || index <= 0}
                            onClick={() =>
                              updatePins(movePinnedCommand(pins, c.id, -1, visiblePins))
                            }
                          >
                            ↑
                          </button>
                          <button
                            aria-label={`${c.title}を下に移動`}
                            disabled={busy || index === visiblePins.length - 1}
                            onClick={() =>
                              updatePins(movePinnedCommand(pins, c.id, 1, visiblePins))
                            }
                          >
                            ↓
                          </button>
                        </>
                      )}
                      <button
                        className="pin-toggle"
                        aria-label={`${c.title}を${pinned ? 'ピン留め解除' : 'ピン留め'}`}
                        aria-pressed={pinned}
                        disabled={busy}
                        onClick={() =>
                          updatePins(pinned ? pins.filter((id) => id !== c.id) : [...pins, c.id])
                        }
                      >
                        {pinned ? '★' : '☆'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredCommands.length === 0 && <p>該当するコマンドはありません。</p>}
            <div className="palette-footer">
              ↑↓キーで選択・Enterで実行・Escで閉じる。☆でピン留め、行の矢印ボタンで並べ替え。
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function PageHeading({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="page-heading compact">
      <div>
        <h1>{title}</h1>
      </div>
      {action}
    </div>
  );
}
type Run = (work: () => Promise<unknown>, message?: string) => Promise<void>;
function ExtensionDetail({
  extension: e,
  busy,
  run,
  onSettings,
  onLogs,
  onDescription,
  settingsPanel,
}: {
  extension?: ExtensionSnapshot;
  onSettings(): void;
  onDescription(): void;
  settingsPanel?: React.ReactNode;
  onLogs(id: string): void;
  busy: boolean;
  run: Run;
}) {
  if (!e)
    return (
      <section className="detail empty">
        Appletフォルダにextension.jsonを配置してAppDockを起動し直してください。
      </section>
    );
  return (
    <section className="detail">
      <div className="detail-heading">
        <span className={`extension-icon large ${e.runtime}`}>
          <Icon name="extensions" size={30} />
        </span>
        <div>
          <h2>{e.displayName}</h2>
          <p>
            v{e.version} <span className="divider">/</span>{' '}
            {e.runtime === 'node' ? 'TypeScript · Node.js' : 'C# · .NET 10'}
          </p>
        </div>
        <Toggle
          checked={e.enabled}
          label={`${e.displayName}を有効にする`}
          disabled={busy}
          onChange={(v) => void run(() => window.dock.toggleExtension(e.id, v))}
        />
      </div>
      <div className="actions detail-actions">
        <button
          className="secondary detail-settings-toggle"
          onClick={settingsPanel ? onDescription : onSettings}
        >
          <Icon name="settings" />
          {settingsPanel ? '説明に戻る' : '設定を開く'}
        </button>
        {!settingsPanel && (
          <button className="text-button" onClick={() => onLogs(e.id)}>
            ログを見る
          </button>
        )}
      </div>
      {settingsPanel ? (
        <div className="detail-settings">{settingsPanel}</div>
      ) : (
        <>
          <p className="detail-description">{e.description}</p>
          {e.minimumHostVersion && (
            <p className="muted">AppDock v{e.minimumHostVersion}以降が必要です。</p>
          )}
          <VersionCheck key={e.id} id={e.id} />
          <div className="detail-state">
            <StateBadge extension={e} />
            <button
              className="text-button"
              disabled={busy || !e.enabled}
              onClick={() =>
                void run(() => window.dock.restartExtension(e.id), 'Appletを再起動しました。')
              }
            >
              <Icon name="refresh" size={14} />
              再起動
            </button>
          </div>
          {e.error && <div className="error-text">{e.error}</div>}
          {e.state === 'waiting' && (
            <div className="extension-panel">
              <p>
                {e.displayName} は {new Date(e.scheduledStartAt!).toLocaleTimeString()}{' '}
                に開始します。
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void run(() => window.dock.startExtensionNow(e.id))}
              >
                今すぐ開始
              </button>
            </div>
          )}
          {e.panel ? (
            <div className="extension-panel">
              <h3>{e.panel.title}</h3>
              <p>{e.panel.description}</p>
              {!!e.panel.tabs?.length && (
                <nav className="panel-tabs" aria-label="パネルの切り替え">
                  {e.panel.tabs.map((tab) => (
                    <button
                      className="secondary"
                      key={tab.actionId ?? tab.command}
                      aria-pressed={tab.selected ?? false}
                      disabled={
                        busy ||
                        (!tab.actionId &&
                          !e.commands.some(
                            (command) => command.id === tab.command && command.available,
                          ))
                      }
                      onClick={() =>
                        void run(() =>
                          tab.actionId
                            ? window.dock.executePanelAction(e.id, tab.actionId)
                            : window.dock.executeCommand(tab.command),
                        )
                      }
                    >
                      {tab.title}
                    </button>
                  ))}
                </nav>
              )}
              {!!e.panel.images?.length && (
                <div className="panel-images">
                  {e.panel.images.map((item, i) => (
                    <PanelImageCard key={i} item={item} extension={e} busy={busy} run={run} />
                  ))}
                </div>
              )}
              <dl>
                {e.panel.facts?.map((f, i) => (
                  <div key={i}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="actions">
                {e.panel.actions?.map((a) => (
                  <button
                    className="secondary"
                    key={a.actionId ?? a.command}
                    disabled={
                      busy ||
                      (!a.actionId && !e.commands.some((c) => c.id === a.command && c.available))
                    }
                    onClick={() =>
                      void run(() =>
                        a.actionId
                          ? window.dock.executePanelAction(e.id, a.actionId)
                          : window.dock.executeCommand(a.command),
                      )
                    }
                  >
                    {a.title}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="inactive-panel">
              <Icon name="extensions" size={28} />
              <h3>
                {!e.enabled
                  ? 'このAppletをDockにつなぐ'
                  : e.state === 'waiting'
                    ? 'Appletの開始を待っています'
                    : e.state === 'starting'
                      ? 'Appletを起動しています'
                      : e.state === 'stopping'
                        ? 'Appletを停止しています'
                        : e.state === 'error'
                          ? 'Appletでエラーが発生しました'
                          : e.state === 'running'
                            ? '専用の操作画面はありません'
                            : 'Appletは停止しています'}
              </h3>
              <p>
                {!e.enabled
                  ? '有効にすると、Appletの画面とコマンドを使えます。'
                  : e.state === 'error'
                    ? 'ログを確認して、必要に応じて再起動してください。'
                    : e.state === 'running'
                      ? '設定やコマンド検索から操作できます。'
                      : '状態が変わるまでお待ちください。必要に応じて再起動できます。'}
              </p>
            </div>
          )}
          <details className="detail-meta">
            <summary>技術情報</summary>
            <div>
              <span>Extension ID</span>
              <code>{e.id}</code>
            </div>
            <div>
              <span>Host API</span>
              <p>{e.capabilities?.join(' · ') || 'なし'}</p>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
function SettingsPage({
  snapshot,
  version,
  runtime,
  extensions,
  run,
  busy,
  commands,
  avatarUrl,
  profileRequest,
  ribbonRequest,
  globalHotKeys,
  editor,
  onApplet,
  sidebarHost,
  sidebar,
  active,
}: {
  snapshot: SettingsSnapshot;
  version: string;
  runtime: HostSnapshot['runtime'];
  extensions: ExtensionSnapshot[];
  run: Run;
  busy: boolean;
  commands: UiCommand[];
  avatarUrl: string | null;
  profileRequest: number;
  ribbonRequest: number;
  editor: SettingsEditor;
  onApplet(id: string): void;
  globalHotKeys: GlobalHotKeyStatus[];
  sidebarHost: HTMLDivElement | null;
  sidebar: ReturnType<typeof useAppletSidebar>;
  active: boolean;
}) {
  const {
    draft,
    text,
    setText,
    dirty,
    setDirty,
    mode,
    setMode,
    setParseError,
    avatarDraft,
    avatarPreview,
    setAvatarDraft,
    setAvatarPreview,
    setAvatarLoading,
    edit,
    switchToForm,
  } = editor;
  const [category, setCategory] = useState<
    | 'appearance'
    | 'general'
    | 'extensions'
    | 'shortcuts'
    | 'host-shortcuts'
    | 'profile'
    | 'about'
    | 'ribbon'
  >('appearance');
  const [appletId, setAppletId] = useState('');
  const [appletTab, setAppletTab] = useState<AppletSettingsTab>('settings');
  const [appletSearch, setAppletSearch] = useState('');
  const selectedApplet = extensions.find((e) => e.id === appletId) ?? extensions[0];
  const settingsBody = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // Reset before paint so the next category never appears at the previous offset.
    if (settingsBody.current) settingsBody.current.scrollTop = 0;
  }, [category, selectedApplet?.id, appletTab, mode]);
  const changed = (part: unknown, original: unknown) =>
    JSON.stringify(part) !== JSON.stringify(original);
  const shortcutChanged = (owner: string | null) =>
    commands
      .filter((command) => command.extensionId === owner)
      .some(
        (command) =>
          changed(draft.shortcuts[command.id], snapshot.value.shortcuts[command.id]) ||
          draft.globalShortcutCommands.includes(command.id) !==
            snapshot.value.globalShortcutCommands.includes(command.id) ||
          draft.trayCommands.includes(command.id) !==
            snapshot.value.trayCommands.includes(command.id),
      );
  const appletChanged = (id: string) =>
    changed(draft.extensions[id], snapshot.value.extensions[id]) || shortcutChanged(id);
  const categoryChanged = (id: string) =>
    id === 'ribbon'
      ? changed(draft.ribbon, snapshot.value.ribbon)
      : id === 'about'
        ? false
        : id === 'appearance'
          ? draft.host.theme !== snapshot.value.host.theme
          : id === 'general'
            ? changed({ ...draft.host, theme: '' }, { ...snapshot.value.host, theme: '' })
            : id === 'profile'
              ? changed(draft.profile, snapshot.value.profile) || avatarDraft !== undefined
              : id === 'host-shortcuts'
                ? shortcutChanged(null)
                : id === 'shortcuts'
                  ? changed(draft.shortcuts, snapshot.value.shortcuts) ||
                    changed(draft.globalShortcutCommands, snapshot.value.globalShortcutCommands) ||
                    changed(draft.trayCommands, snapshot.value.trayCommands)
                  : extensions.some((e) => appletChanged(e.id));
  useEffect(() => {
    if (profileRequest) {
      setCategory('profile');
      switchToForm();
    }
  }, [profileRequest]);
  useEffect(() => {
    if (ribbonRequest) {
      setCategory('ribbon');
      switchToForm();
    }
  }, [ribbonRequest]);
  if (!active) return null;
  return (
    <>
      {active &&
        sidebarHost &&
        createPortal(
          <aside className="sidebar settings-categories" aria-label="設定一覧">
            <h2>設定</h2>
            <div className="sidebar-extensions">
              {(
                [
                  ['appearance', '表示'],
                  ['ribbon', 'リボン'],
                  ['general', '一般'],
                  ['shortcuts', 'ショートカット'],
                  ['profile', 'プロフィール'],
                  ['about', 'バージョン情報・更新'],
                ] as const
              ).map(([id, label]) => (
                <button
                  aria-current={category === id ? 'true' : undefined}
                  className={category === id ? 'selected' : ''}
                  key={id}
                  onClick={() => {
                    if (switchToForm()) setCategory(id);
                  }}
                >
                  <span title={label}>{label}</span>
                  {categoryChanged(id) && (
                    <small className="unsaved-mark" aria-label="未保存">
                      ●
                    </small>
                  )}
                </button>
              ))}
            </div>
            <div className="settings-applet-list">
              <h3>Applet別の設定</h3>
              <input
                aria-label="設定するAppletを検索"
                placeholder="Appletを検索…"
                value={appletSearch}
                onChange={(event) => setAppletSearch(event.target.value)}
              />
              <div className="sidebar-extensions">
                {'appdock'.includes(appletSearch.toLowerCase()) && (
                  <button
                    data-settings-owner="appdock"
                    className={category === 'host-shortcuts' ? 'selected' : ''}
                    aria-current={category === 'host-shortcuts' ? 'true' : undefined}
                    onClick={() => {
                      if (switchToForm()) setCategory('host-shortcuts');
                    }}
                  >
                    <span title="AppDock">AppDock</span>
                    {categoryChanged('host-shortcuts') && (
                      <small className="unsaved-mark" aria-label="未保存">
                        ●
                      </small>
                    )}
                  </button>
                )}
                {extensions
                  .filter((e) =>
                    (e.displayName + ' ' + e.name + ' ' + e.id)
                      .toLowerCase()
                      .includes(appletSearch.toLowerCase()),
                  )
                  .map((e) => (
                    <button
                      key={e.id}
                      className={
                        category === 'extensions' && selectedApplet?.id === e.id ? 'selected' : ''
                      }
                      aria-current={
                        category === 'extensions' && selectedApplet?.id === e.id
                          ? 'true'
                          : undefined
                      }
                      onClick={() => {
                        if (!switchToForm()) return;
                        setCategory('extensions');
                        setAppletId(e.id);
                      }}
                    >
                      <span title={e.displayName}>{e.displayName}</span>
                      {appletChanged(e.id) && (
                        <small className="unsaved-mark" aria-label="未保存">
                          ●
                        </small>
                      )}
                    </button>
                  ))}
                {!'appdock'.includes(appletSearch.toLowerCase()) &&
                  !extensions.some((e) =>
                    (e.displayName + ' ' + e.name + ' ' + e.id)
                      .toLowerCase()
                      .includes(appletSearch.toLowerCase()),
                  ) && <p className="empty">該当するAppletはありません。</p>}
              </div>
            </div>
            <div
              className="sidebar-resizer"
              {...sidebar.separatorProps}
              aria-label="設定一覧の幅を変更"
            />
          </aside>,
          sidebarHost,
        )}
      <PageHeading
        title="設定"
        action={
          <button
            className="secondary"
            onClick={() => void run(() => window.dock.openPath('settings'))}
          >
            <Icon name="folder" size={16} />
            ファイルを開く
          </button>
        }
      />
      <div
        className="settings-toolbar"
        style={category === 'about' ? { display: 'none' } : undefined}
      >
        <div className="tabs">
          <button
            className={mode === 'form' ? 'selected' : ''}
            onClick={() => {
              if (mode === 'json') switchToForm();
            }}
          >
            フォーム
          </button>
          <button
            className={mode === 'json' ? 'selected' : ''}
            onClick={() => {
              if (mode !== 'json') {
                setText(JSON.stringify(draft, null, 2));
                setMode('json');
              }
            }}
          >
            JSON
          </button>
        </div>
        <SettingsActions editor={editor} busy={busy} />
      </div>
      <div className="settings-body" ref={settingsBody}>
        <SettingsMessages editor={editor} currentRevision={snapshot.revision} />
        {mode === 'json' ? (
          <div className="json-editor">
            <div>
              <span>settings.json</span>
              <span>JSON · UTF-8</span>
            </div>
            <textarea
              spellCheck={false}
              aria-label="設定JSON"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setDirty(true);
              }}
            />
          </div>
        ) : (
          <div className="settings-layout">
            <div className="settings-form">
              {category === 'ribbon' && (
                <RibbonSettings draft={draft} extensions={extensions} onChange={edit} />
              )}
              {category === 'about' && (
                <section className="about-page" aria-label="バージョン情報・更新">
                  <div className="about-host">
                    <span className="section-label">APPDOCK</span>
                    <h2>
                      AppDock.at365 <span>v{version}</span>
                    </h2>
                    <p>現在使用しているバージョンと、公開されている正式版を確認できます。</p>
                    <VersionCheck details />
                    <dl className="runtime-versions">
                      <div>
                        <dt>Electron</dt>
                        <dd>{runtime.electron}</dd>
                      </div>
                      <div>
                        <dt>Chromium</dt>
                        <dd>{runtime.chrome}</dd>
                      </div>
                      <div>
                        <dt>Node.js</dt>
                        <dd>{runtime.node}</dd>
                      </div>
                      <div>
                        <dt>実行環境</dt>
                        <dd>
                          {runtime.platform} / {runtime.arch}
                        </dd>
                      </div>
                    </dl>
                    <p className="muted">
                      確認はボタンを押したときに行います。更新がある場合はリリースページから入手し、AppDockを終了して置き換えてください。
                    </p>
                  </div>
                  <h3>インストール済みのApplet</h3>
                  <p className="muted">更新確認先を持つAppletは、ここから確認できます。</p>
                  {extensions.length === 0 && <p>Appletはインストールされていません。</p>}
                  <div className="about-applets">
                    {extensions.map((e) => (
                      <article key={e.id}>
                        <div>
                          <strong>{e.displayName}</strong>
                          <span className="muted">v{e.version}</span>
                        </div>
                        <VersionCheck id={e.id} details />
                      </article>
                    ))}
                  </div>
                </section>
              )}
              {category === 'extensions' && selectedApplet && (
                <>
                  <div className="applet-settings-heading">
                    <h3>{selectedApplet.displayName}</h3>
                    <button className="text-button" onClick={() => onApplet(selectedApplet.id)}>
                      Appletに戻る
                    </button>
                  </div>
                  <AppletSettingsPanel
                    applet={selectedApplet}
                    editor={editor}
                    commands={commands}
                    globalHotKeys={globalHotKeys}
                    tab={appletTab}
                    onTab={setAppletTab}
                  />
                </>
              )}
              {(category === 'shortcuts' || category === 'host-shortcuts') && (
                <ShortcutsEditor
                  key={category}
                  commands={commands}
                  owner={category === 'host-shortcuts' ? null : undefined}
                  bindings={draft.shortcuts}
                  onChange={(shortcuts) => edit({ ...draft, shortcuts })}
                  globalCommands={draft.globalShortcutCommands}
                  onGlobalChange={(globalShortcutCommands) =>
                    edit({ ...draft, globalShortcutCommands })
                  }
                  statuses={globalHotKeys}
                  trayCommands={draft.trayCommands}
                  onTrayChange={(trayCommands) => edit({ ...draft, trayCommands })}
                  onRestore={(id) =>
                    editor.edit({
                      ...draft,
                      shortcuts: { ...draft.shortcuts, [id]: [...(defaultShortcuts[id] ?? [])] },
                      globalShortcutCommands: defaultGlobalShortcutCommands.includes(id)
                        ? [...new Set([...draft.globalShortcutCommands, id])]
                        : draft.globalShortcutCommands.filter((command) => command !== id),
                      trayCommands: draft.trayCommands.filter((command) => command !== id),
                    })
                  }
                />
              )}
              {category === 'profile' && (
                <ProfileEditor
                  name={draft.profile.name}
                  avatarUrl={avatarPreview === undefined ? avatarUrl : avatarPreview}
                  busy={busy}
                  onLoading={setAvatarLoading}
                  onName={(name) => edit({ ...draft, profile: { ...draft.profile, name } })}
                  onAvatar={(bytes, preview) => {
                    setAvatarDraft(bytes);
                    setAvatarPreview(preview);
                    edit({
                      ...draft,
                      profile: { ...draft.profile, avatar: bytes ? 'avatar.png' : null },
                    });
                  }}
                />
              )}
              {category === 'appearance' && (
                <>
                  <h3>表示</h3>
                  <SettingRow title="テーマ" description="ワークスペースの配色を選びます。">
                    <select
                      aria-label="テーマ"
                      value={draft.host.theme}
                      onChange={(e) =>
                        edit({
                          ...draft,
                          host: {
                            ...draft.host,
                            theme: e.target.value as Settings['host']['theme'],
                          },
                        })
                      }
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="system">System</option>
                    </select>
                  </SettingRow>
                </>
              )}
              {category === 'general' && (
                <>
                  <h3>一般</h3>
                  {(['trayClickCommand', 'trayDoubleClickCommand'] as const).map((key) => (
                    <SettingRow
                      key={key}
                      title={
                        key === 'trayClickCommand'
                          ? 'トレイクリックのコマンド'
                          : 'トレイダブルクリックのコマンド'
                      }
                      description={
                        key === 'trayClickCommand'
                          ? 'トレイアイコンをクリックしたときに実行します。既定は「AppDockを開く」です。'
                          : '既定は未設定です。割り当てると、シングルクリックはWindowsの判定時間だけ待機し、ダブルクリック時はこのコマンドだけを実行します。'
                      }
                    >
                      <select
                        aria-label={
                          key === 'trayClickCommand'
                            ? 'トレイクリックのコマンド'
                            : 'トレイダブルクリックのコマンド'
                        }
                        value={draft.host[key] ?? ''}
                        onChange={(event) =>
                          edit({
                            ...draft,
                            host: { ...draft.host, [key]: event.target.value || null },
                          })
                        }
                      >
                        {key === 'trayDoubleClickCommand' && (
                          <option value="">未設定（シングルクリックをすぐ実行）</option>
                        )}
                        {commands
                          .filter((command) => !command.hidden || command.id === draft.host[key])
                          .map((command) => (
                            <option key={command.id} value={command.id}>
                              {command.extension} / {command.title}
                              {command.available ? '' : '（現在利用できません）'}
                            </option>
                          ))}
                        {draft.host[key] &&
                          !commands.some((command) => command.id === draft.host[key]) && (
                            <option value={draft.host[key]}>
                              {draft.host[key]}（現在利用できません）
                            </option>
                          )}
                      </select>
                    </SettingRow>
                  ))}
                  {(
                    [
                      [
                        'closeToTray',
                        '閉じるとトレイに常駐',
                        'ウィンドウを閉じた後もAppletを動かします。',
                      ],
                      ['notifications', 'デスクトップ通知', 'Appletからの通知を表示します。'],
                      [
                        'hardwareAcceleration',
                        'ハードウェアアクセラレーション',
                        'GPUを使ってAppDockの画面を描画します。変更は保存後、AppDockを完全終了して起動し直すと反映されます。',
                      ],
                      [
                        'startMinimized',
                        'トレイから起動',
                        '次の起動時はウィンドウを表示せず、トレイに常駐します。',
                      ],
                    ] as const
                  ).map(([key, title, description]) => (
                    <SettingRow key={key} title={title} description={description}>
                      <Toggle
                        label={title}
                        checked={draft.host[key]}
                        onChange={(v) => edit({ ...draft, host: { ...draft.host, [key]: v } })}
                      />
                    </SettingRow>
                  ))}
                </>
              )}
              {category === 'extensions' && !selectedApplet && (
                <p className="empty">Appletはまだありません。</p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
function LogsPage({
  snapshot,
  run,
  source,
  onSource,
}: {
  snapshot: HostSnapshot;
  run: Run;
  source: string;
  onSource(value: string): void;
}) {
  const [filter, setFilter] = useState('');
  const [level, setLevel] = useState('all');
  const logs = snapshot.logs.filter(
    (l) =>
      (!source || l.source === source) &&
      (level === 'all' || level === l.level) &&
      `${l.source} ${l.message}`.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="ログ"
        action={
          <button
            className="secondary"
            onClick={() => void run(() => window.dock.openPath('logs'))}
          >
            <Icon name="folder" size={16} />
            保存先を開く
          </button>
        }
      />
      <div className="log-toolbar">
        <Icon name="search" size={16} />
        <input
          aria-label="ログを検索"
          placeholder="ログを検索…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          aria-label="ログのApplet"
          value={source}
          onChange={(event) => onSource(event.target.value)}
        >
          <option value="">すべてのログ</option>
          {[
            ...new Set([
              ...snapshot.extensions.map((e) => e.id),
              ...snapshot.logs.map((entry) => entry.source),
              ...(source ? [source] : []),
            ]),
          ].map((id) => (
            <option key={id} value={id}>
              {snapshot.extensions.find((e) => e.id === id)?.displayName ?? id}
            </option>
          ))}
        </select>
        <select aria-label="ログレベル" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="all">すべてのレベル</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>
        <span>{logs.length} 件</span>
      </div>
      <div className="log-table">
        <div className="log-head">
          <span>TIME</span>
          <span>LEVEL</span>
          <span>SOURCE / MESSAGE</span>
        </div>
        {[...logs].reverse().map((l, i) => (
          <div className="log-row" key={i}>
            <time>{new Date(l.time).toLocaleTimeString('ja-JP')}</time>
            <span className={`log-level ${l.level}`}>{l.level}</span>
            <div>
              <span>{l.source}</span>
              <p>{l.message}</p>
            </div>
          </div>
        ))}
        {logs.length === 0 && <div className="empty">該当するログはありません。</div>}
      </div>
      <p className="footnote">
        画面には直近500件を表示します。ファイルログは1MBでローテーションします。
      </p>
    </>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
