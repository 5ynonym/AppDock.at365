import { useLayoutEffect, useRef, useState } from 'react';
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
  const [scroll, setScroll] = useState({ left: false, right: false, overflow: false });
  const [top, setTop] = useState(0);
  const { anchor, title, items } = model.content;
  const left = Math.min(anchor.x + anchor.width + 8, Math.max(8, innerWidth - 120));
  const maxWidth = Math.max(100, innerWidth - left - 8);
  const close = () => act({ id: model.id, type: 'dismiss' });
  const update = () => {
    const r = row.current;
    if (r) {
      const style = getComputedStyle(r);
      const naturalWidth =
        [...r.children].reduce((sum, child) => sum + child.getBoundingClientRect().width, 0) +
        Math.max(0, r.children.length - 1) * parseFloat(style.columnGap) +
        parseFloat(style.paddingLeft) +
        parseFloat(style.paddingRight);
      setScroll({
        left: r.scrollLeft > 1,
        right: r.scrollLeft + r.clientWidth < r.scrollWidth - 1,
        overflow: naturalWidth > maxWidth - 14 + 1,
      });
      const p = panel.current,
        first = r.querySelector<HTMLElement>('[data-ribbon-id]');
      if (p && first) {
        const rect = p.getBoundingClientRect(),
          button = first.getBoundingClientRect();
        const desired = anchor.y + anchor.height / 2 - (button.y - rect.y + button.height / 2);
        setTop(Math.max(8, Math.min(desired, innerHeight - rect.height - 8)));
      }
    }
  };
  useLayoutEffect(() => {
    const observer = new ResizeObserver(update);
    if (row.current) observer.observe(row.current);
    if (panel.current) observer.observe(panel.current);
    update();
    return () => observer.disconnect();
  }, [model.id, anchor.x, anchor.y, anchor.height, maxWidth, items]);
  useLayoutEffect(() => {
    const first = panel.current?.querySelector<HTMLButtonElement>(
      '[data-ribbon-id]:not(:disabled)',
    );
    (first ?? panel.current)?.focus();
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
        tabIndex={-1}
        aria-modal="true"
        aria-label={title}
        className="ribbon-flyout"
        style={{ left, top, maxWidth }}
      >
        <div className="ribbon-flyout-controls">
          {scroll.overflow && (
            <button
              aria-label="左へスクロール"
              disabled={!scroll.left}
              onClick={() => {
                row.current?.scrollBy({ left: -180 });
              }}
            >
              ‹
            </button>
          )}
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
                  style={{ height: anchor.height }}
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
          {scroll.overflow && (
            <button
              aria-label="右へスクロール"
              disabled={!scroll.right}
              onClick={() => {
                row.current?.scrollBy({ left: 180 });
              }}
            >
              ›
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
