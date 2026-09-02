import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ConfirmButton } from '../components/ConfirmButton';
import { Loading } from '../components/EmptyState';
import { Field, NumberField, TextAreaField, TextField } from '../components/Fields';
import { Money } from '../components/Money';
import { Stepper } from '../components/Stepper';
import { Switch } from '../components/Switch';
import { useToast } from '../components/Toast';
import {
  addEntry,
  addOtherCost,
  addPeopleFromSession,
  addRegulars,
  deleteSession,
  duplicateSession,
  moveEntry,
  removeEntry,
  removeOtherCost,
  setAllPaid,
  setEntryPaid,
  updateEntry,
  updateOtherCost,
  updateSession,
} from '../db/repo';
import { useEntries, usePlayers, useSession, useSessions, useSettings } from '../hooks/useData';
import { computeBill, matchesFromSlots, type LineBill, type SessionBill } from '../lib/billing';
import { canShare, copyText, shareText } from '../lib/browser';
import { cx } from '../lib/cx';
import { buildChatMessage, formatDateShort, formatMoney, formatNumber, lineFormula, pluralGames } from '../lib/format';
import type { Entry, Player, Rounding, Session, Settings, SplitMode } from '../lib/types';
import NotFound from './NotFound';

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const session = useSession(id);
  const entries = useEntries(id);
  const settings = useSettings();
  const players = usePlayers();
  const sessions = useSessions();

  if (session === undefined || !entries || !settings) return <Loading />;
  if (session === null) return <NotFound what="session" />;

  const bill = computeBill(session, entries);
  const message = buildChatMessage(session, bill, settings);
  const c = settings.currency;
  const previous = sessions?.find(
    (s) => s.id !== session.id && (s.date < session.date || (s.date === session.date && s.createdAt < session.createdAt)),
  );
  const courts = [...new Set((sessions ?? []).map((s) => s.court).filter(Boolean))];

  const onCopy = async () => {
    toast.show((await copyText(message)) ? 'Message copied — paste it in the group chat' : 'Could not copy on this browser', 'ok');
  };
  const onShare = () => shareText(`${session.court} ${formatDateShort(session.date)}`, message);
  const onDuplicate = async () => {
    const nid = await duplicateSession(session.id);
    toast.show('New session for today with the same people');
    navigate(`/session/${nid}`);
  };
  const onDelete = async () => {
    await deleteSession(session.id);
    toast.show('Session deleted');
    navigate('/');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/" className="btn btn-ghost btn-sm -ml-2">
          ← Sessions
        </Link>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={onCopy}>
            Copy message
          </button>
          {canShare() && (
            <button className="btn btn-sm" onClick={onShare}>
              Share
            </button>
          )}
        </div>
      </div>

      {/* Header */}
      <section className="card p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <Field label="Court">
            <TextField
              className="text-lg font-semibold"
              value={session.court}
              onCommit={(v) => updateSession(session.id, { court: v.trim() })}
              list="court-names"
              placeholder="Court name"
            />
            <datalist id="court-names">
              {courts.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </Field>
          <Field label="Date">
            <input type="date" className="input" value={session.date} onChange={(e) => e.target.value && updateSession(session.id, { date: e.target.value })} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={cx('pill', session.status === 'open' ? 'bg-ok-soft text-ok' : 'bg-surface-2 text-muted')}>
            {session.status === 'open' ? 'Open' : 'Closed'}
          </span>
          <button className="btn btn-sm" onClick={() => updateSession(session.id, { status: session.status === 'open' ? 'closed' : 'open' })}>
            {session.status === 'open' ? 'Close session' : 'Reopen'}
          </button>
          <button className="btn btn-sm" onClick={onDuplicate}>
            Duplicate for today
          </button>
          <ConfirmButton className="btn-sm ml-auto" onConfirm={onDelete}>
            Delete
          </ConfirmButton>
        </div>
      </section>

      <CostsCard session={session} bill={bill} settings={settings} />
      <SummaryCard bill={bill} currency={c} />

      {/* People */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-semibold">
            People <span className="num text-muted">({bill.headcount})</span>
          </h2>
          {bill.headcount > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setAllPaid(session.id, bill.paidCount < bill.headcount)}>
              {bill.paidCount < bill.headcount ? 'Mark all paid' : 'Unmark all'}
            </button>
          )}
        </div>
        <AddPeople session={session} entries={entries} players={players ?? []} previous={previous} />
        {bill.lines.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted">Add the people who played tonight. Each name starts at 1 game.</p>
        ) : (
          <ul className="space-y-2">
            {bill.lines.map((line, i) => (
              <EntryRow key={line.entry.id} line={line} index={i} count={bill.lines.length} bill={bill} currency={c} />
            ))}
          </ul>
        )}
      </section>

      {/* Announcement */}
      <section className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Announcement</h2>
            <p className="text-xs text-muted">Paste this in the group chat. ✅ marks who has paid.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-sm" onClick={onCopy}>
              Copy
            </button>
            {canShare() && (
              <button className="btn btn-sm" onClick={onShare}>
                Share
              </button>
            )}
          </div>
        </div>
        <Field label="Notes (added at the end of the message)" className="mt-3">
          <TextAreaField value={session.notes ?? ''} onCommit={(v) => updateSession(session.id, { notes: v || undefined })} placeholder="e.g. GCash 09xx-xxx-xxxx" />
        </Field>
        <pre className="num mt-3 whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-sm leading-relaxed">{message}</pre>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function CostsCard({ session, bill, settings }: { session: Session; bill: SessionBill; settings: Settings }) {
  const c = settings.currency;
  const matches = matchesFromSlots(bill.totalGames, settings.playersPerGame);
  const perGameLabels = [
    ...(session.lightsSplit === 'perGame' ? ['Lights'] : []),
    ...session.otherCosts.filter((x) => x.split === 'perGame').map((x) => x.label || 'Cost'),
  ];
  const gameKind = settings.playersPerGame === 2 ? 'singles' : settings.playersPerGame === 4 ? 'doubles' : `${settings.playersPerGame}-player`;

  return (
    <section className="card p-4">
      <h2 className="font-semibold">Lights &amp; shared costs</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Lights cost">
          <NumberField prefix={c} value={session.lightsCost} onCommit={(v) => updateSession(session.id, { lightsCost: v })} />
        </Field>
        <Field label="Split lights">
          <select className="input" value={session.lightsSplit} onChange={(e) => updateSession(session.id, { lightsSplit: e.target.value as SplitMode })}>
            <option value="perGame">Per game played</option>
            <option value="equal">Equally per person</option>
          </select>
        </Field>
        <Field label={settings.visitorFeeLabel} hint="Added to anyone marked as visitor">
          <NumberField prefix={c} value={session.visitorFee} onCommit={(v) => updateSession(session.id, { visitorFee: v })} />
        </Field>
        <Field label="Rounding of the rate">
          <select className="input" value={session.rounding} onChange={(e) => updateSession(session.id, { rounding: e.target.value as Rounding })}>
            <option value="exact">Exact (centavos)</option>
            <option value="peso">Nearest {c}1</option>
            <option value="five">Round up to {c}5</option>
          </select>
        </Field>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <span className="label mb-0">Other shared costs</span>
          <button className="btn btn-ghost btn-sm" onClick={() => addOtherCost(session.id, { label: 'Shuttlecocks', amount: 0, split: 'perGame' })}>
            ＋ Add cost
          </button>
        </div>
        {session.otherCosts.length > 0 && (
          <div className="mt-2 space-y-2">
            {session.otherCosts.map((cost) => (
              <div key={cost.id} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_120px_170px_auto]">
                <TextField value={cost.label} onCommit={(v) => updateOtherCost(session.id, cost.id, { label: v })} placeholder="What for" />
                <button className="btn btn-ghost btn-sm sm:order-last" aria-label="Remove cost" onClick={() => removeOtherCost(session.id, cost.id)}>
                  ✕
                </button>
                <NumberField prefix={c} value={cost.amount} onCommit={(v) => updateOtherCost(session.id, cost.id, { amount: v })} />
                <select className="input" value={cost.split} onChange={(e) => updateOtherCost(session.id, cost.id, { split: e.target.value as SplitMode })}>
                  <option value="perGame">Split per game</option>
                  <option value="equal">Split equally</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2 rounded-xl bg-surface-2 p-3">
        {bill.perGamePool > 0 && (
          <div>
            <div className="text-xs text-muted">{perGameLabels.join(' + ')} ÷ total games</div>
            <div className="num text-lg font-semibold">
              {formatMoney(bill.perGamePool, c)} ÷ {pluralGames(bill.totalGames)} = <span className="text-gold">{formatMoney(bill.rate, c)}</span> per game
            </div>
            {bill.totalGames > 0 && bill.rate !== bill.rawRate && (
              <div className="num text-xs text-muted">Exact rate {c}{bill.rawRate.toFixed(4)} rounded to {formatMoney(bill.rate, c)}.</div>
            )}
            {bill.totalGames > 0 && settings.playersPerGame > 1 && (
              <div className={cx('mt-1 text-xs', matches === null ? 'text-warn' : 'text-muted')}>
                {matches === null
                  ? `${bill.totalGames} game slots is not a whole number of ${gameKind} matches (${settings.playersPerGame} per game) — worth double-checking the tally.`
                  : `${bill.totalGames} game slots = ${matches} ${gameKind} ${matches === 1 ? 'match' : 'matches'}.`}
              </div>
            )}
          </div>
        )}
        {bill.equalPool > 0 && (
          <div>
            <div className="text-xs text-muted">Split equally</div>
            <div className="num text-lg font-semibold">
              {formatMoney(bill.equalPool, c)} ÷ {bill.headcount} {bill.headcount === 1 ? 'person' : 'people'} = <span className="text-gold">{formatMoney(bill.equalShare, c)}</span> each
            </div>
          </div>
        )}
        {bill.perGamePool === 0 && bill.equalPool === 0 && <div className="text-sm text-muted">No shared costs yet.</div>}
        {bill.variance !== 0 && (
          <div className="num text-xs text-warn">
            Rounding puts the bill {formatMoney(Math.abs(bill.variance), c)} {bill.variance > 0 ? 'over' : 'short of'} the actual cost ({formatMoney(bill.expected, c)}).
          </div>
        )}
      </div>
    </section>
  );
}

function SummaryCard({ bill, currency }: { bill: SessionBill; currency: string }) {
  const pct = bill.billed > 0 ? Math.round((bill.collected / bill.billed) * 100) : 0;
  return (
    <section className="card p-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="stat-label">To collect</div>
          <Money value={bill.billed} currency={currency} className="text-xl font-semibold" />
        </div>
        <div>
          <div className="stat-label">Collected</div>
          <Money value={bill.collected} currency={currency} className="text-xl font-semibold text-ok" />
        </div>
        <div>
          <div className="stat-label">Unpaid</div>
          <Money value={bill.outstanding} currency={currency} className={cx('text-xl font-semibold', bill.outstanding > 0 ? 'text-bad' : 'text-ok')} />
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-ok transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="num mt-1.5 text-center text-xs text-muted">
        {bill.paidCount} of {bill.headcount} paid · {pct}%
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function AddPeople({ session, entries, players, previous }: { session: Session; entries: Entry[]; players: Player[]; previous?: Session }) {
  const [name, setName] = useState('');
  const [visitor, setVisitor] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const active = players.filter((p) => p.active);
  const inSession = new Set(entries.map((e) => e.playerId).filter(Boolean));
  const missingRegulars = active.filter((p) => p.isRegular && !inSession.has(p.id));
  const suggestions = [...active.filter((p) => !inSession.has(p.id))].sort((a, b) => Number(b.isRegular) - Number(a.isRegular) || a.name.localeCompare(b.name)).slice(0, 12);

  const onName = (v: string) => {
    setName(v);
    const match = active.find((p) => norm(p.name) === norm(v));
    if (match) setVisitor(!match.isRegular);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await addEntry(session.id, { name, isVisitor: visitor });
    setName('');
    setVisitor(false);
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={submit} className="card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          list="roster-names"
          className="input min-w-[10rem] flex-1"
          placeholder="Add a name…"
          value={name}
          onChange={(e) => onName(e.target.value)}
          autoComplete="off"
          autoCapitalize="words"
        />
        <datalist id="roster-names">
          {active.map((p) => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>
        <Switch size="sm" checked={visitor} onChange={setVisitor} label="Visitor" />
        <button className="btn btn-primary" type="submit" disabled={!name.trim()}>
          Add
        </button>
      </div>
      {(suggestions.length > 0 || previous) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {suggestions.map((p) => (
            <button
              type="button"
              key={p.id}
              className="chip border border-line hover:bg-surface-2"
              onClick={() => addEntry(session.id, { name: p.name, playerId: p.id, isVisitor: !p.isRegular })}
            >
              ＋ {p.name}
            </button>
          ))}
          {missingRegulars.length > 1 && (
            <button
              type="button"
              className="chip bg-surface-2 font-semibold hover:bg-line"
              onClick={async () => toast.show(`Added ${await addRegulars(session.id)} regulars`)}
            >
              ＋ All regulars ({missingRegulars.length})
            </button>
          )}
          {previous && (
            <button
              type="button"
              className="chip bg-surface-2 font-semibold hover:bg-line"
              onClick={async () => toast.show(`Added ${await addPeopleFromSession(session.id, previous.id)} from ${formatDateShort(previous.date)}`)}
            >
              ＋ Same people as {formatDateShort(previous.date)}
            </button>
          )}
        </div>
      )}
    </form>
  );
}

function EntryRow({ line, index, count, bill, currency }: { line: LineBill; index: number; count: number; bill: SessionBill; currency: string }) {
  const [open, setOpen] = useState(false);
  const e = line.entry;
  return (
    <li className={cx('card p-3', e.paid && 'border-ok/30')}>
      <div className="flex items-start gap-2.5">
        <span className="num mt-1 w-5 shrink-0 text-right text-xs text-muted">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={() => setOpen((o) => !o)} className="truncate py-1 text-left font-medium hover:underline">
              {e.label}
            </button>
            {e.isVisitor && <span className="pill shrink-0 bg-warn-soft text-warn">visitor</span>}
          </div>
          <div className="num mt-0.5 text-xs text-muted">{lineFormula(line, bill, currency)}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Stepper value={e.games} onChange={(v) => updateEntry(e.id, { games: v })} />
            <Switch size="sm" checked={e.isVisitor} onChange={(v) => updateEntry(e.id, { isVisitor: v })} label="Visitor" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>
              {open ? 'Less' : 'More'}
            </button>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Money value={line.total} currency={currency} className="text-lg font-semibold" />
          <button
            type="button"
            onClick={() => setEntryPaid(e.id, !e.paid)}
            className={cx(
              'chip border transition',
              e.paid ? 'border-ok/30 bg-ok-soft text-ok' : 'border-line text-muted hover:border-ink hover:text-ink',
            )}
          >
            {e.paid ? '✓ Paid' : 'Mark paid'}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-3">
          <Field label="Name on the bill">
            <TextField value={e.label} onCommit={(v) => updateEntry(e.id, { label: v.trim() || e.label })} />
          </Field>
          <Field label="Extra charge / credit" hint="Negative amount = discount">
            <NumberField prefix={currency} allowNegative value={e.extra} onCommit={(v) => updateEntry(e.id, { extra: v })} />
          </Field>
          <Field label="Note for the extra">
            <TextField value={e.extraNote ?? ''} onCommit={(v) => updateEntry(e.id, { extraNote: v.trim() || undefined })} placeholder="e.g. water, shuttles" />
          </Field>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
            <button className="btn btn-sm" disabled={index === 0} onClick={() => moveEntry(e.id, -1)}>
              ↑ Up
            </button>
            <button className="btn btn-sm" disabled={index === count - 1} onClick={() => moveEntry(e.id, 1)}>
              ↓ Down
            </button>
            {e.playerId && (
              <Link to={`/players/${e.playerId}`} className="btn btn-ghost btn-sm">
                Player history
              </Link>
            )}
            <span className="num ml-auto text-xs text-muted">{e.paid && e.paidAt ? `paid ${new Date(e.paidAt).toLocaleString()}` : `${formatNumber(e.games)} × ${formatMoney(bill.rate, currency)}`}</span>
            <ConfirmButton className="btn-sm" onConfirm={() => removeEntry(e.id)}>
              Remove
            </ConfirmButton>
          </div>
        </div>
      )}
    </li>
  );
}
