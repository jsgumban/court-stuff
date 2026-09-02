import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export function Stat({ label, value, tone, className }: { label: string; value: ReactNode; tone?: 'ok' | 'bad' | 'warn'; className?: string }) {
  return (
    <div className={cx('card px-3 py-2.5', className)}>
      <div className="stat-label">{label}</div>
      <div className={cx('num mt-0.5 text-lg font-semibold leading-tight', tone === 'ok' && 'text-ok', tone === 'bad' && 'text-bad', tone === 'warn' && 'text-warn')}>
        {value}
      </div>
    </div>
  );
}
