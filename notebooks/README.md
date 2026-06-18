# Notebooks

Local exploratory notebooks for outage pricing and curated outage data analysis.

These notebooks are intentionally analysis-first. They can read generated local
artifacts under `price_engine/` and `curated_outage_data/`, but they should not
be treated as the production pipeline.

## Current Notebooks

| Notebook | Purpose |
|---|---|
| `outage_regime_analysis_initial.ipynb` | First-pass county regime analysis: annual concentration, seasonality, duration tail, severity, and pricing implications. |

## Notebooks elsewhere in this repo

Not every notebook lives here. The data-onboarding / feature workstreams keep
their notebooks next to their own data and findings:

| Location | Notebooks |
|---|---|
| `docs/extra/location_features/analysis/notebooks/` | **Location-basis features.** `02_nlcd_canopy.ipynb` (+ executed `.html` to share): does tree canopy add lift beyond density for the within-county location-basis layer? Findings: `docs/extra/location_features/docs/01_findings.md`. |
| `docs/extra/poweroutage_us/analysis/notebooks/` | PowerOutage.US trial onboarding (snapshot explore, cause distribution, EAGLE-I overlap, modifier signal check). Findings: `docs/extra/poweroutage_us/docs/06_findings.md`. |

The `02_nlcd_canopy.html` next to that notebook opens in any browser — no Jupyter
kernel needed — so it's the copy to hand to the team.

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
