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

## Three categorical buckets

Every track on this roadmap sits in one of three buckets, in the order
the team works through them. The order is **structural, not arbitrary**
— see [Why this order matters](#why-this-order-matters) for the
principle that drives the sequence.

| Bucket | What it does | What unlocks each track |
|---|---|---|
| **Basis-risk adjustments** | Close the gap between what the data measures and what the contract sells. Make a derivation using what we already have. | A documented assumption in the [registry](assumptions.md) with a stated resolution path. The shipped per-customer chain is the prototype. |
| **Trigger alignment** | Bridge between the historical pricing source (EAGLE-I) and the live payout oracle (vendor or utility OMS). Categorically different from basis-risk: not a derivation we can make, it's a contract-data integration. | A contracted live feed + overlap data so the bridge can be calibrated. |
| **Forward-regime improvements** | Signals that project beyond what history evidences. Calibrate the future, not correct the present. | External validation against forecast or held-out evidence — same activation rule the original lifecycle described. |

## Why this order matters

The team's working principle, in one line: **fix the data-input layer
before improving the model on top of it.**

Concretely, that means the basis-risk adjustments are closed first
(customer ✓, location next), the trigger alignment is bridged once the
live-oracle data exists, and only **then** do the forward-regime
modifiers (grid condition, hazard & weather) layer on top.

The reason is structural, not stylistic: if the data-input grain
doesn't match what the contract sells — e.g. county-event grain
priced as if it were per-customer — no amount of forward modeling can
compensate. A perfect climate or grid model layered on top of a
baseline that is 100× off when read per-customer doesn't shrink that
100× factor; it just adds modelled signal to a misaligned starting
point. The downstream work would not be usable in the right way.

The same logic applies to trigger alignment: even with all basis-risk
adjustments closed, if the contract pays against a different event
definition than the price is calibrated to, the live payouts and the
priced rate diverge. Trigger alignment closes that loop before we
layer on the forward-regime signals that depend on a coherent baseline
beneath them.

This is why the dashboard's sidebar groups tracks into these three
buckets visually. The grouping is not just organizational — it
encodes the *sequence* in which the team works.

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

### Customer basis risk · **shipped 2026-05-30 · headline price**

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

## Basis-risk adjustments (in flight)

### Location basis risk · **research**

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

## Trigger alignment (blocked on vendor)

### Trigger source alignment · **blocked on vendor**

- **What it does:** bridges the gap between the historical pricing
  source (EAGLE-I event definitions) and the live payout oracle (Ting
  Insights, utility OMS, licensed PowerOutage.US live feed, etc.).
  Without this, a live parametric product would be priced against one
  event definition and paid against another.
- **Why it is its own bucket:** unlike the basis-risk adjustments,
  this is **not a derivation we can make** from data we already have.
  It is a contract-data integration that requires a contracted live
  feed and overlap data so the bridge can be calibrated.
- **Current state:** plan written; alignment-factor schema reserved.
  No vendor contract or overlap data yet.
- **Unlocks:** a contracted live oracle (Ting / PoUS / utility OMS)
  with retention, audit, and methodology-change notice; followed by a
  bridge-validation lab that compares pricing-catalog events to oracle
  events over the same time/geography.
- **Plan:** [Trigger Source Implications](../plan/trigger_source_implications.md).

---

## Forward-regime improvements

### Outage trend · **shipped 2026-06-03 · descriptive**

- **What it does:** computes the **11-year yearly-event-count slope** per
  county at each duration threshold. Classifies counties as worsening /
  stable / improving / insufficient-data using a `t_stat > 1.5` noise gate.
  Surfaces on the dashboard as a map color mode (Outage trend · 11yr ·
  T=4h) and as a sparkline + slope + ±1σ band in the per-county
  detail panel.
- **Why it matters:** the trend is the **single upstream signal** that the
  grid_condition, hazard, and weather modifiers all need to consume —
  "is this county changing?" Building it once and surfacing it descriptively
  unlocks the forward-regime conversation without forcing any of those
  modifiers to ship first.
- **What it deliberately does NOT do:** the trend is **descriptive only**.
  It does not enter `λ`, the per-customer multiplier, or any priced
  quantity in v0. Pricing remains the full 11-year empirical baseline.
- **Known confound:** part of the upward signal across counties may
  reflect **EAGLE-I coverage drift** (utility coverage growing from
  ~early-window levels to ~92% by 2022) rather than real grid degradation.
  A coverage-stable subset backtest is the first thing to do before the
  trend is allowed into any pricing modifier.
- **Asymmetric-confound principle:** coverage drift can only ADD
  detected events over time, never subtract — so the "improving" (blue)
  class is reliable while the "worsening" (red) class is ambiguous.
  This shapes how the map should be read (see the methodology doc) and
  how the validation work is sequenced (the improving class is the
  cleanest signal to anchor on).
- **Methodology:** [`fundamentals/outage_trend_fundamentals.md`](fundamentals/outage_trend_fundamentals.md).
  Schema: [`curated_outage_data/schemas/county_yearly_trend.md`](../../curated_outage_data/schemas/county_yearly_trend.md).
- **Validation plan:** [`docs/plan/outage_trend_validation_plan.md`](../plan/outage_trend_validation_plan.md)
  tracks five tracks for separating real signal from coverage drift
  (coverage-stable subset · NOAA storm overlay · cross-T consistency ·
  utility disaggregation · PoUS cross-check) with an explicit activation
  gate before the trend can graduate into a pricing input.
- **Unlocks:** the data substrate for the three planned forward-regime
  modifiers below.

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

### Portfolio concentration handling · **lagged (v1)**

- **What it does:** explicit treatment of the tail / variance side of
  the portfolio story — concentration loading at point of sale,
  reinsurance cessions, or held capital against a TVaR / OEP
  percentile of portfolio annual loss. Sister track to *Portfolio
  aggregation* above: aggregation handles the mean, concentration
  handles the second moment.
- **Why it matters:** by linearity of expectation, mean portfolio
  loss is concentration-invariant — v0's per-policy pricing is
  correct on the mean. Variance is not: when one county event
  triggers all `N` policies in that FIPS jointly, portfolio
  variance scales as `N²` (not `N`), so standard deviation scales
  as `√N` versus the independence-implied baseline. The per-customer
  [A011](assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation)
  overestimation cushion lives on the mean and provides **zero**
  protection against this tail blow-up.
- **Why lagged.** At SMB scale, typical per-county policy counts are
  1–3 — absolute tail dollars stay small. Tail risk bites first in
  *hazard-prone* counties (hurricane belt, storm corridors, fire
  zones) where both `p` and `N` rise together as the book scales.
  Activation is not a chronological milestone but a **threshold on
  policies-per-county in a hazard-tiered county** (working target:
  any hazard-prone county with `N ≥ 10`, or any non-hazard county
  with `N ≥ 50`).
- **Treatment paths.** Concentration loading (easiest, internal),
  reinsurance (externalises tail, requires market), capital reserves
  (internalises tail, ties up balance sheet). Documented end-to-end
  in [`concentration_and_portfolio_risk.md`](concentration_and_portfolio_risk.md).
- **Cross-links:** [A007](assumptions.md#a007--each-policy-is-priced-standalone-no-portfolio-correlation-in-v0),
  [`concentration_and_portfolio_risk.md`](concentration_and_portfolio_risk.md),
  [Portfolio Risk Engine Plan](../plan/portfolio_risk_engine_plan.md).

---

## Sequencing — visual summary

```text
v0  →  ✓ customer basis-risk  →  + location basis-risk  →  + trigger alignment  →  + grid condition  →  + hazard & weather
       (shipped 2026-05-30)      (research)                 (blocked on vendor)    (planned)            (planned)
       └── basis-risk adjustments ──┘   └── trigger alignment ──┘   └── forward-regime improvements ──┘
```

The dashboard's `What's next` widget visualises this sequence by
grouping the tracks into the three buckets in the same order.

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
