# Archived Notebooks

Superseded / replaced notebooks, kept for **traceability** — the analysis was real, but a newer
notebook now owns the question. This mirrors the docs convention in
[`docs/plan/done/`](../../docs/plan/done/), with one difference: notebooks keep their **original
filename** (they're referenced by name and re-executed), so the supersede date + reason are recorded
here rather than in a date-prefix.

**Not a working directory.** Do not re-run or build on these — build on the notebook that replaced
them.

## Archived

- **`outage_regime_analysis_initial.ipynb`** — archived **2026-06-22** (notebook dated 2026-05-18).
  First-pass county regime exploration (annual concentration, seasonality, duration tail, severity).
  **Superseded by** [`../03_risk_clustering/regime_classification.ipynb`](../03_risk_clustering/regime_classification.ipynb),
  which makes the regime call rigorously (rolling-origin backtest · flat floor · adversarial
  validation). **Residual value:** its seasonality / severity views are *not* yet reproduced in the
  new notebook — mine them here if/when those features are needed.
