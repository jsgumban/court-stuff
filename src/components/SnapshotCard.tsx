import { useEffect, useState } from 'react';
import { discardSnapshot, getSnapshot, restoreSnapshot } from '../db/repo';
import { timeAgo } from '../lib/format';
import type { Snapshot } from '../lib/types';
import { ConfirmButton } from './ConfirmButton';
import { useToast } from './Toast';

/** Shown only when a safety copy was taken before this device was cleared. */
export function SnapshotCard() {
  const toast = useToast();
  const [snap, setSnap] = useState<Snapshot | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getSnapshot().then((s) => setSnap(s ?? null));
  }, []);

  if (!snap) return null;
  const { sessions, players } = snap.backup;

  return (
    <section className="card border-warn/40 p-4">
      <h2 className="font-semibold text-warn">Earlier data is still on this device</h2>
      <p className="mt-1 text-sm text-muted">
        {snap.reason}, so a copy was kept first: {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} and {players.length}{' '}
        {players.length === 1 ? 'player' : 'players'}, saved {timeAgo(snap.createdAt)}. Restoring adds it to the account you are signed into now.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await restoreSnapshot();
              setSnap(null);
              toast.show('Earlier data restored and queued for upload');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Restoring…' : 'Restore it'}
        </button>
        <ConfirmButton
          confirmLabel="Tap again to discard"
          disabled={busy}
          onConfirm={async () => {
            await discardSnapshot();
            setSnap(null);
            toast.show('Earlier data discarded');
          }}
        >
          Discard
        </ConfirmButton>
      </div>
    </section>
  );
}
