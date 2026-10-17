# Deploy Flume — GitHub Pages only

No Vercel. No Cloudflare.

## Enable Pages

1. GitHub → **sk6594246/flume** → Settings → Pages
2. Build and deployment → Source: **GitHub Actions**

## Workflow

`.github/workflows/deploy.yml` on push to `main`:

1. `npm ci`
2. `GITHUB_PAGES=true npm run build:pages`
3. Upload static output (`dist` or `.output/public`)
4. Deploy with `actions/deploy-pages`

## URL

https://sk6594246.github.io/flume/
