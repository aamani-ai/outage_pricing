# Statistical Forecast — the FORWARD baseline (inside the Forward bucket)

- **Status:** design / **for sign-off before any code**
- **Date:** 2026-06-24 (revised — placement corrected)
- **Resolves:** the statistical read lives **inside the FORWARD bucket** as its **baseline forecast** —
  the "stat" in `stat + climate + grid`. Not a baseline change; not a separate peer adjuster.

## The decision (settled)

```text
  · NOT a baseline change   — a global rule can't be right per-county (county-specificity); the
                              BASELINE stays the raw full-period mean (the transparent AUDIT ANCHOR).
  · NOT a separate peer      — earlier draft made it a peer to forward on an "intrinsic vs extrinsic"
                              argument. That was wrong: statistical and climate/grid are competing
                              METHODS for the SAME question ("what is next year's frequency?"), not
                              orthogonal questions. Different INPUTS ≠ different questions.
  · IS the FORWARD baseline  — the statistical forecast is the first-cut forward-frequency view, and
                              the climate/grid ML layers are CHALLENGERS that must beat it (the ladder).
```

Why inside forward, not a peer: the **comparison ladder** only works if they share a bucket. The
statistical forecast is the baseline every future ML/weather model must beat — `mean → stat → stat×T →
climate/grid challenger`. If stat were a separate adjuster, the forward bucket would have no baseline to
compare against, and "beat the routed statistical baseline, not just the mean" would have nothing to
anchor on.

## Composition

```text
  premium = BASELINE λ  ×  LOCATION    ×  FORWARD                        × payout / (1 − ER − TM)
            raw county      within-        the forward-frequency view
            full-period      county         = forward_forecast / baseline_mean
            mean (ANCHOR)    (spatial)       decomposed:  stat × climate × grid
            untouched        shadow          stat ACTIVE (shadow) · climate/grid = ×1.0 placeholders
```

`FORWARD` is **one adjuster (one factor)**, internally decomposed as **`stat + climate + grid`** (the
bracket + drop-down). Today the forward factor *is* the stat factor (climate/grid = ×1.0).

## The `stat` baseline forecast — how it's built

```text
  stat_factor(fips, T) = forward_forecast(fips, T) / λ_full(fips, T)
    · forward_forecast = the county's regime-routed forecast for next year (recent-level / trend / ...)
    · λ_full           = today's full-period mean (the baseline anchor)
  · GROUPED, not atomised:  the METHOD is chosen per regime GROUP (the cluster), APPLIED to this county.
  · ASYMMETRIC LOSS:        method selection penalises UNDER-prediction (~3×) over over-prediction —
                            under-counting = under-reserving = the dangerous error; over-counting = cushion.
  · ONE-DIRECTIONAL (v1):   uplift + ABSTAIN, floored at ×1.0 — NEVER discount. Only correct UPward
                            (toward cushion) or hold; declining counties keep the higher full-mean = cushion.
                            (evidence-gated discounting is a documented FUTURE refinement.)
  · CREDIBILITY-SHRUNK:     factor = 1 + (raw − 1) × credibility(county); thin/low-confidence → toward ×1.0
                            (abstain). So a factor is NOT one county's noisy ratio — it's group-robust.
  · CAPPED · SHADOW:        bounded; validated:false; NOT in the quoted premium; Studio-only until reviewed.
```

Honest characterisation: with `λ_full` biased low by coverage, `stat` mostly **uplifts** (a per-county,
bidirectional-capable but v1-one-directional correction of the under-priced baseline). It is "the county's
recent experience vs its long-run mean," NOT a clean causal forward signal — labelled as such.

## The drop-down (forward detail — mirrors `location-detail`)

```text
  · the FORWARD bracket reads "stat + climate + grid".
  · stat read:  "This county is <regime> (<confidence>). Its own history forecasts <method> → ×<factor>
                 (uplift / hold). credibility-shrunk, capped, shadow."
  · the annual qualifying-event series with the chosen method's forecast overlaid (before/after).
  · climate / grid: shown as ×1.00 placeholders — "future challengers; must beat the stat baseline."
```

## Open — to settle in the calibration, AFTER this structure is signed off

```text
  · asymmetric-loss weight (e.g. 3:1) for method selection; the per-regime method on coverage-aware data.
  · credibility function (what drives the shrink: observed years / volume / regime confidence).
  · cap width + clipping policy; abstain rule for `insufficient` (factor → ×1.0).
  · honest label wording in the UI.
```

## Maturity now

Step-3 regime grouping is real; method selection + credibility + asymmetric loss need the calibration
pass. So `stat` is **shadow** until calibrated and reviewed. **No dashboard code until this structure is
signed off.**

## Cross-references

- Principle: [`../../principles/county_specificity.md`](../../principles/county_specificity.md).
- Why not a baseline cleanup: [`../eventization_frequency_contract/07_coverage_ramp_baseline_window.md`](../eventization_frequency_contract/07_coverage_ramp_baseline_window.md).
- The ladder (mean → stat → stat×T → ML challenger): [`01_statistical_router_framing.md`](01_statistical_router_framing.md).
- Backtest evidence: `notebooks/05_forward_regime/statistical_router/statistical_router_backtest.ipynb`.
- UI pattern to mirror: `web/components/studio/location-detail.tsx`; bracket at `web/components/studio/tabs/price-breakdown.tsx` (`× Forward (climate + grid)` → `stat + climate + grid`).
