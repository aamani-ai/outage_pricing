# Notebooks

Local exploratory notebooks for outage pricing and curated outage data analysis.

These notebooks are intentionally analysis-first. They can read generated local
artifacts under `price_engine/` and `curated_outage_data/`, but they should not
be treated as the production pipeline.

## Current Notebooks

Organized into **step subfolders** mirroring `docs/methodology/` and `docs/plan/`, so each
notebook sits with the pipeline step it serves.

**`01_eventization/`**
| Notebook | Purpose |
|---|---|
| `event_duration_bucket_analysis.ipynb` | Eventization diagnostic: event counts by duration bucket, cumulative threshold counts, county bucket matrix. |
| `duration_conservatism_analysis.ipynb` | Are the duration assumptions conservative? Structural argument + bounded gap-merge sensitivity (closes Chris's action item). |

**`02_per_customer/`**
| Notebook | Purpose |
|---|---|
| `per_customer_rate_phase1.ipynb` | Phase-1 math validation of the per-customer multiplier (mean vs max, cross-catalog stability). |
| `inner_event_shape_diagnostics.ipynb` | The Step 1-2 cell read: TRUST (coverage/sample/eventization) + POSTURE (cushion level + tilt). |

**`03_risk_clustering/`**
| Notebook | Purpose |
|---|---|
| `regime_classification.ipynb` | **The Step-3 regime classifier** (current). Significance-gated stats rule tree on each county's masked ≥8h history → **stable / trend / shift / episodic**, plus an explicit **`insufficient`** abstention (recent-change / low-volume / short-history) when the data can't support a label (~11%). One primary label at T=8h + cross-T stability + confidence. Behavior, not cause (A013); a router, not a forecast. Adversarially verified (3 lenses; perfect-fit / volume / reversion / terminal-spike bugs fixed). Artifact → `outputs/regime_classification/county_regime_T8.csv`. Kernel: `outage_pricing_venv`. |
| `source_coverage_mask_analysis.ipynb` | Step-3 prerequisite: the coverage-ramp mask (observed-zero vs missing) + live county-picker + state-year heatmap. Needs `plotly` + `ipywidgets`. |

**`05_forward_regime/`**
| Notebook | Purpose |
|---|---|
| `regime_routing_backtest.ipynb` | **Step-5 evidence.** The forecasting backtest that motivated routing — prequential routing beats always-flat +18% OOS (tail protection; median county ~0%), leakage-tested. The proof that forecasting *on top of* the Step-3 regimes is worth building. |

## Notebooks elsewhere in this repo

Not every notebook lives here. The data-onboarding / feature workstreams keep
their notebooks next to their own data and findings:

| Location | Notebooks |
|---|---|
| `docs/extra/location_features/analysis/notebooks/` | **Location-basis features.** `02_nlcd_canopy.ipynb` (+ executed `.html` to share): does tree canopy add lift beyond density for the within-county location-basis layer? Findings: `docs/extra/location_features/docs/01_findings.md`. |
| `docs/extra/poweroutage_us/analysis/notebooks/` | PowerOutage.US trial onboarding (snapshot explore, cause distribution, EAGLE-I overlap, modifier signal check). Findings: `docs/extra/poweroutage_us/docs/06_findings.md`. |

The `02_nlcd_canopy.html` next to that notebook opens in any browser — no Jupyter
kernel needed — so it's the copy to hand to the team.

## Archived

Superseded notebooks move to [`_archive/`](_archive/) (kept for traceability, not for re-running).
See [`_archive/README.md`](_archive/README.md) for the convention and what replaced each one.

- `outage_regime_analysis_initial.ipynb` — first-pass regime exploration; superseded by
  `03_risk_clustering/regime_classification.ipynb` (2026-06-22).

## Run

From the repo root, use the project virtual environment as the notebook kernel.

```bash
.venv/bin/python -m pip install -r requirements.txt
```

Then open the notebook in VS Code or Jupyter and select the `.venv` Python
kernel.

## Executed Outputs

Generated notebook reports are written under:

```text
notebooks/outputs/
```

That folder is local and gitignored.
