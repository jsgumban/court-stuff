# Court Stuff

Everything for the court, in one repo. Each app under `apps/` is self-contained:
its own dependencies, its own build, its own deploy.

## Apps

| App | What it is | Local dev |
| --- | --- | --- |
| [`apps/court-bills`](apps/court-bills) | Splits a court night's costs per game and tracks who has paid. Local-first, with optional Supabase sync. | `cd apps/court-bills && npm install && npm run dev` |

More to come (match maker, etc.) — add each as a new directory under `apps/`.

## Layout

```
court-stuff/
├── README.md
├── .gitignore
└── apps/
    └── court-bills/     # React + Vite + Dexie, deployed on Vercel
```

Apps are deliberately *not* an npm workspace. Each keeps its own `package.json`
and lockfile so it builds standalone on its host, and so one app's dependency
bump can't break another. Install per app.

## Adding an app

```bash
mkdir -p apps/<name>
# scaffold it, commit it. No root wiring needed.
```

## Environment

Secrets live in per-app `.env.local` files, which are gitignored and never
committed. `apps/court-bills` pulls its Supabase credentials from Vercel:

```bash
cd apps/court-bills
npx vercel link
npx vercel env pull .env.local
```
