# Handoff

Date: 2026-05-21

## 10-Bullet Summary

1. Main repo is `/Users/divy/code/work/infrasure_git_codes/outage_pricing`.
2. Canonical pricing implementation is `price_engine/`; reference clones under
   `docs/extra/` should stay reference-only.
3. v0 pricing is historical, empirical, and non-parametric: no KDE, no fitted
   distribution, no EVT, no copula yet.
4. Annualization was corrected to use actual source observation years rather
   than naive calendar-year counts.
5. Dashboard now has richer tier explanations, gate info, event catalog context,
   event evidence concepts, logo/branding work, and improved navigation.
6. Event catalog variants exist for 30, 45, and 60 minute gap thresholds.
7. `lab/` and `notebooks/` contain event comparison, threshold sensitivity,
   invariant audit, and initial regime analysis outputs.
8. `curated_outage_data/` is the separate workstream for cause attribution,
   grid/utility features, source strategy, and forward-looking support.
9. `docs/learning_logs/` holds broader modeling frameworks for hazard catalogs,
   portfolio aggregation, loss process/category axes, and vendor cat models.
10. `docs/plan/outage_baseline_adjustment_framework.md` is the new home for
    WISER/outage forecast sources and future baseline adjustment logic.

## Files To Read First

```text
docs/plan/README.md
price_engine/README.md
price_engine/data/SCHEMA.md
price_engine/data/EVENT_CONSTRUCTION.md
price_engine/plan/02_pricing_math.md
docs/plan/outage_baseline_adjustment_framework.md
curated_outage_data/plan/README.md
docs/learning_logs/README.md
```

## Important Files And Directories

```text
price_engine/dashboard/app.js
price_engine/dashboard/index.html
price_engine/dashboard/styles.css
price_engine/pricing/05_price.py
price_engine/catalogs/build_catalogs.py
price_engine/catalogs/manifest.json
lab/gap_threshold_sensitivity.py
lab/compare_event_logs.py
lab/model_invariant_audit.py
notebooks/outage_regime_analysis_initial.ipynb
curated_outage_data/plan/
curated_outage_data/schemas/
curated_outage_data/sources/
curated_outage_data/pipelines/
docs/plan/outage_baseline_adjustment_framework.md
docs/learning_logs/portfolio_event_catalogs_and_aggregation.md
docs/learning_logs/hazard_catalog_architecture_by_peril.md
```

## Current Local Dashboard

Last known URL:

```text
http://127.0.0.1:8001/dashboard/
```

Restart if needed:

```bash
cd /Users/divy/code/work/infrasure_git_codes/outage_pricing/price_engine
python -m http.server 8001
```

## Repro And Verification Commands

From repo root:

```bash
source .venv/bin/activate
bash price_engine/run_all.sh
bash price_engine/run_catalogs.sh
python lab/gap_threshold_sensitivity.py
python lab/model_invariant_audit.py
git diff --check
```

Check data outputs:

```bash
ls price_engine/data/raw
ls price_engine/data
ls price_engine/filtration
ls price_engine/pricing
ls price_engine/catalogs
```

Check dashboard source changes:

```bash
git diff -- price_engine/dashboard/app.js
git diff -- price_engine/dashboard/index.html
git diff -- price_engine/dashboard/styles.css
```

## Known Gotchas

- Do not run `git reset --hard` or `git checkout --` unless the user explicitly
  asks.
- The working tree contains many uncommitted and untracked changes.
- Generated parquet/csv/json data may be local and intentionally gitignored.
- The folder name `docs/dicsscssion/` is misspelled but currently real.
- The repo path in some tooling may show a trailing space; use the canonical
  path without a trailing space.
- EAGLE-I county events are not premise-level outage truth.
- DOE-417/PNNL/NOAA sources may not align exactly with EAGLE-I event
  definitions.
- Tier colors are modelability, not severity.
- Event evidence KPIs need clear total-versus-annualized labels.

## Primary Next Action

If the next task is dashboard work:

1. Start the local server from `price_engine/`.
2. Open `http://127.0.0.1:8001/dashboard/`.
3. Inspect `price_engine/dashboard/app.js`, `index.html`, and `styles.css`.
4. Preserve the current tier/event catalog/evidence concepts.
5. Verify no missing JSON/CSV errors and no broken layout.

If the next task is modeling/adjustment work:

1. Read `docs/plan/outage_baseline_adjustment_framework.md`.
2. Keep v0 unchanged.
3. Add challenger features in `curated_outage_data/`, not directly in pricing.
4. Backtest each modifier before pricing.
5. Start with one modifier at a time:

```text
credibility -> regime -> grid condition -> hazard/weather -> location basis
```

If the next task is source/cause attribution work:

1. Read `curated_outage_data/plan/01_phase_cause_attribution.md`.
2. Read `curated_outage_data/plan/04_phase1_source_strategy.md`.
3. Review source notes under `curated_outage_data/sources/`.
4. Use the workflow template:

```text
research -> reason -> decide -> plan -> execute -> feedback/learning
```

5. Treat source matches as evidence with confidence, not binary truth.

## What To Commit Later

Before committing, decide whether generated outputs should stay local.

Likely commit candidates:

- code changes under `price_engine/`
- docs under `docs/plan/`, `docs/learning_logs/`, and `docs/dicsscssion/`
- curated data scaffold, plans, schemas, source notes, and pipeline scripts
- lab scripts and summary markdown/json if useful
- this task history folder

Likely not commit candidates unless explicitly desired:

- large raw EAGLE-I CSVs
- generated parquet files
- generated pricing outputs
- executed notebook outputs if too large/noisy

## Final Orientation

The current project should be understood as three layers:

```text
price_engine/
  reproducible historical v0 pricing baseline

curated_outage_data/
  enrichment, cause, grid condition, forward-looking features

docs/learning_logs/ + docs/plan/
  modeling philosophy, product architecture, and future execution roadmap
```

Keep those layers separate unless the user explicitly asks to merge them.
