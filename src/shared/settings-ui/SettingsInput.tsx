import {
  forwardRef,
  useRef,
  useState,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

/** Keep composition local; only confirmed text enters the shared editing session. */
export const SettingsInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function SettingsInput(props, ref) {
    const composing = useRef(false);
    const [raw, setRaw] = useState('');
    const numeric = props.type === 'number';
    return (
      <input
        {...props}
        ref={ref}
        type={numeric ? 'text' : props.type}
        inputMode={numeric ? 'decimal' : props.inputMode}
        role={numeric ? 'spinbutton' : props.role}
        aria-valuemin={numeric && props.min !== undefined ? Number(props.min) : undefined}
        aria-valuemax={numeric && props.max !== undefined ? Number(props.max) : undefined}
        value={composing.current ? raw : props.value}
        onCompositionStart={(event) => {
          composing.current = true;
          setRaw(event.currentTarget.value);
          props.onCompositionStart?.(event);
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          setRaw(event.currentTarget.value);
          props.onCompositionEnd?.(event);
          props.onChange?.(event as any);
        }}
        onChange={(event) => {
          if (composing.current) setRaw(event.currentTarget.value);
          else props.onChange?.(event);
        }}
        onKeyDown={(event) => {
          props.onKeyDown?.(event);
          if (
            !numeric ||
            composing.current ||
            event.defaultPrevented ||
            !['ArrowUp', 'ArrowDown'].includes(event.key)
          )
            return;
          event.preventDefault();
          const step = Number(props.step) || 1,
            current = Number(props.value) || 0;
          event.currentTarget.value = String(
            Math.min(
              props.max === undefined ? Infinity : Number(props.max),
              Math.max(
                props.min === undefined ? -Infinity : Number(props.min),
                current + (event.key === 'ArrowUp' ? step : -step),
              ),
            ),
          );
          props.onChange?.(event as any);
        }}
      />
    );
  },
);
export const SettingsTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function SettingsTextarea(props, ref) {
  const composing = useRef(false);
  const [raw, setRaw] = useState('');
  return (
    <textarea
      {...props}
      ref={ref}
      value={composing.current ? raw : props.value}
      onCompositionStart={(e) => {
        composing.current = true;
        setRaw(e.currentTarget.value);
        props.onCompositionStart?.(e);
      }}
      onCompositionEnd={(e) => {
        composing.current = false;
        setRaw(e.currentTarget.value);
        props.onCompositionEnd?.(e);
        props.onChange?.(e as any);
      }}
      onChange={(e) => {
        if (composing.current) setRaw(e.currentTarget.value);
        else props.onChange?.(e);
      }}
    />
  );
});
/** Incomplete numbers remain text, never NaN; validation runs in main at save. */
export function numberInput(text: string): number {
  return (
    /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text) &&
    !text.endsWith('.') &&
    Number.isFinite(Number(text))
      ? Number(text)
      : text
  ) as number;
}
