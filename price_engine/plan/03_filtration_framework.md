# 03 — Filtration Framework

> Status note: this is retained as planning history. The implemented v0 filter is `../filtration/04_filter.py`, and `../ARCHITECTURE.md` / `../END_TO_END.md` are authoritative for the current five-gate D1-D5 baseline. In particular, the old D3 first-event/last-event observation-year formula below is superseded; current annualization uses the raw source exposure window documented in `../data/SCHEMA.md`.

The filter answers: *for which counties do we have enough data to price defensibly?* The answer is a three-tier label per FIPS: **Green**, **Amber**, **Red**. The tier feeds the dashboard's colour, the pricing function's uncertainty load (when v0.5 lights up), and the state-level go/no-go.

Critically, the tier is about **modelability**, not loss frequency. A high-outage county is Green if it's well-characterised. A quiet county is Red if it's too sparse to characterise.

## The four diagnostics that determine the tier

Each FIPS is evaluated on four independent diagnostics. The tier is the *minimum* across them — any single weak diagnostic pulls the tier down.

### D1 — Volume: total events

> "Are there enough events to estimate the survival function at all?"

```
events_total = count of historical events in FIPS
```

| Threshold | Rationale |
|---|---|
| `events_total >= 200` → eligible for Green | Standard statistical-power floor for empirical CDFs; 200 events gives a reasonable empirical S(T) at the body |
| `100 <= events_total < 200` → caps tier at Amber | Workable but uncertain |
| `events_total < 100` → Red | Too few events for empirical tail estimation |

### D2 — Tail support: qualifying events at the priced deductibles

> "Even with lots of events, do we have any in the part of the curve we're pricing?"

```
events_qualifying(T) = count of historical events with duration >= T
```

For v0's standard grid `T ∈ {2, 4, 8, 12, 24}`, we evaluate at each `T`:

| Threshold | Effect |
|---|---|
| `events_qualifying(T) >= 10` | Cell `(FIPS, T)` is priceable at Green level |
| `3 <= events_qualifying(T) < 10` | Cell priceable at Amber level (uncertainty band shown) |
| `events_qualifying(T) < 3` | Cell is **no-quote** at that `T`, regardless of FIPS tier |

This is per-`T`, not per-FIPS. A county might be Green at `T=4h` (50 qualifying events) and no-quote at `T=24h` (zero qualifying events). The dashboard surfaces this explicitly.

### D3 — Coverage window: observation years

> "Even with lots of events, is the window long enough to be representative?"

```
observation_years = (last_event_date - first_event_date) / 365.25
```

| Threshold | Effect |
|---|---|
| `observation_years >= 5` | Eligible for Green |
| `3 <= observation_years < 5` | Caps tier at Amber |
| `observation_years < 3` | Red |

Five years is the standard floor for treating annual outage rates as stable rather than transient. The choice matches IEEE 1366 reporting conventions.

### D4 — Year-to-year stability: event-count coefficient of variation

> "Does the annual event count look stable, or does it swing wildly?"

```
annual_counts = [events in year y for y in observed_years]
cv = std(annual_counts) / mean(annual_counts)
```

| Threshold | Effect |
|---|---|
| `cv <= 0.5` | Eligible for Green |
| `0.5 < cv <= 1.0` | Caps tier at Amber |
| `cv > 1.0` | Red |

High CV typically means a single major event (hurricane, derecho, ice storm) drove a year. That's not unmodelable per se, but it means the empirical rate from a short window may not generalise — we need to flag it.

This is the diagnostic that catches counties most insurance teams want to write but actually can't be priced from history: places where a single 2020 storm dominates the empirical record.

## Tier composition

```
tier(FIPS) = min(
  green_if(D1) and green_if(D3) and green_if(D4) → Green,
  any_amber(D1, D3, D4) and not red_any → Amber,
  any_red(D1, D3, D4) → Red
)
```

D2 acts at the cell level (per `T`), not the county level.

A FIPS is Green if **all four** county-level diagnostics pass Green. Amber if any is Amber and none Red. Red if any is Red.

The tier_rationale array in the engine's return object (see `02_pricing_math.md`) reports each diagnostic explicitly so the dashboard can show *why*.

## Worked tier examples (illustrative — actual EAGLE-I numbers will calibrate the thresholds)

### Example 1 — Miami-Dade, FL (large coastal urban)
- D1: 412 events ≥ 200 → Green
- D3: 7.5 years ≥ 5 → Green
- D4: CV = 0.18 ≤ 0.5 → Green
- D2 at T=12h: 21 events ≥ 10 → Green for this cell
- **Overall tier: Green.** Priced normally.

### Example 2 — Travis County, TX (urban, but 2021 ice storm dominates record)
- D1: 287 events ≥ 200 → Green
- D3: 6.0 years ≥ 5 → Green
- D4: CV = 1.4 > 1.0 → Red
- **Overall tier: Red.** One event dominates; not priceable from history without further treatment (separate major-event-day, longer window, or external model).

### Example 3 — Hidalgo County, NM (rural, low population)
- D1: 38 events < 100 → Red
- D3: 4 years (full window) → Amber
- D4: CV = 0.7 → Amber
- **Overall tier: Red** (D1 dominates). No-quote.

### Example 4 — Sussex County, DE (suburban, moderate data)
- D1: 156 events → Amber
- D3: 5.5 years → Green
- D4: CV = 0.4 → Green
- D2 at T=4h: 28 events → Green
- D2 at T=12h: 6 events → Amber
- D2 at T=24h: 1 event → no-quote
- **Overall tier: Amber.** Priced with uncertainty band; T=24h cell is no-quote.

## What "no-quote" looks like on the dashboard

A cell that is no-quote shows the reason rather than a price:

```
T=24h, X=$2,500
─────────────
   NO QUOTE
"Only 1 historical 24h+ event;
 need ≥ 3 to price defensibly."
```

The matrix is therefore not always fully populated. That is a feature — it forces the conversation about exactly which products we can credibly sell in which county.

## Thresholds are configuration, not code

All thresholds in this doc live in a single YAML file `filtration/thresholds.yml` so they can be tuned without touching code. The defaults shipped with v0 are listed above; the calibration pass is part of the build sequence (`07_build_sequence.md`).

## What this does NOT capture (and why that is okay for v0)

- **Forward-looking risk drift.** A county that was Green five years ago and is rapidly degrading (or improving) is treated by D4 only crudely. v1 adds a trend detector.
- **Spatial smoothing.** A county sandwiched between two Greens that is Red purely from data sparsity might be reasonably borrowed from neighbours. v1 considers spatial pooling.
- **Cause-mix changes.** A county that historically saw routine outages but is now seeing storm-driven ones (or vice versa) has a changing underlying distribution. Detecting this requires cause classification, which is v1.

For v0, the four diagnostics are the simplest framework that distinguishes "can defensibly price" from "cannot." Adding more would make v0 worse, not better, because it would obscure what is doing the work.

## Output of the filter for the whole U.S.

The end product of running the filter is a single CSV (`filtration/county_tiers.csv`) with one row per FIPS:

```
fips, fips_name, state, tier, d1_value, d2_t2, d2_t4, d2_t8, d2_t12, d2_t24, d3_value, d4_value, rationale_text
12086, Miami-Dade County, FL, Green, 412, 380, 250, 95, 21, 4, 7.5, 0.18, "All diagnostics pass."
48453, Travis County, TX, Red, 287, ..., 1.4, "Annual event-count CV 1.4 > 1.0 (single event dominates record)."
...
```

The dashboard reads this file directly to colour the map.
