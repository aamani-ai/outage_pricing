# Phase 1 Learning: Florida 2017/2020 Cause Attribution Pilot

Date: 2026-05-18

## Scope

Pilot run:

```text
catalog: eagle-i-45min
state: Florida
years: 2017, 2020
NOAA buffer: 6h before outage start, 12h after outage start
PNNL role: comparator, not truth source
```

Generated local reports:

```text
curated_outage_data/outputs/phase_1_cause_attribution/fl_2017_2020/
```

Generated local reports are gitignored; this note preserves the important
findings.

## What Worked

- The pipeline can read the canonical price-engine event catalog directly.
- NOAA Storm Events bulk files can be discovered and downloaded by year.
- NOAA county-level records can be matched by FIPS after converting source
  local-standard timestamps to UTC.
- PNNL's public dataset is usable as a comparator for merged events and
  DOE/OE-417 lag matching.

## First Results

The pilot read `84,270` Florida outage events from the 45-minute catalog across
2017 and 2020.

NOAA source records:

```text
NOAA records total: 2,429
NOAA county records used: 1,967
NOAA zone records held out: 462
```

Onset-anchored NOAA matches:

```text
NOAA match rows: 2,665
NOAA matched outage events: 1,308
usable NOAA matched outage events: 1,303
usable NOAA event match rate: 1.55%
```

Match rates rise with duration threshold:

| Threshold | Events | Usable NOAA matched events | Usable match rate |
|---:|---:|---:|---:|
| 1h | 67,149 | 1,127 | 1.68% |
| 4h | 27,530 | 711 | 2.58% |
| 8h | 14,528 | 512 | 3.52% |
| 12h | 9,194 | 387 | 4.21% |
| 24h | 2,737 | 187 | 6.83% |

Top NOAA event types by matched outage events:

| Event type | Matched outage events |
|---|---:|
| Thunderstorm Wind | 757 |
| Heavy Rain | 207 |
| Hail | 126 |
| Flood | 95 |
| Tornado | 92 |
| Flash Flood | 83 |
| Lightning | 83 |

## Important Issue Found

The catalog contains extreme-duration county events that need review before
they are used for clean cause labels.

For Florida 2017/2020:

```text
events longer than 14 days: 86
largest event: 5,039.25 hours
```

Examples include Miami-Dade and Broward intervals that run for months in 2020.
These are not automatically wrong, because the current event definition is
"county has any customers out," but they are not clean single-cause events.

The pipeline now flags events longer than 336 hours as
`extreme_duration_review`. NOAA matches for those events are retained as context
but are not counted as usable cause labels.

## Join Rule Corrected During Pilot

The first naive matching rule compared NOAA records to the full outage interval.
That was too permissive: a storm days or weeks inside a long outage interval
could be labeled as a cause.

The pilot now matches NOAA against the outage-onset window:

```text
event_start - 6h <= NOAA event interval <= event_start + 12h
```

This is more defensible for initial cause attribution. Later phases can add
secondary/prolonged-cause logic if needed.

## PNNL Comparator Findings

PNNL merged Florida events are much fewer and have a shorter tail than our
current 45-minute catalog:

| Year | Our events | PNNL merged events | Our p95 duration | PNNL p95 duration |
|---:|---:|---:|---:|---:|
| 2017 | 41,187 | 10,820 | 18.25h | 6.0h |
| 2020 | 43,083 | 12,447 | 20.0h | 5.5h |

PNNL OE/OE-417 lag rows:

| Year | Lag | Rows | Unique outage starts | Unique OE-417 events |
|---:|---|---:|---:|---:|
| 2017 | 8h | 321 | 300 | 9 |
| 2017 | 24h | 443 | 378 | 9 |
| 2020 | 8h | 752 | 528 | 13 |
| 2020 | 24h | 878 | 641 | 13 |

This supports the current framing: PNNL is valuable as a major-disturbance
comparator, but it should not silently replace our event catalog because its
merged-event construction and filtering behavior differ materially.

## Decisions

- Keep `price_engine` event catalogs as the canonical pricing inputs.
- Keep NOAA as the first broad weather attribution source.
- Keep PNNL as a comparator/validation source.
- Do not treat any match as proof of cause.
- Do not trust extreme-duration intervals as clean single-cause labels without
  manual/event-construction review.

## Next Work

1. Manually review the sample file:
   `manual_review_sample.csv`.
2. Compare our long Florida events against raw snapshots and PNNL merged events.
3. Add an OE/OE-417 direct matcher so PNNL can validate, not substitute for, our
   matching logic.
4. Decide whether pricing catalogs need a separate "persistent low-level outage"
   flag or thresholded event view for cause attribution.
5. Add NOAA zone-to-county handling only after county-level matching is reviewed.

## Reusable Analysis Lesson

For event-cause joins, always ask:

```text
Are we matching source records to the start of the event, or anywhere inside the
event duration?
```

For long-duration events, those are very different assumptions. Full-interval
matching can create false cause labels.
