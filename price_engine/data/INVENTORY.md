# Data Inventory — v0

Single source of truth for what data v0 uses, where it comes from, and what we ignore in the rest of the repo.

## Headline

**v0 uses one data source: Figshare article 24237376 (the EAGLE-I public release).** Twelve consecutive years (2014–2025) of raw 15-minute county-level outage snapshots, one schema, one DOI, one fetch script. No PNNL `_merged.csv`, no ORNL split, no two-phase ingest.

Everything else in the existing repo (`data/raw/eaglei_csvs/*_merged.csv`, `data/processed/events_master.csv`, the storm-timeline dashboard) is from a prior project and is **not used by v0**. We leave it in place and ignore it.

## Source

| Property | Value |
|---|---|
| Dataset | EAGLE-I Power Outage Data |
| Host | Figshare |
| Article ID | `24237376` |
| API | `https://api.figshare.com/v2/articles/24237376` |
| Coverage | 2014-11-01 04:00 UTC through 2026-01-01 00:00 UTC |
| Resolution | 15-minute snapshots |
| Unit | One row per (FIPS, run_start_time) snapshot with `customers_out > 0` |
| License | Public (CC) |

The Figshare article is the canonical, version-stable public release of the EAGLE-I dataset that ORNL/PNNL maintain. It replaces the older PNNL `_merged.csv` files we used in earlier scratch work, and it now extends through 2025 — the 2024/2025 gap that earlier notes described as "missing" was a stale assumption.

## Files in the article

### Primary — yearly snapshot CSVs

Twelve files, one per year:

```
eaglei_outages_2014.csv
eaglei_outages_2015.csv
...
eaglei_outages_2025.csv
```

Schema (identical across all 12 years):

| Column | Type | Description |
|---|---|---|
| `fips_code` | int | 5-digit county FIPS |
| `county` | str | County name |
| `state` | str | State abbreviation |
| `customers_out` | int | Customers without power at this snapshot |
| `run_start_time` | timestamp | UTC, 15-minute increments |

**Important: this is raw snapshot data, not events.** A single outage produces many rows (one per 15-min snapshot while it is ongoing). Constructing events from these snapshots is what `EVENT_CONSTRUCTION.md` covers.

Timestamp contract: raw `run_start_time` strings do not include an offset, but v0 interprets them as UTC. Generated parquet timestamps are stored as timezone-naive UTC. See `SCHEMA.md` for the exact convention.

Note: 2014 is partial — the first raw timestamp in the current local release is
`2014-11-01 04:00:00`. We keep it and annualize against the measured source
exposure window, about `11.167` years for the 2014-2025 release.

### Supplementary — three reference files

These ship in the same Figshare article and feed downstream filtration:

| File | Source | What it provides | Used by |
|---|---|---|---|
| `MCC.csv` | [Moehl et al. — Modeled County Customers](https://www.nature.com/articles/s41597-023-02427-1) | Estimated total customer count per FIPS. Lets us express `customers_out` as a fraction of the county's total customers. | Filtration (D-tier), severity context. NOT used in v0 pricing math. |
| `coverage_history.csv` | EAGLE-I program | State/year coverage-quality history in the current Figshare release. | Diagnostic only in v0 annualization. The current file covers 2018-2022 and is not used as the pricing denominator. |
| `DQI.csv` | EAGLE-I program | Data Quality Index per FIPS — flags counties with known reporting gaps, utility coverage issues, or data anomalies. | Filtration D5 (data quality gate). Counties with poor DQI tier to Amber/Red regardless of volume. |

## Ingest

`price_engine/data/01_ingest.py`:

1. Hit the Figshare API at article 24237376 to list files
2. Download all 12 `eaglei_outages_YYYY.csv` files + `MCC.csv` + `coverage_history.csv` + `DQI.csv` to `price_engine/data/raw/`
3. Verify checksums against the API response
4. Re-runnable / idempotent — skips files already present unless `--force`

Reference implementation: the `eaglei_downloader.py` script in the user's separate working codebase (Figshare API call, MD5 verification, retry logic). We will mirror that pattern.

The yearly CSVs are then consumed by `02_construct_events.py` which produces `events.parquet`. That construction logic is documented separately in `EVENT_CONSTRUCTION.md`.

## What the rest of the repo has (and v0 ignores)

For clarity: the following exists in the repo from a prior project. None of it is consumed by v0.

| Path | Origin | v0 status |
|---|---|---|
| `data/raw/eaglei_csvs/*_merged.csv` | PNNL pre-merged events, 2014-2023 | **Ignore.** v0 reconstructs events from raw snapshots, not these. |
| `data/processed/events_master.csv` | OE-417 named-storm rollup | **Ignore.** Different abstraction (named storms only). |
| `data/processed/county_index.json` etc. | Aggregates for storm dashboard | **Ignore.** |
| `data_eia861/reliability_panel.csv` | Utility-reported SAIDI/SAIFI | **Ignore for v0 pricing.** May surface as sanity-check overlay later. |
| `scripts/00-03_*.py` | Existing pipeline for storm timeline | **Ignore.** |
| `dashboard/` | Existing storm-timeline UI | **Ignore.** v0's dashboard lives in `price_engine/dashboard/`. |

These artifacts are not deleted — they support an unrelated dashboard that continues to live in the repo. v0 simply does not touch them.

## Coverage window for v0

| Property | Value |
|---|---|
| Raw source window | 2014-11-01 04:00 UTC → 2026-01-01 00:00 UTC |
| Effective observation years | ~11.167 years |
| Partial source years | 2014 is partial; 2015-2025 are treated as full calendar-year exposure |
| Annualization denominator | Source exposure years, not first/last county event dates |
| `coverage_history.csv` role | Coverage-quality diagnostic only; current file covers 2018-2022 |

Observation years feed the pricing formula via
`N_per_year(FIPS) = total_events_in_FIPS / observation_years(FIPS)`.
`observation_years` is the raw source exposure window for the processed release.
It deliberately does **not** use the county's first and last outage dates,
because that would inflate rates for quiet counties that simply did not have an
early observed outage.

## What we do NOT depend on for v0

| Item | Why excluded |
|---|---|
| OE-417 named events | Pricing triggers on raw outage occurrence, not whether the outage made the news. |
| Customer-event reconstruction | v0 contract triggers at county-event level (utility report validation). Per-customer indemnity would need different data and a different model. |
| `customers_out` in premium formula | Stored in `events.parquet`, but doesn't enter `λ(T) × X`. Used downstream for filtration severity context and v1 portfolio correlation work. |
| EIA-861 SAIDI/SAIFI | We compute empirical `λ(T)` directly. May overlay later as sanity check. |
| PNNL `_merged.csv` | We construct events ourselves from raw snapshots. See `EVENT_CONSTRUCTION.md`. |

## Why we re-construct events instead of trusting PNNL's `_merged.csv`

The PNNL pre-merged files are useful but a black box: the merging rules (gap tolerance, threshold, minimum duration) are PNNL's choices, not ours, and they are not all documented in a form that lets us defend them to a counterparty. For a pricing engine we need the event boundaries to be **our explicit choice**, with the reasoning written down — so that when someone asks "why did this 90-minute gap become two events instead of one", the answer is in `EVENT_CONSTRUCTION.md`, not in someone else's code.

Mechanically, the raw 15-minute snapshots are the ground truth EAGLE-I publishes. Going through PNNL's merger and then either trusting or reverse-engineering it adds a dependency we don't need. We do the event construction ourselves, document every choice, and `_merged.csv` becomes irrelevant.

## Next file

`EVENT_CONSTRUCTION.md` — the algorithm that turns raw snapshots into events, with the three design choices (gap tolerance, threshold, minimum duration) and their reasoning.
