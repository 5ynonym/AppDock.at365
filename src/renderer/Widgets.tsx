import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { HostSnapshot } from '../shared/contracts';
import {
  defaultWidgetPlacement,
  selectWidgetDisplay,
  widgetAnchors,
  widgetBounds,
  type WidgetDisplay,
  type WidgetPlacement,
  type WidgetSnapshot,
} from '../shared/widgets';

const ClockContext = createContext(new Date());
export function WidgetClock({
  widgets,
  children,
}: {
  widgets: WidgetSnapshot[];
  children: React.ReactNode;
}) {
  const [now, setNow] = useState(() => new Date());
  const needsTime = widgets.some((w) => w.available && ['clock', 'date'].includes(w.content.kind));
  const seconds = widgets.some(
    (w) => w.available && w.content.kind === 'clock' && w.content.showSeconds !== false,
  );
  useEffect(() => {
    if (!needsTime) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      clearTimeout(timer);
      if (document.hidden) return;
      setNow(new Date());
      const interval = seconds ? 1000 : 60000;
      timer = setTimeout(tick, interval - (Date.now() % interval));
    };
    tick();
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [needsTime, seconds]);
  return <ClockContext.Provider value={now}>{children}</ClockContext.Provider>;
}
const fontLoads = new Map<string, Promise<FontFace>>();
function fontName(widget: WidgetSnapshot) {
  return 'widget-' + widget.id.replaceAll('.', '-');
}
export function WidgetView({
  widget,
  desktop = false,
}: {
  widget: WidgetSnapshot;
  desktop?: boolean;
}) {
  const now = useContext(ClockContext);
  const box = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    if (!widget.fontUrl) return;
    let active = true;
    if (!fontLoads.has(widget.fontUrl)) {
      const font = new FontFace(fontName(widget), `url("${widget.fontUrl}")`);
      fontLoads.set(
        widget.fontUrl,
        font.load().then((loaded) => {
          document.fonts.add(loaded);
          return loaded;
        }),
      );
    }
    void fontLoads.get(widget.fontUrl)!.then(
      () => {
        if (active) setFontReady(true);
      },
      () => {
        if (active) setFontReady(false);
      },
    );
    return () => {
      active = false;
    };
  }, [widget.fontUrl]);
  const c = widget.content;
  const date = new Intl.DateTimeFormat(c.locale ?? 'en-US', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    timeZone: c.timeZone,
  }).format(now);
  const parts = new Intl.DateTimeFormat(c.locale ?? 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone: c.timeZone,
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  const value =
    c.kind === 'date'
      ? date
      : `${get('hour')}:${get('minute')}${c.showSeconds === false ? '' : ':' + get('second')}`;
  useLayoutEffect(() => {
    if (!box.current || !text.current || c.kind === 'text') return;
    const fit = () => {
      if (box.current && text.current)
        setScale(
          Math.min(
            1,
            box.current.clientWidth / Math.max(1, text.current.scrollWidth),
            box.current.clientHeight / Math.max(1, text.current.scrollHeight),
          ),
        );
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box.current);
    observer.observe(text.current);
    return () => observer.disconnect();
  }, [value, fontReady, widget.placement.fontSize, desktop, c.kind]);
  if (!widget.available) return <div className="widget-unavailable">Appletは停止中です</div>;
  return (
    <div
      ref={box}
      className={`widget-view widget-${c.kind} ${desktop ? 'desktop' : ''}`}
      style={
        desktop ? { color: widget.placement.color, opacity: widget.placement.opacity } : undefined
      }
    >
      {c.kind === 'text' ? (
        <div className="widget-text-content">
          <p>{c.body}</p>
          {c.facts && (
            <dl>
              {c.facts.map((f, i) => (
                <React.Fragment key={i}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </React.Fragment>
              ))}
            </dl>
          )}
        </div>
      ) : (
        <div
          ref={text}
          className="widget-time-text"
          aria-label={value}
          style={{
            fontSize: desktop ? widget.placement.fontSize : c.kind === 'clock' ? 76 : 38,
            fontFamily: fontReady ? `"${fontName(widget)}"` : undefined,
            transform: `scale(${scale})`,
          }}
        >
          {c.kind === 'date' ? (
            date
          ) : (
            <>
              {get('hour')}:{get('minute')}
              {c.showSeconds !== false && <span className="widget-seconds">:{get('second')}</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
type Run = (work: () => Promise<unknown>, message?: string) => Promise<void>;
export function HomeWidgets({ snapshot, manage }: { snapshot: HostSnapshot; manage: () => void }) {
  const widgets = snapshot.widgets.filter((w) => w.placement.home);
  return (
    <section className="home-widgets" aria-label="ホームのウィジェット">
      <div className="widget-section-heading">
        <h2>ウィジェット</h2>
        <button className="text-button" onClick={manage}>
          管理する
        </button>
      </div>
      <WidgetClock widgets={widgets}>
        <div className="home-widget-grid">
          {widgets.map((w) => (
            <article className="home-widget-card" key={w.id} data-widget-id={w.id}>
              <div className="widget-card-heading">
                <strong>{w.title}</strong>
                <small>{w.extensionName}</small>
              </div>
              <WidgetView widget={w} />
            </article>
          ))}
        </div>
      </WidgetClock>
      {!widgets.length && (
        <p className="muted">Appletのウィジェットをピン留めして、ホームを整えましょう。</p>
      )}
    </section>
  );
}
export function WidgetsPage({
  snapshot,
  run,
  busy,
  active,
}: {
  snapshot: HostSnapshot;
  run: Run;
  busy: boolean;
  active: boolean;
}) {
  const [selected, setSelected] = useState('');
  const widget = snapshot.widgets.find((w) => w.id === selected) ?? snapshot.widgets[0];
  const [draft, setDraft] = useState<WidgetPlacement>(defaultWidgetPlacement);
  const [revision, setRevision] = useState(snapshot.settings.revision);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    setDirty(false);
    setDraft(widget?.placement ?? defaultWidgetPlacement());
    setRevision(snapshot.settings.revision);
  }, [widget?.id]);
  useEffect(() => {
    if (!dirty) {
      setDraft(widget?.placement ?? defaultWidgetPlacement());
      setRevision(snapshot.settings.revision);
    }
  }, [snapshot.settings.revision, widget?.placement, dirty]);
  const edit = (patch: Partial<WidgetPlacement>) => {
    setDraft((p) => ({ ...p, ...patch }));
    setDirty(true);
  };
  const choose = (id: string) => {
    if (dirty && !window.confirm('未保存の配置変更を破棄して切り替えますか？')) return;
    setSelected(id);
  };
  const toggle = (w: WidgetSnapshot, field: 'home' | 'desktop') =>
    void run(() =>
      window.dock.setWidgetPlacement(
        w.id,
        { ...w.placement, [field]: !w.placement[field] },
        snapshot.settings.revision,
      ),
    );
  const save = async () => {
    if (!widget) return;
    const result = await window.dock.setWidgetPlacement(widget.id, draft, revision);
    setDraft(result.value.widgets[widget.id]);
    setRevision(result.revision);
    setDirty(false);
  };
  const labels = ['左上', '上中央', '右上', '左中央', '中央', '右中央', '左下', '下中央', '右下'];
  return (
    <>
      <h1>ウィジェット</h1>
      <p className="muted">
        ホームへのピン留めと、透過デスクトップの表示場所をウィジェットごとに管理します。
      </p>
      {snapshot.widgetErrors.map((e, i) => (
        <p className="error-text" role="alert" key={i}>
          {e}
        </p>
      ))}
      {!snapshot.widgets.length ? (
        <p className="empty">ウィジェットを提供するAppletを追加すると、ここに表示されます。</p>
      ) : (
        <div className="widget-manager">
          <div className="widget-list" aria-label="ウィジェット一覧">
            {snapshot.widgets.map((w) => (
              <article
                key={w.id}
                data-widget-id={w.id}
                className={w.id === widget?.id ? 'selected' : ''}
              >
                <button
                  className="widget-select"
                  onClick={() => choose(w.id)}
                  aria-pressed={w.id === widget?.id}
                >
                  <strong>{w.title}</strong>
                  <small>
                    {w.extensionName} · {w.available ? '利用可能' : 'Applet停止中'}
                  </small>
                </button>
                <div className="widget-quick-actions">
                  <button
                    aria-pressed={w.placement.home}
                    disabled={busy || dirty}
                    onClick={() => toggle(w, 'home')}
                  >
                    {w.placement.home ? 'ピン留め済み' : 'ホームにピン留め'}
                  </button>
                  <button
                    aria-pressed={w.placement.desktop}
                    disabled={busy || dirty}
                    onClick={() => toggle(w, 'desktop')}
                  >
                    {w.placement.desktop ? 'デスクトップ表示中' : 'デスクトップに表示'}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {widget && (
            <div className="widget-settings" key={widget.id}>
              <div className="widget-section-heading">
                <div>
                  <h2>{widget.title}</h2>
                  <p className="muted">{widget.description}</p>
                </div>
                <span className="muted">{dirty ? '未保存の変更' : '保存済み'}</span>
              </div>
              <div className="widget-preview">
                <WidgetClock widgets={active ? [widget] : []}>
                  <WidgetView widget={widget} />
                </WidgetClock>
              </div>
              <div className="widget-fields">
                <label>
                  ホームでの表示順
                  <input
                    aria-label="ホームでの表示順"
                    type="number"
                    min="0"
                    max="9999"
                    value={draft.order}
                    onChange={(e) => edit({ order: e.target.valueAsNumber })}
                  />
                </label>
                <label>
                  モニター
                  <select value={draft.monitor} onChange={(e) => edit({ monitor: e.target.value })}>
                    <option value="primary">メインモニター（自動）</option>
                    {snapshot.widgetDisplays.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                    {draft.monitor !== 'primary' &&
                      !snapshot.widgetDisplays.some((d) => d.id === draft.monitor) && (
                        <option value={draft.monitor}>未接続の画面（メインへ退避）</option>
                      )}
                  </select>
                </label>
                <label>
                  表示階層
                  <select
                    value={draft.layer}
                    onChange={(e) => edit({ layer: e.target.value as WidgetPlacement['layer'] })}
                  >
                    <option value="front">ほかのウィンドウより前面</option>
                    <option value="desktop">デスクトップに固定（ほかのウィンドウの背面）</option>
                  </select>
                </label>
                <label>
                  配置方法
                  <select
                    value={draft.position}
                    onChange={(e) =>
                      edit({ position: e.target.value as WidgetPlacement['position'] })
                    }
                  >
                    <option value="anchor">アンカーで配置</option>
                    <option value="free">自由位置（ドラッグ・座標）</option>
                  </select>
                </label>
                {draft.position === 'anchor' && (
                  <label>
                    アンカー
                    <select
                      value={draft.anchor}
                      onChange={(e) =>
                        edit({ anchor: e.target.value as WidgetPlacement['anchor'] })
                      }
                    >
                      {widgetAnchors.map((a, i) => (
                        <option key={a} value={a}>
                          {labels[i]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {(['x', 'y', 'width', 'height', 'fontSize', 'opacity'] as const).map((key, i) => (
                  <label key={key}>
                    {
                      [
                        draft.position === 'anchor'
                          ? '横方向の余白・オフセット'
                          : '画面左端からの位置',
                        draft.position === 'anchor'
                          ? '縦方向の余白・オフセット'
                          : '画面上端からの位置',
                        '幅',
                        '高さ',
                        '文字サイズ',
                        '不透明度',
                      ][i]
                    }
                    <input
                      aria-label={['X座標', 'Y座標', '幅', '高さ', '文字サイズ', '不透明度'][i]}
                      type="number"
                      value={draft[key]}
                      step={key === 'opacity' ? 0.05 : 1}
                      min={key === 'opacity' ? 0.05 : undefined}
                      max={key === 'opacity' ? 1 : undefined}
                      onChange={(e) => edit({ [key]: e.target.valueAsNumber })}
                    />
                  </label>
                ))}
                <label>
                  文字色
                  <input
                    aria-label="文字色"
                    type="color"
                    value={draft.color}
                    onChange={(e) => edit({ color: e.target.value })}
                  />
                </label>
              </div>
              <p className="footnote">
                座標・大きさはDIPです。アンカーの余白は右端・下端から内側へ、中央では右・下へ加算します。通常はクリックを透過し、移動時だけ操作できます。
              </p>
              {dirty && revision !== snapshot.settings.revision && (
                <p className="error-text" role="alert">
                  別の場所で設定が変わりました。再読み込みして変更をやり直してください。
                </p>
              )}
              <div className="actions">
                <button
                  className="primary"
                  disabled={busy || !dirty}
                  onClick={() => void run(save, 'ウィジェットの配置を保存しました。')}
                >
                  配置を保存
                </button>
                <button
                  className="secondary"
                  disabled={busy || !dirty}
                  onClick={() => {
                    setDraft(widget.placement);
                    setRevision(snapshot.settings.revision);
                    setDirty(false);
                  }}
                >
                  再読み込み
                </button>
                <button
                  className="secondary"
                  disabled={busy || dirty || !widget.available || !widget.placement.desktop}
                  onClick={() => void run(() => window.dock.moveWidget(widget.id))}
                >
                  ドラッグで移動
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => void run(() => window.dock.finishWidgetMove(false))}
                >
                  移動をキャンセル
                </button>
              </div>
              <p className="footnote">
                「ドラッグで移動」を押して表示されたバーを動かし、「完了」で保存します。Escまたは2分経過でキャンセルします。
              </p>
            </div>
          )}
        </div>
      )}
      {Object.keys(snapshot.settings.value.widgets).some(
        (id) => !snapshot.widgets.some((w) => w.id === id),
      ) && (
        <p className="footnote">
          取り外したAppletの配置は保存しています。再追加すると復元されます。
        </p>
      )}
    </>
  );
}

interface SurfaceSnapshot {
  widgets: WidgetSnapshot[];
  displays: WidgetDisplay[];
  bounds: WidgetDisplay['bounds'];
  editing: boolean;
}
declare global {
  interface Window {
    widgetSurface: {
      snapshot(): Promise<SurfaceSnapshot>;
      finishMove(save: boolean): Promise<void>;
      onChanged(callback: () => void): () => void;
    };
  }
}
export function WidgetSurface() {
  const [snapshot, setSnapshot] = useState<SurfaceSnapshot>();
  const [error, setError] = useState('');
  useEffect(() => {
    document.documentElement.dataset.surface = 'widget';
    const load = () =>
      void window.widgetSurface.snapshot().then(setSnapshot, (e) => setError(String(e)));
    load();
    return window.widgetSurface.onChanged(load);
  }, []);
  const finish = (save: boolean) =>
    void window.widgetSurface.finishMove(save).catch((e) => setError(String(e)));
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);
  if (!snapshot) return null;
  return (
    <WidgetClock widgets={snapshot.widgets}>
      <div className="widget-surface">
        {snapshot.editing ? (
          <>
            <div className="widget-dragbar">
              <span>ここをドラッグ</span>
              <button onClick={() => finish(true)}>完了</button>
              <button onClick={() => finish(false)}>取消</button>
            </div>
            {error && (
              <p className="widget-move-error" role="alert">
                {error}
              </p>
            )}
            <div className="widget-edit-content">
              <WidgetView widget={snapshot.widgets[0]} desktop />
            </div>
          </>
        ) : (
          snapshot.widgets.map((w) => {
            const display = selectWidgetDisplay(snapshot.displays, w.placement.monitor);
            const bounds = widgetBounds(w.placement, display.bounds);
            return (
              <div
                key={w.id}
                data-widget-id={w.id}
                className="widget-desktop-item"
                style={{
                  left: bounds.x - display.bounds.x,
                  top: bounds.y - display.bounds.y,
                  width: bounds.width,
                  height: bounds.height,
                }}
              >
                <WidgetView widget={w} desktop />
              </div>
            );
          })
        )}
      </div>
    </WidgetClock>
  );
}
