# Deploy Flume (Cloudflare Workers via GitHub Actions)

Vercel is **not** used. Production target is **Cloudflare Workers**.

## Secrets (GitHub repo)

| Secret | Where to get it |
|--------|------------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create (Workers Edit) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard sidebar / Workers overview |

## Workflow

File: `.github/workflows/deploy.yml`

- Trigger: push to `main` or manual `workflow_dispatch`
- Steps: checkout → `npm ci` → `npm run build` → `wrangler deploy`

## Local full push of source

If the remote tree is incomplete, from this folder:

```bash
git init
git remote add origin https://github.com/sk6594246/flume.git
git checkout -B main
git add -A
git commit -m "Flume: Cloudflare deploy + full source"
git push -u origin main --force
```

## Config files that replaced Vercel

| Removed | Added / changed |
|---------|-----------------|
| `vercel.json` | `wrangler.jsonc` |
| Nitro preset `vercel` | `@cloudflare/vite-plugin` in `vite.config.ts` |
| | `.github/workflows/deploy.yml` |
| | `npm run deploy` → build + wrangler |
