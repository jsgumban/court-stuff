import Dexie from 'dexie';
import { db } from './db';
import { uid } from '../lib/id';
import { todayISO } from '../lib/format';
import { SAMPLE_LINES, SAMPLE_SESSION } from '../lib/sample';
import {
  DEFAULT_SETTINGS,
  type BackupFile,
  type Entry,
  type Player,
  type Session,
  type Settings,
  type SharedCost,
} from '../lib/types';

// ---------- settings ----------

export async function getSettings(): Promise<Settings> {
  const stored = await db.settings.get('app');
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}), key: 'app' };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, key: 'app' });
}

// ---------- sessions ----------

export async function createSession(overrides: Partial<Session> = {}): Promise<string> {
  const s = await getSettings();
  const now = Date.now();
  const session: Session = {
    id: uid(),
    date: todayISO(),
    court: s.defaultCourt,
    lightsCost: s.defaultLightsCost,
    lightsSplit: s.defaultLightsSplit,
    visitorFee: s.defaultVisitorFee,
    rounding: s.defaultRounding,
    otherCosts: [],
    status: 'open',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  await db.sessions.add(session);
  return session.id;
}

export async function updateSession(id: string, patch: Partial<Omit<Session, 'id'>>): Promise<void> {
  await db.sessions.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteSession(id: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.entries, async () => {
    await db.entries.where('sessionId').equals(id).delete();
    await db.sessions.delete(id);
  });
}

/** New session for today with the same court/costs and the same people, games reset and unpaid. */
export async function duplicateSession(sourceId: string): Promise<string> {
  const source = await db.sessions.get(sourceId);
  if (!source) throw new Error('Session not found');
  const lines = await db.entries.where('sessionId').equals(sourceId).sortBy('order');
  const now = Date.now();
  const id = uid();
  await db.transaction('rw', db.sessions, db.entries, async () => {
    await db.sessions.add({
      ...source,
      id,
      date: todayISO(),
      status: 'open',
      notes: undefined,
      createdAt: now,
      updatedAt: now,
    });
    await db.entries.bulkAdd(
      lines.map((e, i) => ({
        id: uid(),
        sessionId: id,
        playerId: e.playerId,
        label: e.label,
        games: 1,
        isVisitor: e.isVisitor,
        extra: 0,
        paid: false,
        order: i,
      })),
    );
  });
  return id;
}

export async function addOtherCost(sessionId: string, cost: Omit<SharedCost, 'id'>): Promise<void> {
  const s = await db.sessions.get(sessionId);
  if (!s) return;
  await updateSession(sessionId, { otherCosts: [...(s.otherCosts ?? []), { ...cost, id: uid() }] });
}

export async function updateOtherCost(sessionId: string, costId: string, patch: Partial<SharedCost>): Promise<void> {
  const s = await db.sessions.get(sessionId);
  if (!s) return;
  await updateSession(sessionId, {
    otherCosts: s.otherCosts.map((c) => (c.id === costId ? { ...c, ...patch } : c)),
  });
}

export async function removeOtherCost(sessionId: string, costId: string): Promise<void> {
  const s = await db.sessions.get(sessionId);
  if (!s) return;
  await updateSession(sessionId, { otherCosts: s.otherCosts.filter((c) => c.id !== costId) });
}

// ---------- players ----------

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export async function findPlayerByName(name: string): Promise<Player | undefined> {
  const n = norm(name);
  if (!n) return undefined;
  const all = await db.players.toArray();
  return all.find((p) => norm(p.name) === n);
}

export async function ensurePlayer(name: string, isRegular: boolean): Promise<Player> {
  const existing = await findPlayerByName(name);
  if (existing) {
    if (!existing.active) await db.players.update(existing.id, { active: true });
    return existing;
  }
  const player: Player = {
    id: uid(),
    name: name.trim().replace(/\s+/g, ' '),
    isRegular,
    active: true,
    createdAt: Date.now(),
  };
  await db.players.add(player);
  return player;
}

export async function createPlayer(name: string, isRegular = true): Promise<Player> {
  return ensurePlayer(name, isRegular);
}

export async function updatePlayer(id: string, patch: Partial<Omit<Player, 'id'>>): Promise<void> {
  await db.players.update(id, patch);
}

/** Removes the player from the roster; past bill lines keep their label but lose the link. */
export async function deletePlayer(id: string): Promise<void> {
  await db.transaction('rw', db.players, db.entries, async () => {
    await db.entries
      .where('playerId')
      .equals(id)
      .modify((e) => {
        delete e.playerId;
      });
    await db.players.delete(id);
  });
}

/** Moves every bill line of `fromId` to `intoId`, then removes `fromId`. Fixes duplicate roster names. */
export async function mergePlayers(fromId: string, intoId: string): Promise<void> {
  if (fromId === intoId) return;
  await db.transaction('rw', db.players, db.entries, async () => {
    await db.entries.where('playerId').equals(fromId).modify({ playerId: intoId });
    await db.players.delete(fromId);
  });
}

// ---------- entries (bill lines) ----------

async function nextOrder(sessionId: string): Promise<number> {
  const last = await db.entries.where('[sessionId+order]').between([sessionId, Dexie.minKey], [sessionId, Dexie.maxKey]).last();
  return last ? last.order + 1 : 0;
}

export interface AddEntryInput {
  name: string;
  isVisitor?: boolean;
  games?: number;
  /** Link to a specific roster player instead of matching by name. */
  playerId?: string;
  /** Free-text line that should not create/link a roster player. */
  noPlayer?: boolean;
}

export async function addEntry(sessionId: string, input: AddEntryInput): Promise<string> {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('Name is required');
  const isVisitor = input.isVisitor ?? false;

  return db.transaction('rw', db.players, db.entries, async () => {
    let playerId = input.playerId;
    if (!playerId && !input.noPlayer) {
      const player = await ensurePlayer(name, !isVisitor);
      playerId = player.id;
    }
    const entry: Entry = {
      id: uid(),
      sessionId,
      playerId,
      label: name,
      games: input.games ?? 1,
      isVisitor,
      extra: 0,
      paid: false,
      order: await nextOrder(sessionId),
    };
    await db.entries.add(entry);
    return entry.id;
  });
}

export async function updateEntry(id: string, patch: Partial<Omit<Entry, 'id' | 'sessionId'>>): Promise<void> {
  await db.entries.update(id, patch);
}

export async function setEntryPaid(id: string, paid: boolean): Promise<void> {
  await db.entries.update(id, paid ? { paid: true, paidAt: Date.now() } : { paid: false, paidAt: undefined });
}

export async function setAllPaid(sessionId: string, paid: boolean): Promise<void> {
  await db.entries
    .where('sessionId')
    .equals(sessionId)
    .modify(paid ? { paid: true, paidAt: Date.now() } : { paid: false, paidAt: undefined });
}

export async function removeEntry(id: string): Promise<void> {
  await db.entries.delete(id);
}

export async function moveEntry(id: string, direction: -1 | 1): Promise<void> {
  const entry = await db.entries.get(id);
  if (!entry) return;
  const siblings = await db.entries.where('sessionId').equals(entry.sessionId).sortBy('order');
  const idx = siblings.findIndex((e) => e.id === id);
  const swapWith = siblings[idx + direction];
  if (!swapWith) return;
  await db.transaction('rw', db.entries, async () => {
    // Normalise orders to 0..n-1 while we are at it.
    const reordered = [...siblings];
    [reordered[idx], reordered[idx + direction]] = [reordered[idx + direction], reordered[idx]];
    await Promise.all(reordered.map((e, i) => db.entries.update(e.id, { order: i })));
  });
}

/** Adds every active regular from the roster who is not yet on this bill. */
export async function addRegulars(sessionId: string): Promise<number> {
  const [players, existing] = await Promise.all([
    db.players.toArray(),
    db.entries.where('sessionId').equals(sessionId).toArray(),
  ]);
  const present = new Set(existing.map((e) => e.playerId).filter(Boolean));
  const toAdd = players
    .filter((p) => p.active && p.isRegular && !present.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const p of toAdd) await addEntry(sessionId, { name: p.name, playerId: p.id, isVisitor: false });
  return toAdd.length;
}

/** Copies the people (not the games or payments) from another session into this one. */
export async function addPeopleFromSession(sessionId: string, sourceSessionId: string): Promise<number> {
  const [source, existing] = await Promise.all([
    db.entries.where('sessionId').equals(sourceSessionId).sortBy('order'),
    db.entries.where('sessionId').equals(sessionId).toArray(),
  ]);
  const seen = new Set(existing.map((e) => `${e.playerId ?? ''}|${norm(e.label)}|${e.isVisitor}`));
  let added = 0;
  for (const e of source) {
    const key = `${e.playerId ?? ''}|${norm(e.label)}|${e.isVisitor}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await addEntry(sessionId, { name: e.label, playerId: e.playerId, noPlayer: !e.playerId, isVisitor: e.isVisitor });
    added++;
  }
  return added;
}

// ---------- backup / restore ----------

export async function exportBackup(): Promise<BackupFile> {
  const [settings, players, sessions, entries] = await Promise.all([
    getSettings(),
    db.players.toArray(),
    db.sessions.toArray(),
    db.entries.toArray(),
  ]);
  return { app: 'court-bills', version: 1, exportedAt: new Date().toISOString(), settings, players, sessions, entries };
}

export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const b = data as Partial<BackupFile>;
  if (!b || b.app !== 'court-bills' || !Array.isArray(b.players) || !Array.isArray(b.sessions) || !Array.isArray(b.entries)) {
    throw new Error('That file is not a Court Bills backup.');
  }
  return b as BackupFile;
}

export async function importBackup(backup: BackupFile, mode: 'replace' | 'merge'): Promise<void> {
  await db.transaction('rw', db.players, db.sessions, db.entries, db.settings, async () => {
    if (mode === 'replace') {
      await Promise.all([db.players.clear(), db.sessions.clear(), db.entries.clear(), db.settings.clear()]);
    }
    await db.players.bulkPut(backup.players);
    await db.sessions.bulkPut(backup.sessions.map((s) => ({ ...s, otherCosts: s.otherCosts ?? [] })));
    await db.entries.bulkPut(backup.entries);
    if (backup.settings) await db.settings.put({ ...DEFAULT_SETTINGS, ...backup.settings, key: 'app' });
  });
}

export async function clearAll(): Promise<void> {
  await db.transaction('rw', db.players, db.sessions, db.entries, db.settings, async () => {
    await Promise.all([db.players.clear(), db.sessions.clear(), db.entries.clear(), db.settings.clear()]);
  });
}

// ---------- sample data ----------

/** Loads the Malindang 9/2/2026 bill so the app has something real to look at. */
export async function seedSample(): Promise<string> {
  const id = await createSession({ ...SAMPLE_SESSION });
  for (const line of SAMPLE_LINES) {
    const host = line.player ? await ensurePlayer(line.player, true) : undefined;
    const entryId = await addEntry(id, {
      name: line.label,
      isVisitor: line.isVisitor,
      games: line.games,
      playerId: host?.id,
    });
    if (line.paid) await setEntryPaid(entryId, true);
  }
  return id;
}
