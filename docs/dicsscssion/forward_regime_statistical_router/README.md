# Forward Regime Statistical Router — Discussion

**Status:** discussion / pre-plan  
**Date:** 2026-06-24  
**Purpose:** define the first actionable Step-05 forward-regime trial: a
regime-routed statistical forecasting layer, before heavier weather / climate /
grid ML is treated as necessary.

> **Outcome update (2026-06-24) — redirected to a baseline cleanup.** The national backtest was built
> and run (`notebooks/05_forward_regime/statistical_router/`). It showed the apparent "recent beats the
> mean" signal is **~2/3 EAGLE-I coverage ramp**, not forward skill (the full-period mean is biased ~17%
> low because 2015–2017 are under-counted). **Decision:** the forward bracket (climate + grid) stays a
> **placeholder**; the real, honest fix is a **baseline-window cleanup** (Step 1/2) — see
> [`../eventization_frequency_contract/07_coverage_ramp_baseline_window.md`](../eventization_frequency_contract/07_coverage_ramp_baseline_window.md).
> The routed-statistical idea below is sound but **deferred** until λ_history is computed on
> coverage-stable years. Everything below is the original framing, kept as the reasoning trail.

## Thesis

The first forward-looking layer does not need to start as a complex weather or
climate model.

The actionable question is simpler:

```text
Given a county's behavior bucket, which simple forecast expert should set the
next-year frequency view?
```

That moves Step 5 from:

```text
everyone -> historical mean
```

to:

```text
stable      -> history / climatology
trend       -> trend expert
shift       -> recent-level / persistence / changepoint expert
episodic    -> storm-tail / hazard-review expert
insufficient-> credibility / shrinkage / no forced move
```

This is still forward-looking, but it is auditable and testable from the outage
series itself. Weather, climate, and grid covariates become challengers to this
routed statistical baseline, not the first thing we must believe.

## Why This Exists Now

Two pieces now line up:

1. Step 3 has a clean regime classifier: stable / trend / shift / episodic /
   insufficient.
2. The Northeast Sarasi forecast-candidate export showed that routing by bucket
   already improves the forecast, even with a limited candidate set.

The result is not "pick XGB-PCs" and not "use Linear Trend everywhere." The
useful result is:

```text
method choice should depend on the county behavior bucket.
```

## Index

| Doc | What |
|---|---|
| [`01_statistical_router_framing.md`](01_statistical_router_framing.md) | The reasoning: why a simple statistical router is the first forward-regime trial. |
| [`02_candidate_experts_and_metrics.md`](02_candidate_experts_and_metrics.md) | Candidate forecast experts, bucket hypotheses, metrics, scoring rules, and gates. |
| [`03_sarasi_ne_backtest_read.md`](03_sarasi_ne_backtest_read.md) | What the Northeast Sarasi export does and does not prove. |
| [`04_statistical_adjuster_design.md`](04_statistical_adjuster_design.md) | **The resolved structure (for sign-off):** the statistical forecast is the **FORWARD baseline** (inside the forward bucket — the "stat" in `stat + climate + grid`); per-county, asymmetric-loss, one-directional (uplift + abstain), credibility-shrunk, capped, shadow. Climate/grid ML are challengers that must beat it. |

Implementation plan:
[`../../../plan/done/2026-06-24_statistical_router_notebook_plan.md`](../../plan/done/2026-06-24_statistical_router_notebook_plan.md).

Notebook workspace:
[`../../../notebooks/05_forward_regime/statistical_router/`](../../../notebooks/05_forward_regime/statistical_router/).

## Position In The Framework

```text
Step 3: Risk clustering
  "what kind of county is this?"
  -> behavior identity, not a forecast

Step 5: Forward regime
  "which forecast expert should be trusted for this behavior?"
  -> model choice + backtested forward lambda candidate
```

This discussion is the bridge between Step 3 and Step 5.

## Non-Goals

- No active pricing change from this discussion.
- No dashboard code in this phase.
- No claim that weather / climate / grid signals are unimportant.
- No claim that a single national method should win.
- No forced model for thin or ambiguous buckets.

The trial is intentionally modest: build the best simple routed statistical
baseline first, then ask whether heavier models beat it.
