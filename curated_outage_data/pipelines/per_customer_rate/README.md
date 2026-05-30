# `per_customer_rate/` — Pipeline

Phase 2 of the [Per-Customer Pricing Plan](../../../docs/plan/per_customer_pricing_plan.md).
Emits the per-customer shadow rate alongside the v0 county-trigger rate, per
catalog. Does not modify v0 pricing.

## What it produces

```text
curated_outage_data/outputs/per_customer_rate/
├── per_customer_lambda__eagle-i-30min.parquet
├── per_customer_lambda__eagle-i-45min.parquet
└── per_customer_lambda__eagle-i-60min.parquet
```

Schema: [`../../schemas/per_customer_lambda.md`](../../schemas/per_customer_lambda.md).

One row per (FIPS, T, catalog). ~15,450 rows per file (3,090 counties × 5 T values).

## What it reads

- `price_engine/catalogs/<catalog_id>/data/events.parquet` — per-event columns
  only (`fips`, `duration_hours`, `mean_customers`, `max_customers`).
- `price_engine/catalogs/<catalog_id>/data/annualization_meta.json` — for
  `source_observation_years`.
- `price_engine/data/raw/MCC.csv` — per-FIPS customer counts (skipping the
  trailing `Grand Total` row).

## How to run

```bash
source .venv/bin/activate
python curated_outage_data/pipelines/per_customer_rate/compute_per_customer_lambda.py
```

Default behavior: runs all three catalogs and writes the parquet files into
`curated_outage_data/outputs/per_customer_rate/`. The directory is created
on demand.

To run a subset of catalogs (e.g. for debugging):

```bash
python compute_per_customer_lambda.py --catalogs eagle-i-45min
```

## Coverage gate (initial; tunable)

```text
not_available  if mcc is missing or 0           → reason: mcc_missing
not_available  if n_events_qualifying(T) < 10   → reason: insufficient_qualifying_events
caution        if n_events_qualifying(T) < 100  → reason: low_qualifying_event_count
caution        if n_events_total       < 500    → reason: low_total_event_count
available      otherwise
```

Thresholds (`MIN_QUALIFYING_HARD = 10`, `MIN_QUALIFYING_CAUTION = 100`,
`MIN_TOTAL_CAUTION = 500`) are constants at the top of the script and can be
adjusted as Phase 2 calibration proceeds.

## Idempotence

The pipeline is purely read-from / write-to and overwrites existing parquet
files on each run. Output files are gitignored (per the
`curated_outage_data/` workstream convention).

## Performance notes

Loads ~13M events per catalog into memory and groups by FIPS. Typical wall
time per catalog is under 30 seconds on a laptop.
