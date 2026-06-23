# County Lambda Shadow Pricing - Schema

**Producer:** `curated_outage_data/pipelines/county_lambda_shadow/compute_county_lambda_shadow.py`
**Status:** shadow-pricing layer, not active v0 pricing.
**Purpose:** show how the county/threshold lambda would move if the trend and
predictability layer were activated after validation.

This layer does not overwrite `county_drilldown.json` and does not change the
dashboard's v0 premium matrix. It produces a candidate lambda next to the v0
lambda so reviewers can see price pressure before deciding whether to activate
the method.

## Output Files

```
curated_outage_data/outputs/county_lambda_shadow/
├── county_lambda_shadow__eagle-i-30min.parquet
├── county_lambda_shadow__eagle-i-30min.json
├── county_lambda_shadow__eagle-i-45min.parquet
├── county_lambda_shadow__eagle-i-45min.json
├── county_lambda_shadow__eagle-i-60min.parquet
└── county_lambda_shadow__eagle-i-60min.json

price_engine/catalogs/<catalog_id>/pricing/
└── county_lambda_shadow.json   (dashboard mirror)
```

## Core Fields

| Field | Meaning |
|---|---|
| `fips` | County FIPS |
| `T` | Duration threshold in hours |
| `tier` | Current v0 modelability tier |
| `trend_class` | `worsening`, `stable`, `improving`, or `insufficient_data` from yearly trend |
| `pattern_label` | Predictability pattern label |
| `predictability_score` | 0-100 simple-line usability score |
| `lambda_v0` | Current v0 historical-average lambda from `county_drilldown.json` |
| `lambda_recent5` | Last-five-year mean annual qualifying count |
| `lambda_trend_next` | One-year-ahead fitted annual count from the linear trend |
| `lambda_candidate` | Candidate lambda if the shadow rule were activated |
| `adjustment_factor` | `lambda_candidate / lambda_v0` |
| `adjustment_pct` | `adjustment_factor - 1` |
| `pricing_action` | Rule family that produced the candidate |
| `candidate_estimator` | Estimator family: historical average, trend blend, recent-regime blend, etc. |
| `confidence` | `high`, `medium`, `low`, or `insufficient` |
| `rule_weight` | Blend weight applied to the target estimator |
| `cap_applied` | Whether the candidate lambda was capped by guardrails |
| `uncertainty_load_hint_pct` | Optional load hint for noisy/episodic cases; not applied to v0 premium |
| `retail_v0_x2500` | Current annual retail premium for X=$2,500, if available |
| `retail_candidate_x2500` | Shadow annual retail premium for X=$2,500 |
| `retail_delta_x2500` | Candidate minus v0 retail premium |
| `reason` | Human-readable explanation of the rule |

## Pricing Actions

| Action | Rule |
|---|---|
| `keep_v0_average` | Stable regular pattern. Current historical-average lambda remains appropriate. |
| `trend_blend_up` | Smooth worsening pattern. Blend v0 lambda toward fitted next-year trend lambda. |
| `trend_blend_down_guarded` | Smooth improving pattern. Blend down, but cap the discount. |
| `recent_regime_up` | Step-change up. Blend v0 lambda toward last-five-year lambda. |
| `recent_regime_down_guarded` | Step-change down. Blend down toward last-five-year lambda with a stricter discount cap. |
| `light_trend_blend_up_review` | Volatile worsening. Small upward trend blend plus review. |
| `light_trend_blend_down_review` | Volatile improving. Small guarded downward blend plus review. |
| `keep_v0_average_uncertainty_review` | Stable noisy. Keep lambda, consider confidence load after validation. |
| `hazard_context_required` | Episodic history. Keep lambda until hazard/storm context is added. |
| `no_trend_adjustment_sparse` | Sparse history. Do not infer direction from annual trend. |

## Guardrails

The first shadow version is intentionally conservative:

- Global uplift cap: `2.50x`.
- Global discount floor: `0.75x`.
- Step-change-down discount floor: `0.80x`.
- Volatile-improving discount floor: `0.90x`.
- Episodic and stable-noisy cases do not change lambda directly; they carry an
  uncertainty-load hint for later calibration.

## Dashboard Contract

The dashboard reads:

```
payload.view[fips][T]
payload.summary[fips]
```

It displays the candidate lambda and premium pressure next to the
predictability pattern. A map layer can color by `adjustment_factor`, but the
main pricing matrix remains v0 unless/until this shadow method is promoted.

## Cross-References

- Predictability schema: [`county_predictability.md`](county_predictability.md)
- Trend schema: [`county_yearly_trend.md`](county_yearly_trend.md)
- Fundamentals: [`docs/methodology/fundamentals/outage_predictability_fundamentals.md`](../../docs/methodology/03_risk_clustering/outage_predictability_fundamentals.md)
