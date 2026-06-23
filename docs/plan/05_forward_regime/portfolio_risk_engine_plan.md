# Portfolio Risk Engine Plan

Date: 2026-05-19

## Status

Planning note only. Do not implement this inside `price_engine/` yet.

This is a candidate future separate workstream, and possibly a separate repo,
once the outage pricing baseline and curated event dataset are stable.

## Why This Should Be Separate

The current `price_engine/` answers a county-level pricing question:

```text
For county C, how often did outage duration exceed threshold T, and what premium
follows for payout X?
```

A portfolio engine answers a different question:

```text
For many exposures, which ones trigger together, what is the annual aggregate
loss distribution, and where are the concentration risks?
```

Those are connected, but they should not be forced into one code path too early.

## Proposed Project Boundary

| Project | Responsibility |
|---|---|
| `price_engine/` | Historical county-level outage pricing and dashboard |
| `curated_outage_data/` | Enriched outage events, causes, utility/grid features, hazard context |
| future `portfolio_risk_engine` | Exposure import, event replay, ELT/YLT, EP curves, accumulation analytics |

## Required Inputs

1. Exposure table:
   - `exposure_id`
   - `lat`
   - `lon`
   - `fips`
   - `state`
   - `county`
   - `utility_id` where known
   - policy terms or product terms

2. Event catalog:
   - `catalog_id`
   - `event_id`
   - regional event grouping
   - event start/end
   - affected counties or footprint
   - duration / intensity fields
   - event year or simulated year

3. Financial terms:
   - threshold
   - payout
   - limit
   - deductible or waiting period if relevant
   - expense / margin / load assumptions

## Required Outputs

```text
event_loss_table.parquet
year_loss_table.parquet
portfolio_summary.json
ep_curve.csv
accumulation_by_state_county_utility.csv
```

## First Milestones

1. Define the exposure schema.
2. Define how county outage rows become regional event IDs.
3. Build a historical event replay for a small synthetic exposure portfolio.
4. Produce event loss table and year loss table.
5. Calculate AAL, OEP, AEP, and tail metrics.
6. Compare portfolio risk across the 30, 45, and 60 minute outage catalogs.
7. Decide whether the work should remain a folder in this repo or become a
   dedicated repo.

## Open Questions

- What is the first exposure grain: county, business address, utility service
  area, or synthetic portfolio?
- Can we create credible regional outage event IDs from EAGLE-I county events
  alone?
- How much location-basis risk should be handled before portfolio aggregation?
- Should the first YLT use historical calendar years or synthetic years?
- Which concentration dimensions matter most: state, county, utility,
  catastrophe region, trigger threshold, or product segment?

## Related Learning Log

See
[`docs/learning_logs/portfolio_event_catalogs_and_aggregation.md`](../../learning_logs/portfolio_event_catalogs_and_aggregation.md).
