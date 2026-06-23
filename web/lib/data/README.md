# Bundled pricing data — generated, do not hand-edit

These JSON files are **built from the pricing catalogs**, not authored by hand. Rebuild after the
catalogs or regime classification change:

```bash
# from the repo root
./.venv/bin/python3 web/scripts/build_data.py
```

| File | What | Source |
|------|------|--------|
| `pricing.json` | per county × trigger: λ_customer + year-based band (A017) + event count | `price_engine/catalogs/eagle-i-45min/pricing/{per_customer_view,county_drilldown}.json` + `curated_outage_data/.../county_yearly_trend__eagle-i-45min.parquet` |
| `studio.json` | per county: regime + observed annual history | `notebooks/outputs/regime_classification/county_regime_T8.csv` + the yearly-trend parquet |
| `counties-by-state.json` | state → priced counties (search filter) | derived from `pricing.json` |

The band uses a fixed RNG seed, so re-running reproduces identical numbers. Server-only imports
(`lib/data/pricing.ts`, `lib/data/studio.ts`) read these; the client never bundles the large files.
