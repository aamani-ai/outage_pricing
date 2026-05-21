# Event Catalog Diagnostics

Diagnostics here inspect the already-built price-engine event catalogs.

They do not rebuild events from raw EAGLE-I snapshots. Instead, they compare the
canonical sensitivity catalogs:

```text
price_engine/catalogs/eagle-i-30min/
price_engine/catalogs/eagle-i-45min/
price_engine/catalogs/eagle-i-60min/
```

This is the right first check for the continuity-threshold question because it
shows how the event count, duration tail, and inferred bridged gaps move when
the only changed assumption is the gap tolerance.

## Run

From the repo root:

```bash
.venv/bin/python curated_outage_data/pipelines/event_catalog_diagnostics/gap_sensitivity.py
```

Generated outputs are written to:

```text
curated_outage_data/outputs/event_catalog_gap_analysis/
```

Outputs are local and gitignored.
