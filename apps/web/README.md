# Athletic department tracker (`apps/web`)

Ranks Division I schools by the average of their football, men’s basketball, and baseball ranks (postseason round, then win percentage). This app is separate from the CFB26 rankings site at the repo root.

## Run locally

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

Data comes from ESPN public APIs. Opinion edits are stored in the browser (`localStorage`).
