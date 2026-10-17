# Flume

Visual flowchart / process-diagram studio.

## Stack

- React 19 + TypeScript
- TanStack React Router + TanStack Start
- Vite 8 + Tailwind CSS 4
- **GitHub Pages** (no Vercel, no Cloudflare)

## Local development

```bash
npm install
npm run dev
```

http://localhost:8080

```bash
npm run build
npm run preview
```

## Deploy (GitHub Actions → GitHub Pages)

Workflow: `.github/workflows/deploy.yml`

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. Push to `main` (or run the workflow manually)
3. Site: https://sk6594246.github.io/flume/

Build uses `base: /flume/` when `GITHUB_PAGES=true`.

## License

MIT
