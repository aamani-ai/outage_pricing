# Coverage Ramp Is Real — but a Global Baseline Cutoff Is the Wrong Fix

- **Status:** discussion / **finding stands; global-cleanup conclusion REJECTED** (2026-06-24)
- **Origin:** Step-05 router backtest coverage gate. **Resolution:** the fix is a per-county
  **statistical adjuster**, not a baseline change — see
  [`../forward_regime_statistical_router/04_statistical_adjuster_design.md`](../forward_regime_statistical_router/04_statistical_adjuster_design.md).

## TL;DR

```
  FINDING (stands):   the full-period mean is biased ~17% LOW, mostly because EAGLE-I under-counted
                      2015-2017 (sources still onboarding). Real coverage ramp.
  FIRST CONCLUSION:   "compute λ on a coverage-stable window (drop 2015-2017)" — a GLOBAL baseline cutoff.
  REJECTED, because:  it bakes an UNVERIFIABLE per-county assumption ("this county's early years are
                      coverage-suppressed") into the AUDIT ANCHOR. True on average, FALSE for the
                      counties whose early years are genuinely high, unverifiable for any single county.
  RIGHT FIX:          the per-county STATISTICAL FORECAST inside the FORWARD bucket (the forward
                      baseline; asymmetric loss, one-directional uplift+abstain). Baseline stays the anchor.
```

## The evidence the ramp is real (read-only; `scratchpad/coverage_check.py`)

```
  · onboarding: % of county-cells observed/year — 2015 81% → 2017 91% → 2019 96% → 2020+ ~98%.
  · typical level (count/own-mean, cells observed EVERY year): 2015 0.55 → 2018 0.94 → 2025 1.25
    (steep early jump = reporting density rising WITHIN observed cells).
  · held-out 2024-25 flat-mean bias: −17% (train 2015) → −6% (train 2020). Most of the low bias is the
    under-counted early years.
```

## Why a GLOBAL cutoff is the wrong fix (the corner cases prove it)

A blanket "drop 2015-2017" assumes early-low everywhere. But ~1% of counties (more by looser cuts) are
the **opposite** — genuinely high early, lower recent — where the cutoff would discard real data:

```
  fips    2015-17 mean → 2023-25 mean    a global cutoff would push these DOWN, on a false assumption
  12071   250  → 120     (Lee FL)
  22033   246  → 107     (East Baton Rouge LA)
  47157   225  → 131     (Knox TN)
  12009   214  → 141     (Brevard FL)
```

This is the **county-specificity principle** ([`../../principles/county_specificity.md`](../../principles/county_specificity.md)):
data availability *and* outage nature are county-specific, so one window can't be right for all. A baseline
change must be defensible for **every** county; a global rule can't be — regardless of how few it harms.

## The decision

```
  · BASELINE stays the raw full-period mean — the transparent AUDIT ANCHOR. Untouched. No global window surgery.
  · The "is the long-run mean the right central estimate for THIS county?" question moves to the per-county
    STATISTICAL FORECAST inside the FORWARD bucket (the "stat" in stat+climate+grid): asymmetric loss,
    ONE-DIRECTIONAL (uplift coverage-suppressed/rising counties; ABSTAIN otherwise — never discount in v1,
    so declining counties keep the higher full-mean = cushion), credibility-shrunk, capped, shadow.
  · The coverage ramp is then handled per-county (a suppressed county's recent level reads higher) rather
    than asserted globally — and it is CONTAINED in a capped/shadow factor, not baked into the anchor.
  · FORWARD bracket (climate + grid) stays a placeholder.
```

## What changed from this note's first version

The first version proposed the global cutoff + a `lambda_clean` artifact (notebook
`notebooks/01_eventization/baseline_coverage_window.ipynb`). That notebook is **kept as evidence** (its map
shows counties moving BOTH up and down — which is exactly why a global rule fails) but its **conclusion is
superseded**: no baseline cleanup; the home is the statistical adjuster. Proposed assumption **A018** is
withdrawn in favor of the adjuster design.

## Cross-references

- The structure that replaces this: [`../forward_regime_statistical_router/04_statistical_adjuster_design.md`](../forward_regime_statistical_router/04_statistical_adjuster_design.md).
- Principle: [`../../principles/county_specificity.md`](../../principles/county_specificity.md).
- Coverage mask basis: [`05_source_coverage_mask.md`](05_source_coverage_mask.md); window limitation [A012](../../methodology/assumptions.md).
- Evidence notebook (kept, conclusion superseded): `notebooks/01_eventization/baseline_coverage_window.ipynb`.
