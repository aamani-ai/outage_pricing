# Notebooks

Local exploratory notebooks for outage pricing and curated outage data analysis.

These notebooks are intentionally analysis-first. They can read generated local
artifacts under `price_engine/` and `curated_outage_data/`, but they should not
be treated as the production pipeline.

## Current Notebooks

| Notebook | Purpose |
|---|---|
| `outage_regime_analysis_initial.ipynb` | First-pass county regime analysis: annual concentration, seasonality, duration tail, severity, and pricing implications. |

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
