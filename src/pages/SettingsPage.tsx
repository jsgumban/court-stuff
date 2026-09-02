import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ConfirmButton } from '../components/ConfirmButton';
import { Loading } from '../components/EmptyState';
import { Field, NumberField, TextField } from '../components/Fields';
import { PaymentCard } from '../components/PaymentCard';
import { SnapshotCard } from '../components/SnapshotCard';
import { SyncCard } from '../components/SyncCard';
import { useToast } from '../components/Toast';
import { clearAll, exportBackup, importBackup, parseBackup, saveSettings, seedSample } from '../db/repo';
import { usePlayers, useSessions, useSettings } from '../hooks/useData';
import { downloadText } from '../lib/browser';
import { todayISO } from '../lib/format';
import type { Rounding, SplitMode } from '../lib/types';
import { useSync } from '../sync/engine';

export default function SettingsPage() {
  const settings = useSettings();
  const sessions = useSessions();
  const players = usePlayers();
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const syncState = useSync();
  const signedIn = !!syncState.user;

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  if (!settings || !sessions || !players) return <Loading />;
  const c = settings.currency;

  const onExport = async () => {
    const backup = await exportBackup();
    downloadText(`court-bills-backup-${todayISO()}.json`, JSON.stringify(backup, null, 2));
    toast.show('Backup downloaded');
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      await importBackup(backup, importMode);
      toast.show(`Imported ${backup.sessions.length} sessions and ${backup.players.length} players`);
      navigate('/');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Import failed', 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <SnapshotCard />
      <SyncCard />
      <PaymentCard settings={settings} />

      <section className="card p-4">
        <h2 className="font-semibold">Defaults for new sessions</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Court">
            <TextField value={settings.defaultCourt} onCommit={(v) => saveSettings({ defaultCourt: v.trim() })} />
          </Field>
          <Field label="Currency symbol">
            <TextField value={settings.currency} onCommit={(v) => saveSettings({ currency: v.trim() || '₱' })} className="w-24" />
          </Field>
          <Field label="Lights cost">
            <NumberField prefix={c} value={settings.defaultLightsCost} onCommit={(v) => saveSettings({ defaultLightsCost: v })} />
          </Field>
          <Field label="Visitor fee">
            <NumberField prefix={c} value={settings.defaultVisitorFee} onCommit={(v) => saveSettings({ defaultVisitorFee: v })} />
          </Field>
          <Field label="What the visitor fee is called" hint="Shown on the bill, e.g. “Guest fee” or “Non-member fee”">
            <TextField value={settings.visitorFeeLabel} onCommit={(v) => saveSettings({ visitorFeeLabel: v.trim() || 'Visitor fee' })} />
          </Field>
          <Field label="Players per game" hint="4 = doubles, 2 = singles. Used only for the tally sanity check.">
            <NumberField min={1} value={settings.playersPerGame} onCommit={(v) => saveSettings({ playersPerGame: Math.max(1, Math.round(v)) })} />
          </Field>
          <Field label="Split lights">
            <select className="input" value={settings.defaultLightsSplit} onChange={(e) => saveSettings({ defaultLightsSplit: e.target.value as SplitMode })}>
              <option value="perGame">Per game played</option>
              <option value="equal">Equally per person</option>
            </select>
          </Field>
          <Field label="Rounding of the rate">
            <select className="input" value={settings.defaultRounding} onChange={(e) => saveSettings({ defaultRounding: e.target.value as Rounding })}>
              <option value="exact">Exact (centavos)</option>
              <option value="peso">Nearest {c}1</option>
              <option value="five">Round up to {c}5</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">Backup &amp; restore</h2>
        <p className="mt-1 text-sm text-muted">
          {signedIn
            ? `This device holds ${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'} and ${players.length} ${players.length === 1 ? 'player' : 'players'}, mirrored to your cloud account. A JSON backup is still handy as an offline copy.`
            : `Everything is stored only in this browser on this device (${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}, ${players.length} ${players.length === 1 ? 'player' : 'players'}). Clearing site data or switching phones loses it, so export a backup now and then, or sign in above to sync.`}
        </p>
        <p className="mt-1 text-xs text-muted">
          Persistent storage: {persisted === true ? 'granted — the browser will not evict this data.' : persisted === false ? 'not granted — the browser may clear it under storage pressure.' : 'unknown on this browser.'}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" onClick={onExport}>
            Export backup (.json)
          </button>
          <div className="flex items-center gap-2 rounded-xl border border-line px-2 py-1">
            <select className="input w-auto border-0 bg-transparent py-1" value={importMode} onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}>
              <option value="merge">Merge into current data</option>
              <option value="replace">Replace everything</option>
            </select>
            <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
              Import…
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onImportFile(e.target.files?.[0])} />
          </div>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">How the bill is computed</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Add up every person's games. That is the total number of games (24 in the Malindang example).</li>
          <li>Rate per game = lights (plus any other per-game costs) ÷ total games. {c}600 ÷ 24 = {c}25.</li>
          <li>Each person pays games × rate, plus the visitor fee if marked as visitor, plus any extra on their line.</li>
          <li>Costs marked “split equally” are divided by headcount instead of games.</li>
          <li>Rounding the rate changes the collected total slightly; the session shows the over/short amount.</li>
        </ol>
        <button
          className="btn mt-3"
          onClick={async () => {
            const id = await seedSample();
            toast.show('Sample loaded');
            navigate(`/session/${id}`);
          }}
        >
          Load the Malindang 9/2/2026 sample
        </button>
      </section>

      <section className="card border-bad/30 p-4">
        <h2 className="font-semibold text-bad">Danger zone</h2>
        <p className="mt-1 text-sm text-muted">
          {signedIn
            ? 'Deletes every session, player and setting on this device and in your cloud account, so every signed-in device is wiped. Export a backup first.'
            : 'Deletes every session, player and setting on this device. Export a backup first.'}
        </p>
        <ConfirmButton
          className="mt-3"
          onConfirm={async () => {
            await clearAll(signedIn ? 'everywhere' : 'device');
            toast.show(signedIn ? 'All data deleted; the cloud copy is being cleared' : 'All local data deleted');
            navigate('/');
          }}
        >
          {signedIn ? 'Delete all data everywhere' : 'Delete all data'}
        </ConfirmButton>
      </section>
    </div>
  );
}
