import { patchSettingsPayment } from '../db/repo';
import type { Settings } from '../lib/types';
import { PaymentEditor } from './PaymentEditor';

/** The default payment details new sessions start from. Each session can override them. */
export function PaymentCard({ settings }: { settings: Settings }) {
  return (
    <section className="card p-4">
      <h2 className="font-semibold">Default payment details</h2>
      <p className="mt-1 text-sm text-muted">
        Used by new sessions and by any session that has none of its own. Change who collects for one night from that session's Share screen.
      </p>
      <div className="mt-3">
        <PaymentEditor idPrefix="default" value={settings.payment} onPatch={patchSettingsPayment} />
      </div>
    </section>
  );
}
