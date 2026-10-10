import { useEffect, useState } from 'react';
import { Toggle } from './Toggle';
import type { GestureSettings } from '../shared/gestures';
function Names({
  label,
  values,
  change,
}: {
  label: string;
  values: string[];
  change: (values: string[]) => void;
}) {
  const [text, setText] = useState(values.join(', '));
  useEffect(() => setText(values.join(', ')), [JSON.stringify(values)]);
  return (
    <label className="gesture-option">
      <span>{label}</span>
      <input
        aria-label={label}
        value={text}
        placeholder="chrome.exe, firefox.exe"
        onChange={(e) => setText(e.target.value)}
        onBlur={() =>
          change(
            text
              .split(/[\n,]/)
              .map((v) => v.trim())
              .filter(Boolean),
          )
        }
      />
    </label>
  );
}

export function GestureOptions({
  gestures,
  change,
}: {
  gestures: GestureSettings;
  change(patch: Partial<GestureSettings>): void;
}) {
  return (
    <details className="gesture-options">
      <summary>
        動作設定 <small>対象ブラウザ・除外・操作感・待機表示</small>
      </summary>
      <p className="settings-help">
        一時停止はトレイから切り替えられます。何も操作せず右ボタンを離すと、通常の右クリックになります。
      </p>
      <Names
        label="Webブラウザのexe"
        values={gestures.browsers}
        change={(browsers) => change({ browsers })}
      />
      <Names
        label="ジェスチャーを除外するexe"
        values={gestures.excludedProcesses}
        change={(excludedProcesses) => change({ excludedProcesses })}
      />
      <div className="gesture-enabled">
        <Toggle
          label="ブラウザ条件でChromiumウィンドウだけを対象にする"
          checked={gestures.requireChromiumWindowClass}
          onChange={(requireChromiumWindowClass) => change({ requireChromiumWindowClass })}
        />
        ブラウザ条件でChromiumウィンドウだけを対象にする
      </div>{' '}
      <p className="settings-help">
        Firefoxなどではオフにします。WebBrowserToolsの操作対象もこの一覧を使います。exe名のみを指定し、パスは含めません。
      </p>
      <div className="gesture-options-grid">
        <label className="gesture-option">
          <span>移動距離（px）</span>
          <input
            type="number"
            min="5"
            max="500"
            value={gestures.distance}
            onChange={(e) => change({ distance: Number(e.target.value) })}
          />
        </label>
        <label className="gesture-option">
          <span>ホイールの最小実行間隔（ms）</span>
          <input
            type="number"
            min="0"
            max="5000"
            value={gestures.wheelDelayMs}
            onChange={(e) => change({ wheelDelayMs: Number(e.target.value) })}
          />
        </label>
        <label className="gesture-option">
          <span>待機表示の位置</span>
          <select
            value={gestures.indicatorPosition}
            onChange={(e) =>
              change({ indicatorPosition: e.target.value as typeof gestures.indicatorPosition })
            }
          >
            <option value="gesture-start">ジェスチャー開始地点</option>
            <option value="window-center">対象ウィンドウの中央</option>
          </select>
        </label>
        <label className="gesture-option">
          <span>待機表示の不透明度</span>
          <input
            type="number"
            min="0.1"
            max="1"
            step="0.05"
            value={gestures.indicatorOpacity}
            onChange={(e) => change({ indicatorOpacity: Number(e.target.value) })}
          />
        </label>
      </div>
    </details>
  );
}
