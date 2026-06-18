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

It is descriptive by itself. In the pricing stack it is an empirical routing
and diagnostic layer. It feeds the separate lambda-shadow layer for patterns
whose native pricing mechanism is frequency. For other patterns, the label is a
routing signal into uncertainty/load review, hazard context, grid-condition
review, or quoteability review. The project-level pricing adjustment mechanism taxonomy
defines this as:

```text
pattern -> pricing mechanism -> native candidate -> factor expression
```

That mechanism framing lives in
[`../../dicsscssion/pricing_adjustment_mechanisms/01_pricing_adjustment_mechanism_design.md`](../../dicsscssion/pricing_adjustment_mechanisms/01_pricing_adjustment_mechanism_design.md).
The shadow rule is not active v0 pricing until it is validated.

Important boundary: predictability is **not** the hazard model. It says what
the annual outage history looks like; hazard/weather and grid condition should
explain why the risk may be changing.

```text
Predictability = empirical shape and routing.
Hazard/weather = storm, wildfire, flood, wind, climate context.
Grid condition = utility, infrastructure, restoration context.
```

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

| Label | Meaning | Native pricing target |
|---|---|---|
| **Smooth worsening** | Positive trend, low residual noise, few outliers | `frequency_lambda` |
| **Volatile worsening** | Positive trend, but the line has weak usability | `frequency_lambda` plus review |
| **Step-change up** | Early low-count years followed by a persistent higher level | `frequency_lambda` |
| **Smooth improving** | Negative trend, low residual noise, few outliers | `frequency_lambda`, guarded |
| **Volatile improving** | Negative trend, but the line has weak usability | `frequency_lambda` plus review, guarded |
| **Step-change down** | Early high-count years followed by a persistent lower level | `frequency_lambda`, guarded |
| **Stable regular** | Flat trend and low residual noise | keep historical frequency |
| **Stable noisy** | Flat trend, but large year-to-year swings | `load_margin` review |
| **Episodic / spiky** | One or two years dominate the history | `hazard_context` review |
| **Sparse history** | Fewer than 10 qualifying events in the 11-year window | `quote_gate` / credibility review |

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

That is the reason this layer routes episodic histories toward
`hazard_context` instead of forcing a trend-based lambda adjustment.

## Why This Is The Right Next Step

This layer makes the trend system usable for decision-making without pretending
we have a full forecast model yet:

1. It keeps the simple linear trend as the baseline.
2. It shows where the line is probably useful.
3. It shows where the line is misleading.
4. It gives us a feature table for later clustering and backtesting.
5. It creates a map-ready county signal and a clean input for shadow-pricing
   or review routing rules without touching active v0 premiums.

After hazard/weather and grid-condition layers exist, this layer should also
act as a residual diagnostic:

```text
Does the hazard/grid model explain the observed annual pattern?
If yes, route the pricing read through that mechanism.
If no, keep the empirical pattern as a shadow read or review flag.
```

The next technical step after this is backtesting:

- historical mean
- last-5-year mean
- simple linear trend
- robust trend
- piecewise trend

Only after those are compared on held-out years should any shadow candidate
become an active pricing or underwriting input.

## Dashboard Use

The dashboard now has a review-layer map color mode:

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
- **The pattern layer routes counties to the right mechanism: frequency,
  uncertainty/load review, hazard context, or quoteability review.**

## References

- Pipeline: `curated_outage_data/pipelines/county_predictability/compute_county_predictability.py`
- Schema: [`curated_outage_data/schemas/county_predictability.md`](../../../curated_outage_data/schemas/county_predictability.md)
- Shadow pricing: [`lambda_shadow_pricing_fundamentals.md`](lambda_shadow_pricing_fundamentals.md)
- Pricing adjustment mechanisms:
  [`../../dicsscssion/pricing_adjustment_mechanisms/01_pricing_adjustment_mechanism_design.md`](../../dicsscssion/pricing_adjustment_mechanisms/01_pricing_adjustment_mechanism_design.md)
- Input trend layer: [`outage_trend_fundamentals.md`](outage_trend_fundamentals.md)
- Trend validation plan: [`docs/plan/outage_trend_validation_plan.md`](../../plan/outage_trend_validation_plan.md)
