import { describe, expect, it } from 'vitest';
import { decide, type RemoteRow } from './merge';

const remote = (over: Partial<RemoteRow> = {}): RemoteRow => ({
  collection: 'entries',
  id: 'e1',
  data: { id: 'e1', games: 2, updatedAt: 1000 },
  updated_at: 1000,
  deleted_at: null,
  synced_at: '2026-09-02T00:00:00Z',
  ...over,
});

describe('decide (last-write-wins merge)', () => {
  it('takes a remote row this device has never seen', () => {
    expect(decide(remote(), undefined, undefined)).toEqual({ action: 'put', clearTombstone: false });
  });

  it('takes a newer remote edit over an older local copy, dirty or not', () => {
    expect(decide(remote(), { updatedAt: 500, dirty: 0 }, undefined).action).toBe('put');
    expect(decide(remote(), { updatedAt: 500, dirty: 1 }, undefined).action).toBe('put');
  });

  it('keeps a local copy that is as new or newer', () => {
    expect(decide(remote(), { updatedAt: 1000, dirty: 0 }, undefined).action).toBe('skip');
    expect(decide(remote(), { updatedAt: 1500, dirty: 1 }, undefined).action).toBe('skip');
  });

  it('applies a remote deletion unless we edited after it', () => {
    const deleted = remote({ deleted_at: 2000, updated_at: 2000, data: {} });
    expect(decide(deleted, { updatedAt: 1000, dirty: 0 }, undefined)).toEqual({ action: 'delete', clearTombstone: true });
    expect(decide(deleted, { updatedAt: 3000, dirty: 1 }, undefined)).toEqual({ action: 'skip', clearTombstone: true });
    expect(decide(deleted, undefined, undefined)).toEqual({ action: 'skip', clearTombstone: true });
  });

  it('lets our pending deletion win over an older remote edit, but not over a newer one', () => {
    const tomb = { collection: 'entries' as const, id: 'e1', deletedAt: 1500 };
    expect(decide(remote({ updated_at: 1000 }), undefined, tomb)).toEqual({ action: 'skip', clearTombstone: false });
    expect(decide(remote({ updated_at: 2000 }), undefined, tomb)).toEqual({ action: 'put', clearTombstone: true });
  });
});
