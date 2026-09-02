# Court Bills

Local-first web app for splitting a court's night costs (lights, visitor fees, shared items) per game and tracking who has paid. Built for the way the bill is already posted in the group chat:

```
Malindang
9/2/2026

Lights = ₱600
- Total # of games = 24 games
- Lights amount/games
= ₱600/24
= ₱25 per game

1. Mc ✅
= 2 games x ₱25
= ₱50

2. Mark ✅
= (2 games x ₱25) + ₱100
= ₱150
...
```

## Live

- App: https://court-bills.vercel.app
- Code: https://github.com/jsgumban/court-bills (private)

Every push to `main` redeploys automatically on Vercel. Data still lives only in each visitor's own browser; the site itself is static.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # billing engine tests (pins the Malindang example)
npm run build      # production build in dist/
npm run preview    # serve dist/ locally
```

Open it on a phone on the same Wi-Fi with `npm run dev -- --host`. On the Sessions screen, tap **Load sample bill** to see the Malindang 9/2/2026 bill.

## What it does

- **Lights per game.** Rate = lights ÷ total games across everyone. Each person pays games × rate. Visitors get the visitor fee added. Extras (water, shuttles, a discount) can be added per line.
- **Paid tracking.** Tap *Mark paid* per person; the summary shows collected vs. unpaid, and the announcement puts ✅ next to paid names.
- **Copy / Share announcement.** One tap copies the message in the group-chat format above (or opens the phone's share sheet).
- **Quick roster.** Names are remembered. Chips add regulars in one tap; *All regulars* and *Same people as last session* fill a new night instantly. *Duplicate for today* clones a session's people and costs.
- **Other shared costs.** Shuttlecocks, balls, court rental… each split per game (like lights) or equally per head.
- **Rounding.** Exact centavos, nearest ₱1, or round up to ₱5, with the over/short amount shown so the collector is never surprised.
- **Sanity check.** Warns when the tally is not a whole number of doubles matches (24 slots = 6 matches; 23 slots is a typo).
- **Players.** Per-person history, running debts across sessions, settle-all, merge duplicate spellings, archive.
- **Backup & restore.** Export/import a JSON file. The app also asks the browser for persistent storage.
- Mobile-first, dark mode, installable (web manifest).

## Cloud sync (Supabase)

The app is local-first: every screen reads and writes the on-device database, so it works offline at the court. When Supabase credentials are present and you are signed in, a sync engine mirrors that database to your account:

Signing in is required: the app shows a login screen until there is a session, and the route you asked for is preserved through login. Sessions persist across restarts and refresh silently. Password reset and (once configured) Google sign-in use the PKCE flow, which returns `?code=` in the query string rather than the URL hash, so it does not collide with hash routing.

- Local edits are flagged and uploaded in the background (a few hundred ms after you stop typing). Deletions are uploaded as tombstones.
- Remote changes are pulled on start, when the tab regains focus, when the network comes back, every two minutes, and instantly via Supabase Realtime when another device writes.
- Conflicts resolve last-write-wins by timestamp; the database trigger refuses to overwrite a newer row with an older one.
- Signing in on a device that already has data uploads that data. Signing in as a different account wipes the device first.

### This deployment

Already provisioned: Supabase project `court-bills` (region ap-southeast-1), schema applied from `supabase/migrations/`, and `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` set in all three Vercel environments. Create your account from Settings → Cloud sync in the app.

Email confirmation is off (`supabase/config.toml`), so sign-up works without waiting for mail. Since anyone could otherwise register, turn sign-ups off once your account exists: set `enable_signup = false` under `[auth]` and `[auth.email]`, then run `npx supabase config push`.

### Google sign-in

The button appears only when `VITE_GOOGLE_AUTH=1`, because the provider must exist first:

1. In Google Cloud Console create an OAuth client (type: Web application) with the authorised redirect URI `https://rmprsarnsefnecbpxhlh.supabase.co/auth/v1/callback`.
2. Put the client id and secret under `[auth.external.google]` in `supabase/config.toml` (read them from env vars, never commit the secret), then `npx supabase config push`.
3. Set `VITE_GOOGLE_AUTH=1` in the Vercel environment and redeploy.

### Setting this up elsewhere

1. Create a Supabase project, open the SQL editor, and run `supabase/schema.sql` (idempotent).
2. Keep the Email provider enabled. Either allow one sign-up and then disable it, or create the user under Authentication → Users.
3. Copy the project URL and publishable (anon) key from Project Settings → API into `.env.local` (see `.env.example`) and into your host's environment variables, then redeploy.

## Where the data lives

Locally: IndexedDB (via [Dexie](https://dexie.org)) in the browser profile of each device. Without sync configured, nothing leaves the device, so use *Settings → Export backup* now and then.

With sync: a single `sync_rows` table in your Supabase project holds each collection's rows as JSON, protected by Row Level Security so only your account can read them.

All local writes go through `src/db/repo.ts`; all cloud traffic goes through `src/sync/engine.ts`.

## Layout

```
src/
  lib/        pure logic: types, billing.ts (the math), format.ts (money, dates, chat message), stats.ts
  db/         Dexie schema (db.ts) and repository functions (repo.ts): CRUD, backup, sample seed
  sync/       Supabase client, sync engine (push/pull/realtime/auth), merge rules with tests
supabase/     schema.sql to run once in the Supabase SQL editor
  hooks/      live queries that re-render the UI when the database changes
  components/ reusable UI (fields that commit on blur, stepper, switch, toast, layout)
  pages/      Sessions, Session (the bill), Players, Player, Settings
```

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · React Router (hash routing so it works on any static host) · Dexie (IndexedDB) · Supabase (auth, Postgres, Realtime) · Vitest
