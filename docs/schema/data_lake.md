# Data Lake — Reference (skeleton + meanings)

Every dataset behind the outage-pricing engine: its role, scale, and **every field with its type, meaning, and
lineage**. The analytical companion (distributions + outliers) is [`data_profile.md`](data_profile.md).

Paths are given local → bucket. `gs://infrasure-outage-pricing-data` is abbreviated `gs://…`.

> **Three cross-cutting gotchas that bite every join** (verified in profiling):
> - **FIPS leading zeros.** Most files store FIPS without zero-padding (`1001` not `01001`) or as int. Always
>   `str(fips).zfill(5)` before joining. Affects all 0x states (AL/AK/AZ/AR/CA/CO/CT).
> - **`customers_out` / `mcc` / `total_customers` are counts of customer accounts (≈ meters), not people, not
>   households.** ~150M nationally.
> - **Timestamps are timezone-naive UTC**, not county-local; no DST applied. `year` is the UTC calendar year.

---

# 1 · SOURCES (raw inputs)

## 1.1 `eaglei_outages_<year>.csv` — raw EAGLE-I 15-min snapshots
`price_engine/data/raw/eaglei_outages_2014..2025.csv` → `gs://…/sources/eagle_i/`

**The sole base source** (Oak Ridge / DOE, Figshare 24237376). One row = one county at one 15-minute timestamp,
reporting how many customers were without power then. 12 yearly CSVs, ~11 GB; 2024 file alone is 27.7M rows /
1.44 GB across 3,061 FIPS. 2014 is partial (Nov-onward). Everything downstream is built from these snapshots.

| Field | Type | Meaning | Lineage / note |
|-------|------|---------|----------------|
| `fips_code` | string (5-char, zero-padded) | County identifier — the geographic join key | **Read as str** or leading zeros are lost |
| `county` | string | County/parish/borough name (denormalized label) | Not unique across states; join on fips |
| `state` | string | Full state/territory name | 53 values incl. DC, PR, US Virgin Islands |
| `customers_out` | int64 | **The core measurement** — customers without power at this snapshot | Count of accounts; 0 is valid (~3.9% of rows); instantaneous, not cumulative |
| `run_start_time` | string ts (`YYYY-MM-DD HH:MM:SS`) | Snapshot time; cadence :00/:15/:30/:45 | Naive (no tz). Rows exist only where EAGLE-I had data → gaps occur |
| `total_customers` | int64 (nullable) | **County customer base (denominator)** carried in the raw feed | ⚠️ **This is a per-row denominator we were NOT using** (we used MCC.csv). Henderson NC = 69,102 here vs 24 in MCC.csv. Not guaranteed ≥ observed `customers_out`. |

## 1.2 `MCC.csv` — Modeled County Customers (the denominator we use)
`price_engine/data/raw/MCC.csv` → `gs://…/sources/mcc/MCC.csv`

The per-county customer-count denominator the v0 engine actually divides by. 3,232 county rows + a header (UTF-8
BOM) + a **`Grand Total` footer row** (must be dropped). Correctness of this file directly drives premium plausibility.

| Field | Type | Meaning | Lineage / note |
|-------|------|---------|----------------|
| `County_FIPS` | string | 5-digit FIPS (state+county) | ⚠️ stored unpadded → 312 rows in states 01–09 render 4-digit; last row is literal `Grand Total` |
| `Customers` | int64 | Modeled customer accounts (meters) in the county | Footer = exact sum 154,451,840 (≈ US total, confirms accounts not population). Median MCC/ACS-households ≈ 1.32 |

## 1.3 `acs_county_2022.json` — Census ACS 2022 (households + housing units)
`price_engine/data/raw/acs_county_2022.json` → `gs://…/sources/acs/acs_county_2022.json`

Raw Census API array-of-arrays (element [0] is the header — drop it). The independent denominator cross-check.
3,222 rows incl. DC + Puerto Rico. Unusually clean (0 nulls/sentinels).

| Field | Type | Meaning | Lineage / note |
|-------|------|---------|----------------|
| `NAME` | string | "County, State" label | Display/validation only |
| `B11001_001E` | string→int | **Households** = occupied housing units | The "metered customers" proxy |
| `B25001_001E` | string→int | **Housing units** = occupied + vacant + seasonal | Always ≥ households; broader physical-connection ceiling |
| `state` | string | 2-digit state FIPS (zero-padded) | Keep as string |
| `county` | string | 3-digit county FIPS (zero-padded) | fips = state+county, length 5 |

## 1.4 `DQI.csv` + `coverage_history.csv` — coverage / data-quality references
`price_engine/data/raw/` → `gs://…/sources/reference/`

**Diagnostics, NOT pricing inputs.** They quantify how completely EAGLE-I observed the grid, 2018–2022, and are
the empirical backing for "recent beats long-run mean" (the coverage ramp dilutes early years).

- **`DQI.csv`** — 50 rows (10 FEMA regions × 2018–2022). Composite **DQI** (0–100) from four sub-metrics:
  `success_rate`, `percent_enabled`, `spatial_precision`, `cust_coverage` (+ `max_covered`, `total_customers`).
  DQI is a weighted composite, *not* a clean product of the four (corr 0.64).
- **`coverage_history.csv`** — 280 rows (56 states × 2018–2022). `total_customers`, `min/max_covered`,
  `min/max_pct_covered` — the observed-coverage floor/ceiling per state-year. **No county FIPS** in either file
  (FEMA-region / state grain) → can't join to counties without a crosswalk.

---

# 2 · CATALOGS (eventized) — `catalogs/<id>/`, id ∈ {eagle-i-30min, 45min, 60min}

The `<id>` is the **gap-merge tolerance** at ingestion (45min = headline). Each catalog has `data/` + `pricing/`.

## 2.1 `events.parquet` — the eventized outage catalog
`price_engine/data/events.parquet` (and `catalogs/<id>/data/`) → `gs://…/catalogs/<id>/data/events.parquet`

**The heart of v0.** Collapses raw 15-min snapshots into discrete outage EVENTS — one row per (county,
contiguous spell). 14.2M rows, 255 MB, 3,090 FIPS. Internally clean (0 structural violations); the issues are
magnitude-plausibility (see profile). Knobs in `events_meta.json`: 15-min snapshots, 30-min gap bridging,
MIN_DURATION 15 min, threshold `customers_out > 0`.

| Field | Type | Meaning | Lineage / note |
|-------|------|---------|----------------|
| `event_id` | string | `{fips}_{start:YYYYMMDDThhmmss}` — unique per event | Derived |
| `fips` | int64 | County FIPS (unpadded, `1001`=Autauga) | From raw `fips_code` |
| `state`, `county` | string | Carried verbatim from raw | Join on fips |
| `start_time` | timestamp[ns] (naive UTC) | First observed positive-outage snapshot (inclusive) | UTC, no DST |
| `end_time` | timestamp[ns] (naive UTC) | Last outage snapshot + 15 min (exclusive) | Cross-year events exist by design |
| `duration_hours` | float64 | (end − start)/3600; multiples of 0.25h | Can exceed n_snapshots·0.25 due to gap-bridging (caps at 2.0×) |
| `n_snapshots` | int64 | Count of OBSERVED positive snapshots (excl. bridged gaps) | Median 7 |
| `min_customers` | int64 | Min customers_out across observed snapshots | |
| `max_customers` | int64 | **Peak** customers_out (worst instant) | The severity ceiling |
| `mean_customers` | float64 | Mean customers_out across observed snapshots | **The v0 severity proxy** (within [min,max]) |
| `year` | int16 | UTC calendar year of start_time | 2014 partial |

## 2.2 `county_durations.parquet` + `county_summary.parquet` — the v0 baseline pair
`price_engine/data/` (and `catalogs/<id>/data/`) → `gs://…/catalogs/<id>/data/`

The frequency + severity-survival base. **`county_durations`** = 14.2M rows × 3 (`fips`, `duration_hours`,
`year`) — the raw duration sample whose empirical survival forms S(T). **`county_summary`** = 3,090 rows × 19,
one per county, perfect 1:1 fips join.

Key `county_summary` fields: `n_events_total`, `observation_years` (constant **11.167**), `n_per_year`
(= the λ frequency base = n_events_total / observation_years), `event_span_years`, `mcc` (denominator — **same
buggy MCC**), `dqi` (0.68–0.90, discrete state-level banding), `duration_p50/p90/p95/p99/max`,
`mean_customers_overall` (per-event customer scale; median ~29). Window constants:
`source_window_start` = 2014-11-01, `source_window_end` = 2026-01-01 (nominal feed span, future-dated).

---

# 3 · DERIVED (analysis outputs) — `derived/`

## 3.1 `customer_base.csv` — the composite denominator (A018)
`price_engine/data/customer_base.csv` → `gs://…/derived/customer_base.csv`

Picks ONE defensible denominator per county by reconciling three disagreeing sources. 3,257 rows.
**`base = max(mcc_raw, housing_units, peak)`**, with exclusion when `peak > 1.5 × max(mcc_raw, housing_units)`.

| Field | Type | Meaning | Lineage / note |
|-------|------|---------|----------------|
| `fips` | string | County FIPS (PK) | ⚠️ 327 rows are 4-char → zfill(5) |
| `mcc_raw` | float64 | EAGLE-I MCC (candidate #1) | 24 nulls; can be implausibly tiny |
| `households` | float64 | Census households — **context only, never feeds base** | ≤ housing_units in 98.9% |
| `housing_units` | float64 | Census housing units — structural FLOOR (candidate #2) | used when status=housing_floor |
| `peak` | float64 | Observed peak customers-out (candidate #3) | used when peak is max; also the exclusion trigger |
| `base` | int64 | **THE chosen denominator** = max(the three) | reconstructs exactly; for excluded rows base==peak |
| `status` | string | `mcc_ok` / `housing_floor` / `peak_floor` / `excluded` | A018 selection outcome |
| `excluded` | bool | True iff peak > 1.5× max(mcc,hu) — dropped from pricing | the 131 excluded rows |
| `reason` | string | Only value: `peak_exceeds_base` (131 rows) | null when retained |

> ⚠️ **`base` is populated even for excluded rows (= peak there).** Consumers MUST filter on `excluded` /
> `status != 'excluded'`, not trust `base` alone. And `base`'s `peak` component is **self-referential** — it
> cannot flag impossible peaks; use ACS households/housing_units for that.

## 3.2 `per_customer_lambda__<id>.parquet` — the per-customer rate
`curated_outage_data/outputs/per_customer_rate/` → `gs://…/derived/per_customer_rate/`

Per-county × per-trigger (T ∈ {2,4,8,12,24}h) frequency translated to per-customer via the MCC-share multiplier.
15,450 rows (3,090 × 5). **The headline per-customer rate artifact.** T=8 is the primary threshold.

Core fields: `lambda_county` (annual ≥T events/yr = n_events_qualifying / observation_years), `mcc` (denominator),
`multiplier_mean|median|max` (per-event customers/MCC share — mean is heavy-tail-sensitive), `lambda_customer_mean|median|max`
(= lambda_county × multiplier; **mean is headline**), `pct_mcc_p10/p50/p90/p99` (severity distribution;
p50 ≡ multiplier_median), `coverage_gate_status` (`available`/`caution`/`not_available`) + `coverage_gate_reason`
(`low_qualifying_event_count` / `insufficient_qualifying_events` / `mcc_invalid` / `low_total_event_count`).

> Identities verified: `lambda_customer_mean = lambda_county × multiplier_mean` (exact). **Gate on
> `coverage_gate_status`** — `available` only for headline pricing.

## 3.3 Other derived outputs (descriptive / shadow — NOT v0 pricing)
`gs://…/derived/{county_trend, county_predictability, county_lambda_shadow}/`

- **`county_trend`** — OLS year-over-year regression (slope, t_stat, trend_class). Descriptive.
- **`county_predictability`** — Step-3 regime/pattern classifier (stable/trend/shift/episodic, pattern groups,
  predictability score). Descriptive.
- **`county_lambda_shadow`** — candidate forward λ-adjustment factor (capped [0.75, 2.5], `shadow_only` — does
  not mutate v0 pricing). The "recent beats mean" candidate.

---

# 4 · PRICING JSONs (dashboard-ready) — `catalogs/<id>/pricing/`

Dicts keyed by 5-digit FIPS (3,090 counties), per-T nested {2,4,8,12,24}. **Only `county_drilldown.json` is
actual v0 pricing**; the rest are non-pricing reads.

| File | Carries | Consumer | Priced? |
|------|---------|----------|---------|
| `county_drilldown.json` | tier/quotable, n_per_year, mcc, S_T, lambda_T, **pure/retail premium grid** (X ∈ {500…10000}) | legacy app.js (primary) · new `build_data.py` | ✅ v0 |
| `per_customer_view.json` | lambda_county, multiplier_*, **lambda_customer_*** , pct_mcc, coverage gate | legacy app.js · `build_data.py` | ❌ shadow (bias-correction) |
| `county_yearly_trend.json` | per-year counts, OLS slope/t_stat, trend_class | legacy app.js (new web uses the parquet) | ❌ descriptive |
| `county_predictability.json` | regime classifier output | legacy app.js | ❌ descriptive |
| `county_lambda_shadow.json` | forward λ factor (shadow) | legacy app.js | ❌ shadow_only |

> `retail = pure / (1 − ER − TM)` (~1.538× pure). ER/TM are now **underwriter-set in the Studio** — these baked
> retail values are illustrative defaults, not the final composed premium. `county_drilldown.json` has no `meta`
> block (read provenance from a sibling file). **Inconsistency to note:** for broken-MCC counties,
> `per_customer_view` gates them to null (`mcc_invalid`) but `county_drilldown` still serves raw `mcc=24` and prices off it.

---

# 5 · APP (to be built) — `app/county_events/<fips>.json`

The per-county event series for the dashboard event-timeseries view (the numerator-investigation tool). Compact
rows `[daysSinceEpoch, durationHours, meanCustomers, maxCustomers]` for events ≥2h, sliced per county from
`events.parquet`. Served privately via `/api/county-events`. *(Pipeline + schema finalized when built.)*

---

*Companion: [`data_profile.md`](data_profile.md) (distributions + outliers). Generated 2026-06-28 from a parallel
profiling pass; numbers are data-backed.*
