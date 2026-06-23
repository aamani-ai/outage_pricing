# Data Ingestion — Methodology

- **Status:** skeleton
- **First written:** 2026-05-30
- **Last reviewed:** 2026-05-30

## Scope

How we acquire the raw data the v0 pricing engine consumes, how the
downloaded artifacts are verified, and what the project does NOT use as a
base source even though it could.

## Inputs and outputs

| | Items |
|---|---|
| **Inputs** | Figshare article 24237376 (ORNL EAGLE-I yearly CSVs + MCC + DQI + coverage_history) |
| **Outputs** | `price_engine/data/raw/eaglei_outages_YYYY.csv` × 12 + `MCC.csv` + `DQI.csv` + `coverage_history.csv` |

## Method (summary)

TBD. The current implementation is `price_engine/data/01_ingest.py` —
HTTPS pull from Figshare with MD5 verification, idempotent (skips files
already present locally). Full description to be lifted into this file as
the methodology stabilizes.

## Time semantics

EAGLE-I raw timestamps are treated as UTC instants
([A001](../assumptions.md#a001--eagle-i-raw-timestamps-are-utc)). The
+15-min snapshot interval convention is recorded in
[A003](../assumptions.md#a003--each-eagle-i-15-min-snapshot-represents-the-interval-t-t--15-min).

## Sources deliberately not used as the base layer

| Source | Why excluded from v0 base |
|---|---|
| PNNL `*_merged.csv` derived event files | Undocumented-to-us stitching rules; v0 owns its own algorithm |
| DOE OE-417 disturbance reports | Threshold-driven, only catches the largest events |
| NOAA Storm Events | Cause attribution, not outage measurement |
| EIA-861 SAIDI/SAIFI | Annual aggregates, wrong granularity |
| PRESTO | Forward-looking simulator, out of v0 scope |

## Validation

- File-level: MD5 verification at download time.
- Coverage: confirm 12 yearly files (2014-2025) plus three auxiliary
  files exist locally before downstream stages run.

## Known limitations

- The 2014 yearly file is partial (starts 2014-11-01). Annualization
  accounts for this — see [A004](../assumptions.md#a004--annualization-denominator-is-the-source-observation-window).
- New EAGLE-I releases (e.g. 2026 data) require re-running this stage and
  re-generating all downstream artifacts. The refresh procedure is in
  `price_engine/REFRESH.md`.

## Implementation pointers

| Aspect | File |
|---|---|
| Downloader | `price_engine/data/01_ingest.py` |
| Inventory description | `price_engine/data/INVENTORY.md` |
| Refresh procedure | `price_engine/REFRESH.md` |

## Cross-references

- [Event Catalog Creation Methodology](event_catalog_creation_methodology.md) — what consumes these files
- `price_engine/ARCHITECTURE.md` §1 (Data source)
