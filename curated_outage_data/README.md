# Curated Outage Data

This folder is the working home for curated outage datasets that sit beside,
but do not replace, `price_engine/`.

`price_engine/` answers:

```text
Given the current historical EAGLE-I event catalog, what is the v0 empirical
premium?
```

`curated_outage_data/` answers:

```text
What enriched, validated, and reusable event/feature datasets should exist
around the pricing engine so we can explain causes, compare sources, build
forward-looking features, and improve confidence?
```

## Scope

The curated-data workstream has two large pieces.

### Piece 1: Cause Attribution

Enrich EAGLE-I-derived outage events with likely causes where public evidence
supports it.

Initial target sources:

- NOAA Storm Events Database.
- DOE / OE-417 electric emergency incident and disturbance records.
- FEMA disaster declarations and named-storm references later if useful.

Important rule: unattributed is an acceptable result. We should not force a
cause label when overlap evidence is weak.

### Piece 2: Grid Condition And Context Features

Build county-year and utility-county features that describe the condition,
management, reliability, and hazard context around the grid.

Initial target sources:

- EIA-861 reliability, service-territory, customer, AMI, and distribution data.
- FERC Form 1 / PUDL utility financial and plant data for capex/O&M proxies.
- NOAA / FEMA hazard history.
- State PUC data later, one state at a time.

## Relationship To Existing Reference Material

The old design material lives under:

```text
docs/extra/outage_modeling_us/ideas/unified_outage_archive/
```

That folder is reference material. This folder is the new canonical working
location for curated datasets in this repo.

## Folder Map

```text
curated_outage_data/
├── README.md
├── plan/                 phase plans and decision records
├── sources/              source inventory and acquisition notes
├── schemas/              target artifact schemas
├── pipelines/            future ingestion/enrichment scripts
├── validation/           QA, reconciliation, and source comparison plans
├── learning/             feedback and lessons from each phase
├── outputs/              generated reports/exports; local and gitignored
└── data/                 raw/interim/processed local data; gitignored
```

## Workflow

Each phase should follow the same operating loop:

```text
research -> reason -> decide -> plan -> execute -> feedback -> learning
```

No source should move into ingestion until it has:

- a source note;
- a schema note;
- a join strategy;
- a leakage rule if it may feed forward-looking models;
- a validation plan.

## Current Status

Status: planning skeleton.

Next step: Phase 1 cause-attribution research and design, starting with NOAA
Storm Events and DOE/OE-417.
