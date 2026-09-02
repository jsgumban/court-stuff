import { cx } from '../lib/cx';

export function Switch({
  checked,
  onChange,
  label,
  size = 'md',
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const track = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const knob = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const shift = size === 'sm' ? 'translate-x-4' : 'translate-x-5';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx('inline-flex min-h-10 items-center gap-2 py-1 text-sm select-none md:min-h-0 md:py-0', className)}
    >
      <span className={cx('relative inline-flex shrink-0 items-center rounded-full transition', track, checked ? 'bg-accent' : 'bg-line')}>
        <span
          className={cx(
            'absolute left-0.5 rounded-full bg-white shadow transition-transform dark:bg-surface',
            knob,
            checked ? shift : 'translate-x-0',
          )}
        />
      </span>
      {label && <span className={cx(checked ? 'text-ink' : 'text-muted')}>{label}</span>}
    </button>
  );
}
