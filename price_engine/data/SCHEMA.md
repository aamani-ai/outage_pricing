# Price Engine Data Schema

This file documents the data contracts that matter for local experiments and downstream pricing. The most important convention is timestamp handling.

## Timestamp Policy

The raw EAGLE-I yearly CSVs expose `run_start_time` as a timestamp string with no timezone offset, for example:

```text
2025-01-01 00:00:00
```

v0 treats those timestamps as **UTC instants**.

Current generated parquet files store timestamps as `timestamp[ns]` without timezone metadata. In other words, `events.parquet` is **timezone-naive UTC**. Do not interpret these timestamps as county-local time, and do not apply daylight-saving conversions.

Why this matters:

- Event gaps are computed in UTC nanoseconds.
- `duration_hours` is an elapsed-time duration, not a wall-clock local-time duration.
- `year` is the UTC calendar year of `start_time`.
- A cross-year event can have `year = 2025` and `end_time = 2026-01-01 00:00:00`.

Future schema improvement: write `timestamp[ns, UTC]` or rename fields to `start_time_utc` / `end_time_utc`. The current v0 artifact remains timezone-naive UTC for compatibility with the existing dashboard and parquet outputs.

## Snapshot Semantics

Raw snapshot rows:

| Column | Meaning |
|---|---|
| `run_start_time` | Start of the 15-minute snapshot interval, interpreted as UTC |
| `customers_out` | Customers without power during that snapshot |
| `fips_code` | County FIPS |

A raw snapshot at `2025-01-01 00:00:00` represents the half-open interval:

```text
[2025-01-01 00:00:00, 2025-01-01 00:15:00)
```

## `events.parquet`

Path:

```text
price_engine/data/events.parquet
```

Schema:

| Column | Type | Meaning |
|---|---|---|
| `event_id` | string | Stable id using `fips` and `start_time` |
| `fips` | int64 | County FIPS |
| `state` | string | State name from raw file |
| `county` | string | County name from raw file |
| `start_time` | timestamp[ns], timezone-naive UTC | Inclusive first outage snapshot |
| `end_time` | timestamp[ns], timezone-naive UTC | Exclusive end, equal to last observed outage snapshot + 15 minutes |
| `duration_hours` | float64 | `(end_time - start_time) / 3600s` |
| `n_snapshots` | int64 | Number of observed positive-outage snapshots inside the event |
| `min_customers` | int64 | Minimum `customers_out` across observed snapshots |
| `max_customers` | int64 | Maximum `customers_out` across observed snapshots |
| `mean_customers` | float64 | Mean `customers_out` across observed snapshots |
| `year` | int16 | UTC calendar year of `start_time` |

Important: `duration_hours` can exceed `n_snapshots * 0.25` because the event builder bridges missing snapshots up to the selected catalog's `GAP_TOLERANCE`.

## Event Interval Rules

For each FIPS independently:

- `start_time` is inclusive.
- `end_time` is exclusive.
- Consecutive positive snapshots are one event.
- A gap `<= GAP_TOLERANCE` between positive snapshots is bridged.
- A gap `> GAP_TOLERANCE` closes the prior event and starts a new event.
- The final open event for each FIPS is carried across yearly CSV boundaries before being closed.

Example:

```text
positive snapshots: 14:15, 14:30, 14:45
event interval:     [14:15, 15:00)
duration_hours:     0.75
n_snapshots:        3
```

## External Event Log Comparison

The current external lab file:

```text
lab/processed_event_log.parquet
```

uses timezone-aware UTC timestamps and stores `event_end` as the **last observed snapshot timestamp**, not the exclusive end. For direct comparison with `events.parquet`, normalize it as:

```text
external_end_exclusive = event_end + 15 minutes
```

That normalization is implemented in:

```text
lab/compare_event_logs.py
```

## Downstream Usage

`03_aggregate_county.py` uses:

- `duration_hours` for empirical duration distributions.
- `start_time` / `end_time` for event-span diagnostics only, not for annualization.
- `year` from UTC `start_time` for duration-by-year diagnostics.

`05_price.py` prices from duration distributions only. It does not reinterpret timestamps or convert them to local time.

## Annualization Policy

`n_per_year` is the annual event frequency used by pricing:

```text
n_per_year = n_events_total / observation_years
```

The denominator is the **source exposure window**, not a county's first and last
observed event dates. This is important: using first/last event dates would
inflate annual rates for quiet counties whose first outage happened late in the
dataset.

For the current 2014-2025 EAGLE-I release, the raw source window is:

```text
2014-11-01 04:00:00 UTC through 2026-01-01 00:00:00 UTC
```

That is approximately `11.167` observation years. The 2014 file is partial; the
2015-2025 files are treated as full calendar-year exposure. The final snapshot
at `2025-12-31 23:45:00` represents `[2025-12-31 23:45, 2026-01-01 00:00)`.

`county_summary.parquet` retains diagnostic fields:

| Column | Meaning |
|---|---|
| `observation_years` | Denominator used by pricing; equals source exposure years for the processed release |
| `source_observation_years` | Same source-window value, repeated for clarity |
| `source_window_start` / `source_window_end` | Half-open source exposure interval |
| `event_span_years` | County first-event to last-event span; diagnostic only |
| `coverage_history_years` | Years represented in `coverage_history.csv`; diagnostic only because that file currently covers 2018-2022 |

Each aggregate run also writes `annualization_meta.json` next to
`county_summary.parquet` with the exact source intervals used.
