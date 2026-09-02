import type { RealtimeChannel, Session as AuthSession } from '@supabase/supabase-js';
import { liveQuery, type Table } from 'dexie';
import { useSyncExternalStore } from 'react';
import { db } from '../db/db';
import type { Collection } from '../lib/types';
import { decide, type LocalRow, type RemoteRow } from './merge';
import { supabase } from './supabase';

export type SyncStatus = 'disabled' | 'signed-out' | 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncSnapshot {
  status: SyncStatus;
  user: { id: string; email: string | null } | null;
  lastSyncAt: number | null;
  /** Local changes not yet uploaded. */
  pending: number;
  error: string | null;
}

const TABLE = 'sync_rows';
const PAGE = 500;
const EPOCH = '1970-01-01T00:00:00+00:00';

type AnyRow = LocalRow & Record<string, unknown>;

function tableFor(c: Collection): Table<AnyRow, string> {
  switch (c) {
    case 'players':
      return db.players as unknown as Table<AnyRow, string>;
    case 'sessions':
      return db.sessions as unknown as Table<AnyRow, string>;
    case 'entries':
      return db.entries as unknown as Table<AnyRow, string>;
    case 'settings':
      return db.settings as unknown as Table<AnyRow, string>;
  }
}

const keyOf = (c: Collection, row: AnyRow): string => String(c === 'settings' ? row.key : row.id);

export async function countPending(): Promise<number> {
  const [p, s, e, t, st] = await Promise.all([
    db.players.where('dirty').equals(1).count(),
    db.sessions.where('dirty').equals(1).count(),
    db.entries.where('dirty').equals(1).count(),
    db.tombstones.count(),
    db.settings.get('app'),
  ]);
  return p + s + e + t + (st?.dirty === 1 ? 1 : 0);
}

async function markAllDirty(): Promise<void> {
  await db.transaction('rw', db.players, db.sessions, db.entries, db.settings, async () => {
    await db.players.toCollection().modify({ dirty: 1 });
    await db.sessions.toCollection().modify({ dirty: 1 });
    await db.entries.toCollection().modify({ dirty: 1 });
    await db.settings.toCollection().modify({ dirty: 1 });
  });
}

/** Wipe this device completely (data + sync bookkeeping). */
export async function resetLocal(): Promise<void> {
  await db.transaction('rw', [db.players, db.sessions, db.entries, db.settings, db.tombstones, db.syncState], async () => {
    await Promise.all([
      db.players.clear(),
      db.sessions.clear(),
      db.entries.clear(),
      db.settings.clear(),
      db.tombstones.clear(),
      db.syncState.clear(),
    ]);
  });
}

async function applyRemote(rows: RemoteRow[]): Promise<void> {
  await db.transaction('rw', db.players, db.sessions, db.entries, db.settings, db.tombstones, async () => {
    for (const r of rows) {
      const table = tableFor(r.collection);
      const [local, tombstone] = await Promise.all([table.get(r.id), db.tombstones.get([r.collection, r.id])]);
      const d = decide(r, local, tombstone);
      if (d.clearTombstone && tombstone) await db.tombstones.delete([r.collection, r.id]);
      if (d.action === 'delete') {
        await table.delete(r.id);
      } else if (d.action === 'put') {
        const row: AnyRow = { ...r.data, dirty: 0 };
        if (r.collection === 'settings') row.key = 'app';
        else row.id = r.id;
        await table.put(row);
      }
    }
  });
}

class SyncEngine {
  private snap: SyncSnapshot = {
    status: supabase ? 'signed-out' : 'disabled',
    user: null,
    lastSyncAt: null,
    pending: 0,
    error: null,
  };
  private listeners = new Set<() => void>();
  private started = false;
  private channel: RealtimeChannel | null = null;
  private running: Promise<void> | null = null;
  private queued = false;
  private debounceTimer: number | undefined;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.snap;

  private set(patch: Partial<SyncSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }

  start() {
    if (this.started || !supabase) return;
    this.started = true;

    // Supabase warns against calling its API synchronously inside this callback.
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return;
      window.setTimeout(() => void this.onSession(session), 0);
    });

    window.addEventListener('online', () => this.requestSync());
    window.addEventListener('offline', () => this.snap.user && this.set({ status: 'offline' }));
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && this.requestSync());
    window.setInterval(() => this.requestSync(), 120_000);

    liveQuery(countPending).subscribe({
      next: (n) => {
        this.set({ pending: n });
        if (n > 0) this.requestSync(400);
      },
      error: () => {},
    });
    void db.syncState.get('state').then((s) => s?.lastSyncAt && this.set({ lastSyncAt: s.lastSyncAt }));
  }

  private async onSession(session: AuthSession | null) {
    const user = session?.user ?? null;
    if (!user) {
      this.teardownRealtime();
      this.set({ status: 'signed-out', user: null, error: null });
      return;
    }
    const same = this.snap.user?.id === user.id;
    this.set({ user: { id: user.id, email: user.email ?? null } });
    if (!same) {
      const state = await db.syncState.get('state');
      if (state?.userId && state.userId !== user.id) {
        await resetLocal(); // another account was used on this device
      } else if (!state?.userId) {
        await markAllDirty(); // first sign-in here: upload whatever this device already has
      }
      const fresh = (await db.syncState.get('state')) ?? { key: 'state' as const };
      await db.syncState.put({ ...fresh, userId: user.id });
      this.setupRealtime(user.id);
    }
    this.requestSync();
  }

  /** Run a push+pull soon; coalesces bursts of local edits. */
  requestSync(delayMs = 0): void {
    if (!this.snap.user) return;
    window.clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => void this.syncNow(), delayMs);
  }

  syncNow(): Promise<void> {
    if (this.running) {
      this.queued = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.queued = false;
        await this.runOnce();
      } while (this.queued);
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async runOnce() {
    if (!supabase || !this.snap.user) return;
    if (!navigator.onLine) {
      this.set({ status: 'offline' });
      return;
    }
    this.set({ status: 'syncing', error: null });
    try {
      await this.push();
      await this.pull();
      const now = Date.now();
      await db.syncState.update('state', { lastSyncAt: now });
      this.set({ status: 'idle', lastSyncAt: now });
    } catch (e) {
      this.set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  }

  private async push() {
    if (!supabase || !this.snap.user) return;
    const uid = this.snap.user.id;
    const [players, sessions, entries, settings, tombs] = await Promise.all([
      db.players.where('dirty').equals(1).toArray(),
      db.sessions.where('dirty').equals(1).toArray(),
      db.entries.where('dirty').equals(1).toArray(),
      db.settings.get('app'),
      db.tombstones.toArray(),
    ]);

    const upserts: Array<{ collection: Collection; id: string; user_id: string; data: AnyRow; updated_at: number; deleted_at: number | null }> = [];
    const pushed: Array<{ collection: Collection; id: string; updatedAt: number }> = [];
    const add = (collection: Collection, rows: AnyRow[]) => {
      for (const r of rows) {
        const { dirty: _dirty, ...data } = r;
        const id = keyOf(collection, r);
        const updatedAt = r.updatedAt ?? 0;
        upserts.push({ collection, id, user_id: uid, data, updated_at: updatedAt, deleted_at: null });
        pushed.push({ collection, id, updatedAt });
      }
    };
    add('players', players as unknown as AnyRow[]);
    add('sessions', sessions as unknown as AnyRow[]);
    add('entries', entries as unknown as AnyRow[]);
    if (settings?.dirty === 1) add('settings', [settings as unknown as AnyRow]);
    for (const t of tombs) {
      upserts.push({ collection: t.collection, id: t.id, user_id: uid, data: {}, updated_at: t.deletedAt, deleted_at: t.deletedAt });
    }
    if (upserts.length === 0) return;

    for (let i = 0; i < upserts.length; i += 200) {
      const { error } = await supabase.from(TABLE).upsert(upserts.slice(i, i + 200), { onConflict: 'user_id,collection,id' });
      if (error) throw new Error(error.message);
    }

    // Clear flags only for rows that did not change again while we were uploading.
    await db.transaction('rw', db.players, db.sessions, db.entries, db.settings, db.tombstones, async () => {
      for (const p of pushed) {
        const table = tableFor(p.collection);
        const cur = await table.get(p.id);
        if (cur && cur.dirty === 1 && cur.updatedAt === p.updatedAt) await table.update(p.id, { dirty: 0 });
      }
      await db.tombstones.bulkDelete(tombs.map((t) => [t.collection, t.id] as [string, string]));
    });
  }

  private async pull() {
    if (!supabase) return;
    const state = await db.syncState.get('state');
    let cursor = state?.cursor ?? EPOCH;
    for (;;) {
      const { data, error } = await supabase
        .from(TABLE)
        .select('collection,id,data,updated_at,deleted_at,synced_at')
        .gt('synced_at', cursor)
        .order('synced_at', { ascending: true })
        .limit(PAGE);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as RemoteRow[];
      if (rows.length === 0) break;
      const full = rows.length === PAGE;
      if (full) {
        // Rows written in one statement share a synced_at; never split such a group across pages.
        const last = rows[rows.length - 1].synced_at;
        const firstOfLast = rows.findIndex((r) => r.synced_at === last);
        if (firstOfLast > 0) rows.splice(firstOfLast);
      }
      await applyRemote(rows);
      cursor = rows[rows.length - 1].synced_at;
      await db.syncState.update('state', { cursor });
      if (!full) break;
    }
  }

  private setupRealtime(uid: string) {
    if (!supabase) return;
    this.teardownRealtime();
    this.channel = supabase
      .channel(`sync:${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${uid}` }, () => this.requestSync(300))
      .subscribe();
  }

  private teardownRealtime() {
    if (this.channel && supabase) void supabase.removeChannel(this.channel);
    this.channel = null;
  }

  // ---- auth ----

  async signIn(email: string, password: string): Promise<void> {
    if (!supabase) throw new Error('Sync is not configured');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }

  /** Returns true when Supabase wants the email confirmed before the first sign-in. */
  async signUp(email: string, password: string): Promise<boolean> {
    if (!supabase) throw new Error('Sync is not configured');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    return !data.session;
  }

  async signOut(clearDevice: boolean): Promise<void> {
    if (!supabase) return;
    this.teardownRealtime();
    const { error } = await supabase.auth.signOut();
    if (error && error.name !== 'AuthSessionMissingError') throw new Error(error.message);
    if (clearDevice) await resetLocal();
  }
}

export const sync = new SyncEngine();

export function useSync(): SyncSnapshot {
  return useSyncExternalStore(sync.subscribe, sync.getSnapshot, sync.getSnapshot);
}

