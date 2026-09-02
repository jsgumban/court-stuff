import { useRef, useState } from 'react';
import { dataUrlBytes, formatBytes, resizeImage } from '../lib/image';
import type { PaymentInfo } from '../lib/types';
import { ConfirmButton } from './ConfirmButton';
import { Field, TextAreaField, TextField } from './Fields';
import { useToast } from './Toast';

/** Edits one set of payment details. Used for the Settings default and per session. */
export function PaymentEditor({
  value,
  onChange,
  idPrefix,
}: {
  value: PaymentInfo | undefined;
  onChange: (next: PaymentInfo) => void | Promise<void>;
  idPrefix: string;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pay = value ?? {};
  const patch = (p: Partial<PaymentInfo>) => onChange({ ...pay, ...p });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const qrImage = await resizeImage(file);
      await patch({ qrImage });
      toast.show('QR code saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Channel" hint="e.g. GCash, Maya, BPI">
          <TextField value={pay.channel ?? ''} onCommit={(v) => patch({ channel: v.trim() || undefined })} placeholder="GCash" />
        </Field>
        <Field label="Account name">
          <TextField value={pay.accountName ?? ''} onCommit={(v) => patch({ accountName: v.trim() || undefined })} placeholder="Juan D." />
        </Field>
        <Field label="Number" hint="Tap to copy on a shared bill">
          <TextField value={pay.accountNumber ?? ''} onCommit={(v) => patch({ accountNumber: v.trim() || undefined })} placeholder="0917 000 0000" />
        </Field>
        <Field label="Extra note">
          <TextAreaField value={pay.note ?? ''} onCommit={(v) => patch({ note: v || undefined })} placeholder="Send a screenshot after paying" rows={2} />
        </Field>
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <span className="label">QR code</span>
        {pay.qrImage ? (
          <div className="flex flex-wrap items-start gap-4">
            <img src={pay.qrImage} alt="Payment QR code" className="w-32 rounded-xl border border-line bg-white p-1.5" />
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted">Stored size {formatBytes(dataUrlBytes(pay.qrImage))}. It syncs to your other devices.</p>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
                  Replace
                </button>
                <ConfirmButton className="btn-sm" onConfirm={() => patch({ qrImage: undefined })}>
                  Remove
                </ConfirmButton>
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted">Screenshot the GCash or Maya QR, crop it to the code, and upload it. It is resized before being stored.</p>
            <button className="btn mt-2" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? 'Processing…' : 'Upload QR image'}
            </button>
          </>
        )}
        <input ref={fileRef} id={`${idPrefix}-qr`} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      </div>
    </>
  );
}
