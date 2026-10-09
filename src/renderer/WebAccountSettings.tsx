import { useEffect, useRef, useState } from 'react';
import type { WebApplet, WebProfile } from '../shared/web-applets';

function AccountRow({
  account,
  users,
  busy,
  rename,
  remove,
  clear,
}: {
  account: WebProfile;
  users: string[];
  busy: boolean;
  rename(name: string): Promise<boolean>;
  remove(): void;
  clear(): void;
}) {
  const [name, setName] = useState(account.name);
  const savedName = useRef(account.name);
  const pending = useRef<{ value: string; sequence: number } | null>(null);
  const sequence = useRef(0);
  const composing = useRef(false);
  useEffect(() => {
    const previous = savedName.current;
    savedName.current = account.name;
    setName((current) =>
      current.trim() === previous || current.trim() === account.name ? account.name : current,
    );
  }, [account.name]);
  async function commit(value = name) {
    if (
      busy ||
      composing.current ||
      !value.trim() ||
      value.trim() === pending.current?.value ||
      (!pending.current && value.trim() === savedName.current)
    )
      return;
    const request = ++sequence.current;
    pending.current = { value: value.trim(), sequence: request };
    try {
      if (await rename(value)) savedName.current = value.trim();
    } finally {
      if (pending.current?.sequence === request) pending.current = null;
    }
  }
  return (
    <div className="web-account-card">
      <div className="web-account-row">
        <input
          aria-label={`アカウント名 ${account.name}`}
          maxLength={80}
          value={name}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
          onBlur={(e) => void commit(e.currentTarget.value)}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={(e) => {
            composing.current = false;
            if (document.activeElement !== e.currentTarget) void commit(e.currentTarget.value);
          }}
          onKeyDown={(e) => {
            if (
              e.key === 'Escape' &&
              !e.nativeEvent.isComposing &&
              !composing.current &&
              !pending.current
            ) {
              e.preventDefault();
              e.stopPropagation();
              setName(savedName.current);
              return;
            }
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && name.trim()) {
              e.preventDefault();
              void commit(e.currentTarget.value);
            }
          }}
        />
        <button
          className="secondary"
          disabled={busy || !name.trim() || name.trim() === account.name}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => void commit()}
        >
          名前を変更
        </button>
        <button className="secondary" disabled={busy} onClick={clear}>
          ログイン情報をクリア
        </button>
        <button className="text-button danger" disabled={busy || users.length > 0} onClick={remove}>
          枠を削除
        </button>
      </div>
      <p className="muted">
        {users.length ? `使用中：${users.join('、')}` : 'この枠を使うWebAppletはありません。'}
      </p>
    </div>
  );
}

export function WebAccountSettings({
  accounts,
  savedItems,
  draftItems,
}: {
  accounts: WebProfile[];
  savedItems: WebApplet[];
  draftItems: WebApplet[];
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  async function run(
    work: () => Promise<unknown>,
    success: string | ((result: unknown) => string),
    lock = true,
  ) {
    if (lock && locked.current) return false;
    if (lock) {
      locked.current = true;
      setBusy(true);
    }
    const task = queue.current.then(async () => {
      setMessage('');
      try {
        const result = await work();
        setMessage(
          result === false
            ? '操作をキャンセルしました。'
            : typeof success === 'function'
              ? success(result)
              : success,
        );
        return result !== false;
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '操作に失敗しました。');
        return false;
      } finally {
        if (lock) {
          locked.current = false;
          setBusy(false);
        }
      }
    });
    queue.current = task;
    return task;
  }
  return (
    <section className="web-account-settings" aria-label="Webアカウント設定">
      <h2>Webアカウント</h2>
      <p className="muted">
        WebApplet専用のアカウント枠を管理します。同じ枠を選んだWebAppletはログイン状態を共有し、Gmailのアカウントとは別管理です。
      </p>
      <p>ここでの操作はすぐに反映されます。設定の保存は不要です。</p>
      <div className="actions">
        <button
          className="secondary"
          disabled={busy || accounts.length >= 32}
          onClick={() =>
            void run(
              () => window.dock.createWebAccount(`Webアカウント ${accounts.length + 1}`),
              'アカウント枠を追加しました。',
            )
          }
        >
          アカウント枠を追加
        </button>
      </div>
      {!accounts.length && (
        <p className="muted">アカウント枠がありません。枠を追加してWebAppletから選択できます。</p>
      )}
      {accounts.map((account) => {
        const users = [
          ...new Map(
            [...savedItems, ...draftItems]
              .filter((item) => item.accountId === account.id)
              .map((item) => [item.id, item.name]),
          ).values(),
        ];
        return (
          <AccountRow
            key={account.id}
            account={account}
            users={users}
            busy={busy}
            rename={(name) =>
              run(
                () => window.dock.renameWebAccount(account.id, name),
                'アカウント名を変更しました。',
                false,
              )
            }
            remove={() =>
              void run(
                () => window.dock.deleteWebAccount(account.id),
                (result) =>
                  result === 'deferred'
                    ? 'アカウント枠を削除しました。残る保存ファイルは次回起動時に自動で片づけます。'
                    : 'アカウント枠と保存データを削除しました。',
              )
            }
            clear={() =>
              void run(
                () => window.dock.clearWebAccount(account.id),
                'ログイン情報とサイトデータをクリアしました。',
              )
            }
          />
        );
      })}
      {message && <p role="status">{message}</p>}
      <p className="muted">
        使用中の枠は削除できません。WebAppletから外して設定を保存してください。削除は枠と保存データをまとめて消し、クリアは枠を残してログイン情報とサイトデータを消します。どちらも警告画面で確認します。
      </p>
    </section>
  );
}
