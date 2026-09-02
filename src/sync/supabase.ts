import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Null when the build has no Supabase credentials; the app then runs local-only. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          // "Stay signed in": the session is kept in localStorage and refreshed in the background.
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // PKCE returns ?code=… in the query string. The implicit flow uses the URL hash,
          // which would collide with HashRouter's routes.
          flowType: 'pkce',
        },
      })
    : null;

export const isSyncConfigured = supabase !== null;

/** Google sign-in is only offered once the provider is configured in Supabase. */
export const isGoogleEnabled = isSyncConfigured && import.meta.env.VITE_GOOGLE_AUTH === '1';
