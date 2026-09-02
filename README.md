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

## Where the data lives

Everything is stored **only in this browser on this device**, in IndexedDB (via [Dexie](https://dexie.org)). Nothing is sent anywhere. Clearing site data or changing phones loses it, so use *Settings → Export backup* now and then.

All storage access goes through `src/db/repo.ts`. To sync across devices later, reimplement that file (or add a sync layer) against a backend; the UI and billing engine do not need to change.

## Layout

```
src/
  lib/        pure logic: types, billing.ts (the math), format.ts (money, dates, chat message), stats.ts
  db/         Dexie schema (db.ts) and repository functions (repo.ts): CRUD, backup, sample seed
  hooks/      live queries that re-render the UI when the database changes
  components/ reusable UI (fields that commit on blur, stepper, switch, toast, layout)
  pages/      Sessions, Session (the bill), Players, Player, Settings
```

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · React Router (hash routing so it works on any static host) · Dexie (IndexedDB) · Vitest
