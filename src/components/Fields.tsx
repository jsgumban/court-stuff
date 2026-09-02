import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';

type Base = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'prefix'>;

/** Text input that keeps a local draft while focused and commits on blur / Enter. */
export function TextField({
  value,
  onCommit,
  className,
  focusOnMount,
  ...rest
}: Base & { value: string; onCommit: (v: string) => void; focusOnMount?: boolean }) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);
  // autoFocus is unreliable inside a dialog that just took focus itself.
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);
  return (
    <input
      ref={ref}
      {...rest}
      className={cx('input', className)}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

/** Numeric input with optional currency prefix; commits a parsed number on blur / Enter. */
export function NumberField({
  value,
  onCommit,
  prefix,
  min,
  className,
  allowNegative = false,
  ...rest
}: Base & { value: number; onCommit: (v: number) => void; prefix?: ReactNode; min?: number; allowNegative?: boolean }) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const commit = () => {
    const cleaned = draft.replace(/[^0-9.-]/g, '');
    let n = parseFloat(cleaned);
    if (!Number.isFinite(n)) n = value;
    if (!allowNegative && n < 0) n = 0;
    if (min !== undefined && n < min) n = min;
    n = Math.round(n * 100) / 100;
    setDraft(String(n));
    if (n !== value) onCommit(n);
  };

  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">{prefix}</span>}
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        className={cx('input num', prefix ? 'pl-7' : undefined, className)}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => {
          setFocused(true);
          e.target.select();
        }}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setDraft(String(value));
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </div>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** Multi-line variant of TextField; commits on blur. */
export function TextAreaField({
  value,
  onCommit,
  className,
  rows = 2,
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  rows?: number;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);
  return (
    <textarea
      rows={rows}
      placeholder={placeholder}
      className={cx('input resize-y', className)}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        if (draft !== value) onCommit(draft);
      }}
    />
  );
}
