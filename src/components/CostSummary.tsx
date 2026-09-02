import { payablesOf, round2, type SessionBill } from '../lib/billing';
import { cx } from '../lib/cx';
import { formatMoney, formatNumber, pluralGames } from '../lib/format';
import type { Session } from '../lib/types';

interface Row {
  key: string;
  label: string;
  detail?: string;
  amount: number;
  muted?: boolean;
}

/**
 * Turns the bill into lines that add up in public: every payable with the
 * division that produced its share, then the fees and extras, then the total.
 */
export function costRows(session: Partial<Session>, bill: SessionBill, currency: string, visitorFeeLabel = 'Visitor fee'): Row[] {
  const rows: Row[] = [];
  const people = `${bill.headcount} ${bill.headcount === 1 ? 'person' : 'people'}`;

  for (const p of payablesOf(session)) {
    if (!p.amount && !p.label.trim()) continue;
    let detail: string;
    if (p.split === 'perGame') {
      detail =
        bill.totalGames > 0
          ? `${formatMoney(p.amount, currency)} ÷ ${pluralGames(bill.totalGames)} = ${formatMoney(round2(p.amount / bill.totalGames), currency)} per game`
          : 'split by games — add people first';
    } else {
      detail =
        bill.headcount > 0
          ? `${formatMoney(p.amount, currency)} ÷ ${people} = ${formatMoney(round2(p.amount / bill.headcount), currency)} each`
          : 'split equally — add people first';
    }
    rows.push({ key: p.id, label: p.label.trim() || 'Unnamed', detail, amount: p.amount });
  }

  const visitors = bill.lines.filter((l) => l.visitorFee > 0);
  if (visitors.length) {
    const fee = visitors[0].visitorFee;
    rows.push({
      key: 'visitor',
      label: visitorFeeLabel,
      detail: `${formatMoney(fee, currency)} × ${visitors.length} ${visitors.length === 1 ? 'visitor' : 'visitors'}`,
      amount: round2(visitors.reduce((s, l) => s + l.visitorFee, 0)),
    });
  }

  const extras = bill.lines.filter((l) => l.extra !== 0);
  if (extras.length) {
    rows.push({
      key: 'extras',
      label: extras.length === 1 ? extras[0].entry.extraNote?.trim() || 'Extra' : 'Extras and discounts',
      detail: extras.length === 1 ? `on ${extras[0].entry.label}` : `on ${extras.length} people`,
      amount: round2(extras.reduce((s, l) => s + l.extra, 0)),
    });
  }

  if (bill.variance !== 0) {
    rows.push({
      key: 'rounding',
      label: 'Rounding',
      detail: bill.variance > 0 ? 'collected over the actual cost' : 'short of the actual cost',
      amount: bill.variance,
      muted: true,
    });
  }

  return rows;
}

export function CostSummary({
  session,
  bill,
  currency,
  visitorFeeLabel,
  className,
}: {
  session: Partial<Session>;
  bill: SessionBill;
  currency: string;
  visitorFeeLabel?: string;
  className?: string;
}) {
  const rows = costRows(session, bill, currency, visitorFeeLabel);
  if (rows.length === 0) return null;

  const perGame = payablesOf(session).filter((p) => p.split === 'perGame' && p.amount > 0);
  const showCombined = perGame.length > 1 && bill.totalGames > 0;
  // The pooled rate belongs directly under the per-game lines it came from.
  const combinedAfter = showCombined ? perGame[perGame.length - 1].id : null;

  return (
    <div className={cx('text-sm', className)}>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="flex items-baseline gap-3 py-2">
              <span className="min-w-0 flex-1">
                <span className={cx('block truncate font-medium', r.muted && 'text-muted')}>{r.label}</span>
                {r.detail && <span className="num block text-xs text-muted">{r.detail}</span>}
              </span>
              <span className={cx('num shrink-0 font-medium', r.muted && 'text-muted', r.amount < 0 && 'text-ok')}>
                {formatMoney(r.amount, currency)}
              </span>
            </div>
            {combinedAfter === r.key && (
              <div className="num mb-2 rounded-lg bg-surface-2 px-3 py-2 text-xs">
                Together: {formatMoney(bill.perGamePool, currency)} ÷ {pluralGames(bill.totalGames)} ={' '}
                <span className="font-semibold text-gold">{formatMoney(bill.rate, currency)}</span> per game
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-baseline gap-3 border-t-2 border-line pt-2.5">
        <span className="flex-1 font-semibold">To collect</span>
        <span className="num shrink-0 text-lg font-semibold">{formatMoney(bill.billed, currency)}</span>
      </div>
      {bill.headcount > 0 && bill.totalGames > 0 && (
        <p className="num mt-1 text-xs text-muted">
          Across {bill.headcount} {bill.headcount === 1 ? 'person' : 'people'} and {formatNumber(bill.totalGames)} games.
        </p>
      )}
    </div>
  );
}
