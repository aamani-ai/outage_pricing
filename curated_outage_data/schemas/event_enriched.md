# Schema Draft: event_enriched.parquet

Status: draft

## Purpose

Create an event-level curated table that starts from a selected price-engine
catalog and adds cause/hazard context.

This table is for analysis and future modeling. It does not replace
`price_engine/data/events.parquet`.

## Grain

One row per outage event:

```text
catalog_id x event_id
```

## Core Fields

| Field | Type | Meaning |
|---|---|---|
| `curation_run_id` | string | curated-data run identifier |
| `catalog_id` | string | source event catalog |
| `event_id` | string | outage event ID |
| `fips` | string | county FIPS |
| `state` | string | state abbreviation |
| `county` | string | county name |
| `event_start_utc` | timestamp/string | event start in UTC |
| `event_end_utc` | timestamp/string | event end in UTC |
| `duration_hours` | float | event duration |
| `n_snapshots` | int | source EAGLE-I snapshots in event |
| `min_customers_out` | int | minimum customers out during event |
| `max_customers_out` | int | maximum customers out during event |
| `mean_customers_out` | float | mean customers out during event |
| `mcc` | float/null | modeled county customers |
| `peak_out_pct_mcc` | float/null | max customers out divided by MCC |

## Enrichment Fields

| Field | Type | Meaning |
|---|---|---|
| `best_cause_family` | string | broad cause family |
| `best_cause_label` | string | specific label when defensible |
| `best_cause_source` | string | winning source: PNNL/OE-417, NOAA, or unknown |
| `best_source_event_type` | string/null | source event/category behind the best label |
| `best_source_event_id` | string/null | external event ID behind the best label |
| `best_match_score` | float/null | match score for the winning source |
| `best_source_start_utc` | timestamp/string/null | source start time for the winning source |
| `best_source_end_utc` | timestamp/string/null | source end time for the winning source |
| `best_named_event` | string/null | named storm / incident |
| `cause_confidence` | string | high, medium, low, none |
| `pnnl_match_count` | int | number of PNNL/OE-417 candidate matches |
| `noaa_match_count` | int | number of NOAA candidate matches |
| `cause_match_count` | int | total number of candidate source matches |
| `source_match_ids` | array/string | IDs into `event_cause_matches` |
| `hazard_tags` | array/string | weather/hazard tags |
| `event_quality_flag` | string | quality/review flag, e.g. `ok` or `extreme_duration_review` |
| `source_priority_reason` | string | why the best source won |
| `enrichment_notes` | string | caveats |

## Rule

If no cause can be defended:

```text
best_cause_family = "unknown"
best_cause_label = "unattributed"
cause_confidence = "none"
```

Do not use null to mean "no attribution"; use explicit unattributed values.

## Phase 1 Priority Rule

The current Phase 1 preview uses:

```text
PNNL/OE-417 major disturbance -> NOAA weather evidence -> unknown
```

PNNL/OE-417 labels mean "major reported disturbance context." They do not mean
the county was continuously off for the full OE-417 incident window.
