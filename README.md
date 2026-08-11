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

## Optional password

Set `SITE_PASSWORD` in the environment. When set, `/login` gates the app.
