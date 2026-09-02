import { useEffect, useState, type FormEvent } from 'react';
import { cx } from '../lib/cx';
import { timeAgo } from '../lib/format';
import { sync, useSync } from '../sync/engine';
import { ConfirmButton } from './ConfirmButton';
import { Field } from './Fields';
import { useToast } from './Toast';

export function SyncCard() {
  const s = useSync();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [, tick] = useState(0);

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
    const submit = async (e: FormEvent) => {
      e.preventDefault();
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        if (mode === 'signin') {
          await sync.signIn(email.trim(), password);
          toast.show('Signed in. Syncing…');
        } else {
          const needsConfirm = await sync.signUp(email.trim(), password);
          if (needsConfirm) setNotice('Account created. Check your email for the confirmation link, then sign in here.');
          else toast.show('Account created. Syncing…');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setBusy(false);
      }
    };
    return (
      <section className="card p-4">
        <h2 className="font-semibold">Cloud sync</h2>
        <p className="mt-1 text-sm text-muted">
          Sign in to keep your sessions in the cloud and open them from any device. Whatever is already on this device is uploaded on first sign-in.
        </p>
        <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Email">
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <input
              className="input"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <p className="text-sm text-bad sm:col-span-2">{error}</p>}
          {notice && <p className="text-sm text-ok sm:col-span-2">{notice}</p>}
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode((m) => (m === 'signin' ? 'signup' : 'signin'))}>
              {mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
            </button>
          </div>
        </form>
      </section>
    );
  }

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
    </section>
  );
}
