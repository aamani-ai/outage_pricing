# Lambda Shadow Pricing - Fundamentals

*Audience: senior team. First drafted: 2026-06-16. Reads after [`outage_predictability_fundamentals.md`](outage_predictability_fundamentals.md).*

## What problem this solves

v0 pricing uses a long-run historical average:

```
lambda_v0(T) = observed qualifying events at T / exposure years
premium      = lambda_v0(T) x payout / load denominator
```

That is the right baseline because it is empirical, explainable, and stable.
But once we see annual outage histories, a single full-history average is not
always the best forward-looking estimator.

Examples:

- Smooth worsening county: the latest/fitted rate may be higher than the
  long-run average.
- Smooth improving county: the latest/fitted rate may be lower than the
  long-run average.
- Step-change county: the last five years may be more relevant than the whole
  11-year history.
- Episodic county: neither the line nor the average is enough without hazard
  context.

The lambda shadow-pricing layer turns that reasoning into an explicit,
auditable candidate estimate:

```
lambda_v0        = current production baseline
lambda_candidate = what the pricing lambda would become if the shadow rule
                   were activated after validation
factor           = lambda_candidate / lambda_v0
```

It does not mutate v0 premiums. It shows price pressure.

## Inputs

The shadow layer joins three dashboard artifacts:

| Artifact | Role |
|---|---|
| `county_drilldown.json` | Current v0 lambda and premium grid |
| `county_yearly_trend.json` | Annual counts, fitted line, first/last five-year averages |
| `county_predictability.json` | Pattern label and usability score |

## Rule Families

| Pattern | Candidate lambda rule |
|---|---|
| Smooth worsening | Blend `lambda_v0` upward toward fitted next-year trend lambda |
| Smooth improving | Blend downward toward fitted next-year trend lambda, with a discount cap |
| Step-change up | Blend upward toward last-five-year lambda |
| Step-change down | Blend downward toward last-five-year lambda, with a stricter discount cap |
| Volatile worsening | Small upward trend blend plus review |
| Volatile improving | Small guarded downward trend blend plus review |
| Stable regular | Keep `lambda_v0` |
| Stable noisy | Keep `lambda_v0`; evaluate an uncertainty load later |
| Episodic / spiky | Keep `lambda_v0`; require storm/hazard context |
| Sparse history | Do not trend-adjust |

## Guardrails

The first shadow version is conservative by design:

- Uplift is capped at `2.50x`.
- Normal discount is floored at `0.75x`.
- Step-change-down discount is floored at `0.80x`.
- Volatile-improving discount is floored at `0.90x`.
- Episodic and stable-noisy counties do not get automatic lambda changes.

Those caps are not final actuarial selections. They are safety rails for a
review artifact so the team can compare counties without letting one heuristic
dominate the price.

## How to read the dashboard

For a county and threshold, the panel shows:

```
v0 lambda:        12.4 events/yr
shadow lambda:    18.7 events/yr
premium pressure: +51%
action:           trend_blend_up
reason:           smooth worsening history supports blending toward trend
```

Because premium is linear in lambda, the same factor applies to pure premium
and retail premium before any separate load changes.

## Why this is the correct middle step

This is the bridge between descriptive analytics and production pricing:

1. v0 remains stable.
2. Every candidate price move is visible.
3. Every candidate move has a rule and reason.
4. The team can backtest the candidate estimator against historical holdout
   years before activating it.
5. If a future filing or carrier review asks why a price moved, the artifact
   has a county/threshold-level audit trail.

## What must happen before activation

Before the shadow lambda can become active pricing, we should validate:

- holdout-year performance of `lambda_v0` vs `lambda_candidate`
- false-discount risk for improving counties
- uplift reasonableness for worsening and step-change counties
- whether episodic counties need hazard-specific modifiers instead of lambda
  trend adjustments
- interaction with customer-basis and concentration loads

## One-Line Takeaways

- **Predictability labels tell us which lambda estimator to trust.**
- **The shadow layer shows the candidate price move without changing v0.**
- **Stable regular counties keep the historical average.**
- **Smooth and step-change counties get explicit candidate lambda alternatives.**
- **Noisy, episodic, and sparse counties stay review-first.**

## References

- Pipeline: `curated_outage_data/pipelines/county_lambda_shadow/compute_county_lambda_shadow.py`
- Schema: [`curated_outage_data/schemas/county_lambda_shadow.md`](../../../curated_outage_data/schemas/county_lambda_shadow.md)
- Predictability layer: [`outage_predictability_fundamentals.md`](outage_predictability_fundamentals.md)
