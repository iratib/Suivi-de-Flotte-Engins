# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (via tsx server.ts)
npm run build     # Vite production build → dist/
npm run preview   # Preview production build locally
npm run lint      # TypeScript type-check (tsc --noEmit)
npm run clean     # Remove dist/
```

## Architecture

Single-page React app. All application logic lives in **src/App.tsx** — there are no other components or routes.

### Data Flow

- **Read**: Google Sheets gviz/tq API (public, no auth, ~2–5 min cache delay)
  - `URL_FLOTTE` → `Feuil1` sheet (fleet data)
  - `URL_HISTORY` → `Historique` sheet (action log)
  - Response is JSONP-wrapped; parsed by `parseGviz()` which strips the `google.visualization.Query.setResponse(...)` wrapper
- **Write**: Google Apps Script web app (`APPS_SCRIPT_URL`)
  - `doPost` handles add/edit — sends JSON body with `action`, `sheet: 'Feuille 1'`, row data
  - `doGet` handles retire/restore — GET with URL params: `?action=retire|restore&sheet=Feuille%201&rowIndex=N`
  - All fetches use `mode: 'no-cors'` (responses are opaque — errors are invisible)
  - Note: the main sheet is named **"Feuille 1"** (with space and space after) in Apps Script calls, but the gviz URL uses **`sheet=Feuil1`** (without the space/accent) — these are different identifiers

### gviz Cache Workaround

Because the gviz API caches for 2–5 minutes, optimistic UI updates use a `useRef<Map<number, string>>` called `statutOverrides`. After retire/restore actions, the override is written into this map and re-applied on every `fetchData()` call so the local state never reverts to the stale sheet value.

### Key State

| State | Purpose |
|---|---|
| `data` | All fleet rows (both active and retired) |
| `statutOverrides` | Ref map: rowIndex → statut override (persists across re-fetches) |
| `activeData` | `data` filtered to `statut !== 'Retiré'` |
| `retiredData` | `data` filtered to `statut === 'Retiré'` |
| `historyData` | Rows from Historique sheet |
| `activeTab` | `'flotte' | 'historique' | 'dashboard' | 'stats' | 'outofparc'` |
| `userRole` | `'admin' | 'viewer'` — admin unlocks add/edit/delete buttons |

### Date Handling

gviz returns dates as `Date(year, month_0indexed, day, hour, minute, second)`. The `formatDate()` helper parses this and adds 1 to the month. It also strips seconds from Apps Script timestamp strings (`dd/MM/yyyy HH:mm:ss` → `dd/MM/yyyy HH:mm`).

### Deployment

- `vite.config.ts` sets `base: '/Suivi-de-Flotte-Engins/'` for GitHub Pages
- Static assets in `public/` must be referenced as `${import.meta.env.BASE_URL}path` (not `/path`)
- GitHub Actions (`.github/workflows/deploy.yml`) auto-deploys on push to `main` via `peaceiris/actions-gh-pages@v3`
- Live URL: `https://iratib.github.io/Suivi-de-Flotte-Engins/`

### Environment

- `GEMINI_API_KEY` — injected via `process.env.GEMINI_API_KEY` in vite config; set as a GitHub Actions secret for CI builds
