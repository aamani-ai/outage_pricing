# Enriched Event Dataset Plan

Date: 2026-05-18

Implementation note: this plan now has a concrete working home at
`curated_outage_data/`. Keep this file as the high-level concept note, and keep
active source notes, schemas, phase plans, and future scripts in that project
folder.

## Goal

Create reproducible datasets that join our EAGLE-I-derived outage events with
supporting utility, grid, weather, hazard, and exposure data. This becomes the
bridge between the current historical pricing engine and future underwriting,
trigger calibration, and forward-looking pricing.

The first version should stay practical: county-event and county-year features
that can run locally and be inspected in the dashboard/lab.

## Why This Matters

The current v0 engine estimates outage frequency and pricing from outage history
alone. That is a valid baseline, but it cannot explain why one county is
riskier, whether the risk is changing, or whether the current historical average
is still credible.

Enriched datasets let us answer:

- Is high outage frequency associated with known utility reliability metrics?
- Do counties with weaker EIA-861 reliability, lower AMI penetration, or
  specific utility structures show different outage rates?
- Which outage events are associated with wind, flood, winter storm, wildfire,
  heat, or named storms?
- Are some counties Green historically but weak once trigger coverage or utility
  data quality is included?
- Which features can be used without target leakage in a forward-looking model?

## Target Artifacts

### `event_enriched.parquet`

One row per outage event from a selected pricing catalog.

Core fields:

- `catalog_id`
- `event_id`
- `fips`
- `state`
- `county`
- `event_start_utc`
- `event_end_utc`
- `duration_hours`
- `peak_customers_out`
- `customer_minutes_out`
- `threshold_flags`
- `utility_ids`
- `utility_customer_weight`
- `storm_event_ids`
- `hazard_tags`
- `trigger_coverage_score`

### `county_year_features.parquet`

One row per county-year. This is the main modeling table for frequency,
credibility, and forward-looking adjustments.

Feature groups:

- outage history: event counts, duration exceedance counts, customer-minutes
- EAGLE-I data quality: processed years, coverage, DQI when available
- utility reliability: SAIDI, SAIFI, CAIDI, major-event-day variants
- utility structure: IOU/co-op/municipal mix, customer counts, utility count
- grid condition proxies: AMI penetration, circuit counts, demand response
- hazard exposure: storm event counts by peril, wind/hail/flood/winter tags
- socioeconomic/exposure: commercial establishments or population if needed

### `utility_county_crosswalk.parquet`

A many-to-many crosswalk from utility to county.

Minimum fields:

- `utility_id`
- `utility_name`
- `fips`
- `state`
- `county`
- `customers`
- `customer_weight_in_county`
- `source_year`
- `source`

### `feature_dictionary.md`

Human-readable documentation for every feature, source, join key, timestamp
rule, lag rule, and known caveat.

## Initial Data Sources

### Existing engine outputs

- `price_engine/catalogs/eagle-i-30min`
- `price_engine/catalogs/eagle-i-45min`
- `price_engine/catalogs/eagle-i-60min`
- top-level default catalog outputs in `price_engine/data/`
- `MCC.csv`, `coverage_history.csv`, `DQI.csv`

### Utility and grid features

- EIA-861 reliability data: SAIDI, SAIFI, CAIDI where reported.
- EIA-861 service territory data: utility-to-county mapping.
- EIA-861 advanced metering data: AMI penetration by utility/state/sector.
- EIA-861 distribution systems data: distribution circuit and voltage
  optimization fields where usable.
- Later: FERC Form 1 capex/O&M for investor-owned utilities.
- Later: state PUC reliability/capex filings for richer state-specific detail.

### Hazard and weather context

- NOAA Storm Events Database: county-level storm events and event types.
- FEMA disaster declarations: large-event tagging.
- NHC hurricane tracks for named-storm context.
- Later: gridded weather reanalysis for wind, temperature, precipitation, and
  heat/cold stress.
- Later: wildfire and vegetation risk layers where relevant.

### Trigger and oracle context

Not first implementation unless a vendor extract exists.

Planned fields:

- Ting/PowerOutage coverage status
- oracle source availability
- oracle event overlap indicators
- trigger alignment factor

## Join Strategy

### Time

- Store all event timestamps in UTC.
- Convert external local timestamps to timezone-aware UTC before joining.
- For annual utility features, use source year and lag rules explicitly.
- For forward-looking models, do not use a feature from the same or future year
  unless it would have been available at underwriting time.

### Geography

- Use county FIPS as the first join key.
- Keep utility joins many-to-many. Do not force one county to one utility.
- Weight utility features by customer share where EIA service territory data
  supports it.
- Keep state/FEMA region fallback features for counties with sparse data.

### Hazards

- Join NOAA Storm Events by FIPS and temporal overlap with an outage event.
- Allow a configurable buffer before outage start and after outage end.
- Keep both binary tags and counts by event type.
- Do not assume causality from overlap. Treat hazard tags as context unless
  separately validated.

## Leakage Rules

This dataset will eventually feed forward-looking models, so leakage discipline
must be built in from the start.

- Lag annual reliability and capex features by at least one year for prediction.
- Use only information available before the underwriting or forecast date.
- Separate descriptive event labels from predictive features.
- Keep target variables in a distinct target block.
- Document publication lags for every annual source.

## First Milestones

1. Create a source inventory and schema for enriched artifacts.
2. Build the EIA-861 utility-to-county crosswalk.
3. Add EIA-861 reliability and AMI fields to county-year features.
4. Join NOAA Storm Events to outage events and county-years.
5. Generate QA summaries:
   - missingness by state/FIPS
   - feature coverage by year
   - event hazard-tag distribution
   - utility-weight sanity checks
6. Add lab notebooks/scripts comparing county premiums before and after
   selected enrichment features.

## Open Decisions

- Whether the first capex layer should start with FERC Form 1 only, or with a
  broader but noisier EIA/state-utility proxy.
- Whether enriched datasets should be catalog-specific from the start or built
  only for the default 45 minute catalog first.
- Whether hazard joins should use exact event overlap only or include lead/lag
  buffers for restoration and storm onset behavior.
- How to expose enrichment confidence in the dashboard without overloading the
  current pricing UI.

## References Checked

- EIA-861 data files:
  https://www.eia.gov/electricity/data/eia861/
- EIA reliability definitions:
  https://www.eia.gov/electricity/annual/table.php?t=epa_11_01
- NOAA Storm Events Database:
  https://www.ncei.noaa.gov/stormevents/
- NOAA Storm Events bulk CSV access:
  https://www.ncei.noaa.gov/stormevents/ftp.jsp
- EAGLE-I dataset descriptor:
  https://www.nature.com/articles/s41597-024-03095-5
