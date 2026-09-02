import Dexie, { type Table } from 'dexie';
import type { Entry, Player, Session, Settings } from '../lib/types';

/**
 * Local-only database (IndexedDB via Dexie). Everything the app knows lives here,
 * in the browser profile of this device. Use Settings → Backup to move it elsewhere.
 *
 * Swapping to a remote backend later means re-implementing `repo.ts`; the UI only talks to that.
 */
export class CourtBillsDB extends Dexie {
  players!: Table<Player, string>;
  sessions!: Table<Session, string>;
  entries!: Table<Entry, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('court-bills');
    // Booleans are not valid IndexedDB keys, so flags (paid, active, isVisitor) are filtered in memory.
    this.version(1).stores({
      players: 'id, name, createdAt',
      sessions: 'id, date, court, status, createdAt',
      entries: 'id, sessionId, playerId, [sessionId+order]',
      settings: 'key',
    });
  }
}

export const db = new CourtBillsDB();
