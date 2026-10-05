import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  DockApi,
  HostSnapshot,
  ExtensionSnapshot,
  Settings,
  SettingsSnapshot,
} from '../shared/contracts';
import './style.css';
import { parseSettings } from '../shared/settings-schema';
import {
  hostCommands,
  rankCommands,
  movePinnedCommand,
  shortcutFromEvent,
  type UiCommand,
} from '../shared/commands';
import { ShortcutsEditor } from './ShortcutsEditor';
import { ProfileEditor } from './ProfileEditor';
declare global {
  interface Window {
    dock: DockApi;
  }
}
type Page = 'home' | 'extensions' | 'settings' | 'logs';
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
const labels: Record<Page, string> = {
  home: 'ホーム',
  extensions: '拡張機能',
  settings: '設定',
  logs: 'ログ',
};
const states = {
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
  const [snapshot, setSnapshot] = useState<HostSnapshot>();
  const [page, setPage] = useState<Page>('home');
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [profileRequest, setProfileRequest] = useState(0);
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
    const handler = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.isComposing ||
        e.repeat ||
        (e.target instanceof Element && e.target.closest('[data-shortcut-recorder]'))
      )
        return;
      const shortcut = shortcutFromEvent(e);
      const commandId =
        shortcut &&
        Object.entries(snapshot?.settings.value.shortcuts ?? {}).find(([, values]) =>
          values.includes(shortcut),
        )?.[0];
      if (commandId && commands.some((c) => c.id === commandId)) {
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
    setPage('extensions');
  };
  const commands: UiCommand[] = [
    ...hostCommands,
    ...(snapshot?.extensions.flatMap((e) =>
      e.commands.map((c) => ({ ...c, extension: e.name, available: true })),
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
      ]),
    ]
      .filter((id) => !commandIds.has(id))
      .map((id) => ({
        ...(knownCommands.current.get(id) ?? { id, title: id, extension: '拡張コマンド' }),
        available: false,
      })),
  ];
  const pins = snapshot?.settings.value.pinnedCommands ?? [];
  const filteredCommands = rankCommands(
    commands.filter((c) => (c.title + ' ' + c.id).toLowerCase().includes(query.toLowerCase())),
    pins,
  );
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
  const active = snapshot?.extensions.filter((e) => e.state === 'running').length ?? 0;
  return (
    <div className="shell">
      <header className="titlebar">
        <div className="title-brand">
          <Brand small />
          <span>
            AppDock<span className="muted">.at365</span>
          </span>
        </div>
        <span className="titlebar-center">Personal workspace</span>
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
      <aside className="activity-rail">
        <Brand />
        {(['home', 'extensions', 'settings', 'logs'] as Page[]).map((p) => (
          <button
            key={p}
            title={labels[p]}
            aria-label={labels[p]}
            className={page === p ? 'active' : ''}
            onClick={() => setPage(p)}
          >
            <Icon name={p} size={21} />
          </button>
        ))}
        <div className="rail-spacer" />
        <button
          title="テーマを切り替え"
          aria-label="テーマを切り替え"
          onClick={() =>
            snapshot &&
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
            )
          }
        >
          <Icon name={snapshot?.dark ? 'sun' : 'moon'} size={20} />
        </button>
        <button
          className="avatar"
          aria-label="プロフィール設定を開く"
          title={snapshot?.settings.value.profile.name}
          onClick={() => {
            setPage('settings');
            setProfileRequest((v) => v + 1);
          }}
        >
          {snapshot?.avatarUrl ? (
            <img src={snapshot.avatarUrl} alt="ユーザーのアバター" />
          ) : (
            Array.from(snapshot?.settings.value.profile.name ?? 'ユキ')[0]
          )}
        </button>
      </aside>
      <aside className="sidebar">
        <div className="workspace-label">
          WORKSPACE
          <span className="tiny-dot" />
        </div>
        <div className="workspace-name">
          My Dock <span>01</span>
        </div>
        <button
          className="search-button"
          onClick={() => {
            setPalette(true);
            setQuery('');
          }}
        >
          <Icon name="search" size={15} />
          コマンドを検索{paletteKey && <kbd>{paletteKey}</kbd>}
        </button>
        <nav>
          {(['home', 'extensions', 'settings', 'logs'] as Page[]).map((p) => (
            <button key={p} className={page === p ? 'selected' : ''} onClick={() => setPage(p)}>
              <Icon name={p} />
              {labels[p]}
              {p === 'extensions' && (
                <span className="count">{snapshot?.extensions.length ?? 0}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-section">YOUR EXTENSIONS</div>
        <div className="sidebar-extensions">
          {snapshot?.extensions.map((e) => (
            <button
              key={e.id}
              onClick={() => goExtension(e.id)}
              className={page === 'extensions' && selected === e.id ? 'selected' : ''}
            >
              <i className={`extension-dot ${e.state}`} />
              <span>{e.name}</span>
              <small>{e.runtime === 'node' ? 'TS' : 'C#'}</small>
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="connection">
            <i />
            {active > 0 ? 'Dock is connected' : 'Dock is ready'}
          </div>
          <span>小さな道具の、帰る場所。</span>
          <strong className="profile-name">{snapshot?.settings.value.profile.name}</strong>
        </div>
      </aside>
      <main>
        <div className="breadcrumb">
          My Dock
          <Icon name="chevron" size={12} />
          <strong>{labels[page]}</strong>
          <span className="local-label">
            <i />
            LOCAL WORKSPACE
          </span>
        </div>
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
            {page === 'home' && (
              <>
                <div className="page-heading">
                  <div>
                    <div className="eyebrow">MAKE ROOM FOR YOUR TOOLS</div>
                    <h1>
                      Welcome to your Dock<span className="accent">.</span>
                    </h1>
                    <p>いつもの道具を、ひとつのワークスペースに。</p>
                  </div>
                  <button className="secondary" onClick={() => setPage('extensions')}>
                    <Icon name="extensions" size={16} />
                    拡張機能を管理
                  </button>
                </div>
                <div className="hero">
                  <div className="hero-copy">
                    <span className="hero-label">
                      <i />
                      YOUR PERSONAL APP HOST
                    </span>
                    <h2>
                      ひとつの場所から、
                      <br />
                      できることを増やそう。
                    </h2>
                    <p>
                      拡張をつないで、あなたのDockを育てていく。
                      <br />
                      設定もコマンドも、この場所から。
                    </p>
                    <button className="primary" onClick={() => setPage('extensions')}>
                      Dockを見てみる
                      <Icon name="arrow" size={17} />
                    </button>
                  </div>
                  <div className="dock-art" aria-hidden="true">
                    <div className="orbit orbit-1" />
                    <div className="orbit orbit-2" />
                    <div className="dock-core">
                      <Brand />
                    </div>
                    <div className="art-tile mail">
                      <Icon name="mail" size={25} />
                    </div>
                    <div className="art-tile clock">
                      <Icon name="clock" size={25} />
                    </div>
                    <div className="art-tile image">
                      <Icon name="image" size={25} />
                    </div>
                    <span className="star s1" />
                    <span className="star s2" />
                    <span className="star s3" />
                  </div>
                </div>
                <div className="stats">
                  <div>
                    <span className="stat-icon green">
                      <Icon name="play" />
                    </span>
                    <div>
                      <span>実行中の拡張</span>
                      <strong>
                        {active}
                        <small> / {snapshot.extensions.length}</small>
                      </strong>
                    </div>
                    <span className="stat-note">Ready to work</span>
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
                      <Icon name="settings" />
                    </span>
                    <div>
                      <span>設定ファイル</span>
                      <strong className="stat-text">settings.json</strong>
                    </div>
                    <span className="stat-note">EXEと同じ場所</span>
                  </div>
                </div>
                <div className="section-heading">
                  <h3>
                    Your extensions<span>{snapshot.extensions.length}</span>
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
                      <h3>{e.name}</h3>
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
                <div className="next-strip">
                  <span className="next-label">NEXT ON YOUR DOCK</span>
                  <div>
                    <Icon name="mail" size={15} />
                    GmailChecker
                  </div>
                  <div>
                    <Icon name="clock" size={15} />
                    Watch
                  </div>
                  <div>
                    <Icon name="image" size={15} />
                    WallpaperSlideshow
                  </div>
                  <span className="muted">これから、ひとつずつ。</span>
                </div>
              </>
            )}
            {page === 'extensions' && (
              <>
                <PageHeading
                  title="拡張機能"
                  subtitle="必要な道具をつないで、Dockをあなたらしく。"
                  action={
                    <button
                      className="secondary"
                      onClick={() => void action(() => window.dock.openPath('extensions'))}
                    >
                      <Icon name="folder" size={16} />
                      拡張フォルダを開く
                    </button>
                  }
                />
                <div className="extensions-layout">
                  <div className="extension-list">
                    {snapshot.extensions.map((e) => (
                      <button
                        className={selected === e.id ? 'selected' : ''}
                        key={e.id}
                        onClick={() => setSelected(e.id)}
                      >
                        <span className={`extension-icon ${e.runtime}`}>
                          <Icon name="extensions" size={20} />
                        </span>
                        <div>
                          <strong>{e.name}</strong>
                          <span>
                            {e.runtime === 'node' ? 'TypeScript / Node.js' : 'C# / .NET 10'}
                          </span>
                        </div>
                        <i className={`extension-dot ${e.state}`} />
                      </button>
                    ))}
                  </div>
                  <ExtensionDetail
                    extension={
                      snapshot.extensions.find((e) => e.id === selected) ?? snapshot.extensions[0]
                    }
                    busy={busy}
                    run={action}
                  />
                </div>
                <div className="migration-note">
                  <span>これから載せる道具</span>
                  <p>
                    GmailChecker・Watch・WallpaperSlideshowの移行先として使えるホストです。現在は接続を確認するサンプル拡張を搭載しています。
                  </p>
                </div>
              </>
            )}
            <div hidden={page !== 'settings'}>
              <SettingsPage
                snapshot={snapshot.settings}
                extensions={snapshot.extensions}
                run={action}
                busy={busy}
                commands={shortcutCommands}
                avatarUrl={snapshot.avatarUrl}
                profileRequest={profileRequest}
              />
            </div>
            {page === 'logs' && <LogsPage snapshot={snapshot} run={action} />}
          </div>
        )}
      </main>
      <footer className="statusbar">
        <span>
          <i />
          {active} extensions running
        </span>
        <span>
          AppDock.at365 <span className="muted">v{snapshot?.version ?? '0.1.0'}</span>
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
            role="dialog"
            aria-label="コマンドパレット"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="palette-input">
              <Icon name="search" />
              <input
                autoFocus
                placeholder="コマンドを入力…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>Esc</kbd>
            </div>
            <div className="palette-label">COMMANDS</div>
            {filteredCommands.map((c) => {
              const pinned = pins.includes(c.id);
              const index = visiblePins.indexOf(c.id);
              return (
                <div
                  className={`palette-command ${pinned ? 'pinned' : ''}`}
                  key={c.id}
                  data-command-id={c.id}
                >
                  <button
                    className="palette-execute"
                    disabled={busy}
                    onClick={() => void execute(c.id)}
                  >
                    <Icon name="play" size={16} />
                    <div>
                      {c.title}
                      <small>
                        {c.extension}
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
                          onClick={() => updatePins(movePinnedCommand(pins, c.id, -1, visiblePins))}
                        >
                          ↑
                        </button>
                        <button
                          aria-label={`${c.title}を下に移動`}
                          disabled={busy || index === visiblePins.length - 1}
                          onClick={() => updatePins(movePinnedCommand(pins, c.id, 1, visiblePins))}
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
            {filteredCommands.length === 0 && <p>該当するコマンドはありません。</p>}
            <div className="palette-footer">★でピン留め。↑↓でピンの順番を変更できます。</div>
          </div>
        </div>
      )}
    </div>
  );
}
function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading compact">
      <div>
        <div className="eyebrow">YOUR WORKSPACE</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
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
}: {
  extension?: ExtensionSnapshot;
  busy: boolean;
  run: Run;
}) {
  if (!e)
    return (
      <section className="detail empty">
        拡張フォルダにextension.jsonを配置してAppDockを起動し直してください。
      </section>
    );
  return (
    <section className="detail">
      <div className="detail-heading">
        <span className={`extension-icon large ${e.runtime}`}>
          <Icon name="extensions" size={30} />
        </span>
        <div>
          <h2>{e.name}</h2>
          <p>
            v{e.version} <span className="divider">/</span>{' '}
            {e.runtime === 'node' ? 'TypeScript · Node.js' : 'C# · .NET 10'}
          </p>
        </div>
        <Toggle
          checked={e.enabled}
          label={`${e.name}を有効にする`}
          disabled={busy}
          onChange={(v) => void run(() => window.dock.toggleExtension(e.id, v))}
        />
      </div>
      <p className="detail-description">{e.description}</p>
      <div className="detail-state">
        <StateBadge extension={e} />
        <button
          className="text-button"
          disabled={busy || !e.enabled}
          onClick={() =>
            void run(() => window.dock.restartExtension(e.id), '拡張を再起動しました。')
          }
        >
          <Icon name="refresh" size={14} />
          再起動
        </button>
      </div>
      {e.error && <div className="error-text">{e.error}</div>}
      {e.panel ? (
        <div className="extension-panel">
          <div className="eyebrow">EXTENSION VIEW</div>
          <h3>{e.panel.title}</h3>
          <p>{e.panel.description}</p>
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
                key={a.command}
                disabled={busy || !e.commands.some((c) => c.id === a.command)}
                onClick={() =>
                  void run(() => window.dock.executeCommand(a.command), 'コマンドを実行しました。')
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
          <h3>この拡張をDockにつなぐ</h3>
          <p>有効にすると、拡張の画面とコマンドを使えます。</p>
        </div>
      )}
      <div className="detail-meta">
        <div>
          <span>Extension ID</span>
          <code>{e.id}</code>
        </div>
        <div>
          <span>Host API</span>
          <p>{e.capabilities?.join(' · ') || 'なし'}</p>
        </div>
      </div>
    </section>
  );
}
function SettingsPage({
  snapshot,
  extensions,
  run,
  busy,
  commands,
  avatarUrl,
  profileRequest,
}: {
  snapshot: SettingsSnapshot;
  extensions: ExtensionSnapshot[];
  run: Run;
  busy: boolean;
  commands: UiCommand[];
  avatarUrl: string | null;
  profileRequest: number;
}) {
  const [draft, setDraft] = useState<Settings>(snapshot.value);
  const [text, setText] = useState(JSON.stringify(snapshot.value, null, 2));
  const [revision, setRevision] = useState(snapshot.revision);
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [parseError, setParseError] = useState('');
  const [category, setCategory] = useState<
    'appearance' | 'general' | 'extensions' | 'shortcuts' | 'profile'
  >('appearance');
  const [avatarDraft, setAvatarDraft] = useState<Uint8Array | null | undefined>(undefined);
  const [avatarPreview, setAvatarPreview] = useState<string | null | undefined>(undefined);
  const [avatarLoading, setAvatarLoading] = useState(false);
  useEffect(() => {
    if (profileRequest) setCategory('profile');
  }, [profileRequest]);
  useEffect(() => {
    if (!dirty) {
      setDraft(snapshot.value);
      setText(JSON.stringify(snapshot.value, null, 2));
      setRevision(snapshot.revision);
    }
  }, [snapshot.revision, dirty]);
  const edit = (value: Settings) => {
    setDraft(value);
    setText(JSON.stringify(value, null, 2));
    setDirty(true);
  };
  const reset = () => {
    setDirty(false);
    setDraft(snapshot.value);
    setText(JSON.stringify(snapshot.value, null, 2));
    setRevision(snapshot.revision);
    setParseError('');
    setAvatarDraft(undefined);
    setAvatarPreview(undefined);
  };
  const save = async () => {
    let value: Settings;
    try {
      value = parseSettings(mode === 'json' ? JSON.parse(text) : draft);
      setParseError('');
    } catch (e) {
      setParseError(
        `${mode === 'json' ? 'JSONの形式' : '設定の内容'}を確認してください。${e instanceof Error ? e.message : e}`,
      );
      return;
    }
    await run(async () => {
      const result = await window.dock.saveSettings(value, revision, avatarDraft);
      setRevision(result.revision);
      setDirty(false);
      setAvatarDraft(undefined);
      setAvatarPreview(undefined);
    }, '設定を保存しました。');
  };
  return (
    <>
      <PageHeading
        title="設定"
        subtitle="使い心地を整える。変更は保存すると反映されます。"
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
      <div className="settings-toolbar">
        <div className="tabs">
          <button
            className={mode === 'form' ? 'selected' : ''}
            onClick={() => {
              if (mode === 'json') {
                try {
                  const v = parseSettings(JSON.parse(text));
                  setDraft(v);
                  setParseError('');
                  setMode('form');
                } catch (e) {
                  setParseError(String(e));
                }
              }
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
        <span className={dirty ? 'unsaved' : 'muted'}>
          {dirty ? '未保存の変更があります' : 'すべて保存されています'}
        </span>
        <button className="text-button" disabled={!dirty || busy || avatarLoading} onClick={reset}>
          再読み込み
        </button>
        <button
          className="primary"
          disabled={!dirty || busy || avatarLoading}
          onClick={() => void save()}
        >
          <Icon name="check" size={16} />
          保存
        </button>
      </div>
      {parseError && (
        <div className="error-text" role="alert">
          {parseError}
        </div>
      )}
      {dirty && revision !== snapshot.revision && (
        <div className="error-text">
          別の場所で設定が変わりました。編集中の内容は保持しています。再読み込みして変更をやり直してください。
        </div>
      )}
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
          <div className="settings-categories">
            {(
              [
                ['appearance', '表示', 'sun'],
                ['general', '一般', 'settings'],
                ['extensions', '拡張設定', 'extensions'],
                ['shortcuts', 'ショートカット', 'command'],
                ['profile', 'プロフィール', 'home'],
              ] as const
            ).map(([id, label, icon]) => (
              <button
                className={category === id ? 'selected' : ''}
                key={id}
                onClick={() => setCategory(id)}
              >
                <Icon name={icon} size={16} />
                {label}
              </button>
            ))}
          </div>
          <div className="settings-form">
            {category === 'shortcuts' && (
              <ShortcutsEditor
                commands={commands}
                bindings={draft.shortcuts}
                onChange={(shortcuts) => edit({ ...draft, shortcuts })}
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
                        host: { ...draft.host, theme: e.target.value as Settings['host']['theme'] },
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
                {(
                  [
                    [
                      'closeToTray',
                      '閉じるとトレイに常駐',
                      'ウィンドウを閉じた後も拡張を動かします。',
                    ],
                    ['notifications', 'デスクトップ通知', '拡張からの通知を表示します。'],
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
            {category === 'extensions' &&
              extensions
                .filter((e) => e.settings?.length)
                .map((e) => (
                  <React.Fragment key={e.id}>
                    <h3>{e.name}</h3>
                    {e.settings?.map((s) => {
                      const value = draft.extensions[e.id]?.settings[s.key] ?? s.default;
                      const set = (v: unknown) =>
                        edit({
                          ...draft,
                          extensions: {
                            ...draft.extensions,
                            [e.id]: {
                              ...(draft.extensions[e.id] || { enabled: false, settings: {} }),
                              settings: { ...draft.extensions[e.id]?.settings, [s.key]: v },
                            },
                          },
                        });
                      return (
                        <SettingRow key={s.key} title={s.title} description={s.key}>
                          {s.type === 'boolean' ? (
                            <Toggle checked={Boolean(value)} label={s.title} onChange={set} />
                          ) : (
                            <input
                              aria-label={s.title}
                              type={s.type === 'number' ? 'number' : 'text'}
                              min={s.minimum}
                              max={s.maximum}
                              value={String(value ?? '')}
                              onChange={(ev) =>
                                set(s.type === 'number' ? Number(ev.target.value) : ev.target.value)
                              }
                            />
                          )}
                        </SettingRow>
                      );
                    })}
                  </React.Fragment>
                ))}
          </div>
        </div>
      )}
      <div className="settings-path">
        <Icon name="folder" size={16} />
        <code>{snapshot.path}</code>
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
function LogsPage({ snapshot, run }: { snapshot: HostSnapshot; run: Run }) {
  const [filter, setFilter] = useState('');
  const [level, setLevel] = useState('all');
  const logs = snapshot.logs.filter(
    (l) =>
      (level === 'all' || level === l.level) &&
      `${l.source} ${l.message}`.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="ログ"
        subtitle="ホストと拡張の動作を、ここから確認。"
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
        <select aria-label="ログレベル" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="all">All levels</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>
        <span>{logs.length} entries</span>
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
