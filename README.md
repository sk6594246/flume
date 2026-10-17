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
- Nitro (Vercel preset) for production builds

## Local development

```bash
npm install
npm run dev
```

App runs at `http://localhost:8080`.

```bash
npm run build    # production build + migrations
npm run preview  # serve the build
npm run typecheck
```

## Deploy

This project is configured for **Vercel**:

1. Import the GitHub repo in the [Vercel dashboard](https://vercel.com/new)
2. Framework preset: Vite (or leave automatic)
3. Build command: `npm run build`
4. Install uses `vercel.json` (`npm install --omit=dev`)

Environment (optional):

- `VITE_AUTH_ENABLED=false` (default behaviour in the workspace)

## Project layout

```
src/
  components/flume/   # Studio UI (canvas, palette, inspector, code pane)
  lib/flume/          # Diagram types, ops, store, SVG export, templates
  routes/             # TanStack file routes
scripts/              # Build helpers, PWA plugin, migrations
public/               # Static assets
```

## License

MIT
