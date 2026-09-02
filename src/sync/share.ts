import type { Entry, Session } from '../lib/types';
import { supabase } from './supabase';

export interface SharedBill {
  session: Session;
  entries: Entry[];
  display: { currency: string; visitorFeeLabel: string; playersPerGame: number };
  sharedAt: string;
}

/** 22 URL-safe characters: unguessable, but short enough to paste in a chat. */
function makeToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function shareUrl(token: string): string {
  return `${window.location.origin}${window.location.pathname}#/s/${token}`;
}

/** The existing token for this session, or null when it is not shared. */
export async function getShareToken(sessionId: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('session_shares').select('token').eq('session_id', sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.token ?? null;
}

/** Creates the link, or returns the one that already exists so it stays stable. */
export async function createShare(sessionId: string): Promise<string> {
  if (!supabase) throw new Error('Sharing needs cloud sync');
  const existing = await getShareToken(sessionId);
  if (existing) return existing;
  const token = makeToken();
  const { error } = await supabase.from('session_shares').insert({ token, session_id: sessionId });
  if (error) throw new Error(error.message);
  return token;
}

export async function revokeShare(sessionId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('session_shares').delete().eq('session_id', sessionId);
  if (error) throw new Error(error.message);
}

/** Public read. Returns null when the link was revoked or the session is gone. */
export async function fetchSharedBill(token: string): Promise<SharedBill | null> {
  if (!supabase) throw new Error('Sharing needs cloud sync');
  const { data, error } = await supabase.rpc('get_shared_session', { share_token: token });
  if (error) throw new Error(error.message);
  const bill = data as SharedBill | null;
  if (!bill || !bill.session) return null;
  return { ...bill, entries: bill.entries ?? [] };
}
