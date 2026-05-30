# Forward-Looking Roadmap

- **Status:** living document — updated as tracks move between gates
- **First written:** 2026-05-30
- **Last reviewed:** 2026-05-30

## What this document is

A roll-up view of every forward-looking track in the project, organized by
**modifier lifecycle category** ([A-framework reference](../plan/outage_baseline_adjustment_framework.md#modifier-lifecycle)).
This file is the single place to scan "what's next" without opening each
individual plan.

The dashboard sidebar's **What's next** widget renders a compact summary
of this list; the library's **Roadmap** section renders this full
document.

## Two modifier categories

Every track on this roadmap belongs to one of two families:

```text
total_adjustment
  = bias_correction_modifiers     ← shrink with better data; can retire
  * forward_regime_modifiers      ← structural; do NOT shrink with data quality
```

**Bias-correction modifiers** exist because the *measurement* of the
baseline is imperfect. Better data on the relevant dimension makes them
collapse toward 1.0 and eventually retire (absorbed into the baseline
rate).

**Forward-regime modifiers** exist because the *future* may not look
like the past. Even perfect history does not eliminate them; better data
only calibrates them more tightly.

## Track statuses

| Status | Meaning |
|---|---|
| **shipped** | Live in v0 pricing math |
| **shadow** | Emitting parallel data on the dashboard, not yet in pricing |
| **research** | Notebook / lab investigation in progress; pre-production |
| **planned** | Plan doc written; execution gated on prerequisites |
| **blocked** | Plan written; execution waiting on external dependency |
| **parked** | Plan exists; deferred to a later version |

---

## Shipped (this release)

### Per-customer rate · **shipped 2026-05-30 · headline price**

- **What it does:** prices per insurable entity (one metered electric
  account = one policy) using `λ_county × E[mean_customers / MCC |
  duration ≥ T]`. This is the dashboard's headline annual premium.
- **Why it matters:** closes the largest interpretation gap in v0 —
  pricing on a county-event rate while quoting per customer. The
  per-customer view is the price.
- **Graduation:** terminal state **(b) Activate as numeric multiplier**
  was selected via the documented graduation discussion (see plan).
  Refinement of the underlying [A011](assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation)
  is queued as Phase 4 but is not gating.
- **Plan:** [Per-Customer Pricing Plan](../plan/per_customer_pricing_plan.md) (Phases 1–3 and 5 closed; Phase 4 is refinement).
- **Walkthrough:** [Per-customer view — end-to-end](per_customer_view_walkthrough.md).
- **Model card:** [`customer_impact_v1`](../../curated_outage_data/model_cards/customer_impact_v1.md) (status: shipped).

## Bias-correction tracks (in flight)

### Trigger source alignment · **blocked on vendor**

- **What it does:** measures and adjusts for the gap between
  historical EAGLE-I event definitions and the live oracle that
  determines payouts (Ting Insights, OMS, licensed PowerOutage.US live
  feed, etc.). Without this, a live parametric product would be priced
  against one event definition and paid against another.
- **Why it matters:** this is a **blocker** for selling a live
  parametric product, not a nice-to-have. The county-trigger contract
  v0 prices isn't the contract a customer would actually buy in
  production.
- **Current state:** plan written; alignment-factor schema reserved.
  No vendor contract or overlap data yet.
- **Unlocks:** a contracted live oracle (Ting / PoUS / utility OMS)
  with retention, audit, and methodology-change notice; followed by a
  bridge-validation lab that compares pricing-catalog events to oracle
  events over the same time/geography.
- **Plan:** [Trigger Source Implications](../plan/trigger_source_implications.md).

### Location basis · **research**

- **What it does:** adjusts for the gap between the *county-aggregate*
  event experience and the *insured premise's* experience. A policy on
  a resilient downtown feeder shouldn't pay the same premium as one on
  a tree-heavy rural feeder in the same county.
- **Why it matters:** the per-customer view is the *county-average*
  per-customer rate. Real customers vary widely within a county. A
  premise-aware rate is the long-term right answer.
- **Current state:** problem framing done (basis-risk discussion).
  No feature build or data source yet.
- **Unlocks:** premise-level data — feeder maps, AMI, utility
  service territory, or trigger-source coverage maps.
- **Plan:** [Location-aware pricing problem framing](../dicsscssion/location_aware_outage_pricing/01_problem_framing.md);
  [research backlog](../dicsscssion/location_aware_outage_pricing/02_research_backlog.md).

---

## Forward-regime tracks

### Grid condition · **planned**

- **What it does:** asks whether the grid serving a county appears
  stronger or weaker than the historical outage record alone implies —
  using utility reliability history (SAIDI / SAIFI / CAIDI), reliability
  trend, AMI penetration, distribution-circuit indicators, capex /
  O&M proxies, utility ownership mix (IOU / co-op / municipal /
  public power), and service-territory fragmentation.
- **Why it matters:** EAGLE-I's history is what the grid HAS done.
  Grid-condition features describe what the grid is LIKELY to do given
  observable infrastructure differences. Without this, a fast-modernizing
  utility's customers pay the same rate as a stagnant one.
- **Current state:** plan written; feature list specified;
  county-year backtest scaffold sketched. No feature build yet.
- **Unlocks:** EIA-861 reliability data + utility-county crosswalk +
  AMI penetration data (PUDL or similar).
- **Plan:** [Forward-Looking Modeling Plan §Grid condition modifier](../plan/forward_looking_modeling_plan.md#grid-condition-modifier).

### Hazard & weather · **planned**

- **What it does:** adjusts for the county's outage-causing weather
  environment — storm frequency by peril, wind / hail / flood / winter
  storm / heat / cold / wildfire / hurricane tags, seasonal
  concentration, disaster declaration history, gridded weather
  extremes. Either historical-features-conditioning or
  forecast-horizon-driven.
- **Why it matters:** climate is the canonical "future doesn't look
  like past" risk. Counties whose hazard profile is shifting (more
  storms, hotter, more wildfire) deserve different forward rates than
  their history alone implies.
- **Current state:** plan written; sources bookmarked (NOAA Storm
  Events, HRRR, CONUS404, CONUS404-PGW). No feature build yet.
- **Unlocks:** NOAA Storm Events ingestion + spatial join to FIPS;
  optional: HRRR / CONUS404 ingestion for higher-resolution weather
  features.
- **Plan:** [Forward-Looking Modeling Plan §Hazard modifier](../plan/forward_looking_modeling_plan.md#hazard-modifier);
  resource backlog in [adjustment framework](../plan/outage_baseline_adjustment_framework.md#resource-backlog-for-adjustment-work).

---

## Architectural tracks (separate from modifiers)

### Portfolio aggregation · **parked (v1)**

- **What it does:** prices for portfolios of N policies in the same
  FIPS using correlated-loss math instead of treating each policy as
  standalone (v0's [A007](assumptions.md#a007--each-policy-is-priced-standalone-no-portfolio-correlation-in-v0)).
- **Why it matters:** capacity / reinsurance conversations need
  portfolio expected loss, not just per-policy. Each county event hits
  all policies in that FIPS simultaneously — a real correlation
  structure that v0 ignores.
- **Plan:** [Portfolio Risk Engine Plan](../plan/portfolio_risk_engine_plan.md).

---

## Sequencing principle

Bias-correction tracks are sequenced **before** the forward-regime
tracks for a reason: a forward-regime modifier whose effect is at most
±20% on `λ(T)` cannot be honestly calibrated on top of a baseline that
is 30–100× off when read as per-customer. Fix the denominator first
(per-customer rate ✓ shipped), then bridge to the live oracle (trigger
alignment), then localize (location basis), and only *then* layer
climate / grid condition on top.

```text
v0  →  ✓ per-customer  →  + trigger alignment  →  + location basis  →  + grid condition  →  + hazard & weather
       (shipped 2026-05-30)  (blocked on vendor)    (research)            (planned)            (planned)
```

The dashboard's `What's next` widget walks the team through that
sequence at a glance.

## A note on the activation lifecycle (refinement 2026-05-30)

The original activation rules in the
[adjustment framework](../plan/outage_baseline_adjustment_framework.md#modifier-lifecycle)
were written as a single uniform pattern (graduate only after external
validation). Shipping the per-customer track surfaced a useful
distinction worth recording in the framework itself:

- **Bias-correction modifiers** are measurement corrections on top of
  v0. They reduce a known systematic error. For these, the right gate
  is "is the underlying assumption documented in the registry with a
  resolution path?" — exactly what we did for [A011](assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation).
  External validation is **refinement** that tightens the assumption;
  it is not a hard precondition for shipping the corrected baseline.
- **Forward-regime modifiers** are projections — climate, grid
  condition, hazard. They claim something about the future that the
  past does not directly evidence. For these, the original rule stands:
  external validation is required before they enter pricing math,
  because no amount of assumption documentation substitutes for
  empirical projection accuracy.

This distinction has been folded into the
[adjustment framework's modifier-lifecycle section](../plan/outage_baseline_adjustment_framework.md#modifier-lifecycle).
