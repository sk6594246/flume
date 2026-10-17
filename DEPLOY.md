# Deploy Flume to GitHub (complete source)

The public repo https://github.com/sk6594246/flume was created and seeded with
README, package.json, routes, and a partial tree. The **full** workspace source
lives in this folder (and in `flume-source.tar.gz`).

## Push the complete source from your machine

```bash
# 1. Extract or use the project folder
cd path/to/artifacts/flume   # or: tar xzf flume-source.tar.gz

# 2. Init / link remote (if starting fresh)
git init
git remote add origin https://github.com/sk6594246/flume.git

# 3. Prefer force-sync of full tree onto main
git checkout -B main
git add -A
git status
git commit -m "Complete Flume source: studio, canvas, scripts, build config"
git push -u origin main --force
```

If the remote already has the seeded commits, `--force` overwrites with the full tree (safe for this new repo).

## Run locally

```bash
npm install
npm run dev
# http://localhost:8080
```

## Deploy to Vercel

1. https://vercel.com/new → Import `sk6594246/flume`
2. Build: `npm run build`
3. Install command is already in `vercel.json`

Auth/DB stay off unless you set env vars later.
