# Planning Notes

This folder holds project-level plans for work that sits above the current
`price_engine/` implementation.

`price_engine/plan/` remains the implementation record for the historical v0
pricing engine. This folder is for the next product and modeling layers:
trigger-source strategy, enriched datasets, and forward-looking modeling.

## Current Plans

- [Per-Customer Pricing Plan](per_customer_pricing_plan.md) — close the gap
  between county-event-rate pricing and per-customer expected loss. This is the
  highest-priority bias-correction track and explicitly sequenced before any
  forward-looking climate / grid / hazard modifier work.
- [Methodology Library Plan](methodology_library_plan.md) — in-dashboard
  reading surface over `docs/methodology/`. Phases L1 + L2 closed 2026-05-30.
- [Trigger Source Implications](trigger_source_implications.md) — pricing-vs-trigger
  architecture and the bridge factor.
- [Trigger Source Options](trigger_source_options.md) — the full option space for
  the live trigger (premise sensors, customer-authorized AMI, satellite, licensed
  aggregator, single-utility pilot, multi-source consensus) on neutrality /
  granularity / cost, with a recommendation; and why a utility self-report is not
  a viable primary trigger.
- [Enriched Event Dataset Plan](enriched_event_dataset_plan.md)
- [Forward-Looking Modeling Plan](forward_looking_modeling_plan.md)
- [Outage Baseline Adjustment Framework](outage_baseline_adjustment_framework.md)
  (includes the [Customer Impact Modifier](outage_baseline_adjustment_framework.md#customer-impact-modifier)
  proposal for handling event-population severity bias)
- [Portfolio Risk Engine Plan](portfolio_risk_engine_plan.md)

## Archive

Completed plans live in [`done/`](done/) once they have shipped to code, docs,
or a follow-on plan. Active plans stay at this level. See
[`done/README.md`](done/README.md) for the archival convention. The folder is
empty today.

## Planning Workflow

Every active plan in this folder is expected to be written and executed in
phases under the following loop, with explicit gates between phases:

```text
research -> reason -> plan -> implementation -> feedback
```

Documents are the first artifact, not the last. When a phase is executed, the
plan and every related document it cross-references must be updated in the same
change so the documentation stays the source of truth.

## Related: Methodology Documentation

Plans describe **what** we will build and in what order. Methodology
describes **how** each canonical step is executed. See
[`../methodology/`](../methodology/) for the authoritative method
descriptions and [`../methodology/assumptions.md`](../methodology/assumptions.md)
for the registry of every explicit assumption made by any methodology or
plan in this project. Cite assumptions by ID (e.g.
`[A001](../methodology/assumptions.md#a001--...)`) rather than restating
them.

## Vendor Data Experiments

- [PowerOutage.US API Analysis](../extra/poweroutage_us/) — NDA-scoped trial
  evaluating whether the PowerOutage.US live API and historical extract can
  shrink the bias-correction modifiers. See its
  [findings](../extra/poweroutage_us/docs/06_findings.md),
  [modifier mapping](../extra/poweroutage_us/docs/04_modifier_mapping.md), and
  the reusable [operating guide](../extra/poweroutage_us/guide/SKILL.md).

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
