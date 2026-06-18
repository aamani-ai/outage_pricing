# Pricing Adjustment Mechanism Design

Date: 2026-06-17

## Why this exists

The project now has several pricing-related tracks:

- baseline county-trigger pricing;
- shipped per-customer basis-risk correction;
- in-design location basis risk;
- predictability patterns and shadow lambda;
- future grid, hazard, and weather reads;
- trigger-source alignment.

All of these can affect the final premium, but they do not all mean the same
thing. A trend signal, a customer-basis correction, a location-basis bridge, an
uncertainty load, and a live-trigger-source bridge are different kinds of
evidence.

The pricing adjustment mechanism taxonomy gives us one coherent architecture:

```text
Native model first.
Factor second.
Premium-impact composition third.
```

The factor is the common expression layer. It is not the common modeling layer.

## Main Decision

Use two headline buckets for the business story:

| Headline bucket | Meaning | Examples |
|---|---|---|
| `basis_alignment` | Corrects mismatch between what the data measures and what the policy sells. | customer basis, location basis, trigger-source alignment |
| `forward_regime` | Adjusts or reviews the future loss view because the county, grid, hazard, or outage regime may be changing. | trend lambda, step-change regime, grid condition, hazard/weather |

Then require every adjustment or review item to carry tags:

| Tag | Meaning |
|---|---|
| `native_target` | What the model actually acts on: frequency, exposure, load, gate, trigger source, or hazard context. |
| `status` | Whether the item is `active`, `shadow`, `review`, `wip`, or `blocked`. |
| `control_tags` | Optional warning tags such as `credibility_uncertainty`, `hazard_review`, `trigger_alignment`, or `quote_gate`. |

This keeps the story simple without flattening the math.

## Native Target Tags

| Native target | Meaning | Factor interpretation |
|---|---|---|
| `frequency_lambda` | Candidate annual qualifying event rate. | Event-rate factor: `lambda_candidate / lambda_v0`. |
| `exposure_basis` | County-event exposure corrected toward the policyholder or location. | Exposure factor applied before or around lambda. |
| `trigger_source` | Historical pricing source converted toward live payout oracle behavior. | Source-alignment factor or review gate. |
| `load_margin` | Confidence, residual noise, variance, or data-quality load. | Load factor, not frequency movement. |
| `quote_gate` | Data sufficiency, modelability, or no-quote decision. | Gate or fallback, usually no numeric factor. |
| `hazard_context` | Storm, wildfire, flood, weather, or climate regime evidence. | Future hazard factor, frequency support, or review gate. |

## Where Hazard Lives

Hazard/weather is a first-class `forward_regime` mechanism. It does not live
inside predictability.

The separation should be:

```text
Predictability pattern = what the annual outage series looks like.
Hazard/weather        = why outage risk may be changing.
Grid condition        = why infrastructure response may be changing.
```

Predictability is currently useful because hazard/weather and grid-condition
models are not active yet. It gives us a transparent empirical read: smooth
trend, step change, stable noisy, episodic, sparse. But once hazard and grid
layers exist, predictability should become a diagnostic and routing layer:

```text
Does the hazard/grid model explain the observed pattern?
If yes: route the price read through that mechanism.
If no: keep the empirical pattern as a shadow/read or review flag.
```

This is especially important for episodic and volatile counties. A spike year
should not become a large trend-based lambda uplift just because the annual
series is noisy. The first question should be whether storm, wildfire, flood,
wind, winter weather, heat, or utility/grid context explains the pattern.

## Current Mechanism Register

| Item | Headline bucket | Native target | Status | Current read |
|---|---|---|---|---|
| Baseline county lambda | baseline, not adjustment | `frequency_lambda` | active reference | Historical county-event rate. |
| Customer basis risk | `basis_alignment` | `exposure_basis` | active | Converts county-event view toward per-customer expected loss. |
| Location basis risk | `basis_alignment` | `exposure_basis` | wip | Future county-to-insured-location bridge. |
| Trigger source alignment | `basis_alignment` | `trigger_source` | discussion/review | Aligns historical pricing source with live payout oracle. |
| Smooth worsening / improving | `forward_regime` | `frequency_lambda` | shadow | Candidate lambda moves toward fitted trend, guarded. |
| Step-change up / down | `forward_regime` | `frequency_lambda` | shadow | Candidate lambda moves toward recent regime, guarded. |
| Volatile trend | `forward_regime` | `frequency_lambda` + `load_margin` | shadow/review | Small frequency read plus review. |
| Stable predictable | `forward_regime` | `frequency_lambda` | shadow | Keep historical average. |
| Stable noisy | `forward_regime` | `load_margin` | review | Keep frequency; consider uncertainty load. |
| Episodic/spiky | `forward_regime` | `hazard_context` | review/wip | Keep frequency until hazard context exists. |
| Sparse history | `forward_regime` | `quote_gate` | review | Do not infer trend; quoteability/credibility issue. |
| Grid condition | `forward_regime` | `hazard_context` or `load_margin` | wip | Utility reliability/capex evidence, not active yet. |
| Hazard/weather | `forward_regime` | `hazard_context` | wip | Storm, wildfire, flood, climate context. |

Important nuance: trigger alignment is listed under `basis_alignment` because it
corrects a measurement/contract mismatch, not a forward forecast. It still gets
its own `native_target = trigger_source` because the live payout oracle problem
is contract-critical and should be visible separately in the UI.

## Factor Is Expression, Not Meaning

For the lambda-shadow layer:

```text
lambda_candidate = selected forward frequency estimator
factor           = lambda_candidate / lambda_v0
premium_effect   = premium_v0 * factor
```

That is a frequency-first model. The factor is derived only because premium is
linear in lambda when payout and load assumptions are unchanged.

For a confidence load:

```text
uncertainty_factor = selected load multiplier
premium_effect     = premium_v0 * uncertainty_factor
```

That is not a frequency model. It may produce the same premium movement as a
lambda factor, but the reason is different.

Therefore the platform should never display a factor without its mechanism:

```text
1.20x frequency_lambda     != 1.20x load_margin
1.20x exposure_basis       != 1.20x trigger_source
```

## Premium Impact Composition

The long-run premium-impact composition should look like this:

```text
premium_candidate =
  premium_baseline
  * basis_alignment_factors
  * forward_regime_factors
  * load_margin_factors
```

Expanded:

```text
premium_candidate =
  premium_baseline
  * customer_basis_factor
  * location_basis_factor
  * trigger_alignment_factor
  * forward_frequency_factor
  * uncertainty_load_factor
```

Some entries may be `1.00x`, review-only, or absent. A missing factor is not the
same thing as zero impact. It can mean the mechanism has not been validated yet.

## Required Fields For Future Adjustment Artifacts

Minimum fields for any adjustment artifact:

| Field | Meaning |
|---|---|
| `headline_bucket` | `basis_alignment` or `forward_regime` |
| `native_target` | One of the native target tags above |
| `control_tags` | Optional list such as `credibility_uncertainty`, `hazard_review`, `trigger_alignment`, `quote_gate` |
| `status` | `active`, `shadow`, `review`, `wip`, or `blocked` |
| `native_estimator` | Model or estimator family in native units |
| `native_value_v0` | Baseline value in native units, if applicable |
| `native_value_candidate` | Candidate value in native units, if applicable |
| `factor` | Premium-impact expression, if numeric |
| `factor_scope` | What the factor is allowed to multiply |
| `reason` | Human-readable explanation |
| `guardrail` | Cap, floor, no-quote gate, review requirement, or none |
| `activation_gate` | What must be true before this can become active |

## Active, Shadow, Review, WIP

Keep four states separate:

| State | Meaning | Example |
|---|---|---|
| `active` | Changes the displayed production/headline price today. | Per-customer basis correction |
| `shadow` | Numeric candidate exists, visible for review, not active premium mutation. | Predictability-selected lambda candidate |
| `review` | Directional logic exists, but no production numeric factor yet. | Stable-noisy uncertainty load hint |
| `wip` | Design/data work still needed before a factor or gate exists. | Hazard/weather, grid condition, location basis pre-op |

The current shadow-pricing layer is the right holding area because it exposes
candidate price pressure without pretending every pattern is ready to change
active premium.

## How Predictability Fits

Predictability is an empirical shape and routing layer. It is not the hazard
model, and it is not the whole forward-regime model. Predictability patterns
are not all frequency signals.

| Pattern family | Headline bucket | Native target | Pricing read |
|---|---|---|---|
| Smooth worsening | `forward_regime` | `frequency_lambda` | Blend toward fitted forward lambda. |
| Smooth improving | `forward_regime` | `frequency_lambda` | Guarded blend down toward fitted forward lambda. |
| Step-change up | `forward_regime` | `frequency_lambda` | Blend toward recent-regime lambda. |
| Step-change down | `forward_regime` | `frequency_lambda` | Guarded blend down toward recent-regime lambda. |
| Volatile worsening | `forward_regime` | `frequency_lambda` + `load_margin` | Small uplift plus review. |
| Volatile improving | `forward_regime` | `frequency_lambda` + `load_margin` | Very guarded discount plus review. |
| Stable predictable | `forward_regime` | `frequency_lambda` | Keep historical average. |
| Stable noisy | `forward_regime` | `load_margin` | Keep frequency; review uncertainty/load. |
| Episodic/spiky | `forward_regime` | `hazard_context` | Keep frequency until hazard context exists. |
| Sparse | `forward_regime` | `quote_gate` | Credibility/no-quote/fallback, not trend adjustment. |

The dashboard should avoid this shortcut:

```text
pattern -> price multiplier
```

It should show:

```text
pattern -> pricing mechanism -> native candidate -> factor expression
```

The longer-term forward-regime hierarchy should read:

```text
forward_regime
  predictability pattern read   # empirical shape / routing
  hazard & weather context      # storm, wildfire, flood, wind, climate
  grid condition                # utility, infrastructure, restoration context
```

## Ordering And Double Counting

Conceptual order:

1. Start with empirical county frequency.
2. Apply active basis/alignment corrections that are already validated.
3. Add location basis only as a separate county-to-location correction.
4. Add forward-regime frequency candidates only when the signal is truly about
   changing event rate.
5. Give hazard/weather and grid condition their own mechanism lanes; use
   predictability to route into them, not to replace them.
6. Route noisy, episodic, or sparse cases to uncertainty, hazard, or
   credibility mechanisms instead of forcing a lambda movement.
7. Add trigger alignment as a visible basis/alignment component because it is
   about live payout source matching, not future hazard.

Double-counting rule:

```text
The same evidence source cannot create two independent factors unless the two
mechanisms are explicitly separated and validated.
```

Examples:

- Utility identity can support location basis if it explains local outage
  exposure, but capex/hardening should live under grid condition.
- A storm-driven spike should not become both an episodic hazard load and a
  large trend-based lambda uplift without a reason.
- Trigger-source alignment should not be treated as improved hazard prediction.

## Dashboard Implication

The UI should eventually show the mechanism stack, not only a lambda factor:

```text
Current status / price-impact read
Active price basis: per-customer premium
Basis/alignment: customer basis active, location basis WIP
Forward-regime: predictability routing + hazard/grid lanes
Frequency read: +34% shadow, if supported
Controls: stable-noisy uncertainty review, if applicable
Trigger alignment: discussion/review
```

For a stable-noisy county:

```text
Lambda action: keep v0 average
Pricing read: uncertainty review
Frequency factor: 1.00x
Next mechanism: uncertainty load, not frequency change
```

For an episodic county:

```text
Lambda action: keep v0 average
Pricing read: hazard context required
Frequency factor: 1.00x
Next mechanism: storm / wildfire / weather layer
```

This avoids saying "no price impact" when the correct meaning is "no direct
lambda impact yet."

## Open Questions

1. Should the bridge artifact be one unified JSON file, or separate mechanism
   files that the dashboard composes?
2. Should uncertainty loads be additive to the load denominator or
   multiplicative premium factors?
3. Where should active vs shadow status live: schema, manifest, or each row?
4. Should stable-noisy and episodic cases have numeric placeholder factors, or
   only review labels until a real method exists?
5. How do we show uncertainty and hazard review without implying a filed price?
6. Should trigger alignment display under basis/alignment only, or as a
   visually separate contract/oracle section while retaining the same family tag?

## Near-Term Plan

1. Use this design as the project-level vocabulary.
2. Update lambda-shadow docs to say "frequency first, factor second."
3. Update predictability docs to separate frequency patterns from load/gate/
   hazard-review patterns.
4. Update dashboard copy from "shadow lambda adjustment" toward "current
   status" and "price-impact read" where context is broader than lambda.
5. Keep implementation changes small until the mechanism taxonomy stabilizes.
