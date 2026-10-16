import { useEffect, useRef, useState } from 'react';
import type { RibbonGroupModel, OverlayAction, ShellOverlayApi } from '../../src/shared/overlays';
import { RibbonIcon, ribbonLabel } from './RibbonButton';

export function RibbonGroupPanel({
  model,
  act,
  asset,
}: {
  model: RibbonGroupModel;
  act(action: OverlayAction): void;
  asset: ShellOverlayApi['asset'];
}) {
  const panel = useRef<HTMLDivElement>(null),
    row = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ left: false, right: false });
  const { anchor, title, items } = model.content;
  const left = Math.min(anchor.x + anchor.width + 8, Math.max(8, innerWidth - 120));
  const top = Math.max(8, Math.min(anchor.y, innerHeight - 112));
  const close = () => act({ id: model.id, type: 'dismiss' });
  const update = () => {
    const r = row.current;
    if (r)
      setScroll({
        left: r.scrollLeft > 1,
        right: r.scrollLeft + r.clientWidth < r.scrollWidth - 1,
      });
  };
  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>('[data-ribbon-id]:not(:disabled)')?.focus();
    const observer = new ResizeObserver(update);
    if (row.current) observer.observe(row.current);
    update();
    return () => observer.disconnect();
  }, [model.id]);
  return (
    <div
      className="ribbon-group-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
          return;
        }
        const buttons = [
          ...(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []),
        ];
        if (e.key === 'Tab') {
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          e.preventDefault();
          buttons[(index + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
        }
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="ribbon-flyout"
        style={{ left, top, maxWidth: Math.max(100, innerWidth - left - 8) }}
      >
        <div className="ribbon-flyout-heading">
          <strong>{title}</strong>
          <button aria-label="グループを閉じる" onClick={close}>
            ×
          </button>
        </div>
        <div className="ribbon-flyout-controls">
          <button
            aria-label="左へスクロール"
            disabled={!scroll.left}
            onClick={() => {
              row.current?.scrollBy({ left: -180 });
            }}
          >
            ‹
          </button>
          <div
            ref={row}
            className="ribbon-flyout-row"
            role="toolbar"
            aria-label={title}
            onScroll={update}
            onWheel={(e) => {
              if (row.current && Math.abs(e.deltaY) > Math.abs(e.deltaX))
                row.current.scrollLeft += e.deltaY;
            }}
            onKeyDown={(e) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
              const buttons = [
                ...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
              ];
              const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
              const next =
                e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? buttons.length - 1
                    : Math.max(
                        0,
                        Math.min(buttons.length - 1, index + (e.key === 'ArrowLeft' ? -1 : 1)),
                      );
              e.preventDefault();
              buttons[next]?.focus();
            }}
          >
            {items.map((item) =>
              item.kind === 'separator' ? (
                <div
                  key={item.id}
                  className="ribbon-flyout-separator"
                  role="separator"
                  aria-orientation="vertical"
                />
              ) : (
                <button
                  key={item.id}
                  data-ribbon-id={item.id}
                  disabled={!item.enabled}
                  className={item.selected ? 'active' : ''}
                  aria-label={ribbonLabel(item)}
                  title={item.disabledReason || ribbonLabel(item)}
                  aria-current={item.selected ? 'page' : undefined}
                  onFocus={(e) =>
                    e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })
                  }
                  onClick={() =>
                    act({
                      id: model.id,
                      type: 'ribbonChoose',
                      actionId: item.actionId!,
                      requestId: crypto.randomUUID(),
                    })
                  }
                >
                  <RibbonIcon item={item} asset={asset} />
                </button>
              ),
            )}
          </div>
          <button
            aria-label="右へスクロール"
            disabled={!scroll.right}
            onClick={() => {
              row.current?.scrollBy({ left: 180 });
            }}
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
