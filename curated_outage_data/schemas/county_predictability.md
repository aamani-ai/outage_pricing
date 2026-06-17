# County Predictability Pattern - Schema

**Producer:** `curated_outage_data/pipelines/county_predictability/compute_county_predictability.py`
**Status:** descriptive layer; feeds shadow-pricing rules but does not mutate active v0 pricing.
**Purpose:** classify how usable a simple annual trend line is for a county and duration threshold.

This layer sits on top of `county_yearly_trend.json`. It does not replace the
trend. It adds a reliability/pattern read:

- Is the county worsening, stable, or improving?
- Is that direction smooth enough to trust as a simple line?
- Is the history dominated by outliers, one storm year, sparse data, or a step change?
- Is the signal consistent across T = 2, 4, 8, 12, 24 hours?

## Output Files

```
curated_outage_data/outputs/county_predictability/
├── county_predictability__eagle-i-30min.parquet
├── county_predictability__eagle-i-30min.json
├── county_predictability__eagle-i-45min.parquet
├── county_predictability__eagle-i-45min.json
├── county_predictability__eagle-i-60min.parquet
└── county_predictability__eagle-i-60min.json

price_engine/catalogs/<catalog_id>/pricing/
└── county_predictability.json   (dashboard mirror)
```

## Core Columns

| Column | Meaning |
|---|---|
| `fips` | County FIPS |
| `T` | Duration threshold in hours |
| `trend_class` | Existing trend class: `worsening`, `stable`, `improving`, `insufficient_data` |
| `slope_events_per_year` | Linear slope from the yearly trend artifact |
| `slope_pct_of_mean` | Slope divided by the mean yearly qualifying count |
| `trend_magnitude_bucket` | `weak`, `moderate`, or `strong` |
| `total_events_in_window` | Qualifying event count across 2015-2025 |
| `mean_count` | Mean annual qualifying event count |
| `residual_cv` | Residual standard deviation around the fitted line divided by `mean_count` |
| `r_squared` | Fit quality for the simple line |
| `outlier_count_p10p90` | Years outside the fitted P10-P90 residual band |
| `outlier_count_p5p95` | Years outside the fitted P5-P95 residual band |
| `outlier_count_p1p99` | Years outside the fitted P1-P99 residual band |
| `zero_year_count` | Number of zero-count years |
| `peak_share_total` | Largest single year divided by total window count |
| `top2_share_total` | Largest two years divided by total window count |
| `pattern_label` | Specific human label |
| `pattern_group` | Coarser map color group |
| `predictability_score` | 0-100 simple-line usability score |
| `predictability_rating` | `high`, `medium`, `low`, or `insufficient` |

## Pattern Labels

| Label | Interpretation |
|---|---|
| `smooth_worsening` | Positive trend, low residual noise, few outliers |
| `volatile_worsening` | Positive trend, but noise/outliers/weak fit reduce line usability |
| `step_change_up` | Early low-count period followed by a persistent higher-count period |
| `smooth_improving` | Negative trend, low residual noise, few outliers |
| `volatile_improving` | Negative trend, but noise/outliers/weak fit reduce line usability |
| `step_change_down` | Early high-count period followed by a persistent lower-count period |
| `stable_predictable` | Flat trend, low residual noise |
| `stable_noisy` | Flat trend, high residual noise or uneven annual history |
| `episodic_spiky` | One or two years dominate the 11-year history |
| `sparse_low_history` | Fewer than 10 qualifying events in the window |

## Pattern Groups

| Group | Dashboard use |
|---|---|
| `smooth_trend` | Smooth worsening or improving |
| `volatile_trend` | Directional but noisy |
| `step_change` | Better explained as a regime shift than a line |
| `episodic` | Dominated by one or two years |
| `stable_regular` | Stable and relatively predictable |
| `stable_noisy` | Stable direction, noisy annual behavior |
| `sparse` | Insufficient history |

## Predictability Score

The score is a simple-line usability score, not a forecast probability. It is
computed from five transparent components:

1. Lower residual coefficient of variation is better.
2. Fewer P10-P90 residual-band outliers is better.
3. Lower one-year dominance is better.
4. Fewer zero-count years is better.
5. Better line fit is better for directional trends.

Step-change counties are capped at medium usability because the line may show a
strong slope but the shape is not actually smooth. Episodic counties are capped
lower because the history is dominated by event clusters.

## Cross-T Summary

The JSON payload includes a per-FIPS `summary` object:

| Field | Meaning |
|---|---|
| `sufficient_thresholds` | Number of T values with enough history |
| `dominant_trend_class` | Most common trend class across sufficient T values |
| `trend_consistency_score` | Share of sufficient T values with the dominant trend class |
| `dominant_pattern_group` | Most common pattern group across sufficient T values |
| `pattern_consistency_score` | Share of sufficient T values with the dominant pattern group |
| `mean_predictability_score` | Mean score across sufficient T values |
| `predictable_threshold_count` | Count of T values rated high or medium |
| `high_predictability_threshold_count` | Count of T values rated high |
| `summary_label` | `consistent_predictable`, `mixed_predictability`, `low_predictability`, or `insufficient_history` |

## Caveats

- This layer is descriptive by itself. It can feed the separate lambda-shadow
  artifact, but it does not mutate active v0 pricing.
- It uses annual counts, so it cannot model within-year seasonality.
- A strong trend can still be low predictability if it is driven by outliers or
  a step change.
- Red/worsening counties still inherit the EAGLE-I coverage-drift caveat from
  the trend layer.
- The score should be validated by backtesting before it is used for pricing or
  underwriting decisions.

## Cross-References

- Trend schema: [`county_yearly_trend.md`](county_yearly_trend.md)
- Fundamentals: [`docs/methodology/fundamentals/outage_predictability_fundamentals.md`](../../docs/methodology/fundamentals/outage_predictability_fundamentals.md)
- Shadow pricing schema: [`county_lambda_shadow.md`](county_lambda_shadow.md)
- Pipeline: `curated_outage_data/pipelines/county_predictability/compute_county_predictability.py`
