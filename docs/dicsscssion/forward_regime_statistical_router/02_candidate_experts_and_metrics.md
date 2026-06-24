# Candidate Experts And Metrics

**Status:** discussion / notebook specification input  
**Date:** 2026-06-24  
**Purpose:** define the first statistical forecast expert set and the scoring
rules before implementation.

---

## 1. Unit Of Forecast

The first trial forecasts annual qualifying event counts:

```text
y(fips, year, T) = count of county events with duration >= T
```

Primary trigger set should match the dashboard where available:

```text
T = 2h, 4h, 8h, 12h, 24h
```

If a candidate source lacks `2h`, report that explicitly and run the overlapping
set only. The national statistical-router notebook should use the local EAGLE-I
catalogs, so it should be able to include `2h`.

---

## 2. Candidate Experts

All v1 experts are functions of the county's own training history only. No
weather, climate, grid, utility, or geography feature is required.

| Expert | Forecast for next year | Natural bucket | Notes |
|---|---|---|---|
| Flat mean | `mean(y_train)` | stable | Current audit baseline; should be hard to beat in stable counties. |
| County-History Joint | empirical county history with cross-threshold dependence | stable / noisy stable | Useful if implemented from existing sample machinery; otherwise flat mean is the first proxy. |
| Recent mean k=3 | `mean(last 3 observed years)` | shift / recent-change | Captures new level without extrapolating slope. |
| Recent mean k=5 | `mean(last 5 observed years)` | moderate shift | Less jumpy than k=3; useful robustness check. |
| Weighted recent mean | exponentially weighted mean | shift / gradual drift | Smooth bridge between flat and recent-only. |
| Linear trend | OLS extrapolation to next year | trend | Current best global in the Northeast export. Needs caps. |
| Capped linear trend | OLS extrapolation with bounded annual movement | trend | Protects against explosive thin-series extrapolation. |
| Theil-Sen trend | robust median slope extrapolation | trend with spikes | Less sensitive to storm outliers. |
| Persistence / last-level | `last observed y` | abrupt shift / random-walk level | Natural expert for step-like behavior; can overreact to noise. |
| Changepoint plateau | detect split, forecast post-change mean | shift | Natural missing shift expert. Needs minimum pre/post support. |
| Shrink-to-state / region mean | credibility blend | insufficient / thin | Optional; useful if sparse counties must be forecast, not moved. |

Minimum first set:

```text
flat mean
recent mean k=3
recent mean k=5
linear trend
capped linear trend
Theil-Sen trend
persistence
changepoint plateau
```

County-History Joint can be added if the existing Sarasi-style sampling logic is
available locally without turning this into a large modeling project.

---

## 3. Candidate Formulas

For an observed training series:

```text
years: y_1, y_2, ..., y_n
target: y_{n+1}
```

Flat mean:

```text
forecast = mean(y_1..y_n)
```

Recent mean:

```text
forecast_k = mean(y_{n-k+1}..y_n)
```

Weighted recent mean:

```text
forecast = sum(w_i * y_i) / sum(w_i)
w_i = alpha^(n-i), 0 < alpha < 1
```

Linear trend:

```text
fit y = a + b * year on train
forecast = max(0, a + b * next_year)
```

Capped trend:

```text
forecast = clip(linear_trend_forecast,
                lower = flat_mean * floor_factor,
                upper = flat_mean * cap_factor)
```

Theil-Sen:

```text
b = median((y_j - y_i) / (year_j - year_i)) over all i < j
a = median(y_i - b * year_i)
forecast = max(0, a + b * next_year)
```

Persistence:

```text
forecast = y_n
```

Changepoint plateau:

```text
for each split s with enough pre/post years:
  pre_mean  = mean(y_1..y_s)
  post_mean = mean(y_{s+1}..y_n)
  score split by residual error / variance explained / jump size

if best split clears gate:
  forecast = post_mean
else:
  forecast = flat_mean
```

The exact changepoint gate should be conservative: enough years on both sides,
minimum jump size, and default to flat if ambiguous.

---

## 4. Metrics

Primary metric:

```text
WAPE = sum(abs(predicted - observed)) / sum(observed)
```

Why WAPE:

- event counts are highly uneven across counties;
- county-year percentage errors explode when observed count is tiny;
- WAPE answers "how many events did we miss per 100 observed events?"

Bias:

```text
Bias = sum(predicted - observed) / sum(observed)
```

Bias is required because a lower absolute error can still be systematically
underpriced.

Other diagnostics:

| Metric | Use |
|---|---|
| MAE | interpretable events-off-per-cell; useful within a bucket. |
| RMSE | tail sensitivity; useful to see storm-year misses. |
| Poisson deviance | proper count-score check; secondary, not the headline. |
| Win rate vs flat | how often a candidate beats the baseline. |
| Skill vs baseline | `1 - error_model / error_baseline`, by chosen error metric. |
| Bias by regime/T | protects against systematic underpricing. |

---

## 5. Pooling Rules

Report all of the following. Each answers a different question.

### Pooled WAPE

```text
sum errors across all county-year-threshold cells / sum observed
```

This is event-weighted and business-relevant. But higher-volume thresholds,
especially `4h`, naturally carry more weight.

### Per-Threshold WAPE

```text
WAPE separately for T=2,4,8,12,24
```

This prevents the high-volume short trigger from hiding long-trigger failures.

### Duration-Neutral Average

```text
mean(WAPE_T across thresholds)
```

This gives each trigger equal voice. Use it as a check, not a replacement for
pooled WAPE.

### Bucket-Level WAPE

```text
WAPE by regime, by xT descriptor, by confidence tier
```

This is the core router evidence.

---

## 6. Backtest Design

Use rolling-origin validation on observed years only:

```text
train through Y -> predict Y+1
```

For the EAGLE-I 2015-2025 window, typical folds:

```text
train 2015-2019 -> test 2020
train 2015-2020 -> test 2021
...
train 2015-2024 -> test 2025
```

Use the source-coverage mask where available:

```text
missing / ramp year != observed zero
```

Minimum data gates:

```text
at least 4 observed train years before a fold
at least 1 held-out observed year
minimum total event volume for non-flat movement
```

Counties that fail the gate should remain in the output with an explicit
`insufficient_backtest_history` reason.

---

## 7. Routing Rules To Test

Test from simplest to richer:

```text
R0: everyone -> flat mean
R1: everyone -> best single global expert
R2: stable -> flat/history, all non-stable -> best global non-flat expert
R3: regime -> best expert by regime
R4: regime + T -> best expert by regime and threshold
R5: regime + xT/confidence -> best expert with shrinkage
```

R4 and R5 are allowed as diagnostics, but should not become product rules unless
the lift is stable. A simple router that is slightly less accurate but much more
robust may be the better first product artifact.

The ordering is intentional. The first product question is whether county
behavior buckets improve method choice at all:

```text
county nature -> forecast expert
```

Threshold-specific routing is the next layer:

```text
county nature + trigger threshold -> forecast expert
```

That layer matters, especially for tail thresholds, but it should be adopted
only after the first-order router is understood. Otherwise the sparse
regime-by-threshold table can look more precise than it really is.

---

## 8. Acceptance Gates

The statistical router earns a Step-05 shadow artifact only if:

- it beats `R0` historical mean out-of-sample;
- it beats `R1` best single global expert out-of-sample;
- the lift is visible in pooled WAPE and not contradicted by duration-neutral
  average WAPE;
- stable counties are not harmed by over-extrapolation;
- trend / shift candidates do not create unacceptable positive or negative bias;
- thin buckets are not used to justify a broad rule;
- results are readable at county level.

If these gates fail, the honest result is:

```text
historical mean remains the forward baseline for now.
```

That is a valid outcome.
