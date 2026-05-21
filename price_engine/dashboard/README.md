# v0 Dashboard

Static dashboard for the v0 price engine — no build step, no backend.

## Files

```
dashboard/
├── index.html    page shell, sidebar, three views
├── styles.css    design tokens, sidebar/header/main grid, cards
├── app.js        single-file vanilla JS (ES modules)
└── README.md     this file
```

## Stack

- **IBM Plex Sans / Plex Mono** (Google Fonts) — instrument-feel typography, mono for all data
- **MapLibre GL** + CARTO basemap tiles (light/dark following theme)
- **D3 v7** — color scales and CSV parsing
- **Observable Plot** — duration histogram and survival S(T) chart
- **CSS Grid** — full-viewport dashboard layout (single scroll region in `.main`)
- **No build step** — every dependency loads from CDN

## What it reads

```
../catalogs/manifest.json                         available event catalogs
../catalogs/<catalog>/pricing/county_drilldown.json   per-FIPS dict
../catalogs/<catalog>/filtration/county_tiers.csv     tier diagnostics
../catalogs/<catalog>/pricing/event_evidence/{FIPS}.json
                                                     compact per-county event evidence
```

Catalogs are produced by `run_catalogs.sh` upstream. If the manifest is absent,
the dashboard falls back to the single `../pricing/` and `../filtration/`
artifact set from `run_all.sh`.

## How to run

```bash
cd price_engine/dashboard
python -m http.server 8000
# open http://localhost:8000
```

## Layout

- **Sidebar** (always visible): brand, view nav, event catalog selector, coverage stats, tier mix bar, search box, theme toggle
- **Header** (sticky): breadcrumbs + view tabs
- **Main**: one of three views

### Views

1. **Map** — choropleth of US counties. Color by tier (default), λ(T=8h), retail premium at T=8h/X=$2.5k, or total historical event evidence. Filters: quotable-only toggle, min events, min observation years. Hover for full tooltip; click to open the Matrix for that county.

2. **Matrix** — T (rows) × X (cols) premium grid for the selected county. Cell colour = tier. Sliders for expense ratio + target margin recompute retail premium live. Toggle pure / retail. Right of the matrix: duration distribution (Plot) and survival S(T) curve (Plot). The bottom Event Evidence card fetches one county evidence file on demand and shows the top historical events with selected-contract payout and pure-premium contribution columns.

3. **Drill-down** — four cards: A contract, B empirical inputs, C premium chain, D five tier diagnostics with pass/warn/fail iconography.

## Theming

Light/dark mode following `prefers-color-scheme`, with a manual toggle in the sidebar footer. Map tiles, charts, and all UI swap colour tokens together. No localStorage — preference resets per session (sandboxed iframe constraint).

## What's stubbed in v0

- Uncertainty load is $0 (interface only).
- DQI scale: file values 0-100 are normalized to 0-1 in aggregate; thresholds in `04_filter.py` may need refinement once the actual distribution is reviewed.
- County GeoJSON is loaded from a public CDN (Plotly's TIGER 2018 simplification). For production, drop a higher-resolution local file and update the URL in `app.js`.
