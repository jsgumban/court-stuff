import { NumberField, TextField } from './Fields';
import { cx } from '../lib/cx';
import { uid } from '../lib/id';
import type { Payable, SplitMode } from '../lib/types';

/** Common extras, offered as one-tap adds. Nothing here is required. */
export const PAYABLE_PRESETS: { label: string; split: SplitMode }[] = [
  { label: 'Lights', split: 'perGame' },
  { label: 'Shuttlecocks', split: 'perGame' },
  { label: 'Court rental', split: 'perGame' },
  { label: 'Balls', split: 'perGame' },
  { label: 'Water', split: 'equal' },
  { label: 'Snacks', split: 'equal' },
];

/**
 * The list of things the night cost. Every row is the same kind of thing:
 * a name, an amount, and how it is divided.
 */
export function PayableList({
  payables,
  onMutate,
  currency,
  className,
}: {
  payables: Payable[];
  /** Given the current list, return the new one. Applied atomically by the caller. */
  onMutate: (mutate: (current: Payable[]) => Payable[]) => void;
  currency: string;
  className?: string;
}) {
  const used = new Set(payables.map((p) => p.label.trim().toLowerCase()));

  const add = (label: string, split: SplitMode) =>
    onMutate((cur) => [...cur, { id: uid(), label, amount: 0, split }]);

  return (
    <div className={className}>
      {payables.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-muted">
          Nothing added yet. Tap a name below, or add your own.
        </p>
      ) : (
        <div className="space-y-2">
          {payables.map((cost) => (
            <div key={cost.id} className="rounded-xl border border-line p-2.5">
              <div className="flex items-center gap-2">
                <TextField
                  className="flex-1"
                  value={cost.label}
                  onCommit={(v) => onMutate((cur) => cur.map((c) => (c.id === cost.id ? { ...c, label: v } : c)))}
                  placeholder="What for"
                  aria-label="Payable name"
                />
                <button
                  className="btn btn-ghost btn-sm shrink-0"
                  aria-label={`Remove ${cost.label || 'payable'}`}
                  onClick={() => onMutate((cur) => cur.filter((c) => c.id !== cost.id))}
                >
                  ✕
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <NumberField
                  className="flex-1"
                  prefix={currency}
                  value={cost.amount}
                  onCommit={(v) => onMutate((cur) => cur.map((c) => (c.id === cost.id ? { ...c, amount: v } : c)))}
                  aria-label={`${cost.label || 'Payable'} amount`}
                />
                <select
                  className="input w-auto shrink-0"
                  aria-label={`How ${cost.label || 'this'} is split`}
                  value={cost.split}
                  onChange={(e) => {
                    const split = e.target.value as SplitMode;
                    onMutate((cur) => cur.map((c) => (c.id === cost.id ? { ...c, split } : c)));
                  }}
                >
                  <option value="perGame">Per game</option>
                  <option value="equal">Split equally</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={cx('flex flex-wrap gap-1.5', payables.length ? 'mt-2' : 'mt-3')}>
        {PAYABLE_PRESETS.filter((p) => !used.has(p.label.toLowerCase())).map((p) => (
          <button key={p.label} className="chip border border-line hover:bg-surface-2" onClick={() => add(p.label, p.split)}>
            ＋ {p.label}
          </button>
        ))}
        <button className="chip border border-line hover:bg-surface-2" onClick={() => add('', 'perGame')}>
          ＋ Something else
        </button>
      </div>
    </div>
  );
}
