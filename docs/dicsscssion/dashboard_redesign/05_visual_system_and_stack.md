# Visual System & Stack

The aesthetic, the tokens, the components we reuse, and the stack — anchored on the InfraSure
platform shell (D11) and the renewablesinfo web app as the concrete design-language reference
(read in the recon). References are teachers; we re-derive for our context.

## Aesthetic direction

A clean, **light-first** (and equally correct dark) card-based platform shell:

```text
  · rounded cards (rounded-xl ≈ 12px), subtle elevation, NOT borders-everywhere
  · generous whitespace groups related cards; one vibrant GREEN accent, used sparingly
  · KPI rows up top (F/Z hierarchy: the one number top-left, largest); moderate density
  · Inter / Geist (or match the InfraSure brand font); labels small + muted, values prominent
  · data leads, chrome disappears — every element earns its place (ui_design principle)
```

## Tokens & theming (both modes first-class)

- Semantic CSS variables in **oklch** (perceptually uniform): `--primary --card --muted --border
  --background --foreground --ring --destructive`. Never hardcode light/dark hex in a component.
- Domain tokens:
  - **status pills** — `active` (green dot) · `modeled` (amber/neutral) · `placeholder` (grey/hollow).
    Dot + one word; **never red** for low-confidence (red = broken).
  - **tier** — green / amber / red (semantic traffic-light, used only for tier signals).
- **Three-state** Light / System / Dark (Vercel Geist pattern), placed **once** (sidebar footer /
  settings), default System, persisted, no flash on load.
- **Map must swap with the theme:** paired light/dark MapLibre basemaps + a paired choropleth ramp,
  or the data layer breaks contrast in one mode. Chart/map internals take resolved colors
  (`hsl(var(--…))` / hex), not Tailwind classes (they don't parse Tailwind).

## Components we reuse (shadcn/Radix/Tailwind — portable to any React)

From the renewablesinfo recon — these are React + Tailwind + CVA, so they port directly:

| Piece | Adopt |
|-------|-------|
| `Card` (Header/Title/Content/Footer) | direct copy/adapt — the card spine |
| `OutputKpiTile` (label·value·unit·hint·source) | direct copy — perfect for premium KPIs |
| `Button` / `Input` / `Table` / `Tabs` / `Accordion` | direct use (shadcn, production-grade) |
| Theme provider (`next-themes` useTheme) | copy the pattern (swap if we leave Next) |
| `ExploreSearch` (debounced + clear) | adapt for address/county search |
| `RegionFilter` / `FilterSummary` | adapt for catalog/tier selector + active-filter chips |
| `ExploreSidebar` + virtualized `ExploreTable` | adapt as our sidebar + Studio tables (virtualize 100+ rows) |
| Map layer logic (cluster/dot, fitBounds, click-popup) | adapt the *pattern*; render with our map/chart libs |

Don't reinvent shadcn primitives. The old dashboard's `composeLocationPremium()`, color scales, and
methodology drawer are harvested separately (see D1).

## Charts & map

- **Map: MapLibre GL** (both the reference and the old dashboard; vector tiles, feature-state).
  Geocode via **Mapbox Geocoding v6**, token in gitignored `config.local.js` (never committed).
- **Charts (revisit D10 in light of research):** the needs are **waterfall** (factor build-up, % uplifts
  log-spaced), **100% stacked bar** (dollar split), **secondary tornado** (sensitivity), and
  **line/area + sparkline** (survival/EP curves, county trend). **Sankey is dropped** — it implies flow
  we don't have. Rendered with **ECharts** (the chosen chart lib — richer headroom than the platform's
  Recharts), wired into the Next/React shell at the leaf and themed off the oklch tokens.

## The stack — RESOLVED (D2)

```text
  Next.js 16 + React 19            ← match the platform framework (reuse + nativeness, D11)
  Tailwind 4 + shadcn/Radix + CVA  ← lift the recon's component layer almost directly
  ECharts                          ← charting headroom (NOT the platform's Recharts)
  MapLibre + @vis.gl/react-maplibre
  next-themes                      ← three-state Light/System/Dark
```

We match the platform on framework + UI layer (so the recon's `Card / KpiTile / Button / Table / Tabs /
Accordion / sidebar / theme-provider` port almost directly and we stay native to the InfraSure family),
and keep **ECharts** rather than Recharts for charting headroom — wired into the React/Next shell at the
leaf so it's replaceable, themed off the oklch tokens. Settled by Chris, 2026-06-23 (`06`/Q6).

## Avoid (from the recon)

```text
  · hardcoded light/dark hex in components → always CSS variables
  · Tailwind classes on chart/map internals → they don't parse; use hsl(var(--…))/hex
  · reinventing shadcn primitives → 30+ already exist, import them
  · >1 theme toggle → one global source of truth
  · sticky header on long tables → virtualize instead
  · any token (Mapbox/Census) in source → gitignored config only
  · mixing the old teal accent with the platform green unintentionally → pick one accent
```
