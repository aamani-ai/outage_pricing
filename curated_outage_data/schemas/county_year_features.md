# Schema Draft: county_year_features.parquet

Status: draft

## Purpose

Create a county-year feature table for validation, modelability, and future
forward-looking modeling.

## Grain

One row per:

```text
catalog_id x fips x year
```

Some source features are utility-year or state-year. Those must be aggregated or
joined into this grain with explicit rules.

## Feature Blocks

### Metadata

| Field | Meaning |
|---|---|
| `curation_run_id` | curated-data run identifier |
| `catalog_id` | event catalog |
| `fips` | county FIPS |
| `state` | state abbreviation |
| `county` | county name |
| `year` | UTC event-start year or source feature year, by block |

### Outage Target / History Fields

| Field | Meaning |
|---|---|
| `events_total` | total events starting in year |
| `events_ge_2h` | events with duration >= 2h |
| `events_ge_4h` | events with duration >= 4h |
| `events_ge_8h` | events with duration >= 8h |
| `events_ge_12h` | events with duration >= 12h |
| `events_ge_24h` | events with duration >= 24h |
| `customer_minutes_out` | annual customer-minutes if computed |
| `source_exposure_fraction` | fraction of source year observed |

### Cause / Hazard Fields

| Field | Meaning |
|---|---|
| `weather_attributed_events` | count of events with weather attribution |
| `unknown_cause_events` | count of unattributed events |
| `storm_event_count_noaa` | NOAA storm events in county-year |
| `hurricane_or_tropical_count` | tropical cyclone-related count |
| `winter_storm_count` | winter hazard count |
| `wind_hail_tornado_count` | severe convective hazard count |

### Utility / Grid Fields

| Field | Meaning |
|---|---|
| `utility_count` | utilities serving county in source year |
| `dominant_utility_id` | largest customer-weight utility |
| `dominant_utility_share` | customer share of dominant utility |
| `weighted_saidi` | customer-weighted utility SAIDI where available |
| `weighted_saifi` | customer-weighted utility SAIFI where available |
| `weighted_caidi` | customer-weighted utility CAIDI where available |
| `ami_penetration` | customer-weighted AMI penetration if available |
| `capex_proxy` | later FERC/PUDL-derived proxy |
| `om_proxy` | later FERC/PUDL-derived proxy |

### Data Quality Fields

| Field | Meaning |
|---|---|
| `feature_coverage_score` | source coverage score |
| `utility_join_confidence` | high, medium, low |
| `hazard_join_confidence` | high, medium, low |
| `model_eligible` | boolean after leakage/missingness checks |
| `caveats` | short caveat string |

## Leakage Rule

For model-eligible features:

```text
feature_source_year <= target_year - 1
```

unless an explicit source-specific publication rule says the field was available
before the underwriting date.
