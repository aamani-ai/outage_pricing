# Pricing Roadmap

- **Status:** living document - updated as tracks move between gates
- **First written:** 2026-05-30
- **Last reviewed:** 2026-06-17

## What this document is

This is the single scan page for how outage pricing matures from the current
baseline into a location-aware, forward-looking product.

The dashboard sidebar's **Current status** widget renders the compact version of
this page. The methodology library renders this full page.

## The Flow

The pricing stack should be read in this order:

```text
1. Baseline pricing
2. Basis-risk adjustments
3. Forward-regime reads and modifiers
4. Trigger alignment
```

That order is deliberate. First we build a clean empirical baseline. Then we
fix measurement gaps between the county data and the policy being sold. Then we
add forward-looking reads. Finally, we align the historical pricing source with
the live payout oracle.

In the pricing adjustment mechanism taxonomy, the two headline adjustment
families are `basis_alignment` and `forward_regime`. Trigger alignment is a
`basis_alignment` mechanism with native target `trigger_source`; the roadmap
keeps it visually separate because it is contract/oracle-critical. See
[Pricing Adjustment Mechanisms](../dicsscssion/pricing_adjustment_mechanisms/).

## Status Labels

| Status | Meaning |
|---|---|
| **shipped** | Built and visible in the dashboard or active pricing surface |
| **wip** | Design or implementation is actively moving |
| **discussion** | Framed and documented, but needs external/data decisions before implementation |
| **planned** | Known future track, not yet actively worked |
| **parked** | Valid later track, intentionally deferred |

Important nuance: **shipped** does not always mean active premium mutation. The
predictability and shadow-lambda layer is shipped as a dashboard pricing-read
layer, but it still needs review before final price implementation.

## 1. Baseline Pricing

### County empirical baseline - **shipped**

- **What it does:** estimates county-level outage frequency from EAGLE-I event
  history by threshold `T`.
- **Why it matters:** this is the empirical backbone. It is stable,
  reproducible, and audit-friendly.
- **Current read:** keep this as the starting point even as better adjustment
  layers are added.
- **Methodology:** [Pricing](pricing_methodology.md);
  [County-Trigger Pricing fundamentals](fundamentals/county_trigger_pricing_fundamentals.md).

### Event catalog and modelability tiers - **shipped**

- **What it does:** turns EAGLE-I snapshots into events, annualizes them, and
  labels counties Green / Amber / Red for modelability.
- **Why it matters:** prevents the dashboard from treating weak historical
  evidence as fully quoteable evidence.
- **Methodology:** [Event Catalog Creation](event_catalog_creation_methodology.md),
  [Aggregation and Annualization](aggregation_and_annualization_methodology.md),
  [Filtration](filtration_methodology.md).

## 2. Basis-Risk Adjustments

Basis-risk work fixes gaps between what the data measures and what the policy
sells. These are not climate forecasts. They are data-grain corrections.

### Customer basis risk - **shipped**

- **What it does:** prices per insurable entity by adjusting the county event
  rate with the per-customer chain.
- **Why it matters:** closes the biggest v0 confusion: county-trigger event
  rates are not the same thing as per-policy expected loss.
- **Current read:** this is the headline dashboard premium.
- **Plan:** [Per-Customer Pricing Plan](../plan/per_customer_pricing_plan.md).
- **Walkthrough:** [Per-customer view - end-to-end](per_customer_view_walkthrough.md).
- **Model card:** [`customer_impact_v1`](../../curated_outage_data/model_cards/customer_impact_v1.md).

### Location basis risk - **wip**

- **What it does:** starts correcting the gap between county-average outage
  experience and the insured location's likely experience.
- **Why it matters:** two addresses in the same county can have different
  utility territory, feeder, vegetation, terrain, and restoration context.
- **Current read:** design and pre-op plan are written; next step is a capped
  shadow artifact, not active pricing.
- **Plan:** [Location Basis Risk Pre-Op Plan](../plan/location_basis_risk_preop_plan.md).
- **Design note:** [Location Basis Risk Design](../dicsscssion/location_aware_outage_pricing/03_location_basis_risk_design.md).

## 3. Forward-Regime Reads And Modifiers

Forward-regime work asks whether the future should differ from the historical
baseline. Some parts are already useful as pricing-read layers; others still
need hazard, utility, or validation work before they can affect price.

The forward-regime lane has three sibling mechanisms:

```text
predictability pattern read = empirical shape / routing
hazard & weather context    = storm, wildfire, flood, wind, climate
grid condition              = utility, infrastructure, restoration context
```

Predictability is useful now because the hazard and grid layers are not active
yet. It should not be read as the container for hazard. Once hazard/weather and
grid-condition models exist, predictability should help diagnose whether those
models explain the observed pattern or whether a county remains review-only.

### Predictability routing and shadow frequency read - **shipped**

- **What it does:** labels county annual outage histories as smooth,
  step-change, volatile, stable, episodic, or sparse, then routes the county
  to the right pricing-read mechanism: frequency lambda, uncertainty review,
  hazard context, or quoteability review.
- **Why it matters:** it separates direction from reliability. A rising trend
  is not automatically a reliable forecast; the pattern tells us whether to
  trust the line, use a recent regime, keep the average, or require review.
- **Pricing boundary:** shipped as a pricing-read / shadow layer. It does not
  mutate active v0 premiums until category verification and holdout review pass.
- **Methodology:** [Outage Predictability Pattern](fundamentals/outage_predictability_fundamentals.md);
  [Lambda Shadow Pricing](fundamentals/lambda_shadow_pricing_fundamentals.md).
- **Verification:** [Lambda Shadow Pricing Verification Plan](../plan/lambda_shadow_pricing_verification_plan.md).

### Grid condition - **wip**

- **What it does:** asks whether the serving grid looks stronger or weaker than
  the historical county record alone implies. This is a first-class
  forward-regime lane, not a sub-part of predictability.
- **Examples:** utility reliability, AMI penetration, service-territory
  fragmentation, ownership type, capex/opex and hardening signals.
- **Current read:** feature and validation work is underway conceptually, but no
  active pricing modifier is ready.
- **Plan:** [Forward-Looking Modeling Plan - Grid condition modifier](../plan/forward_looking_modeling_plan.md#grid-condition-modifier).

### Hazard and weather - **wip**

- **What it does:** connects outage patterns to storm, wildfire, wind, flood,
  winter-weather, heat, and other hazard context. This is a first-class
  forward-regime lane, not a fallback footnote inside predictability.
- **Current read:** this is the teammate-dependent hazard input. It should plug
  into the pricing stack after the baseline and basis-risk layers are coherent.
- **Plan:** [Forward-Looking Modeling Plan - Hazard modifier](../plan/forward_looking_modeling_plan.md#hazard-modifier);
  [Adjustment Framework resource backlog](../plan/outage_baseline_adjustment_framework.md#resource-backlog-for-adjustment-work).

## 4. Trigger Alignment

Trigger alignment is last because it is not a pricing estimator. It is the
contract/oracle bridge between how we price historical events and how a live
policy would decide payout.

### Trigger source alignment - **discussion**

- **What it does:** maps the historical pricing source (EAGLE-I county events)
  to the live payout oracle, such as a licensed outage feed, utility OMS, or
  sensor network.
- **Why it matters:** a price can be statistically sound and still fail if the
  contract pays against a different event definition.
- **Current read:** this is no longer an undefined blocker. The source options
  and tradeoffs are documented. Implementation still needs a selected live
  oracle and overlap data.
- **Plan:** [Trigger Source Options](../plan/trigger_source_options.md);
  [Trigger Source Implications](../plan/trigger_source_implications.md).

## Parked Architectural Tracks

These are real product needs, but they should not distract from the current
sequence.

### Portfolio aggregation - **parked**

- **What it does:** prices portfolios of multiple policies with correlated
  outage loss, instead of treating each policy as standalone.
- **Plan:** [Portfolio Risk Engine Plan](../plan/portfolio_risk_engine_plan.md).

### Portfolio concentration handling - **parked**

- **What it does:** handles tail/concentration risk as the book grows in hazard
  counties.
- **Reference:** [Concentration and Portfolio Risk](concentration_and_portfolio_risk.md).

## Current Priority

The immediate priority is:

```text
location basis risk shadow artifact
lambda shadow category verification
hazard/weather handoff
advisor-ready narrative
```

Do not jump straight to forward hazard pricing before the location-basis bridge
is understandable. The product is sold for a location, so the pricing story has
to make the county-to-location step explicit.
