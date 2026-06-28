#!/usr/bin/env python
"""
Build per-county event-series JSONs for the dashboard event-timeseries view, and upload to GCS.

Unlike build_data.py (which writes small bundled JSON into web/lib/data/), this produces ONE file per county
that is too much data to bundle (~7M events across 3,090 counties) — so it is hosted in the private GCS bucket
and served on demand by the /api/county-events route.

  source:  price_engine/data/events.parquet   (the eventized EAGLE-I catalog)
  local:   price_engine/data/county_events/<FIPS>.json   (gitignored build dir)
  bucket:  gs://infrasure-outage-pricing-data/app/county_events/<FIPS>.json   (with --upload)

Each county file is compact:
  {
    "fips": "25001",
    "epoch": "2014-01-01",          # mins are integer offsets from this date (UTC)
    "minDurationH": 2.0,            # only events >= this are included (min trigger; UI filters to >= selected T)
    "cols": ["mins", "durH", "meanCust", "maxCust"],
    "n": 1229,
    "events": [[4082700, 50.5, 74098, 273634], ...]   # sorted by mins ascending
  }

  mins     = whole minutes from 2014-01-01 00:00 (UTC) to the event start (precise → addressable for the 15-min trace)
  durH     = event duration in hours
  meanCust = mean customers out across the event  (THE numerator for the share-out)
  maxCust  = peak customers out during the event

Run:
  .venv/bin/python web/scripts/build_county_events.py            # build locally only
  .venv/bin/python web/scripts/build_county_events.py --upload   # build + rsync to the bucket
"""
import json
import subprocess
import sys
from pathlib import Path

import pandas as pd

REPO = Path(__file__).resolve().parents[2]
SRC = REPO / "price_engine" / "data" / "events.parquet"
OUT = REPO / "price_engine" / "data" / "county_events"
BUCKET = "gs://infrasure-outage-pricing-data/app/county_events"
EPOCH = pd.Timestamp("2014-01-01")
MIN_T = 2.0  # hours — the minimum trigger; UI filters to >= the selected T


def build() -> tuple[int, int]:
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("*.json"):
        f.unlink()  # clear stale

    df = pd.read_parquet(SRC, columns=["fips", "start_time", "duration_hours", "mean_customers", "max_customers"])
    df = df[df["duration_hours"] >= MIN_T].copy()
    df["mins"] = ((df["start_time"] - EPOCH).dt.total_seconds() // 60).astype(int)
    df["durH"] = df["duration_hours"].round(2)
    df["meanC"] = df["mean_customers"].round().astype(int)
    df["maxC"] = df["max_customers"].astype(int)

    n_files = n_events = 0
    for fips, g in df.groupby("fips", sort=True):
        g = g.sort_values("mins")
        events = [[int(mn), float(h), int(mc), int(xc)]
                  for mn, h, mc, xc in g[["mins", "durH", "meanC", "maxC"]].itertuples(index=False)]
        f5 = str(int(fips)).zfill(5)
        obj = {
            "fips": f5,
            "epoch": "2014-01-01",
            "minDurationH": MIN_T,
            "cols": ["mins", "durH", "meanCust", "maxCust"],
            "n": len(events),
            "events": events,
        }
        (OUT / f"{f5}.json").write_text(json.dumps(obj, separators=(",", ":")))
        n_files += 1
        n_events += len(events)
    return n_files, n_events


def main() -> None:
    n_files, n_events = build()
    total_mb = sum(f.stat().st_size for f in OUT.glob("*.json")) / 1e6
    print(f"built {n_files:,} county files · {n_events:,} events (>= {MIN_T}h) · {total_mb:.1f} MB local → {OUT}")
    if "--upload" in sys.argv:
        print(f"uploading → {BUCKET}/ ...")
        subprocess.run(["gcloud", "storage", "rsync", str(OUT), BUCKET], check=True)
        print("upload complete")
    else:
        print("(build-only; pass --upload to push to the bucket)")


if __name__ == "__main__":
    main()
