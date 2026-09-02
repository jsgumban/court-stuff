import type { LineBill, SessionBill } from '../lib/billing';
import { cx } from '../lib/cx';
import { formatMoney, formatNumber, pluralGames } from '../lib/format';

export interface BreakdownRow {
  label: string;
  detail?: string;
  amount: number;
}

/** The itemised rows behind one person's total. */
export function breakdownRows(line: LineBill, bill: SessionBill, currency: string, visitorFeeLabel = 'Visitor fee'): BreakdownRow[] {
  const rows: BreakdownRow[] = [];
  if (bill.perGamePool > 0 || line.entry.games > 0) {
    rows.push({
      label: 'Games played',
      detail: `${pluralGames(line.entry.games)} × ${formatMoney(bill.rate, currency)}`,
      amount: line.gameShare,
    });
  }
  if (line.equalShare) {
    rows.push({
      label: 'Shared costs',
      detail: `${formatMoney(bill.equalPool, currency)} ÷ ${formatNumber(bill.headcount)}`,
      amount: line.equalShare,
    });
  }
  if (line.visitorFee) rows.push({ label: visitorFeeLabel, amount: line.visitorFee });
  if (line.extra) rows.push({ label: line.entry.extraNote?.trim() || (line.extra < 0 ? 'Discount' : 'Extra'), amount: line.extra });
  return rows;
}

export function Breakdown({
  line,
  bill,
  currency,
  visitorFeeLabel,
  className,
}: {
  line: LineBill;
  bill: SessionBill;
  currency: string;
  visitorFeeLabel?: string;
  className?: string;
}) {
  const rows = breakdownRows(line, bill, currency, visitorFeeLabel);
  return (
    <div className={cx('overflow-hidden rounded-xl border border-line', className)}>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cx(i > 0 && 'border-t border-line')}>
              <td className="px-3 py-2.5">
                <div className="font-medium">{r.label}</div>
                {r.detail && <div className="num text-xs text-muted">{r.detail}</div>}
              </td>
              <td className={cx('num px-3 py-2.5 text-right font-medium', r.amount < 0 && 'text-ok')}>{formatMoney(r.amount, currency)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="px-3 py-2.5 text-sm text-muted">Nothing charged yet.</td>
              <td className="num px-3 py-2.5 text-right">{formatMoney(0, currency)}</td>
            </tr>
          )}
          <tr className="border-t-2 border-line bg-surface-2">
            <td className="px-3 py-2.5 font-semibold">Total to pay</td>
            <td className="num px-3 py-2.5 text-right text-lg font-semibold">{formatMoney(line.total, currency)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
