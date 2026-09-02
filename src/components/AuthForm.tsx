import { useState, type FormEvent } from 'react';
import { cx } from '../lib/cx';
import { sync, useSync } from '../sync/engine';
import { isGoogleEnabled } from '../sync/supabase';

export type AuthMode = 'signin' | 'signup' | 'forgot';

const friendly = (message: string): string => {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'That email and password do not match an account.';
  if (m.includes('user already registered')) return 'That email already has an account. Sign in instead.';
  if (m.includes('password should be')) return 'Use a password of at least 6 characters.';
  if (m.includes('email not confirmed')) return 'Confirm your email address first, then sign in.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Cannot reach the server. Check your connection.';
  if (m.includes('unsupported provider') || m.includes('provider is not enabled')) return 'Google sign-in is not switched on for this app yet.';
  return message;
};

/** Email/password + Google form. Shared by the full-screen login and the Settings card. */
export function AuthForm({ onSignedIn, compact }: { onSignedIn?: () => void; compact?: boolean }) {
  const engine = useSync();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError(friendly(err instanceof Error ? err.message : 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (mode === 'forgot') {
        await sync.sendPasswordReset(email.trim());
        setNotice('If that email has an account, a reset link is on its way. Open it on this device.');
        return;
      }
      if (mode === 'signin') {
        await sync.signIn(email.trim(), password);
      } else {
        const needsConfirm = await sync.signUp(email.trim(), password);
        if (needsConfirm) {
          setNotice('Account created. Open the confirmation link in your email, then sign in.');
          setMode('signin');
          return;
        }
      }
      onSignedIn?.();
    });
  };

  const title = mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link';

  return (
    <form onSubmit={submit} className={cx('grid gap-3', !compact && 'text-left')}>
      <label className="block">
        <span className="label">Email</span>
        <input
          className="input"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </label>

      {mode !== 'forgot' && (
        <label className="block">
          <span className="label">Password</span>
          <input
            className="input"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? 'At least 6 characters' : ''}
          />
        </label>
      )}

      {!error && engine.status === 'signed-out' && engine.error && (
        <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">{engine.error}</p>
      )}
      {error && <p className="text-sm text-bad">{error}</p>}
      {notice && <p className="text-sm text-ok">{notice}</p>}

      <button className="btn btn-primary w-full" type="submit" disabled={busy}>
        {busy ? 'Please wait…' : title}
      </button>

      {isGoogleEnabled && mode !== 'forgot' && (
        <>
          <div className="flex items-center gap-3 py-0.5 text-xs text-muted">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <button type="button" className="btn w-full" disabled={busy} onClick={() => void run(() => sync.signInWithGoogle())}>
            <svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
            </svg>
            Continue with Google
          </button>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-0.5 text-sm">
        <button
          type="button"
          className="text-muted underline-offset-2 hover:text-ink hover:underline"
          onClick={() => {
            setError(null);
            setNotice(null);
            setMode(mode === 'signup' ? 'signin' : 'signup');
          }}
        >
          {mode === 'signup' ? 'Have an account? Sign in' : 'New here? Create an account'}
        </button>
        <button
          type="button"
          className="text-muted underline-offset-2 hover:text-ink hover:underline"
          onClick={() => {
            setError(null);
            setNotice(null);
            setMode(mode === 'forgot' ? 'signin' : 'forgot');
          }}
        >
          {mode === 'forgot' ? 'Back to sign in' : 'Forgot password?'}
        </button>
      </div>
    </form>
  );
}
