import { Icon, type IconName } from './Icon';
import { Toggle } from './Toggle';
import { CommandPalette } from './CommandPalette';
import { getKeybindings, resolveKeybindings } from '../shared/keybindings';
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
import { hostCommands, rankCommands, shortcutFromEvent, type UiCommand } from '../shared/commands';
import { ShortcutsEditor } from './ShortcutsEditor';
import { GesturesEditor } from './GesturesEditor';
import { TraySettings } from './TraySettings';
import { ProfileEditor } from './ProfileEditor';
import { AppletSettingsPanel } from './AppletSettingsPanel';
import { AppletIndex } from './AppletIndex';
import { orderApplets } from '../shared/applet-order';
import { SettingsToolbar, SettingsMessages } from './SettingsActions';
import { SettingsNotice } from './SettingsNotice';
import { useSettingsEditor, type SettingsEditor } from './useSettingsEditor';
import { VersionCheck } from './VersionCheck';
import { UpdateProgress } from './UpdateProgress';
import { UpdateSettings, AppletUpdateSource } from './UpdateSettings';
import { useRestartView } from './useRestartView';
import { useAppletSidebar } from './useAppletSidebar';
import { visibleRibbonItems, orderRibbon, type RibbonItem } from '../shared/applet-pages';
import { RibbonSettings } from './RibbonSettings';
import { WebAppletSettings } from './WebAppletSettings';
import { WebAccountSettings } from './WebAccountSettings';
import { CodexSettings } from './CodexSettings';
declare global {
  interface Window {
    dock: DockApi;
  }
}
type Page = 'home' | 'extensions' | 'settings' | 'logs' | `page:${string}`;
type AppletDetailView = 'description' | 'settings' | 'shortcuts' | 'logs';
const webManagerId = 'appdock.web-manager';
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
function App() {
  const appletSidebar = useAppletSidebar();
  const [settingsSidebarHost, setSettingsSidebarHost] = useState<HTMLDivElement | null>(null);
  const [snapshot, setSnapshot] = useState<HostSnapshot>();
  const [page, setPage] = useRestartView<Page>(
    'page',
    'home',
    (value) =>
      ['home', 'extensions', 'settings', 'logs'].includes(value) ||
      /^page:[a-z0-9.-]+:[a-z0-9.-]+$/.test(value),
  );
  const [restoringPage, setRestoringPage] = useState(page.startsWith('page:'));
  const openingRestoredPage = useRef(false);
  const [selected, setSelected] = useRestartView<string>('selected', '');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [palette, setPalette] = useState(false);
  const [busy, setBusy] = useState(false);
  const [profileRequest, setProfileRequest] = useState(0);
  const [updatesRequest, setUpdatesRequest] = useState(0);
  const [ribbonRequest, setRibbonRequest] = useState(0);
  const [webAccountsRequest, setWebAccountsRequest] = useState(0);
  const appletPageRef = useRef<HTMLDivElement>(null);
  const [detailView, setDetailView] = useRestartView<AppletDetailView>(
    'detailView',
    'description',
    ['description', 'settings', 'shortcuts', 'logs'],
  );
  const detailSettings = detailView === 'settings' || detailView === 'shortcuts';
  const editor = useSettingsEditor(snapshot?.settings, snapshot?.extensions ?? [], action);
  const noticeError = editor.parseError || editor.saveError;
  const lastEditorPage = useRef<Page>('settings');
  if (page === 'settings' || page === 'extensions') lastEditorPage.current = page;
  useEffect(() => {
    void window.dock
      .settingsNotice({
        visible: editor.dirty && page !== 'extensions' && page !== 'settings',
        busy: busy || editor.pending || editor.avatarLoading,
        dark: snapshot?.dark ?? true,
        message: noticeError.slice(0, 2000),
      })
      .catch((e) => setError(String(e)));
  }, [editor.dirty, page, busy, editor.pending, editor.avatarLoading, snapshot?.dark, noticeError]);
  const noticeAction = useRef<(action: 'save' | 'discard' | 'edit') => void>(() => {});
  noticeAction.current = (kind) => {
    if (busy || editor.pending || editor.avatarLoading) return;
    if (kind === 'edit') setPage(lastEditorPage.current);
    else if (kind === 'save') {
      setError('');
      void editor.save();
    } else {
      setError('');
      void editor.discard();
    }
  };
  useEffect(() => window.dock.onSettingsNoticeAction((kind) => noticeAction.current(kind)), []);
  useLayoutEffect(() => {
    // The retained detail view may be revisited after editing the shared JSON draft.
    if (page === 'extensions' && detailSettings && editor.mode === 'json') {
      if (!editor.switchToForm()) {
        setDetailView('description');
        setError('設定ページのJSONの内容を修正してから、Appletの設定を開いてください。');
      }
    }
  }, [page, detailSettings, editor.mode]);
  const orderedApplets = orderApplets(snapshot?.extensions ?? [], editor.draft.appletOrder);
  const [logSource, setLogSource] = useRestartView<string>('logSource', '');
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
  useEffect(() => {
    if (!restoringPage || !snapshot?.startupReady || openingRestoredPage.current) return;
    if (!page.startsWith('page:')) {
      setRestoringPage(false);
      return;
    }
    const [, id, pageId] = page.split(':');
    const extension = snapshot.extensions.find((e) => e.id === id);
    if (
      !extension?.enabled ||
      extension.state === 'error' ||
      !extension.pages?.some((p) => p.id === pageId)
    ) {
      setPage('home');
      setRestoringPage(false);
      return;
    }
    if (extension.state !== 'running') return;
    openingRestoredPage.current = true;
    void window.dock
      .openAppletPage(id, pageId)
      .catch((error) => {
        setError(String(error));
        setPage('home');
      })
      .finally(() => setRestoringPage(false));
  }, [snapshot, page, restoringPage]);
  useLayoutEffect(() => {
    const update = () => {
      const element = appletPageRef.current;
      const rect = element?.getBoundingClientRect();
      if (restoringPage) return;
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
  }, [page, palette, error, !!snapshot, restoringPage]);
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
      const matches =
        shortcut &&
        snapshot &&
        resolveKeybindings(
          getKeybindings(snapshot.settings.value),
          shortcut,
          {
            appFocused: true,
            appletId: !palette && page.startsWith('page:') ? page.split(':')[1] : undefined,
          },
          commands.filter((c) => c.available),
        );
      if (shortcut && matches && matches.length) {
        e.preventDefault();
        void window.dock
          .dispatchShortcut(shortcut)
          .then((result) => {
            if (result?.failed)
              setError('ショートカットの一部を実行できませんでした。ログを確認してください。');
            else if (result?.executed) setToast('コマンドを実行しました。');
          })
          .catch((error) => setError(String(error)));
      }
      if (e.key === 'Escape') setPalette(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [snapshot, busy, page, palette]);
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
    setPage('extensions');
  };
  const goWebManager = () => {
    if (!editor.switchToForm()) {
      setError('設定ページのJSONの内容を修正してからWebAppletの設定を開いてください。');
      return;
    }
    setSelected(webManagerId);
    setDetailView('settings');
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
  const paletteKey = snapshot?.settings.value.shortcuts['appdock.commands.search']?.[0];
  async function execute(id: string) {
    if (id === 'appdock.updates.open') {
      setUpdatesRequest((value) => value + 1);
      setPage('settings');
      return;
    }
    if (id === 'appdock.commands.search') {
      setPalette((v) => !v);
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
  const webManagerSelected = selected === webManagerId;
  const selectedApplet: ExtensionSnapshot | undefined = webManagerSelected
    ? {
        apiVersion: 1,
        id: webManagerId,
        name: 'WebApplet',
        displayName: 'WebApplet',
        description: 'WebサイトをAppletとして追加・管理します。各サイトをリボンから開けます。',
        version: snapshot?.version ?? '',
        runtime: 'web',
        entry: '',
        folder: '',
        state: 'running',
        enabled: true,
        error: null,
        commands: [],
        tray: [],
        panel: null,
        settingOptions: {},
      }
    : (orderedApplets.find((e) => e.id === selected) ?? orderedApplets[0]);
  const active = snapshot?.extensions.filter((e) => e.state === 'running').length ?? 0;
  const ribbon = orderRibbon(
    visibleRibbonItems(
      snapshot?.extensions ?? [],
      snapshot?.settings.value.ribbon.separators ?? [],
    ),
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
            {item.iconImage ? (
              <img src={item.iconImage} alt="" width={21} height={21} />
            ) : (
              <Icon
                name={
                  (item.id === 'theme' ? (snapshot?.dark ? 'sun' : 'moon') : item.icon) as IconName
                }
                size={21}
              />
            )}
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
          <AppletIndex
            applets={orderedApplets}
            selected={selectedApplet?.id}
            webManagerSelected={webManagerSelected}
            onWebManager={() => goExtension(webManagerId)}
            onSelect={goExtension}
            editor={editor}
            busy={busy}
          />
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
              ? 'applet-detail-main settings-main applet-detail-settings-main'
              : page.startsWith('page:')
                ? 'applet-page-main'
                : undefined
        }
      >
        {snapshot?.legacyLocalData && (
          <div className="error-banner" role="alert">
            旧保存領域にPC専用データが残っています。同期する前にAppDockを終了して旧データを整理してください。自動移行・削除は行いません。
          </div>
        )}
        {snapshot?.settings.syncError && (
          <div className="error-banner" role="alert">
            {snapshot.settings.syncError}
            {snapshot.settings.recovered && (
              <button
                disabled={busy || editor.dirty}
                onClick={() =>
                  void action(async () => {
                    await window.dock.restoreSettingsBackup(snapshot.settings.revision);
                  })
                }
              >
                バックアップで復元
              </button>
            )}
          </div>
        )}
        {error &&
          !(
            editor.dirty &&
            page !== 'settings' &&
            page !== 'extensions' &&
            editor.saveError === error
          ) && (
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
              <div className="applet-page-body">
                {snapshot.settings.value.webApplets.items
                  .filter((a) => `page:${a.id}:main` === page)
                  .map((a) => (
                    <div className="web-page-toolbar" key={a.id}>
                      <strong>{a.name}</strong>
                      <button
                        disabled={!snapshot.webPages[a.id]?.canGoBack}
                        onClick={() => void action(() => window.dock.webNavigate(a.id, 'back'))}
                      >
                        戻る
                      </button>
                      <button
                        disabled={!snapshot.webPages[a.id]?.canGoForward}
                        onClick={() => void action(() => window.dock.webNavigate(a.id, 'forward'))}
                      >
                        進む
                      </button>
                      <button
                        onClick={() => void action(() => window.dock.webNavigate(a.id, 'reload'))}
                      >
                        リロード
                      </button>
                      <button
                        onClick={() => void action(() => window.dock.webNavigate(a.id, 'home'))}
                      >
                        開始ページへ
                      </button>
                      <span>
                        {snapshot.webPages[a.id]?.loading
                          ? '読み込み中…'
                          : snapshot.webPages[a.id]?.error || snapshot.webPages[a.id]?.origin}
                      </span>
                    </div>
                  ))}
                <div
                  className="applet-page-viewport"
                  ref={appletPageRef}
                  aria-label="Appletページ"
                />
              </div>
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
                        <small className="command-id" title={c.extension}>
                          {c.id}
                        </small>
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
                  {orderedApplets.map((e) => (
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
                          {e.runtime === 'web'
                            ? 'WebApplet'
                            : e.runtime === 'node'
                              ? 'TypeScript'
                              : '.NET 10'}
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
                    <div className="actions">
                      <button
                        className="secondary"
                        onClick={() => {
                          goWebManager();
                        }}
                      >
                        WebAppletを追加
                      </button>
                      <button
                        className="secondary"
                        onClick={() => void action(() => window.dock.openPath('extensions'))}
                      >
                        <Icon name="folder" size={16} />
                        Appletフォルダを開く
                      </button>
                    </div>
                  }
                />
                <SettingsToolbar editor={editor} busy={busy} />
                {!detailSettings && (
                  <SettingsMessages editor={editor} currentRevision={snapshot.settings.revision} />
                )}
                <div className="extensions-layout">
                  <ExtensionDetail
                    builtin={webManagerSelected}
                    extension={selectedApplet}
                    view={detailView}
                    onView={(view) => {
                      if ((view === 'settings' || view === 'shortcuts') && !editor.switchToForm()) {
                        setError(
                          '設定ページのJSONの内容を修正してから、Appletの設定を開いてください。',
                        );
                        return false;
                      }
                      setDetailView(view);
                      return true;
                    }}
                    settingsPanel={
                      detailSettings && selectedApplet ? (
                        <>
                          <SettingsMessages
                            editor={editor}
                            currentRevision={snapshot.settings.revision}
                          />
                          {webManagerSelected ? (
                            <div className="applet-settings-panel">
                              <WebAppletSettings
                                editor={editor}
                                accounts={snapshot.webAccounts}
                                applets={orderedApplets.map((e) => ({
                                  id: e.id,
                                  title: e.displayName,
                                }))}
                                tab={detailView === 'shortcuts' ? 'shortcuts' : 'settings'}
                                onAccounts={() => {
                                  setPage('settings');
                                  setWebAccountsRequest((n) => n + 1);
                                }}
                              />
                            </div>
                          ) : (
                            <AppletSettingsPanel
                              commands={shortcutCommands}
                              applets={orderedApplets.map((e) => ({
                                id: e.id,
                                title: e.displayName,
                              }))}
                              applet={selectedApplet}
                              editor={editor}
                              tab={detailView === 'shortcuts' ? 'shortcuts' : 'settings'}
                              webAccounts={snapshot.webAccounts}
                              onWebAccounts={() => {
                                setPage('settings');
                                setWebAccountsRequest((n) => n + 1);
                              }}
                            />
                          )}
                        </>
                      ) : undefined
                    }
                    logsPanel={
                      detailView === 'logs' && selectedApplet ? (
                        <LogsPage
                          key={selectedApplet.id}
                          snapshot={snapshot}
                          run={action}
                          source={selectedApplet.id}
                          webManager={webManagerSelected}
                        />
                      ) : undefined
                    }
                    busy={busy}
                    updateDisabled={editor.dirty}
                    run={action}
                  />
                </div>
              </>
            )}
            <div className="settings-page" hidden={page !== 'settings'}>
              <SettingsPage
                snapshot={snapshot.settings}
                launch={snapshot.launch}
                version={snapshot.version}
                runtime={snapshot.runtime}
                extensions={orderedApplets}
                run={action}
                busy={busy}
                commands={shortcutCommands}
                avatarUrl={snapshot.avatarUrl}
                profileRequest={profileRequest}
                updatesRequest={updatesRequest}
                ribbonRequest={ribbonRequest}
                webAccountsRequest={webAccountsRequest}
                webAccounts={snapshot.webAccounts}
                editor={editor}
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
        <span className="statusbar-activity">
          <i />
          実行中 {active} Applet
        </span>
        <span>
          AppDock.at365 <span className="muted">v{snapshot?.version ?? '0.1.0'}</span>
          <VersionCheck compact disabled={editor.dirty} />
        </span>
        <button onClick={() => setPalette(true)}>
          <Icon name="command" size={12} />
          コマンドパレット {paletteKey && <kbd>{paletteKey}</kbd>}
        </button>
        {snapshot && (
          <UpdateProgress
            state={snapshot.updates}
            visible={snapshot.windowVisible}
            onDetails={() => void execute('appdock.updates.open')}
          />
        )}
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={17} />
          {toast}
        </div>
      )}
      {palette && (
        <CommandPalette
          commands={commands}
          pins={pins}
          onPinsChange={updatePins}
          shortcuts={snapshot?.settings.value.shortcuts}
          busy={busy}
          onChoose={(command) => void execute(command.id)}
          onClose={() => setPalette(false)}
        />
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
  updateDisabled,
  run,
  view,
  onView,
  settingsPanel,
  logsPanel,
  builtin = false,
}: {
  extension?: ExtensionSnapshot;
  view: AppletDetailView;
  onView(view: AppletDetailView): boolean;
  settingsPanel?: React.ReactNode;
  logsPanel?: React.ReactNode;
  builtin?: boolean;
  busy: boolean;
  updateDisabled: boolean;
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
            {builtin ? (
              '組み込み'
            ) : (
              <>
                v{e.version} <span className="divider">/</span>{' '}
                {e.runtime === 'web'
                  ? 'WebApplet'
                  : e.runtime === 'node'
                    ? 'TypeScript · Node.js'
                    : 'C# · .NET 10'}
              </>
            )}
          </p>
        </div>
        {!builtin && (
          <Toggle
            checked={e.enabled}
            label={`${e.displayName}を有効にする`}
            disabled={busy}
            onChange={(v) => void run(() => window.dock.toggleExtension(e.id, v))}
          />
        )}
      </div>
      <div className="detail-tabs" role="tablist" aria-label="Applet詳細の切り替え">
        {(
          [
            { id: 'description', title: '説明', icon: 'extensions' },
            { id: 'settings', title: '設定', icon: 'settings' },
            { id: 'shortcuts', title: 'ショートカット', icon: 'command' },
            { id: 'logs', title: 'ログ', icon: 'logs' },
          ] as const
        ).map((tab, index, tabs) => (
          <button
            key={tab.id}
            id={`applet-detail-tab-${tab.id}`}
            role="tab"
            aria-selected={view === tab.id}
            aria-controls="applet-detail-panel"
            tabIndex={view === tab.id ? 0 : -1}
            onClick={() => onView(tab.id)}
            onKeyDown={(event) => {
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % tabs.length
                  : event.key === 'ArrowLeft'
                    ? (index + tabs.length - 1) % tabs.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : undefined;
              if (next === undefined) return;
              event.preventDefault();
              if (onView(tabs[next].id))
                document.getElementById(`applet-detail-tab-${tabs[next].id}`)?.focus();
            }}
          >
            <Icon name={tab.icon} size={16} />
            {tab.title}
          </button>
        ))}
      </div>
      {settingsPanel ? (
        <div
          className="detail-settings"
          id="applet-detail-panel"
          role="tabpanel"
          aria-labelledby={`applet-detail-tab-${view}`}
        >
          {settingsPanel}
        </div>
      ) : logsPanel ? (
        <div
          className="detail-logs"
          id="applet-detail-panel"
          role="tabpanel"
          aria-labelledby="applet-detail-tab-logs"
        >
          {logsPanel}
        </div>
      ) : (
        <div
          className="detail-description-panel"
          id="applet-detail-panel"
          role="tabpanel"
          aria-labelledby="applet-detail-tab-description"
        >
          <p className="detail-description">{e.description}</p>
          {builtin ? (
            <>
              <p className="muted">
                設定タブでサイトを追加し、ショートカットタブで新しく追加するサイトの初期割り当てを編集できます。
              </p>
              <button className="secondary" onClick={() => onView('settings')}>
                WebAppletを追加・管理
              </button>
            </>
          ) : (
            <>
              {e.minimumHostVersion && (
                <p className="muted">AppDock v{e.minimumHostVersion}以降が必要です。</p>
              )}
              {e.runtime !== 'web' && (
                <VersionCheck key={e.id} id={e.id} disabled={busy || updateDisabled} />
              )}
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
                          (!a.actionId &&
                            !e.commands.some((c) => c.id === a.command && c.available))
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
        </div>
      )}
    </section>
  );
}
function SettingsPage({
  snapshot,
  launch,
  version,
  runtime,
  extensions,
  run,
  busy,
  commands,
  avatarUrl,
  profileRequest,
  updatesRequest,
  ribbonRequest,
  webAccountsRequest,
  webAccounts,
  globalHotKeys,
  editor,
  sidebarHost,
  sidebar,
  active,
}: {
  snapshot: SettingsSnapshot;
  launch: HostSnapshot['launch'];
  version: string;
  runtime: HostSnapshot['runtime'];
  extensions: ExtensionSnapshot[];
  run: Run;
  busy: boolean;
  commands: UiCommand[];
  avatarUrl: string | null;
  profileRequest: number;
  updatesRequest: number;
  ribbonRequest: number;
  webAccountsRequest: number;
  webAccounts: HostSnapshot['webAccounts'];
  editor: SettingsEditor;
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
    setAvatarName,
    setAvatarPreview,
    setAvatarLoading,
    edit,
    switchToForm,
  } = editor;
  const [category, setCategory] = useRestartView<
    | 'appearance'
    | 'tray'
    | 'general'
    | 'shortcuts'
    | 'gestures'
    | 'profile'
    | 'about'
    | 'ribbon'
    | 'web-accounts'
    | 'codex'
  >('category', 'appearance', [
    'appearance',
    'tray',
    'general',
    'shortcuts',
    'gestures',
    'profile',
    'about',
    'ribbon',
    'web-accounts',
    'codex',
  ]);
  const settingsBody = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // Reset before paint so the next category never appears at the previous offset.
    if (settingsBody.current) settingsBody.current.scrollTop = 0;
  }, [category, mode]);
  const changed = (part: unknown, original: unknown) =>
    JSON.stringify(part) !== JSON.stringify(original);
  const categoryChanged = (id: string) =>
    id === 'tray'
      ? changed(draft.trayMenu, snapshot.value.trayMenu) ||
        draft.host.trayClickCommand !== snapshot.value.host.trayClickCommand ||
        draft.host.trayDoubleClickCommand !== snapshot.value.host.trayDoubleClickCommand
      : id === 'gestures'
        ? changed(draft.gestures, snapshot.value.gestures)
        : id === 'web-accounts'
          ? false
          : id === 'ribbon'
            ? changed(draft.ribbon, snapshot.value.ribbon)
            : id === 'about'
              ? changed(draft.updates, snapshot.value.updates) ||
                extensions.some(
                  (e) =>
                    draft.extensions[e.id]?.updateSource !==
                    snapshot.value.extensions[e.id]?.updateSource,
                )
              : id === 'appearance'
                ? draft.host.theme !== snapshot.value.host.theme
                : id === 'general'
                  ? changed(
                      {
                        ...draft.host,
                        theme: '',
                        trayClickCommand: '',
                        trayDoubleClickCommand: null,
                      },
                      {
                        ...snapshot.value.host,
                        theme: '',
                        trayClickCommand: '',
                        trayDoubleClickCommand: null,
                      },
                    )
                  : id === 'profile'
                    ? changed(draft.profile, snapshot.value.profile) || avatarDraft !== undefined
                    : id === 'shortcuts'
                      ? changed(getKeybindings(draft), getKeybindings(snapshot.value)) ||
                        changed(draft.globalShortcutCommands, snapshot.value.globalShortcutCommands)
                      : false;
  useEffect(() => {
    if (profileRequest) {
      setCategory('profile');
      switchToForm();
    }
  }, [profileRequest]);
  useEffect(() => {
    if (updatesRequest && switchToForm()) setCategory('about');
  }, [updatesRequest]);
  useEffect(() => {
    if (ribbonRequest) {
      setCategory('ribbon');
      switchToForm();
    }
  }, [ribbonRequest]);
  useEffect(() => {
    if (webAccountsRequest) setCategory('web-accounts');
  }, [webAccountsRequest]);
  const navigateSettings = () =>
    (['web-accounts', 'codex'].includes(category) && mode === 'json') || switchToForm();
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
                  ['general', '一般'],
                  ['ribbon', 'リボン'],
                  ['tray', 'タスクトレイ'],
                  ['shortcuts', 'ショートカット'],
                  ['gestures', 'マウスジェスチャー'],
                  ['web-accounts', 'Webアカウント'],
                  ['codex', 'Codex連携'],
                  ['profile', 'プロフィール'],
                  ['about', 'バージョン情報・更新'],
                ] as const
              ).map(([id, label]) => (
                <button
                  aria-current={category === id ? 'true' : undefined}
                  className={category === id ? 'selected' : ''}
                  key={id}
                  onClick={() => {
                    if (id === 'web-accounts' || id === 'codex' || navigateSettings())
                      setCategory(id);
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
          ['web-accounts', 'codex'].includes(category) ? undefined : (
            <button
              className="secondary"
              onClick={() => void run(() => window.dock.openPath('settings'))}
            >
              <Icon name="folder" size={16} />
              ファイルを開く
            </button>
          )
        }
      />
      <SettingsToolbar editor={editor} busy={busy}>
        {!['web-accounts', 'codex'].includes(category) && (
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
        )}
      </SettingsToolbar>
      <div className="settings-body" ref={settingsBody}>
        <SettingsMessages editor={editor} currentRevision={snapshot.revision} />
        {category === 'codex' ? (
          <div className="settings-layout">
            <div className="settings-form">
              <CodexSettings />
            </div>
          </div>
        ) : category === 'web-accounts' ? (
          <div className="settings-layout">
            <div className="settings-form">
              <WebAccountSettings
                accounts={webAccounts}
                savedItems={snapshot.value.webApplets.items}
                draftItems={draft.webApplets.items}
              />
            </div>
          </div>
        ) : mode === 'json' ? (
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
              {category === 'gestures' && (
                <GesturesEditor
                  settings={draft}
                  onChange={edit}
                  commands={commands}
                  applets={extensions}
                />
              )}
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
                    <VersionCheck details disabled={dirty} />
                    <UpdateSettings
                      draft={draft}
                      edit={edit}
                      appletCount={extensions.length}
                      dirty={dirty}
                    />
                    <details className="update-disclosure">
                      <summary>実行環境の詳細</summary>
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
                    </details>
                  </div>
                  <h3>インストール済みのApplet</h3>
                  <p className="muted">
                    Appletごとに更新できます。更新元を変えるときは各欄の設定を開いてください。
                  </p>
                  {extensions.length === 0 && <p>Appletはインストールされていません。</p>}
                  <div className="about-applets">
                    {extensions
                      .filter((e) => e.runtime !== 'web')
                      .map((e) => (
                        <article key={e.id}>
                          <div>
                            <strong>{e.displayName}</strong>
                            <span className="muted">v{e.version}</span>
                          </div>
                          <VersionCheck id={e.id} details disabled={dirty} />
                          <AppletUpdateSource extension={e} draft={draft} edit={edit} />
                        </article>
                      ))}
                  </div>
                </section>
              )}
              {category === 'shortcuts' && (
                <ShortcutsEditor
                  key={category}
                  commands={commands}
                  settings={draft}
                  onChange={edit}
                  applets={extensions.map((e) => ({ id: e.id, title: e.displayName }))}
                  statuses={globalHotKeys}
                />
              )}
              {category === 'profile' && (
                <ProfileEditor
                  name={draft.profile.name}
                  avatarUrl={avatarPreview === undefined ? avatarUrl : avatarPreview}
                  busy={busy}
                  onLoading={setAvatarLoading}
                  onName={(name) => edit({ ...draft, profile: { ...draft.profile, name } })}
                  onAvatar={(bytes, preview, name) => {
                    setAvatarDraft(bytes);
                    setAvatarName(name);
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
              {category === 'tray' && (
                <TraySettings
                  draft={draft}
                  extensions={extensions}
                  commands={commands}
                  onChange={edit}
                />
              )}
              {category === 'general' && (
                <>
                  <h3>一般</h3>
                  <SettingRow
                    title="スタートアップに登録"
                    description="Windowsへのサインイン時に、この場所のAppDockを起動します。変更は保存時に反映します。"
                  >
                    <Toggle
                      label="スタートアップに登録"
                      checked={draft.host.startAtLogon}
                      disabled={!launch.supported}
                      onChange={(v) => edit({ ...draft, host: { ...draft.host, startAtLogon: v } })}
                    />
                  </SettingRow>
                  <SettingRow
                    title="常に管理者として起動"
                    description="次の起動から管理者権限を使います。管理者でのスタートアップ登録・変更にはUAC確認が必要です。登録後のサインイン時には確認を出しません。手動起動ではUAC確認が表示されます。"
                  >
                    <Toggle
                      label="常に管理者として起動"
                      checked={draft.host.runAsAdministrator}
                      disabled={!launch.supported}
                      onChange={(v) =>
                        edit({ ...draft, host: { ...draft.host, runAsAdministrator: v } })
                      }
                    />
                  </SettingRow>
                  <SettingRow
                    title="現在の起動状態"
                    description={
                      launch.supported
                        ? `${launch.elevated ? '管理者権限で動作中' : '通常権限で動作中'}。スタートアップ: ${launch.registered ? (launch.taskElevated ? '登録済み（管理者）' : '登録済み（通常権限）') : '未登録'}。`
                        : '起動設定はWindowsの発行版AppDockで使用できます。'
                    }
                  >
                    <div className="button-row">
                      <button
                        disabled={!launch.supported || busy}
                        onClick={() => void run(() => window.dock.refreshLaunchState())}
                      >
                        状態を確認
                      </button>
                      <button
                        disabled={!launch.supported || launch.elevated || dirty || busy}
                        onClick={() => void run(() => window.dock.restartAsAdministrator())}
                      >
                        管理者として再起動
                      </button>
                    </div>
                  </SettingRow>
                  {launch.error && <p role="alert">{launch.error}</p>}
                  {launch.supported && (
                    <p className="muted">
                      起動設定はこのEXEの配置先ごとに登録します。移動する前に登録を解除してください。管理者設定をOFFにした場合は、AppDockを完全終了し、通常の方法で起動し直してください。再起動する前に、編集中の設定を保存してください。
                    </p>
                  )}
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
  webManager = false,
}: {
  snapshot: HostSnapshot;
  run: Run;
  source: string;
  onSource?(value: string): void;
  webManager?: boolean;
}) {
  const [filter, setFilter] = useState('');
  const [level, setLevel] = useState('all');
  const logs = snapshot.logs.filter(
    (l) =>
      (webManager
        ? l.source.startsWith('web.') || l.source === 'web-applets'
        : !source || l.source === source) &&
      (level === 'all' || level === l.level) &&
      `${l.source} ${l.message}`.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading compact">
        {onSource ? <h1>ログ</h1> : <h3>ログ</h3>}
        <button className="secondary" onClick={() => void run(() => window.dock.openPath('logs'))}>
          <Icon name="folder" size={16} />
          保存先を開く
        </button>
      </div>
      <div className="log-toolbar">
        <Icon name="search" size={16} />
        <input
          aria-label="ログを検索"
          placeholder="ログを検索…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {onSource && (
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
        )}
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
createRoot(document.getElementById('root')!).render(
  new URLSearchParams(location.search).has('settingsNotice') ? <SettingsNotice /> : <App />,
);
