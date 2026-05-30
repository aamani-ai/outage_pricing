# Filtration (Modelability Tiers) — Methodology

- **Status:** skeleton
- **First written:** 2026-05-30
- **Last reviewed:** 2026-05-30

## Scope

How each county is assigned a Green / Amber / Red tier that indicates
whether we can **defensibly price it**. Tiers are about modelability, not
about loss severity or commercial viability — those are separate
dimensions and are intentionally not part of the v0 tier.

## Inputs and outputs

| | Items |
|---|---|
| **Inputs** | `price_engine/data/county_summary.parquet` + DQI |
| **Outputs** | `price_engine/filtration/county_tiers.csv` and per-catalog tier files |

## Method (summary)

Five gates, each scored independently as Green / Amber / Red. The
county's tier is the **worst** of the five.

| Gate | Quantity | Green | Amber | Red |
|---|---|---|---|---|
| D1 — Volume | `n_events_total` | ≥ 200 | ≥ 50 | else |
| D2 — Events/year | `n_per_year` | ≥ 20 | ≥ 5 | else |
| D3 — Window | `observation_years` | ≥ 5 | ≥ 3 | else |
| D4 — Tail credibility | `duration_p95` | ≥ 4 h | ≥ 2 h | else |
| D5 — Data quality | DQI | ≥ 0.8 | ≥ 0.5 | else |

D1, D2, D4 are county-event driven. D3 is a source-window gate. D5 is a
FEMA-region DQI proxy in the current implementation; calibration is
flagged as a v0.5 review item.

## What tiers do NOT carry

- Loss severity (some Green counties have high expected losses).
- Customer-impact bias (handled separately by the per-customer plan).
- Commercial viability, regulatory readiness, trigger-source readiness,
  compliance ops — these are intentionally separate launch-readiness
  dimensions and are rendered grey on the dashboard until evidence
  exists.

## Validation

- Tier counts published per catalog (e.g. 30/45/60-min); large shifts
  flag instability.
- Manual spot-check on edge cases (a single failing gate flipping the
  county to Red).

## Known limitations

- D5 (DQI) is currently calibrated as a FEMA-region proxy. Most Amber
  counties are capped by D5; v0.5 should review DQI calibration before
  interpreting Amber as a sellability blocker.
- Tier definitions are static thresholds; they are not adjusted for
  state-level or utility-level baselines.

## Implementation pointers

| Aspect | File |
|---|---|
| Algorithm | `price_engine/filtration/04_filter.py` |
| Tier spec | `price_engine/plan/03_filtration_framework.md` |
| Tier tooltips | `price_engine/dashboard/app.js` (dimension info blocks) |

## Cross-references

- [Aggregation and Annualization Methodology](aggregation_and_annualization_methodology.md)
- [Pricing Methodology](pricing_methodology.md) — uses tier as a quote / no-quote gate (Red = no quote)
- `price_engine/ARCHITECTURE.md` §5
