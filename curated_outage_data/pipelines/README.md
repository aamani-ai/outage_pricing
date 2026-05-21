# Pipelines

Pipeline code will live here after source and schema decisions are made.
Phase 1 has now started under `cause_attribution/`.

Event-catalog diagnostics live under `event_catalog_diagnostics/`.

Do not start with a national pipeline. Start with a narrow pilot:

```text
catalog: eagle-i-45min
state: Florida
years: 2017 and 2020
source order: NOAA Storm Events first, DOE/OE-417 second
```

Expected future scripts:

```text
01_load_catalog_events.py
02_fetch_noaa_storm_events.py
03_match_noaa_to_events.py
04_fetch_oe417.py
05_match_oe417_to_events.py
06_build_event_enriched.py
07_build_county_year_features.py
```

Pipeline rules:

- raw downloads go under `data/raw/`;
- intermediate artifacts go under `data/interim/`;
- canonical local outputs go under `data/processed/` or `outputs/`;
- generated artifacts stay gitignored unless explicitly promoted.
