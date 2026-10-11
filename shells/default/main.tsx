import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { RibbonView, ShellApi } from '../../src/shared/shell';
import { Icon, type IconName } from '../../src/shared/ui-icons';
import './style.css';
declare global {
  interface Window {
    appdockShell: ShellApi;
  }
}
const api = window.appdockShell;
function Asset({ id, text }: { id: string; text?: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let live = true;
    setUrl('');
    void api
      .asset(id)
      .then((a) => {
        if (live) setUrl(a.dataUrl);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id]);
  return url ? <img src={url} alt="" /> : <>{text}</>;
}
function App() {
  const [model, setModel] = useState<RibbonView>();
  const [error, setError] = useState('');
  const [session, setSession] = useState('');
  useEffect(
    () =>
      api.onFocus((edge) => {
        const buttons = [...document.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        (edge === 'first' ? buttons[0] : buttons.at(-1))?.focus();
      }),
    [],
  );
  useEffect(() => {
    let live = true;
    const accept = (next: RibbonView) => {
      if (live)
        setModel((current) =>
          current && current.epoch === next.epoch && current.revision > next.revision
            ? current
            : next,
        );
    };
    const unsubscribe = api.onChanged(accept);
    void api
      .connect()
      .then((connection) => {
        if (!live) return;
        accept(connection.snapshot);
        setSession(connection.sessionId);
      })
      .catch((e) => setError(String(e)));
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (session && model) void api.ready(session).catch((e) => setError(String(e)));
  }, [session, !!model]);
  useEffect(() => {
    document.documentElement.dataset.theme = model?.dark ? 'dark' : 'light';
  }, [model?.dark]);
  const invoke = (actionId: string) => {
    if (!model) return;
    setError('');
    void api
      .invoke({ epoch: model.epoch, requestId: crypto.randomUUID(), actionId })
      .catch((e) => setError(String(e)));
  };
  const item = (item: RibbonView['items'][number]) =>
    item.kind === 'separator' ? (
      <div
        key={item.id}
        className="ribbon-separator"
        role="separator"
        data-ribbon-id={item.id}
        aria-label={item.title}
      />
    ) : (
      <button
        key={item.id}
        data-ribbon-id={item.id}
        title={item.disabledReason || item.tooltip}
        aria-label={item.title}
        aria-current={item.selected ? 'page' : undefined}
        disabled={!item.enabled}
        className={`${item.selected ? 'active' : ''} ${item.icon.text ? 'avatar' : ''}`}
        onClick={() => invoke(item.actionId!)}
      >
        {item.icon.assetId ? (
          <Asset id={item.icon.assetId} text={item.icon.text} />
        ) : (
          item.icon.text || <Icon name={item.icon.name as IconName} size={21} />
        )}
        {!item.icon.text && <span className="rail-label">{item.title}</span>}
      </button>
    );
  return (
    <aside
      className="activity-rail"
      aria-label="リボン"
      data-revision={model?.revision}
      onKeyDown={(e) => {
        if (e.key !== 'Tab') return;
        const buttons = [
          ...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
        ];
        if (e.target === (e.shiftKey ? buttons[0] : buttons.at(-1))) {
          e.preventDefault();
          void api.focusHost(e.shiftKey ? 'before' : 'after');
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (model) invoke(model.contextActionId);
      }}
    >
      <div className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="ribbon-buttons ribbon-top" aria-label="上寄せのリボン">
        {model?.items.filter((i) => i.placement === 'top').map(item)}
      </div>
      <div className="rail-spacer" />
      <div className="ribbon-buttons ribbon-bottom" aria-label="下寄せのリボン">
        {model?.items.filter((i) => i.placement === 'bottom').map(item)}
      </div>
      {error && (
        <button
          className="error"
          title={error}
          onClick={() => setError('')}
          aria-label="操作エラー"
        >
          !
        </button>
      )}
    </aside>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
