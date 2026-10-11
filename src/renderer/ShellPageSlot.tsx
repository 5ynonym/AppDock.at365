import { useLayoutEffect, useRef, useState } from 'react';
import type { LogScope, ShellPageRequest } from '../shared/shell-pages';

/** Reports layout only; page contents belong exclusively to the Shell. */
export function ShellPageSlot({
  scope,
  kind = 'logs',
  appletOrder = [],
  source = '',
  navigationRequest,
}: {
  scope?: LogScope;
  kind?: 'logs' | 'home';
  appletOrder?: string[];
  source?: string;
  navigationRequest: number;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const request = useRef<ShellPageRequest>(
    kind === 'home'
      ? { id: crypto.randomUUID(), route: 'home', kind: 'home', appletOrder }
      : {
          id: crypto.randomUUID(),
          route: scope!.type === 'all' ? 'logs' : 'extensions',
          kind: 'logs',
          scope: scope!,
          source,
        },
  );
  if (request.current.kind === 'home') request.current.appletOrder = appletOrder;
  const [error, setError] = useState('');
  const refresh = useRef(() => {});
  useLayoutEffect(() => {
    const element = slot.current!;
    const main = element.closest('main')!;
    let live = true;
    const update = () => {
      const m = main.getBoundingClientRect();
      const top = element.getBoundingClientRect().top;
      element.style.height = `${Math.max(140, m.bottom - top - 36)}px`;
      const r = element.getBoundingClientRect();
      const y = Math.max(r.y, m.y),
        bottom = Math.min(r.bottom, m.bottom);
      void window.dock
        .shellPage(
          request.current,
          bottom > y ? { x: r.x, y, width: Math.max(1, r.width), height: bottom - y } : null,
        )
        .catch((e) => {
          if (live) setError(String(e));
        });
    };
    refresh.current = update;
    const unsubscribe = window.dock.onShellPageFocusHost((id, edge) => {
      if (id !== request.current.id) return;
      const elements = [
        ...document.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [tabindex="0"]',
        ),
      ].filter((e) => e !== element && e.getClientRects().length && !e.matches(':disabled'));
      const before = elements.filter(
        (e) => !!(e.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING),
      );
      const after = elements.filter(
        (e) => !!(e.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING),
      );
      (edge === 'before' ? before.at(-1) : after[0])?.focus({ preventScroll: true });
    });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(main);
    if (element.parentElement) observer.observe(element.parentElement);
    window.addEventListener('resize', update);
    main.addEventListener('scroll', update);
    return () => {
      live = false;
      refresh.current = () => {};
      observer.disconnect();
      unsubscribe();
      window.removeEventListener('resize', update);
      main.removeEventListener('scroll', update);
      void window.dock.closeShellPage(request.current.id);
    };
  }, []);
  useLayoutEffect(() => refresh.current(), [navigationRequest, appletOrder]);
  return (
    <div
      ref={slot}
      className="shell-page-slot"
      tabIndex={0}
      aria-label={kind === 'home' ? 'ホーム画面に移動' : 'ログ画面に移動'}
      onFocus={(event) => {
        const from = event.relatedTarget;
        const before =
          from instanceof Node &&
          !!(from.compareDocumentPosition(event.currentTarget) & Node.DOCUMENT_POSITION_FOLLOWING);
        void window.dock.focusShellPage(request.current.id, before ? 'first' : 'last');
      }}
    >
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
