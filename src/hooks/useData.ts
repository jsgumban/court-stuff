import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { getSettings } from '../db/repo';
import { computeBill } from '../lib/billing';
import { computePlayerStats, summarizeSessions } from '../lib/stats';
import type { Entry, Session } from '../lib/types';

const byDateDesc = (a: Session, b: Session) => (a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date));

export function useSettings() {
  return useLiveQuery(getSettings, []);
}

export function useSessions() {
  return useLiveQuery(async () => (await db.sessions.toArray()).sort(byDateDesc), []);
}

export function useSession(id: string | undefined) {
  return useLiveQuery(async () => (id ? (await db.sessions.get(id)) ?? null : null), [id]);
}

export function useEntries(sessionId: string | undefined) {
  return useLiveQuery(
    () => (sessionId ? db.entries.where('sessionId').equals(sessionId).sortBy('order') : Promise.resolve([] as Entry[])),
    [sessionId],
  );
}

export function usePlayers() {
  return useLiveQuery(async () => (await db.players.toArray()).sort((a, b) => a.name.localeCompare(b.name)), []);
}

export function usePlayer(id: string | undefined) {
  return useLiveQuery(async () => (id ? (await db.players.get(id)) ?? null : null), [id]);
}

/** Every session with its totals, newest first. */
export function useSessionSummaries() {
  return useLiveQuery(async () => {
    const [sessions, entries] = await Promise.all([db.sessions.toArray(), db.entries.toArray()]);
    return summarizeSessions(sessions.sort(byDateDesc), entries);
  }, []);
}

export function usePlayerStats() {
  return useLiveQuery(async () => {
    const [sessions, entries] = await Promise.all([db.sessions.toArray(), db.entries.toArray()]);
    return computePlayerStats(sessions, entries);
  }, []);
}

/** A player's lines across all sessions, newest first, each with its computed total. */
export function usePlayerHistory(playerId: string | undefined) {
  return useLiveQuery(async () => {
    if (!playerId) return [];
    const mine = await db.entries.where('playerId').equals(playerId).toArray();
    const sessionIds = [...new Set(mine.map((e) => e.sessionId))];
    const [sessions, allEntries] = await Promise.all([
      db.sessions.bulkGet(sessionIds),
      db.entries.where('sessionId').anyOf(sessionIds).toArray(),
    ]);
    const rows = [];
    for (const session of sessions) {
      if (!session) continue;
      const bill = computeBill(session, allEntries.filter((e) => e.sessionId === session.id));
      for (const line of bill.lines) {
        if (line.entry.playerId === playerId) rows.push({ session, line });
      }
    }
    return rows.sort((a, b) => byDateDesc(a.session, b.session));
  }, [playerId]);
}
