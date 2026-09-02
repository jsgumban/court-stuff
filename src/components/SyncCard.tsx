import { useEffect, useState, type FormEvent } from 'react';
import { cx } from '../lib/cx';
import { timeAgo } from '../lib/format';
import { sync, useSync } from '../sync/engine';
import { AuthForm } from './AuthForm';
import { ConfirmButton } from './ConfirmButton';
import { useToast } from './Toast';

export function SyncCard() {
  const s = useSync();
  const toast = useToast();
  const [, tick] = useState(0);
  const [changing, setChanging] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-render every 30s so "synced 3 min ago" stays honest.
  useEffect(() => {
    const t = window.setInterval(() => tick((x) => x + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  if (s.status === 'disabled') {
    return (
      <section className="card p-4">
        <h2 className="font-semibold">Cloud sync</h2>
        <p className="mt-1 text-sm text-muted">
          This build has no Supabase credentials, so data stays on this device. Add <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> to the environment and redeploy to enable sign-in and multi-device sync.
        </p>
      </section>
    );
  }

  if (!s.user) {
    // Behind the login gate this is only reachable in a local-only build, but keep it working.
    return (
      <section className="card p-4">
        <h2 className="font-semibold">Cloud sync</h2>
        <p className="mt-1 text-sm text-muted">Sign in to keep your sessions in the cloud and open them from any device.</p>
        <div className="mt-3 max-w-sm">
          <AuthForm onSignedIn={() => toast.show('Signed in. Syncing…')} compact />
        </div>
      </section>
    );
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sync.updatePassword(newPassword);
      toast.show('Password updated');
      setChanging(false);
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the password');
    } finally {
      setBusy(false);
    }
  };

  const changes = `${s.pending} ${s.pending === 1 ? 'change' : 'changes'}`;
  let statusText: string;
  let tone = 'text-ok';
  if (s.status === 'syncing') {
    statusText = 'Syncing…';
    tone = 'text-muted';
  } else if (s.status === 'offline') {
    statusText = s.pending ? `Offline. ${changes} will upload when you are back online.` : 'Offline. Changes will upload when you are back online.';
    tone = 'text-warn';
  } else if (s.status === 'error') {
    statusText = `Sync problem: ${s.error ?? 'unknown error'}`;
    tone = 'text-bad';
  } else if (s.pending > 0) {
    statusText = `${changes} waiting to upload.`;
    tone = 'text-warn';
  } else {
    statusText = s.lastSyncAt ? `Up to date. Synced ${timeAgo(s.lastSyncAt)}.` : 'Connected.';
  }

  return (
    <section className="card p-4">
      <h2 className="font-semibold">Cloud sync</h2>
      <p className="text-sm text-muted">
        Signed in as <span className="text-ink">{s.user.email ?? s.user.id}</span>
      </p>
      <p className={cx('mt-2 text-sm', tone)}>{statusText}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn" onClick={() => void sync.syncNow()} disabled={s.status === 'syncing'}>
          Sync now
        </button>
        <button
          className="btn"
          onClick={async () => {
            await sync.signOut(false);
            toast.show('Signed out. Data stays on this device.');
          }}
        >
          Sign out
        </button>
        <ConfirmButton
          className="sm:ml-auto"
          confirmLabel="Tap again to clear this device"
          onConfirm={async () => {
            await sync.signOut(true);
            toast.show('Signed out and cleared this device.');
          }}
        >
          Sign out &amp; clear this device
        </ConfirmButton>
      </div>
      {s.pending > 0 && <p className="mt-2 text-xs text-warn">Clearing now would lose {changes} that have not been uploaded yet.</p>}

      <div className="mt-4 border-t border-line pt-3">
        {!changing ? (
          <button className="btn btn-ghost btn-sm -ml-2" onClick={() => setChanging(true)}>
            Change password
          </button>
        ) : (
          <form onSubmit={changePassword} className="grid max-w-sm gap-3">
            <label className="block">
              <span className="label">New password</span>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </label>
            {error && <p className="text-sm text-bad">{error}</p>}
            <div className="flex gap-2">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save password'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setChanging(false);
                  setNewPassword('');
                  setError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
