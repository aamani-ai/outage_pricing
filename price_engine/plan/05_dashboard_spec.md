# 05 — Dashboard Spec

> Status note: this is retained as planning history. The implemented v0 dashboard is the static no-build `../dashboard/` app: vanilla JavaScript, MapLibre, D3, and Observable Plot, reading generated CSV/JSON artifacts from `../filtration/` and `../pricing/`.

The dashboard is the v0 deliverable. The engine exists to make this view useful. Two audiences read it: the insurance team (commercial decisions) and the modeling team (data defensibility). The design serves both without making either feel patronised.

## Layout — three coordinated views

The full dashboard has three top-level views, navigable via tabs at the top:

1. **Map** — geographic entry point
2. **Matrix** — price grid per county
3. **Drill-down** — full decomposition of a single quoted price

The three are wired together: clicking a state on Map opens that state's county list, clicking a county opens its Matrix, clicking a cell opens its Drill-down.

## View 1 — Map

**Default landing screen.** Single national choropleth.

- **National view (default zoom).** States polygons. Colour = fraction of state population in Green or Amber counties. Dark green = >90%, light green = 70–90%, yellow = 40–70%, orange = 10–40%, grey = <10% (state effectively no-quote).
- **Hover on a state.** Tooltip: state name, total counties, Green count, Amber count, Red count, % population covered.
- **Click a state.** Zoom in. State boundary outlined, counties polygon-coloured by tier (Green / Amber / Red / no-data grey).
- **Hover on a county.** Tooltip: FIPS name, tier, total events, observation years, year-to-year CV, qualifying-event counts at each `T`.
- **Click a county.** Switch to Matrix view, county pre-selected.

**Legend (always visible).**
- Green: priced normally
- Amber: priced with uncertainty band
- Red: no-quote
- Grey: no data

**Controls.**
- Toggle: "Show all counties" / "Show only quotable counties" (Green + Amber).
- Filter slider: minimum events, minimum observation years (lets the modeling team explore how tier thresholds bite without editing config).

## View 2 — Matrix

The pricing grid for one county. Two axes:

- Rows: deductible `T` ∈ {2, 4, 8, 12, 24} hours
- Columns: payout `X` ∈ {$500, $1k, $2.5k, $5k, $10k}

Each cell shows the **retail annual premium** for that `(T, X)`. Cell colour-coded by tier:

| Cell content | Meaning |
|---|---|
| `$308` (green background) | Green tier, priced normally |
| `$308 ± $42` (amber background) | Amber tier, uncertainty band shown |
| `NO QUOTE` (grey, italic) | D2 failed for that `T` — too few qualifying events |
| `—` (dark grey) | Whole county is Red, no cell quoted |

**Top of matrix view.**
- County name, state, FIPS code
- Tier badge (Green / Amber / Red)
- One-line tier rationale (the diagnostic that pulls down the tier, or "all diagnostics pass")

**Bottom of matrix view.**
- "Edit deductible / payout" — opens a continuous-input form. Lets the user enter any `T` and `X` and recomputes on the fly. Always rendered at the same tier as the cell.

**Controls (top right).**
- State-level expense-ratio dial (default 25%)
- Target-margin dial (default 10%)
- Toggle: "Show pure premium" / "Show retail premium". Default retail.

The modeling team will use the toggles to interrogate the math. The insurance team will leave them at defaults.

## View 3 — Drill-down

The "click any price for a full explanation" view. Opens when a Matrix cell is clicked.

Reads the structured engine return object (see `02_pricing_math.md`) and renders it as four stacked panels:

### Panel A — The contract being priced
```
County        : Miami-Dade, FL (FIPS 12086)
State tier    : Florida (78% pop covered, Sellable)
County tier   : Green
Deductible    : 12 hours
Payout        : $2,500
```

### Panel B — Empirical inputs
```
Historical events in county     : 412
Observation window              : Jul 2018 – Jan 2026 (7.5 years)
Average customers in county     : 1,100,000
Annual event rate (county)      : 54.9 events/year
Events with duration ≥ 12h      : 21
Empirical S(12h)                : 5.10%
```

With a small "show me the events" link that opens an embedded table of all 21 qualifying historical events: start date, duration, customers-affected. This is the backtrackable layer — every viewer can verify the inputs.

### Panel C — The premium chain
```
λ per policy (T=12h)            : 0.080 events/policy-year
Pure premium                    : 0.080 × $2,500 = $200.00
Uncertainty load (v0: $0)       :                  $  0.00
Expense ratio (25%) + margin (10%):                 ÷ 0.65
─────────────────────────────────────────────────────────
Retail premium                  :                  $307.69
```

Each line has a tooltip explaining what it is and why it's there.

### Panel D — Why this tier?
```
✓ D1 Volume      : 412 events ≥ 200 (threshold for Green)
✓ D2 at T=12h    : 21 qualifying events ≥ 10 (threshold for Green cell)
✓ D3 Window      : 7.5 years ≥ 5 (threshold for Green)
✓ D4 Stability   : annual CV = 0.18 ≤ 0.5 (threshold for Green)
                   → Overall tier: Green
```

Failed diagnostics show with an ✗ and the threshold not met. This panel is what the insurance team will use to argue with regulators ("here is exactly why we believe this county is priceable") and what the modeling team will use to defend the decision.

## Two reading levels, same data

The dashboard is designed so that:

- **Insurance team at default settings** sees: map → click state → click county → read price. The drill-down's Panel A and the matrix's premium numbers are enough for a commercial conversation. Panel C is collapsed by default.
- **Modeling team** uses: filter slider on map, "show pure premium" toggle on matrix, expand Panel B's events table, expand Panel D's diagnostics. Every detail is reachable in two clicks but none of it is in the way at default.

## What v0 ships

The v0 dashboard ships as a static-site build (no auth, no server). Inputs are pre-computed CSVs in `data/`. The dashboard reads:

- `data/county_tiers.csv` — one row per FIPS
- `data/county_premiums.csv` — one row per (FIPS, T, X)
- `data/county_drilldown.json` — one entry per FIPS with all the inputs needed for Panel B and Panel D

The site re-renders whenever those files change. No backend.

This keeps v0 simple, demoable, and giftable (zip and send to anyone). A backend with login and authenticated re-pricing is a v1 question.

## Tech choices for v0

These are reasonable defaults; not yet locked.

- **Static site framework**: simple Vite + React, or HTMX + Alpine if we want to avoid a build step. Either is fine.
- **Map**: Mapbox GL or MapLibre with Census Bureau FIPS boundaries (TIGER/Line, 2023). MapLibre is free.
- **Charting**: Observable Plot or D3 for any in-panel charts.
- **Hosting**: GitHub Pages off the same repo. Public URL, free, version-controlled.

Final tech selection happens in step 5 of the build sequence (`07_build_sequence.md`).

## What the dashboard intentionally does NOT show in v0

- No portfolio aggregation (sum across multiple counties)
- No what-if simulation ("what if I write 1,000 policies in this state?")
- No competitor comparison
- No "buy now" / quote-export workflow
- No multi-line products (just per-event indemnity)

All of these are v1+ features. v0's job is to make the per-county price *understandable*, not to be a transaction system.
