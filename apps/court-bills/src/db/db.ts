import Dexie, { type Table } from 'dexie';
import type { Entry, Player, Session, Settings, Snapshot, SyncStateRow, Tombstone } from '../lib/types';

/**
 * Local database (IndexedDB via Dexie). The UI always reads and writes here, so the app
 * works offline. When cloud sync is configured and the user is signed in, `src/sync`
 * uploads rows flagged `dirty` (and `tombstones` for deletions) and pulls remote changes.
 */
export class CourtBillsDB extends Dexie {
  players!: Table<Player, string>;
  sessions!: Table<Session, string>;
  entries!: Table<Entry, string>;
  settings!: Table<Settings, string>;
  tombstones!: Table<Tombstone, [string, string]>;
  syncState!: Table<SyncStateRow, string>;
  snapshots!: Table<Snapshot, string>;

  constructor() {
    super('court-bills');
    // Booleans are not valid IndexedDB keys, so flags (paid, active, isVisitor) are filtered in memory.
    this.version(1).stores({
      players: 'id, name, createdAt',
      sessions: 'id, date, court, status, createdAt',
      entries: 'id, sessionId, playerId, [sessionId+order]',
      settings: 'key',
    });
    this.version(2)
      .stores({
        players: 'id, name, createdAt, dirty',
        sessions: 'id, date, court, status, createdAt, dirty',
        entries: 'id, sessionId, playerId, [sessionId+order], dirty',
        settings: 'key',
        tombstones: '[collection+id], collection',
        syncState: 'key',
      })
      .upgrade(async (tx) => {
        // Existing local data gets uploaded the first time the user signs in.
        const now = Date.now();
        await tx.table('players').toCollection().modify((p) => {
          p.updatedAt = p.updatedAt ?? p.createdAt ?? now;
          p.dirty = 1;
        });
        await tx.table('entries').toCollection().modify((e) => {
          e.updatedAt = e.updatedAt ?? now;
          e.dirty = 1;
        });
        await tx.table('sessions').toCollection().modify((s) => {
          s.updatedAt = s.updatedAt ?? now;
          s.dirty = 1;
        });
        await tx.table('settings').toCollection().modify((s) => {
          s.updatedAt = s.updatedAt ?? now;
          s.dirty = 1;
        });
      });
    // A safety copy is taken before anything wipes the device, so nothing is lost silently.
    this.version(3).stores({ snapshots: 'key, createdAt' });
    // Lights stopped being special: every cost is now an entry in `payables`.
    this.version(4)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table('sessions')
          .toCollection()
          .modify((s: Record<string, unknown>) => {
            if (s.payables) return;
            const list: Array<Record<string, unknown>> = [];
            if (typeof s.lightsCost === 'number') {
              list.push({ id: 'lights', label: 'Lights', amount: s.lightsCost, split: s.lightsSplit ?? 'perGame' });
            }
            for (const c of (s.otherCosts as Array<Record<string, unknown>>) ?? []) list.push(c);
            s.payables = list;
            delete s.lightsCost;
            delete s.lightsSplit;
            delete s.otherCosts;
            s.dirty = 1;
            s.updatedAt = Date.now();
          });
        await tx
          .table('settings')
          .toCollection()
          .modify((s: Record<string, unknown>) => {
            if (s.defaultPayables) return;
            s.defaultPayables =
              typeof s.defaultLightsCost === 'number'
                ? [{ id: 'lights', label: 'Lights', amount: s.defaultLightsCost, split: s.defaultLightsSplit ?? 'perGame' }]
                : [];
            delete s.defaultLightsCost;
            delete s.defaultLightsSplit;
            s.dirty = 1;
            s.updatedAt = Date.now();
          });
      });
  }
}

export const db = new CourtBillsDB();
