/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** '1' once Google sign-in is configured in the Supabase project. */
  readonly VITE_GOOGLE_AUTH?: string;
}
