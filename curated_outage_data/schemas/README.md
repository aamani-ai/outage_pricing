# Schema Drafts

This folder documents target schemas before pipeline code is written.

## Planned Artifacts

| Artifact | Grain | Purpose |
|---|---|---|
| `event_enriched.parquet` | one row per outage event | event-level cause/hazard enrichment |
| `event_cause_matches.parquet` | one row per outage-source match | preserve many-to-many source evidence |
| `county_year_features.parquet` | one row per county-year | utility/grid/hazard features |
| `utility_county_crosswalk.parquet` | one row per utility-county-year | weighted utility joins |
| `model_targets.parquet` | one row per county-year-threshold | forward-model target table |

## Schema Rules

- Every artifact must include source and run metadata.
- Every timestamp must state UTC/local policy.
- Every annual feature must state lag rule.
- Every feature must have a unit.
- Every source-derived field must keep enough provenance to trace it.
- Missingness must distinguish unknown, unavailable, not applicable, and not
  evaluated.

## First Schema To Write

Start with:

```text
event_cause_matches.parquet
```

Reason:

Phase 1 should preserve all possible NOAA / OE-417 matches before collapsing to
a single best cause label.
