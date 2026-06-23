# Handoff — 2026-06-22 (Step 3: Regime Classification)

For the next session / model switch / teammate. Read this quickly, then start from **Next action**.

## 10-Bullet Summary

1. **Step 3 (risk clustering) was rebuilt from scratch** as a stats-based **regime classifier** on the
   source-coverage-masked ≥8h annual series — replacing the churning 7-shape pattern layer.
2. **Outcomes: `stable / trend / shift / episodic` + `insufficient`** (a 5th, honest *abstention*).
3. **The reframe that mattered: ABSTAIN, don't force.** ~11% of counties are `insufficient`
   (recent-change / low-volume / short-history) instead of force-fit a wrong label (A015).
4. **Two pivots happened mid-session:** (1) the backtest-defines-regime approach was moved to **Step 5**
   (model selection is forecasting); (2) after "none look true", we added `insufficient` + renamed flat→stable.
5. **Adversarially verified twice** (workflows): the backtest (permutation test → no leakage) and the
   classifier (3 lenses → 1 critical + 4 major bugs found and **fixed**).
6. **Per-county metadata** now includes a **cross-T descriptor** — `intensifies@longT` = storm-driven
   long outages (e.g. coastal Baldwin AL: stable at short T, structured at long T).
7. **Artifact:** `notebooks/outputs/regime_classification/county_regime_T8.csv` (3,090 counties;
   regime · sub · conf · stab4/stabS · labels_by_T · xT · features). `outputs/` is gitignored.
8. **Assumptions A013–A016** registered (behavior-not-cause · T-decision · abstain · all-duration mask).
9. **Complete shareable reference built** — entry point `docs/methodology/03_risk_clustering/README.md`;
   all indexes (framework, reading_order, roadmap, mask consumer) repointed to current docs.
10. **No pricing logic changed** — Step 3 is shadow/identity, not in the quoted price. The backtest
    is re-filed as Step-5 *evidence* (`notebooks/05_forward_regime/regime_routing_backtest.ipynb`).

## Files To Read First

```text
docs/methodology/03_risk_clustering/README.md                         # START HERE — the overview
docs/methodology/03_risk_clustering/regime_classification_methodology.md  # canonical HOW + metadata map
docs/dicsscssion/eventization_frequency_contract/05_source_coverage_mask.md  # the pre-clean
notebooks/03_risk_clustering/regime_classification.ipynb              # the classifier (+ show_county card)
docs/methodology/assumptions.md                                       # A013–A016
docs/OUTAGE_MODELING_FRAMEWORK.md                                     # Step-3 section + where-we-are
```

## Repro / verify current state

```bash
cd /Users/divy/code/work/infrasure_git_codes/outage_pricing
./.venv/bin/python3 scratchpad/build_regime_classify_notebook.py     # rebuild the .ipynb
./.venv/bin/python3 -m nbconvert --to notebook --execute --inplace \
  --ExecutePreprocessor.kernel_name=outage_pricing_venv \
  notebooks/03_risk_clustering/regime_classification.ipynb            # expect 7 code cells, 0 errors
# distribution should be: stable 42 · trend 23 · shift 22 · insufficient 11 · episodic 1.5 (%)
```

## Next action (PRIMARY FOCUS)

**Two parallel tracks. Both are "next"; neither was started this session.**

### Track A — share Step 3 with the team
- The single link to hand over: `docs/methodology/03_risk_clustering/README.md`. It is
  self-contained and written for a senior/actuary reader; everything links from it.
- Optional: a 5-minute walk-through of the `show_county()` card + the regime map (do it once the
  dashboard lands so there's something visual).

### Track B — new dashboard (scoping pass first, do NOT patch the old one)
The framework lists this as a **full frontend revamp**. Start with a short **dashboard plan** before building:
1. **Views:** regime **color-by map** · per-county **metadata card** (mirror `show_county()`) ·
   the **chronic-vs-storm** layer (`intensifies@longT`) · how Step 3 sits beside Steps 2/4 on screen.
2. **Data it reads:** `outputs/regime_classification/county_regime_T8.csv` + the existing price_engine
   catalogs. (Dashboard convention: `python -m http.server 8001` over `price_engine/`; bump `?v=` on
   styles.css/app.js on every edit — see memory.)
3. **Structure:** fresh, not a patch of the current "messy" frontend.

### Track C — known follow-ups (not blocking)
- **A016** — derive/validate a **T-specific coverage signal** before this ships to the actuarial
  consultant (the mask is all-duration applied to ≥8h, discards ~3,073 real ≥8h events).
- Optional **team review of the names** (`stable/trend/shift/episodic/insufficient`) before they
  hit the dashboard.

## Gotchas / context not obvious from code

- **`df['T']` not `df.T`** — `df.T` is the transpose; the T-column must be bracket-accessed (bit us twice).
- **Kernel:** use `outage_pricing_venv` (registered). The bare `python3` kernel resolves to a
  different venv that lacks `pyarrow` → parquet reads fail.
- **`scratchpad/` is gitignored** — the dev/builder scripts live there locally; the `.ipynb` is the
  committed artifact, regenerable via `build_regime_classify_notebook.py`.
- **Step 3 vs Step 5:** Step 3 = the behavioral *identity* (stats, this work). Step 5 = *forecasting*
  on top of it (the backtest evidence in `05_forward_regime/` shows it's worth building).
- The mask doc lives under `dicsscssion/eventization_frequency_contract/` (where the question first
  arose), not under `03_risk_clustering/` — it's linked from the README, just not co-located.
