"""
05_price.py — compute the v0 premium grid per FIPS.

Reads:
  - price_engine/data/county_summary.parquet      (for n_per_year per FIPS)
  - price_engine/data/county_durations.parquet    (for S(T) per FIPS)
  - price_engine/filtration/county_tiers.csv      (to mask out red counties)
  - price_engine/data/events.parquet              (for per-county evidence files)

Writes:
  - price_engine/pricing/county_premiums.csv      long form: (fips, T, X, pure, retail)
  - price_engine/pricing/county_drilldown.json    per-FIPS dict for dashboard
  - price_engine/pricing/event_evidence/{FIPS}.json
                                                    compact top-event evidence by county

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
import sys
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "price_engine"))
from core import gcs_io, data_paths  # noqa: E402 — inputs resolve local↔GCS via OUTAGE_PRICING_DATA_ROOT

SUMMARY = data_paths.resolve("price_engine/data/county_summary.parquet")
DURATIONS = data_paths.resolve("price_engine/data/county_durations.parquet")
TIERS = data_paths.resolve("price_engine/filtration/county_tiers.csv")
EVENTS = data_paths.resolve("price_engine/data/events.parquet")

OUT_CSV = data_paths.resolve("price_engine/pricing/county_premiums.csv")
OUT_JSON = data_paths.resolve("price_engine/pricing/county_drilldown.json")
OUT_EVIDENCE_DIR = data_paths.resolve("price_engine/pricing/event_evidence")

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


def clean_float(value, digits: int | None = None):
    if pd.isna(value):
        return None
    value = float(value)
    return round(value, digits) if digits is not None else value


def write_event_evidence(
    events_path: Path,
    out_dir: Path,
    drilldown: dict[str, dict],
    max_rows: int,
) -> None:
    """Write compact per-county event evidence files for static dashboard fetches.

    The national event table is too large for the browser. Each county file keeps
    the longest events only, plus exact threshold summaries from the pricing grid.
    """
    if max_rows <= 0:
        print("[skip] event evidence disabled because max rows <= 0", flush=True)
        return

    columns = [
        "event_id", "fips", "state", "county",
        "start_time", "end_time", "duration_hours",
        "n_snapshots", "min_customers", "max_customers", "mean_customers", "year",
    ]
    events = gcs_io.read_parquet(events_path, columns=columns)
    events["fips"] = events["fips"].astype("int64")
    print(f"[load] {len(events):,} events for evidence table", flush=True)

    # Keep files compact: table rows are evidence examples, not a full event dump.
    top = (
        events
        .sort_values(
            ["fips", "duration_hours", "max_customers", "start_time"],
            ascending=[True, False, False, False],
            kind="mergesort",
        )
        .groupby("fips", sort=False)
        .head(max_rows)
    )
    del events

    written = 0
    for fips, group in top.groupby("fips", sort=False):
        key = str(int(fips))
        county = drilldown.get(key)
        if not county:
            continue

        mcc = county.get("mcc")
        observation_years = county.get("observation_years")
        rows = []
        for rank, (_, event) in enumerate(group.iterrows(), start=1):
            max_customers = clean_float(event["max_customers"], 0)
            rows.append({
                "rank_by_duration": rank,
                "event_id": str(event["event_id"]),
                "start_time_utc": event["start_time"].isoformat(),
                "end_time_utc": event["end_time"].isoformat(),
                "year": int(event["year"]),
                "duration_hours": clean_float(event["duration_hours"], 3),
                "n_snapshots": int(event["n_snapshots"]),
                "min_customers_out": int(event["min_customers"]),
                "max_customers_out": int(event["max_customers"]),
                "mean_customers_out": clean_float(event["mean_customers"], 3),
                "peak_out_pct_mcc": (
                    clean_float(float(max_customers) / float(mcc), 6)
                    if mcc and max_customers is not None and float(mcc) > 0
                    else None
                ),
            })

        threshold_summary = {}
        for T in T_GRID:
            cell = county["grid"][T]
            qualifying = int(round(float(cell["S_T"]) * int(county["n_events_total"])))
            threshold_summary[str(T)] = {
                "qualifying_events": qualifying,
                "S_T": clean_float(cell["S_T"], 8),
                "lambda_T": clean_float(cell["lambda_T"], 8),
            }

        record = {
            "fips": key,
            "state": county["state"],
            "county": county["county"],
            "tier": county["tier"],
            "quotable": county["quotable"],
            "n_events_total": int(county["n_events_total"]),
            "observation_years": clean_float(observation_years, 8),
            "mcc": clean_float(mcc, 3),
            "rows_policy": f"top_{max_rows}_longest_events",
            "rows_returned": len(rows),
            "threshold_summary": threshold_summary,
            "events": rows,
        }
        gcs_io.write_json(record, f"{out_dir}/{key}.json", separators=(",", ":"))
        written += 1

    print(f"[save] {out_dir} ({written:,} county files; top {max_rows} events each)", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--summary", default=SUMMARY)
    parser.add_argument("--durations", default=DURATIONS)
    parser.add_argument("--tiers", default=TIERS)
    parser.add_argument("--events", default=EVENTS)
    parser.add_argument("--out-csv", default=OUT_CSV)
    parser.add_argument("--out-json", default=OUT_JSON)
    parser.add_argument("--out-evidence-dir", default=OUT_EVIDENCE_DIR)
    parser.add_argument("--evidence-max-rows", type=int, default=200)
    parser.add_argument("--skip-evidence", action="store_true")
    args = parser.parse_args()

    required = [args.summary, args.durations, args.tiers]
    if not args.skip_evidence:
        required.append(args.events)
    for p in required:
        if not gcs_io.exists(p):
            print(f"[fail] missing {p}; run upstream scripts first", flush=True)
            return 1

    summary = gcs_io.read_parquet(args.summary)
    durations = gcs_io.read_parquet(args.durations)
    tiers = gcs_io.read_csv(args.tiers)
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
    gcs_io.write_csv(out_df, args.out_csv, index=False)
    print(f"[save] {args.out_csv} ({len(out_df):,} rows)", flush=True)

    gcs_io.write_json(drilldown, args.out_json, separators=(", ", ": "))
    print(f"[save] {args.out_json} ({len(drilldown):,} FIPS)", flush=True)

    if not args.skip_evidence:
        write_event_evidence(
            events_path=args.events,
            out_dir=args.out_evidence_dir,
            drilldown=drilldown,
            max_rows=args.evidence_max_rows,
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
