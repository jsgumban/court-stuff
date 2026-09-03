import { computeBill } from './billing';
import type { Entry, Session } from './types';

export interface PlayerStats {
  playerId: string;
  sessions: number;
  games: number;
  billed: number;
  paid: number;
  outstanding: number;
  unpaidLines: number;
  lastDate?: string;
}

export interface SessionSummary {
  session: Session;
  headcount: number;
  totalGames: number;
  billed: number;
  collected: number;
  outstanding: number;
  paidCount: number;
}

export function groupEntriesBySession(entries: Entry[]): Map<string, Entry[]> {
  const map = new Map<string, Entry[]>();
  for (const e of entries) {
    const list = map.get(e.sessionId);
    if (list) list.push(e);
    else map.set(e.sessionId, [e]);
  }
  return map;
}

export function summarizeSessions(sessions: Session[], entries: Entry[]): SessionSummary[] {
  const grouped = groupEntriesBySession(entries);
  return sessions.map((session) => {
    const bill = computeBill(session, grouped.get(session.id) ?? []);
    return {
      session,
      headcount: bill.headcount,
      totalGames: bill.totalGames,
      billed: bill.billed,
      collected: bill.collected,
      outstanding: bill.outstanding,
      paidCount: bill.paidCount,
    };
  });
}

export function computePlayerStats(sessions: Session[], entries: Entry[]): Map<string, PlayerStats> {
  const grouped = groupEntriesBySession(entries);
  const stats = new Map<string, PlayerStats>();
  for (const session of sessions) {
    const bill = computeBill(session, grouped.get(session.id) ?? []);
    const seenThisSession = new Set<string>();
    for (const line of bill.lines) {
      const pid = line.entry.playerId;
      if (!pid) continue;
      const s = stats.get(pid) ?? {
        playerId: pid,
        sessions: 0,
        games: 0,
        billed: 0,
        paid: 0,
        outstanding: 0,
        unpaidLines: 0,
      };
      if (!seenThisSession.has(pid)) {
        s.sessions += 1;
        seenThisSession.add(pid);
      }
      s.games += line.entry.games;
      s.billed += line.total;
      if (line.entry.paid) s.paid += line.total;
      else {
        s.outstanding += line.total;
        s.unpaidLines += 1;
      }
      if (!s.lastDate || session.date > s.lastDate) s.lastDate = session.date;
      stats.set(pid, s);
    }
  }
  return stats;
}
