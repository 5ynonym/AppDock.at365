import { useState } from 'react';
import type { ExtensionSnapshot, Settings } from '../shared/contracts';
import { ribbonItems, orderRibbon } from '../shared/applet-pages';

export function RibbonSettings({
  draft,
  extensions,
  onChange,
}: {
  draft: Settings;
  extensions: ExtensionSnapshot[];
  onChange(value: Settings): void;
}) {
  const [dragged, setDragged] = useState<string | null>(null);
  const items = orderRibbon(ribbonItems(extensions), draft.ribbon.order);
  const move = (id: string, target: string) => {
    const order = items.map((item) => item.id);
    const from = order.indexOf(id),
      to = order.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    order.splice(from, 1);
    order.splice(to, 0, id);
    // Retain preferences for temporarily uninstalled Applets.
    onChange({
      ...draft,
      ribbon: {
        ...draft.ribbon,
        order: [...order, ...draft.ribbon.order.filter((key) => !order.includes(key))],
      },
    });
  };
  return (
    <section className="ribbon-settings" aria-label="リボン設定">
      <h3>リボン</h3>
      <p>
        左のリボンに表示するボタンを選べます。行をドラッグするか、上下ボタンで並べ替えてから保存してください。
      </p>
      <p className="muted">
        設定ボタンを非表示にしても、リボンの右クリックや「設定を開く」コマンドから戻れます。
      </p>
      <div className="ribbon-setting-list">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="ribbon-setting-row"
            data-ribbon-setting={item.id}
            draggable
            onDragStart={(event) => {
              setDragged(item.id);
              event.dataTransfer.setData('text/plain', item.id);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(event) => {
              if (dragged) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragged) move(dragged, item.id);
              setDragged(null);
            }}
            onDragEnd={() => setDragged(null)}
          >
            <span className="drag-handle" aria-hidden="true">
              ⠿
            </span>
            <label>
              <input
                type="checkbox"
                aria-label={`${item.title}をリボンに表示`}
                checked={!draft.ribbon.hidden.includes(item.id)}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    ribbon: {
                      ...draft.ribbon,
                      hidden: event.target.checked
                        ? draft.ribbon.hidden.filter((id) => id !== item.id)
                        : [...draft.ribbon.hidden, item.id],
                    },
                  })
                }
              />
              <span>
                {item.title}
                <small>{item.extensionId ?? 'AppDock'}</small>
              </span>
            </label>
            <button
              aria-label={`${item.title}を上へ`}
              disabled={index === 0}
              onClick={() => move(item.id, items[index - 1].id)}
            >
              ↑
            </button>
            <button
              aria-label={`${item.title}を下へ`}
              disabled={index === items.length - 1}
              onClick={() => move(item.id, items[index + 1].id)}
            >
              ↓
            </button>
          </div>
        ))}
      </div>
      <button
        className="text-button"
        onClick={() => onChange({ ...draft, ribbon: { order: [], hidden: [] } })}
      >
        リボンを初期状態に戻す
      </button>
    </section>
  );
}
