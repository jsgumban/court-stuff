import { useState } from 'react';
import { NumberField, TextField } from './Fields';
import { cx } from '../lib/cx';
import { uid } from '../lib/id';
import type { Payable, SplitMode } from '../lib/types';

/** Common things a night gets charged for, offered as one-tap adds. */
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
  const [focusId, setFocusId] = useState<string | null>(null);
  const used = new Set(payables.map((p) => p.label.trim().toLowerCase()));

  const add = (label: string, split: SplitMode) => {
    const id = uid();
    onMutate((cur) => [...cur, { id, label, amount: 0, split }]);
    if (!label) setFocusId(id);
  };

  const set = (id: string, patch: Partial<Payable>) => onMutate((cur) => cur.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  return (
    <div className={className}>
      {payables.length > 0 && (
        <div className="space-y-2">
          {payables.map((cost) => {
            const name = cost.label.trim() || 'this';
            return (
              <div key={cost.id} className="rounded-2xl border border-line bg-surface p-3">
                <div className="flex items-center gap-2">
                  <TextField
                    className="flex-1 font-medium"
                    value={cost.label}
                    onCommit={(v) => set(cost.id, { label: v })}
                    placeholder="What was paid for?"
                    aria-label="Payable name"
                    focusOnMount={focusId === cost.id}
                  />
                  <button
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-bad"
                    aria-label={`Remove ${cost.label || 'payable'}`}
                    onClick={() => onMutate((cur) => cur.filter((c) => c.id !== cost.id))}
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <NumberField
                    className="w-28 shrink-0"
                    prefix={currency}
                    value={cost.amount}
                    onCommit={(v) => set(cost.id, { amount: v })}
                    aria-label={`${cost.label || 'Payable'} amount`}
                  />
                  <div role="group" aria-label={`How ${name} is split`} className="flex flex-1 gap-1 rounded-xl bg-surface-2 p-1">
                    {(
                      [
                        { value: 'perGame' as const, label: 'Per game', aria: `Split ${name} per game` },
                        { value: 'equal' as const, label: 'Equally', aria: `Split ${name} equally` },
                      ]
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        aria-label={opt.aria}
                        aria-pressed={cost.split === opt.value}
                        onClick={() => set(cost.id, { split: opt.value })}
                        className={cx(
                          'min-h-9 flex-1 rounded-lg px-2 text-sm font-medium transition',
                          cost.split === opt.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        className={cx(
          'flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-sm font-semibold text-muted transition hover:border-ink/40 hover:text-ink',
          payables.length ? 'mt-2' : '',
        )}
        onClick={() => add('', 'perGame')}
      >
        <span className="text-lg leading-none">＋</span> Add a payable
      </button>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted">Quick add</span>
        {PAYABLE_PRESETS.filter((p) => !used.has(p.label.toLowerCase())).map((p) => (
          <button key={p.label} className="chip border border-line hover:bg-surface-2" onClick={() => add(p.label, p.split)}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
