import { useState, type FormEvent, type ReactNode } from 'react';
import { sync, useSync } from '../sync/engine';
import { AuthForm } from './AuthForm';
import { useToast } from './Toast';

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-ink text-gold dark:bg-gold dark:text-ink">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.4 1 2.5h6c0-1.1.3-1.9 1-2.5A6 6 0 0 0 12 3z" />
            </svg>
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        <div className="card p-5">{children}</div>
      </div>
    </div>
  );
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-3 text-muted">
        <span className="grid h-14 w-14 animate-pulse place-items-center rounded-2xl bg-ink text-gold dark:bg-gold dark:text-ink">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.4 1 2.5h6c0-1.1.3-1.9 1-2.5A6 6 0 0 0 12 3z" />
          </svg>
        </span>
        <span className="text-sm">Court Bills</span>
      </div>
    </div>
  );
}

function NewPassword() {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sync.updatePassword(password);
      toast.show('Password updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Set a new password" subtitle="Choose the password you will use from now on.">
      <form onSubmit={submit} className="grid gap-3">
        <label className="block">
          <span className="label">New password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </label>
        {error && <p className="text-sm text-bad">{error}</p>}
        <button className="btn btn-primary w-full" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save password'}
        </button>
        <button type="button" className="btn btn-ghost w-full" onClick={() => void sync.signOut(false)}>
          Cancel and sign out
        </button>
      </form>
    </Shell>
  );
}

/** Signing in is required. Renders the app only once there is a session. */
export function AuthGate({ children }: { children: ReactNode }) {
  const s = useSync();

  if (s.status === 'disabled') return <>{children}</>; // build without cloud credentials: local-only
  if (s.recovery) return <NewPassword />;
  if (s.status === 'loading') return <Splash />;
  if (!s.user) {
    return (
      <Shell title="Court Bills" subtitle="Sign in to reach your sessions from any device.">
        <AuthForm />
      </Shell>
    );
  }
  return <>{children}</>;
}
