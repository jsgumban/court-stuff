import type { Collection, Tombstone } from '../lib/types';

/** One row of the `sync_rows` table as returned by Supabase. */
export interface RemoteRow {
  collection: Collection;
  id: string;
  data: Record<string, unknown>;
  updated_at: number;
  deleted_at: number | null;
  synced_at: string;
}

export interface LocalRow {
  updatedAt?: number;
  dirty?: number;
}

export interface MergeDecision {
  action: 'put' | 'delete' | 'skip';
  /** Drop our local tombstone for this row (the cloud already knows, or a newer remote edit revived the row). */
  clearTombstone: boolean;
}

/**
 * Last-write-wins between a remote row and what this device has.
 * Timestamps are client clocks in ms; a local deletion counts as a write at `deletedAt`.
 */
export function decide(remote: RemoteRow, local: LocalRow | undefined, tombstone: Tombstone | undefined): MergeDecision {
  if (remote.deleted_at != null) {
    const localIsNewerEdit = !!local && local.dirty === 1 && (local.updatedAt ?? 0) > remote.deleted_at;
    return { action: localIsNewerEdit ? 'skip' : local ? 'delete' : 'skip', clearTombstone: true };
  }
  if (tombstone) {
    if (tombstone.deletedAt >= remote.updated_at) return { action: 'skip', clearTombstone: false };
    return { action: 'put', clearTombstone: true };
  }
  if (!local || (local.updatedAt ?? 0) < remote.updated_at) return { action: 'put', clearTombstone: false };
  return { action: 'skip', clearTombstone: false };
}
