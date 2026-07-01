# Findings — EOF weather model (`_ve7_res`) vs our routed statistical baseline

**Date:** 2026-06-30 · **Scope:** the June-30 `_ve7_res` Northeast drop.
**Companion (June-24 candidate export):** [`../findings.md`](../findings.md).
**Reproducible analysis:** [`notebooks/05_forward_regime/weather_vs_stat_routing/`](../../../../notebooks/05_forward_regime/weather_vs_stat_routing/) → `outputs/{wape_pooled,wape_by_regime,routing_map}.csv`.

---

## 1. What we tested (and against what)

We scored the EOF-XGB event-count model against **our own regime-routed statistical forecaster** — not
just the naïve baselines — on ONE shared observed target, so the comparison is apples-to-apples.

```
  Region        Northeast, 189 counties (Sarasi's set — excludes the "stably bad grid" cluster)
  Cells         trigger T in {4, 8, 12, 24}h  (the overlap of both pipelines)  ×  test years 2023–25
  Target        annual event COUNT (frequency)   ← the only thing we forecast (see §5)
  Observed      shared — our annual counts agree with Sarasi's to corr 0.997–0.999, median ratio 1.000
  Metric        WAPE (weighted absolute % error), lower = better
```

**Our candidate list** (the "expert" pool the router picks from, per county behaviour regime):

```
  flat  ·  recent_k3 / recent_k5  ·  wtd_recent  ·  linear  ·  capped_lin  ·  theil_sen  ·  persist  ·  changepoint
  routed baseline = the regime's best expert:  stable → wtd_recent · trend/shift → persist · insufficient → wtd_recent
```

The weather model is the **challenger** to this routed baseline (the ladder: `flat → routed-stat → weather/climate`).

## 2. Backtest period

Rolling-origin on **test years 2023–25** (our side rolls train forward; Sarasi's `_ve7_res` uses a fixed
**2015–22 train**). The clean apples-to-apples slice is therefore **2023 only** (both train ≤ 2022); we
report both the 3-year pooled number and the fair 2023-only number.

## 3. Overall result

```
  POOLED WAPE (lower = better)              all 2023–25     fair 2023-only
    routed_stat  (our baseline)                0.152           0.121     ◀ best
    linear                                     0.168           0.152
    xgb  (weather)                             0.194           0.145
    flat                                       0.198           0.151
    glm  (weather, GLM)                        0.236           0.166
  weather XGB vs our routed-stat:              −27%            −20%
```

**Mechanism:** the weather model **beats the naïve baselines** (flat, linear) — matching Sarasi's own
finding — but does **not** beat our *regime-routed* statistical baseline (persist / wtd_recent). By regime
(fair 2023 slice) routed-stat wins everywhere: trend −36% · shift −31% · stable −13% · insufficient −3%
(the −3% is within noise). No cluster shows a clear-cut weather advantage.

## 4. Where weather DOES win — the durable set

Cluster-level hides a real county-level signal. Weather beats routed-stat **pooled in 71 / 189** counties,
but most flip sign year-to-year on a 3-year window (noise). Gating for robustness — **wins in all 3 test
years AND by ≥5% pooled margin** — yields **16 durable winners** (14 `stable`, 2 `shift`; all Northeast):

```
  Saratoga NY (−57%) · Chenango NY (−45%) · Rensselaer NY (−40%) · Seneca NY (−40%) · Rockland NY (−39%)
  Waldo ME · St. Mary's MD · Cortland NY · Chittenden VT · Grafton NH · Union PA · Androscoggin ME
  Tioga NY · Hudson NJ · Kent RI · Sullivan NH        (margins −32% … −9%; full table in routing_map.csv)
```

Notably these are mostly **stable** counties — weather is helping *smooth the steady counties*, not catch
storm spikes (that case is untested, §5). These 16 are what we'd route to the weather factor.

## 5. Caveats (read before acting)

```
  · COUNTS, not exposure.  We forecast frequency; the per-customer step is a static conversion. Sarasi's
    exposure prediction (_vc7_res) is a different target we did NOT score here.
  · EPISODIC is UNTESTED.  NE-189 has 0 episodic counties (episodic = rare storm-spike; lives in the
    interior West — KS/WY/UT/ND/MT). Episodic is weather's best theoretical case and this comparison can't reach it.
  · 3 test years, NE only, coverage-ramp-era.  Indicative, not definitive.
  · Rolling vs fixed train.  Our 2024/25 preds saw more recent data; the fair read is the 2023-only slice (still −20%).
  · Excludes the "stably bad grid" cluster by design — weather still loses on the 189 where it's most applicable.
```

## 6. What this means for the product + what we need from Sarasi

**Routing (the dashboard).** The Forecast factor decomposes into `statistical × climate/weather × grid`.
For the **16 durable-winner counties** we'd set **weather ≠ 1.0, statistical = 1.0** (weather governs);
everywhere else **statistical ≠ 1.0, weather = 1.0**; grid = 1.0 (not modelled). We are moving the
weather-vs-stat routing to a **finer, robustness-gated granularity** (county-level, not cluster) precisely
because no cluster shows a clean weather win but this durable county subset does.

**Asks:**
1. Sanity-check we scored `_ve7_res` fairly (shared observed = annual ≥T county counts; is that your target?).
2. **An episodic-region run** (interior West) — the one case our NE comparison structurally can't test, and weather's strongest.
3. When ready: current-year forecasts for the 16 winners, in a form we can convert to a factor (`forecast / long-run mean`), so we can wire them.
