# Hazard Catalog Architecture By Peril

Date: 2026-05-20

## Purpose

This note turns the hazard-modeling discussion into a repeatable architecture:

```text
raw historical evidence
  -> harmonized historical event catalog
  -> stochastic / synthetic event set
  -> forward-looking adjustment
  -> forward-looking stochastic hazard catalog
  -> risk modeling layer
```

The goal is to document the same architecture for each hazard, but not to rush
all hazards at once. This first version captures the common framework and then
does the first detailed hazard pass for hail, using the reference clone at:

```text
docs/extra/hazard_modeling/docs/datasets-for-hazard-modeling/
```

The next hazards to add in detail are outage, wind, flood, wildfire, and heat.

## Core Definitions

```text
Historical catalog
    What we believe happened.
    It is observed or reconstructed from historical evidence.

Stochastic catalog / synthetic event set
    Plausible event space beyond observed history.
    It is model-generated and should carry event IDs, rates, footprints,
    severity fields, and simulated years where possible.

Forward-looking adjustment
    How event frequency, severity, duration, footprint, or dependence changes
    under future weather, climate, land-use, exposure, grid, or operating
    conditions.
```

Do not call all of these "curated data." A cleaned historical catalog, a
stochastic event set, and a forward-looking catalog are different artifacts with
different validation burdens.

For how vendor catastrophe models appear to handle climate-conditioned event
sets and future risk views, see
[`vendor_cat_models_and_climate_conditioning.md`](vendor_cat_models_and_climate_conditioning.md).

## Common Architecture

```text
RAW HISTORICAL EVIDENCE
NOAA / FEMA / EIA / news / claims / sensors / utility reports / remote sensing
        |
        v
SOURCE CURATION + NORMALIZATION
dedupe, geocode, timestamp, classify peril, standardize severity, add provenance
        |
        v
HARMONIZED HISTORICAL EVENT CATALOG
observed/reconstructed events with event_id, peril, footprint, time, magnitude
        |
        |--------------------------------------------------|
        |                                                  |
        v                                                  v
STOCHASTIC / SYNTHETIC EVENT SET                  FORWARD-LOOKING ADJUSTMENT
10k / 100k simulated events                       climate, weather, exposure,
tail expansion, unseen scenarios,                 grid condition, land-use,
portfolio dependence                              trend / regime shifts
        |                                                  |
        |--------------------------------------------------|
        v
FORWARD-LOOKING STOCHASTIC HAZARD CATALOG
historical + simulated + climate/weather-conditioned event logic
        |
        v
RISK MODELING LAYER
exposure intersection -> vulnerability -> financial terms -> portfolio aggregation
```

## Artifact Ladder

| Layer | Artifact | Main question | Main validation burden |
|---|---|---|---|
| 0 | Raw evidence inventory | What sources exist? | source identity, access, coverage |
| 1 | Harmonized historical event catalog | What happened? | event definition, dedupe, timestamps, geography, magnitude |
| 2 | Stochastic / synthetic event set | What could happen beyond history? | event rates, tail behavior, spatial dependence, simulated years |
| 3 | Forward-looking adjustment model | How does risk shift? | climate/weather drivers, non-stationarity, regime logic |
| 4 | Forward-looking stochastic catalog | What event space should pricing/portfolio use? | consistency between history, simulation, and adjustments |
| 5 | Risk model | What loss/payout/decision follows? | exposure, vulnerability, financial terms, aggregation |

## Reusable Schema Sketch

Every hazard will differ, but the event catalog should try to converge toward:

```text
hazard_event
|-- event_id
|-- hazard
|-- event_family_id
|-- source_family
|-- event_start_utc
|-- event_end_utc
|-- event_window_rule
|-- footprint_geometry_or_grid_ref
|-- footprint_resolution
|-- primary_magnitude
|-- magnitude_units
|-- duration_metric
|-- confidence_score
|-- data_quality_flags
|-- co_hazards
|-- provenance
`-- version
```

For stochastic catalogs, add:

```text
stochastic_event
|-- event_id
|-- catalog_id
|-- simulated_year
|-- annual_event_rate
|-- event_weight
|-- footprint_geometry_or_grid_ref
|-- intensity_field_ref
|-- event_family_id
|-- climate_scenario
|-- model_version
`-- uncertainty_family
```

## Hazard Work Queue

These are the hazards already used in the broader modeling notes.

| Hazard | Event unit | Main magnitude | First detailed status |
|---|---|---|---|
| outage | service interruption interval | duration, customers out | already implemented in `price_engine/`; architecture note still needed |
| hail | hail swath / storm-cell cluster | hail size, MESH, duration, footprint | detailed first pass below |
| wind | gust / windstorm footprint | peak gust, duration, direction | queued |
| flood | inundation / rainfall / streamflow event | depth, velocity, duration | queued |
| wildfire | fire perimeter / smoke / disruption event | intensity, burn probability, smoke duration | queued |
| heat | regional temporal heat episode | temperature, heat index, duration | queued |

## Hail Architecture

### Why Hail First

Hail is a good first hazard because:

- the intensity metric is relatively intuitive: hail size;
- it has clear operational thresholds: 1.00 in, 1.75 in, 2.00 in, 2.75 in;
- it has strong relevance to solar, property, auto, and exposed equipment;
- it forces us to handle a real hazard-modeling problem: reports are biased,
  but gridded radar estimates are not perfect ground truth.

### Hail Common Flow

```text
RAW HAIL EVIDENCE
SPC reports / NCEI Storm Events / MRMS-MESH / MYRORSS / NEXRAD / mPING
SHAVE / CoCoRaHS hailpads / ERA5-MERRA2 / NWS warnings / SPC outlooks
        |
        v
HAIL SOURCE CURATION
threshold harmonization, point-report dedupe, radar grid alignment,
storm-day/event-window grouping, report-bias flags, radar-size calibration
        |
        v
HARMONIZED HISTORICAL HAIL EVENT CATALOG
event_id, storm_day, start/end UTC, swath/footprint, max hail size,
duration, confidence, source mix, co-hazards
        |
        |------------------------------------------------------|
        |                                                      |
        v                                                      v
STOCHASTIC HAIL EVENT SET                            FORWARD HAIL ADJUSTMENT
commercial SCS catalogs, return-period               SPC outlooks, HRRR/HREF,
hail curves, GridRad/MRMS climatology,                MRMS nowcast, NWS warnings,
synthetic storm tracks/swaths                         ERA5/MERRA2 climate proxies
        |                                                      |
        |------------------------------------------------------|
        v
FORWARD-LOOKING STOCHASTIC HAIL CATALOG
historical swaths + synthetic swaths + climate/weather-conditioned frequency
and severity adjustment
        |
        v
HAIL RISK MODELING
asset overlay -> hail intensity at asset -> vulnerability curve -> loss/payout
-> portfolio aggregation
```

### Source Architecture

| Source layer | Candidate sources | Role | Main caution |
|---|---|---|---|
| Long historical reports | SPC Severe Weather Reports, NOAA/NCEI Storm Events | long-run climatology, threshold counts, narratives, damage context | report bias, threshold changes, point reports do not define swaths |
| Gridded radar backbone | MRMS/MESH, MYRORSS, GridRad MESH, NEXRAD Level II/III | footprint, magnitude, duration, spatial dependence | radar-estimated hail size is not measured ground hail size |
| Ground validation | CoCoRaHS hailpads, mPING, SHAVE | size calibration, false-alarm analysis, ground truth | sparse, uneven, participation/research bias |
| Environmental context | ERA5, MERRA-2, SPC mesoanalysis | stationarity tests, severity conditioning, false-alarm filtering | environmental proxy is not observed hail |
| Forecast / nowcast | SPC outlooks, HRRR, HREF, NWS warnings/CAP, MRMS real-time, ProbSevere | near-term event adjustment, active event monitoring | forecast placement/timing errors; warning archives not full climatology |
| Commercial / vendor | Verisk, Moody's RMS, Aon, KatRisk, Cotality/CoreLogic | stochastic catalogs, tail risk, claims-grade footprints, benchmarking | proprietary assumptions, access, limited auditability |

### Historical Catalog Deliverable

The first hail deliverable should not be a loss model. It should be a
historical event catalog.

```text
hail_event_catalog.parquet
|-- event_id
|-- event_family_id
|-- storm_day
|-- event_start_utc
|-- event_end_utc
|-- event_window_rule
|-- max_hail_size_inches
|-- max_hail_size_source
|-- threshold_flags
|   |-- ge_1_00_in
|   |-- ge_1_75_in
|   |-- ge_2_00_in
|   `-- ge_2_75_in
|-- footprint_geometry_or_grid_ref
|-- footprint_resolution
|-- duration_minutes
|-- source_family
|-- source_count
|-- confidence_score
|-- report_bias_flags
|-- radar_quality_flags
|-- co_hazards
|   |-- wind
|   |-- tornado
|   |-- lightning
|   `-- heavy_rain
`-- provenance
```

### Historical Starter Stack

Minimum quick baseline:

```text
SPC hail reports + NCEI Storm Events
        |
        v
dedupe, threshold harmonization, point geocoding
        |
        v
long-run point-report hail catalog
```

Use this only for a quick historical baseline. It is weak for rural
underreporting and cannot give true asset-level swaths.

Stronger gridded baseline:

```text
MYRORSS 1998-2011
        |
        | harmonize with
        v
MRMS/MESH 2010s-present
        |
        v
1 km gridded hail swath / duration / magnitude backbone
        |
        |-- validate with SPC + NCEI reports
        |-- calibrate with CoCoRaHS + SHAVE + mPING
        `-- condition with ERA5 + MERRA-2 environments
```

This is the better path for infrastructure, solar, property, and asset-overlay
use cases.

### Stochastic / Synthetic Hail Options

The stochastic layer exists because historical hail evidence is too short and
too biased for tail and portfolio use by itself.

```text
historical gridded hail catalog
        |
        |-- resample historical swaths with storm-year structure
        |-- fit return-period hail-size curves by region
        |-- generate synthetic storm tracks / swaths
        |-- borrow / benchmark commercial SCS event catalogs
        `-- preserve dependence with wind / tornado / convective storm family
        |
        v
stochastic hail event set
```

Modeling requirements:

| Requirement | Why it matters |
|---|---|
| event ID | same storm must hit all affected exposures together |
| simulated year | portfolio annual loss needs event clustering |
| footprint | point reports alone cannot support asset overlay |
| intensity field | vulnerability depends on hail size at asset |
| event rate | converts event set to annual frequency |
| storm-family dependence | hail often co-occurs with wind, tornado, lightning, outage |

### Forward-Looking Hail Adjustment

Forward-looking hail is not just "more hail or less hail." Different pieces may
move differently:

```text
hail occurrence frequency
large-hail conditional probability
hail size distribution
storm mode / supercell environment
spatial shift of convective activity
seasonality
co-hazard mix with wind/tornado/lightning
```

Short-range forward adjustment:

```text
historical/stochastic baseline
        |
        |-- SPC Day 1-2 hail probabilities
        |-- SPC mesoanalysis: instability, shear, lapse rates, significant hail
        |-- HRRR deterministic storm fields
        |-- HREF ensemble/neighborhood probabilities
        |-- NWS warnings/CAP fields such as observed/radar-indicated hail
        `-- real-time MRMS/MESH nowcast confirmation
        |
        v
conditional near-term hail risk
```

Longer-horizon forward adjustment:

```text
historical/stochastic hail baseline
        |
        |-- ERA5/MERRA-2 severe-convective environments
        |-- climate model changes in CAPE, shear, freezing level, lapse rates
        |-- regional trend / regime analysis
        |-- land-use and exposure changes where relevant
        `-- validation against held-out years and independent reports
        |
        v
climate/weather-conditioned hail event catalog
```

Important caution:

```text
Climate change can affect hail occurrence and hail size differently.
Smaller hail frequency and very-large-hail risk may not move in the same
direction.
```

### Hail Modeling Decisions To Make Before Implementation

| Decision | Options | Why it matters |
|---|---|---|
| First event threshold | 1.00, 1.75, 2.00, 2.75 in | determines frequency, severity, and product relevance |
| Event geometry | point cluster, radar swath, gridded raster, storm-cell track | determines exposure overlay quality |
| Event family | standalone hail vs severe convective storm family | determines dependence with wind/tornado/outage |
| Historical backbone | SPC/NCEI quick baseline vs MRMS/MYRORSS gridded baseline | determines auditability and spatial precision |
| Use case | solar, property, auto, outage co-hazard, parametric trigger | determines vulnerability and thresholds |
| Stochastic layer | public reconstructed catalog vs commercial benchmark vs custom simulation | determines tail and portfolio credibility |

### Hail Open Questions

- Should first hail modeling optimize for solar asset damage, property damage,
  outage co-hazard analysis, or generic hazard screening?
- Is the first threshold 1.00 inch for severe hail, or 1.75/2.00/2.75 inches
  for asset-damage relevance?
- Should event IDs represent hail-only swaths or broader convective storm
  families?
- Can we make MRMS/MYRORSS harmonization reproducible enough for a Gen 1
  gridded catalog?
- Which commercial stochastic catalogs are useful for benchmarking, and which
  are too opaque for internal learning?

### Hail Recommendation

For a serious CONUS hail model, start with:

```text
MRMS/MESH + MYRORSS
      as gridded footprint / duration / magnitude backbone

SPC + NCEI Storm Events
      as long historical report and narrative baseline

CoCoRaHS + SHAVE + mPING
      as calibration and validation

ERA5 + MERRA-2
      as environmental conditioning and stationarity context

SPC + HRRR + HREF + NWS alerts + real-time MRMS
      as forecast and nowcast adjustment
```

Use commercial severe-convective-storm catalogs as benchmarks and possible
downstream complements, not as the only source of truth for an auditable
internal model.

## Next Hazard Sections To Add

Add each hazard in a separate pass using the same structure:

```text
1. hazard common flow
2. source architecture
3. historical catalog deliverable
4. historical starter stack
5. stochastic / synthetic options
6. forward-looking adjustment
7. modeling decisions
8. open questions
9. recommendation
```

Proposed order:

```text
1. outage
2. wind
3. flood
4. wildfire
5. heat
```

## References

- Local reference clone:
  `docs/extra/hazard_modeling/docs/datasets-for-hazard-modeling/`
- Source GitHub repository:
  https://github.com/d14847300-tech/hazard-modeling/tree/main/docs/datasets-for-hazard-modeling
- NOAA/NCEI Storm Events:
  https://www.ncei.noaa.gov/stormevents/
- SPC Storm Reports:
  https://www.spc.noaa.gov/climo/reports/
- NOAA/NSSL MRMS:
  https://www.nssl.noaa.gov/projects/mrms/
- NOAA NEXRAD Level II metadata:
  https://www.ncei.noaa.gov/access/metadata/landing-page/bin/iso?id=gov.noaa.ncdc%3AC00345
- NOAA mPING:
  https://mping.nssl.noaa.gov
- NOAA/NSSL Hail Research and SHAVE:
  https://www.nssl.noaa.gov/research/hail/
- NOAA HRRR Open Data Registry:
  https://registry.opendata.aws/noaa-hrrr-pds/
- NWS API documentation:
  https://www.weather.gov/documentation/services-web-api
