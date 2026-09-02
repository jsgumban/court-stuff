import type { Entry, Rounding, Session } from './types';

export interface LineBill {
  entry: Entry;
  /** games × per-game rate */
  gameShare: number;
  /** share of costs split equally per head */
  equalShare: number;
  visitorFee: number;
  extra: number;
  total: number;
}

export interface SessionBill {
  lines: LineBill[];
  headcount: number;
  totalGames: number;
  /** Everything that is split per game (lights when lightsSplit = perGame, plus other per-game costs). */
  perGamePool: number;
  /** Everything that is split equally per head. */
  equalPool: number;
  rawRate: number;
  rate: number;
  rawEqualShare: number;
  equalShare: number;
  /** Actual money the session must recover: lights + other costs + visitor fees + extras. */
  expected: number;
  /** Sum of what people are billed (differs from expected only through rounding). */
  billed: number;
  variance: number;
  collected: number;
  outstanding: number;
  paidCount: number;
}

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function roundRate(raw: number, rounding: Rounding): number {
  if (!Number.isFinite(raw)) return 0;
  switch (rounding) {
    case 'exact':
      return round2(raw);
    case 'peso':
      return Math.round(raw);
    case 'five':
      return Math.ceil(raw / 5) * 5;
  }
}

export function computeBill(session: Session, entries: Entry[]): SessionBill {
  const sorted = [...entries].sort((a, b) => a.order - b.order);
  const headcount = sorted.length;
  const totalGames = sorted.reduce((s, e) => s + (e.games || 0), 0);

  const other = session.otherCosts ?? [];
  const perGamePool =
    (session.lightsSplit === 'perGame' ? session.lightsCost : 0) +
    other.filter((c) => c.split === 'perGame').reduce((s, c) => s + c.amount, 0);
  const equalPool =
    (session.lightsSplit === 'equal' ? session.lightsCost : 0) +
    other.filter((c) => c.split === 'equal').reduce((s, c) => s + c.amount, 0);

  const rawRate = totalGames > 0 ? perGamePool / totalGames : 0;
  const rate = totalGames > 0 ? roundRate(rawRate, session.rounding) : 0;
  const rawEqualShare = headcount > 0 ? equalPool / headcount : 0;
  const equalShare = headcount > 0 ? roundRate(rawEqualShare, session.rounding) : 0;

  const lines: LineBill[] = sorted.map((entry) => {
    const gameShare = round2((entry.games || 0) * rate);
    const visitorFee = entry.isVisitor ? session.visitorFee : 0;
    const extra = entry.extra || 0;
    const total = round2(gameShare + equalShare + visitorFee + extra);
    return { entry, gameShare, equalShare, visitorFee, extra, total };
  });

  const visitorFees = lines.reduce((s, l) => s + l.visitorFee, 0);
  const extras = lines.reduce((s, l) => s + l.extra, 0);
  const expected = round2(perGamePool + equalPool + visitorFees + extras);
  const billed = round2(lines.reduce((s, l) => s + l.total, 0));
  const collected = round2(lines.filter((l) => l.entry.paid).reduce((s, l) => s + l.total, 0));

  return {
    lines,
    headcount,
    totalGames,
    perGamePool,
    equalPool,
    rawRate,
    rate,
    rawEqualShare,
    equalShare,
    expected,
    billed,
    variance: round2(billed - expected),
    collected,
    outstanding: round2(billed - collected),
    paidCount: lines.filter((l) => l.entry.paid).length,
  };
}

/** "24 game slots" → 6 doubles matches (or null when it does not divide evenly). */
export function matchesFromSlots(totalGames: number, playersPerGame: number): number | null {
  if (playersPerGame <= 0 || totalGames <= 0) return null;
  return totalGames % playersPerGame === 0 ? totalGames / playersPerGame : null;
}
