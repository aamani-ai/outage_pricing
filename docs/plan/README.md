# Planning Notes

This folder holds project-level plans for work that sits above the current
`price_engine/` implementation.

`price_engine/plan/` remains the implementation record for the historical v0
pricing engine. This folder is for the next product and modeling layers:
trigger-source strategy, enriched datasets, and forward-looking modeling.

## Current Plans

- [Trigger Source Implications](trigger_source_implications.md)
- [Enriched Event Dataset Plan](enriched_event_dataset_plan.md)
- [Forward-Looking Modeling Plan](forward_looking_modeling_plan.md)

## Planning Principles

- Keep historical pricing, contractual trigger, and forward-looking prediction
  as separate concepts.
- Treat EAGLE-I as the pricing and backtesting backbone unless a better
  historical source is contracted.
- Treat any live payout trigger as an insurance-grade oracle problem, not only a
  data science problem.
- Document all time semantics, spatial joins, annualization choices, and source
  limitations before using a dataset in pricing.
- Prefer reproducible local artifacts first, then production integrations.
