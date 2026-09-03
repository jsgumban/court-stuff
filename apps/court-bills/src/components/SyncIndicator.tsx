import { Link } from 'react-router';
import { cx } from '../lib/cx';
import { useSync } from '../sync/engine';

/** Small cloud icon in the header: tap to open the sync settings. Hidden when sync is not configured. */
export function SyncIndicator() {
  const s = useSync();
  if (s.status === 'disabled') return null;

  let color = 'text-ok';
  let label = 'Synced';
  if (s.status === 'signed-out') {
    color = 'text-muted';
    label = 'Not signed in. Tap to sync across devices.';
  } else if (s.status === 'syncing') {
    color = 'text-muted';
    label = 'Syncing…';
  } else if (s.status === 'error') {
    color = 'text-bad';
    label = `Sync problem: ${s.error ?? 'unknown'}`;
  } else if (s.status === 'offline') {
    color = 'text-warn';
    label = s.pending ? `Offline, ${s.pending} changes waiting` : 'Offline';
  } else if (s.pending > 0) {
    color = 'text-warn';
    label = `${s.pending} changes waiting to upload`;
  }

  return (
    <Link to="/settings" aria-label={label} title={label} className={cx('relative grid h-10 w-10 place-items-center rounded-lg hover:bg-surface-2', color)}>
      <svg
        viewBox="0 0 24 24"
        className={cx('h-5 w-5', s.status === 'syncing' && 'animate-pulse')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 18a4.5 4.5 0 0 1-.7-8.95A6 6 0 0 1 17.7 8.2 4 4 0 0 1 17 16" />
        <path d="M7 18h10" />
        {s.status === 'signed-out' && <path d="M4 4l16 16" />}
        {s.status !== 'signed-out' && s.status !== 'syncing' && s.status !== 'error' && s.pending === 0 && <path d="M9 13l2 2 4-4" />}
        {s.status === 'error' && <path d="M12 10v3M12 16h.01" />}
      </svg>
      {s.pending > 0 && s.status !== 'syncing' && (
        <span className="num absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-warn px-1 text-center text-[10px] font-semibold leading-4 text-white">
          {s.pending > 99 ? '99+' : s.pending}
        </span>
      )}
    </Link>
  );
}
