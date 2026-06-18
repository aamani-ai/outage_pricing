# Location Basis Risk Design

Date: 2026-06-17

## Status

Discussion/design note. Do not change pricing from this file yet.

This note turns the location-basis-risk discussion into a concrete design
track. It is meant to sit before implementation, not after it.

Implementation companion:
[`../../plan/location_basis_risk_preop_plan.md`](../../plan/location_basis_risk_preop_plan.md).

## Empirical Update — 2026-06-17 (Steps 1–2b of the research plan)

The research plan
([`../../plan/location_basis_research_plan.md`](../../plan/location_basis_research_plan.md))
has produced its first results — findings in
[`../../extra/poweroutage_us/docs/06_findings.md`](../../extra/poweroutage_us/docs/06_findings.md)
sets 6–7 and
[`../../extra/location_features/docs/01_findings.md`](../../extra/location_features/docs/01_findings.md).
They sharpen this design in three ways.

### 1. What the modifier IS: a rurality frequency relativity

The within-county location-basis modifier is a **frequency relativity**:

- *frequency* — it scales how OFTEN a location crosses the outage threshold (the
  λ), not how long the outage lasts or how severe it is. Duration is a different
  lane (point 2).
- *relativity* — an actuarial multiplicative factor against a base: "this
  location's qualifying-outage rate = R × its county-average customer's rate." It
  is **mean-1, exposure-weighted within each county** (the conservation
  constraint): relativities *redistribute* risk inside a county; they do not
  change the county total (that is the county-λ + customer-basis layer's job).
- *simple / explainable* — a small relativity keyed on an interpretable variable
  (rurality), each value carrying a one-sentence physical reason, not a black-box
  score. This is standard ratemaking and is what an actuary / capacity provider
  can review.

**Rurality** is the latent "how exposed is the local distribution grid"
construct — long overhead radial feeders, heavy tree contact, low redundancy,
sparse crews (rural) vs undergrounding, looped feeders, dense crews (urban). We
proxy it. The data say the proxy works: within a county, **density** (PoUS
customers / Census land-area km²) ranks towns' relative outage rates better than
raw size, and the gradient is large and monotone — at T≥4h the rural third runs
~**1.9×** its county average, the urban third ~**0.72×**, widening to ~3× spread
at T≥8h. ~1 in 10 customers sits in a ≥2× cell.

### 2. Lane correction: utility identity is DURATION/grid, not within-county basis

The June meeting bundled utility identity into location basis; the data pull it
apart. In CT/MA/RI only 16 of 459 towns are split across utilities, so utility is
collinear with town and explains ≤4% of within-county variance (confounded).
Utility identity's real, non-redundant value is in **restoration duration** and
forward capex/opex hardening — the `grid_condition` / forward-regime lane, NOT
the static within-county frequency relativity. Keeping it there also avoids
double-counting the county baseline, which already embeds the serving utility's
historical performance.

### 3. How we solve it (build path)

1. Choose the rurality variable(s) — density now; test whether NLCD tree canopy
   adds lift *beyond* density next.
2. Estimate the relativity per rurality bucket = exposure-weighted within-county
   relative (the tercile means are the seed).
3. Credibility-smooth thin buckets toward 1 (the structural-vs-noise check in
   Finding 6 governs how hard).
4. Express as a monotone, mean-1 relativity curve `f(rurality)`, **capped for
   attribution confidence** — the cap reflects how confidently we can place a
   specific address in the tail, not the signal size (which is ~1.9× at p90, far
   beyond the old `[0.85, 1.35]` rail).
5. Validate out-of-sample (hold-out counties) and out-of-region (e.g. TX) before
   activation; the town→premise last mile stays open until live geometry / meter
   data.

The original problem framing, candidate inputs, and guardrails below remain
valid; this update narrows them to what the evidence now supports.

## Problem

The current outage baseline starts from a county-level historical rate:

```text
lambda_county(fips, T)
  = qualifying county events at threshold T / observed source years
```

That is a defensible national baseline, but the product is sold for a
specific insured location. The gap is:

```text
county outage event != insured-location outage event
```

Two addresses in the same county can have different outage exposure because of
service territory, restoration priority, feeder condition, terrain,
vegetation, wildfire/wind/flood exposure, urban/rural density, and local grid
resources. If we price every address as the county average, we can overprice
low-risk locations and underprice high-risk locations.

## Working Definition

`location_basis_modifier(location, fips, T)` is a basis-risk correction that
moves a county-average frequency toward the best estimate for the insured
location.

It is not a forward-looking hazard forecast. It is also not the live trigger.
It answers a narrower question:

```text
Given the county historical baseline, is this location expected to be above,
near, or below the county average for the same outage threshold?
```

Conceptual future form:

```text
lambda_location(location, T)
  = lambda_county(fips, T)
    * location_basis_modifier(location, fips, T)
```

This modifier should shrink or retire as the baseline itself becomes more
local. If we eventually have feeder, circuit, premise, or oracle-overlap
history, the baseline should absorb most of this correction.

## Boundary Conditions

Keep these separate:

| Concept | Role |
|---|---|
| Historical pricing source | The event history used to estimate baseline frequency |
| Location basis modifier | Bias correction from county average to insured location |
| Live payout trigger | Contractual oracle that decides whether a payout happened |
| Forward hazard/grid modifier | Projection that says the future may differ from history |

Important boundaries:

- The location basis layer does not prove the trigger source is valid.
- The trigger source does not, by itself, prove the price is correctly local.
- Meter-level data is not required for Gen 1, but would improve or retire the
  modifier later.
- County-to-city or county-to-utility evidence can support an assumption, but
  it is not the same as premise-level validation.

## Why Utility Information Matters

The meeting notes made utility identity more important than a simple spatial
lookup. Utility identity can matter through two different channels:

| Channel | Where it belongs | Example |
|---|---|---|
| Static service-territory basis | `location_basis` | This address is served by a utility whose historical local restoration behavior differs from the county average. |
| Time-varying grid condition | `grid_condition` or forward-regime layer | The serving utility is investing, hardening, deferring maintenance, or changing operations in a way that may change future outage risk. |

This split matters because the first channel is a basis-risk correction, while
the second is a forward-looking overlay that needs stronger validation before
activation.

## Candidate Inputs

The first design pass should rank inputs by availability, interpretability, and
whether they can be defended as a relative county-to-location correction.

| Input family | First use | Notes |
|---|---|---|
| County and state FIPS | Required join key | Current baseline unit. |
| ZIP, city, tract, or census place | Candidate sub-county unit | Better than county, but boundaries may not match utility service or trigger geography. |
| Utility identifier / service territory | High-priority feature | Captures restoration responsibility and resource differences. Needs careful mapping. |
| Urban/rural density | Relative vulnerability and restoration proxy | Dense areas may restore faster but can have more exposed customers. Direction needs empirical check. |
| Elevation, slope, terrain | Physical vulnerability proxy | Useful for storm, flood, access, and vegetation interaction. |
| Vegetation / land cover | Physical vulnerability proxy | Important for wind, wildfire, tree contact, and restoration access. |
| Wildfire, tropical cyclone, wind, flood exposure | Hazard context | Should usually inform a hazard/weather layer, but may help explain static local vulnerability. |
| Utility reliability metrics | Utility/grid quality proxy | SAIDI/SAIFI/CAIDI, if licensed or reliably sourced. Must align to territory and time. |
| Capex/opex/grid-hardening data | Forward signal | More likely `grid_condition` than pure location basis. |
| Parcel, feeder, circuit, AMI, sensors | Later validation or replacement | Best local evidence, but not Gen 1 dependency. |

## Proposed v0.5 Architecture

The near-term target should be a shadow artifact, not an active pricing change:

```text
location_basis_shadow.json
  fips
  location_unit_type       # zip, tract, city, utility territory, parcel, etc.
  location_unit_id
  T
  county_lambda
  relative_location_score
  candidate_modifier
  confidence
  evidence_level
  pricing_read
  reason
```

The modifier should be neutral by default:

```text
candidate_modifier = 1.0
```

Only move away from 1.0 when the evidence is strong enough to explain why the
insured location is different from the county average.

## First-Use Rule

For the first pricing-readable version, the modifier should be conservative:

- Use relative scores inside a county, not national absolute scores.
- Cap early numeric movement until validation exists.
- Allow `gate_only` or `review_required` when confidence is low.
- Do not apply an automatic discount from weak evidence.
- Do not stack the same signal twice through both `location_basis` and
  `grid_condition`.

Suggested first statuses:

| Evidence state | Pricing treatment |
|---|---|
| No sub-county evidence | Modifier stays 1.0 |
| Directional but weak evidence | Review flag only |
| Strong relative evidence, no outcome validation | Shadow numeric modifier with cap |
| Strong evidence plus local outcome validation | Candidate for active basis-risk modifier |
| Feeder/premise history available | Rebuild baseline locally and retire modifier where possible |

## Relationship To Shadow Lambda Pricing

The lambda shadow-pricing layer answers:

```text
Which county/threshold lambda estimator looks best given annual pattern?
```

Location basis answers:

```text
How should that county lambda be adjusted for this insured location?
```

These should compose in order:

```text
lambda_pricing_candidate(location, T)
  = lambda_county_candidate(fips, T)
    * customer_impact_modifier(fips, T)
    * location_basis_modifier(location, fips, T)
```

The location layer should not decide whether a county is smooth, step-change,
volatile, stable, sparse, or episodic. That is the predictability/shadow-lambda
layer's job.

## Validation Plan

Validation should start small and visible.

1. Choose a small set of states or regions where the county baseline, utility
   mapping, and sub-county identifiers are clean enough to inspect.
2. Build a feature pack at one candidate unit: ZIP, tract, city, or utility
   territory.
3. Compare each local unit to its county average using only features available
   before pricing.
4. Where local outage evidence exists, check whether the candidate score
   separates higher and lower observed outage frequency or duration.
5. Produce a shadow modifier distribution and inspect the largest uplifts,
   largest discounts, and neutral cases.
6. Document failure modes before deciding whether any numeric modifier can
   activate.

## Open Questions

- What is the first addressable unit: ZIP, tract, city, utility territory, or
  a hybrid?
- Is the first deliverable a quote-time modifier, an underwriting review flag,
  or a dashboard-only shadow layer?
- Which utility data is legally and operationally usable for pricing versus
  research?
- Should static utility territory effects live in `location_basis` while
  capex/opex and hardening effects live in `grid_condition`?
- How much discounting is acceptable before premise-level validation exists?
- Can PowerOutage.US city-utility history validate any part of the county-to-
  location bridge, or does it mainly inform trigger alignment?
- What assumption must be added to the assumptions registry before activation?

## Near-Term Deliverables

1. Select the first spatial unit and write the join semantics.
2. Draft a schema for `location_basis_shadow.json`.
3. Build a research notebook or pipeline for one pilot region.
4. Add an assumptions-registry entry only when the proposed numeric modifier is
   specific enough to review.
5. Add dashboard readouts only after the shadow artifact has enough examples to
   inspect.

## Current Read

This track is necessary before advisor-facing pricing is complete. The county
baseline is still the correct backbone, but location basis is the next major
basis-risk correction after customer impact. It should be handled as a
documented, capped, reviewable modifier first, then activated only after the
team has evidence that the correction improves the county-to-location bridge.
