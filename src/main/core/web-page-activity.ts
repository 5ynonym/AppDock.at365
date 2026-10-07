import type { WebContents } from 'electron';

// Opt-in browser lifecycle policy. It changes the page's active state through
// Chromium, without moving OS focus, injecting site code, or synthesizing input.
export function keepWebPageActive(wc: WebContents, origin: string, failed: () => void) {
  const debuggerApi = wc.debugger;
  let disposed = false;
  let owned = false;
  let generation = 0;
  const release = () => {
    generation++;
    if (!owned) return;
    owned = false;
    try {
      if (debuggerApi.isAttached()) debuggerApi.detach();
    } catch {}
  };
  const activate = () => {
    if (disposed || wc.isDestroyed()) return;
    let eligible = false;
    try {
      eligible = new URL(wc.getURL()).origin === origin;
    } catch {}
    if (!eligible || wc.isLoadingMainFrame()) {
      release();
      return;
    }
    if (wc.isDevToolsOpened()) return;
    try {
      if (!owned) {
        if (debuggerApi.isAttached()) {
          failed();
          return;
        }
        debuggerApi.attach('1.3');
        owned = true;
      }
      const current = generation;
      void debuggerApi
        .sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true })
        .catch(() => {
          if (!disposed && owned && generation === current) {
            release();
            failed();
          }
        });
    } catch {
      release();
      failed();
    }
  };
  const navigating = (event: { isMainFrame: boolean }) => {
    if (event.isMainFrame) release();
  };
  const detached = () => {
    owned = false;
    generation++;
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    wc.removeListener('did-finish-load', activate);
    wc.removeListener('did-stop-loading', activate);
    wc.removeListener('did-start-navigation', navigating);
    wc.removeListener('devtools-closed', activate);
    wc.removeListener('destroyed', dispose);
    debuggerApi.removeListener('detach', detached);
    release();
  };
  wc.on('did-finish-load', activate);
  wc.on('did-stop-loading', activate);
  wc.on('did-start-navigation', navigating);
  wc.on('devtools-closed', activate);
  wc.once('destroyed', dispose);
  debuggerApi.on('detach', detached);
  return dispose;
}
