# P0 — Architecture & Scaffold

The layering, the repo layout, and the boundaries that keep this from becoming another organic
monolith. Grounded in `principles/structural_verification.md`: the data/pipeline side has zero web-framework deps;
the web side has zero pandas — they meet at JSON/CSV files.

## Three layers, one rule

```text
   ┌─────────────────────────────────────────────────────────┐
   │  pricing-engine        pure TypeScript · NO React        │   composePremium(layers,{T,X,ER,TM})
   │                        the ONLY place the formula lives  │     → { stack, finalPure, finalRetail, status[] }
   ├─────────────────────────────────────────────────────────┤
   │  data layer            typed readers over precomputed    │   loadCounty(fips) · loadRegime(fips) · catalogs
   │                        files (catalogs JSON, regime CSV) │
   ├─────────────────────────────────────────────────────────┤
   │  UI (Next.js app)      the two sections + the shell      │   renders the engine's output; never re-derives it
   └─────────────────────────────────────────────────────────┘
```

**The rule:** every view renders the premium from `pricing-engine`. No view recomputes the formula.
This single change retires the old dashboard's 5×-duplicated math (the documented divergence risk).
The engine never imports React; the UI never imports the math directly — it imports the engine.

## Repo layout

```text
  outage_pricing/
    price_engine/        (unchanged — the Python v0 + the OLD dashboard, to be archived at P7)
    curated_outage_data/ (unchanged)
    web/                 ◀ NEW — the Next.js app (its own package.json, node_modules, tsconfig)
      app/               routes: / (outward Pricing) · /studio (Underwriting Studio) · /settings
      components/        ui/ (shadcn, lifted from renewablesinfo) · pricing/ · studio/ · shell/ · charts/ · map/
      lib/
        pricing/         ◀ the pricing-engine module (pure, tested)
        data/            typed readers + the data contract types
      public/data/       built/copied catalogs + county_regime_T8.csv (the data layer's source)
```

`web/` mirrors the renewablesinfo structure so the recon's component layer ports directly, and keeps
the web side cleanly separated from the Python side (either half replaceable without touching the
other — structural_verification.md). Add `web/node_modules/`, `web/.next/`, `web/config.local.js` to `.gitignore` at P0.

## What we harvest vs build fresh (D1, reference-not-constraint)

```text
  HARVEST from the old dashboard      composeLocationPremium() → seed of the engine · ColorBrewer scales ·
                                      methodology drawer CONTENT · the Alachua/Bexar/Putnam spot-check values
  HARVEST from renewablesinfo (recon) shadcn Card/Button/Input/Table/Tabs/Accordion · OutputKpiTile ·
                                      theme-provider · ExploreSearch/RegionFilter/FilterSummary · sidebar layout ·
                                      oklch token palette · MapLibre cluster/popup/fitBounds pattern
  BUILD fresh                         the pricing-engine module · the two-section IA · the waterfall + comfort-strip ·
                                      ECharts components · the status-badge system · the data-layer readers
```

ECharts and MapLibre are coupled **at the leaf** (a `charts/` and `map/` component boundary) so they're
replaceable without touching pricing or view logic.

## Scaffold steps (P0 deliverable)

```text
  1. create web/ — Next.js 16 + React 19 + TS + Tailwind 4 + shadcn (new-york), next-themes
  2. port the oklch token palette + theme-provider; verify light AND dark render intentionally
  3. lift the shadcn primitives the recon listed; stand up an empty shell (sidebar + topbar, no data)
  4. add the three routes as empty pages; wire the .gitignore entries; confirm `next build` is green
  5. NO pricing yet — P1 is the engine. P0 ends when the shell renders in both themes with zero data.
```
