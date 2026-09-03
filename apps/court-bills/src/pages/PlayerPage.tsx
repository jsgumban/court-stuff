import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ConfirmButton } from '../components/ConfirmButton';
import { Loading } from '../components/EmptyState';
import { Field, TextAreaField, TextField } from '../components/Fields';
import { Money } from '../components/Money';
import { Stat } from '../components/Stat';
import { Switch } from '../components/Switch';
import { useToast } from '../components/Toast';
import { deletePlayer, mergePlayers, setEntryPaid, updatePlayer } from '../db/repo';
import { usePlayer, usePlayerHistory, usePlayers, useSettings } from '../hooks/useData';
import { cx } from '../lib/cx';
import { formatDateShort, formatMoney } from '../lib/format';
import NotFound from './NotFound';

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const player = usePlayer(id);
  const history = usePlayerHistory(id);
  const players = usePlayers();
  const settings = useSettings();
  const [mergeInto, setMergeInto] = useState('');

  if (player === undefined || !history || !settings || !players) return <Loading />;
  if (player === null) return <NotFound what="player" />;
  const c = settings.currency;

  const sessions = new Set(history.map((h) => h.session.id)).size;
  const games = history.reduce((s, h) => s + h.line.entry.games, 0);
  const paid = history.filter((h) => h.line.entry.paid).reduce((s, h) => s + h.line.total, 0);
  const unpaid = history.filter((h) => !h.line.entry.paid);
  const outstanding = unpaid.reduce((s, h) => s + h.line.total, 0);

  const settleAll = async () => {
    await Promise.all(unpaid.map((h) => setEntryPaid(h.line.entry.id, true)));
    toast.show(`${player.name} is fully settled`);
  };
  const onMerge = async () => {
    const target = players.find((p) => p.id === mergeInto);
    if (!target) return;
    await mergePlayers(player.id, target.id);
    toast.show(`Merged into ${target.name}`);
    navigate(`/players/${target.id}`);
  };
  const onDelete = async () => {
    await deletePlayer(player.id);
    toast.show('Removed from roster');
    navigate('/players');
  };

  return (
    <div className="space-y-4">
      <Link to="/players" className="btn btn-ghost btn-sm -ml-2">
        ← Players
      </Link>

      <section className="card p-4">
        <Field label="Name">
          <TextField className="text-lg font-semibold" value={player.name} onCommit={(v) => v.trim() && updatePlayer(player.id, { name: v.trim() })} />
        </Field>
        <div className="mt-3 flex flex-wrap gap-4">
          <Switch checked={player.isRegular} onChange={(v) => updatePlayer(player.id, { isRegular: v })} label={player.isRegular ? 'Regular (no visitor fee)' : 'Visitor (pays visitor fee)'} />
          <Switch checked={player.active} onChange={(v) => updatePlayer(player.id, { active: v })} label={player.active ? 'Active' : 'Archived'} />
        </div>
        <Field label="Notes" className="mt-3">
          <TextAreaField value={player.notes ?? ''} onCommit={(v) => updatePlayer(player.id, { notes: v || undefined })} placeholder="Phone, GCash, anything useful" />
        </Field>
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Sessions" value={sessions} />
        <Stat label="Games" value={games} />
        <Stat label="Paid" value={formatMoney(paid, c)} tone="ok" />
        <Stat label="Unpaid" value={formatMoney(outstanding, c)} tone={outstanding > 0 ? 'bad' : 'ok'} />
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-semibold">History</h2>
          {unpaid.length > 0 && (
            <button className="btn btn-sm" onClick={settleAll}>
              Mark all {unpaid.length} paid
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted">No bills yet.</p>
        ) : (
          <ul className="space-y-2">
            {history.map(({ session, line }) => (
              <li key={line.entry.id} className={cx('card flex items-center gap-3 p-3', line.entry.paid && 'border-ok/30')}>
                <div className="min-w-0 flex-1">
                  <Link to={`/session/${session.id}`} className="font-medium hover:underline">
                    {formatDateShort(session.date)} · {session.court}
                  </Link>
                  <div className="num mt-0.5 text-xs text-muted">
                    {line.entry.label !== player.name && <span>as “{line.entry.label}” · </span>}
                    {line.entry.games} {line.entry.games === 1 ? 'game' : 'games'}
                    {line.visitorFee ? ` · visitor fee ${formatMoney(line.visitorFee, c)}` : ''}
                    {line.extra ? ` · extra ${formatMoney(line.extra, c)}` : ''}
                  </div>
                </div>
                <Money value={line.total} currency={c} className="font-semibold" />
                <button
                  type="button"
                  onClick={() => setEntryPaid(line.entry.id, !line.entry.paid)}
                  className={cx('chip border', line.entry.paid ? 'border-ok/30 bg-ok-soft text-ok' : 'border-line text-muted hover:border-ink hover:text-ink')}
                >
                  {line.entry.paid ? '✓ Paid' : 'Mark paid'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">Roster tools</h2>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field label="Merge this person into" className="flex-1 min-w-[12rem]" hint="Use when the same person was added twice under different spellings. Their bills move over; this name is removed.">
            <select className="input" value={mergeInto} onChange={(e) => setMergeInto(e.target.value)}>
              <option value="">Choose…</option>
              {players
                .filter((p) => p.id !== player.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </Field>
          <ConfirmButton className="mb-5" disabled={!mergeInto} onConfirm={onMerge} confirmLabel="Tap again to merge">
            Merge
          </ConfirmButton>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-3">
          <p className="text-xs text-muted">Removing keeps past bill lines under this name but unlinks them from the roster.</p>
          <ConfirmButton className="btn-sm shrink-0" onConfirm={onDelete}>
            Remove from roster
          </ConfirmButton>
        </div>
      </section>
    </div>
  );
}
