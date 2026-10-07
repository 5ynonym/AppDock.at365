import type { WebContents } from 'electron';

// Keep a background SPA responsive without moving Windows focus or reloading it.
export function keepWebPageActive(wc: WebContents, origin: string, failed: () => void) {
  const debuggerApi = wc.debugger;
  let disposed = false;
  let owned = false;
  let generation = 0;
  let ready = false;
  let emulated: boolean | undefined;
  let conflictReported = false;
  let renewal: ReturnType<typeof setInterval> | undefined;
  let pulse: ReturnType<typeof setTimeout> | undefined;
  const cancelPulse = () => {
    clearTimeout(pulse);
    pulse = undefined;
  };
  const reset = () => {
    generation++;
    clearInterval(renewal);
    renewal = undefined;
    cancelPulse();
    emulated = undefined;
  };
  const release = () => {
    reset();
    if (!owned) return;
    owned = false;
    try {
      if (debuggerApi.isAttached()) debuggerApi.detach();
    } catch {}
  };
  const eligible = () => {
    if (disposed || wc.isDestroyed() || !ready) return false;
    try {
      return new URL(wc.getURL()).origin === origin && !wc.isLoadingMainFrame();
    } catch {
      return false;
    }
  };
  const current = (token: number) => owned && generation === token && eligible();
  const send = (enabled: boolean) => {
    if (emulated === enabled) return;
    const token = generation;
    emulated = enabled;
    const rejected = () => {
      if (!current(token)) return;
      release();
      failed();
    };
    try {
      void debuggerApi
        .sendCommand('Emulation.setFocusEmulationEnabled', { enabled })
        .catch(rejected);
    } catch {
      rejected();
    }
  };
  const renew = () => {
    if (!eligible() || !owned || wc.isDevToolsOpened()) return;
    // Preserve natural focus/blur while the user interacts with this WebContents.
    if (wc.isFocused()) {
      cancelPulse();
      send(false);
      return;
    }
    if (pulse) return;
    const token = generation;
    send(false);
    if (!current(token)) return;
    pulse = setTimeout(() => {
      pulse = undefined;
      if (current(token) && !wc.isDevToolsOpened()) send(!wc.isFocused());
    }, 250);
    pulse.unref();
  };
  const activate = () => {
    if (disposed || wc.isDestroyed() || !ready) return;
    if (!eligible()) {
      release();
      return;
    }
    if (wc.isDevToolsOpened()) return;
    try {
      if (!owned) {
        if (debuggerApi.isAttached()) {
          if (!conflictReported) failed();
          conflictReported = true;
          return;
        }
        conflictReported = false;
        debuggerApi.attach('1.3');
        owned = true;
        // Receive channels may finish initializing after the DOM is ready.
        // Renew activity to recover missed startup transitions or reconnects.
        renewal = setInterval(renew, 30_000);
        renewal.unref();
      }
      if (wc.isFocused()) {
        cancelPulse();
        send(false);
      } else if (!pulse) send(true);
    } catch {
      release();
      failed();
    }
  };
  const navigating = (event: { isMainFrame: boolean; isSameDocument?: boolean }) => {
    if (event.isMainFrame && !event.isSameDocument) {
      ready = false;
      release();
    }
  };
  const detached = () => {
    owned = false;
    reset();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    wc.removeListener('did-finish-load', activate);
    wc.removeListener('did-stop-loading', activate);
    wc.removeListener('did-start-navigation', navigating);
    wc.removeListener('devtools-closed', activate);
    wc.removeListener('focus', activate);
    wc.removeListener('blur', activate);
    wc.removeListener('destroyed', dispose);
    debuggerApi.removeListener('detach', detached);
    release();
  };
  wc.on('did-finish-load', activate);
  wc.on('did-stop-loading', activate);
  wc.on('did-start-navigation', navigating);
  wc.on('devtools-closed', activate);
  wc.on('focus', activate);
  wc.on('blur', activate);
  wc.once('destroyed', dispose);
  debuggerApi.on('detach', detached);
  return {
    dispose,
    ready: () => {
      ready = true;
      activate();
    },
  };
}
