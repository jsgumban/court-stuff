import type { PaymentInfo, Session, Settings } from './types';

/**
 * Payment details for one night: whatever the session carries, otherwise the
 * default from Settings. Existing sessions created before per-session payment
 * simply fall through to the default.
 */
export function resolvePayment(session: Pick<Session, 'payment'>, settings: Pick<Settings, 'payment'>): PaymentInfo | undefined {
  const p = session.payment;
  if (p && (p.qrImage || p.channel || p.accountNumber || p.accountName || p.note)) return p;
  return settings.payment;
}

export function isPaymentSet(p?: PaymentInfo | null): boolean {
  return !!p && !!(p.qrImage || p.channel || p.accountNumber || p.accountName || p.note);
}
