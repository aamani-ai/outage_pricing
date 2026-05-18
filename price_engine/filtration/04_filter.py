"""
04_filter.py — assign each FIPS a tier (green / amber / red) based on modelability.

Reads:  price_engine/data/county_summary.parquet
Writes: price_engine/filtration/county_tiers.csv

Filtration is about MODELABILITY, not about loss severity. A high-outage county
isn't red because it's expensive — it's green/amber/red based on whether we
have enough data to price it credibly.

D-tier criteria (see plan/03_filtration_framework.md):

  D1  volume:           n_events_total          GREEN >=200, AMBER >=50, else RED
  D2  events/year:      n_per_year              GREEN >=20,  AMBER >=5,  else RED
  D3  source window:    observation_years       GREEN >=5,   AMBER >=3,  else RED
  D4  tail credibility: duration_p95            AMBER if < 2h (deductible floor)
  D5  data quality:     DQI                     RED if DQI flags critical (if present)

The county's overall tier is the WORST of D1..D5.

Usage:
    python 04_filter.py
    python 04_filter.py --summary ../catalogs/eagle-i-45min/data/county_summary.parquet
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
SUMMARY = HERE.parent / "data" / "county_summary.parquet"
OUT_TIERS = HERE / "county_tiers.csv"

TIER_RANK = {"green": 0, "amber": 1, "red": 2}
RANK_TIER = {v: k for k, v in TIER_RANK.items()}


def tier_from_thresholds(value, green_min, amber_min) -> str:
    if pd.isna(value):
        return "red"
    if value >= green_min:
        return "green"
    if value >= amber_min:
        return "amber"
    return "red"


def worst(tiers: list[str]) -> str:
    return RANK_TIER[max(TIER_RANK[t] for t in tiers)]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--summary", type=Path, default=SUMMARY)
    parser.add_argument("--out", type=Path, default=OUT_TIERS)
    args = parser.parse_args()

    if not args.summary.exists():
        print(f"[fail] {args.summary} not found; run 03_aggregate_county.py first", flush=True)
        return 1
    df = pd.read_parquet(args.summary)
    print(f"[load] {len(df):,} FIPS", flush=True)

    df["d1_volume"]    = df["n_events_total"].apply(lambda v: tier_from_thresholds(v, 200, 50))
    df["d2_per_year"]  = df["n_per_year"].apply(lambda v: tier_from_thresholds(v, 20, 5))
    df["d3_obs_years"] = df["observation_years"].apply(lambda v: tier_from_thresholds(v, 5, 3))

    # D4: tail credibility. p95 must reach into the deductible range or we can't price T=2h.
    def d4(p95):
        if pd.isna(p95):
            return "red"
        if p95 >= 4:
            return "green"
        if p95 >= 2:
            return "amber"
        return "red"
    df["d4_tail"] = df["duration_p95"].apply(d4)

    # D5: DQI. The aggregate stage normalizes the source 0-100 values to 0-1.
    # NaN is neutral because D1-D4 already catch observed-data gaps.
    def d5(dqi):
        if pd.isna(dqi):
            return "green"  # treat unknown as not-a-blocker; D1..D3 will catch real gaps
        # placeholder thresholds — refine once DQI scale is verified
        if dqi >= 0.8:
            return "green"
        if dqi >= 0.5:
            return "amber"
        return "red"
    df["d5_dqi"] = df["dqi"].apply(d5)

    df["tier"] = df[["d1_volume", "d2_per_year", "d3_obs_years", "d4_tail", "d5_dqi"]].apply(
        lambda row: worst(row.tolist()), axis=1
    )

    out = df[[
        "fips", "state", "county",
        "n_events_total", "n_per_year", "observation_years",
        "duration_p95", "dqi",
        "d1_volume", "d2_per_year", "d3_obs_years", "d4_tail", "d5_dqi",
        "tier",
    ]]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(args.out, index=False)
    print(f"[save] {args.out}", flush=True)

    counts = out["tier"].value_counts().to_dict()
    print(f"[stat] tier distribution: {counts}", flush=True)

    return 0


if __name__ == "__main__":
    sys.exit(main())
