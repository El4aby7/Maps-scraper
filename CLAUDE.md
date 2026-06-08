# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server (HMR)
npm run build    # Type-check (tsc -b) then production build to dist/
npm run lint     # ESLint over the repo
npm run preview  # Serve the production build locally
```

There is no test suite. The Supabase Edge Function is deployed with `supabase functions deploy scrape`; the DB schema in `supabase/migrations/001_create_schema.sql` is applied by running it in the Supabase SQL editor (not via `supabase db push`).

## Architecture

A single-page React 19 + TypeScript + Vite app ("MapExtractPro") that scrapes business listings from the Google Places API and stores results in Supabase. The frontend is a static site deployed to GitHub Pages; the actual API calls happen server-side in a Supabase Edge Function.

**Request flow:** `Dashboard` collects search params → calls `supabase.functions.invoke('scrape', ...)` → the Deno Edge Function (`supabase/functions/scrape/index.ts`) resolves coordinates, queries Google Places, persists to Postgres, and returns results → `Results` renders the table and CSV export.

**State** is a single React Context (`src/context/ScrapingContext.tsx`, `useScraping`) holding all search parameters and results — there is no other store. `App.tsx` wraps everything in `ScrapingProvider` and uses `HashRouter` (required for GitHub Pages path routing) with two routes: `/` (Dashboard) and `/results` (Results), both inside `Layout`.

**Location can be specified three ways**, resolved in this priority order by the Edge Function:
1. `bbox` — a drawn rectangle `[minLat, minLon, maxLat, maxLon]` (selection mode in `Map.tsx`)
2. `mapCenter` — `[lat, lon]` from clicking the map
3. `location` string — geocoded server-side via the Google Geocoding API

**Category determines the Google API used** (see the `isAllCategories` branch in the Edge Function):
- "All Categories" → Places **Nearby Search (New)** with a circular `locationRestriction` (capped at 20 results)
- A specific category → Places **Text Search (New)** with a rectangular restriction and pagination (up to 3 pages)

**`Map.tsx`** loads Google Maps via `@googlemaps/js-api-loader` and manages all overlays (center marker, radius circle, selection rectangle, result markers, info windows) imperatively through refs synced by `useEffect`. Selection mode disables map dragging while the user draws a bbox. Note Google Maps is loaded *twice independently* — once in the browser (`Map.tsx`, for display/geocoding) and once server-side (Edge Function, for the actual scrape).

**Database** (`scraping_sessions` + `scraped_results`, FK cascade): one session row per scrape, results keyed by `(session_id, place_id)`. RLS allows anon insert/select only (no update/delete). DB writes in the Edge Function are best-effort — a failed save is logged but still returns results to the client. Recent sessions are reloadable from the Dashboard sidebar.

## Conventions

- Styling is Tailwind with a Material Design 3 token vocabulary (`surface-container-*`, `on-surface`, `primary-container`, etc.) and Material Symbols icon fonts. Match these token names rather than raw colors when editing UI.
- Path base is `/Maps-scraper/` (`vite.config.ts`) for GitHub Pages — keep this in sync with the repo name.
- Env vars are `VITE_`-prefixed and read via `import.meta.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY`.

## Deployment

`.github/workflows/deploy.yml` builds and deploys `dist/` to GitHub Pages on push to `main`, injecting the `VITE_*` secrets at build time.

## Security note

`.env` is committed to the repo and the Google Maps / Supabase keys are also hardcoded as inline fallbacks in `Map.tsx`, the Edge Function, and `deploy.yml`. Treat these keys as public/exposed; do not add new secrets this way.
