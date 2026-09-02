# New site (`apps/web`)

Separate Next.js app in the CFB26 repo. It is not the rankings webapp.

## Run locally

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001). Rankings continue to use port 3000 from the repo root.

## Deploy without replacing rankings

1. In Vercel, **Add New → Project** and import this same GitHub repository.
2. Set **Root Directory** to `apps/web`.
3. Deploy.

Leave the existing rankings Vercel project’s Root Directory at the repository root.
