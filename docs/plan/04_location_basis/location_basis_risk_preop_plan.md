# Location Basis Risk Pre-Op Plan

Date: 2026-06-17

## Status

Pre-op plan. This is the plan for doing the location basis risk work. It does
not change pricing yet.

Companion discussion note:
[`../dicsscssion/location_aware_outage_pricing/03_location_basis_risk_design.md`](../../dicsscssion/location_aware_outage_pricing/03_location_basis_risk_design.md).

## Engineering Read

The right first version is not a black-box premise outage forecast. The right
first version is an explainable county-to-location basis-risk correction.

Current pricing answers:

```text
How often does this county historically cross threshold T?
```

Location basis risk needs to answer:

```text
Is this insured location materially above, near, or below the county average?
```

That distinction matters. A county baseline can be actuarially useful and still
be wrong for an address if the address sits in a different utility territory,
terrain band, vegetation profile, restoration context, or local hazard pocket.

My current view:

1. Keep the county baseline as the pricing backbone.
2. Add a transparent `location_basis_modifier` as a shadow layer first.
3. Use utility identity and local geography as the first explainable bridge.
4. Keep hazard/weather projection separate until the teammate's hazard work is
   ready to plug in.
5. Use clustering for review and segmentation, not as the first pricing formula.

## Target v1 Shape

The near-term candidate stack should be:

```text
lambda_location_candidate(location, T)
  = lambda_county_candidate(fips, T)
    * customer_impact_modifier(fips, T)
    * location_basis_modifier(location, fips, T)
```

Where:

| Term | Status |
|---|---|
| `lambda_county_candidate` | Current v0 county lambda, or later the validated shadow lambda candidate |
| `customer_impact_modifier` | Already shipped basis-risk correction |
| `location_basis_modifier` | New workstream from this plan |

Important: location basis can be developed even while the lambda shadow layer
is still being verified. The two pieces should compose later, but location
basis does not need to wait for the shadow lambda rules to become active.

## Non-Goals

This plan does not try to solve:

- live payout trigger selection;
- premise sensor integration;
- AMI/meter-level activation;
- hazard/weather forecasting;
- grid capex/opex forward projection;
- portfolio accumulation or copula modeling;
- advisor-facing slides.

Those are related tracks. They should not be mixed into the first
location-basis implementation.

## First Decision: Unit Of Analysis

The first hard decision is the local unit.

Candidate units:

| Unit | Strength | Risk |
|---|---|---|
| ZIP | Easy to explain and quote-time friendly | ZIPs are postal, not electrical or hazard boundaries |
| Census tract | Better demographic/geographic unit | Less intuitive for insurance/product readers |
| City/place | Aligns with some external outage APIs | Boundaries can be inconsistent and cities can cross counties/utilities |
| Utility territory | Strong outage/restoration logic | Harder data sourcing and geospatial matching |
| Parcel/premise | Best product unit | Too much data dependency for first version |

Recommended pre-op decision:

```text
Build the first feature pack at ZIP or tract level, with utility identity as a
separate feature when available.
```

This keeps the first version feasible while preserving the path to utility- or
premise-level refinement.

## First Feature Families

The first feature pack should only include features that can be explained as a
relative correction against the county average.

| Family | Use in v0.5 | Pricing interpretation |
|---|---|---|
| Utility identity / service territory | High priority | Restoration and grid-resource basis risk |
| Urban/rural density | High priority | Exposure and restoration proxy |
| Vegetation / land cover | High priority | Tree, wind, wildfire, and access proxy |
| Elevation / slope / terrain | Medium priority | Access, flood, storm, and restoration proxy |
| Historical sub-county outage evidence | High priority if usable | Validation or direct relative signal |
| Utility reliability metrics | Medium priority | Useful if legally sourced and territory-aligned |
| Hazard layers | Later plug-in | Should not be double-counted before hazard methodology lands |
| Capex/opex/hardening | Later plug-in | More likely `grid_condition` than pure location basis |

## Score Construction

The first score should be relative, not absolute:

```text
relative_location_score(location, fips)
  = location risk position compared with other locations inside same county
```

Then convert that score to a capped candidate modifier:

```text
location_basis_modifier = f(relative_location_score, confidence)
```

First-pass rule:

- default modifier is `1.0`;
- weak evidence produces `review_required`, not a numeric move;
- numeric moves are capped;
- discounts require stronger evidence than uplifts;
- no single feature can dominate the modifier.

Suggested early cap range for shadow review:

```text
0.85x <= location_basis_modifier <= 1.35x
```

This cap is not final pricing. It is a review rail so the first artifact does
not overstate precision.

## Artifact To Build

First deliverable should be a shadow file:

```text
location_basis_shadow.json
```

Suggested row grain:

```text
catalog_id
fips
T
location_unit_type
location_unit_id
utility_id
county_lambda
customer_impact_modifier
relative_location_score
location_basis_modifier_candidate
confidence
evidence_level
pricing_action
pricing_read
feature_summary
reason
```

Expected `pricing_action` values:

| Action | Meaning |
|---|---|
| `keep_county_average` | No defensible local movement |
| `review_required` | Directional signal exists, but not enough for numeric factor |
| `basis_uplift_candidate` | Location looks materially riskier than county average |
| `basis_discount_candidate_guarded` | Location looks materially safer, but discount is capped and review-first |
| `no_quote_location_gap` | Location cannot be mapped well enough for the product promise |

## Pre-Op Checks Before Coding

Before building the pipeline, answer these in writing:

1. What local unit will the pilot use?
2. What exact join keys are required at quote time?
3. Which utility identifier source is allowed for internal research?
4. Which features are static basis-risk features versus forward-regime inputs?
5. What is the first cap range and why?
6. What rows become `review_required` instead of numeric modifiers?
7. What rows become `no_quote_location_gap`?
8. What assumption needs to be added to the assumptions registry before any
   active pricing proposal?

## Pilot Plan

Start with a pilot region, not the whole country.

1. Select two or three regions with different outage structures:
   - dense urban/coastal;
   - rural/vegetation-heavy;
   - mixed utility territory or high outage history.
2. Build the local unit crosswalk:
   - address or sample point to county;
   - address or sample point to ZIP/tract;
   - utility identity where available.
3. Build the first feature pack.
4. Convert features to within-county relative scores.
5. Produce a capped shadow modifier.
6. Review top uplifts, top discounts, neutral cases, and unmapped cases.
7. Decide whether the formula is stable enough to run nationally in shadow.

## Validation Plan

Validation should be staged.

| Stage | Goal | Pass condition |
|---|---|---|
| Join validation | Confirm the location can be mapped to the intended unit | High match rate and explicit unknown bucket |
| Face validation | Confirm the biggest uplifts/discounts make intuitive sense | Manual review finds explainable reasons |
| Outcome validation | Check whether local scores separate observed outage experience | Higher-score locations show higher frequency/duration where evidence exists |
| Stability validation | Confirm modifier does not jump wildly across adjacent units | No unexplained cliff effects |
| Commercial validation | Confirm premium movement is usable | No large unexplained discounts or uplifts |

## Dashboard Readout

Do not make this a default map until the shadow artifact is credible.

First dashboard/readout should show:

- county baseline lambda;
- customer-impact-adjusted lambda;
- candidate location basis modifier;
- candidate location lambda;
- confidence and evidence level;
- feature summary;
- reason text;
- map layer only after national coverage is stable.

## Relationship To Lambda Shadow Verification

Location basis and lambda shadow answer different questions:

| Layer | Question |
|---|---|
| Lambda shadow | Which county-level frequency estimator should we trust? |
| Location basis | How different is this insured location from the county average? |

The correct sequence for a quote is:

```text
select county lambda estimator
apply customer impact
apply location basis
then evaluate trigger alignment and forward hazard/grid overlays separately
```

For now, location basis should use the active county pricing lambda. Once the
shadow lambda verification plan passes, the same location basis modifier can be
composed with the improved county lambda candidate.

## Open Risks

- Utility territory matching may be the highest-value feature and the highest
  data-quality risk.
- ZIP-level scoring may be too crude in large western or rural counties.
- Discounts are harder to defend than uplifts without local outcome evidence.
- Physical hazard features can accidentally double-count the later hazard model.
- A clean-looking local modifier can still fail if the live trigger is measured
  at a different grain.

## Stop Conditions

Stop and redesign before implementation if:

- the chosen local unit cannot be joined reliably;
- utility identity cannot be sourced or approximated for the pilot;
- the feature pack mostly duplicates future hazard inputs;
- the first scoring rule creates large discounts without local evidence;
- the team cannot explain a top uplift or discount in one sentence.

## Immediate Next Steps

1. Pick the pilot unit: ZIP vs tract, with utility identity as an optional
   feature.
2. Pick pilot regions.
3. Draft `location_basis_shadow.json` schema.
4. Draft the assumptions-registry entry for the county-to-location bridge.
5. Build only the audit/shadow artifact first.

## Current Position

This should be the next concrete basis-risk workstream. It is more urgent than
forward hazard modeling for v1 because it fixes the product grain: the policy is
sold for a location, while the current baseline is estimated at county level.

The right implementation should be modest, explainable, and capped. If it works,
it becomes the bridge from county pricing to location-aware underwriting. If it
does not work, the failure will still tell us exactly which data source or
spatial grain is missing.
