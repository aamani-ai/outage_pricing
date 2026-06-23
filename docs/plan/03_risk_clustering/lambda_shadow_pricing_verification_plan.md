# Lambda Shadow Pricing Verification Plan

Date: 2026-06-17

> **⚠ Downstream / gated (2026-06-22).** This verifies the **forecast-layer price-move** (turning a
> pattern into a λ adjustment) — it sits AFTER the current Step-3 deliverable and is premised on the
> superseded 7-shape categories. It re-activates once **regime routing** lands (the regime is the
> router; this is one thing an expert it routes to could do): see
> [`../../OUTAGE_MODELING_FRAMEWORK.md`](../../OUTAGE_MODELING_FRAMEWORK.md) Step 3 ▸ *Reframe — REGIME ROUTING*.

## Status

Active validation plan. The shadow layer is a candidate-pricing artifact and
does not change active v0 premiums yet.

This plan exists because the first dashboard review mostly checked the obvious
smooth-trend cases. Before the team can treat shadow lambda as a serious
pricing read, every pattern category must be verified against the intended
rule, guardrail, and business interpretation.

This plan now follows the pricing adjustment mechanism taxonomy:

```text
native model first -> factor second -> premium-impact view third
```

The lambda-shadow artifact is a `forward_regime` adjustment whose native target
is `frequency_lambda` when the pattern actually supports a frequency read.
Stable-noisy, episodic, and sparse rows must remain review/gate paths rather
than being forced into a lambda move. See
[`../dicsscssion/pricing_adjustment_mechanisms/01_pricing_adjustment_mechanism_design.md`](../../dicsscssion/pricing_adjustment_mechanisms/01_pricing_adjustment_mechanism_design.md).

## Scope

Verify the generated `county_lambda_shadow.json` artifacts for every catalog,
threshold, county, and predictability pattern.

Current catalogs:

- `eagle-i-30min`
- `eagle-i-45min`
- `eagle-i-60min`

Core artifacts:

- `price_engine/catalogs/*/pricing/county_lambda_shadow.json`
- `price_engine/catalogs/*/pricing/county_predictability.json`
- `curated_outage_data/pipelines/county_lambda_shadow/compute_county_lambda_shadow.py`
- `curated_outage_data/pipelines/county_predictability/compute_county_predictability.py`

## Rule Coverage To Verify

The current implementation maps predictability labels to pricing actions as
follows.

| Pattern label | Expected action | Candidate estimator | Native target | Intended pricing read |
|---|---|---|---|---|
| `smooth_worsening` | `trend_blend_up` | Trend projection blend | `frequency_lambda` | Consider uplift toward fitted next-year rate. |
| `smooth_improving` | `trend_blend_down_guarded` | Trend projection blend | `frequency_lambda` | Consider capped discount only if persistence is credible. |
| `step_change_up` | `recent_regime_up` | Recent-five-year regime blend | `frequency_lambda` | Historical average may be stale low. |
| `step_change_down` | `recent_regime_down_guarded` | Recent-five-year regime blend | `frequency_lambda` | Historical average may be stale high, but discount must be guarded. |
| `volatile_worsening` | `light_trend_blend_up_review` | Light trend blend | `frequency_lambda` + `load_margin` | Direction exists, but noise requires review. |
| `volatile_improving` | `light_trend_blend_down_review` | Light trend blend | `frequency_lambda` + `load_margin` | Small guarded discount, review required. |
| `stable_predictable` | `keep_v0_average` | Historical average | `frequency_lambda` | v0 average is the best candidate estimator. |
| `stable_noisy` | `keep_v0_average_uncertainty_review` | Historical average | `load_margin` review | Do not change frequency; consider uncertainty load later. |
| `episodic_spiky` | `hazard_context_required` | Historical average | `hazard_context` review | Do not trend-adjust; wait for hazard/storm context. |
| `sparse_low_history` | `no_trend_adjustment_sparse` | Historical average or no-quote | `quote_gate` | Do not infer trend from low event count. |

Any row outside this mapping is a defect unless explicitly added to the schema
and fundamentals documentation in the same change.

## Guardrails To Verify

The current guardrails are intentionally conservative:

| Guardrail | Expected value |
|---|---:|
| Global minimum factor | `0.75x` |
| Global maximum factor | `2.50x` |
| Step-change-down minimum factor | `0.80x` |
| Volatile-improving minimum factor | `0.90x` |
| Stable, episodic, and sparse automatic lambda movement | `0.00%` |

The verification must prove that these caps are applied after the raw candidate
lambda is computed.

## Mechanical Checks

These checks should run every time the shadow artifacts are regenerated:

1. Every `pattern_label` has exactly one expected `pricing_action`.
2. Every `pricing_action` is documented in the schema and fundamentals doc.
3. `lambda_candidate`, `lambda_v0`, and `adjustment_factor` are internally
   consistent:

   ```text
   adjustment_factor = lambda_candidate / lambda_v0
   ```

4. Retail and pure premium candidates are linear in the same factor for rows
   whose native target is `frequency_lambda`.
5. Worsening actions never reduce lambda:

   ```text
   trend_blend_up
   recent_regime_up
   light_trend_blend_up_review
   ```

6. Improving actions never increase lambda:

   ```text
   trend_blend_down_guarded
   recent_regime_down_guarded
   light_trend_blend_down_review
   ```

7. Stable, noisy, episodic, and sparse actions keep `adjustment_factor = 1.0`
   when `lambda_v0` exists, because their next mechanism is not an automatic
   lambda move.
8. Rows with missing v0 lambda use `pricing_action = missing_v0_lambda` and do
   not create a numeric candidate.
9. `cap_applied = true` only when the raw candidate was outside the relevant
   cap range.
10. No generated JSON contains `NaN`, `Infinity`, or non-strict JSON values.

## Category Review Checks

Mechanical checks are not enough. Each pattern needs a sample review because
the formulas can be mechanically correct but still commercially wrong.

For each catalog and threshold, create a review table with:

- count of counties by `pattern_label`
- count of counties by `pricing_action`
- mean, p10, p50, p90, min, and max `adjustment_factor`
- top 20 uplifts by retail premium delta
- top 20 discounts by retail premium delta
- top 20 cap-applied rows
- largest counties by v0 premium with no lambda movement

For each pattern label, manually inspect representative counties:

| Pattern group | Sample focus |
|---|---|
| Smooth worsening | Does the fitted trend look usable, or is the slope driven by one late year? |
| Smooth improving | Is the discount credible, or is it false comfort from a short quiet period? |
| Step-change up | Does recent-five-year lambda clearly represent a new regime? |
| Step-change down | Is the lower recent regime persistent enough to justify even a guarded discount? |
| Volatile worsening | Is the light uplift enough, or should this be uncertainty/hazard review only? |
| Volatile improving | Is any discount acceptable while residual noise remains high? |
| Stable predictable | Does v0 look like the right estimator? |
| Stable noisy | Should this remain frequency-neutral but carry an uncertainty load hint? |
| Episodic spiky | Can hazard context explain the spike years? |
| Sparse low history | Should the county be quoteable at this threshold? |

## Holdout Test Design

Once mechanical and sample checks pass, run a holdout comparison. The first
version can be simple:

```text
train window: 2015-2022
test window:  2023-2025
```

Compare candidate estimators:

| Estimator | Meaning |
|---|---|
| `lambda_v0_train` | Full train-window historical average |
| `lambda_recent5_train` | Last-five-year train average |
| `lambda_trend_next_train` | Fitted forward trend estimate |
| `lambda_shadow_train` | Rule-selected candidate |
| `lambda_test` | Observed test-window rate |

Metrics:

- absolute error by county and threshold
- weighted absolute error using event volume or premium exposure proxy
- false-discount rate for improving categories
- missed-uplift rate for worsening categories
- performance by pattern label and action
- performance by tier and quoteability

The goal is not to prove a perfect forecast. The goal is to test whether the
rule-selected candidate is a better pricing estimator than blindly using the
full historical average in the cases where the pattern says it should be.

## Interaction With Other Modifiers

Shadow lambda is only one part of the future pricing stack.

| Modifier | Bridge bucket | Native target | Interaction |
|---|---|---|---|
| Customer impact | `basis_alignment` | `exposure_basis` | Already corrects county event count toward per-customer expected loss. Shadow lambda should use the corrected pricing context when shown as premium pressure. |
| Location basis | `basis_alignment` | `exposure_basis` | Should apply after the baseline exposure view is clear. It answers a different basis-risk question. |
| Hazard/weather | `forward_regime` | `hazard_context` | Required before episodic and some volatile cases can become active pricing moves. |
| Grid condition | `forward_regime` | `hazard_context` or `load_margin` | Could support or contradict trend/regime movement, but should not be double-counted as both trend and grid load. |
| Trigger alignment | `basis_alignment` | `trigger_source` | Must be visible separately because the live payout oracle may not match the historical pricing source. |

## Acceptance Criteria Before Activation

Shadow lambda can move from dashboard candidate to active-pricing proposal only
after all of these are true:

1. Every pattern label has a documented rule and pricing interpretation.
2. Mechanical checks pass for every catalog and threshold.
3. Sample review has at least one accepted example for every pattern label that
   exists in the generated data.
4. Discount rules pass a false-discount review, especially `smooth_improving`,
   `step_change_down`, and `volatile_improving`.
5. Uplift rules pass a reasonableness review for large retail premium deltas.
6. Episodic and stable-noisy cases remain review-first until hazard or
   uncertainty-load methodology exists.
7. The methodology docs, schemas, pipeline, dashboard copy, and assumptions
   registry agree on what the shadow layer does and does not do.
8. The row-level interpretation agrees with the pricing adjustment mechanism taxonomy:
   candidate lambda first for frequency rows, review/gate semantics for
   non-frequency rows.

## Immediate Next Deliverables

1. Add an audit script that reads all generated shadow JSON files and produces
   rule-coverage and factor-sanity tables.
2. Export category samples for manual review.
3. Add a short dashboard or library section showing category-level examples.
4. Draft the holdout test once the audit table is clean.
5. Decide whether any pattern category needs a changed rule before advisors see
   the pricing-read narrative.

## Current Read

The current rule family is directionally right, but it is not yet activation
ready. The highest-risk category is not smooth worsening; it is guarded
discounting in improving or step-down counties. The second highest-risk group
is episodic or volatile history, where the correct pricing move may be an
uncertainty or hazard-context review rather than a lambda change.
