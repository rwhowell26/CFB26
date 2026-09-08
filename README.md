# CFB26

Private personal ranking workspace for all 138 FBS teams in the 2026 season.

## Features

- Drag-and-drop weekly ballot (unique ranks, no ties)
- Fresh start each week, with saved historical snapshots
- Auto-updating schedules/scores via ESPN
- Games played resume with home/away/neutral and your opponent ranks
- FCS opponents shown as FCS (no rank)
- SOS for games played and remaining
- Compare two team resumes
- History tab + team rank-by-week trajectory
- Philosophy checks: sit behind teams you lost to, undefeated rarely behind losses, winless sink
- Optional site password (`SITE_PASSWORD`)
- Rankings stored privately in your browser (export/import JSON backup)

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Second Vercel site

`apps/web` is a separate Next.js app. It does not share routes, env vars, or the production domain of the rankings site.

To put it online without replacing rankings:

1. In Vercel, **Add New → Project** and import this same GitHub repository.
2. Set **Root Directory** to `apps/web`.
3. Deploy.

Leave the existing rankings project's Root Directory at the repository root. Run the new app locally with `cd apps/web && npm run dev` (port 3001).

## Optional password

Set `SITE_PASSWORD` in the environment. When set, `/login` gates the app.
