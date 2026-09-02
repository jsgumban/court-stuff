import { useEffect, useState } from 'react';
import { cx } from '../lib/cx';

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  label = 'games',
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)));

  return (
    <div className={cx('inline-flex items-stretch overflow-hidden rounded-xl border border-line bg-surface', className)}>
      <button
        type="button"
        className="h-11 w-11 text-xl leading-none text-muted hover:bg-surface-2 active:bg-line disabled:opacity-40 md:h-9 md:w-9 md:text-lg"
        onClick={() => set(value - 1)}
        disabled={value <= min}
        aria-label={`Fewer ${label}`}
      >
        −
      </button>
      <input
        inputMode="numeric"
        aria-label={label}
        className="num w-12 border-x border-line bg-transparent text-center text-base font-semibold focus:outline-none md:w-10 md:text-sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => {
          setFocused(true);
          e.target.select();
        }}
        onBlur={() => {
          setFocused(false);
          const n = parseFloat(draft);
          if (Number.isFinite(n) && n !== value) set(n);
          else setDraft(String(value));
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <button
        type="button"
        className="h-11 w-11 text-xl leading-none text-muted hover:bg-surface-2 active:bg-line disabled:opacity-40 md:h-9 md:w-9 md:text-lg"
        onClick={() => set(value + 1)}
        disabled={value >= max}
        aria-label={`More ${label}`}
      >
        +
      </button>
    </div>
  );
}
