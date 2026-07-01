# Regime Routing — Backtest Design Plan (Step 3)

**Status:** design **executed + adversarially validated** (2026-06-22)
**Last reviewed:** 2026-06-22
**Replaces:** [`done/2026-06-22_risk_based_clustering_quantification_plan.md`](../done/2026-06-22_risk_based_clustering_quantification_plan.md) (the 7-shape approach)
**Analysis (built, now Step-5 evidence):** [`notebooks/05_forward_regime/regime_routing_backtest.ipynb`](../../../notebooks/05_forward_regime/regime_routing_backtest.ipynb) → artifact `notebooks/outputs/regime_routing/county_regime_T8.csv`
**Framework:** [`OUTAGE_MODELING_FRAMEWORK.md`](../../OUTAGE_MODELING_FRAMEWORK.md) Step 3 ▸ *Reframe — REGIME ROUTING*

## Findings (2026-06-22) — built, run on real data, verified by 4 adversarial lenses

```text
 Q1 in-sample regime mix     flat 41% · step 25% · trend 19% · recent 14%   (flat = plurality)
 Q2 OUT-OF-SAMPLE (prequential, the only skill claim)
       pooled (event-weighted)   +18.2%   routed MAE 12.5 vs flat 15.2
       per-county equal-weighted  mean +6.0% · MEDIAN 0% · 41% of counties >5% better
       => the win is TAIL PROTECTION on volatile counties; for the median county FLAT is unbeaten.
          (router ties 52% of folds by choosing flat; wins 64% of the non-tie folds, +31% on those;
           top 10% of folds hold ~79% of all savings.)
 VALIDATION  permutation test: +18.2% collapses to ~ -7% under shuffled targets => NO lookahead leakage.
 Q3 cross-T  4-class agreement 57% (T4) / 62% (T12) vs ~29% chance; flat-vs-non-flat 77% / 79%.
             => moderate, not rigid T-invariance (A014). routing transfers; exact sub-label less so.
 A016 caveat all-duration mask applied to T=8 discards ~3,073 genuine >=8h events (2015-17);
             survivorship skews short-history counties toward flat — reported via a confidence tier.
```

**Bottom line:** routing is justified (Q2 passes honestly), but the honest claim is narrow —
*"we identify a minority of volatile/drifting counties where a non-flat estimator measurably beats
the long-run mean out-of-sample; the median county stays flat."* That is the router; forecasting +
adjustment layers (and the weather expert) plug in after. Below is the design as specified.

## Stage → Question → Solution

```text
 STAGE     Step 3 — risk clustering, on the source-coverage-masked annual series
 QUESTION  which counties behave alike enough that a SHARED forecasting estimator is the
           right tool — and which estimator?  (NOT "what shape is this county?")
 SOLUTION  score a fixed estimator shortlist on each county's held-out years; the WINNER
           induces the regime. one regime per county. select, don't blend. flat is the floor.
```

This is the **router**, not the forecast (see the framework Reframe). It says *which machinery
applies where*; it does not itself predict the future. Everything here runs on **outage history
alone**.

---

## The core principle: behavior, not cause

We cluster on **what the county's outage history DOES** (its temporal behavior), **not on WHY**
it does it (weather / grid / geography).

```text
   "episodic"  one or two years dominate the count series      ┐
   "trendy"    a simple line predicts held-out years well       ├─ all VISIBLE in the counts
   "flat"      the long-run mean predicts as well as anything   ┘
```

You can *detect* the regime from the masked annual count series alone — you do not need to know
it's hurricanes vs. an aging substation to *see* the pattern. So at this stage the clustering has
exactly **one input**:

```text
 IN  (the necessary variable)                NOT IN  (yet — and not needed to find the regime)
 ──────────────────────────────────          ───────────────────────────────────────────────
 masked per-county annual                     weather / climate covariates
   qualifying-event counts                    grid condition / asset age
   + features DERIVED from it                  geography / hazard exposure
   + the estimators (all functions             Sarasi's weather→outage ML model
     of that same series)
```

Cause data enters **later**, through two doors — neither is an input to the regime itself:

```text
 door 1   a richer forecasting EXPERT (Sarasi's weather→outage ML) that the regime ROUTES TO
 door 2   enrichment that EXPLAINS a regime ("episodic BECAUSE hurricane-exposed") or refines
          its boundary — a Gen-2 nicety, not a Gen-1 requirement
```

> **Why this matters for shareability:** "we grouped counties by how their outage history
> *behaves*, then picked the estimator that predicts each group best out-of-sample" is defensible
> to a carrier with zero climate modeling in the room. The cause story is additive, not load-bearing.

---

## The method — score a shortlist, the winner induces the regime

For each county we forecast a held-out year from its prior observed years, using each estimator.
All estimators are functions of the county's **own** annual count series `y`.

| # | estimator (expert) | forecast ŷ for year *t* | the behavior it wins on |
|---|---|---|---|
| 0 | **flat mean** · **FLOOR** | mean of all prior observed `y` | stable / no reliable signal |
| 1 | recent-mean | mean of last *k*=3 observed `y` | recent level shift |
| 2 | linear trend (OLS) | extrapolate OLS slope on (year, `y`) | smooth drift |
| 3 | robust trend (Theil–Sen) | extrapolate median-of-slopes | drift, spike-resistant |
| 4 | persistence | last observed `y` | abrupt step / random-walk level |

```text
 FLAT is the floor: any other estimator must EARN its place by beating flat out-of-sample
 by a margin. otherwise the county is "flat regime" — the v0 long-run mean stands.
```

*(Explicit changepoint/piecewise is deferred — fragile on ~7–11 points. Persistence is its
robust proxy for now; revisit if the backtest shows a real step-regime flat+persistence misses.)*

---

## The backtest — rolling-origin, group-pooled

**Rolling-origin (expanding window)** — honest out-of-sample on short series; no lookahead:

```text
 observed years →  2015 2016 2017 2018 2019 2020 2021 2022 2023 2024 2025
 fold A           [────── train ──────]  ?t                                  predict 2021
 fold B           [──────── train ────────]  ?t                             predict 2022
 fold C           [─────────── train ───────────]  ?t                       predict 2023
 fold D           [────────────── train ──────────────]  ?t                 predict 2024
 fold E           [───────────────── train ─────────────────]  ?t           predict 2025
   each estimator fits on train-only, predicts the held-out year, error recorded.
   require ≥ 4 training years before the first fold  →  ~3–5 test folds per county.
```

**Score** — counts, so robust + proper:

```text
 primary    MAE   over held-out years         (interpretable: "events off per year")
 check      Poisson deviance                   (proper scoring rule for counts)
```

**Win rule (the flat floor)** — an estimator wins the county only if it beats flat by a margin:

```text
 winner = argmin MAE over estimators
 BUT keep flat unless  MAE(winner) ≤ (1 − m) · MAE(flat)     m ≈ 0.10
   → no false "trend" from fitting noise; ties and near-ties default to flat (conservative)
```

**Pool for power (your "don't backtest one county" point)** — a single county's 3–5 folds are
noisy. So the *evidence* is read at the group level:

```text
 per-county margins are NOISY  →  pool to ask the real questions:
   • does estimator X beat flat RELIABLY, and WHERE?  (win-rate + mean margin across counties)
   • shrink each county's winner toward FLAT unless its margin is robust within its group
   • aggregate honesty check: does routing beat ALWAYS-FLAT out-of-sample in aggregate?
        if NO → the regimes aren't real → default everyone to flat (an honest null result)
```

**Data gate** — too little history to backtest:

```text
 < (4 train + 1 test) observed years  →  regime = "flat (insufficient history)"  → FLOOR
 (connects to the masked series: ramp/partial years are already NULL, not zero)
```

---

## Emergent subgroups (the OUTPUT, never hand-drawn)

```text
 the regime PARTITIONS counties by winning estimator — discovered, not pre-declared:

   flat regime        counties where flat wins        → v0 mean stands
   recent regime      recent-mean wins                → level-shift counties
   trend regime       OLS / Theil–Sen wins            → drifting counties
   step regime        persistence wins                → abrupt-level counties

 "the trend-winning counties" is a SUBGROUP — an output of the backtest. map it, pool it,
 re-validate within it. it was never an input.
```

---

## Validation — the backtest IS the validation

Unlike the 7-shape approach (which asked "are the shapes distinct?" and got bidirectional churn),
the test here is **action-based** and falsifiable:

```text
 Q1  do regimes route to DIFFERENT winning estimators?      (else the labels are cosmetic)
 Q2  does routing beat ALWAYS-FLAT out-of-sample, in aggregate?  (else default all to flat)
 Q3  is the regime stable across T (derived at T=8h)?       (else it's a T-artifact, not identity)
 Q4  is the winner's margin robust under the group-shrink?  (else it's overfit to a noisy county)
```

If Q2 fails, the honest deliverable is "v0 flat mean is unbeaten — no routing yet." That is a
*real* result, not a failure to manufacture.

---

## Assumptions to register (in [`assumptions.md`](../../methodology/assumptions.md))

```text
 A013  regime is BEHAVIOR-based — derived from outage history alone; cause covariates
       (weather/grid/geography) are deferred (Gen-2 enrichment / a forecasting expert).
 A014  regime derived at T=8h (the robustly-conservative threshold) and asserted
       T-INVARIANT (one per county); validated by cross-T agreement (Q3), not assumed.
 A015  counties below the rolling-origin data gate default to the FLAT floor (the v0 mean);
       ties / sub-margin winners also default to flat (select-conservative).
```

---

## Notebook build order (what `regime_routing_backtest.ipynb` will do)

```text
 1. load the MASKED annual series  (fips × year counts at T=8h; NULLs = missing, not 0)
 2. implement the 5 estimators as pure functions of a training series
 3. rolling-origin backtest → per-county per-estimator MAE + Poisson deviance
 4. apply the win rule (flat floor + margin) → per-county winner = regime
 5. pool: win-rates, mean margins, the aggregate routing-vs-flat check (Q2), group shrink
 6. emergent subgroups: partition + a national map "color by regime"
 7. cross-T stability check (Q3) on a second threshold
 8. honest write-up cell: what won, where, and whether routing is justified at all
```

## References

- Direction: [`OUTAGE_MODELING_FRAMEWORK.md`](../../OUTAGE_MODELING_FRAMEWORK.md) Step 3 ▸ *Reframe*
- The masked series this consumes: [`05_source_coverage_mask.md`](../../dicsscssion/eventization_frequency_contract/05_source_coverage_mask.md)
- Conservatism / why T=8h: [`04_duration_conservatism.md`](../../dicsscssion/eventization_frequency_contract/04_duration_conservatism.md)
- Superseded predecessor: [`done/2026-06-22_risk_based_clustering_quantification_plan.md`](../done/2026-06-22_risk_based_clustering_quantification_plan.md)
- Downstream (gated): [`lambda_shadow_pricing_verification_plan.md`](../03_risk_clustering/lambda_shadow_pricing_verification_plan.md) — how a regime could move λ, later
