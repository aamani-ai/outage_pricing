# Outage-Pricing Data Lake — Schema

Canonical reference for **every dataset** behind the outage-pricing engine — the structure, the meanings, and
the data's actual character (distributions + outliers). Modeled on the renewablesinfo `docs/schema` pattern:
one **reference** doc (skeleton + meanings) + one **analytical** doc (distributions + outliers).

The data is hosted in GCS — **`gs://infrasure-outage-pricing-data`** (project `modeling-nonprod-svc-db5x`,
private). This is the canonical store **and a backup**: ~13 GB that was previously local-only on one machine
(all gitignored). See [`reference_gcp_bucket`](../../) in memory for access.

---

## Read order

1. **This README** — the lake's shape, the end-to-end flow, the bucket layout.
2. **[`data_lake.md`](data_lake.md)** — THE REFERENCE: every dataset's fields · type · meaning · lineage.
3. **[`data_profile.md`](data_profile.md)** — THE ANALYTICAL LAYER: distributions, the heavy tail, and the
   OUTLIERS / data-quality issues that actually shape pricing decisions.

---

## The flow: sources → catalogs → derived → app

```text
  SOURCES (raw inputs)                  CATALOGS (eventized)            DERIVED (analysis)            APP (served)
  ─────────────────────                 ──────────────────             ──────────────────            ───────────
  eagle_i/*.csv  (11 GB, 15-min   ──►   catalogs/<id>/                  derived/customer_base.csv     app/county_events/
    customers-out snapshots)              data/events.parquet   ──►       (A018 denominator)            <fips>.json
  mcc/MCC.csv  (denominator)              (one row per outage event)    derived/per_customer_rate/      (per-county event
  acs/acs_county_2022.json               data/county_durations,          per_customer_lambda__*.pq      series for the
    (households + housing units)          county_summary                derived/county_trend/,          dashboard view)
  reference/DQI.csv,                      pricing/*.json                  predictability/, lambda_shadow
    coverage_history.csv                  (dashboard-ready reads)
   <id> ∈ {eagle-i-30min, 45min, 60min}  ← the gap-merge tolerance variant; 45min is the headline catalog
```

The whole chain is **historical-empirical v0**: `λ(T) = N_per_year · S(T)`, then per-customer via an
MCC-share multiplier. No fitted distribution, no forward/climate overlay in these files — those are separate
adjusters applied later in the build-up.

---

## Bucket layout

| Prefix | Holds | Size |
|--------|-------|------|
| `sources/eagle_i/` | 12 raw EAGLE-I yearly CSVs `eaglei_outages_<year>.csv` (2014–2025) | ~11 GB |
| `sources/mcc/MCC.csv` | Modeled County Customers (the raw denominator) | 40 KB |
| `sources/acs/acs_county_2022.json` | Census ACS B11001 households + B25001 housing units | 192 KB |
| `sources/reference/` | `DQI.csv` (data-quality index) · `coverage_history.csv` (coverage ramp) | 16 KB |
| `catalogs/<id>/data/` | `events.parquet` + `county_durations` + `county_summary` | ~250 MB ea |
| `catalogs/<id>/pricing/` | dashboard-ready JSONs (drilldown, per_customer_view, …) | ~60 MB ea |
| `derived/` | `customer_base.csv` (A018) · `per_customer_rate/` · `county_trend/` · `predictability/` · `lambda_shadow/` | ~175 MB |
| `app/county_events/<fips>.json` | per-county event series for the dashboard event view *(to be built)* | small, per-county |

---

## The two things to internalize before using any of this

```text
  1. EVERYTHING IS HEAVY-TAILED.
       per-event customers-out:  median 4  ·  mean 39  ·  p99 641  ·  max 1,777,800 (Miami-Dade, Irma)
       → the MEAN over-states the typical event ~10×. The mean-vs-median choice for the per-customer
         multiplier is THE central open pricing question (A011). Median/percentiles are more honest than the mean.

  2. THE DENOMINATOR IS THE FRAGILE INPUT — and we may be using the wrong source.
       · MCC.csv is broken for a long tail of counties (Henderson NC = 24; several = 1) + a systematic
         NORTH CAROLINA under-coverage cluster (a missing utility in the feed).
       · the RAW EAGLE-I carries its OWN `total_customers` column — Henderson = 69,102 there, vs 24 in MCC.csv.
         We divided by MCC.csv. This is worth revisiting (see data_profile.md → "the denominator-source finding").
       · impossible peaks (customers_out > every home in the county) appear in 8,441 snapshots in 2024 alone.
```

These two facts are why the [premium-implausibility investigation](../dicsscssion/done/premium_implausibility_investigation/)
and the [customer-base denominator fundamentals](../methodology/02_per_customer/customer_base_denominator_fundamentals.md)
exist. This schema folder is the data-level companion to those.

---

*Built 2026-06-28 from a parallel profiling pass over every dataset (schema + distributions + outliers).
Regenerate the profile by re-reading the sources; the numbers here are data-backed, not estimates.*
