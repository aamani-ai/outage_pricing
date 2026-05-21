# Utility County Crosswalk Schema

Status: draft

## Purpose

`utility_county_crosswalk.parquet` connects utility-level public records to
county-level outage pricing and modeling records.

This is a many-to-many table. A county can have multiple utilities, and a
utility can serve multiple counties.

## Grain

One row per:

```text
source_year x source x utility_id x county_fips
```

## Fields

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `source_year` | int | yes | Reporting year from the source dataset. |
| `source` | string | yes | Example: `EIA861`. |
| `utility_id` | string | yes | Source utility identifier. Preserve source format. |
| `utility_name` | string | yes | Source utility name. |
| `state` | string | yes | Two-letter state abbreviation. |
| `fips` | string | yes | Five-digit county FIPS. |
| `county` | string | yes | County name from the source or normalized lookup. |
| `customers` | float | preferred | Customer count tied to the utility-county row when available. |
| `customer_weight_in_county` | float | preferred | Utility share of county customers, 0-1. |
| `ownership_type` | string | optional | IOU, cooperative, municipal, public, etc. |
| `service_territory_basis` | string | optional | County list, customer count, geometry, or other source basis. |
| `join_confidence` | string | yes | `high`, `medium`, or `low`. |
| `notes` | string | optional | Caveats or normalization notes. |

## QA Rules

- `fips` must be five digits and stable as a string.
- For each `source_year x fips`, `customer_weight_in_county` should sum near
  1.0 when customer counts are complete.
- Missing customer counts are allowed but must lower `join_confidence`.
- Utility names should be preserved from source data, with normalized names
  stored only in an additional field if needed.

## Modeling Rule

This table is descriptive by default. Any feature derived from it for predicting
year `Y` must use a lagged source year unless publication timing proves the
same-year value was available before the decision date.
