# Outage Predictability Pattern - Fundamentals

*Audience: senior team. First drafted: 2026-06-16. Reads naturally after [`outage_trend_fundamentals.md`](outage_trend_fundamentals.md).*

## What this layer is

The outage trend layer tells us whether annual qualifying outage counts are
moving up, down, or sideways. The predictability-pattern layer asks a different
question:

> Is the simple annual trend line actually a useful summary for this county and
> threshold?

That distinction matters. A county can have a very strong upward slope and still
be hard to predict if the slope is created by a few jump years, a storm cluster,
or sparse early history. This layer separates **direction** from **reliability**.

It is descriptive by itself. In the pricing stack it feeds the separate
lambda-shadow layer, where the pattern label selects a candidate lambda rule
for review. That shadow rule is not active v0 pricing until it is validated.

## Inputs

For each county and each threshold T = 2, 4, 8, 12, 24 hours, the layer starts
from the 2015-2025 annual series:

```
year:          2015 2016 2017 2018 2019 2020 2021 2022 2023 2024 2025
events >= T:     0    0    0   40  105   82  119  131  118  117  118
```

The existing trend layer fits the line and provides:

- trend class: worsening / stable / improving / insufficient data
- slope in events per year per year
- first-5-year average
- last-5-year average
- residuals around the fitted line

The predictability layer adds feature diagnostics around that line.

## Features We Compute

| Feature | What it tells us |
|---|---|
| `slope_pct_of_mean` | Trend magnitude normalized by county scale |
| `residual_cv` | How noisy the annual counts are after the fitted line |
| `r_squared` | How much of the annual variation the simple line explains |
| `outlier_count_p10p90` | Years outside the fitted P10-P90 residual band |
| `peak_share_total` | Whether one year dominates the whole history |
| `top2_share_total` | Whether two years dominate the whole history |
| `zero_year_count` | Whether sparse early years distort the line |
| `trend_consistency_score` | Whether the trend class is consistent across T values |

These are deliberately simple. The goal is not to create a black-box forecast.
The goal is to produce a reviewer-facing signal that is explainable county by
county.

## Pattern Labels

The first-pass taxonomy is rule-based:

| Label | Meaning |
|---|---|
| **Smooth worsening** | Positive trend, low residual noise, few outliers |
| **Volatile worsening** | Positive trend, but the line has weak usability |
| **Step-change up** | Early low-count years followed by a persistent higher level |
| **Smooth improving** | Negative trend, low residual noise, few outliers |
| **Volatile improving** | Negative trend, but the line has weak usability |
| **Step-change down** | Early high-count years followed by a persistent lower level |
| **Stable regular** | Flat trend and low residual noise |
| **Stable noisy** | Flat trend, but large year-to-year swings |
| **Episodic / spiky** | One or two years dominate the history |
| **Sparse history** | Fewer than 10 qualifying events in the 11-year window |

These labels are not clusters yet. They are transparent rule labels. Clustering
can come later as a discovery layer after these features are stable.

## Predictability Score

The score is a 0-100 **simple-line usability score**. It is not a forecast
probability.

It rewards:

- low residual noise
- few residual-band outliers
- low one-year dominance
- few zero-count years
- good line fit where the county is directional

Step-change counties are capped at medium usability because a line may show a
large slope, but the shape is better described as a regime shift. Episodic
counties are capped lower because one storm year can dominate the history.

## How To Read Examples

### Smooth Worsening

```
events >= T: 22 24 27 30 32 35 37 39 43 45 47
```

This is the ideal case for a simple trend line. The slope is not the whole
truth, but it is a useful summary.

### Step-Change Up

```
events >= T:  0  0  0 40 105 82 119 131 118 117 118
```

The county is clearly worse in later years, but a straight line hides the real
shape. This should be read as a regime/coverage/structural shift candidate, not
a smooth linear process.

### Episodic / Spiky

```
events >= T:  4  6  5  7  6 51  5  8  6  7  5
```

The annual mean and slope are not enough. One year dominates. This may be a
storm-history question more than a trend question.

## Why This Is The Right Next Step

This layer makes the trend system usable for decision-making without pretending
we have a full forecast model yet:

1. It keeps the simple linear trend as the baseline.
2. It shows where the line is probably useful.
3. It shows where the line is misleading.
4. It gives us a feature table for later clustering and backtesting.
5. It creates a map-ready county signal and a clean input for shadow-pricing
   rules without touching active v0 premiums.

The next technical step after this is backtesting:

- historical mean
- last-5-year mean
- simple linear trend
- robust trend
- piecewise trend

Only after those are compared on held-out years should any shadow candidate
become an active pricing or underwriting input.

## Dashboard Use

The dashboard now has a descriptive map color mode:

```
Predictability pattern - T=<selected threshold>
```

The same T selector used for outage trend controls the pattern layer. County
panels show the pattern label, predictability score, residual CV, P10-P90
outlier count, peak-year share, and cross-T consistency.

## One-Line Takeaways

- **Trend direction is not the same thing as predictability.**
- **A strong slope can still be low-usability if it is driven by jumps or outliers.**
- **The first version is rule-based on purpose; it is auditable.**
- **The pattern layer chooses a candidate shadow-pricing rule, but active v0 remains unchanged.**

## References

- Pipeline: `curated_outage_data/pipelines/county_predictability/compute_county_predictability.py`
- Schema: [`curated_outage_data/schemas/county_predictability.md`](../../../curated_outage_data/schemas/county_predictability.md)
- Shadow pricing: [`lambda_shadow_pricing_fundamentals.md`](lambda_shadow_pricing_fundamentals.md)
- Input trend layer: [`outage_trend_fundamentals.md`](outage_trend_fundamentals.md)
- Trend validation plan: [`docs/plan/outage_trend_validation_plan.md`](../../plan/outage_trend_validation_plan.md)
