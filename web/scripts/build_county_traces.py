#!/usr/bin/env python
"""
Build per-county-per-year RAW 15-minute outage traces for the dashboard event drill-down, and upload to GCS.

The County-explorer drill-down shows one event's raw 15-min customers-out shape (ramp · plateau · restoration).
That 15-min granularity exists only in the raw EAGLE-I snapshots (events.parquet is already eventized), and the
raw CSVs are ~11 GB — far too big to bake into the deployed image. So we slice the raw into small per-county-per-year
files hosted in the private lake and served on demand by /api/event-trace (mirrors build_county_events.py).

  source:  price_engine/data/raw/eaglei_outages_<year>.csv   (raw EAGLE-I snapshots; must be present locally)
  local:   price_engine/data/county_traces/<FIPS>/<year>.json   (gitignored build dir)
  bucket:  gs://infrasure-outage-pricing-data/app/county_traces/<FIPS>/<year>.json   (with --upload)

Per-year-per-county file is compact:
  {"fips":"12001","year":2024,"epoch":"2014-01-01","cols":["mins","out"],"n":21414,"rows":[[5647140,5],[5647155,5],...]}
    mins = whole minutes from 2014-01-01 00:00 (UTC) to the snapshot   (same epoch as county_events `mins`)
    out  = customers_out at that snapshot   (empty/NaN in the raw → 0)
  rows sorted by mins ascending.

The route is given an event's (startMin, durH); it loads the year file(s) the window touches and filters
rows to [startMin, startMin + durH*60 + 15].  Per-county-per-year keeps each fetch small (a hurricane-heavy
county-year is ~0.4 MB) and the server cache memory-bounded.

Run:
  .venv/bin/python web/scripts/build_county_traces.py --year 2024          # one year, local only (smoke)
  .venv/bin/python web/scripts/build_county_traces.py                      # all years, local only
  .venv/bin/python web/scripts/build_county_traces.py --upload             # all years, build + rsync to the bucket
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pandas as pd

REPO = Path(__file__).resolve().parents[2]
RAW = REPO / "price_engine" / "data" / "raw"
OUT = REPO / "price_engine" / "data" / "county_traces"
BUCKET = "gs://infrasure-outage-pricing-data/app/county_traces"
EPOCH = pd.Timestamp("2014-01-01")
YEARS = list(range(2014, 2026))


def build_year(year: int) -> tuple[int, int]:
    """Slice one raw year file into per-county trace JSONs. Returns (n_county_files, n_rows)."""
    src = RAW / f"eaglei_outages_{year}.csv"
    if not src.exists():
        print(f"[skip] {src.name} not present", flush=True)
        return 0, 0

    # Read by POSITION, not name: the value column is the 4th in every year but is named "customers_out"
    # in most years and "sum" in 2023; 2024 also adds a trailing total_customers column. Columns 0/3/4
    # (fips / value / run_start_time) are stable across all years, so positional usecols is the robust read.
    df = pd.read_csv(src, usecols=[0, 3, 4], dtype=str)
    df.columns = ["fips_code", "out_raw", "run_start_time"]
    df["mins"] = ((pd.to_datetime(df["run_start_time"]) - EPOCH).dt.total_seconds() // 60).astype("int64")
    df["out"] = pd.to_numeric(df["out_raw"], errors="coerce").fillna(0).astype("int64")

    n_files = n_rows = 0
    for fips, g in df.groupby("fips_code", sort=True):
        f5 = str(fips).zfill(5)
        g = g.sort_values("mins")
        rows = [[int(mn), int(o)] for mn, o in g[["mins", "out"]].itertuples(index=False)]
        obj = {
            "fips": f5,
            "year": year,
            "epoch": "2014-01-01",
            "cols": ["mins", "out"],
            "n": len(rows),
            "rows": rows,
        }
        d = OUT / f5
        d.mkdir(parents=True, exist_ok=True)
        (d / f"{year}.json").write_text(json.dumps(obj, separators=(",", ":")))
        n_files += 1
        n_rows += len(rows)
    print(f"[year] {year}: {n_files:,} counties · {n_rows:,} snapshots", flush=True)
    return n_files, n_rows


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--year", type=int, action="append", help="build only this year (repeatable); default all")
    ap.add_argument("--upload", action="store_true", help="rsync the built traces to the bucket")
    ap.add_argument("--keep", action="store_true", help="do not clear the local build dir first")
    args = ap.parse_args()

    years = args.year or YEARS
    if OUT.exists() and not args.keep:
        shutil.rmtree(OUT)  # clear stale slices
    OUT.mkdir(parents=True, exist_ok=True)

    total_files = total_rows = 0
    for y in years:
        nf, nr = build_year(y)
        total_files += nf
        total_rows += nr

    total_mb = sum(f.stat().st_size for f in OUT.rglob("*.json")) / 1e6
    print(f"built {total_files:,} county-year files · {total_rows:,} snapshots · {total_mb:.1f} MB local → {OUT}", flush=True)

    if args.upload:
        print(f"uploading → {BUCKET}/ ...", flush=True)
        subprocess.run(["gcloud", "storage", "rsync", "--recursive", str(OUT), BUCKET], check=True)
        print("upload complete", flush=True)
    else:
        print("(build-only; pass --upload to push to the bucket)", flush=True)


if __name__ == "__main__":
    main()
