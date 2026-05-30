# `per_customer_lambda.parquet` — Schema

Per-(FIPS, T, catalog) shadow rate for per-customer expected outage frequency,
emitted by Phase 2 of the
[Per-Customer Pricing Plan](../../docs/plan/per_customer_pricing_plan.md).

This artifact lives **outside** `price_engine/` and does not modify v0 pricing.

## Path

```text
curated_outage_data/outputs/per_customer_rate/per_customer_lambda__<catalog_id>.parquet
```

One parquet per catalog (`eagle-i-30min`, `eagle-i-45min`, `eagle-i-60min`).

## Grain

One row per **(fips, T, catalog_id)**. Expected row count per file:
~3,090 counties × 5 T values ≈ 15,450 rows.

## Columns

### Identity

| Column | Type | Meaning |
|---|---|---|
| `fips` | int64 | County FIPS |
| `T` | int64 | Deductible / trigger duration in hours (one of 2, 4, 8, 12, 24) |
| `catalog_id` | string | Source event catalog, one of the three EAGLE-I gap catalogs |

### Source-of-truth context

| Column | Type | Meaning |
|---|---|---|
| `n_events_total` | int64 | Total events in this FIPS in this catalog |
| `n_events_qualifying` | int64 (nullable) | Events with `duration_hours >= T` |
| `observation_years` | float64 | Source observation window for this catalog (per [A004](../../docs/methodology/assumptions.md#a004--annualization-denominator-is-the-source-observation-window)) |
| `mcc` | float64 (nullable) | Modeled County Customers from `MCC.csv` (per [A008](../../docs/methodology/assumptions.md#a008--mcc-is-a-static-per-county-customer-count)); null if missing |

### v0 baseline (reproduced)

| Column | Type | Meaning |
|---|---|---|
| `S_T` | float64 (nullable) | Empirical survival: `n_events_qualifying / n_events_total` (per [A005](../../docs/methodology/assumptions.md#a005--st-is-raw-empirical-no-parametric-duration-distribution-in-v0)) |
| `lambda_county` | float64 (nullable) | County-trigger annual rate: `(n_events_total / observation_years) * S_T` |

### Headline per-customer estimator

Headline: the **mean** of `mean_customers / MCC` over qualifying events
(per [A009](../../docs/methodology/assumptions.md#a009--per-customer-customer_impact_multiplier-first-order-estimator)
and [A010](../../docs/methodology/assumptions.md#a010--mean-not-max-of-customers_out--mcc-is-the-headline-per-customer-estimator)).

| Column | Type | Meaning |
|---|---|---|
| `multiplier_mean` | float64 (nullable) | `E[mean_customers / MCC \| duration_hours >= T]` — the headline customer-impact multiplier |
| `lambda_customer_mean` | float64 (nullable) | `lambda_county * multiplier_mean` — headline per-customer rate |

### Robust alternative (median)

Co-reported because Phase 1 (F4) showed the per-event distribution of
`mean_customers / MCC` is heavy-tailed (mean is 4.5× median for Alachua
T≥4h). The median is the robust alternative.

| Column | Type | Meaning |
|---|---|---|
| `multiplier_median` | float64 (nullable) | `median(mean_customers / MCC \| duration_hours >= T)` |
| `lambda_customer_median` | float64 (nullable) | `lambda_county * multiplier_median` |

### Sensitivity column (max)

Per [A010](../../docs/methodology/assumptions.md#a010--mean-not-max-of-customers_out--mcc-is-the-headline-per-customer-estimator),
`max` is reported alongside `mean` to expose the upper-bound interpretation
(peak instantaneous share of customers affected, vs. average share during
the event). Mean-vs-max is a 5-7× choice in v0.

| Column | Type | Meaning |
|---|---|---|
| `multiplier_max` | float64 (nullable) | `E[max_customers / MCC \| duration_hours >= T]` |
| `lambda_customer_max` | float64 (nullable) | `lambda_county * multiplier_max` |

### Per-event share sensitivity bands

Percentiles of the per-event `mean_customers / MCC` series within the
qualifying-event set. The median is also in `multiplier_median` above;
the other bands here help expose distribution shape without re-loading
`events.parquet`.

| Column | Type | Meaning |
|---|---|---|
| `pct_mcc_p10` | float64 (nullable) | 10th percentile |
| `pct_mcc_p50` | float64 (nullable) | 50th percentile (= `multiplier_median`) |
| `pct_mcc_p90` | float64 (nullable) | 90th percentile |
| `pct_mcc_p99` | float64 (nullable) | 99th percentile |

### Coverage gate

Three-level status, set per (FIPS, T). The reason field is populated
when status is `caution` or `not_available`. See the Phase 2 plan for the
threshold rules.

| Column | Type | Meaning |
|---|---|---|
| `coverage_gate_status` | string | One of `available`, `caution`, `not_available` |
| `coverage_gate_reason` | string (nullable) | One of `mcc_missing`, `insufficient_qualifying_events`, `low_qualifying_event_count`, `low_total_event_count`; null when `available` |

### Lineage

| Column | Type | Meaning |
|---|---|---|
| `generated_at` | string | UTC ISO timestamp of the pipeline run |
| `source_version` | string | Date of the pipeline code that generated this file |

## Null semantics

- `lambda_*` and `multiplier_*` are null when `coverage_gate_status = 'not_available'`.
- `mcc`, `S_T`, `lambda_county` may be null when MCC is missing.
- `coverage_gate_reason` is null when `coverage_gate_status = 'available'`.

## Stability expectation

The Phase 2 gate requires that for `available` counties, `multiplier_mean`
moves less than ±20% across the three catalogs at moderate T (4, 8, 12 h).
The cross-catalog QA in
[`validation/per_customer_lambda_qa_plan.md`](../validation/per_customer_lambda_qa_plan.md)
documents the exact check.

## Out of scope

- This artifact does not change v0 pricing.
- It does not include forward-looking adjustments (climate, grid, hazard).
- It does not include per-location / per-premise basis-risk adjustments — those
  live in Path B of the master plan, not here.
- It does not include any contract-level cap or floor on the multiplier; that
  governance gate is part of Phase 5.

## Cross-references

- [Per-Customer Pricing Plan](../../docs/plan/per_customer_pricing_plan.md)
- [Pricing Methodology](../../docs/methodology/pricing_methodology.md)
- [Assumptions registry](../../docs/methodology/assumptions.md) (A004, A005, A008, A009, A010)
- Pipeline: [`../pipelines/per_customer_rate/`](../pipelines/per_customer_rate/)
- Model card: [`../model_cards/customer_impact_v1.md`](../model_cards/customer_impact_v1.md)
- QA plan: [`../validation/per_customer_lambda_qa_plan.md`](../validation/per_customer_lambda_qa_plan.md)
