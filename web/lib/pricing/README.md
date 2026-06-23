# Pricing Engine

The **one place** the premium formula lives. Every view (outward Pricing, Underwriting Studio)
renders from this; no view re-derives the math. Pure TypeScript — no React, no DOM, no I/O.

```
  premium = λ_customer(T) × location_relativity × forward_factor × X ÷ (1 − ER − TM)
```

## API

```ts
import { composePremium, renormalizeMeanOne } from '@/lib/pricing';

composePremium(
  { baseline: { lambdaCustomer: 0.063, rateBand: { low: 0.05, high: 0.08 }, status: 'active' },
    location: { relativity: 1.0, status: 'placeholder' },   // optional → defaults to neutral 1.0
    forward:  { factor: 1.0, status: 'placeholder' } },     // optional → defaults to neutral 1.0
  { T: 8, X: 2500, expenseRatio: 0.20, targetMargin: 0.15 },
) // → { premium: { low, point, high }, bandDriver, adjustedRate, pure, denom, steps, ...layers }
```

- **The headline is `premium.point`; the range is `premium.{low,high}`** — the precomputed rate band
  (year-based bootstrap, A017) carried linearly through the same factors. No `rateBand` → band
  collapses to the point (`bandDriver: 'none'`).
- **`renormalizeMeanOne(values, weights?)`** is the grid double-count firewall: it rescales a
  county's exposure scores so their (weighted) mean is exactly 1, so location relativities can only
  *redistribute* risk inside a county, never change the county total.
- **Fail loud** — bad inputs (ER+TM ≥ 1, non-finite/negative λ, X ≤ 0, a band that doesn't bracket
  the point) **throw**; the engine never invents a number.

## Tests

`npm test` (vitest). The canaries (`compose.test.ts`) anchor on **live catalog** values from
`price_engine/catalogs/eagle-i-45min/pricing/per_customer_view.json` (the `default_catalog`, mean):

```
  Alachua FL · T=4h · X=$500  → retail ≈ $78.76
  Alachua FL · T=8h · X=$2500 → retail ≈ $244.04
```

> ⚠ The methodology deck (slide 4) shows ≈$154 for the T=4h/$500 case (implying λ_customer ≈ 0.20).
> The current catalog gives λ_customer(4h) = 0.1024 → $78.76 — the per-customer multiplier has roughly
> halved since the deck. The county-level λ(4h)=307 still matches. **The canary tracks the live
> catalog; the deck + `methodology/InfraSure_Outage_Pricing_Methodology.md` need a refresh** (flagged).

A canary failure means the formula — or our understanding of the data — drifted.
