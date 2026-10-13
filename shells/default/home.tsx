import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { HomePageModel, ShellPageModel, ShellPageApi } from '../../src/shared/shell-pages';
import { Icon } from '../../src/shared/ui-icons';
import { shortcutFromEvent } from '../../src/shared/commands';
import './home.css';
document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches
  ? 'dark'
  : 'light';
declare global {
  interface Window {
    appdockPage: ShellPageApi;
  }
}
const api = window.appdockPage;
const states = {
  waiting: '開始待ち',
  running: '実行中',
  stopped: '停止中',
  starting: '起動中',
  stopping: '停止処理中',
  error: 'エラー',
};
function App() {
  const [model, setModel] = useState<HomePageModel>();
  const [session, setSession] = useState('');
  const [error, setError] = useState('');
  const latest = useRef<ShellPageModel | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const accept = (next: ShellPageModel) => {
      if (live && next.kind === 'home') {
        if (latest.current?.id === next.id && latest.current.revision > next.revision) return;
        latest.current = next;
        document.documentElement.dataset.theme = next.dark ? 'dark' : 'light';
        setModel(next);
      }
    };
    const unsubscribe = api.onChanged(accept);
    void api
      .connect()
      .then((c) => {
        if (live) {
          accept(c.snapshot);
          setSession(c.sessionId);
        }
      })
      .catch((e) => setError(String(e)));
    const focus = api.onFocus((edge) => {
      const controls = [...document.querySelectorAll<HTMLElement>('button, input, select')].filter(
        (e) => !e.matches(':disabled'),
      );
      (edge === 'first' ? controls[0] : controls.at(-1))?.focus();
    });
    const keys = (event: KeyboardEvent) => {
      if (event.isComposing || event.repeat || event.defaultPrevented) return;
      if (event.key === 'Tab') {
        const controls = [
          ...document.querySelectorAll<HTMLElement>('button, input, select'),
        ].filter((e) => !e.matches(':disabled'));
        if (
          event.shiftKey
            ? document.activeElement === controls[0]
            : document.activeElement === controls.at(-1)
        ) {
          event.preventDefault();
          void api.focusHost(event.shiftKey ? 'before' : 'after');
        }
        return;
      }
      if (
        !event.ctrlKey &&
        !event.altKey &&
        event.target instanceof Element &&
        event.target.closest('input, select, textarea')
      )
        return;
      const key = shortcutFromEvent(event);
      if (key) void api.shortcut(key).catch((e) => setError(String(e)));
    };
    document.addEventListener('keydown', keys);
    return () => {
      live = false;
      unsubscribe();
      focus();
      document.removeEventListener('keydown', keys);
    };
  }, []);
  useEffect(() => {
    if (session && model) void api.ready(session).catch((e) => setError(String(e)));
  }, [session, !!model]);

  const act = (actionId: string) => {
    if (!model) return;
    setError('');
    void api.act({ id: model.id, type: 'invoke', actionId }).catch((e) => setError(String(e)));
  };
  if (!model) return error ? <p role="alert">{error}</p> : null;
  const content = model.content;
  return (
    <main className="home-page">
      {(error || content.error) && <p role="alert">{error || content.error}</p>}
      {content.message && (
        <div className="home-result" role="status">
          {content.message}
        </div>
      )}

      <div className="page-heading">
        <h1>ホーム</h1>
      </div>
      <div className="stats">
        <div>
          <span className="stat-icon green">
            <Icon name="play" />
          </span>
          <div>
            <span>実行中のApplet</span>
            <strong>
              {content.stats.running}
              <small> / {content.stats.applets}</small>
            </strong>
          </div>
        </div>
        <div>
          <span className="stat-icon blue">
            <Icon name="command" />
          </span>
          <div>
            <span>使えるコマンド</span>
            <strong>{content.stats.commands}</strong>
          </div>
          <button onClick={() => act(content.actions.palette)} aria-label="コマンド一覧">
            <Icon name="arrow" />
          </button>
        </div>
        <div>
          <span className="stat-icon purple">
            <Icon name="logs" />
          </span>
          <div>
            <span>エラーのApplet</span>
            <strong>{content.stats.errors}</strong>
          </div>
          <button aria-label="ログを開く" onClick={() => act(content.actions.logs)}>
            <Icon name="arrow" />
          </button>
        </div>
      </div>
      <section className="home-pins" aria-label="よく使うコマンド">
        <h2>よく使うコマンド</h2>
        <div className="actions">
          {content.pins.map((c) => (
            <button
              key={c.id}
              className="secondary"
              disabled={content.busy || !c.available}
              title={c.disabledReason}
              onClick={() => act(c.actionId)}
            >
              {c.title}
              <small className="command-id" title={c.extension}>
                {c.id}
              </small>
            </button>
          ))}
        </div>
        {!content.pins.length && <p>コマンド検索の☆から、よく使う操作をピン留めできます。</p>}
      </section>
      <div className="section-heading">
        <h3>
          Applet<span>{content.stats.applets}</span>
        </h3>
        <button className="text-button" onClick={() => act(content.actions.applets)}>
          すべて見る
          <Icon name="arrow" size={14} />
        </button>
      </div>
      <div className="extension-grid">
        {content.applets.map((e) => (
          <button className="extension-card" key={e.id} onClick={() => act(e.actionId)}>
            <div className="card-top">
              <span className={`extension-icon ${e.runtime}`}>
                <Icon name={e.runtime === 'node' ? 'command' : 'extensions'} size={23} />
              </span>
              <span className={`state ${e.state}`}>
                <i />
                {states[e.state]}
              </span>
            </div>
            <h3>{e.title}</h3>
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
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
