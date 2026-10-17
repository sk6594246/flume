# Flume

Visual flowchart / process-diagram studio.

Build process maps with lanes, typed nodes and edges, then export SVG or inspect the serialized script.

## Features

- Canvas with horizontal or vertical lanes
- Node kinds: start, end, process, decision, data, document, subprocess, database, manual, delay, note, parallel
- Edge kinds: sequence, message, conditional, default, association, async
- Palette, inspector, code pane, SVG export, templates
- Undo / redo, zoom, pan, keyboard shortcuts
- Auth and database optional (off by default)

## Stack

- React 19 + TypeScript
- TanStack React Router + TanStack Start
- Vite 8 + Tailwind CSS 4
- **Cloudflare Workers** (`@cloudflare/vite-plugin` + Wrangler)

## Local development

```bash
npm install
npm run dev
```

App runs at `http://localhost:8080`.

```bash
npm run build
npm run preview
npm run typecheck
```

## Deploy (GitHub Actions → Cloudflare Workers)

On every push to `main`, `.github/workflows/deploy.yml` builds and deploys with Wrangler.

### One-time setup

1. Cloudflare dashboard → create API token (Edit Cloudflare Workers)
2. GitHub repo → **Settings → Secrets and variables → Actions**
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. Push to `main` (or run the workflow manually)

Manual deploy:

```bash
npm run deploy
```

## Project layout

```
src/components/flume/   # Studio UI
src/lib/flume/          # Diagram types, ops, store, SVG export
.github/workflows/deploy.yml
wrangler.jsonc
```

## License

MIT
