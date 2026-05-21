# Task Context

Date: 2026-05-21

Area: outage-modeling

Slug: platform-planning-handoff

## Objective

Preserve the current state of the outage pricing/modeling work so a new chat can
resume without rediscovering the architecture, local files, decisions, and open
questions.

## Background

This project started by promoting the reference `price_engine/v0` work from
`docs/extra/outage_modeling_us/` into the main project as `price_engine/`. The
current repository now has a runnable historical outage pricing baseline, a
static dashboard, exploratory lab scripts, planning docs, and broader learning
logs for hazard modeling and portfolio aggregation.

The user wants `docs/extra/outage_modeling_us/` and
`docs/extra/hazard_modeling/` to remain reference material only. Main work
should happen in canonical project folders such as `price_engine/`,
`curated_outage_data/`, `docs/plan/`, `docs/learning_logs/`, `lab/`, and
`notebooks/`.

## Problems We Were Solving

1. Promote the outage pricing v0 baseline without keeping a `v0/` subfolder.
2. Run the full 2014-2025 EAGLE-I historical pipeline locally.
3. Fix subtle pricing and ETL risks, especially annualization over a partial
   observation window and timestamp semantics.
4. Improve the dashboard so an internal insurance/modeling user can understand
   county tiers, evidence density, event catalogs, premium math, and drilldowns.
5. Create a lab workflow for comparing event catalogs and testing 30/45/60
   minute event-stitching thresholds.
6. Start a curated outage data project for cause attribution, grid condition
   features, utility/OMS/DOE-417/NOAA/PNNL research, and future adjustment work.
7. Capture broader modeling lessons around empirical survival curves,
   distributions, EVT, copulas, hazard catalogs, portfolio aggregation, and
   goal-first modeling.
8. Save the WISER/outage forecasting links and related sources for future
   baseline adjustment research.

## What We Fixed Or Added

1. `price_engine/` became the canonical working baseline.
   - The reference clone remains under `docs/extra/outage_modeling_us/`.
   - Versioning is documented in README/docs instead of a `v0` folder.

2. The historical pipeline was hardened and run locally.
   - Raw EAGLE-I yearly CSVs exist for 2014 through 2025.
   - Generated artifacts exist under `price_engine/data/`,
     `price_engine/filtration/`, and `price_engine/pricing/`.

3. Annualization was corrected and documented.
   - The model should divide event counts by actual observation years, not by a
     naive count of calendar years.
   - The current window is about 11.2 source-observed years, not a full 12-year
     complete sample.
   - This matters directly for `lambda(T)`, survival-derived rates, and premium
     calculations.

4. Timestamp semantics were documented.
   - EAGLE-I raw timestamps and constructed event timestamps were called out as
     important schema-level assumptions.
   - Time handling should remain explicit in pricing docs and data schema docs.

5. Multi-catalog support was added for event construction thresholds.
   - Current catalog family includes 30, 45, and 60 minute gap thresholds.
   - The dashboard can expose catalog choice so internal users can compare how
     event definition changes pricing and evidence.

6. Dashboard usability improved.
   - Brand/logo assets were added and adjusted.
   - The tier legend now has explanation content.
   - Each modelability gate and future roadmap dimension has info content.
   - Event catalog explanations and event-evidence KPIs were added.
   - Event density / event volume layer was planned/implemented so users can see
     where empirical confidence is stronger or weaker.
   - Navigation was improved so browser back behavior does not simply exit the
     experience.

7. Lab and notebook workflows were added.
   - `lab/` contains event log comparison, gap threshold sensitivity, and model
     invariant audit scripts/outputs.
   - `notebooks/` contains an initial outage regime analysis notebook plus
     executed HTML/IPYNB outputs.

8. Curated outage data planning started.
   - `curated_outage_data/` holds plans, schemas, source notes, pipelines, and
     learning outputs for event enrichment, cause attribution, grid condition
     features, and forward-looking model support.
   - The first planned phase is cause attribution and source strategy.

9. Broader modeling learning logs were created.
   - Goal-first hazard modeling.
   - Event vs continuous loss processes.
   - Loss taxonomy axes.
   - Empirical versus parametric/EVT/copula modeling.
   - Hazard catalog architecture by peril.
   - Portfolio event catalogs and aggregation.
   - Vendor cat models and climate conditioning.

10. New adjustment planning file was added.
    - `docs/plan/outage_baseline_adjustment_framework.md` consolidates how v0
      historical rates could later be adjusted using credibility, regime, grid
      condition, hazard/weather, location basis, trigger alignment, and
      commercial-viability layers.
    - The WISER webinar and similar sources are bookmarked there.

## Files Touched

### Created Or Substantially Added

- `.cursor/commands/PROMPT_CREATE_TASK_DOCS.md`
- `curated_outage_data/`
- `docs/dicsscssion/distributions_evt_copulas_outage_pricing.md`
- `docs/dicsscssion/location_aware_outage_pricing/`
- `docs/extra/hazard_modeling/`
- `docs/extra/tasks_history/2026-05-21__outage-modeling__platform-planning-handoff/`
- `docs/learning_logs/`
- `docs/plan/outage_baseline_adjustment_framework.md`
- `docs/plan/portfolio_risk_engine_plan.md`
- `lab/`
- `notebooks/`

### Modified

- `.gitignore`
- `docs/plan/README.md`
- `docs/plan/enriched_event_dataset_plan.md`
- `docs/plan/forward_looking_modeling_plan.md`
- `price_engine/ARCHITECTURE.md`
- `price_engine/END_TO_END.md`
- `price_engine/README.md`
- `price_engine/catalogs/build_catalogs.py`
- `price_engine/catalogs/eagle-i-30min/catalog.json`
- `price_engine/catalogs/eagle-i-45min/catalog.json`
- `price_engine/catalogs/eagle-i-60min/catalog.json`
- `price_engine/catalogs/manifest.json`
- `price_engine/dashboard/README.md`
- `price_engine/dashboard/app.js`
- `price_engine/dashboard/index.html`
- `price_engine/dashboard/styles.css`
- `price_engine/data/EVENT_CONSTRUCTION.md`
- `price_engine/data/INVENTORY.md`
- `price_engine/data/SCHEMA.md`
- `price_engine/plan/00_scope_and_principles.md`
- `price_engine/plan/02_pricing_math.md`
- `price_engine/pricing/05_price.py`
- `requirements.txt`

### Generated Local Data

- `price_engine/data/raw/eaglei_outages_2014.csv` through
  `price_engine/data/raw/eaglei_outages_2025.csv`
- `price_engine/data/raw/MCC.csv`
- `price_engine/data/raw/coverage_history.csv`
- `price_engine/data/raw/DQI.csv`
- `price_engine/data/events.parquet`
- `price_engine/data/events_meta.json`
- `price_engine/data/annualization_meta.json`
- `price_engine/data/county_summary.parquet`
- `price_engine/data/county_durations.parquet`
- `price_engine/filtration/county_tiers.csv`
- `price_engine/pricing/county_premiums.csv`
- `price_engine/pricing/county_drilldown.json`
- `lab/processed_event_log.parquet`
- `lab/event_log_comparison_summary.json`
- `lab/gap_threshold_sensitivity.json`
- `curated_outage_data/outputs/event_catalog_gap_analysis/`
- `notebooks/outputs/outage_regime_analysis_initial_report.html`
- `notebooks/outputs/outage_regime_analysis_initial_executed.ipynb`

## Current Status

- [x] Historical v0 pricing engine exists in `price_engine/`.
- [x] Full EAGLE-I raw yearly data appears present locally.
- [x] Main generated pricing outputs appear present locally.
- [x] Multiple event catalogs exist for 30, 45, and 60 minute thresholds.
- [x] Dashboard has richer explanation UI and event evidence concepts.
- [x] Lab scripts exist for event comparison and threshold sensitivity.
- [x] Curated outage data project scaffold exists.
- [x] Planning docs and learning logs are indexed.
- [x] Baseline adjustment framework doc exists and includes WISER/similar
      source links.
- [ ] Changes are not yet committed.
- [ ] Some generated data artifacts may be intentionally gitignored and local
      only.
- [ ] Need a final review before deciding what to commit versus keep local.

## Known Issues Or Caveats

- The working tree is dirty and has many untracked files. Do not reset or
  checkout files without explicit user approval.
- The folder `docs/dicsscssion/` is misspelled but currently used by the repo.
  Do not rename casually because many open tabs and links point to it.
- `docs/extra/outage_modeling_us/` and `docs/extra/hazard_modeling/` are
  reference clones. Do not develop inside them unless explicitly asked.
- Dashboard/server state may vary by terminal session. Last known dashboard URL
  discussed was `http://127.0.0.1:8001/dashboard/`.
- The v0 empirical method is intentionally historical and non-parametric. It is
  not fitting a distribution, KDE, EVT, or copula yet.
- EAGLE-I county outage events are not the same as exact premise-level outage
  events. Location basis risk remains a major open modeling issue.
- Cause attribution is not trivial. DOE-417/PNNL/NOAA/weather sources may align
  better with larger/catastrophic events than with all EAGLE-I county events.

## Next Steps

1. Decide which files should be committed and which generated artifacts should
   remain local only.
2. Review dashboard behavior locally at `http://127.0.0.1:8001/dashboard/` or
   restart a server from `price_engine/`.
3. Continue curated outage data phase 1:
   - cause source strategy,
   - PNNL/DOE-417/NOAA matching,
   - event-catalog gap and regime diagnostics.
4. Start the baseline adjustment work from
   `docs/plan/outage_baseline_adjustment_framework.md`.
5. Later, extract the WISER webinar transcript into the adjustment framework
   template and turn it into concrete feature/backtest ideas.
