# Notes — Regime Classification (2026-06-22)

## The arc of the session (two pivots)

```text
 1. clarified Step-3 architecture   subgroups EMERGE (not pre-drawn) · retracted Gen-1/Gen-2 framing ·
                                    behavior-not-cause (A013) · regime = router, not forecast
 2. cleaned up the 7-shape          archived the quantification plan to done/ (closure note) ·
                                    bannered superseded methodology + discussion docs
 3. wrote design plan + A013–A016   regime_routing_backtest_plan.md
 4. built + verified the BACKTEST   routing beats flat +18% OOS · permutation test → no leakage
 ── PIVOT 1 (user) ───────────────  "backtest = Step 5; clustering should be plain STATS"
 5. built the stats classifier      flat/trend/shift/episodic · calibrated by face-validity
 6. verified (3 lenses) → BUGS      perfect-fit inversion · episodic-swallows-ramp · etc → FIXED
 ── PIVOT 2 (user) ───────────────  "none look true" (Cherry NE). → ABSTAIN, don't force
 7. added INSUFFICIENT + renamed    flat→stable · insufficient outcome · Cherry/Weakley/Person fixed
 8. added per-T metadata            cross-T descriptor (intensifies@longT) + show_county() card
 9. docs + cleanup                  README · methodology · sync all refs · backtest→05 · gitignore scratchpad
```

## Build/run commands

```bash
# kernel (registered once — avoids the global python3 kernel that lacks pyarrow)
./.venv/bin/python3 -m ipykernel install --user --name outage_pricing_venv --display-name "Python (outage_pricing)"

# iterate the logic fast in a dev script, THEN build the notebook from it
./.venv/bin/python3 scratchpad/regime_classify_dev.py            # calibrate + face-validity
./.venv/bin/python3 scratchpad/build_regime_classify_notebook.py # nbformat → the .ipynb

# execute the notebook headless + bound to the venv kernel
./.venv/bin/python3 -m nbconvert --to notebook --execute --inplace \
  --ExecutePreprocessor.timeout=600 --ExecutePreprocessor.kernel_name=outage_pricing_venv \
  notebooks/03_risk_clustering/regime_classification.ipynb
```

(`scratchpad/` is gitignored — the dev + builder scripts stay local; the `.ipynb` is the artifact.)

## Data inputs (confirmed by a scout)

```text
 annual counts   curated_outage_data/outputs/county_trend/county_yearly_trend__eagle-i-45min.parquet
                 filter df[df['T']==8]  (NEVER df.T — that's the transpose; bit us twice)
 the mask        notebooks/outputs/source_coverage_mask/county_year_coverage_mask.csv  (fips,year,observed,county,state)
                 mask 'n' is ALL-DURATION; applied across T → A016 caveat
```

## Verification — two adversarial workflows, both earned their cost

**A. Backtest verification** (4 lenses) → *trustworthy, no leakage.* Permutation test: shuffling each
county's counts collapsed the +18% routing gain to **≈ −10%** (negative, not just zero) — the
textbook signature of a clean, leak-free pipeline. Surfaced that the gain is **tail protection**
(median county ~0%), not broad — which reframed the honest headline.

**B. Classifier verification** (3 lenses: logic / face-validity / sensitivity) → found **1 critical +
4 major** bugs on real data:

```text
 CRITICAL  perfect-fit divisor INVERTED labels: a flawless ramp scored t=0 → mislabeled flat;
           a flawless step scored jump_z=0 → mislabeled trend.   FIX: ∞ sentinel, not 0.
 MAJOR     episodic swallowed late ramps (de-peak dropped only 1 yr): Cherry NE → episodic.
           FIX: require the spike to REVERT (last < 0.6·peak) + drop all max-tied years.
 MAJOR     near-zero counties → episodic (peak_share = ratio of ~nothing). FIX: hard volume gate (total≥15).
 MAJOR     a single TERMINAL spike → shift, high-conf (Person NC). FIX: shift needs ≥3 post-years.
 ✓ SOUND   thresholds NOT knife-edge: ±20% perturbation churns ≤8% of labels, all boundary-adjacent.
```

All fixed; re-verified: perfect ramp→trend, step→shift, const→stable; every flagged county flips
correctly; all original spot-checks (Bexar/Putnam/Oklahoma/Whatcom) still hold.

## Metrics (final, T=8h)

```text
 outcome distribution     stable 42 · trend 23 · shift 22 · insufficient 11 · episodic 1.5  (% of 3,090)
 insufficient reasons     low-volume 129 · recent-change 125 · short-history 90
 cross-T descriptor       T-stable 1460 · T-mixed 825 · weakens@longT 589 · intensifies@longT 216
 confidence (typed)       high 1559 · low 1187
 cross-T 4-class agree     ≈ 0.60 mean  (well above ~0.29 chance → moderate, not rigid)
```

## Key insights / lessons

1. **Abstain > force.** The reframe that turned "none of them look true" into defensible: only commit
   to a label when the data earns it; otherwise say `insufficient` with the reason.
2. **Adversarial verification pays off — twice.** It caught the +18%-isn't-broad-it's-tail nuance AND
   a critical label-inverting bug. Cheap insurance before a number goes to an actuary.
3. **The cross-T descriptor is the chronic-vs-storm read.** `intensifies@longT` (Baldwin AL) surfaces
   storm-driven long-outage risk that a single 8h label hides.
4. **Architecture clarity:** Step 3 = behavioral *identity* (stats); Step 5 = *forecasting* (the
   backtest + real models). Keeping that line clean removed the conflation that caused the first
   rebuild's problems.
5. **Dev-script-first, notebook-second.** Iterate logic in a plain `.py` (fast), then `nbformat` →
   execute. Avoids slow notebook debug cycles.
