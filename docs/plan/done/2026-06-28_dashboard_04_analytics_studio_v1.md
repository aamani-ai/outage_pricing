# 04 — Analytics Studio v1 (the book, not the one)

**Status:** plan — building v1 now (free hand from Divy; review on localhost, then iterate)
**Grounds:** [`dicsscssion/analytics_studio/00`](../../dicsscssion/analytics_studio/00_purpose_and_shape.md) (purpose & shape) · recon 2026-06-28.
**Positioning:** the 4th section. Underwriting Studio = depth on ONE quote; **Analytics Studio = breadth across MANY** — what prices look like across the book, and where they're wrong/indefensible.

---

## v1 scope (locked)

Pick a **trigger T** + **payout X** → batch-price **every priced county** → three reads:

```text
  1. HEADLINE KPIs   counties priced · median premium · range (p10–p90) · excluded count
  2. RANGES          national MAP (choropleth by premium) + DISTRIBUTION (histogram + p10/p50/p90)
  3. QC / DEFEND     "never $0" assertion · Excluded list (with reasons) · Lowest-priced watch
                     (each row → jumps into the Underwriting Studio: "I know why this is low")
```

**Deferred to v2** (named in the discussion, under-specified): side-by-side comparison, published-benchmark
column, portfolio/concentration (concentration is deferred elsewhere too).

---

## Architecture decisions (from recon)

```text
  · BATCH = a server API route (/api/analytics).  pricing.json (1.3MB) · forward_factor.json (1.2MB) ·
    studio.json (5.7MB) are all SERVER-ONLY; studio.json is too big to ship. The route reads them,
    runs composePremium per county, returns ~3,000 compact rows (small payload).
  · LOCATION = 1.00 for the national batch — CORRECT: location is mean-1 within-county redistribution;
    with no specific address the county-representative premium uses 1.0. FORWARD is county-level → included.
  · ER/TM = passed from the client (quote-store loadings) as query params; default 0.20 / 0.15.
  · MAP = us-atlas counties-10m (bundled TopoJSON ~600KB) → topojson-client feature() → GeoJSON →
    MapLibre fill layer, colored by feature-state. (No web/ choropleth exists; legacy used a runtime
    GitHub fetch — we bundle instead.) FIPS join: pad feature.id to 5 chars.
  · CHARTS = existing EChart wrapper + useChartColors tokens; histogram = bar + markLine (p10/p50/p90).
```

## QC flags (fields + thresholds from recon)

```text
  EXCLUDED (shown as excluded, NEVER $0):
    quotable === false           not quotable (red tier / incomplete coverage)
    regime === "insufficient"    insufficient data — sub: short-history | low-volume | recent-change
    not in pricing.json          unpriced
  CAUTION (priced but flag):
    tier === "amber"             modelability caution
    conf === "low"               low regime confidence
    gate(T) === "caution" / small n   thin sample at this trigger
  LOW-PREMIUM WATCH: the bottom-N priced counties by premium, each with its WHY
    (λ at T · events n · tier · conf · regime) and a link into the Underwriting Studio for that county.
```

Honesty (model_to_consequence): the costly error is an under-priced / indefensible cell reaching a
carrier. v1 makes that visible: excluded counties are listed as *excluded* (not $0), and the lowest
priced are surfaced with their reason so an underwriter can say "I know why this is low."

---

## Files

```text
  NEW
    web/app/api/analytics/route.ts            batch compute (server): T,X,er,tm → rows[]
    web/app/analytics/page.tsx                route (mirror rules-engine/page.tsx)
    web/components/analytics/analytics-view.tsx   shell: controls + KPIs + grid(map,dist) + QC
    web/components/analytics/premium-map.tsx      MapLibre national choropleth
    web/components/analytics/premium-distribution.tsx  ECharts histogram + percentiles
    web/components/analytics/qc-panel.tsx          excluded list + lowest-priced watch (→ Studio)
    web/lib/analytics/types.ts                 AnalyticsRow + summary types (shared client/server)
  MODIFY
    web/components/shell/nav-config.ts         + Analytics Studio nav group (icon: BarChart3)
    web/components/shell/topbar.tsx            + titleFor /analytics
    web/package.json                           + us-atlas, topojson-client, @types/topojson-client
```

State: reuse `quote-store` for the active T/X/loadings so the Analytics controls share the session
quote (changing T/X here doesn't clobber a pinned address — Analytics is its own T/X locally, defaulting
from the store). Clicking a county in QC sets the location/county and routes to `/studio`.

---

## Out of scope / non-goals (v1)

- No address-level location in the batch (county-representative only — by design).
- No comparison table, no benchmarks, no portfolio/concentration.
- No new precomputed data artifact (compute live in the route; it's cheap — 3k × arithmetic).
- No deploy — localhost review first.

## Verify

- `npm run build` + typecheck clean; `/analytics` prerenders.
- Click-through: change T/X → map + distribution + KPIs update; QC lists excluded (not $0) + lowest
  priced; a QC row jumps into the Studio for that county. Pricing math unchanged elsewhere (17 tests green).
- Then adversarial review workflow on the diff; fix findings.
