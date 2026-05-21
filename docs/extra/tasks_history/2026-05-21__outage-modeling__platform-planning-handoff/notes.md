# Notes

Date: 2026-05-21

## Repository State

Working directory:

```bash
/Users/divy/code/work/infrasure_git_codes/outage_pricing
```

Current dashboard URL last discussed:

```text
http://127.0.0.1:8001/dashboard/
```

The working tree is dirty. There are modified tracked files and many untracked
directories. Do not run destructive git commands.

Useful status commands:

```bash
git status --short
git diff --stat
git diff --check
```

## Important Local Folders

```text
price_engine/                         canonical historical pricing engine
curated_outage_data/                  curated/enriched data workstream
lab/                                  quick local experiments and diagnostics
notebooks/                            step-by-step exploratory analysis
docs/plan/                            project-level plans
docs/learning_logs/                   broader modeling and risk learning notes
docs/dicsscssion/                     discussion notes, intentionally current path
docs/extra/outage_modeling_us/        reference clone, do not develop inside
docs/extra/hazard_modeling/           reference clone, do not develop inside
docs/extra/tasks_history/             session handoffs
```

## Key Commands Used Or Referenced

Install/use local environment:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run price engine:

```bash
bash price_engine/run_all.sh
```

Run catalog builds:

```bash
bash price_engine/run_catalogs.sh
```

Serve dashboard:

```bash
cd price_engine
python -m http.server 8001
```

Run lab comparison:

```bash
python lab/compare_event_logs.py
```

Run gap threshold sensitivity:

```bash
python lab/gap_threshold_sensitivity.py
```

Run model invariant audit:

```bash
python lab/model_invariant_audit.py
```

Run curated data gap diagnostics:

```bash
python curated_outage_data/pipelines/event_catalog_diagnostics/gap_sensitivity.py
```

Open executed notebook output:

```text
notebooks/outputs/outage_regime_analysis_initial_report.html
```

## Data And Output Checks

Expected price engine raw inputs:

```text
price_engine/data/raw/eaglei_outages_2014.csv
price_engine/data/raw/eaglei_outages_2015.csv
price_engine/data/raw/eaglei_outages_2016.csv
price_engine/data/raw/eaglei_outages_2017.csv
price_engine/data/raw/eaglei_outages_2018.csv
price_engine/data/raw/eaglei_outages_2019.csv
price_engine/data/raw/eaglei_outages_2020.csv
price_engine/data/raw/eaglei_outages_2021.csv
price_engine/data/raw/eaglei_outages_2022.csv
price_engine/data/raw/eaglei_outages_2023.csv
price_engine/data/raw/eaglei_outages_2024.csv
price_engine/data/raw/eaglei_outages_2025.csv
price_engine/data/raw/MCC.csv
price_engine/data/raw/coverage_history.csv
price_engine/data/raw/DQI.csv
```

Expected generated outputs:

```text
price_engine/data/events.parquet
price_engine/data/events_meta.json
price_engine/data/annualization_meta.json
price_engine/data/county_summary.parquet
price_engine/data/county_durations.parquet
price_engine/filtration/county_tiers.csv
price_engine/pricing/county_premiums.csv
price_engine/pricing/county_drilldown.json
```

Catalog outputs:

```text
price_engine/catalogs/eagle-i-30min/catalog.json
price_engine/catalogs/eagle-i-45min/catalog.json
price_engine/catalogs/eagle-i-60min/catalog.json
price_engine/catalogs/manifest.json
```

## Important Modeling Math

Current v0 does not fit a distribution.

It uses empirical survival and annualized empirical event rates:

```text
S(T) = count(duration >= T) / count(all events)
lambda(T) = count(duration >= T) / source observation years
premium = lambda(T) * payout / (1 - expense_ratio - target_margin)
```

Annualization caveat:

```text
source observation years != naive calendar year count
```

The project corrected the logic to avoid treating a partial source window as a
complete 12-year observation window.

## Event Catalog Threshold Learnings

The team explored 30, 45, and 60 minute gap thresholds.

Important interpretation:

```text
85.16% of events: no inferred bridge at all
```

This means most constructed events were continuous under the selected
time-series logic and did not require stitching across a zero/absent gap.

Reported sensitivity from the analysis:

```text
average bridged time across all events: 4.24 minutes
among events with any bridged gap: median 30 minutes, p90 45 minutes
30 -> 45 minutes reduces events by about 7.1%
45 -> 60 minutes reduces events by another 5.8%
```

This supports keeping multiple catalogs visible for now, especially for internal
model review.

## Dashboard Notes

Dashboard concepts added or discussed:

- Tier colors are modelability, not outage severity.
- Green means quote/priced normally in v0.
- Amber means quoteable baseline with weaker credibility or quality.
- Red means no quote in v0 because at least one modelability gate failed.
- Grey means no engine record, hidden by filters, not evaluated, or roadmap
  dimension not included in v0.
- D1-D5 modelability gates now need their own info controls.
- Future dimensions such as regulatory readiness, trigger evidence,
  underwriting appetite, and compliance ops should have separate info controls.
- Event catalog selector needs explanation because insurance users may not know
  why a 30/45/60 minute threshold changes pricing.
- Event evidence KPIs should be explicit about whether values are total,
  annualized, or window-based.
- Event log / premium evidence table is useful after the matrix, but should be
  designed carefully to avoid overwhelming the workflow.

## Curated Data Notes

`curated_outage_data/` exists to avoid overloading `price_engine/`.

Planned phases:

1. Cause attribution.
2. Grid condition and utility features.
3. Forward-looking model support.
4. Feedback/learning from each phase.

Important source families:

- EAGLE-I
- DOE OE-417
- PNNL event-correlated outage dataset
- NOAA Storm Events
- NWS alerts
- EIA-861
- FERC/PUDL
- utility OMS/public outage maps where available
- weather reanalysis/forecast products

Important caution:

DOE-417 and PNNL may capture larger or more reportable events and may not align
one-to-one with every EAGLE-I county event. Use them as evidence and validation
layers, not as automatic ground truth.

## WISER And Adjustment Sources

New plan:

```text
docs/plan/outage_baseline_adjustment_framework.md
```

Saved source families:

- WISER North American Forecasting Model webinar.
- WISER project page.
- UConn/Eversource outage prediction and high-resolution weather pages.
- Dynamic thunderstorm outage modeling paper.
- Lead-time weather forecast uncertainty paper.
- ORNL EAGLE-I + NWS outage prediction paper.
- ORNL RePOWERD restoration paper.
- NOAA HRRR archive.
- CONUS404 and CONUS404 PGW.

Transcript extraction template was added to the adjustment framework. It should
be used when webinar transcript/slides are available.

## Broader Learning Logs

Key learning docs:

```text
docs/learning_logs/hazard_event_modeling_goal_first.md
docs/learning_logs/loss_modeling_event_vs_continuous.md
docs/learning_logs/loss_taxonomy_axes.md
docs/learning_logs/hazard_catalog_architecture_by_peril.md
docs/learning_logs/portfolio_event_catalogs_and_aggregation.md
docs/learning_logs/vendor_cat_models_and_climate_conditioning.md
docs/dicsscssion/distributions_evt_copulas_outage_pricing.md
```

Core lessons:

- Choose model complexity based on the decision it supports.
- Empirical methods are strong when the event catalog and magnitude are directly
  observed and the question stays within observed support.
- Parametric/EVT/simulation methods are often necessary when the catalog,
  spatial footprint, location magnitude, or tail event space must be inferred.
- KDE is non-parametric smoothing, but empirical exceedance counting is also
  non-parametric and is not the same thing as KDE.
- Cat models are not just pricing formulas; they are machinery for constructing
  plausible event catalogs, spatial footprints, vulnerability, and portfolio
  dependence from incomplete evidence.
- For continuous losses, the framework should track stressor history,
  degradation state, response function, maintenance/mitigation, financial
  translation, and portfolio accumulation.

## External Learning File Updated

External file:

```text
/Users/divy/Desktop/Learning/Modeling/learnings_from_building_quantitative_models.md
```

Added learning:

```text
Learning 11: Know Where Assumptions Are Allowed
```

Main idea:

At Gen 1/Gen 2, assumptions are acceptable only if they are still useful for the
decision level, such as screening or ranking. A rough asset-specific damage
curve may be better than a polished curve borrowed from the wrong asset class.

## Verification Commands Run For Latest Plan Update

Latest verification after adding the outage baseline adjustment framework:

```bash
perl -ne 'print "$.:$_" if /[^[:ascii:]]/' \
  docs/plan/outage_baseline_adjustment_framework.md \
  docs/plan/README.md \
  docs/plan/forward_looking_modeling_plan.md

git diff --check -- \
  docs/plan/outage_baseline_adjustment_framework.md \
  docs/plan/README.md \
  docs/plan/forward_looking_modeling_plan.md

rg -n "Outage Baseline|WISER|North American|outage_baseline" docs/plan
```

Result:

```text
ASCII check: no output
git diff --check: no output
rg: confirmed links and plan references
```

## Fresh-Chat Read Order

For a new chat, read in this order:

1. `docs/extra/tasks_history/2026-05-21__outage-modeling__platform-planning-handoff/handoff.md`
2. `docs/plan/README.md`
3. `price_engine/README.md`
4. `price_engine/data/SCHEMA.md`
5. `price_engine/data/EVENT_CONSTRUCTION.md`
6. `price_engine/plan/02_pricing_math.md`
7. `docs/plan/outage_baseline_adjustment_framework.md`
8. `curated_outage_data/plan/README.md`
9. `docs/learning_logs/README.md`
10. The specific doc for the next task.
