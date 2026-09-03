import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { EmptyState, Loading } from '../components/EmptyState';
import { Stat } from '../components/Stat';
import { Switch } from '../components/Switch';
import { useToast } from '../components/Toast';
import { createPlayer } from '../db/repo';
import { usePlayers, usePlayerStats, useSettings } from '../hooks/useData';
import { cx } from '../lib/cx';
import { formatDateShort, formatMoney, pluralGames } from '../lib/format';

export default function PlayersPage() {
  const players = usePlayers();
  const stats = usePlayerStats();
  const settings = useSettings();
  const toast = useToast();
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState('');
  const [regular, setRegular] = useState(true);

  if (!players || !stats || !settings) return <Loading />;
  const c = settings.currency;

  const visible = players.filter((p) => showArchived || p.active);
  const debtors = players.filter((p) => (stats.get(p.id)?.outstanding ?? 0) > 0);
  const totalOwed = debtors.reduce((s, p) => s + (stats.get(p.id)?.outstanding ?? 0), 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createPlayer(name, regular);
    toast.show(`${name.trim()} added to the roster`);
    setName('');
    setRegular(true);
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Players</h1>
        <Switch size="sm" checked={showArchived} onChange={setShowArchived} label="Show archived" />
      </div>

      <form onSubmit={submit} className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <input className="input min-w-[10rem] flex-1" placeholder="Add to roster…" value={name} onChange={(e) => setName(e.target.value)} autoCapitalize="words" />
        <Switch size="sm" checked={regular} onChange={setRegular} label="Regular" />
        <button className="btn btn-primary" type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>

      {players.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          <Stat label="On roster" value={players.filter((p) => p.active).length} />
          <Stat label="People owing" value={debtors.length} tone={debtors.length ? 'warn' : undefined} />
          <Stat label="Total owed" value={formatMoney(totalOwed, c)} tone={totalOwed > 0 ? 'bad' : 'ok'} />
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState icon="👥" title="Nobody on the roster yet" body="People are added here automatically the first time they appear on a bill. You can also add them above." />
      ) : (
        <ul className="space-y-2">
          {visible.map((p) => {
            const s = stats.get(p.id);
            return (
              <li key={p.id}>
                <Link to={`/players/${p.id}`} className={cx('card flex items-center gap-3 p-3 transition hover:border-ink/30', !p.active && 'opacity-60')}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-semibold uppercase">{initials(p.name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{p.name}</span>
                      <span className={cx('pill', p.isRegular ? 'bg-surface-2 text-muted' : 'bg-warn-soft text-warn')}>{p.isRegular ? 'regular' : 'visitor'}</span>
                      {!p.active && <span className="pill bg-surface-2 text-muted">archived</span>}
                    </div>
                    <div className="num mt-0.5 text-xs text-muted">
                      {s ? `${s.sessions} ${s.sessions === 1 ? 'session' : 'sessions'} · ${pluralGames(s.games)} · last ${s.lastDate ? formatDateShort(s.lastDate) : '—'}` : 'No bills yet'}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    {s && s.outstanding > 0 ? (
                      <>
                        <div className="num font-semibold text-bad">{formatMoney(s.outstanding, c)}</div>
                        <div className="text-xs text-muted">unpaid · {s.unpaidLines} {s.unpaidLines === 1 ? 'bill' : 'bills'}</div>
                      </>
                    ) : s && s.billed > 0 ? (
                      <>
                        <div className="font-medium text-ok">Settled</div>
                        <div className="num text-xs text-muted">{formatMoney(s.paid, c)} paid</div>
                      </>
                    ) : (
                      <div className="text-muted">—</div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
}
