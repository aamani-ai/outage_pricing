# P1 — Pricing Engine (the immediate next step)

Build the one pure, typed, tested function both sections render from — **before any pricing UI**.
This is the keystone of D1 and the `structural_verification.md` "ask for the test, not the feature" discipline.

## Goal

A pure module `web/lib/pricing/` with no React, no DOM, no fetch — inputs in, premium stack out:

```ts
composePremium(layers, { T, X, ER, TM }) → {
  baseline:  { lambdaCustomerT, rateBand: {low, high}, status: 'active' },  // rateBand precomputed upstream (experience band: p10/p90 of annual counts, A017 v2)
  location:  { relativity, status: 'modeled' | 'active' },    // mean-1 within county
  forward:   { factor, status: 'placeholder' | 'modeled' },   // climate × county-grid, combined; 1.00× until live
  finalPure, denom,                                           // denom = 1 − ER − TM
  premium:   { low, point, high },                            // RETAIL band — experience: p10/p90 of annual counts (A017 v2, disc 07);
                                                              //   placement/forward widening deferred to a later process
  bandDriver: 'confidence' | 'placement-widened',             // 'confidence' = legacy value for the experience-band driver (A017 v2);
                                                              //   rename → 'experience' deferred to P2. Never blend the two (communicate_to_share)
  steps: [ ...the ordered waterfall rows ],                   // baseline → location → forward → expense/margin
}
```

Generalize the old `composeLocationPremium()` (already pure — the seed). Every component carries a
`status` (`active`/`modeled`/`placeholder`) — the badge grammar from discussion `04`. **No shadow
number**: an unplugged layer is present at a neutral `1.00×` with `placeholder`.

## The firewall lives here (D5)

The engine enforces the grid double-count firewall: the **location relativity is renormalized to
mean-1** within the county (it can only redistribute), and the **forward factor acts on the county
total**. Encode this as an invariant + a test, not a comment.

## Canary tests FIRST (the discipline)

Write these before the function is "done"; they test our *understanding*, not just the code:

```text
  ANCHOR (LIVE catalog)   Alachua FL · T=4h · X=$500 · ER 0.20 · TM 0.15  (eagle-i-45min, mean)
                          λ_customer(4h) = 0.1024/yr → pure ≈ $51.19 → retail ≈ $78.76/yr  ← must hold (premium.point)
                          (also T=8h X=$2500 → ≈ $244.04)
                          ⚠ the deck slide-4 ≈$154 (λ≈0.20) is STALE — multiplier ~halved since; canary tracks the live catalog
  IDENTITY                forward at placeholder (1.00×) ⇒ premium.point == active-only retail
  FIREWALL                a county's location relativities are mean-1 (exposure-weighted) to ~1e-9
  MONOTONE                premium.point strictly increases in X; denom guard: ER+TM < 1 (else throw, FAIL LOUD)
  GROSS-UP                premium.point == pure / (1 − ER − TM) exactly (no rounding drift)
  BAND                    year-based band (disc 07 / A017): low ≤ point ≤ high; widens for thin/volatile
                          counties + longer T. ~median 2× a naive Poisson (outages cluster, var/mean≈5 @T=8h).
                          PRECOMPUTED in the pipeline (bootstrap needs per-year counts) and shipped, not run at quote time.
```

Plus **count assertions** on the data the engine consumes (per `structural_verification.md`): the catalog row count
and the regime CSV row count (3,090 counties) are asserted in-range at load, so a silently truncated
read fails a test instead of shipping a plausible-but-wrong premium.

## Fail loud, no fallback (structural_verification.md)

If an input is missing (no λ for a county/T, ER+TM≥1, bad geocode), the engine **throws** — it does
not silently fall back to a default that hides the break. The UI catches and shows an honest empty
state ("no priceable history at this duration"); the engine never invents a number.

## Deliverable

```text
  web/lib/pricing/
    compose.ts          composePremium() — pure, typed
    types.ts            PremiumStack, LayerStatus, PricingInputs (the data contract)
    compose.test.ts     the canaries above (vitest)
  → `npm test` green, with the Alachua anchor passing, BEFORE P2 builds any pricing view.
```

When this is green, the rest of the build renders it — and can't drift from it.
