import { cx } from '../lib/cx';
import { formatMoney } from '../lib/format';

export function Money({ value, currency = '₱', className }: { value: number; currency?: string; className?: string }) {
  return <span className={cx('num', className)}>{formatMoney(value, currency)}</span>;
}
