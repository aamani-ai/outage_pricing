# How a "Forward Forecast" Turned Out to Be a Baseline-Coverage Cleanup

Date: 2026-06-24

## Why this note exists

We set out to build the first forward-looking layer: a statistical router that picks a forecast
expert per county regime. The backtest looked like a big win — and we nearly shipped a "forward stat
factor" that was mostly a **data-coverage artifact**. This records the catch, because the lesson is
general: *before you believe a forecast beats the mean, check whether the mean is just contaminated.*

```text
  the trap:   "recent years beat the long-run mean by ~36% out-of-sample" looked like real forecasting skill.
  the truth:  ~2/3 of it was EAGLE-I onboarding — the early years under-count, so the full-period mean is low.
```

## The chain of reasoning

```text
  1. backtest (national, rolling-origin):  a recent-level expert beats the flat mean massively.
                                            flat-mean BIAS = −17%  (it under-predicts).
  2. the tell:                              a −17% systematic LOW bias is not "noise" — it means
                                            counts ROSE 2015→2025. Why did they rise?
  3. the gate ("are we on clean data?"):    is the rise REAL outages, or EAGLE-I coverage ramp?
  4. the check:                             among counties observed EVERY year, the typical relative
                                            level goes 0.55 (2015) → 0.94 (2018) → 1.25 (2025).
                                            A +70% jump by 2018, near-uniform = reporting ramping up.
  5. the clincher:                          drop 2015-2017 and the flat-mean bias falls −17% → −6%,
                                            and the flat mean becomes nearly as good as "recent."
                                            => most of the "skill" was just dodging the under-counted years.
```

## What changed because of it

```text
  WAS GOING TO SHIP:  a "forward (stat)" factor ≈ big recent-vs-mean uplift, in the forward bracket.
  ACTUALLY CORRECT:   (a) a BASELINE cleanup — compute λ_history on a coverage-stable window (Step 1/2);
                          this is where ~2/3 of the "better than the mean" lives, and it RAISES prices
                          for early-onboarding counties (the mean was biased low).
                      (b) the real forward drift is the SMALL residual (~6%) — deferred, near ×1.0.
  Forward bracket (climate + grid) stays a PLACEHOLDER. We did not mislabel a data fix as a prediction.
```

## The meta-lesson

```text
  · a systematic BIAS (not just error) is a clue about the DATA, not only the model.
  · "out-of-sample skill" can be an artifact if the target series has a coverage/regime change in it.
  · the masked series removes years we KNOW are unobserved, but not residual ramp WITHIN observed years.
  · separate the question "is my baseline right?" (Step 1/2) from "will the future differ?" (Step 5)
    BEFORE attributing a number to forecasting.
```

## Recorded as

Decision + evidence: [`07_coverage_ramp_baseline_window.md`](../dicsscssion/eventization_frequency_contract/07_coverage_ramp_baseline_window.md)
(proposed assumption **A018**, refines [A012](../methodology/assumptions.md)). Backtest:
`notebooks/05_forward_regime/statistical_router/statistical_router_backtest.ipynb`. Checks:
`scratchpad/coverage_check.py`.
