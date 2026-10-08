import { useState } from 'react';
import type { ExtensionSnapshot, Settings } from '../shared/contracts';
import { ribbonItems, orderRibbon, defaultRibbon, type RibbonItem } from '../shared/applet-pages';

type Placement = 'top' | 'bottom';
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
  const items = orderRibbon(ribbonItems(extensions, draft.ribbon.separators), draft.ribbon.order);
  const placement = (id: string): Placement =>
    draft.ribbon.bottom.includes(id) ? 'bottom' : 'top';
  const retainedOrder = (order: string[]) => [
    ...order,
    ...draft.ribbon.order.filter((key) => !items.some((item) => item.id === key)),
  ];
  const setPlacement = (id: string, next: Placement) => {
    const order = [...items.map((item) => item.id).filter((key) => key !== id), id];
    onChange({
      ...draft,
      ribbon: {
        ...draft.ribbon,
        order: retainedOrder(order),
        bottom: [
          ...draft.ribbon.bottom.filter((key) => key !== id),
          ...(next === 'bottom' ? [id] : []),
        ],
      },
    });
  };
  const move = (id: string, target: string) => {
    const order = items.map((item) => item.id);
    const from = order.indexOf(id),
      to = order.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    order.splice(from, 1);
    order.splice(to, 0, id);
    onChange({
      ...draft,
      ribbon: {
        ...draft.ribbon,
        order: retainedOrder(order),
        bottom: [
          ...draft.ribbon.bottom.filter((key) => key !== id),
          ...(placement(target) === 'bottom' ? [id] : []),
        ],
      },
    });
  };
  const addSeparator = (next: Placement) => {
    const id = `separator:${crypto.randomUUID()}`;
    onChange({
      ...draft,
      ribbon: {
        ...draft.ribbon,
        separators: [...draft.ribbon.separators, id],
        order: [...retainedOrder(items.map((item) => item.id)), id],
        bottom: [...draft.ribbon.bottom, ...(next === 'bottom' ? [id] : [])],
      },
    });
  };
  const removeSeparator = (id: string) =>
    onChange({
      ...draft,
      ribbon: {
        order: draft.ribbon.order.filter((key) => key !== id),
        hidden: draft.ribbon.hidden.filter((key) => key !== id),
        bottom: draft.ribbon.bottom.filter((key) => key !== id),
        separators: draft.ribbon.separators.filter((key) => key !== id),
      },
    });
  const row = (item: RibbonItem, index: number, group: RibbonItem[]) => (
    <div
      key={item.id}
      className={`ribbon-setting-row ${item.kind === 'separator' ? 'separator-setting-row' : ''}`}
      data-ribbon-setting={item.id}
      draggable
      onDragStart={(event) => {
        setDragged(item.id);
        event.dataTransfer.setData('text/plain', item.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(event) => {
        if (dragged || event.dataTransfer.types.includes('text/plain')) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const id = event.dataTransfer.getData('text/plain') || dragged;
        if (id && items.some((item) => item.id === id)) move(id, item.id);
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
          <small>{item.kind === 'separator' ? '区切り線' : (item.extensionId ?? 'AppDock')}</small>
        </span>
      </label>
      <select
        aria-label={`${item.title}の配置`}
        value={placement(item.id)}
        onChange={(event) => setPlacement(item.id, event.target.value as Placement)}
      >
        <option value="top">上寄せ</option>
        <option value="bottom">下寄せ</option>
      </select>
      <button
        aria-label={`${item.title}を上へ`}
        disabled={index === 0}
        onClick={() => move(item.id, group[index - 1].id)}
      >
        ↑
      </button>
      <button
        aria-label={`${item.title}を下へ`}
        disabled={index === group.length - 1}
        onClick={() => move(item.id, group[index + 1].id)}
      >
        ↓
      </button>
      {item.kind === 'separator' && (
        <button
          className="text-button"
          aria-label={`${item.title}を削除`}
          onClick={() => removeSeparator(item.id)}
        >
          削除
        </button>
      )}
    </div>
  );
  return (
    <section className="ribbon-settings" aria-label="リボン設定">
      <h3>リボン</h3>
      <p>
        上寄せ・下寄せを選び、それぞれの並び順と表示を設定できます。行をドラッグするか上下ボタンで並べ替えてから保存してください。
      </p>
      <p className="muted">
        設定ボタンを非表示にしても、リボンの右クリックや「設定を開く」コマンドから戻れます。
      </p>
      {(['top', 'bottom'] as const).map((position) => {
        const title = position === 'top' ? '上寄せ' : '下寄せ';
        const group = items.filter((item) => placement(item.id) === position);
        return (
          <section
            key={position}
            className="ribbon-placement"
            aria-label={`${title}のリボン設定`}
            onDragOver={(event) => {
              if (dragged || event.dataTransfer.types.includes('text/plain'))
                event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData('text/plain') || dragged;
              if (id && items.some((item) => item.id === id)) setPlacement(id, position);
              setDragged(null);
            }}
          >
            <div className="ribbon-group-heading">
              <h4>{title}</h4>
              <button
                className="secondary"
                disabled={draft.ribbon.separators.length >= 50}
                onClick={() => addSeparator(position)}
              >
                {title}にセパレーターを追加
              </button>
            </div>
            <div className="ribbon-setting-list">
              {group.map((item, index) => row(item, index, group))}
              {!group.length && (
                <p className="empty">
                  ここに表示するボタンはありません。配置の選択やドラッグで移動できます。
                </p>
              )}
            </div>
          </section>
        );
      })}
      <button
        className="text-button"
        onClick={() => onChange({ ...draft, ribbon: defaultRibbon() })}
      >
        リボンを初期状態に戻す
      </button>
    </section>
  );
}
