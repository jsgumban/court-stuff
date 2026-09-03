import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Loading } from '../components/EmptyState';
import { Field } from '../components/Fields';
import { PayableList } from '../components/PayableList';
import { useToast } from '../components/Toast';
import { createSessionWithPeople, parseNames, type NewSessionPerson } from '../db/repo';
import { useEntries, usePlayers, useSessions, useSettings } from '../hooks/useData';
import { cx } from '../lib/cx';
import { formatDateShort, todayISO } from '../lib/format';
import { uid } from '../lib/id';
import type { Payable } from '../lib/types';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Setting up a night used to mean creating a session and then adding each person
 * one at a time. This does the whole thing in two short steps.
 */
export default function NewSessionPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const settings = useSettings();
  const sessions = useSessions();
  const players = usePlayers();
  const previous = sessions?.[0];
  const previousEntries = useEntries(previous?.id);

  const [step, setStep] = useState<1 | 2>(1);
  const [court, setCourt] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [payables, setPayables] = useState<Payable[] | null>(null);
  const [picked, setPicked] = useState<NewSessionPerson[]>([]);
  const [namesText, setNamesText] = useState('');
  const [busy, setBusy] = useState(false);

  const recentCourts = useMemo(() => [...new Set((sessions ?? []).map((s) => s.court).filter(Boolean))].slice(0, 5), [sessions]);


  if (!settings || !sessions || !players) return <Loading />;

  const courtValue = court ?? settings.defaultCourt ?? '';
  const payableValue = payables ?? (settings.defaultPayables ?? []).map((p) => ({ ...p, id: uid() }));
  const c = settings.currency;

  const pickedKeys = new Set(picked.map((p) => p.playerId ?? norm(p.name)));
  const roster = players.filter((p) => p.active && !pickedKeys.has(p.id));
  const regulars = roster.filter((p) => p.isRegular);

  const add = (people: NewSessionPerson[]) => {
    setPicked((cur) => {
      const keys = new Set(cur.map((p) => p.playerId ?? norm(p.name)));
      const next = [...cur];
      for (const p of people) {
        const key = p.playerId ?? norm(p.name);
        if (keys.has(key)) continue;
        keys.add(key);
        next.push(p);
      }
      return next;
    });
  };

  const addTyped = (e?: FormEvent) => {
    e?.preventDefault();
    const names = parseNames(namesText);
    if (!names.length) return;
    add(
      names.map((name) => {
        const match = players.find((p) => norm(p.name) === norm(name));
        return { name: match?.name ?? name, playerId: match?.id, isVisitor: match ? !match.isRegular : false };
      }),
    );
    setNamesText('');
  };

  const start = async () => {
    setBusy(true);
    try {
      const id = await createSessionWithPeople(
        { court: courtValue.trim() || settings.defaultCourt, date, payables: payableValue },
        picked,
      );
      toast.show(picked.length ? `Session started with ${picked.length} ${picked.length === 1 ? 'person' : 'people'}` : 'Session started');
      navigate(`/session/${id}`, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button className="btn btn-ghost btn-sm -ml-2" onClick={() => (step === 1 ? navigate('/') : setStep(1))}>
          ← {step === 1 ? 'Sessions' : 'Back'}
        </button>
        <span className="text-xs text-muted">Step {step} of 2</span>
      </div>

      {step === 1 ? (
        <>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tonight's court</h1>
            <p className="mt-1 text-sm text-muted">Where you played and what it cost, then who was there.</p>
          </div>

          <section className="card space-y-4 p-4">
            <Field label="Court">
              <input
                className="input text-lg font-semibold"
                value={courtValue}
                onChange={(e) => setCourt(e.target.value)}
                placeholder="Court name"
                autoCapitalize="words"
              />
              {recentCourts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recentCourts.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={cx('chip border', norm(name) === norm(courtValue) ? 'border-accent bg-accent text-accent-fg' : 'border-line hover:bg-surface-2')}
                      onClick={() => setCourt(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </Field>

            <Field label="Date">
              <input type="date" className="input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </Field>

            <div>
              <span className="label">What was paid for</span>
              <p className="mb-2 text-xs text-muted">Lights, shuttlecocks, court rental, anything. Each one splits its own way.</p>
              <PayableList payables={payableValue} onMutate={(mutate) => setPayables((cur) => mutate(cur ?? payableValue))} currency={c} />
            </div>
          </section>

          <button className="btn btn-primary w-full" onClick={() => setStep(2)}>
            Next: who played
          </button>
        </>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Who played?</h1>
            <p className="mt-1 text-sm text-muted">Tap the names. Everyone starts at one game and you adjust as you tally.</p>
          </div>

          {/* One-tap fills */}
          <div className="flex flex-wrap gap-1.5">
            {previous && previousEntries && previousEntries.length > 0 && (
              <button
                className="chip bg-surface-2 font-semibold hover:bg-line"
                onClick={() =>
                  add(previousEntries.map((e) => ({ name: e.label, playerId: e.playerId, isVisitor: e.isVisitor })))
                }
              >
                ＋ Same as {formatDateShort(previous.date)} ({previousEntries.length})
              </button>
            )}
            {regulars.length > 0 && (
              <button
                className="chip bg-surface-2 font-semibold hover:bg-line"
                onClick={() => add(regulars.map((p) => ({ name: p.name, playerId: p.id, isVisitor: false })))}
              >
                ＋ All regulars ({regulars.length})
              </button>
            )}
            {picked.length > 0 && (
              <button className="chip border border-line hover:bg-surface-2" onClick={() => setPicked([])}>
                Clear
              </button>
            )}
          </div>

          {/* Type or paste, one or many */}
          <form onSubmit={addTyped} className="card p-3">
            <textarea
              className="input resize-y"
              rows={2}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              placeholder="Type a name, or paste a list: Mc, Mark, Daryll…"
              autoCapitalize="words"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-muted">Commas or new lines both work.</span>
              <button className="btn btn-primary btn-sm" type="submit" disabled={!namesText.trim()}>
                Add {parseNames(namesText).length > 1 ? `${parseNames(namesText).length} names` : 'name'}
              </button>
            </div>
          </form>

          {picked.length > 0 && (
            <section>
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">Playing tonight ({picked.length})</h2>
              <div className="flex flex-wrap gap-1.5">
                {picked.map((p) => (
                  <button
                    key={p.playerId ?? norm(p.name)}
                    className="chip border border-accent bg-accent text-accent-fg"
                    onClick={() => setPicked((cur) => cur.filter((x) => (x.playerId ?? norm(x.name)) !== (p.playerId ?? norm(p.name))))}
                  >
                    {p.name}
                    {p.isVisitor && <span className="opacity-70">visitor</span>}
                    <span className="opacity-70">✕</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {roster.length > 0 && (
            <section>
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">From your roster</h2>
              <div className="flex flex-wrap gap-1.5">
                {roster.map((p) => (
                  <button
                    key={p.id}
                    className="chip border border-line hover:bg-surface-2"
                    onClick={() => add([{ name: p.name, playerId: p.id, isVisitor: !p.isRegular }])}
                  >
                    ＋ {p.name}
                    {!p.isRegular && <span className="text-warn">visitor</span>}
                  </button>
                ))}
              </div>
            </section>
          )}

          {players.length === 0 && picked.length === 0 && (
            <p className="px-1 text-sm text-muted">
              Your roster is empty. Type the names above and they are remembered for next time.
            </p>
          )}

          <div className="sticky bottom-20 md:bottom-4">
            <button className="btn btn-primary w-full shadow-lg" onClick={start} disabled={busy}>
              {busy ? 'Starting…' : picked.length ? `Start session · ${picked.length} ${picked.length === 1 ? 'person' : 'people'}` : 'Start empty session'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
