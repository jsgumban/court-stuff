import { describe, expect, it } from 'vitest';
import { computeBill, matchesFromSlots, roundRate } from './billing';
import { buildChatMessage } from './format';
import { SAMPLE_LINES, SAMPLE_SESSION } from './sample';
import { DEFAULT_SETTINGS, type Entry, type Session } from './types';

const session: Session = { ...SAMPLE_SESSION, id: 's1', createdAt: 0, updatedAt: 0 };
const entries: Entry[] = SAMPLE_LINES.map((l, i) => ({
  id: `e${i}`,
  sessionId: 's1',
  label: l.label,
  games: l.games,
  isVisitor: l.isVisitor,
  extra: 0,
  paid: l.paid,
  order: i,
}));

describe('Malindang 9/2/2026 sample', () => {
  const bill = computeBill(session, entries);

  it('derives ₱25 per game from ₱600 / 24 games', () => {
    expect(bill.totalGames).toBe(24);
    expect(bill.rate).toBe(25);
    expect(matchesFromSlots(bill.totalGames, 4)).toBe(6);
  });

  it('bills each line exactly as posted', () => {
    const byLabel = Object.fromEntries(bill.lines.map((l) => [l.entry.label, l.total]));
    expect(byLabel).toEqual({
      Mc: 50,
      Mark: 150,
      Daryll: 25,
      'Daryll (visitor)': 125,
      John: 25,
      Rose: 50,
      Mikko: 25,
      Jovs: 25,
      Gail: 50,
      Richmond: 25,
      Leah: 50,
      Dyson: 25,
      'John Goodman': 25,
      'Ej Cabanalan': 50,
      Abude: 50,
      Allen: 125,
      Chin: 125,
    });
  });

  it('recovers lights plus four visitor fees with no rounding variance', () => {
    expect(bill.expected).toBe(1000);
    expect(bill.billed).toBe(1000);
    expect(bill.variance).toBe(0);
  });

  it('tracks who has paid', () => {
    expect(bill.paidCount).toBe(9);
    expect(bill.collected).toBe(625);
    expect(bill.outstanding).toBe(375);
  });

  it('renders the chat message in the group format', () => {
    const msg = buildChatMessage(session, bill, DEFAULT_SETTINGS);
    expect(msg).toContain('Malindang\n9/2/2026\n\nLights = ₱600\n- Total # of games = 24 games\n- Lights amount/games\n= ₱600/24\n= ₱25 per game');
    expect(msg).toContain('1. Mc ✅\n= 2 games x ₱25\n= ₱50');
    expect(msg).toContain('2. Mark ✅\n= (2 games x ₱25) + ₱100\n= ₱150');
    expect(msg).toContain('3. Daryll\n= 1 game x ₱25\n= ₱25');
    expect(msg).toContain('Total = ₱1,000\nPaid = ₱625 (9/17)\nUnpaid = ₱375');
  });
});

describe('rounding and edge cases', () => {
  it('handles zero games without NaN', () => {
    const bill = computeBill(session, entries.map((e) => ({ ...e, games: 0 })));
    expect(bill.rate).toBe(0);
    expect(bill.billed).toBe(400); // only the four visitor fees
  });

  it('rounds the rate and reports the variance', () => {
    const odd = { ...session, lightsCost: 600 };
    const twentyThree = entries.slice(0, 16).concat([{ ...entries[16], games: 0 }]); // 23 games
    const exact = computeBill({ ...odd, rounding: 'exact' }, twentyThree);
    expect(exact.rate).toBe(26.09);
    const peso = computeBill({ ...odd, rounding: 'peso' }, twentyThree);
    expect(peso.rate).toBe(26);
    expect(peso.variance).toBeLessThan(0);
    const five = computeBill({ ...odd, rounding: 'five' }, twentyThree);
    expect(five.rate).toBe(30);
    expect(five.variance).toBeGreaterThan(0);
    expect(roundRate(26.087, 'five')).toBe(30);
  });

  it('splits equal-share costs per head and extras per line', () => {
    const s: Session = {
      ...session,
      otherCosts: [{ id: 'c1', label: 'Shuttlecocks', amount: 170, split: 'equal' }],
    };
    const withExtra = entries.map((e, i) => (i === 0 ? { ...e, extra: 40, extraNote: 'water' } : e));
    const bill = computeBill(s, withExtra);
    expect(bill.equalShare).toBe(10);
    expect(bill.lines[0].total).toBe(50 + 10 + 40);
    expect(bill.expected).toBe(600 + 170 + 400 + 40);
    expect(bill.billed).toBe(bill.expected);
  });

  it('adds per-game costs into the same rate as lights', () => {
    const s: Session = {
      ...session,
      otherCosts: [{ id: 'c1', label: 'Balls', amount: 120, split: 'perGame' }],
    };
    const bill = computeBill(s, entries);
    expect(bill.perGamePool).toBe(720);
    expect(bill.rate).toBe(30);
  });
});
