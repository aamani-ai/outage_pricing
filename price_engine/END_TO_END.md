# Price Engine v0 — End-to-End Flow

This is the one-page map of how raw outage snapshots become an interactive premium dashboard. Read this before touching any individual stage.

## TL;DR

```
Figshare CSVs ──▶ events.parquet ──▶ county_summary + county_durations
                                            │
                                            ▼
                                      county_tiers.csv  (D1..D5 modelability gates)
                                            │
                                            ▼
                              county_premiums.csv + county_drilldown.json
                                            │
                                            ▼
                                       dashboard/  (map · matrix · drill-down)
```

Five Python scripts. One bash wrapper (`run_all.sh`). One static dashboard. No backend, no DB, no build step.

---

## What this local run actually ran

This repo now runs the promoted `price_engine/` locally against the full public EAGLE-I 2014-2025 release. The raw yearly CSVs total roughly 11 GB, and every downstream stage ran against all 12 years.

| Stage | Input | Output | Notes |
|---|---|---|---|
| 01 ingest | Figshare API | `data/raw/eaglei_outages_2014.csv` ... `eaglei_outages_2025.csv` + `MCC.csv`, `coverage_history.csv`, `DQI.csv` | All 12 years downloaded and MD5-verified |
| 02 events | 12 yearly CSVs | `data/events.parquet` + `events_meta.json` | Streams one year at a time and carries FIPS seam state across year boundaries |
| 03 aggregate | events.parquet | `data/county_summary.parquet` (3,090 FIPS) + `data/county_durations.parquet` | Joins MCC, DQI, coverage_history |
| 04 filter | county_summary | `filtration/county_tiers.csv` | 954 green / 2,074 amber / 62 red |
| 05 price | county_summary + county_tiers | `pricing/county_premiums.csv` (77,250 rows) + `pricing/county_drilldown.json` | T × X grid |
| catalogs | raw CSVs + pipeline stages | `catalogs/eagle-i-{30,45,60}min/` + `catalogs/manifest.json` | Dashboard-switchable internal comparison catalogs |
| dashboard | catalog manifest + selected drilldown/tiers | live UI at `/dashboard/` | Static HTML/CSS/JS |

Current generated catalog counts:

| Catalog | Event count | Tier mix |
|---|---:|---|
| `eagle-i-30min` | 14,195,144 | 952 green / 2,070 amber / 68 red |
| `eagle-i-45min` | 13,190,684 | 951 green / 2,070 amber / 69 red |
| `eagle-i-60min` | 12,431,932 | 946 green / 2,074 amber / 70 red |

Annual rates use the raw source exposure window, not 12 calendar years and not
a county's first/last event dates. The current release runs from
`2014-11-01 04:00 UTC` through `2026-01-01 00:00 UTC`, or about `11.167`
observation years.

The pipeline is **year-agnostic** — it processes whatever yearly CSVs are present in `data/raw/`. Re-running is idempotent; already-verified raw files are skipped. See `REFRESH.md`.

---

## Stage details

### 01 · Ingest — `data/01_ingest.py`

Pulls the Figshare article `24237376` (EAGLE-I 2014-2023 + 2024 + 2025). It declares:

```python
YEARS = list(range(2014, 2026))          # all 12 years
SUPPLEMENTARY = {"MCC.csv", "coverage_history.csv", "DQI.csv"}
```

For each wanted file it:
1. Fetches the article metadata once.
2. Checks the local `data/raw/` for size + md5 match. If present and matching, **skips** (idempotent).
3. Otherwise downloads with retry/backoff, verifies md5.

The script never deletes anything. To force re-download, pass `--force` or delete the file from `data/raw/`.

### 02 · Construct events — `data/02_construct_events.py`

Turns 15-minute snapshots into events.

- An "event" is a contiguous run of positive snapshots for a FIPS. A later positive snapshot extends the event if the positive-snapshot gap is within the selected `GAP_TOLERANCE`.
- Minimum event duration is 15 min (one snapshot).
- Timestamp convention is documented in `data/SCHEMA.md`: raw `run_start_time` is interpreted as UTC, and `events.parquet` stores timezone-naive UTC `start_time` / `end_time`.
- Processes **one year at a time** — loads a single year's CSV (~1 GB), groups by FIPS, walks each group's timestamps using vectorized `np.diff` to find run boundaries, writes events for that year, frees memory, moves on.
- Schema fix: 2023 CSV uses column `sum`; later years use `customers_out`. Auto-renamed.
- Output schema (`events.parquet`):
  - `event_id`, `fips`, `state`, `county`, `start_time`, `end_time`, `duration_hours`, `n_snapshots`, `min_customers`, `max_customers`, `mean_customers`, `year`
- Writes `events_meta.json` with the knob values and aggregate stats (p50 duration, p95, max, total).

### 03 · Aggregate — `data/03_aggregate_county.py`

Two outputs per FIPS:

**`county_summary.parquet`** (3,090 rows):
- `n_events_total`, `n_per_year`, `duration_p50`, `duration_p95`, `duration_max`
- `mcc` (modeled customer count from `MCC.csv`)
- `observation_years` (source exposure years used by pricing)
- `event_span_years` and `coverage_history_years` (diagnostics only)
- `dqi` (data quality index, averaged per FEMA region from `DQI.csv`, mapped to states via a FEMA→states dict)

**`county_durations.parquet`** (14.2 M rows): long-form `(fips, duration_h)` for histogram building and S(T) computation downstream.

Quirks handled in real data:
- `MCC.csv` has a BOM on `County_FIPS` and a `Grand Total` footer row → stripped.
- `coverage_history.csv` is keyed by (year, state), not FIPS, and currently covers 2018-2022 → kept as a diagnostic, not used as the annualization denominator.
- `DQI.csv` is keyed by (FEMA region, year) → averaged per region, mapped to states.

### 04 · Filter — `filtration/04_filter.py`

The five-gate modelability filter, per FIPS:

| Gate | Threshold for green | What it checks |
|---|---|---|
| D1 Volume | n_events_total ≥ 200; amber ≥ 50 | Enough total history to support an empirical curve |
| D2 Events/year | n_per_year ≥ 20; amber ≥ 5 | Sufficient annual frequency |
| D3 Window | observation_years ≥ 5; amber ≥ 3 | Stable enough source exposure window |
| D4 Tail | duration_p95 ≥ 4 h; amber ≥ 2 h | Tail reaches the outage-trigger range |
| D5 DQI | dqi ≥ 0.8; amber ≥ 0.5 | EAGLE-I / DQI data-quality signal |

Output `county_tiers.csv` has one row per FIPS with the tier (green/amber/red) and the per-gate pass/warn/fail signal that the dashboard's Panel D consumes.

**Note on the current default 951/2070/69 split**: all counties now pass D3 with the full run. Most Amber counties are capped by D5 DQI, so v0.5 should review DQI calibration rather than treating the tier mix as a coverage-window symptom.

The v0 gates are data/modelability gates only. D1, D2, and D4 are county-event driven; D3 uses the source exposure window; D5 uses a FEMA-region source proxy. Launch-readiness dimensions such as regulatory readiness, trigger evidence, underwriting appetite, and compliance operations are intentionally not part of the v0 tier.

### 05 · Price — `pricing/05_price.py`

For each green/amber FIPS and each (T, X) cell on the grid:

```
T_GRID = [2, 4, 8, 12, 24]              # hours
X_GRID = [500, 1000, 2500, 5000, 10000] # dollars
```

Steps per cell:
1. `S(T)` = fraction of historical events at this FIPS with duration ≥ T.
2. `λ(T) = n_per_year × S(T)` — events/yr crossing the deductible.
3. Pure premium = `λ(T) × X`.
4. Retail premium = `pure / (1 − expense_ratio − target_margin)` (defaults: 20% / 15%, denom = 0.65).
5. Uncertainty load is a **stub of $0** in v0; v0.5 will fill this in.

Two output files:
- `pricing/county_premiums.csv` — flat table, 3,090 FIPS × 5 T × 5 X = 77,250 rows.
- `pricing/county_drilldown.json` — per-FIPS dict with everything the dashboard needs (county, state, MCC, durations, tier, full grid, D1..D5 diagnostics). 6.2 MB total.

### Dashboard — `dashboard/`

Static, no build step. In catalog mode it reads `../catalogs/manifest.json`, then
loads the selected catalog's `pricing/county_drilldown.json` and
`filtration/county_tiers.csv`. If no manifest exists, it falls back to the
single generated artifact set under `../pricing/` and `../filtration/`.

- **Map**: MapLibre + CARTO basemap, county-level choropleth. Three color modes: tier (traffic light), λ at 8h, retail premium at 8h × $2,500.
- **Matrix**: T × X premium grid with live re-pricing sliders (expense ratio, target margin) and side panels for the duration histogram and S(T) survival curve.
- **Drill-down**: four panels — A contract, B empirical inputs, C premium chain with the full formula walkthrough, D the five D-gates with pass/warn/fail icons.
- **Catalog selector**: internal switch among EAGLE-I event-construction catalogs
  (`30 min`, `45 min`, `60 min`) so the team can compare continuity assumptions
  without changing code.

---

## What's decided vs. open

Locked in v0 (from `README.md` Decisions table): per-event indemnity, FIPS-county modeling unit, state-level sell/don't-sell, historical-only, no PRESTO, EAGLE-I event log only.

Stubbed in v0, owed to v0.5:
- **Uncertainty load (Panel C row "+ Uncertainty load")** — currently `$0`. Needs a credibility-weighted load (small `n_events` → bigger load).
- **EIA-861 cross-check** — sanity-check observed SAIDI/SAIFI against utility-reported metrics.
- **Confidence calibration** — the D-tier thresholds were picked from first principles; v0.5 will back-test them against held-out years.

---

## Cross-refs

- `plan/00_scope_and_principles.md` — what v0 deliberately excludes
- `plan/02_pricing_math.md` — the formal derivation
- `plan/03_filtration_framework.md` — why these five gates
- `data/EVENT_CONSTRUCTION.md` — the three-knob algorithm in detail
- `data/INVENTORY.md` — Figshare provenance, file sizes, schemas
- `REFRESH.md` — how to refresh and how to re-run on a bigger machine
