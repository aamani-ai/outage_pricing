# Aggregation and Annualization — Methodology

- **Status:** skeleton
- **First written:** 2026-05-30
- **Last reviewed:** 2026-05-30

## Scope

How per-event records roll up to per-county summaries, and how the
denominator that turns total event counts into annual rates is defined.
The annualization-denominator choice is one of the most consequential
methodology calls in the project.

## Inputs and outputs

| | Items |
|---|---|
| **Inputs** | `price_engine/data/events.parquet` |
| **Outputs** | `price_engine/data/county_summary.parquet`, `price_engine/data/county_durations.parquet`, `price_engine/data/annualization_meta.json` |

## Method (summary)

For each FIPS, aggregate over its events:

```text
n_events_total       = |events|
duration_p50, p95    = order statistics of duration_hours
n_per_year           = n_events_total / observation_years
```

Plus event-span and coverage-history diagnostics that do **not** drive
pricing.

## Annualization denominator

The denominator is the **source observation window** — the half-open
interval `[2014-11-01 04:00 UTC, 2026-01-01 00:00 UTC)` for the current
release, which equals **~11.167 years**. This is captured per-catalog in
`price_engine/data/annualization_meta.json` and rests on
[A004](../assumptions.md#a004--annualization-denominator-is-the-source-observation-window).

Two alternative denominators are explicitly rejected:

| Alternative | Why rejected |
|---|---|
| Calendar years (12) | 2014 is partial; would understate `lambda` by ~7.5% |
| Per-county first-event to last-event span | Would inflate `lambda` for quiet counties whose first outage happened late in the dataset |

## Customer-count carryover

`min_customers`, `max_customers`, and `mean_customers_overall`
(event-mean across all events) are carried in `county_summary.parquet` as
diagnostics. They are not pricing inputs in v0 but are the inputs to the
per-customer pricing plan
([A009](../assumptions.md#a009--per-customer-customer_impact_multiplier-first-order-estimator)).

## Validation

- `sum(n_events_per_fips)` should match `events.parquet` row count.
- `observation_years` must equal the source window for every county
  (sanity: same denominator for all FIPS in a catalog).
- Spot-check a small set of counties against published reports.

## Known limitations

- `coverage_history.csv` ships values for 2018-2022 only; the
  `coverage_history_years` diagnostic field is therefore truncated and
  should not be used as an annualization denominator.
- `MCC` is static, see
  [A008](../assumptions.md#a008--mcc-is-a-static-per-county-customer-count).

## Implementation pointers

| Aspect | File |
|---|---|
| Aggregator | `price_engine/data/03_aggregate_county.py` |
| Per-catalog meta | `price_engine/catalogs/eagle-i-<N>min/data/annualization_meta.json` |
| Schema | `price_engine/data/SCHEMA.md` §Annualization Policy |

## Cross-references

- [Event Catalog Creation Methodology](../01_eventization/event_catalog_creation_methodology.md)
- [Filtration Methodology](../cross_cutting/filtration_methodology.md) — uses `n_events_total`, `observation_years`, `n_per_year` as gate inputs
- [Pricing Methodology](../cross_cutting/pricing_methodology.md) — consumes `n_per_year` and the duration distribution
