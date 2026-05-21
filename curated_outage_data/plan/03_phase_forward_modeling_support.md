# Phase 3: Forward Modeling Support

Date: 2026-05-18

## Goal

Prepare curated datasets so future models can adjust historical outage pricing
for changing grid condition, hazard exposure, and trigger-source alignment.

This phase should produce model-ready artifacts and validation reports. It
should not silently change `price_engine` outputs.

## Starting Point

The current v0 baseline is:

```text
lambda_historical(fips, T)
  = count(historical events with duration >= T) / source observation years
```

A future model may estimate:

```text
lambda_forward(fips, T, horizon)
  = lambda_historical(fips, T)
    * grid_condition_modifier
    * hazard_modifier
    * credibility_modifier
    * trigger_alignment_modifier
```

The curated-data role is to make those modifiers measurable and auditable.

## Target Artifacts

### `model_targets.parquet`

One row per county-year-threshold-catalog.

Example fields:

- `catalog_id`
- `fips`
- `year`
- `T_hours`
- `events_total`
- `events_qualifying`
- `source_exposure_fraction`
- `lambda_observed`
- `customer_minutes`
- `data_quality_flags`

### `model_features.parquet`

One row per county-year.

Feature groups:

- lagged outage history;
- lagged utility reliability;
- grid-condition proxies;
- hazard history;
- trigger coverage where available;
- data-quality indicators.

### `model_runs/<run_id>/`

For each experimental model run:

```text
metrics.json
county_predictions.parquet
feature_dictionary.md
model_card.md
validation_report.md
```

## Backtesting Rule

Use rolling-origin validation:

```text
train through year Y
predict year Y + 1
compare predicted and observed qualifying event counts
repeat
```

Metrics:

- calibration by threshold;
- calibration by state/region;
- observed vs expected count;
- rank stability;
- premium adequacy proxy;
- residual bias by data-quality tier.

## First Modeling Baselines

Baseline order:

1. Historical v0 benchmark.
2. Credibility-blended historical benchmark.
3. Negative-binomial count model with county/region effects.
4. Utility-reliability feature challenger.
5. Hazard-feature challenger.
6. Combined model only after individual challengers are understood.

## Governance

Forward-looking model outputs must be labeled as projections.

Rules:

- no same-year leakage;
- no unvalidated trigger alignment modifier;
- no hidden replacement of empirical rates;
- every modifier must be inspectable at county level;
- model changes should be reported as lift/discount from v0, not as a black-box
  new price.

## Open Decisions

- First forecast horizon: policy year, calendar year, or season?
- Adjust only `lambda(T)` first, or also duration survival `S(T)`?
- Which geography should be used for pooling: state, FEMA region, utility
  territory, climate/hazard region, or learned clusters?
- How conservative should modifiers be capped?
- When is a model good enough to affect pricing rather than remain a report?
