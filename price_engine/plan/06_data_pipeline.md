# 06 — Data Pipeline

> Status note: this is retained as planning history. It predates the implemented five-script pipeline. For current behavior, use `../ARCHITECTURE.md`, `../END_TO_END.md`, `../data/EVENT_CONSTRUCTION.md`, `../data/SCHEMA.md`, and the scripts under `../data/`, `../filtration/`, and `../pricing/`. The old first-event/last-event `observation_years` formula below is superseded.

End-to-end flow from raw EAGLE-I data to the three CSVs the dashboard reads. Designed to be a single command per stage, idempotent, and re-runnable when EAGLE-I publishes new data.

## The four stages

```
[EAGLE-I raw]  →  01_ingest  →  [event log]  →  02_aggregate  →  [county artifacts]
                                                                      ↓
                                                                03_filter
                                                                      ↓
                                                            [county tiers]
                                                                      ↓
                                                                04_price
                                                                      ↓
                                                            [county premiums]
                                                            [county drilldown.json]
```

Each stage is a separate Python script in `data/`. Output of each is durable on disk. Re-running a downstream stage uses cached upstream output unless invalidated.

## Stage 1 — Ingest

**Input.** EAGLE-I raw files as currently delivered (we already have these from prior work in `outage_modeling_us/data/`).

**Output.** A single canonical event log: `data/events.parquet`. One row per (FIPS, event), columns:

| Column | Type | Source |
|---|---|---|
| `fips` | str (5-digit) | EAGLE-I |
| `event_id` | str | generated, `{fips}_{start_iso}` |
| `start_ts` | datetime | EAGLE-I |
| `end_ts` | datetime | EAGLE-I |
| `duration_hours` | float | computed |
| `customers_affected_peak` | int | EAGLE-I |
| `customer_hours` | float | EAGLE-I |
| `utility` | str (optional) | EAGLE-I, may be null |

Definition of "event" follows the IEEE 1366 / EAGLE-I convention — an interval of nonzero customers-affected in a FIPS, bounded by zero-affected periods. We use whatever event boundary EAGLE-I already provides; no custom event-stitching in v0.

**Decisions baked in.**
- We keep both `customers_affected_peak` and `customer_hours`. The latter is used for per-policy exposure normalisation.
- Events of duration < 5 minutes are dropped (EAGLE-I reporting noise floor).
- Events with null end_ts (ongoing at scrape time) are dropped from the historical window.

## Stage 2 — Aggregate

**Input.** `data/events.parquet`.

**Output.** Per-FIPS summary artifacts:

- `data/county_summary.parquet` — one row per FIPS:

| Column | Computation |
|---|---|
| `fips` | identifier |
| `state` | derived from FIPS prefix |
| `n_events` | count of events in window |
| `first_event_date` | min(start_ts) |
| `last_event_date` | max(end_ts) |
| `observation_years` | (last - first) / 365.25 |
| `n_per_year_county` | n_events / observation_years |
| `avg_customers` | average customers in FIPS (from Census + EAGLE-I) |
| `annual_event_counts` | list of counts by calendar year |
| `cv_annual` | std/mean of annual counts |

- `data/county_durations.parquet` — one row per (FIPS, duration_bucket) with empirical S(T) at the standard T-grid plus a continuous-T helper:

| Column | Notes |
|---|---|
| `fips` | identifier |
| `T_hours` | one of {2, 4, 8, 12, 24}, plus a finer 0.5h grid for the continuous-input recompute |
| `n_qualifying` | count of events with duration ≥ T |
| `s_T_empirical` | n_qualifying / n_events |

These two files together are the empirical inputs the pricing function reads.

## Stage 3 — Filter

**Input.** `data/county_summary.parquet`, `data/county_durations.parquet`, `filtration/thresholds.yml`.

**Output.** `data/county_tiers.csv`:

```
fips, fips_name, state, tier, d1_value, d3_value, d4_value,
d2_t2, d2_t4, d2_t8, d2_t12, d2_t24,
cell_status_t2, cell_status_t4, cell_status_t8, cell_status_t12, cell_status_t24,
rationale_text
```

Where `cell_status_tX` is one of `green`, `amber`, `noquote` based on D2 thresholds for that `T`.

The filter is pure code — given the parquets and the thresholds YAML, the CSV is deterministic. No manual judgment in the loop.

## Stage 4 — Price

**Input.** `data/county_durations.parquet`, `data/county_tiers.csv`, `pricing/config.yml` (the (T, X) grid, expense ratio, target margin).

**Output.**

- `data/county_premiums.csv` — one row per (FIPS, T, X):

```
fips, T_hours, X_dollars, tier, cell_status,
n_events, n_qualifying, s_T_empirical, lambda_per_policy,
pure_premium, uncertainty_load, retail_premium
```

- `data/county_drilldown.json` — one entry per FIPS:

```json
{
  "12086": {
    "fips_name": "Miami-Dade County, FL",
    "state": "FL",
    "tier": "Green",
    "diagnostics": {"d1": 412, "d3": 7.5, "d4": 0.18, "d2": {"2":380,"4":250,"8":95,"12":21,"24":4}},
    "rationale": [...],
    "qualifying_events_by_T": {
      "12": [
        {"date": "2020-09-14", "duration_hours": 18.5, "customers": 230000},
        ...
      ]
    }
  }
}
```

That JSON is what the drill-down view's Panel B and Panel D consume.

## Reproducibility

Each stage is a single Python script with a `--rebuild` flag. The default behaviour is incremental — only re-run if the input is newer than the output. With `--rebuild` everything is recomputed.

A single Makefile target `make all` runs the four stages in order. CI runs this on every commit to `master` and uploads the resulting CSVs as build artifacts.

## What we already have vs what's new

From prior work in this repo, we already have:
- EAGLE-I raw downloads in some form (need to confirm exact path / freshness)
- Some event-construction logic, possibly in PNNL-derived form
- Some county-month aggregates

What is new in v0:
- A single canonical `events.parquet` — we may already have it; if so, confirm the schema matches what's specified above
- The filtration computation (D1–D4) and `county_tiers.csv` output
- The pricing computation and `county_premiums.csv` output
- The drilldown JSON

The first task in the build sequence (`07_build_sequence.md`) is to take inventory of what already exists vs what needs to be built.

## Cross-references

- [`../pricing/`](../pricing/) — empty for now; will hold `empirical_s.py`, `premium.py`, `exposure.py`, `config.yml`
- [`../filtration/`](../filtration/) — empty for now; will hold `tier.py`, `thresholds.yml`
- [`../confidence/`](../confidence/) — empty for now; stub `load.py`
- [`../dashboard/`](../dashboard/) — empty for now; site code lives here
