import { Link, useNavigate } from 'react-router';
import { EmptyState, Loading } from '../components/EmptyState';
import { Money } from '../components/Money';
import { Stat } from '../components/Stat';
import { useToast } from '../components/Toast';
import { seedSample } from '../db/repo';
import { useSessionSummaries, useSettings } from '../hooks/useData';
import { formatMoney, formatMonth, pluralGames, todayISO } from '../lib/format';
import type { SessionSummary } from '../lib/stats';
import { useSync } from '../sync/engine';

export default function SessionsPage() {
  const summaries = useSessionSummaries();
  const settings = useSettings();
  const navigate = useNavigate();
  const toast = useToast();
  const syncState = useSync();

  if (!summaries || !settings) return <Loading />;
  const c = settings.currency;

  const onNew = () => navigate('/new');
  const onSample = async () => {
    const id = await seedSample();
    toast.show('Malindang sample loaded');
    navigate(`/session/${id}`);
  };

  if (summaries.length === 0) {
    return (
      <>
        <PageHeader onNew={onNew} />
        <EmptyState
          icon="🏸"
          title="No sessions yet"
          body={
            syncState.status === 'syncing'
              ? 'Pulling your sessions from the cloud…'
              : 'Start a session for tonight, or load the Malindang 9/2/2026 bill to see how the app splits lights per game.'
          }
          actions={
            <>
              <button className="btn btn-primary" onClick={onNew}>
                New session
              </button>
              <button className="btn" onClick={onSample}>
                Load sample bill
              </button>
            </>
          }
        />
      </>
    );
  }

  const month = todayISO().slice(0, 7);
  const thisMonth = summaries.filter((s) => s.session.date.startsWith(month));
  const unpaidTotal = summaries.reduce((s, x) => s + x.outstanding, 0);
  const openWithDebt = summaries.filter((x) => x.outstanding > 0).length;
  const collectedThisMonth = thisMonth.reduce((s, x) => s + x.collected, 0);

  const groups: { label: string; items: SessionSummary[] }[] = [];
  for (const s of summaries) {
    const label = formatMonth(s.session.date);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(s);
    else groups.push({ label, items: [s] });
  }

  return (
    <>
      <PageHeader onNew={onNew} />
      <div className="mb-5 grid grid-cols-3 gap-2">
        <Stat label="Still unpaid" value={formatMoney(unpaidTotal, c)} tone={unpaidTotal > 0 ? 'bad' : 'ok'} />
        <Stat label="Sessions with debt" value={openWithDebt} tone={openWithDebt > 0 ? 'warn' : undefined} />
        <Stat label="Collected this month" value={formatMoney(collectedThisMonth, c)} tone="ok" />
      </div>

      {groups.map((g) => (
        <section key={g.label} className="mb-6">
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">{g.label}</h2>
          <ul className="space-y-2">
            {g.items.map((s) => (
              <li key={s.session.id}>
                <SessionCard s={s} currency={c} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function PageHeader({ onNew }: { onNew: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
      <button className="btn btn-primary" onClick={onNew}>
        <span className="text-base leading-none">＋</span> New session
      </button>
    </div>
  );
}

function SessionCard({ s, currency }: { s: SessionSummary; currency: string }) {
  const d = new Date(s.session.date + 'T00:00:00');
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  return (
    <Link to={`/session/${s.session.id}`} className="card flex items-center gap-3 p-3 transition hover:border-ink/30">
      <div className="w-12 shrink-0 rounded-xl bg-surface-2 py-1.5 text-center">
        <div className="text-[10px] font-medium uppercase text-muted">{weekday}</div>
        <div className="num text-lg font-semibold leading-tight">{d.getDate()}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{s.session.court || 'Untitled court'}</span>
          {s.session.status === 'closed' && <span className="pill bg-surface-2 text-muted">closed</span>}
        </div>
        <div className="num mt-0.5 text-xs text-muted">
          {s.headcount} {s.headcount === 1 ? 'person' : 'people'} · {pluralGames(s.totalGames)} · lights {formatMoney(s.session.lightsCost, currency)}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <Money value={s.billed} currency={currency} className="font-semibold" />
        <div className="text-xs">
          {s.outstanding > 0 ? (
            <span className="num text-bad">{formatMoney(s.outstanding, currency)} unpaid</span>
          ) : s.headcount > 0 ? (
            <span className="text-ok">Settled</span>
          ) : (
            <span className="text-muted">No people yet</span>
          )}
        </div>
      </div>
    </Link>
  );
}
