# Schema Draft: event_cause_matches.parquet

Status: draft

## Purpose

Preserve all candidate external-source matches for each EAGLE-I-derived outage
event.

This table should be many-to-many. Do not collapse to one cause label too early.

## Grain

One row per:

```text
catalog outage event x external source event match
```

## Fields

| Field | Type | Meaning |
|---|---|---|
| `curation_run_id` | string | curated-data run identifier |
| `catalog_id` | string | source price-engine catalog |
| `event_id` | string | EAGLE-I-derived outage event ID |
| `fips` | string | county FIPS |
| `state` | string | state abbreviation |
| `county` | string | county name |
| `event_start_utc` | timestamp/string | outage event start in UTC |
| `event_end_utc` | timestamp/string | outage event end in UTC |
| `event_onset_window_start_utc` | timestamp/string | start of source-match window around outage onset |
| `event_onset_window_end_utc` | timestamp/string | end of source-match window around outage onset |
| `duration_hours` | float | outage event duration |
| `source` | string | NOAA, OE-417, FEMA, etc. |
| `source_event_id` | string | external source event ID |
| `source_event_type` | string | source event type/category |
| `source_start_utc` | timestamp/string | normalized source start time |
| `source_end_utc` | timestamp/string | normalized source end time |
| `source_start_delta_minutes` | float | source start minus outage start; negative means source began before outage |
| `geo_match_level` | string | county, zone, state, polygon, unknown |
| `time_overlap_minutes` | float | direct overlap duration |
| `lead_lag_minutes` | float | gap if no direct overlap |
| `match_score` | float | 0-1 match strength |
| `event_quality_flag` | string | `ok`, `extreme_duration_review`, etc. |
| `cause_family` | string | weather, grid_ops, equipment, vegetation, cyber, unknown |
| `cause_label` | string | specific label when defensible |
| `named_event` | string/null | hurricane/storm/incident name where available |
| `confidence` | string | high, medium, low, review |
| `notes` | string | caveat or explanation |

## Required QA

```text
[ ] one outage event can have zero, one, or many matches
[ ] no source match is treated as proof of cause by default
[ ] all source timestamps are normalized before overlap math
[ ] weather/hazard matching is anchored to outage onset unless a later phase
    explicitly models prolonged or secondary causes
[ ] match_score inputs are documented
[ ] extreme-duration outage intervals are review-only until event construction
    and source behavior are inspected
[ ] manual review samples exist for high, medium, review, low, and unmatched cases
```
