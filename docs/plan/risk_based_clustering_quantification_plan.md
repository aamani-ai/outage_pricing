# Risk-Based Clustering Quantification Plan

**Status:** active analytical plan  
**Last reviewed:** 2026-06-20  
**Scope:** annual outage trend / predictability routing, before hazard, grid, and location layers are active pricing inputs

## Why This Plan Exists

The current forward-regime read is useful, but the next version needs to be
more statistical and less visual. The first correction is foundational:

```text
missing source year != observed zero-outage year
```

If we let missing years become zeros, the trend line can manufacture:

- false worsening;
- false step-change-up labels;
- fake early quiet periods;
- inflated outlier and peak-share reads;
- misleading shadow lambda candidates.

The 2026-06-19 team discussion identified this explicitly: some counties have
early zero-looking years that are actually missing EAGLE-I/source coverage.
Connecticut also has a separate 2025 county-equivalent transition issue where
legacy county FIPS and new planning-region FIPS are not directly comparable.

## Phase 1 - Correct The Analytical Input

Implemented rule:

```text
observed zero = inside the FIPS positive-source observation window,
                but no qualifying event at threshold T

missing year  = outside that source window, known partial year,
                or Connecticut 2025 transition year
```

Pipeline behavior:

- `yearly_counts` now allows `null`.
- Regression uses only observed years.
- Residuals, outliers, peak share, zero-year counts, and scores use observed
  years only.
- A trend is suppressed if there are fewer than `10` observed qualifying events
  or fewer than `6` observed calendar years.
- Dashboard annual grids show missing years as missing, not zero.

All-catalog impact after the Phase 1 correction:

| Catalog | Rows across all T | Rows with missing years | Trend-class changes | Pattern-label changes |
|---|---:|---:|---:|---:|
| `eagle-i-30min` | 15,450 | 3,005 | 900 | 1,751 |
| `eagle-i-45min` | 15,450 | 3,005 | 906 | 1,779 |
| `eagle-i-60min` | 15,450 | 3,005 | 920 | 1,787 |

Default catalog sanity check (`eagle-i-45min`, T=8):

| Check | Count |
|---|---:|
| Counties with at least one missing/partial year | 601 |
| Trend-class changes after correction | 192 |
| Predictability-label changes after correction | 374 |
| Old CT planning-region rows corrected from fake step-change to sparse | 9 |

Largest label correction:

```text
step_change_up -> smooth_worsening / stable_predictable / volatile_worsening / sparse
```

That is expected. Many old step-change labels were caused by leading missing
years that were filled as zeros.

## Phase 2 - Make The Labels Statistical

After Phase 1, the labels should be re-derived from observed annual series only.
The target is not a black-box cluster yet; it is a reproducible rule system
with thresholds we can defend.

### Features To Keep

These are the minimum feature columns for the second-step cluster read:

| Feature | Purpose |
|---|---|
| `observed_year_count` | trust gate |
| `total_events_in_window` | volume gate |
| `slope_events_per_year` | direction |
| `slope_pct_of_mean` | scale-normalized direction |
| `t_stat` | slope signal-to-noise |
| `residual_cv` | line usability |
| `r_squared` | line fit |
| `outlier_count_p10p90` / P5-P95 / P1-P99 | residual tail behavior |
| `peak_share_total` / `top2_share_total` | episodic dominance |
| `observed_zero_year_count` | true sparse observed years |
| `missing_year_count` | source-data confidence |

### Candidate Rule Families

Discussion draft with intuitive definitions and shape sketches:
[`../dicsscssion/risk_based_clustering/01_candidate_pattern_definitions.md`](../dicsscssion/risk_based_clustering/01_candidate_pattern_definitions.md).

1. **Smooth trend**
   - intuitive read: direction is clear, and a simple line is a fair summary of
     the annual history;
   - enough observed years;
   - directional `t_stat`;
   - low residual CV;
   - few residual-band outliers;
   - no single-year dominance.

2. **Volatile trend**
   - intuitive read: direction exists, but the path around that direction is
     noisy enough that the line needs caution;
   - directional `t_stat`;
   - residual CV high, weak `r_squared`, or many outliers;
   - not dominated by one/two years enough to become episodic.

3. **Episodic / spiky**
   - intuitive read: one or two large years dominate the story more than a
     persistent direction does;
   - implemented v1 gate: `peak_share_total >= 0.35` or
     `top2_share_total >= 0.55`;
   - should route toward hazard/weather context before direct lambda movement.

4. **Step-change**
   - intuitive read: the county moves from one level to another, with observed
     support on both sides of the shift;
   - do not infer from missing early years;
   - require both pre- and post-change observed support;
   - implemented v1 gate: search split years with at least 3 observed years on
     each side, require `abs_shift >= 5`, `rel_shift >= 0.50`, and
     `piecewise_rss_reduction >= 0.25`.

5. **Stable regular / stable noisy**
   - intuitive read: no reliable direction; split into regular vs noisy based
     on year-to-year variation and outliers;
   - non-directional `t_stat`;
   - implemented v1 noisy gate uses the same noise triggers as volatile trend:
     `residual_cv >= 0.55` or at least 3 P10-P90 residual outliers.

6. **Sparse**
   - intuitive read: the data are too thin or too incomplete to infer a shape;
   - too few observed events or too few observed years;
   - no trend conclusion, no shadow frequency adjustment.

### Implemented V1 Rule Order

```text
1. observation_gate
   -> sparse if too few observed years/events

2. dominance_gate
   -> episodic/spiky if one or two observed years dominate

3. piecewise_regime_gate
   -> step-change if a two-level fit materially beats the simple line

4. direction_gate
   -> smooth or volatile trend if the slope is directional

5. no_direction_gate
   -> stable regular or stable noisy
```

Default catalog movement after implementing this order (`eagle-i-45min`, T=8):

| Check | Count |
|---|---:|
| Label changes vs the missing-year-corrected baseline | 858 |
| Group changes vs the missing-year-corrected baseline | 858 |
| Assigned by `observation_gate` | 179 |
| Assigned by `dominance_gate` | 179 |
| Assigned by `piecewise_regime_gate` | 789 |
| Assigned by `direction_gate` | 1,219 |
| Assigned by `no_direction_gate` | 724 |

Largest movements:

```text
smooth_worsening   -> step_change_up      275
step_change_up     -> smooth_worsening    191
volatile_worsening -> step_change_up      171
stable_noisy       -> step_change_up       69
stable_predictable -> step_change_up       55
step_change_up     -> volatile_worsening   46
step_change_up     -> episodic_spiky       31
```

Interpretation: the piecewise rule is doing meaningful work. It reclassifies
many histories that have a clear low-regime / high-regime shape, while the
dominance gate correctly moves single-year spike histories away from
step-change and into episodic/spiky.

## Should Historical Year Enter The Decision?

Yes, but only after missingness is clean.

Historical position matters for:

- step-change timing;
- recency shift;
- holdout performance;
- whether a spike is old, recent, or repeating.

It should not be used to convert missing years into zero years. The first
decision is always observation state. Then the model can ask whether the
observed pattern is old, recent, persistent, or episodic.

## Validation Sequence

1. Rebuild corrected trend, predictability, and shadow artifacts.
2. Compare before/after label movement by threshold and catalog.
3. Review named examples:
   - Erie County, NY (`36029`) as smooth/trend sanity check.
   - CT legacy counties (`09001`-`09015`) for 2025 partial exclusion.
   - CT planning regions (`09110`-`09190`) for no-full-year-history handling.
   - counties with leading missing years formerly labeled `step_change_up`.
4. Tune label thresholds using the corrected feature table.
5. Backtest simple alternatives on held-out years:
   - full observed historical mean;
   - recent mean;
   - linear trend;
   - robust trend;
   - piecewise/step-change candidate.
6. Only then decide whether the labels become a pricing adjustment, a routing
   diagnostic, or a holdout review flag.

## Open Questions

- Do we need a true county-year source coverage table, beyond the conservative
  positive-event-window proxy?
- Should the minimum observed-year gate be `6`, `7`, or threshold-specific?
- Should 2019 Northeast missing chunks be handled as partial-year weights rather
  than full-year exclusion?
- What is the right statistical test for step-change: simple pre/post split,
  segmented regression, permutation test, or a lightweight Chow-style test?
- Should volatile vs episodic thresholds be global or threshold-specific?

## Source Files

- Pipeline: `curated_outage_data/pipelines/county_trend/compute_yearly_trend.py`
- Pipeline: `curated_outage_data/pipelines/county_predictability/compute_county_predictability.py`
- Trend schema: `curated_outage_data/schemas/county_yearly_trend.md`
- Predictability schema: `curated_outage_data/schemas/county_predictability.md`
- Trend fundamentals: `docs/methodology/fundamentals/outage_trend_fundamentals.md`
- Predictability fundamentals: `docs/methodology/fundamentals/outage_predictability_fundamentals.md`
