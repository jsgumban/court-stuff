import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { Breakdown } from '../components/Breakdown';
import { CostSummary } from '../components/CostSummary';
import { PaymentQR, hasPayment } from '../components/PaymentQR';
import { Sheet } from '../components/Sheet';
import { computeBill, matchesFromSlots, payablesOf, type LineBill, type SessionBill } from '../lib/billing';
import { canShare, copyText, shareText } from '../lib/browser';
import { cx } from '../lib/cx';
import { buildChatMessage, formatDateLong, formatDateShort, formatMoney, lineFormula } from '../lib/format';
import { DEFAULT_SETTINGS } from '../lib/types';
import { fetchSharedBill, type SharedBill } from '../sync/share';

type State = { kind: 'loading' } | { kind: 'gone' } | { kind: 'error'; message: string } | { kind: 'ready'; bill: SharedBill };

export default function SharedSessionPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [copied, setCopied] = useState(false);
  const [openPerson, setOpenPerson] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const bill = await fetchSharedBill(token);
      setState(bill ? { kind: 'ready', bill } : { kind: 'gone' });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'Could not load this bill' });
    }
  }, [token]);

  // Load once, then refresh whenever the viewer comes back to the tab, so "who paid" stays current.
  useEffect(() => {
    void load();
    const onFocus = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [load]);

  if (state.kind === 'loading') return <Centered><div className="animate-pulse text-sm text-muted">Loading the bill…</div></Centered>;

  if (state.kind === 'gone')
    return (
      <Centered>
        <div className="card max-w-sm p-8 text-center">
          <div className="mb-3 text-4xl">🔗</div>
          <h1 className="text-lg font-semibold">This link is no longer active</h1>
          <p className="mt-1 text-sm text-muted">The organiser stopped sharing this bill, or it was deleted. Ask them for a fresh link.</p>
        </div>
      </Centered>
    );

  if (state.kind === 'error')
    return (
      <Centered>
        <div className="card max-w-sm p-8 text-center">
          <div className="mb-3 text-4xl">⚠️</div>
          <h1 className="text-lg font-semibold">Could not load this bill</h1>
          <p className="mt-1 text-sm text-muted">{state.message}</p>
          <button className="btn mt-4" onClick={() => void load()}>
            Try again
          </button>
        </div>
      </Centered>
    );

  const { session, entries, display } = state.bill;
  const c = display?.currency || '₱';
  const bill = computeBill(session, entries);
  const settings = { ...DEFAULT_SETTINGS, currency: c, visitorFeeLabel: display?.visitorFeeLabel || 'Visitor fee' };
  const matches = matchesFromSlots(bill.totalGames, display?.playersPerGame ?? 4);
  const pct = bill.billed > 0 ? Math.round((bill.collected / bill.billed) * 100) : 0;
  const title = `${session.court || 'Court'} ${formatDateShort(session.date)}`;

  const onCopy = async () => {
    const ok = await copyText(buildChatMessage(session, bill, settings));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-dvh pb-16">
      {/* Hero */}
      <header className="relative overflow-hidden bg-ink px-4 pb-14 pt-10 text-center text-white dark:bg-surface-2">
        <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-gold/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-12 top-10 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative mx-auto max-w-2xl">
          <span className="pill mb-3 bg-white/10 text-white/80 backdrop-blur">Shared bill · view only</span>
          <h1 className="text-3xl font-semibold tracking-tight">{session.court || 'Court'}</h1>
          <p className="mt-1 text-sm text-white/70">{formatDateLong(session.date)}</p>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-8 max-w-2xl px-4">
        {/* What the money was for, and how each part was divided */}
        {payablesOf(session).length > 0 && (
          <section className="card mt-3 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="stat-label">What this night cost</h2>
              {matches !== null && (
                <span className="num text-xs text-muted">
                  {matches} {matches === 1 ? 'match' : 'matches'}
                </span>
              )}
            </div>
            <CostSummary
              session={session}
              bill={bill}
              currency={c}
              visitorFeeLabel={display?.visitorFeeLabel}
              className="mt-1"
            />
          </section>
        )}

        {/* Totals */}
        <section className="card mt-3 p-4">
          <div className="grid grid-cols-2 gap-2 text-center">
            <Total label="Paid so far" value={formatMoney(bill.collected, c)} tone="text-ok" />
            <Total label="Still unpaid" value={formatMoney(bill.outstanding, c)} tone={bill.outstanding > 0 ? 'text-bad' : 'text-ok'} />
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-ok transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
          <p className="num mt-1.5 text-center text-xs text-muted">
            {bill.paidCount} of {bill.headcount} paid · {pct}%
          </p>
        </section>

        {/* People */}
        <h2 className="mb-2 mt-6 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
          Who owes what ({bill.headcount})
        </h2>
        <p className="mb-2 px-1 text-xs text-muted">Tap your name to see how your share was worked out.</p>
        <ul className="space-y-2">
          {bill.lines.map((line, i) => (
            <li key={line.entry.id}>
              <button
                onClick={() => setOpenPerson(line.entry.id)}
                className={cx(
                  'card flex w-full items-center gap-3 p-3.5 text-left transition hover:border-ink/25',
                  line.entry.paid && 'border-ok/40 bg-ok-soft/30',
                )}
              >
                <span className="num w-5 shrink-0 text-right text-xs text-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="truncate font-medium">{line.entry.label}</span>
                    {line.entry.isVisitor && <span className="pill bg-warn-soft text-warn">visitor</span>}
                  </div>
                  <div className="num mt-0.5 text-xs text-muted">{lineFormula(line, bill, c)}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="num text-lg font-semibold leading-tight">{formatMoney(line.total, c)}</div>
                  <div className={cx('text-xs font-medium', line.entry.paid ? 'text-ok' : 'text-muted')}>{line.entry.paid ? '✓ Paid' : 'Unpaid'}</div>
                </div>
                <span className="shrink-0 text-muted">›</span>
              </button>
            </li>
          ))}
        </ul>

        {session.notes?.trim() && (
          <section className="card mt-4 p-4">
            <h2 className="stat-label">Note from the organiser</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm">{session.notes.trim()}</p>
          </section>
        )}

        {hasPayment(display?.payment) && (
          <PaymentQR payment={display.payment!} className="mt-4" />
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button className="btn" onClick={onCopy}>
            {copied ? '✓ Copied' : 'Copy as text'}
          </button>
          {canShare() && (
            <button className="btn" onClick={() => void shareText(title, window.location.href)}>
              Share this link
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => void load()}>
            Refresh
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          This is a read-only view. Only the organiser can change the bill.
        </p>
      </main>

      <PersonBreakdownSheet
        line={bill.lines.find((l) => l.entry.id === openPerson)}
        bill={bill}
        currency={c}
        visitorFeeLabel={display?.visitorFeeLabel}
        payment={display?.payment}
        onClose={() => setOpenPerson(null)}
      />
    </div>
  );
}

function PersonBreakdownSheet({
  line,
  bill,
  currency,
  visitorFeeLabel,
  payment,
  onClose,
}: {
  line?: LineBill;
  bill: SessionBill;
  currency: string;
  visitorFeeLabel?: string;
  payment?: SharedBill['display']['payment'];
  onClose: () => void;
}) {
  if (!line) return null;
  return (
    <Sheet open onClose={onClose} title={line.entry.label} subtitle={line.entry.paid ? 'Already paid — thank you' : 'Not yet paid'}>
      <Breakdown line={line} bill={bill} currency={currency} visitorFeeLabel={visitorFeeLabel} />
      {!line.entry.paid && hasPayment(payment) && <PaymentQR payment={payment!} amount={line.total} currency={currency} className="mt-3" />}
      <p className="mt-3 text-center text-xs text-muted">
        Only the organiser can change this. Tell them once you have paid.
      </p>
    </Sheet>
  );
}

function Total({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className={cx('num mt-0.5 text-xl font-semibold', tone)}>{value}</div>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="grid min-h-dvh place-items-center px-4">{children}</div>;
}

