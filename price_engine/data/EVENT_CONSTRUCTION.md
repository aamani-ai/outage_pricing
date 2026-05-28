# Event Construction — turning 15-minute snapshots into events

The Figshare yearly CSVs (`eaglei_outages_YYYY.csv`) are **snapshots**, not events: one row per (FIPS, 15-min timestamp) where `customers_out > 0`. A single real outage produces many such rows. The pricing engine needs **events** — discrete intervals with a start, an end, and a duration — because the contract triggers on duration ≥ T.

This document describes the implemented algorithm. The authoritative implementation is `02_construct_events.py`; this file records the rules and reasoning.

Timestamp contract: `run_start_time` is interpreted as UTC. `events.parquet` currently stores `start_time` and `end_time` as timezone-naive UTC timestamps. See `SCHEMA.md` for the detailed schema and timestamp policy.

## Output

One file: `price_engine/data/events.parquet`

Schema:

| Column | Type | Source |
|---|---|---|
| `event_id` | str | `f"{fips}_{start_iso}"` |
| `fips` | int | from snapshot |
| `state` | str | from snapshot |
| `county` | str | from snapshot |
| `start_time` | timestamp[ns], timezone-naive UTC | first snapshot of the contiguous run |
| `end_time` | timestamp[ns], timezone-naive UTC | last snapshot of the contiguous run + 15 min |
| `duration_hours` | float | `(end_time - start_time).total_seconds() / 3600` |
| `n_snapshots` | int | number of 15-min snapshots that comprise the event |
| `min_customers` | int | min `customers_out` across snapshots in the event |
| `max_customers` | int | max `customers_out` across snapshots in the event |
| `mean_customers` | float | mean `customers_out` across snapshots |
| `year` | int | year of `start_time` (for partitioning) |

One row per event. Events are county-scoped — no cross-county merging.

## Algorithm

The implementation processes one yearly CSV at a time for memory safety, while preserving one open event per FIPS between years. Conceptually, each FIPS stream is treated independently:

1. **Load** one yearly snapshot file. Keep only rows meeting the threshold (see Choice B). Sort by FIPS and timestamp. Drop duplicate `(FIPS, run_start_time)` rows, keeping the last observed value.

2. **Resume** any open carry event for that FIPS from the previous yearly file. This stitches real outages that span New Year's Eve without loading all 12 years into memory.

3. **Walk each sorted FIPS stream, grouping into events:**
   - Start a new event with the first snapshot.
   - For each subsequent snapshot:
     - Compute gap = `current.run_start_time - previous.run_start_time`.
     - If `gap ≤ GAP_TOLERANCE` (see Choice A) → extend the current event.
     - Else → close the current event and open a new one starting at `current`.
   - At the end of that year's FIPS stream, keep the final event open in memory rather than closing it immediately.

4. **For each closed event**, compute the output row:
   - `start_time` = first snapshot's `run_start_time`
   - `end_time` = last snapshot's `run_start_time + 15 min` (because each snapshot represents the state for the next 15 minutes)
   - `duration_hours` = `(end_time - start_time) / 3600s`
   - `n_snapshots` = count of snapshots in the run
   - `min/max/mean_customers` = aggregates over `customers_out` values in the run

5. **Filter** out events with `duration_hours < MIN_DURATION` (see Choice C).

6. **Write** closed events to `events.parquet` year by year. After the final year, close and write any remaining carry events.

That's it. No smoothing or imputation. Cross-year continuity is handled only by the per-FIPS carry state.

## The three design choices

### Choice A — Gap tolerance: catalog-specific continuity threshold

**Implementation: `--gap-tolerance-minutes`.** The single-run script still defaults
to `30` for backward compatibility, but the internal catalog build currently
produces `30`, `45`, and `60` minute event catalogs. The dashboard default is the
`45 min` candidate because the lab sensitivity work showed it best matches the
independent derived event log while staying qualitatively defensible.

Interpretation:

- `30 min` bridges one missing intermediate 15-minute snapshot.
- `45 min` bridges two missing intermediate 15-minute snapshots.
- `60 min` bridges three missing intermediate 15-minute snapshots.

**Reasoning:**

- EAGLE-I's native cadence is 15-minute snapshots. A snapshot is missing whenever EAGLE-I failed to fetch a utility map at that timestamp (network glitch, utility map down briefly, etc.).
- A strict rule (any missing snapshot splits the event) over-fragments. A real four-hour outage with one missed scrape in the middle would become two two-hour events, halving the duration distribution's tail mass.
- A loose rule (e.g. bridge gaps ≥ 60 min) can over-merge by turning long periods of no positive observation into assumed continuity.
- 30 minutes is a conservative baseline. 45 minutes is the current working recommendation for internal review. 60 minutes is a sensitivity catalog, not the default.

This is the dial the catalog layer is designed to expose. Users should be able to see how event counts, tiers, and premiums move when continuity assumptions change.

### Choice B — Snapshot threshold: `customers_out > 0`

**Decision: include any snapshot where `customers_out > 0`.** No minimum customer threshold for inclusion.

**Reasoning:**

- The contract triggers on whether **the county experienced an outage of duration ≥ T**. That's a binary question per county-snapshot: was anyone out, or not.
- A minimum threshold (e.g. ≥ 100 customers, or ≥ 1% of MCC) would conflate **event existence** with **event severity**. Severity belongs in a separate dimension — it shows up via `mean_customers` for v1 portfolio work, and via the filtration framework for whether we'll write the county at all.
- This matches how a utility-report-based validation would work: a utility's outage report says "this county had a 6-hour outage", not "this county had a 6-hour outage affecting at least 100 customers". The trigger is the event.
- Counties where outages typically affect very few customers (small rural FIPS) will have their λ(T) reflect that frequency honestly. If we want to refuse to write those counties, that's a filtration decision (D-tiers), not an event-construction decision.

The `min_customers` field is preserved on every event row, so anyone who later wants severity-thresholded analysis can apply it as a post-filter without re-running event construction.

The `min_customers`, `max_customers`, `mean_customers`, and derived
`peak_out_pct_mcc` fields are the data primitives for the planned
`customer_impact_modifier`. See
[`docs/plan/outage_baseline_adjustment_framework.md`](../../docs/plan/outage_baseline_adjustment_framework.md#customer-impact-modifier)
for placement, activation rules, and rollout path. They are not used in v0
pricing.

### Choice C — Minimum event duration: 15 minutes (one snapshot)

**Decision: `MIN_DURATION = 15 min` (one full snapshot).** No additional minimum applied.

**Reasoning:**

- 15 minutes is EAGLE-I's native resolution. An event of duration < 15 min is physically impossible in this data — it'd be a single snapshot, which by our `end_time` convention has duration exactly 15 min.
- Dropping single-snapshot events (i.e. setting `MIN_DURATION = 30 min`) would discard real short outages. Those matter at the **denominator** of S(T): if we drop them, we artificially inflate the fraction of events that exceed T, and over-price every contract.
- The contract sells at T ≥ 2 hours. A 15-minute event will never trigger a claim. But it must be in `n_events` so that `S(T)` = `n_qualifying / n_events` has the right denominator.
- IEEE 1366 calls < 5 min "momentary". EAGLE-I cannot resolve below 15 min, so the "momentary" question is moot here. Every event in our data is "sustained" by the IEEE definition.

If a county is dominated by 15-minute events with no longer ones, that's information — it'll show up in the duration distribution and in `S(T)` at any reasonable T, and probably tier the county Amber/Red in filtration. The data should reflect that, not hide it via a duration floor.

## Validation

After running `02_construct_events.py`, three sanity checks before declaring `events.parquet` good:

1. **Spot-check duration distribution against expectations.** Median should be ~1 hour, mean ~2-3 hours, max in the hundreds of hours (multi-day storm events). Std/mean ≥ 2 (right-skewed). If the distribution looks symmetric or capped, something is wrong.

2. **Reconcile event counts to a published utility outage report.** Pick one well-documented event (e.g. Hurricane Beryl 2024 in Harris County TX, or Hurricane Helene 2024 in western NC). Compare our event count and aggregate `max_customers` to the utility's after-action report. This is the validation user identified as the primary one — utility reports, not third-party datasets.

3. **Counts per FIPS-year are reasonable.** A typical mid-sized county should have hundreds to low thousands of events per year. Counties with < 10 events/year either have low outage activity or low EAGLE-I coverage; cross-reference with `coverage_history.csv` to distinguish.

4. **Compare threshold catalogs.** The curated-data diagnostic
   `curated_outage_data/pipelines/event_catalog_diagnostics/gap_sensitivity.py`
   compares the generated 30/45/60-minute catalogs. The current full-run result
   supports `45 min` as a reasonable middle setting, while showing that
   multi-week events need a separate persistent-outage/severity diagnostic.

These are eyeballed checks for v0. Formal back-testing comes in v0.5.

## What this algorithm deliberately does not do

| Not doing | Why |
|---|---|
| Cross-FIPS merging | Each county is priced independently. A multi-county storm produces one event per affected county; that's the right shape for our contract. |
| Cause classification | Out of scope for v0. We price duration regardless of cause. |
| Smoothing or imputation of missing data | Done in filtration (DQI gate), not here. Event construction reflects what was actually observed. |
| Reconciliation against PNNL `_merged.csv` | Different abstraction. PNNL's merger uses different (undocumented-to-us) rules. We define our own. |
| Customer-event reconstruction | A single county-event affects N customers simultaneously; we don't split it into N customer-events. v0 trigger is county-level. |

## Defaults summary table

| Knob | Default | File location |
|---|---|---|
| `GAP_TOLERANCE` | 30 min single-run default; catalogs build 30 / 45 / 60 | `02_construct_events.py --gap-tolerance-minutes` |
| `THRESHOLD` | `customers_out > 0` | same |
| `MIN_DURATION` | 15 min | same |
| `SNAPSHOT_INTERVAL` | 15 min | same |

All three are named constants at the top of the construction script so they're trivial to change and re-run when we revisit.

## Next file

`02_construct_events.py` — implement this algorithm. After that: aggregation script (`03_aggregate_county.py`), then filtration, then pricing.
