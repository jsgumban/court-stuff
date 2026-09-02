import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Breakdown } from '../components/Breakdown';
import { ConfirmButton } from '../components/ConfirmButton';
import { Loading } from '../components/EmptyState';
import { Field, NumberField, TextAreaField, TextField } from '../components/Fields';
import { PaymentEditor } from '../components/PaymentEditor';
import { PaymentQR, hasPayment } from '../components/PaymentQR';
import { ShareCard } from '../components/ShareCard';
import { Sheet } from '../components/Sheet';
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
  parseNames,
  patchSessionPayment,
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
import { buildChatMessage, formatDateLong, formatDateShort, formatMoney, lineFormula, pluralGames } from '../lib/format';
import { isPaymentSet, resolvePayment } from '../lib/payment';
import type { Entry, PaymentInfo, Player, Rounding, Session, Settings, SplitMode } from '../lib/types';
import NotFound from './NotFound';

type OpenSheet = null | 'costs' | 'details' | 'share' | 'payment' | { person: string };

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const session = useSession(id);
  const entries = useEntries(id);
  const settings = useSettings();
  const players = usePlayers();
  const sessions = useSessions();
  const [sheet, setSheet] = useState<OpenSheet>(null);

  if (session === undefined || !entries || !settings) return <Loading />;
  if (session === null) return <NotFound what="session" />;

  const bill = computeBill(session, entries);
  const c = settings.currency;
  const payment = resolvePayment(session, settings);
  const previous = sessions?.find(
    (s) => s.id !== session.id && (s.date < session.date || (s.date === session.date && s.createdAt < session.createdAt)),
  );
  const personSheet = sheet && typeof sheet === 'object' ? bill.lines.find((l) => l.entry.id === sheet.person) : undefined;

  return (
    <div className="space-y-3">
      {/* Identity + the one number that matters */}
      <div className="flex items-center justify-between">
        <Link to="/" className="btn btn-ghost btn-sm -ml-2">
          ← Sessions
        </Link>
        <button className="btn btn-primary btn-sm" onClick={() => setSheet('share')}>
          Share bill
        </button>
      </div>

      <section className="card overflow-hidden">
        <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2" onClick={() => setSheet('details')}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-lg font-semibold">{session.court || 'Untitled court'}</span>
              {session.status === 'closed' && <span className="pill bg-surface-2 text-muted">closed</span>}
            </div>
            <div className="text-xs text-muted">{formatDateLong(session.date)}</div>
          </div>
          <span className="shrink-0 text-sm text-muted">Edit ›</span>
        </button>

        <button className="w-full border-t border-line px-4 py-4 text-center hover:bg-surface-2" onClick={() => setSheet('costs')}>
          {bill.perGamePool > 0 ? (
            <>
              <div className="num text-3xl font-semibold tracking-tight text-gold">{formatMoney(bill.rate, c)}</div>
              <div className="stat-label mt-0.5">per game</div>
              <div className="num mt-1.5 text-xs text-muted">
                {formatMoney(bill.perGamePool, c)} ÷ {pluralGames(bill.totalGames)} · tap to change costs
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-medium">Set the lights cost</div>
              <div className="mt-0.5 text-xs text-muted">Tap to enter what the court charged tonight</div>
            </>
          )}
          {bill.equalPool > 0 && (
            <div className="num mt-1 text-xs text-muted">plus {formatMoney(bill.equalShare, c)} each, split equally</div>
          )}
          {bill.variance !== 0 && (
            <div className="num mt-1 text-xs text-warn">
              Rounding leaves the bill {formatMoney(Math.abs(bill.variance), c)} {bill.variance > 0 ? 'over' : 'short'}
            </div>
          )}
        </button>

        <div className="grid grid-cols-3 border-t border-line text-center">
          <Cell label="Total" value={formatMoney(bill.billed, c)} />
          <Cell label="Paid" value={formatMoney(bill.collected, c)} tone="text-ok" divider />
          <Cell label="Unpaid" value={formatMoney(bill.outstanding, c)} tone={bill.outstanding > 0 ? 'text-bad' : 'text-ok'} divider />
        </div>
        {bill.headcount > 0 && (
          <div className="border-t border-line px-4 py-2.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-ok transition-all"
                style={{ width: `${bill.billed > 0 ? Math.round((bill.collected / bill.billed) * 100) : 0}%` }}
              />
            </div>
            <p className="num mt-1.5 text-center text-[11px] text-muted">
              {bill.paidCount} of {bill.headcount} paid
            </p>
          </div>
        )}
      </section>

      <AddPeople session={session} entries={entries} players={players ?? []} previous={previous} />

      {bill.lines.length === 0 ? (
        <p className="px-1 py-8 text-center text-sm text-muted">
          No one on this bill yet. Add the people who played and each starts at one game.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between px-1 pt-1">
            <p className="num text-xs text-muted">
              {pluralGames(bill.totalGames)} · {bill.paidCount} of {bill.headcount} paid
            </p>
            <button className="btn btn-ghost btn-sm" onClick={() => setAllPaid(session.id, bill.paidCount < bill.headcount)}>
              {bill.paidCount < bill.headcount ? 'Mark all paid' : 'Unmark all'}
            </button>
          </div>
          <ul className="space-y-2">
            {bill.lines.map((line) => (
              <PersonRow key={line.entry.id} line={line} bill={bill} currency={c} onOpen={() => setSheet({ person: line.entry.id })} />
            ))}
          </ul>
        </>
      )}

      <CostsSheet open={sheet === 'costs'} onClose={() => setSheet(null)} session={session} bill={bill} settings={settings} />
      <DetailsSheet open={sheet === 'details'} onClose={() => setSheet(null)} session={session} sessions={sessions ?? []} />
      <ShareSheet
        open={sheet === 'share'}
        onClose={() => setSheet(null)}
        session={session}
        bill={bill}
        settings={settings}
        onEditPayment={() => setSheet('payment')}
      />
      <PaymentSheet open={sheet === 'payment'} onClose={() => setSheet(null)} session={session} settings={settings} />
      <PersonSheet line={personSheet} bill={bill} currency={c} settings={settings} payment={payment} onClose={() => setSheet(null)} />
    </div>
  );
}

function Cell({ label, value, tone, divider }: { label: string; value: string; tone?: string; divider?: boolean }) {
  return (
    <div className={cx('px-2 py-2.5', divider && 'border-l border-line')}>
      <div className="stat-label">{label}</div>
      <div className={cx('num mt-0.5 font-semibold', tone)}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One row does both jobs: tick when they pay, step the games while you play.

function PersonRow({ line, bill, currency, onOpen }: { line: LineBill; bill: SessionBill; currency: string; onOpen: () => void }) {
  const e = line.entry;
  return (
    <li className={cx('card px-3 py-2.5 transition', e.paid && 'border-ok/40 bg-ok-soft/30')}>
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setEntryPaid(e.id, !e.paid)}
          aria-pressed={e.paid}
          aria-label={e.paid ? `Mark ${e.label} unpaid` : `Mark ${e.label} paid`}
          className={cx(
            'grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:scale-95',
            e.paid ? 'text-ok' : 'text-muted hover:text-ink',
          )}
        >
          <span className={cx('grid h-7 w-7 place-items-center rounded-full border text-sm', e.paid ? 'border-ok bg-ok text-white' : 'border-line text-transparent')}>
            ✓
          </span>
        </button>
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left">
          <span className="truncate font-medium">{e.label}</span>
          {e.isVisitor && <span className="pill shrink-0 bg-warn-soft text-warn">visitor</span>}
        </button>
        <span className={cx('num shrink-0 font-semibold', e.paid && 'text-ok')}>{formatMoney(line.total, currency)}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2 pl-[3.375rem]">
        <button onClick={onOpen} className="num min-w-0 truncate text-left text-xs text-muted hover:text-ink">
          {lineFormula(line, bill, currency)}
        </button>
        <Stepper value={e.games} onChange={(v) => updateEntry(e.id, { games: v })} className="shrink-0" />
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Add people

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function AddPeople({ session, entries, players, previous }: { session: Session; entries: Entry[]; players: Player[]; previous?: Session }) {
  const [name, setName] = useState('');
  const [visitor, setVisitor] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const active = players.filter((p) => p.active);
  const inSession = new Set(entries.map((e) => e.playerId).filter(Boolean));
  const missingRegulars = active.filter((p) => p.isRegular && !inSession.has(p.id));
  const suggestions = [...active.filter((p) => !inSession.has(p.id))]
    .sort((a, b) => Number(b.isRegular) - Number(a.isRegular) || a.name.localeCompare(b.name))
    .slice(0, 8);

  const onName = (v: string) => {
    setName(v);
    const match = active.find((p) => norm(p.name) === norm(v));
    if (match) setVisitor(!match.isRegular);
  };

  const names = parseNames(name);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!names.length) return;
    for (const n of names) await addEntry(session.id, { name: n, isVisitor: visitor });
    if (names.length > 1) toast.show(`Added ${names.length} people`);
    setName('');
    setVisitor(false);
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={submit} className="card p-3">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          list="roster-names"
          className="input min-w-0 flex-1"
          placeholder="Add a name, or paste a list…"
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
        <button className="btn btn-primary shrink-0" type="submit" disabled={!names.length}>
          {names.length > 1 ? `Add ${names.length}` : 'Add'}
        </button>
      </div>
      <div className="mt-1.5">
        <Switch size="sm" checked={visitor} onChange={setVisitor} label="Charge visitor fee" />
      </div>
      {(suggestions.length > 0 || previous) && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2.5">
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
              ＋ Same as {formatDateShort(previous.date)}
            </button>
          )}
        </div>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Sheets

function CostsSheet({
  open,
  onClose,
  session,
  bill,
  settings,
}: {
  open: boolean;
  onClose: () => void;
  session: Session;
  bill: SessionBill;
  settings: Settings;
}) {
  const c = settings.currency;
  const [advanced, setAdvanced] = useState(false);
  const matches = matchesFromSlots(bill.totalGames, settings.playersPerGame);
  const gameKind = settings.playersPerGame === 2 ? 'singles' : settings.playersPerGame === 4 ? 'doubles' : `${settings.playersPerGame}-player`;

  return (
    <Sheet open={open} onClose={onClose} title="Costs" subtitle="What the night cost and how it is divided">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Lights">
          <NumberField prefix={c} value={session.lightsCost} onCommit={(v) => updateSession(session.id, { lightsCost: v })} />
        </Field>
        <Field label={settings.visitorFeeLabel} hint="Charged to anyone marked as a visitor">
          <NumberField prefix={c} value={session.visitorFee} onCommit={(v) => updateSession(session.id, { visitorFee: v })} />
        </Field>
      </div>

      <div className="mt-4 rounded-xl bg-surface-2 p-3">
        {bill.perGamePool > 0 ? (
          <>
            <div className="num text-base font-semibold">
              {formatMoney(bill.perGamePool, c)} ÷ {pluralGames(bill.totalGames)} = <span className="text-gold">{formatMoney(bill.rate, c)}</span> per game
            </div>
            {bill.rate !== bill.rawRate && (
              <div className="num mt-0.5 text-xs text-muted">Exact rate {c}{bill.rawRate.toFixed(4)}, rounded to {formatMoney(bill.rate, c)}.</div>
            )}
            {settings.playersPerGame > 1 && bill.totalGames > 0 && (
              <div className={cx('mt-1 text-xs', matches === null ? 'text-warn' : 'text-muted')}>
                {matches === null
                  ? `${bill.totalGames} game slots is not a whole number of ${gameKind} matches. Worth re-checking the tally.`
                  : `${bill.totalGames} game slots = ${matches} ${gameKind} ${matches === 1 ? 'match' : 'matches'}.`}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">Enter the lights cost to see the rate per game.</p>
        )}
        {bill.equalPool > 0 && (
          <div className="num mt-2 border-t border-line pt-2 text-base font-semibold">
            {formatMoney(bill.equalPool, c)} ÷ {bill.headcount} = <span className="text-gold">{formatMoney(bill.equalShare, c)}</span> each
          </div>
        )}
        {bill.variance !== 0 && (
          <div className="num mt-2 text-xs text-warn">
            Rounding collects {formatMoney(Math.abs(bill.variance), c)} {bill.variance > 0 ? 'more than' : 'less than'} the {formatMoney(bill.expected, c)} actually spent.
          </div>
        )}
      </div>

      <button className="btn btn-ghost btn-sm mt-4 -ml-2" onClick={() => setAdvanced((a) => !a)}>
        {advanced ? 'Hide' : 'Show'} other costs and rounding
      </button>

      {advanced && (
        <div className="mt-2 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Split lights">
              <select className="input" value={session.lightsSplit} onChange={(e) => updateSession(session.id, { lightsSplit: e.target.value as SplitMode })}>
                <option value="perGame">Per game played</option>
                <option value="equal">Equally per person</option>
              </select>
            </Field>
            <Field label="Rounding">
              <select className="input" value={session.rounding} onChange={(e) => updateSession(session.id, { rounding: e.target.value as Rounding })}>
                <option value="exact">Exact (centavos)</option>
                <option value="peso">Nearest {c}1</option>
                <option value="five">Round up to {c}5</option>
              </select>
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="label mb-0">Other shared costs</span>
              <button className="btn btn-ghost btn-sm" onClick={() => addOtherCost(session.id, { label: 'Shuttlecocks', amount: 0, split: 'perGame' })}>
                ＋ Add
              </button>
            </div>
            {session.otherCosts.length === 0 ? (
              <p className="mt-1 text-xs text-muted">Shuttlecocks, balls, court rental. Each can follow the games or split evenly.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {session.otherCosts.map((cost) => (
                  <div key={cost.id} className="grid grid-cols-[1fr_auto] gap-2">
                    <TextField value={cost.label} onCommit={(v) => updateOtherCost(session.id, cost.id, { label: v })} placeholder="What for" />
                    <button className="btn btn-ghost" aria-label="Remove cost" onClick={() => removeOtherCost(session.id, cost.id)}>
                      ✕
                    </button>
                    <NumberField prefix={c} value={cost.amount} onCommit={(v) => updateOtherCost(session.id, cost.id, { amount: v })} />
                    <select
                      className="input w-auto"
                      value={cost.split}
                      onChange={(e) => updateOtherCost(session.id, cost.id, { split: e.target.value as SplitMode })}
                    >
                      <option value="perGame">Per game</option>
                      <option value="equal">Equally</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}

function DetailsSheet({ open, onClose, session, sessions }: { open: boolean; onClose: () => void; session: Session; sessions: Session[] }) {
  const navigate = useNavigate();
  const toast = useToast();
  const courts = [...new Set(sessions.map((s) => s.court).filter(Boolean))];

  return (
    <Sheet open={open} onClose={onClose} title="Session details">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Court">
          <TextField value={session.court} onCommit={(v) => updateSession(session.id, { court: v.trim() })} list="court-names" placeholder="Court name" />
          <datalist id="court-names">
            {courts.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </Field>
        <Field label="Date">
          <input type="date" className="input" value={session.date} onChange={(e) => e.target.value && updateSession(session.id, { date: e.target.value })} />
        </Field>
      </div>

      <Field label="Note for the group" className="mt-3" hint="Added to the end of the shared message, e.g. your GCash number">
        <TextAreaField value={session.notes ?? ''} onCommit={(v) => updateSession(session.id, { notes: v || undefined })} placeholder="e.g. GCash 09xx-xxx-xxxx" />
      </Field>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        <button className="btn" onClick={() => updateSession(session.id, { status: session.status === 'open' ? 'closed' : 'open' })}>
          {session.status === 'open' ? 'Close session' : 'Reopen session'}
        </button>
        <button
          className="btn"
          onClick={async () => {
            const nid = await duplicateSession(session.id);
            toast.show('New session for today with the same people');
            onClose();
            navigate(`/session/${nid}`);
          }}
        >
          Duplicate for today
        </button>
        <ConfirmButton
          className="ml-auto"
          onConfirm={async () => {
            await deleteSession(session.id);
            toast.show('Session deleted');
            navigate('/');
          }}
        >
          Delete session
        </ConfirmButton>
      </div>
    </Sheet>
  );
}

function ShareSheet({
  open,
  onClose,
  session,
  bill,
  settings,
  onEditPayment,
}: {
  open: boolean;
  onClose: () => void;
  session: Session;
  bill: SessionBill;
  settings: Settings;
  onEditPayment: () => void;
}) {
  const toast = useToast();
  const [showText, setShowText] = useState(false);
  const message = buildChatMessage(session, bill, settings);
  const title = `${session.court} ${formatDateShort(session.date)}`;
  const payment = resolvePayment(session, settings);
  const ownPayment = isPaymentSet(session.payment);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Share bill"
      subtitle="A link anyone can open, or the message to paste in the group chat"
      footer={
        <div className="flex gap-2">
          <button
            className="btn btn-primary flex-1"
            onClick={async () => toast.show((await copyText(message)) ? 'Message copied — paste it in the group chat' : 'Could not copy', 'ok')}
          >
            Copy message
          </button>
          {canShare() && (
            <button className="btn" onClick={() => void shareText(title, message)}>
              Share
            </button>
          )}
        </div>
      }
    >
      <ShareCard sessionId={session.id} title={title} />

      <button
        onClick={onEditPayment}
        className="mt-3 flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:bg-surface-2"
      >
        {payment?.qrImage ? (
          <img src={payment.qrImage} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-line bg-white object-contain p-0.5" />
        ) : (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-surface-2 text-lg">₱</span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Who collects tonight</span>
          <span className="block truncate text-xs text-muted">
            {isPaymentSet(payment)
              ? `${[payment!.channel, payment!.accountName, payment!.accountNumber].filter(Boolean).join(' · ')}${ownPayment ? '' : ' (your default)'}`
              : 'Not set. Add a QR or number so people can pay.'}
          </span>
        </span>
        <span className="shrink-0 text-muted">›</span>
      </button>

      <button className="btn btn-ghost btn-sm mt-3 -ml-2" onClick={() => setShowText((v) => !v)}>
        {showText ? 'Hide' : 'Preview'} the message
      </button>
      {showText && <pre className="num mt-2 whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-xs leading-relaxed">{message}</pre>}
    </Sheet>
  );
}

function PaymentSheet({ open, onClose, session, settings }: { open: boolean; onClose: () => void; session: Session; settings: Settings }) {
  const toast = useToast();
  const ownPayment = isPaymentSet(session.payment);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Who collects tonight"
      subtitle="Shown on the shared bill and beside each unpaid person's amount"
    >
      {!ownPayment && (
        <p className="mb-3 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
          {isPaymentSet(settings.payment)
            ? 'This session uses your default payment details. Editing below applies to this session only.'
            : 'Nothing set yet. What you enter here applies to this session only.'}
        </p>
      )}
      <PaymentEditor
        idPrefix={`session-${session.id}`}
        value={session.payment ?? settings.payment}
        onPatch={(patch) => patchSessionPayment(session.id, patch, settings.payment)}
      />
      {ownPayment && (
        <div className="mt-4 border-t border-line pt-3">
          <ConfirmButton
            className="btn-sm"
            confirmLabel="Tap again to use the default"
            onConfirm={async () => {
              await updateSession(session.id, { payment: undefined });
              toast.show('Back to your default payment details');
            }}
          >
            Reset to my default
          </ConfirmButton>
        </div>
      )}
    </Sheet>
  );
}

function PersonSheet({
  line,
  bill,
  currency,
  settings,
  payment,
  onClose,
}: {
  line?: LineBill;
  bill: SessionBill;
  currency: string;
  settings: Settings;
  payment?: PaymentInfo;
  onClose: () => void;
}) {
  if (!line) return null;
  const e = line.entry;
  const lines = bill.lines;
  const index = lines.findIndex((l) => l.entry.id === e.id);

  return (
    <Sheet open onClose={onClose} title={e.label} subtitle={e.paid ? 'Already paid' : 'Not yet paid'}>
      <Breakdown line={line} bill={bill} currency={currency} visitorFeeLabel={settings.visitorFeeLabel} />
      {hasPayment(payment) && !e.paid && <PaymentQR payment={payment!} amount={line.total} currency={currency} className="mt-3" />}

      <div className="mt-4 grid gap-3 border-t border-line pt-4">
        <Field label="Name on the bill">
          <TextField value={e.label} onCommit={(v) => updateEntry(e.id, { label: v.trim() || e.label })} />
        </Field>
        <div className="flex flex-wrap items-center gap-4">
          <Field label="Games" className="w-auto">
            <Stepper value={e.games} onChange={(v) => updateEntry(e.id, { games: v })} />
          </Field>
          <div className="pt-5">
            <Switch checked={e.isVisitor} onChange={(v) => updateEntry(e.id, { isVisitor: v })} label="Charge visitor fee" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Extra charge or discount" hint="Use a negative amount to take money off">
            <NumberField prefix={currency} allowNegative value={e.extra} onCommit={(v) => updateEntry(e.id, { extra: v })} />
          </Field>
          <Field label="What the extra is for">
            <TextField value={e.extraNote ?? ''} onCommit={(v) => updateEntry(e.id, { extraNote: v.trim() || undefined })} placeholder="e.g. water" />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <button
            className={cx('btn', e.paid && 'btn-primary')}
            onClick={() => setEntryPaid(e.id, !e.paid)}
          >
            {e.paid ? '✓ Paid' : 'Mark paid'}
          </button>
          <button className="btn btn-sm" disabled={index === 0} onClick={() => moveEntry(e.id, -1)}>
            ↑
          </button>
          <button className="btn btn-sm" disabled={index === lines.length - 1} onClick={() => moveEntry(e.id, 1)}>
            ↓
          </button>
          {e.playerId && (
            <Link to={`/players/${e.playerId}`} className="btn btn-ghost btn-sm">
              History
            </Link>
          )}
          <ConfirmButton
            className="btn-sm ml-auto"
            onConfirm={async () => {
              await removeEntry(e.id);
              onClose();
            }}
          >
            Remove
          </ConfirmButton>
        </div>
      </div>
    </Sheet>
  );
}
