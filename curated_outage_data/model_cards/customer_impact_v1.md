# Model Card — `customer_impact_v1`

- **Status:** **shipped** (headline price on the dashboard as of 2026-05-30).
  Terminal state of the per-customer pricing plan is **(b) — Activate as
  numeric multiplier**, decided via the documented graduation discussion
  (see plan §Phase 5 closure). One material data-constrained assumption,
  [A011](../../docs/methodology/assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation),
  documented in the registry and on the dashboard's per-customer mode-note;
  resolution path = Phase 4 PoUS validation, queued as refinement.
- **Version:** `2026-05-30`
- **Owner:** modeling
- **Lifecycle category:** bias-correction (per
  [adjustment framework](../../docs/plan/cross_cutting/outage_baseline_adjustment_framework.md#modifier-lifecycle))
- **Last reviewed:** 2026-05-30

## What this model is

> **Pedagogical reference:** the nuance-by-nuance walkthrough lives at
> [`docs/methodology/per_customer_view_walkthrough.md`](../../docs/methodology/02_per_customer/per_customer_view_walkthrough.md).
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
  [`docs/plan/trigger_source_implications.md`](../../docs/plan/cross_cutting/trigger_source_implications.md)).
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

## Activation status (2026-05-30)

**Activated.** The per-customer chain is the dashboard headline price as
of this date. Terminal state of the per-customer pricing plan is
**(b) — Activate as numeric multiplier**.

The activation checklist below is satisfied. The bias-correction
lifecycle pattern recorded in
[the adjustment framework](../../docs/plan/cross_cutting/outage_baseline_adjustment_framework.md#modifier-lifecycle)
treats external validation as **refinement** (not a hard gate) when a
data constraint is documented in the assumptions registry, as A011 now
is. The full reasoning lives in
[the walkthrough's "One assumption you must read" section](../../docs/methodology/02_per_customer/per_customer_view_walkthrough.md#the-one-assumption-you-must-read--a011).

## Activation checklist (status at graduation)

1. Feature definition documented (this card + schema). ✓
2. County-year backtest exists (Phase 1 notebook). ✓
3. Lift/discount bounded by documented cap and floor. ✓
4. Monotonicity check passes. ✓
5. Stability check passes (Phase 2 gate; this card §Stability evidence). ✓
6. Sensitivity bands documented (this card §Known failure modes; schema). ✓
7. Rollback path is one config flag (this card §Rollback). ✓
8. External validation = **refinement queue (Phase 4)** — see [A011](../../docs/methodology/assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation).
   Documented data constraint, not a hard gate; tightens the headline
   when per-`OutageId` data is available.

## Refinement queue (post-shipping)

- **Phase 4 — PowerOutage.US per-`OutageId` validation.** Runs against
  the staged HighTail extract (MA / CT / RI Jan–Mar 2019). Output is
  either (a) confirmation the synchronous approximation is within the
  sensitivity band, or (b) an empirical correction factor folded into
  the multiplier formula. Queued for when team capacity permits; not
  blocking on this deploy.
