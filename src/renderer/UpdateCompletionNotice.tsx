import { useEffect, useState, type ReactNode } from 'react';
import type { UpdateState } from '../shared/contracts';

export function UpdateCompletionNotice({
  completion,
  visible,
  children,
}: {
  completion: UpdateState['completion'];
  visible: boolean;
  children: ReactNode;
}) {
  const message = completion?.ok ? completion.message : '';
  const [dismissed, setDismissed] = useState('');
  useEffect(() => {
    if (!message || !visible || dismissed === message) return;
    const timer = setTimeout(() => setDismissed(message), 5200);
    return () => clearTimeout(timer);
  }, [message, dismissed, visible]);
  return (
    <span className="statusbar-activity">
      {message && visible && dismissed !== message ? (
        <span className="update-completion-notice">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="m5 12 4 4L19 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span role="status" title={message}>
            {message}
          </span>
          <button aria-label="更新結果を閉じる" onClick={() => setDismissed(message)}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </span>
      ) : (
        children
      )}
    </span>
  );
}
