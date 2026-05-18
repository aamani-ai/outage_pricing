"""
05_price.py — compute the v0 premium grid per FIPS.

Reads:
  - price_engine/data/county_summary.parquet      (for n_per_year per FIPS)
  - price_engine/data/county_durations.parquet    (for S(T) per FIPS)
  - price_engine/filtration/county_tiers.csv      (to mask out red counties)

Writes:
  - price_engine/pricing/county_premiums.csv      long form: (fips, T, X, pure, retail)
  - price_engine/pricing/county_drilldown.json    per-FIPS dict for dashboard

Pricing math (see plan/02_pricing_math.md):
  N_per_year(FIPS) = n_events_total(FIPS) / observation_years(FIPS)
  S(T) = #{events with duration >= T} / #{events}
  lambda(T) = N_per_year * S(T)
  PurePremium = lambda(T) * X
  RetailPremium = (PurePremium + UncertaintyLoad) / (1 - ExpenseRatio - TargetMargin)

v0 standard grid:
  T in {2, 4, 8, 12, 24} hours
  X in {500, 1000, 2500, 5000, 10000} dollars

Loads (v0 stub values, see plan/04_confidence_load_stub.md):
  UncertaintyLoad = 0       (interface-only in v0; real values in v0.5)
  ExpenseRatio    = 0.20
  TargetMargin    = 0.15

Red-tier counties are computed but flagged with `quotable=False`.

Usage:
    python 05_price.py
    python 05_price.py --summary ../catalogs/eagle-i-45min/data/county_summary.parquet
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
SUMMARY = HERE.parent / "data" / "county_summary.parquet"
DURATIONS = HERE.parent / "data" / "county_durations.parquet"
TIERS = HERE.parent / "filtration" / "county_tiers.csv"

OUT_CSV = HERE / "county_premiums.csv"
OUT_JSON = HERE / "county_drilldown.json"

T_GRID = [2, 4, 8, 12, 24]                # hours
X_GRID = [500, 1000, 2500, 5000, 10000]   # dollars

UNCERTAINTY_LOAD = 0.0
EXPENSE_RATIO = 0.20
TARGET_MARGIN = 0.15
LOAD_DENOM = 1.0 - EXPENSE_RATIO - TARGET_MARGIN  # 0.65


def s_of_t(durations: np.ndarray, T: float) -> float:
    if durations.size == 0:
        return 0.0
    return float((durations >= T).sum()) / float(durations.size)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--summary", type=Path, default=SUMMARY)
    parser.add_argument("--durations", type=Path, default=DURATIONS)
    parser.add_argument("--tiers", type=Path, default=TIERS)
    parser.add_argument("--out-csv", type=Path, default=OUT_CSV)
    parser.add_argument("--out-json", type=Path, default=OUT_JSON)
    args = parser.parse_args()

    for p in (args.summary, args.durations, args.tiers):
        if not p.exists():
            print(f"[fail] missing {p}; run upstream scripts first", flush=True)
            return 1

    summary = pd.read_parquet(args.summary)
    durations = pd.read_parquet(args.durations)
    tiers = pd.read_csv(args.tiers)
    print(f"[load] {len(summary):,} FIPS summary; {len(durations):,} event rows; {len(tiers):,} tier rows",
          flush=True)

    summary["fips"] = summary["fips"].astype("int64")
    durations["fips"] = durations["fips"].astype("int64")
    tiers["fips"] = tiers["fips"].astype("int64")

    # Index durations by FIPS for fast S(T) lookup
    durations_by_fips: dict[int, np.ndarray] = {
        int(f): g["duration_hours"].to_numpy()
        for f, g in durations.groupby("fips", sort=False)
    }

    tier_by_fips = dict(zip(tiers["fips"], tiers["tier"]))

    rows = []
    drilldown: dict[str, dict] = {}

    for _, county in summary.iterrows():
        fips = int(county["fips"])
        n_per_year = county["n_per_year"]
        if pd.isna(n_per_year) or n_per_year <= 0:
            continue

        durs = durations_by_fips.get(fips, np.array([]))
        tier = tier_by_fips.get(fips, "red")
        quotable = (tier in ("green", "amber"))

        per_T = {}
        for T in T_GRID:
            sT = s_of_t(durs, T)
            lamT = n_per_year * sT
            per_T[T] = {"S_T": sT, "lambda_T": lamT, "X": {}}
            for X in X_GRID:
                pure = lamT * X
                retail = (pure + UNCERTAINTY_LOAD) / LOAD_DENOM
                per_T[T]["X"][X] = {"pure": pure, "retail": retail}
                rows.append({
                    "fips": fips,
                    "state": county["state"],
                    "county": county["county"],
                    "tier": tier,
                    "quotable": quotable,
                    "T_hours": T,
                    "X_dollars": X,
                    "n_per_year": n_per_year,
                    "S_T": sT,
                    "lambda_T": lamT,
                    "pure_premium": pure,
                    "retail_premium": retail,
                })

        drilldown[str(fips)] = {
            "state": county["state"],
            "county": county["county"],
            "tier": tier,
            "quotable": quotable,
            "n_events_total": int(county["n_events_total"]),
            "observation_years": float(county["observation_years"]) if pd.notna(county["observation_years"]) else None,
            "n_per_year": float(n_per_year),
            "mcc": (float(county["mcc"]) if pd.notna(county["mcc"]) else None),
            "duration_p50": float(county["duration_p50"]),
            "duration_p95": float(county["duration_p95"]),
            "duration_max": float(county["duration_max"]),
            "grid": per_T,
        }

    out_df = pd.DataFrame(rows)
    args.out_csv.parent.mkdir(parents=True, exist_ok=True)
    out_df.to_csv(args.out_csv, index=False)
    print(f"[save] {args.out_csv} ({len(out_df):,} rows)", flush=True)

    args.out_json.parent.mkdir(parents=True, exist_ok=True)
    with args.out_json.open("w") as fh:
        json.dump(drilldown, fh)
    print(f"[save] {args.out_json} ({len(drilldown):,} FIPS)", flush=True)

    return 0


if __name__ == "__main__":
    sys.exit(main())
