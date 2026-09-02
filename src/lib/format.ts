import type { LineBill, SessionBill } from './billing';
import type { Session, Settings } from './types';

export function formatMoney(n: number, currency = '₱'): string {
  const abs = Math.abs(n);
  const body = abs.toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${n < 0 ? '-' : ''}${currency}${body}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function todayISO(): string {
  const d = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** 9/2/2026 — the style used in the group chat. */
export function formatDateShort(iso: string): string {
  const d = parseISO(iso);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

/** Wed, Sep 2, 2026 */
export function formatDateLong(iso: string): string {
  return parseISO(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** September 2026 — used for grouping the history list. */
export function formatMonth(iso: string): string {
  return parseISO(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** "just now", "3 min ago", "2 hr ago", "yesterday", "5 days ago" */
export function timeAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export function pluralGames(n: number): string {
  return `${formatNumber(n)} ${n === 1 ? 'game' : 'games'}`;
}

/** The "= (2 games x ₱25) + ₱100" part of a line. */
export function lineFormula(line: LineBill, bill: SessionBill, currency: string): string {
  const parts: string[] = [];
  const hasGames = bill.perGamePool > 0 || line.entry.games > 0;
  if (hasGames) parts.push(`${pluralGames(line.entry.games)} x ${formatMoney(bill.rate, currency)}`);
  if (line.equalShare) parts.push(`${formatMoney(line.equalShare, currency)} equal share`);
  if (line.visitorFee) parts.push(formatMoney(line.visitorFee, currency));
  if (line.extra) {
    const note = line.entry.extraNote ? ` (${line.entry.extraNote})` : '';
    parts.push(`${formatMoney(line.extra, currency)}${note}`);
  }
  if (parts.length === 0) return formatMoney(0, currency);
  if (parts.length === 1) return parts[0];
  const [first, ...rest] = parts;
  const head = hasGames ? `(${first})` : first;
  return head + rest.map((p) => (p.startsWith('-') ? ` - ${p.slice(1)}` : ` + ${p}`)).join('');
}

/** Builds the announcement text in the same shape the group already uses. */
export function buildChatMessage(session: Session, bill: SessionBill, settings: Settings): string {
  const c = settings.currency;
  const out: string[] = [];
  out.push(session.court.trim() || 'Court');
  out.push(formatDateShort(session.date));
  out.push('');

  const perGameCosts = [
    ...(session.lightsSplit === 'perGame' ? [{ label: 'Lights', amount: session.lightsCost }] : []),
    ...session.otherCosts.filter((x) => x.split === 'perGame'),
  ];
  const equalCosts = [
    ...(session.lightsSplit === 'equal' ? [{ label: 'Lights', amount: session.lightsCost }] : []),
    ...session.otherCosts.filter((x) => x.split === 'equal'),
  ];

  if (perGameCosts.length) {
    for (const cost of perGameCosts) out.push(`${cost.label} = ${formatMoney(cost.amount, c)}`);
    out.push(`- Total # of games = ${pluralGames(bill.totalGames)}`);
    out.push(perGameCosts.length === 1 ? `- ${perGameCosts[0].label} amount/games` : '- Amount/games');
    out.push(`= ${formatMoney(bill.perGamePool, c)}/${formatNumber(bill.totalGames)}`);
    out.push(`= ${formatMoney(bill.rate, c)} per game`);
    out.push('');
  }
  if (equalCosts.length) {
    for (const cost of equalCosts) out.push(`${cost.label} = ${formatMoney(cost.amount, c)}`);
    out.push(`- Split equally among ${bill.headcount}`);
    out.push(`= ${formatMoney(bill.equalPool, c)}/${bill.headcount}`);
    out.push(`= ${formatMoney(bill.equalShare, c)} each`);
    out.push('');
  }
  if (bill.lines.some((l) => l.visitorFee)) {
    out.push(`${settings.visitorFeeLabel} = ${formatMoney(session.visitorFee, c)}`);
    out.push('');
  }

  bill.lines.forEach((line, i) => {
    out.push(`${i + 1}. ${line.entry.label}${line.entry.paid ? ' ✅' : ''}`);
    out.push(`= ${lineFormula(line, bill, c)}`);
    out.push(`= ${formatMoney(line.total, c)}`);
    out.push('');
  });

  out.push(`Total = ${formatMoney(bill.billed, c)}`);
  out.push(`Paid = ${formatMoney(bill.collected, c)} (${bill.paidCount}/${bill.headcount})`);
  out.push(`Unpaid = ${formatMoney(bill.outstanding, c)}`);
  if (session.notes?.trim()) {
    out.push('');
    out.push(session.notes.trim());
  }
  return out.join('\n');
}
