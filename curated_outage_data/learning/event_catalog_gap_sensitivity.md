# Event Catalog Gap Sensitivity Learning

Date: 2026-05-18

## Question

We wanted a quantitative check on the continuity threshold used to turn
15-minute EAGLE-I snapshots into county outage events.

The current working default is the `45 min` catalog. The concern was whether
that threshold is too loose and artificially merges outages, or whether a
stricter `30 min` view would over-fragment real outages because of missed
source snapshots.

## Scope

Diagnostic script:

```text
curated_outage_data/pipelines/event_catalog_diagnostics/gap_sensitivity.py
```

Generated local outputs:

```text
curated_outage_data/outputs/event_catalog_gap_analysis/
```

The diagnostic uses all generated national event catalogs for 2014-2025:

```text
price_engine/catalogs/eagle-i-30min/data/events.parquet
price_engine/catalogs/eagle-i-45min/data/events.parquet
price_engine/catalogs/eagle-i-60min/data/events.parquet
```

It does not scan the raw EAGLE-I CSV rows directly.

## What Was Measured

For each generated event, the diagnostic computes:

```text
bridged_minutes = duration_minutes - (n_snapshots * 15)
```

Interpretation:

- `0` means the event is fully explained by observed positive 15-minute
  snapshots.
- A positive value means the event includes some inferred continuity between
  positive snapshots.
- This is a post-catalog diagnostic, not a raw missingness audit.

## National Results

| Catalog | Events | Median duration | p95 duration | p99 duration | Events > 14d | Events with bridged gap |
|---|---:|---:|---:|---:|---:|---:|
| 30 min | 14,195,144 | 1.75h | 13.0h | 38.5h | 5,176 | 9.37% |
| 45 min | 13,190,684 | 1.75h | 14.0h | 41.5h | 5,442 | 14.84% |
| 60 min | 12,431,932 | 2.0h | 15.0h | 44.0h | 5,546 | 18.92% |

Moving from `30 min` to `45 min` reduces event count by about `7.1%`.
Moving from `45 min` to `60 min` reduces event count by about `5.8%`.

For the `45 min` catalog:

| Metric | Value |
|---|---:|
| events with no inferred bridged gap | 85.16% |
| average bridged minutes across all events | 4.24 min |
| median bridged minutes among bridged events | 30.0 min |
| p90 bridged minutes among bridged events | 45.0 min |
| p99 bridged minutes among bridged events | 105.0 min |

## Florida 2017/2020 Pilot Scope

The same diagnostic was also summarized for the Florida 2017/2020 scope used
in the Phase 1 cause-attribution pilot.

| Catalog | Events | Median duration | p95 duration | p99 duration | Events > 14d | Events with bridged gap |
|---|---:|---:|---:|---:|---:|---:|
| 30 min | 94,329 | 2.0h | 17.5h | 46.75h | 78 | 13.06% |
| 45 min | 84,270 | 2.25h | 19.25h | 52.5h | 86 | 20.96% |
| 60 min | 76,860 | 2.25h | 20.75h | 61.75h | 87 | 26.56% |

Florida is more sensitive than the national average, which is useful because it
was also the pilot area for NOAA and PNNL/OE-417 cause matching.

## Interpretation

The `45 min` catalog still looks like a defensible middle setting:

- Most events in the `45 min` catalog have no inferred bridged gap.
- Where bridging exists, it is usually short enough to be consistent with a
  missed scrape or short source interruption.
- The event-count reduction from `30 min` to `45 min` is meaningful but not so
  large that the catalog appears dominated by artificial continuity.
- The jump from `45 min` to `60 min` adds more bridging and should remain a
  sensitivity view rather than the default.

This is evidence for `45 min`; it is not proof that `45 min` is always correct.

## Important Caveat

The extreme-duration issue is not solved by choosing `30 min` instead of
`45 min`.

National events longer than 14 days are similar across the three catalogs:

```text
30 min: 5,176
45 min: 5,442
60 min: 5,546
```

That suggests the longest events are driven more by the event definition
`customers_out > 0` and persistent low-level positive observations than by the
specific 30/45/60-minute gap tolerance.

## What Was Sampled vs Full-Run

For the earlier PNNL/NOAA cause-attribution pilot:

- The joins were run across all Florida 2017/2020 events in the 45-minute
  catalog: `84,270` outage events.
- The HTML timeline review used a small selected sample only for visual QA.

For this gap diagnostic:

- The national threshold comparison used all generated 2014-2025 events in the
  30/45/60 catalogs.
- The Florida 2017/2020 section is a focused slice so it can be compared to the
  PNNL/NOAA pilot.

## Decision

Keep `45 min` as the current default candidate for internal review.

Keep `30 min` and `60 min` as switchable sensitivity catalogs. They are useful
for showing how the pricing and event evidence change when the continuity
assumption changes.

## Next Checks

1. Add a raw transition-gap audit if we need direct evidence from raw snapshots
   rather than generated event artifacts.
2. Add a severity-thresholded diagnostic, such as `max_customers >= 100` or a
   percentage of MCC, to separate persistent low-level outage records from
   material outage events.
3. Keep pricing based on the documented catalog default, but use the severity
   view for cause attribution and event QA.
4. Add a dashboard note that the catalog switch changes the event-construction
   assumption, not the underlying raw EAGLE-I source.

## Reusable Analysis Lesson

For event-building pipelines, threshold sensitivity needs two checks:

```text
How many records change when the threshold moves?
What kind of records change?
```

The second question matters more. If tightening the gap threshold mostly splits
short bridged gaps, then it may over-fragment. If it removes long background
events, then it may be fixing a real artifact. Here, the long-tail problem
mostly survives the stricter threshold, so it needs a separate diagnostic.
