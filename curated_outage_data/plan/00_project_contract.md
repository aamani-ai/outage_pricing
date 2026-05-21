# Phase 0: Project Contract

Date: 2026-05-18

## Goal

Create a separate curated-data workstream that builds enriched outage event and
feature datasets around the existing `price_engine/` artifacts.

The goal is not to rebuild the pricing engine. The goal is to create durable
datasets that support:

- cause attribution;
- external validation;
- utility and grid-condition context;
- forward-looking modeling;
- trigger-source bridge analysis;
- better modelability and confidence decisions.

## Boundary

### In Scope

- Read generated event catalogs from `price_engine/`.
- Add cause and hazard context to events where evidence supports it.
- Build county-year and utility-county features.
- Document source, schema, join, leakage, and validation rules.
- Produce local reproducible artifacts.
- Support future dashboard/modeling work.

### Out Of Scope For Now

- Replacing v0 empirical pricing.
- Building a live trigger system.
- Building a public general-purpose outage database.
- Committing raw third-party data or large generated outputs.
- Forcing cause labels on events without enough evidence.

## Canonical Inputs

Initial input is the selected `price_engine` catalog.

Priority order:

1. `price_engine/catalogs/eagle-i-45min/` as the first default.
2. `30min` and `60min` catalogs for sensitivity.
3. Top-level `price_engine/data/` only as fallback legacy output.

## Target Artifacts

### `event_enriched.parquet`

One row per outage event from one selected event catalog.

Purpose:

- preserve event-level pricing evidence;
- add cause/hazard labels;
- support event-review tables and validation;
- create future cause-conditioned modeling targets.

### `county_year_features.parquet`

One row per county-year.

Purpose:

- build forward-looking model features;
- compare counties over time;
- avoid mixing event-level and annual utility-level data.

### `utility_county_crosswalk.parquet`

Many-to-many mapping between utility and county.

Purpose:

- allocate utility metrics to counties;
- support weighted reliability/capex features;
- make joins explicit rather than pretending one county has one utility.

### `feature_dictionary.md`

Human-readable field definitions.

Required for every feature:

- source;
- unit;
- grain;
- join key;
- time basis;
- lag rule;
- missingness rule;
- caveat.

## Versioning

Curated outputs should carry:

```text
catalog_id
curation_run_id
source_versions
pipeline_version
created_at_utc
```

If a source refreshes, or a join rule changes, the output is a new curation run.

## Local Data Policy

Generated data and raw downloads are local/reproducible and should stay out of
git unless we explicitly decide otherwise.

Git-tracked files should be:

- plans;
- schemas;
- source notes;
- validation summaries;
- small hand-written examples.

Gitignored files should be:

- raw source downloads;
- parquet/csv/json generated outputs;
- temporary join/interim artifacts;
- large reports.

## Workflow

Every phase follows:

```text
research -> reason -> decide -> plan -> execute -> feedback -> learning
```

The learning step is required. If a source is messy, weak, or not useful, that
is still a useful project result.
