# Statistical Router Framing

**Status:** discussion / reasoning note  
**Date:** 2026-06-24  
**Companions:** candidate note
[`02_candidate_experts_and_metrics.md`](02_candidate_experts_and_metrics.md) ·
Sarasi read [`03_sarasi_ne_backtest_read.md`](03_sarasi_ne_backtest_read.md) ·
plan
[`../../../plan/05_forward_regime/statistical_router/01_notebook_plan.md`](../../../plan/05_forward_regime/statistical_router/01_notebook_plan.md)

---

## TL;DR

```text
The first forward-regime trial should be a regime-routed statistical forecast.

Do not start by assuming the complex weather / climate / ML candidate is the
forward model. First test whether simple forecast experts, routed by behavior
bucket, beat the historical mean and the best single global method.
```

This is the cautionary lesson from the Northeast candidate backtest:

```text
Best single global method:
  Linear Trend WAPE ~0.177

Simple bucket router:
  Stable     -> County-History Joint
  Non-stable -> Linear Trend

Router WAPE ~0.167
Lift vs best global method: ~5.7%
```

That lift came from selecting the right kind of simple expert for the right
bucket, not from adding more model complexity.

---

## 1. The Actual Forward Question

The current pricing baseline is mostly:

```text
lambda_history(fips, T) = long-run historical mean frequency
```

That is a strong audit baseline, but it is not always the best forecast. The
forward-regime question is:

```text
For this county and trigger, is the long-run mean still the right estimate
for the next policy period?
```

The first answer does not require causal weather features. A county's own annual
series can already say:

```text
stable      -> mean is probably the right forecast
trend       -> mean lags the direction
shift       -> full-period mean straddles old and new level
episodic    -> mean hides storm-tail concentration
insufficient-> evidence cannot support a move
```

So the first Step-05 build should test **forecast expert choice**, not a single
forward modifier.

---

## 2. Why This Is Not Just Step 3 Again

Step 3 is an identity:

```text
county annual shape -> stable / trend / shift / episodic / insufficient
```

Step 5 is an action:

```text
regime + backtest evidence -> choose forecast expert for lambda_forward
```

The same label can be useful even if the exact estimator evolves. For example:

```text
shift today:
  Linear Trend wins in the limited Northeast candidate set.

shift likely next:
  recent mean / persistence / changepoint plateau should compete, because those
  are the natural experts for a level move.
```

The regime is the routing key. The estimator is the forecast machinery.

### First-Order County Nature vs. Second-Order Threshold Nuance

The current risk clustering deliberately assigns **one primary regime per
county**. That is a first-order read:

```text
What is the county's dominant outage-count behavior?
```

It is not a claim that every duration threshold inside that county behaves
identically. It is also not a restriction that prevents later threshold-specific
forecasting.

The sequencing matters:

```text
first order:
  county -> one behavioral identity
  stable / trend / shift / episodic / insufficient

second order:
  within that county identity, ask whether specific thresholds bend differently
  e.g. trend county overall, but 24h behaves more episodic or sparse

third order:
  allow regime x threshold routing where the evidence is stable enough
```

Most counties should not need a complicated per-threshold story. The single
county nature is the right starting point and keeps the router explainable. But
there will be outliers, especially at the tails, where a county's short-trigger
behavior and long-trigger behavior differ.

That is why Step 3 already carries the cross-T descriptor (`xT`): it does not
force rigid invariance; it flags where the first-order label should be read with
caution.

The practical rule for Step 5:

```text
Start with county-regime routing.
Then test threshold-specific refinements.
Adopt regime x threshold routing only when it beats the simpler router
without becoming fragile.
```

This avoids two failure modes:

- oversimplifying by forcing one method everywhere;
- overcomplicating by jumping straight to a sparse regime x threshold matrix
  before the first-order county router is proven.

---

## 3. The Cautionary Tale: ML Must Beat The Routed Statistical Baseline

The Sarasi notebook treats XGB-PCs as the best **ML/weather challenger**. That is
useful, but it is not the same as best overall forecasting method.

For pricing, the simple baselines are not decorative references. They are real
forecast candidates:

```text
County-History Joint = climatology / history expert
Linear Trend         = simple forward extrapolation expert
Recent mean          = recent-level expert
Persistence          = last-level expert
Changepoint plateau  = post-shift level expert
```

Even if County-History Joint is too much machinery for the first national
notebook, the principle still holds. A plain flat mean or empirical-history
proxy can stand in for the history expert. The important move is not that one
specific model wins; it is that the **candidate class** should be selected by
the behavior bucket.

The benchmark order should therefore be:

```text
1. historical mean / current baseline
2. best single simple statistical method
3. regime-routed simple statistical methods
4. weather / climate / grid ML challengers
```

If a complex model only beats (1), that is not enough. It should beat (3), or it
should be used only in the buckets where it adds incremental skill.

---

## 4. What "Forward" Means In This First Trial

This trial is forward-looking because it predicts held-out future years from
past years only:

```text
train through Y -> predict Y+1
```

It is not forward-looking because it uses climate scenarios, utility capex, or
storm forecasts. Those are later lanes.

This distinction matters:

```text
statistical router:
  "the county's own history says the next level should be read differently"

weather / climate / grid model:
  "external covariates explain why the future should differ"
```

The first is cheaper, faster, and easier to audit. The second should be added
only where it creates lift over the first.

---

## 5. Initial Routing Hypotheses

These are hypotheses for the notebook, not decisions.

| Regime | Expected best expert | Why |
|---|---|---|
| Stable | flat mean / County-History Joint | No reliable direction; extrapolation can add noise. |
| Trend | linear trend / capped trend / Theil-Sen | The mean lags a persistent slope. |
| Shift | recent mean / persistence / changepoint plateau | Full-period mean blends old and new level; line may be only a proxy. |
| Episodic | historical tail / hazard review / capped mean | One or two storm years dominate; neither flat nor trend is fully honest. |
| Insufficient | shrinkage / no move / quoteability gate | Evidence cannot support a directional forecast. |

The Northeast result already supports the first two rows. It does not fully test
episodic, and it under-tests shift because the natural shift experts were absent.

---

## 6. Product Read

If the notebook works, the forward layer can start as:

```text
lambda_forward_candidate(fips, T)
  = forecast_expert(regime(fips), annual_count_history(fips, T))
    / exposure_years_or_denominator
```

It should be emitted as a shadow artifact:

```text
forward_router_shadow.json
  fips
  T
  regime
  chosen_expert
  lambda_history
  lambda_forward_candidate
  factor = lambda_forward_candidate / lambda_history
  confidence
  evidence
  reason
```

Activation is a separate decision. Early use should be Studio-only / shadow,
with caps and a clear "model choice" explanation.

---

## 7. Guardrails Before Any Price Movement

- The routed method must beat the current historical mean and the best single
  global method out-of-sample.
- Report both pooled WAPE and duration-neutral average WAPE; do not let 4h volume
  hide 24h behavior.
- Report bias; a lower WAPE with large systematic underpricing is not acceptable.
- Do not force a move for `insufficient`.
- Treat shift and episodic as special review buckets until their natural experts
  are in the candidate set.
- Cap any lambda factor before dashboard exposure.
- Keep weather / climate / grid ML as challenger methods until they beat the
  routed statistical baseline.

---

## 8. The Practical Next Step

Build the notebook-first national backtest:

```text
notebooks/05_forward_regime/statistical_router/statistical_router_backtest.ipynb
```

It should score simple statistical experts across the US, by regime and by
duration threshold, and answer:

```text
Does regime-routed expert choice beat:
  1. historical mean
  2. best single global expert
  3. current limited Northeast routing result?
```

If yes, this becomes the first credible forward-regime shadow artifact.
