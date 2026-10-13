import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

/** Keep composition and incomplete text local; save confirmed input immediately. */
export const SettingsInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function SettingsInput(props, ref) {
    const composing = useRef(false);
    const focused = useRef(false);
    const [raw, setRaw] = useState('');
    const numeric = props.type === 'number';
    useEffect(() => {
      if (!composing.current && focused.current && props.value !== undefined) {
        const same =
          (numeric &&
            raw.trim() !== '' &&
            Number.isFinite(Number(raw)) &&
            Number(raw) === Number(props.value)) ||
          (!numeric && raw.trim() === String(props.value));
        if (!same) setRaw(String(props.value));
      }
    }, [props.value]);
    return (
      <input
        {...props}
        ref={ref}
        type={numeric ? 'text' : props.type}
        inputMode={numeric ? 'decimal' : props.inputMode}
        role={numeric ? 'spinbutton' : props.role}
        aria-valuemin={numeric && props.min !== undefined ? Number(props.min) : undefined}
        aria-valuemax={numeric && props.max !== undefined ? Number(props.max) : undefined}
        value={
          props.value !== undefined && (composing.current || focused.current) ? raw : props.value
        }
        onFocus={(e) => {
          focused.current = true;
          setRaw(e.currentTarget.value);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          focused.current = false;
          setRaw(e.currentTarget.value);
          props.onBlur?.(e);
        }}
        onCompositionStart={(event) => {
          composing.current = true;
          setRaw(event.currentTarget.value);
          props.onCompositionStart?.(event);
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          setRaw(event.currentTarget.value);
          props.onCompositionEnd?.(event);
          setRaw(event.currentTarget.value);
          props.onChange?.(event as any);
        }}
        onChange={(event) => {
          setRaw(event.currentTarget.value);
          if (!composing.current) props.onChange?.(event);
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
          setRaw(event.currentTarget.value);
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
  const focused = useRef(false);
  const [raw, setRaw] = useState('');
  return (
    <textarea
      {...props}
      ref={ref}
      value={
        props.value !== undefined && (composing.current || focused.current) ? raw : props.value
      }
      onFocus={(e) => {
        focused.current = true;
        setRaw(e.currentTarget.value);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        focused.current = false;
        setRaw(e.currentTarget.value);
        props.onBlur?.(e);
      }}
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
        setRaw(e.currentTarget.value);
        if (!composing.current) props.onChange?.(e);
      }}
    />
  );
});
/** Incomplete numbers remain text, never NaN; validation precedes each immediate write. */
export function numberInput(text: string): number {
  return (
    /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text) &&
    !text.endsWith('.') &&
    Number.isFinite(Number(text))
      ? Number(text)
      : text
  ) as number;
}
