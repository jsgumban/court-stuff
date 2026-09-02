import { useEffect, useState } from 'react';
import { copyText, canShare, shareText } from '../lib/browser';
import { cx } from '../lib/cx';
import { createShare, getShareToken, revokeShare, shareUrl } from '../sync/share';
import { isSyncConfigured } from '../sync/supabase';
import { ConfirmButton } from './ConfirmButton';
import { useToast } from './Toast';

/** Creates and manages the public, view-only link for one session. */
export function ShareCard({ sessionId, title }: { sessionId: string; title: string }) {
  const toast = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getShareToken(sessionId)
      .then((t) => alive && setToken(t))
      .catch(() => alive && setToken(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [sessionId]);

  if (!isSyncConfigured) return null;

  const url = token ? shareUrl(token) : '';

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const t = await createShare(sessionId);
      setToken(t);
      const ok = await copyText(shareUrl(t));
      toast.show(ok ? 'Link created and copied' : 'Link created');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the link');
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      await revokeShare(sessionId);
      setToken(null);
      toast.show('Link turned off. It no longer opens.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not stop sharing');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Share link</h2>
          <p className="text-xs text-muted">
            Anyone with the link can see this bill without an account. They cannot change anything.
          </p>
        </div>
        <span className={cx('pill shrink-0', token ? 'bg-ok-soft text-ok' : 'bg-surface-2 text-muted')}>{token ? 'Sharing' : 'Off'}</span>
      </div>

      {error && <p className="mt-2 text-sm text-bad">{error}</p>}

      {loading ? (
        <p className="mt-3 text-sm text-muted">Checking…</p>
      ) : !token ? (
        <button className="btn btn-primary mt-3" onClick={create} disabled={busy}>
          {busy ? 'Creating…' : 'Create share link'}
        </button>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2">
            <span className="num flex-1 truncate text-xs text-muted" title={url}>
              {url}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn btn-sm" onClick={async () => toast.show((await copyText(url)) ? 'Link copied' : 'Could not copy', 'ok')}>
              Copy link
            </button>
            {canShare() && (
              <button className="btn btn-sm" onClick={() => void shareText(title, url)}>
                Share
              </button>
            )}
            <a className="btn btn-sm" href={url} target="_blank" rel="noreferrer">
              Preview
            </a>
            <ConfirmButton className="btn-sm ml-auto" confirmLabel="Tap again to turn off" onConfirm={stop} disabled={busy}>
              Stop sharing
            </ConfirmButton>
          </div>
        </>
      )}
    </section>
  );
}
