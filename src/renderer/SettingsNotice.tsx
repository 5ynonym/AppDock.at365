import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SettingsNoticeApi, SettingsNoticeState } from '../shared/contracts';

declare global {
  interface Window {
    settingsNotice: SettingsNoticeApi;
  }
}
export function SettingsNotice() {
  const [state, setState] = useState<SettingsNoticeState>();
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const stop = window.settingsNotice.onChanged(setState);
    void window.settingsNotice.state().then(setState);
    return stop;
  }, []);
  useLayoutEffect(() => {
    document.documentElement.classList.add('settings-notice-document');
    document.documentElement.dataset.theme = state?.dark ? 'dark' : 'light';
    const element = card.current;
    if (!element) return;
    const update = () =>
      void window.settingsNotice.resize(Math.ceil(element.getBoundingClientRect().height) + 16);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, [state]);
  if (!state?.visible) return null;
  return (
    <div className="settings-notice-card" ref={card} role="region" aria-label="未保存の変更">
      <div className="settings-notice-copy" role="status" aria-live="polite">
        <strong>{state.message ? '変更を保存できません' : '未保存の変更があります'}</strong>
        <p>{state.message || '設定・ショートカットなどの変更がまだ保存されていません。'}</p>
      </div>
      <div className="actions">
        {state.message && (
          <button
            className="text-button"
            disabled={state.busy}
            onClick={() => void window.settingsNotice.act('edit')}
          >
            設定を確認
          </button>
        )}
        <button
          className="text-button"
          disabled={state.busy}
          onClick={() => void window.settingsNotice.act('discard')}
        >
          すべて破棄…
        </button>
        <button
          className="primary"
          disabled={state.busy}
          onClick={() => void window.settingsNotice.act('save')}
        >
          {state.busy ? '処理中…' : 'すべて保存'}
        </button>
      </div>
    </div>
  );
}
