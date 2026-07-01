# Statistical Router — Notebook Implementation Plan

**Status:** plan of record for the first Step-05 statistical-router trial  
**Date:** 2026-06-24  
**Discussion:** [`../../../dicsscssion/forward_regime_statistical_router/`](../../dicsscssion/forward_regime_statistical_router/)  
**Notebook target:** `notebooks/05_forward_regime/statistical_router/statistical_router_backtest.ipynb`

---

## 0. Locked framing & decisions (2026-06-24)

The canonical evolution order (send-ready ladder):

```text
  1 historical mean → 2 county-bucket router → 3 regime × threshold router → 4 weather/climate/grid challenger
  1–3 use the county's OWN counts (leakage-free, EAGLE-I-only, auditable); 4 is the first external layer.
```

This notebook builds **steps 2 and 3 together** — one backtest, because you can't judge step 3 without
step 2's per-cell numbers.

- **D1 — per-customer gate: EXEMPT for build + backtest.** The router forecasts the county frequency
  λ from the county's own counts (a better baseline estimate, *not* a ±20% causal overlay), so its
  skill is independent of the per-customer conversion. *Activation* (moving price) stays gated behind
  the per-customer track + caps.
- **D2 — step-3 scope = expert-by-T only (2a).** The chosen expert may differ by trigger T, but the
  county keeps its **single** regime label. Re-deriving the regime label per T (**2b**) relaxes
  [A014](../../methodology/assumptions.md) and is a later **Step-3** refinement — *out of scope
  here*. `xT` flags where 2a/2b will pay off.
- **D3 — selection honesty (overfit guard).** Report the hypothesised regime→expert mapping (a
  **prior** rule, *not* fit to the data) evaluated out-of-sample, **alongside** the data-chosen
  "oracle" router. A bucket router that only wins when its experts are picked in-sample is overfit;
  the prior router is the honest test that the *bucket idea* (not the selection) carries the lift.
- **D4 — band/window coupling (noted, not built).** A shift/trend county's forward point uses recent
  years; its experience band ([A017](../../methodology/assumptions.md)) should use the same window.
  The notebook emits each chosen expert's effective window so the band work can consume it later. No
  band change here.

---

## 1. Goal

Build a national, notebook-first backtest that tests whether simple statistical
forecast experts, routed by county regime, beat:

```text
1. the current historical mean
2. the best single global expert
3. a naive one-model-for-everyone approach
```

This is the first actionable forward-regime trial. It intentionally starts with
simple statistical candidates before weather / climate / grid ML.

---

## 2. Why This Notebook Exists

The Northeast Sarasi read showed:

```text
Linear Trend is the best single global method.
Stable counties prefer County-History Joint / history.
A simple stable-vs-non-stable router improves WAPE by ~5.7%.
```

But the Sarasi export is limited:

```text
Northeast only
no episodic bucket
no 2h threshold
missing natural shift experts
event-count scoring only
```

This notebook scales the idea nationally and fixes the candidate set.

---

## 3. Architecture

```text
inputs
  annual county count series by T
  source coverage mask
  Step-3 regime classification
        |
        v
candidate experts
  flat mean
  recent mean
  weighted recent mean
  linear / capped linear / Theil-Sen
  persistence
  changepoint plateau
        |
        v
rolling-origin backtest
        |
        v
metrics by regime / T / xT / confidence
        |
        v
routing rule candidates + shadow artifacts
```

No dashboard code. No active pricing change.

---

## 4. Inputs

| Input | Expected path | Use |
|---|---|---|
| Annual county count trend | `curated_outage_data/outputs/county_trend/county_yearly_trend__eagle-i-45min.parquet` | Main `fips x T x annual counts` source. |
| Source coverage mask | output from `source_coverage_mask_analysis.ipynb` / existing mask artifact | Do not treat unobserved ramp years as zeros. |
| Regime classification | `notebooks/outputs/regime_classification/county_regime_T8.csv` | Route buckets: regime, sub, confidence, xT. |
| Pricing triggers | dashboard current set: `2h / 4h / 8h / 12h / 24h` | Product-aligned scoring. |
| Optional Sarasi outputs | `docs/extra/sarasi_weather_outage_model/*.parquet` | External comparison / reproduction of Northeast evidence, not the national core. |

If a path differs in the current repo, the notebook should discover and print
the resolved path at the top. No silent fallback.

---

## 5. Candidate Experts

Minimum first-run expert list:

| Expert | Regime hypothesis |
|---|---|
| flat mean | stable / default |
| recent mean k=3 | shift / recent-change |
| recent mean k=5 | smoother shift |
| weighted recent mean | gradual recent level |
| linear trend | trend |
| capped linear trend | trend with guardrail |
| Theil-Sen trend | robust trend |
| persistence / last-level | abrupt shift |
| changepoint plateau | shift |

Optional if easy:

| Expert | Use |
|---|---|
| County-History Joint | comparable to Sarasi history/climatology expert |
| shrink-to-state / region | insufficient / sparse fallback |

The notebook should keep every expert implementation small and inspectable.
Avoid adding external ML packages in this first trial.

---

## 6. Notebook Sections

```text
00  FRAMING AND RULES
    State the question: routed statistical forecast first, ML later.
    State non-goals: no active pricing, no dashboard, no causal weather claim.
    Print catalog, trigger set, date, and input paths.

01  LOAD AND SANITY-CHECK SERIES
    Load annual counts by county and T.
    Apply observed-year mask.
    Distinguish missing year from observed zero.
    Emit sample-flow table: counties, years, missing cells, nonzero cells.

02  LOAD REGIME BUCKETS
    Join Step-3 regime classification.
    Report counts by regime, sub, xT, confidence.
    Check every county in the annual series has a regime or explicit missing reason.

03  DEFINE EXPERTS
    Implement flat, recent, weighted recent, trend, capped trend, Theil-Sen,
    persistence, changepoint plateau.
    Unit-test each expert on synthetic mini-series:
      stable, trend, shift, spike, sparse.

04  ROLLING-ORIGIN BACKTEST
    For each county/T/fold:
      train on observed years <= Y
      predict Y+1
      store prediction for every expert
    Enforce minimum train-year and volume gates.

05  METRICS
    Compute WAPE, bias, MAE, RMSE, Poisson deviance.
    Report:
      pooled across all triggers
      per T
      duration-neutral average
      by regime
      by regime x T
      by xT and confidence

06  ROUTER CANDIDATES
    Compare:
      R0 everyone -> flat
      R1 everyone -> best single global expert
      R2 stable -> history, non-stable -> best non-flat
      R3 regime -> best expert by regime
      R4 regime + T -> best expert by regime/T
    Keep R4 diagnostic unless stability is clearly strong.
    The sequence is deliberate: prove the first-order county-nature router
    before adopting a regime-by-threshold rule.

07  SHIFT AND EPISODIC DEEP READ
    Specifically inspect shift:
      recent mean vs persistence vs changepoint vs linear trend.
    Specifically inspect episodic:
      does any simple expert beat flat, or should it route to hazard/review?
    Do not overclaim thin buckets.

08  BIAS AND CAP CHECK
    Compute factor = forecast / historical mean.
    Show factor distribution by regime/T.
    Apply candidate caps for shadow read, e.g. [0.75, 1.50] as a diagnostic.
    Do not recommend activation yet.

09  OUTPUT ARTIFACTS
    Write predictions, metrics, routing rules, and a model card to
    notebooks/outputs/forward_regime/statistical_router/.

10  VERDICT CELL
    Plain-English answer:
      did routed statistical forecasting beat flat?
      did it beat the best single global expert?
      which buckets have clear rules?
      which buckets need more evidence?
      should this become a shadow forward artifact?
```

---

## 7. Metrics Contract

Primary:

```text
WAPE = sum(abs(predicted - observed)) / sum(observed)
```

Required companion:

```text
Bias = sum(predicted - observed) / sum(observed)
```

Report lift:

```text
lift_vs_baseline = (WAPE_baseline - WAPE_router) / WAPE_baseline
```

Required tables:

```text
metrics_by_expert.csv
metrics_by_expert_T.csv
metrics_by_regime_expert.csv
metrics_by_regime_T_expert.csv
metrics_by_router.csv
metrics_duration_neutral.csv
factor_distribution_by_regime_T.csv
```

---

## 8. Output Contract

Write to:

```text
notebooks/outputs/forward_regime/statistical_router/
```

Expected files:

| File | Purpose |
|---|---|
| `predictions_long.parquet` | One row per county/T/year/fold/expert with observed and predicted count. |
| `metrics_by_expert.csv` | National score by expert. |
| `metrics_by_regime_expert.csv` | Main bucket evidence table. |
| `metrics_by_router.csv` | R0/R1/R2/R3/R4 router comparison. |
| `routing_rule_candidate.json` | Candidate shadow routing rule, if gates pass. |
| `forward_router_shadow.csv` | Per county/T candidate lambda/factor/read. |
| `model_card.md` | Plain-English verdict and limits. |
| `assumptions_to_register.md` | Any new assumptions proposed for the registry. |

No NaN/Inf in JSON outputs.

---

## 9. Acceptance Gates

The notebook earns a follow-on artifact plan only if:

- routed statistical forecast beats historical mean out-of-sample;
- routed statistical forecast beats the best single global expert;
- lift survives per-threshold review, not only pooled WAPE;
- bias is not directionally dangerous;
- stable counties are protected from over-extrapolation;
- shift counties show a plausible winner after adding shift experts;
- episodic and insufficient are handled honestly, not force-fit.

If gates fail:

```text
Keep current historical mean as the forward baseline.
Record the null result.
Do not manufacture a forward factor.
```

---

## 10. Out Of Scope

- Weather / climate / grid covariates.
- XGBoost / GLM / PCA model training.
- Customer-exposure translation.
- Dashboard integration.
- Active premium movement.
- Production pipeline changes.

Those come after the statistical-router baseline exists.

---

## 11. Documentation Updates After Execution

If the notebook is built and run, update:

- this plan with the executed status and headline metrics;
- [`../../../dicsscssion/forward_regime_statistical_router/03_sarasi_ne_backtest_read.md`](../../dicsscssion/forward_regime_statistical_router/03_sarasi_ne_backtest_read.md)
  with the national comparison;
- [`../../../OUTAGE_MODELING_FRAMEWORK.md`](../../OUTAGE_MODELING_FRAMEWORK.md)
  Step 5 status, if the gates pass;
- [`../../../methodology/assumptions.md`](../../methodology/assumptions.md)
  only if a new assumption is actually adopted;
- a task handoff under `docs/extra/tasks_history/` if the implementation session
  is substantial.
