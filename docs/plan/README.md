# Planning Notes

This folder holds project-level plans for work that sits above the current
`price_engine/` implementation.

`price_engine/plan/` remains the implementation record for the historical v0
pricing engine. This folder is for the next product and modeling layers:
trigger-source strategy, enriched datasets, and forward-looking modeling.

> Plans are grouped into step subfolders (`02_per_customer/`, `03_risk_clustering/`,
> `04_location_basis/`, `05_forward_regime/`, `cross_cutting/`) mirroring the
> [end-to-end framework](../OUTAGE_MODELING_FRAMEWORK.md). `done/` holds shipped plans.

## Current Plans

- [Per-Customer Pricing Plan](02_per_customer/per_customer_pricing_plan.md) — close the gap
  between county-event-rate pricing and per-customer expected loss. This is the
  highest-priority bias-correction track and explicitly sequenced before any
  forward-looking climate / grid / hazard modifier work.
- [Methodology Library Plan](cross_cutting/methodology_library_plan.md) — in-dashboard
  reading surface over `docs/methodology/`. Phases L1 + L2 closed 2026-05-30.
- [Trigger Source Implications](cross_cutting/trigger_source_implications.md) — pricing-vs-trigger
  architecture and the bridge factor.
- [Trigger Source Options](cross_cutting/trigger_source_options.md) — the full option space for
  the live trigger (premise sensors, customer-authorized AMI, satellite, licensed
  aggregator, single-utility pilot, multi-source consensus) on neutrality /
  granularity / cost, with a recommendation; and why a utility self-report is not
  a viable primary trigger.
- [Enriched Event Dataset Plan](05_forward_regime/enriched_event_dataset_plan.md)
- [Forward-Looking Modeling Plan](05_forward_regime/forward_looking_modeling_plan.md)
- [Outage Baseline Adjustment Framework](cross_cutting/outage_baseline_adjustment_framework.md)
  (includes the [Customer Impact Modifier](cross_cutting/outage_baseline_adjustment_framework.md#customer-impact-modifier)
  proposal for handling event-population severity bias)
- [Location Basis Risk Pre-Op Plan](04_location_basis/location_basis_risk_preop_plan.md) - plan
  for turning county-level outage pricing into a location-aware basis-risk
  shadow artifact before any active pricing change.
- [Lambda Shadow Pricing Verification Plan](03_risk_clustering/lambda_shadow_pricing_verification_plan.md)
  (**downstream / gated**) — the forecast-layer price-move check; premised on the superseded
  7-shape categories, so it waits on the regime-routing redesign before it can become an active
  proposal.

> **Step 3 is being redesigned.** The old [Risk-Based Clustering Quantification Plan]
> was closed and archived (see Archive below) — it pre-declared ~7 pattern shapes that turned out
> to overlap. The replacement is the **regime-routing** direction in
> [`../OUTAGE_MODELING_FRAMEWORK.md`](../OUTAGE_MODELING_FRAMEWORK.md) (Step 3 ▸ *Reframe — REGIME
> ROUTING*); the lean backtest-design plan that supersedes it is
> [Regime Routing — Backtest Design Plan](03_risk_clustering/regime_routing_backtest_plan.md).
- [Inner-Event Shape Cell-Read Plan](cross_cutting/inner_event_shape_confidence_plan.md)
  - uses event-summary shape proxies for evidence reliability and proxy-posture
  reads on the per-customer conversion, without changing active pricing.
- [Per-County Trigger Validity Plan](cross_cutting/per_county_trigger_validity_plan.md)
  (**gated**) - the third cell-read facet: per-county "is the ≥T event genuine/sustained or a
  thin-tail artifact?" routing. Deferred (national verdict + high-T target suffice); build when
  we expand below 8h or underwriting wants per-county write/no-write.
- [Portfolio Risk Engine Plan](05_forward_regime/portfolio_risk_engine_plan.md)

## Related Architecture Discussions

- [Pricing Adjustment Mechanisms](../dicsscssion/pricing_adjustment_mechanisms/)
  - project-level vocabulary for combining basis/alignment and forward-regime
  adjustments into a common premium-impact view without treating every factor
  as the same kind of model.

## Archive

Completed plans live in [`done/`](done/) once they have shipped to code, docs,
or a follow-on plan. Active plans stay at this level. See
[`done/README.md`](done/README.md) for the archival convention.

- [2026-06-22 — Risk-Based Clustering Quantification Plan](done/2026-06-22_risk_based_clustering_quantification_plan.md)
  — the 7-shape Step-3 approach. Phase 1 (observed-zero vs missing) shipped as the source-coverage
  mask; the shape catalog was superseded by regime routing. See its Closure note.

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
