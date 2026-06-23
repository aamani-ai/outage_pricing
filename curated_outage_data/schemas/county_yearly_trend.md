# County Yearly Outage Trend — Schema

**Producer:** `curated_outage_data/pipelines/county_trend/compute_yearly_trend.py`
**Status:** descriptive layer, NOT used in v0 pricing.
**Purpose:** upstream data foundation for the forward-regime modifiers (`grid_condition`, `hazard`, `weather`). When/if those modifiers activate, the trend slope is the candidate input signal — but only after backtest evidence supports activation.

## Window

Per-county yearly event counts across the **2015–2025 review window**.

2014 is excluded because EAGLE-I coverage begins 2014-11-01, so the calendar year is partial. Including it would bias every county's slope toward "worsening" purely from observation-window artifacts — that's a measurement error, not a real trend.

Important distinction: a real observed zero is stored as `0`; a source-missing
or partial geography/year is stored as `null` in `yearly_counts` and excluded
from the regression. This prevents missing EAGLE-I coverage, late-start FIPS,
or the Connecticut 2025 county-equivalent transition from being misread as
zero outages.

## Output files (per catalog)

```
curated_outage_data/outputs/county_trend/
├── county_yearly_trend__eagle-i-30min.parquet
├── county_yearly_trend__eagle-i-30min.json
├── county_yearly_trend__eagle-i-45min.parquet
├── county_yearly_trend__eagle-i-45min.json
├── county_yearly_trend__eagle-i-60min.parquet
└── county_yearly_trend__eagle-i-60min.json

price_engine/catalogs/<catalog_id>/pricing/
└── county_yearly_trend.json   (dashboard mirror)
```

The JSON mirror lives in the catalog pricing folder so the static dashboard can fetch it via a sibling relative path (same pattern as `per_customer_view.json`).

## Parquet schema

| Column | Type | Meaning |
|---|---|---|
| `fips` | int64 | County FIPS |
| `T` | int | Duration threshold (hours) |
| `catalog_id` | string | `eagle-i-30min` / `eagle-i-45min` / `eagle-i-60min` |
| `years` | list[int] | The 11 calendar years (2015-2025) |
| `yearly_counts` | list[int/null] | Count of events with `duration_hours >= T` in each calendar year; `null` means missing/partial source year |
| `total_events_in_window` | int64 | Sum of observed `yearly_counts`, excluding `null` years |
| `window_years` | int | Length of the trend window (always 11) |
| `observed_year_mask` | list[bool] | Whether each year in `years` is used in the fit |
| `source_year_presence` | list[bool] | Whether the FIPS had any positive EAGLE-I event that year, any duration |
| `observed_year_count` | int64 | Count of years included in the fit |
| `missing_year_count` | int64 | Count of null years in the 2015-2025 review window |
| `missing_years` | list[int] | Years excluded from fitting |
| `missing_year_reasons` | map[string,string] | Reason code by missing year |
| `first_source_year` | int64 (nullable) | First year with any positive event for this FIPS inside the review window |
| `last_source_year` | int64 (nullable) | Last year with any positive event for this FIPS inside the review window |
| `insufficient_reason` | string (nullable) | Why the fit is suppressed, when `trend_class = insufficient_data` |
| `slope_events_per_year` | float64 (nullable) | Linear-regression slope of `yearly_counts` vs `years` |
| `intercept` | float64 (nullable) | Linear-regression intercept |
| `sigma` | float64 (nullable) | Standard error of the slope |
| `t_stat` | float64 (nullable) | `slope / sigma` (one-sided significance vs zero slope) |
| `trend_class` | string | `worsening` / `stable` / `improving` / `insufficient_data` |
| `first5_mean` | float64 (nullable) | Mean events/yr in 2015-2019; null unless all five years are observed |
| `last5_mean` | float64 (nullable) | Mean events/yr in 2021-2025; null unless all five years are observed |
| `pct_change_first5_last5` | float64 (nullable) | `(last5 - first5) / first5` — secondary descriptive lens |
| `generated_at` | string | UTC ISO timestamp of the pipeline run |
| `source_version` | string | Pipeline version tag |

## Classification thresholds

| Gate | Rule |
|---|---|
| `worsening` | `t_stat > 1.5` (slope significantly above zero at ~87% one-sided confidence) |
| `improving` | `t_stat < -1.5` |
| `stable` | within the noise band |
| `insufficient_data` | `< 10` observed events or `< 6` observed calendar years — slope cannot be credibly fit |

`t_stat = 1.5` is the operational gate. It's chosen to be **strict enough to reject most year-to-year noise**, but **loose enough to surface real signal in an 11-year window**. With more years of data, we'd raise it.

## Dashboard JSON view (per catalog, per FIPS, per T)

```json
{
  "12001": {
    "4": {
      "years": [2015, 2016, ..., 2025],
      "yearly_counts": [28, 31, 26, 34, 41, 39, 47, 33, 36, 44, 51],
      "total_events_in_window": 410,
      "observed_year_mask": [true, true, true, true, true, true, true, true, true, true, true],
      "observed_year_count": 11,
      "missing_years": [],
      "slope_events_per_year": 1.84,
      "intercept": -3680.4,
      "sigma": 0.62,
      "t_stat": 2.97,
      "trend_class": "worsening",
      "first5_mean": 32.0,
      "last5_mean": 42.2,
      "pct_change_first5_last5": 0.319
    }
  }
}
```

When a year is missing or partial, the count is `null`, not zero:

```json
{
  "1005": {
    "8": {
      "years": [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
      "yearly_counts": [null, null, 1, 19, 16, 38, 10, 38, 28, 20, 35],
      "observed_year_count": 9,
      "missing_years": [2015, 2016]
    }
  }
}
```

## How the dashboard consumes this

1. **Map color mode toggle.** A new "Trend" mode on the map colors counties by `trend_class` at the current T (diverging colormap: red = worsening, gray = stable, blue = improving, dimmed = insufficient data).
2. **Detail panel sparkline.** When a county is selected, a small sparkline renders `yearly_counts` against `years` with the regression line and residual band overlaid for observed years only. Missing/partial years are shown separately and are not drawn as zeros.
3. **No effect on pricing math.** The trend is read-only for visualization. It does not flow into `λ_county`, the per-customer multiplier, or any priced rate.

## Why this is a methodology-respectful descriptive layer

- **No new pricing assumption.** The trend is a regression on already-published quantities. It introduces no new model dependency in v0.
- **Caveats are surfaced, not hidden.** The classification thresholds, the partial-2014 exclusion, and the noise floor are all named in the schema and reproduced in the dashboard meta.
- **Forward-regime sequencing preserved.** The trend is the upstream evidence base for future `grid_condition` / `hazard` / `weather` modifiers — but those modifiers activate only after backtest evidence, not because the trend "exists."

## Cross-references

- Methodology: [`docs/methodology/fundamentals/outage_trend_fundamentals.md`](../../docs/methodology/03_risk_clustering/outage_trend_fundamentals.md)
- Roadmap: forward-regime modifier section in [`docs/methodology/roadmap.md`](../../docs/methodology/roadmap.md)
- Forward modifier plan: [`docs/plan/forward_looking_modeling_plan.md`](../../docs/plan/05_forward_regime/forward_looking_modeling_plan.md)
