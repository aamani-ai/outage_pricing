# Forward Expert Routing — Statistical vs Weather/Climate, and the granularity question

**Status:** discussion / pre-notebook
**Date:** 2026-06-30
**Purpose:** define the analysis that decides — per (county, trigger) — **which forecast expert
governs the forward factor, and at what granularity.** The statistical router is the baseline
([A020](../../methodology/assumptions.md)); Sarasi's weather/climate (EOF) model is the first real
challenger. We don't have live weather forecasts wired yet, but we have **both backtests**, so we can
decide the *routing map* now — on theory — and plug the live weather output in later.

---

## Thesis

```text
  The forecast section is a per-(county, trigger) ROUTER, not one model.
    · statistical   = the easy first expert (built, shadow — A020)
    · weather/climate (Sarasi EOF, ve7_res) = the first hard challenger (NE-189, train 15–22 / test 23–25)
    · grid          = a later challenger (placeholder)

  For each (county, trigger) cell, the backtest decides:
    weather BEATS stat   → that cell will use the weather output (when it lands)
    weather does NOT     → that cell stays on our statistical forecast
    N/A                  → "stably bad grid" counties (chronic grid, not weather): weather excluded by design
```

This is the "challenger must beat the statistical baseline" ladder made concrete, and it is the
principle in action: **not one method for all counties — the right expert per cell, chosen by whose
backtest wins** (`../../principles/county_specificity.md`).

---

## The primary question: GRANULARITY (do not pre-decide — the notebook decides it)

We do **not** pre-pick the granularity. The notebook climbs a ladder and adopts the **coarsest rung
that captures a real, stable out-of-sample win** (county-specificity: avoid both one-method-for-all
*and* per-county-everything):

```text
  G1  by cluster / regime           ← where the statistical router lives today (A020)
  G2  by cluster × trigger          ← the likely v1 sweet spot (see below)
  G3  by county                     (only where a county clearly + durably diverges, with data)
  G4  by county × trigger           (finest; fragile on a 3-year test window — evidence-gated only)
```

Two axes are decided here, together:

1. **Which expert family** wins the cell — statistical experts (history / recent / weighted-recent /
   trend / persist / changepoint …) and, where available, **weather/climate**.
2. **At what granularity** we select — cluster vs county, and **single-expert-across-T vs per-trigger**.

---

## Per-trigger selection is in-scope for v1 (decision, 2026-06-30)

`regime × T` was parked as "future" in [A021](../../methodology/assumptions.md); it is **promoted to a
v1 candidate.** Skill is genuinely threshold-dependent — signal, not noise:

```text
  EVIDENCE:  weather XGB TIES the trend baseline at ≥0/1h (routine, non-weather)
             but BEATS it at ≥8h+ (storm-driven, where weather signal lives).
             → within one county, "use weather?" flips across triggers.
  PHYSICS:   short outages = routine/equipment   → history / recent-level experts
             long outages  = major storms        → weather / trend / persistence experts
```

So we select the expert **per (cluster × trigger)** — the same proven move as cluster-routing, with
the trigger axis added. v1, **adopted where it earns a stable win**, guarded by a win-margin +
shrinkage so a cell never flips on noise.

**Asymmetry to respect:** our statistical backtest has all five triggers (2/4/8/12/24h); the Sarasi
export has **no 2h** and the overlap is {4, 8, 12, 24h} on **NE-189 only**. So per-trigger *statistical*
selection can span all five triggers, while *weather-vs-stat* routing is limited to the overlap.

---

## The comparison — and why it's the hard part

The two backtests barely agree on anything, so a naive "compare two WAPE columns" is wrong:

```text
  AXIS            OUR STATISTICAL                 SARASI WEATHER (ve7_res)
  geography       national (~14k cells)           NE only, 189 counties (excl. "stably bad grid")
  test window     rolling-origin 2020–2025        fixed 2023–2025
  thresholds      2/4/8/12/24h                    ≥0/1/4/8/12/16/20/24h   (overlap: 4/8/12/24)
  baseline        flat mean                       history (train mean) + linear trend
  target          annual ≥T count (masked)        monthly rate residual → summed to annual ≥T count
```

Three traps before any "weather wins" verdict is trusted:

1. **Coverage ramp (the big one).** ~2/3 of our stat factor's apparent skill is the EAGLE-I onboarding
   ramp ([A020](../../methodology/assumptions.md)); the weather model trains on 2015–2022 too and its
   "history" baseline is also a ramp-contaminated train mean. Score on a **coverage-stable footing**, or
   we measure "who corrects the ramp better," not forecast skill.
2. **Benchmark weather against our ROUTED stat — not flat history/trend.** The weather table beats
   *flat* history/trend; but the router exists *because* the routed stat beats those. The decisive
   comparison is **weather-XGB vs routed-stat, per cell** (Sarasi's own
   [`findings.md`](../../extra/sarasi_weather_outage_model/findings.md) lesson).
3. **3 test years → per-county is noisy.** Decide at the group level (cluster × T) with a win-margin +
   shrinkage; report county-level as evidence, don't flip on it.

**Freebie:** the weather model already excludes the "stably bad grid" cluster — those counties stay
statistical/grid by construction. That's part of the map handed to us.

---

## What the notebook produces

```text
  1. align both predictions on the common cells:  NE-189 × {2023,24,25} × {4,8,12,24}
  2. re-score apples-to-apples WAPE (coverage-aware):  weather-XGB  vs  routed-stat  vs  flat history/trend
  3. the GRANULARITY verdict:  which rung (G1 / G2 / G3) wins stably — do clusters have clear winners?
  4. emit a SHADOW routing map:  (fips, T) → expert family + win-margin + confidence
                                  NOT a price change; plugged with live weather output later
```

Inputs:
- ours: [`notebooks/outputs/forward_regime/statistical_router/`](../../../notebooks/outputs/forward_regime/statistical_router/)
  — `predictions_long.parquet` (per county×year×T preds — the key asset), `per_cell_wape.parquet`.
- weather (new): [`new_jun_30/county_year_counts_test.parquet`](../../extra/sarasi_weather_outage_model/new_jun_30/)
  + [`ve7_res_OUTPUTS_README.md`](../../extra/sarasi_weather_outage_model/new_jun_30/ve7_res_OUTPUTS_README.md).

---

## Open questions the notebook answers (NOT pre-decided)

```text
  · granularity:    G1 (cluster) vs G2 (cluster×T) vs G3/G4 (county / county×T)?
  · coverage:       score on a coverage-stable footing so neither side gets ramp credit?
  · the bar:        how much must a challenger beat the incumbent by (WAPE + bias guard) to switch a cell?
  · scope:          counts first (apples-to-apples); customer-exposure later (separate _vc7_res model).
```

---

## Cross-references

- Statistical baseline: [A020](../../methodology/assumptions.md) · routing granularity: [A021](../../methodology/assumptions.md).
- The ladder + design: [`04_statistical_adjuster_design.md`](../forward_regime_statistical_router/04_statistical_adjuster_design.md).
- Earlier NE read (benchmark vs routed stat): [`03_sarasi_ne_backtest_read.md`](../forward_regime_statistical_router/03_sarasi_ne_backtest_read.md) · [`findings.md`](../../extra/sarasi_weather_outage_model/findings.md).
- The coverage-ramp catch: [`forward_router_became_baseline_cleanup.md`](../../learning_logs/forward_router_became_baseline_cleanup.md).
- Principle: [`county_specificity.md`](../../principles/county_specificity.md).
