# Refresh & Re-Run Guide

This is the guide for **(a)** filling in the years we couldn't fit during the first run, **(b)** re-running the full pipeline locally, and **(c)** picking up new EAGLE-I data when Figshare publishes it.

If you have not read `END_TO_END.md`, read that first. This repo has now completed the full local 2014-2025 run once; this guide remains the re-run/refresh procedure.

---

## TL;DR — the happy path

You have a machine with ≥ 25 GB free disk and ≥ 16 GB RAM. You want the full 12 years.

```bash
cd outage_modeling_us/price_engine
bash run_all.sh
```

That's it. The pipeline is idempotent at every stage:

- `01_ingest.py` checks each Figshare file's size + md5 against your local `data/raw/` and skips matches.
- `02..05` overwrite their outputs in place.

Already-downloaded years are **not re-fetched**. Already-correct outputs are simply rebuilt with the larger input.

---

## What "the missing data" means

Historical note: the earlier reference run downloaded only `eaglei_outages_2023.csv`, `eaglei_outages_2024.csv`, and `eaglei_outages_2025.csv` before disk ran out. The promoted local repo has now downloaded all 12 years.

The ingest script's `YEARS` list **already covers 2014..2025**. Re-running it on this machine will skip already-verified files and only download anything missing or changed.

To verify what you have:

```bash
ls -lh price_engine/data/raw/eaglei_outages_*.csv
```

You should see 12 files.

---

## Resource budget

| Resource | Per year (max) | Full 12-year run (peak) | Notes |
|---|---|---|---|
| Disk — raw CSVs | ~1.0 GB | ~11.5 GB | EAGLE-I yearly files are ~1 GB each uncompressed |
| Disk — derived outputs | — | ~600 MB | `events.parquet` (84 MB at 3 yr → ~350 MB at 12 yr), `county_durations.parquet` (long-form), drilldown.json |
| RAM — stage 02 | ~3 GB | ~3 GB | We refactored to process one year at a time. Do not regress this. |
| RAM — stages 03/04/05 | < 2 GB | < 2 GB | Aggregations only |
| Wall time | ~60-90 s/yr | ~15-20 min | Mostly Figshare download + event construction |

**The single hard constraint is disk.** Stage 02 is RAM-bounded at one year, so a 16 GB machine handles all 12.

---

## Step-by-step on a bigger machine

### 1. Verify environment

```bash
python --version          # 3.11+
pip install pyarrow pandas requests
df -h .                   # need ≥ 25 GB free
```

### 2. Pull the repo and the existing outputs

```bash
git clone https://github.com/d14847300-tech/outage_modeling_us.git
cd outage_modeling_us
```

Note: `data/raw/eaglei_outages_*.csv` is **gitignored**. You will not see the 3 yearly files we already downloaded — re-fetch them from Figshare with the ingest script (it's idempotent and md5-verified).

### 3. Run the full pipeline

```bash
bash price_engine/run_all.sh
```

Expected console output for stage 01 with no files present:

```
[meta] GET https://api.figshare.com/v2/articles/24237376
[get ] DQI.csv (attempt 1/4, ... bytes)
[get ] MCC.csv (attempt 1/4, ... bytes)
[get ] coverage_history.csv (attempt 1/4, ... bytes)
[get ] eaglei_outages_2014.csv (attempt 1/4, ... bytes)
...
[get ] eaglei_outages_2025.csv (attempt 1/4, ... bytes)
```

With some files already present:

```
[skip] eaglei_outages_2023.csv (size+md5 match)
[skip] eaglei_outages_2024.csv (size+md5 match)
[skip] eaglei_outages_2025.csv (size+md5 match)
[get ] eaglei_outages_2014.csv (attempt 1/4, ...)
[get ] eaglei_outages_2015.csv (attempt 1/4, ...)
...
```

### 4. Sanity-check the outputs

```bash
python -c "
import json
m = json.load(open('price_engine/data/events_meta.json'))
print('Years processed:', m['years_processed'])
print('Total events  :', f\"{m['n_events_out']:,}\")
print('Duration p50  :', m['duration_stats_hours']['p50'], 'h')
print('Duration p95  :', m['duration_stats_hours']['p95'], 'h')
"
```

With the current full local run, `events_meta.json` reports 14,195,144 events across 3,090 FIPS.

```bash
awk -F',' 'NR>1 {print $2}' price_engine/filtration/county_tiers.csv | sort | uniq -c
```

The green count should rise with the full ingest. D3 now uses the raw source exposure window, so the full 2014-2025 release passes D3 for every county.

### 5. Serve the dashboard locally

```bash
cd price_engine
python -m http.server 8000
```

Then open [http://127.0.0.1:8000/dashboard/](http://127.0.0.1:8000/dashboard/).

The dashboard reads `../pricing/county_drilldown.json` and `../filtration/county_tiers.csv` so it must be served from one level **above** `dashboard/`.

---

## Refreshing when Figshare publishes a new year

Once 2026 lands on Figshare:

1. Bump `YEARS` in `data/01_ingest.py`:
   ```python
   YEARS = list(range(2014, 2027))
   ```
2. Re-run `bash run_all.sh`. Everything else is automatic.

If Figshare republishes an existing year (e.g. a 2024 correction), the md5 will differ from your local file. The ingest script logs `[redo]` and re-downloads.

---

## Forcing a clean re-run

To force re-download of every file:

```bash
rm -rf price_engine/data/raw
bash price_engine/run_all.sh
```

To force regeneration of derived files without re-fetching:

```bash
rm price_engine/data/events.parquet
rm price_engine/data/county_summary.parquet
rm price_engine/data/county_durations.parquet
rm price_engine/filtration/county_tiers.csv
rm price_engine/pricing/county_premiums.csv
rm price_engine/pricing/county_drilldown.json
bash price_engine/run_all.sh
```

---

## Known issues you may hit

| Symptom | Cause | Fix |
|---|---|---|
| `[redo] X size mismatch` repeats forever | A `.part` file from an aborted download is in the way | `rm price_engine/data/raw/*.part` |
| Stage 02 OOM-killed | Trying to load all years at once | Confirm `02_construct_events.py` still has the per-year loop (look for `for year in YEARS:` in `main()`). Do not regress to a single concat. |
| `KeyError: 'customers_out'` on stage 02 | 2023 schema uses `sum`, not `customers_out` | The script has a rename guard. If you removed it, restore it: `df = df.rename(columns={'sum': 'customers_out'})` |
| Stage 03 fails on `'Grand Total'` | MCC.csv footer row | Already handled with `pd.to_numeric(errors='coerce')` then dropna. Do not regress. |
| All counties amber/red on D3 | Too few source years in the processed run | Expected with < 5 source years. Run the full ingest. |
| Dashboard 404 on JSON | Server not pointed at `price_engine/`, or you opened the file via `file://` | Serve from `price_engine/` and visit `/dashboard/` |

---

## What changes when you have 12 years vs. 3

| | Prior 3-year reference run | Current 12-year local run |
|---|---|---|
| Total events | 4.4 M | 14.2 M |
| Observation window | partial source window | 11.167 source years; all counties pass D3 |
| Green counties | 931 | 952 in the 30-minute catalog; 951 in the default 45-minute catalog |
| Tail estimates (p95) | Noisier | More stable |
| Premiums | Already in the right order of magnitude | Tighter confidence; v0.5 uncertainty load shrinks |

The full ingest did not move most counties from Amber to Green because the implemented D5 DQI gate now dominates the tier mix. Treat that as a v0.5 calibration item, not a reason to tune coverage thresholds downward.

---

## Cross-refs

- `END_TO_END.md` — the high-level flow
- `data/01_ingest.py` — the YEARS constant lives here
- `data/02_construct_events.py` — per-year processing loop
- `run_all.sh` — the one-shot driver
