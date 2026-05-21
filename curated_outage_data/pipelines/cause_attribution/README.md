# Cause Attribution Pipeline

Phase 1 starts here.

The first implementation is intentionally narrow:

```text
catalog: eagle-i-45min
state: Florida
years: 2017, 2020
first-priority source: PNNL/OE-417 event-correlated records
fallback weather source: NOAA Storm Events
```

## Run

From the repo root:

```bash
.venv/bin/python curated_outage_data/pipelines/cause_attribution/phase1_pilot.py
```

Generated local artifacts are written under:

```text
curated_outage_data/data/interim/cause_attribution/fl_2017_2020/
curated_outage_data/outputs/phase_1_cause_attribution/fl_2017_2020/
```

Both locations are gitignored.

## What This Pilot Does

1. Reads canonical pricing events from
   `price_engine/catalogs/eagle-i-45min/data/events.parquet`.
2. Downloads NOAA Storm Events detail files for the pilot years.
3. Keeps county-level NOAA records for the pilot state.
4. Converts NOAA local-standard timestamps to timezone-naive UTC.
5. Matches outage events to NOAA records by county FIPS and a configurable
   lead/lag buffer around outage onset.
6. Downloads the public PNNL Event-Correlated Outage Dataset and matches
   PNNL/OE-417 event-correlated rows near outage onset.
7. Builds a PNNL-first enriched preview:
   - PNNL/OE-417 major disturbance first;
   - NOAA weather evidence second;
   - `unknown` when neither source gives defensible evidence.
8. Compares:
   - PNNL merged events versus our constructed catalog;
   - PNNL 8-hour and 24-hour OE-417 lag matches.
9. Writes timeline review samples with raw EAGLE-I snapshots, our constructed
   events, PNNL/OE-417 windows, and NOAA windows.
10. Writes QA reports before any enriched table is treated as canonical.

## Important Interpretation Rule

A NOAA or PNNL match is evidence, not proof of cause.

PNNL/OE-417 is treated as a major-disturbance label layer, not an exact
county-level on/off truth table.

NOAA matching is anchored around outage start, not the full outage duration.
This prevents a storm that happened days or weeks into a long outage interval
from being treated as the initiating cause.

An unmatched event is not evidence of no cause. It means the current public
source/join rule did not produce a defensible match.
