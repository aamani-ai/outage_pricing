# Phase 2: Grid Condition Features

Date: 2026-05-18

## Goal

Build county-year and utility-county features that describe the grid condition,
utility reliability, investment, and operating context around outage risk.

This phase should not start with modeling. It should start by creating
well-documented, lag-safe features that can later support modeling.

## Why This Is Separate From Cause Attribution

Cause attribution is event-level:

```text
What external event may explain this outage?
```

Grid condition is structural and annual:

```text
What does the local grid / utility environment look like before the outage year?
```

Mixing those grains too early creates leakage and interpretation problems.

## Candidate Source Groups

### EIA-861

Initial feature families:

- reliability metrics: SAIDI, SAIFI, CAIDI where reported;
- customer counts;
- utility-to-county service territory data;
- AMI / smart meter penetration;
- distribution and demand-side program fields where useful;
- utility ownership class.

Role:

- first public, national utility-context source;
- likely Phase 2 starting point.

### FERC Form 1 / PUDL

Initial feature families:

- transmission and distribution plant;
- plant additions;
- O&M;
- utility financial and operational metrics;
- capex proxies for major investor-owned utilities.

Role:

- useful for utility investment and grid-condition proxies;
- not complete for every utility type.

### State PUC Sources

Role:

- richer reliability, circuit, vegetation, and capex context where available;
- state-by-state enhancement layer.

Risk:

- inconsistent formats;
- high acquisition/parsing cost;
- should not block national baseline.

### Hazard And Exposure Context

Potential features:

- NOAA Storm Events annual counts by peril;
- FEMA disaster declarations;
- hurricane/wind/winter storm history;
- later gridded weather extremes and wildfire/vegetation layers.

## Target Artifacts

### `utility_county_crosswalk.parquet`

Minimum fields:

| Field | Meaning |
|---|---|
| `utility_id` | source utility identifier |
| `utility_name` | source utility name |
| `state` | state |
| `fips` | county FIPS |
| `county` | county name |
| `customers` | source customer count |
| `customer_weight_in_county` | utility share in county when computable |
| `source_year` | source year |
| `source` | source table |

### `county_year_features.parquet`

Minimum feature groups:

| Group | Example fields |
|---|---|
| outage targets | event count, 8h+ count, 12h+ count, customer-minutes |
| utility reliability | SAIDI, SAIFI, CAIDI, reporting basis |
| utility structure | ownership mix, utility count, customer weights |
| grid investment | capex/O&M proxies, plant additions where available |
| technology | AMI penetration, demand response where usable |
| hazard history | storm counts by peril, disaster declarations |
| data quality | source coverage, missingness, join confidence |

## Leakage Rules

This phase must be strict about time.

Rules:

```text
If predicting year Y:
    features from annual source year Y are not allowed unless publication timing proves availability before underwriting.

Default:
    lag annual utility and capex features by at least one year.
```

Every feature must document:

- source year;
- publication timing if known;
- lag used;
- whether it is descriptive-only or model-eligible.

## Validation

Minimum QA:

```text
[ ] utility-county customer weights sum correctly
[ ] missingness by state/year/source
[ ] reliability metric coverage by utility type
[ ] feature distributions by state and year
[ ] outlier utility capex/O&M values inspected
[ ] county-year row count matches expected FIPS x years
[ ] no same-year leakage in model-eligible features
```

## Deliverables

1. EIA-861 source note.
2. Utility-county crosswalk design.
3. County-year feature schema.
4. First EIA-only county-year feature prototype.
5. Missingness and coverage report.
6. Decision note on whether FERC/PUDL enters immediately or in a later pass.

## Open Decisions

- Should Phase 2 start at national scope or a pilot state?
- Should EIA-861 be aggregated from utility to county by customer count only, or
  should service territory geometry be introduced early?
- Which capex/O&M fields are defensible as grid-condition proxies?
- How should co-op and municipal utilities be handled when FERC Form 1 is not
  available?
- Which features should be descriptive-only versus model-eligible?

## Recommended First Step

Start with EIA-861 only.

Reason:

- national source;
- direct reliability relevance;
- useful utility-county crosswalk;
- lower complexity than FERC/state PUC data.

Then add FERC/PUDL once the utility-county join and leakage rules are stable.
