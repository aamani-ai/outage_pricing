# Model Card — `customer_impact_v1`

- **Status:** shadow (not in pricing). Emitted as a parallel column for review,
  per [Phase 2 of the Per-Customer Pricing Plan](../../docs/plan/per_customer_pricing_plan.md),
  and visible on the dashboard as of [Phase 3](../../docs/plan/per_customer_pricing_plan.md#phase-3-implementation-notes-2026-05-30)
  in three modes (`County trigger` / `Per-customer` / `Multiplier`) with a
  per-cell coverage-gate badge.
- **Version:** `2026-05-30`
- **Owner:** modeling
- **Lifecycle category:** bias-correction (per
  [adjustment framework](../../docs/plan/outage_baseline_adjustment_framework.md#modifier-lifecycle))
- **Last reviewed:** 2026-05-30

## What this model is

> **Pedagogical reference:** the nuance-by-nuance walkthrough lives at
> [`docs/methodology/per_customer_view_walkthrough.md`](../../docs/methodology/per_customer_view_walkthrough.md).
> Read that file alongside this card when you need to explain to anyone
> what each step in the chain represents and what the modelling
> tradeoffs are.

A per-(FIPS, T, catalog) numeric multiplier that converts the v0 county-trigger
event rate `lambda_county(T)` into a per-customer-experience event rate
`lambda_customer(T)`:

```text
lambda_customer(T) = lambda_county(T) * multiplier_mean(fips, T)
```

The multiplier is the **mean** of `mean_customers / MCC` over events with
`duration_hours >= T`. Median, max, and percentile-band columns are
co-reported as sensitivity and robustness checks.

Formal specification: [A009](../../docs/methodology/assumptions.md#a009--per-customer-customer_impact_multiplier-first-order-estimator),
[A010](../../docs/methodology/assumptions.md#a010--mean-not-max-of-customers_out--mcc-is-the-headline-per-customer-estimator).

## What this model is NOT

- Not a per-location / per-premise factor. That is Path B of the master plan
  and requires a trigger-source bridge (see
  [`docs/plan/trigger_source_implications.md`](../../docs/plan/trigger_source_implications.md)).
- Not a forward-looking adjustment (climate, grid, hazard). Those overlays
  stack multiplicatively *on top of* a customer-aware baseline; this card is
  about getting the baseline right first.
- Not currently affecting v0 pricing. Stays as a shadow column until Phase 5
  governance lifts it.

## Inputs

| Source | Field | Used for |
|---|---|---|
| `price_engine/catalogs/<cat>/data/events.parquet` | `fips`, `duration_hours`, `mean_customers`, `max_customers` | Event population and per-event customer aggregates |
| `price_engine/data/raw/MCC.csv` | `County_FIPS`, `Customers` | Per-county customer-base denominator |
| `price_engine/catalogs/<cat>/data/annualization_meta.json` | `source_observation_years` | Annualization denominator |

## Outputs

[`curated_outage_data/outputs/per_customer_rate/per_customer_lambda__<catalog_id>.parquet`](../outputs/per_customer_rate/).
Full schema in
[`schemas/per_customer_lambda.md`](../schemas/per_customer_lambda.md).

## Cap and floor

- **Floor:** 0. The multiplier is bounded below by zero by construction
  (`customers_out >= 0`).
- **Cap:** 1.0. You cannot affect more customers than exist
  (`max_customers <= MCC` in reality, though `MCC` is static and county growth
  can cause technical >1 values in fast-growing counties — flag, don't clip).

The pipeline does NOT clip the value to [0, 1]; it emits the raw computed value
so the model card can name any out-of-bound rows. If the dashboard ever
publishes a numeric premium adjustment using this multiplier, that surface
MUST clip to [0, 1] and surface the clipped count.

## Coverage gate

Three-status gate per (FIPS, T), with the per-row `coverage_gate_status` and
`coverage_gate_reason` columns. Thresholds (tunable constants at the top of
`compute_per_customer_lambda.py`):

```text
not_available  if mcc is missing or 0           → reason: mcc_missing
not_available  if n_events_qualifying(T) < 10   → reason: insufficient_qualifying_events
caution        if n_events_qualifying(T) < 100  → reason: low_qualifying_event_count
caution        if n_events_total       < 500    → reason: low_total_event_count
available      otherwise
```

## Known failure modes

1. **Heavy-tailed per-event distribution.** `mean_customers / MCC` over
   qualifying events is right-skewed — for Alachua at T≥4h, mean is 4.5×
   the median. The mean estimator is therefore sensitive to a handful of
   major-storm events. The median (`multiplier_median`) is co-reported as
   the robust alternative.

2. **Bridged-gap denominator bias.** `mean_customers` per event is computed
   over **observed positive snapshots only** — bridged-gap slots are not
   imputed and not in the denominator. On sparse-coverage events, this can
   bias the mean upward. The coverage gate catches the worst cases
   (Miami-Dade FL was the canonical Phase 1 example with a 2× cross-catalog
   swing).

3. **Static MCC.** [A008](../../docs/methodology/assumptions.md#a008--mcc-is-a-static-per-county-customer-count)
   notes that MCC is a one-shot model output (Moehl et al. 2023), not refreshed
   year-by-year. Counties with rapid customer growth since the modeling year
   may have an inflated multiplier. Phase 4 of the master plan will quantify
   this; for now, treat fast-growth counties with caution.

4. **Synchronous-outage assumption.** The multiplier treats `mean_customers
   / MCC` as a proxy for "share of customers affected during the event."
   This is exact only if all affected customers are out simultaneously for
   the full event window. In reality, customer outage spans within a county
   event are staggered, so this is an approximation. Phase 4 (PowerOutage.US
   per-`OutageId` cross-check) will measure the staggering error.

5. **Mean-vs-max ambiguity.** Per
   [A010](../../docs/methodology/assumptions.md#a010--mean-not-max-of-customers_out--mcc-is-the-headline-per-customer-estimator),
   mean is the headline; max is the sensitivity column. The two differ by
   5-7× on real counties. If the synchronous-outage assumption is closer to
   true, max is more honest; if not, mean is.

## Data lineage and reproducibility

- Pipeline: [`pipelines/per_customer_rate/compute_per_customer_lambda.py`](../pipelines/per_customer_rate/compute_per_customer_lambda.py).
- Idempotent: re-running overwrites the parquet files; no other state.
- Run time: ~25s for all three catalogs on a laptop.

## Stability evidence (Phase 2 close, 2026-05-30)

For `available` (FIPS, T) cells across all three catalogs (`n = 10,125`),
the relative range of `multiplier_mean` is:

| Percentile | Value |
|---|---|
| Median | 0.055 |
| p75 | 0.099 |
| p90 | 0.159 |
| p95 | 0.206 |
| p99 | 0.337 |

Phase 2 gate (multiplier_mean within ±20% across catalogs at moderate T):

| T | % within ±20% | n exceeds | n available |
|---|---|---|---|
| 4 h | 98.0% | 54 | 2,748 |
| 8 h | 92.4% | 171 | 2,245 |
| 12 h | 88.1% | 196 | 1,650 |

The gate passes at moderate T. Long-T (12h, 24h) instability is concentrated
in counties with low qualifying-event counts; the `caution` status already
flags most of these rows.

## Rollback

Single config flag: deleting `customer_impact_v1` from the dashboard build
config restores the v0-only view. No code changes needed in `price_engine/`.

## Why we are not at activation yet (2026-05-30)

Two specific gaps gate graduation. The full reasoning lives in
[the walkthrough's "Why this is still labeled shadow" section](../../docs/methodology/per_customer_view_walkthrough.md#why-this-is-still-labeled-shadow-and-what-it-would-take-to-graduate):

1. **The synchronous-outage assumption is untested.** EAGLE-I publishes
   per-snapshot customer counts, not customer identifiers, so we cannot
   distinguish customers who were out for the full event duration from
   customers cycling in and out. Phase 4 of the per-customer pricing plan
   measures this empirically using PowerOutage.US per-`OutageId` records.
2. **The activation governance gate has not been opened.** The activation
   checklist below has seven of eight rows ticked; the missing row
   (external validation) gates the conversation.

Deploying the shadow surface is **not** the same as graduating it. Deploy
gathers post-deploy team feedback; graduation moves the multiplier into
pricing math. The intended sequence is: deploy → feedback → Phase 4
validation → Phase 5 governance → terminal-state decision (stay shadow /
activate / absorb).

## Activation gate (future)

To move from `shadow` status to a numeric multiplier in production pricing,
ALL of these must be satisfied per the
[activation rules in the adjustment framework](../../docs/plan/outage_baseline_adjustment_framework.md#activation-rules-do-not-skip):

1. Feature definition documented (this card + schema).
2. County-year backtest exists (Phase 4 — PowerOutage.US cross-check).
3. Lift/discount bounded by documented cap and floor.
4. Monotonicity check passes.
5. Stability check passes (Phase 2 gate; this card §Stability evidence). ✓
6. Sensitivity bands documented (this card §Known failure modes; schema).
7. Rollback path is one config flag (this card §Rollback). ✓

Phases 3 (dashboard side-by-side), 4 (external validation), and 5 (governance)
each progress this checklist.
