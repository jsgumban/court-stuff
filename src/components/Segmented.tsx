import { cx } from '../lib/cx';

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; badge?: string }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cx('flex gap-1 rounded-xl bg-surface-2 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition',
              active ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            {o.label}
            {o.badge && (
              <span className={cx('num rounded-full px-1.5 text-[11px]', active ? 'bg-surface-2 text-muted' : 'bg-line/60 text-muted')}>{o.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
