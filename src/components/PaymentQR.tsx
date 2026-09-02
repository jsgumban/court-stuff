import { useState } from 'react';
import { copyText } from '../lib/browser';
import { cx } from '../lib/cx';
import { formatMoney } from '../lib/format';
import type { PaymentInfo } from '../lib/types';

export function hasPayment(p?: PaymentInfo | null): boolean {
  return !!p && !!(p.qrImage || p.channel || p.accountNumber);
}

/** How to pay: the QR to scan plus the account details, shown in the app and on a shared bill. */
export function PaymentQR({
  payment,
  amount,
  currency,
  className,
}: {
  payment: PaymentInfo;
  amount?: number;
  currency?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!hasPayment(payment)) return null;
  const title = [payment.channel, payment.accountNumber].filter(Boolean).join(' · ');

  return (
    <div className={cx('card p-4 text-center', className)}>
      <h3 className="stat-label">How to pay</h3>
      {amount !== undefined && currency && (
        <p className="num mt-0.5 text-2xl font-semibold">
          {formatMoney(amount, currency)}
        </p>
      )}
      {payment.qrImage && (
        <img
          src={payment.qrImage}
          alt={`${payment.channel || 'Payment'} QR code`}
          className="mx-auto mt-3 w-full max-w-[220px] rounded-xl border border-line bg-white p-2"
        />
      )}
      {(payment.channel || payment.accountName || payment.accountNumber) && (
        <div className="mt-3 text-sm">
          {payment.channel && <div className="font-medium">{payment.channel}</div>}
          {payment.accountName && <div className="text-muted">{payment.accountName}</div>}
          {payment.accountNumber && (
            <button
              type="button"
              className="num mt-1 inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-sm hover:bg-surface-2"
              onClick={async () => {
                if (await copyText(payment.accountNumber!)) {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1800);
                }
              }}
            >
              {payment.accountNumber}
              <span className="text-xs text-muted">{copied ? '✓ copied' : 'copy'}</span>
            </button>
          )}
        </div>
      )}
      {payment.note?.trim() && <p className="mt-2 whitespace-pre-wrap text-xs text-muted">{payment.note.trim()}</p>}
      {title && !payment.qrImage && <p className="mt-2 text-xs text-muted">No QR uploaded yet.</p>}
    </div>
  );
}
