"""
02_construct_events.py - turn 15-min EAGLE-I snapshots into events.

Reads:  price_engine/data/raw/eaglei_outages_YYYY.csv (per --years)
Writes: price_engine/data/events.parquet
        price_engine/data/events_meta.json  (run summary, knob values)

Algorithm (see EVENT_CONSTRUCTION.md):
  Per FIPS:
    1. Load snapshots for one year, filter customers_out > THRESHOLD.
    2. Sort by FIPS and timestamp, dropping duplicate FIPS/timestamp rows.
    3. Walk each FIPS stream; gap <= GAP_TOLERANCE extends event, else split.
    4. Keep one open event per FIPS across yearly files so New Year seams are
       stitched without loading all 12 years at once.
    5. Write completed events to parquet year by year.

Output schema:
  event_id, fips, state, county, start_time, end_time, duration_hours,
  n_snapshots, min_customers, max_customers, mean_customers, year

Usage:
    python 02_construct_events.py                          # all years 2014-2025
    python 02_construct_events.py --years 2023 2024 2025   # subset
    python 02_construct_events.py --sample-fips 5          # smoke test
    python 02_construct_events.py --gap-tolerance-minutes 45
"""

from __future__ import annotations

import argparse
import gc
import sys
import time
from datetime import timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "price_engine"))
from core import gcs_io, data_paths  # noqa: E402 — inputs resolve local↔GCS via OUTAGE_PRICING_DATA_ROOT

# --- knobs (documented in EVENT_CONSTRUCTION.md) ---------------------------
GAP_TOLERANCE = timedelta(minutes=30)
THRESHOLD = 0
MIN_DURATION = timedelta(minutes=15)
SNAPSHOT_INTERVAL = timedelta(minutes=15)
SOURCE_TIMEZONE = "UTC"
PARQUET_TIME_CONVENTION = "timezone-naive UTC"
# ---------------------------------------------------------------------------

HERE = Path(__file__).resolve().parent
OUT_PARQUET = data_paths.resolve("price_engine/data/events.parquet")
OUT_META = data_paths.resolve("price_engine/data/events_meta.json")


def raw_path(year: int) -> str:
    """Resolve one year's raw EAGLE-I snapshot CSV (local path or gs:// URI)."""
    return data_paths.resolve(f"price_engine/data/raw/eaglei_outages_{year}.csv")

YEARS = list(range(2014, 2026))

GAP_TOLERANCE_NS = np.int64(GAP_TOLERANCE.total_seconds() * 1e9)
MIN_DURATION_S = MIN_DURATION.total_seconds()
SNAPSHOT_INTERVAL_NS = np.int64(SNAPSHOT_INTERVAL.total_seconds() * 1e9)

ROW_COLUMNS = [
    "fips", "start_ns", "end_ns", "n_snapshots", "min_customers",
    "max_customers", "sum_customers", "duration_s", "state", "county",
]
EVENT_COLUMNS = [
    "event_id", "fips", "state", "county",
    "start_time", "end_time", "duration_hours", "n_snapshots",
    "min_customers", "max_customers", "mean_customers", "year",
]


def load_year(year: int) -> pd.DataFrame:
    """Load one year's snapshots. Handles schema differences across years."""
    path = raw_path(year)
    name = str(path).rsplit("/", 1)[-1]
    if not gcs_io.exists(path):
        print(f"[warn] missing {name}; skipping year {year}", flush=True)
        return pd.DataFrame()

    print(f"[load] {name}", flush=True)
    usecols_options = [
        ["fips_code", "county", "state", "customers_out", "run_start_time"],
        ["fips_code", "county", "state", "sum", "run_start_time"],
    ]
    df = None
    for cols in usecols_options:
        try:
            df = gcs_io.read_csv(
                path,
                usecols=cols,
                parse_dates=["run_start_time"],
                low_memory=False,
            )
            break
        except (ValueError, KeyError):
            continue
    if df is None:
        raise RuntimeError(f"{name}: could not match expected schema")

    if "customers_out" not in df.columns and "sum" in df.columns:
        df = df.rename(columns={"sum": "customers_out"})

    # Source CSV timestamps have no explicit offset. v0 treats them as UTC and
    # stores timezone-naive UTC in parquet for compatibility with current outputs.
    df["run_start_time"] = pd.to_datetime(
        df["run_start_time"], errors="coerce", utc=True
    ).dt.tz_convert(None)
    df["customers_out"] = pd.to_numeric(df["customers_out"], errors="coerce")
    df = df.dropna(subset=["fips_code", "run_start_time", "customers_out"])
    df["fips_code"] = df["fips_code"].astype("int32")
    df["customers_out"] = df["customers_out"].astype("int32")
    df = df[df["customers_out"] > THRESHOLD]
    if df.empty:
        return df

    df = df.sort_values(["fips_code", "run_start_time"], kind="mergesort")
    df = df.drop_duplicates(["fips_code", "run_start_time"], keep="last")
    return df


def new_state(time_ns: int, customers_out: int, state: str, county: str) -> dict:
    return {
        "start_ns": int(time_ns),
        "last_ns": int(time_ns),
        "n_snapshots": 1,
        "min_customers": int(customers_out),
        "max_customers": int(customers_out),
        "sum_customers": int(customers_out),
        "state": state,
        "county": county,
    }


def extend_state(st: dict, time_ns: int, customers_out: int, state: str, county: str) -> None:
    st["last_ns"] = int(time_ns)
    st["n_snapshots"] += 1
    st["min_customers"] = min(st["min_customers"], int(customers_out))
    st["max_customers"] = max(st["max_customers"], int(customers_out))
    st["sum_customers"] += int(customers_out)
    st["state"] = state
    st["county"] = county


def close_state(fips: int, st: dict) -> tuple | None:
    end_ns = int(st["last_ns"]) + int(SNAPSHOT_INTERVAL_NS)
    dur_s = (end_ns - int(st["start_ns"])) / 1e9
    if dur_s < MIN_DURATION_S:
        return None
    return (
        int(fips),
        int(st["start_ns"]),
        int(end_ns),
        int(st["n_snapshots"]),
        int(st["min_customers"]),
        int(st["max_customers"]),
        int(st["sum_customers"]),
        float(dur_s),
        st["state"],
        st["county"],
    )


def process_fips_group(
    fips: int,
    state_name: str,
    county_name: str,
    times_ns: np.ndarray,
    customers_out: np.ndarray,
    carry: dict[int, dict],
) -> list[tuple]:
    """Process one FIPS stream and keep its final event open in carry."""
    rows: list[tuple] = []
    st = carry.pop(fips, None)

    for time_ns, cust in zip(times_ns, customers_out, strict=True):
        time_ns_i = int(time_ns)
        cust_i = int(cust)
        if st is None:
            st = new_state(time_ns_i, cust_i, state_name, county_name)
            continue

        gap = np.int64(time_ns_i) - np.int64(st["last_ns"])
        if gap <= GAP_TOLERANCE_NS:
            extend_state(st, time_ns_i, cust_i, state_name, county_name)
        else:
            closed = close_state(fips, st)
            if closed is not None:
                rows.append(closed)
            st = new_state(time_ns_i, cust_i, state_name, county_name)

    if st is not None:
        carry[fips] = st
    return rows


def rows_to_events(rows: list[tuple]) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame(columns=EVENT_COLUMNS)

    ev = pd.DataFrame(rows, columns=ROW_COLUMNS)
    ev["start_time"] = pd.to_datetime(ev["start_ns"], unit="ns", utc=True).dt.tz_convert(None)
    ev["end_time"] = pd.to_datetime(ev["end_ns"], unit="ns", utc=True).dt.tz_convert(None)
    ev["duration_hours"] = ev["duration_s"] / 3600.0
    ev["mean_customers"] = ev["sum_customers"] / ev["n_snapshots"]
    ev["year"] = ev["start_time"].dt.year.astype("int16")
    ev["event_id"] = ev["fips"].astype(str) + "_" + ev["start_time"].dt.strftime("%Y%m%dT%H%M%S")
    return ev[EVENT_COLUMNS]


def process_year(year: int, carry: dict[int, dict], sample_fips: int | None = None) -> pd.DataFrame:
    """Process one year and return only events that closed during this pass."""
    df = load_year(year)
    if df.empty:
        return pd.DataFrame(columns=EVENT_COLUMNS)

    if sample_fips:
        fips_keep = df["fips_code"].drop_duplicates().head(sample_fips).tolist()
        df = df[df["fips_code"].isin(fips_keep)]
        print(f"[smoke] limited to {len(fips_keep)} FIPS", flush=True)

    all_rows: list[tuple] = []
    t1 = time.time()
    times_arr = df["run_start_time"].values.astype("datetime64[ns]").view("int64")
    cust_arr = df["customers_out"].values
    fips_arr = df["fips_code"].values
    state_arr = df["state"].values
    county_arr = df["county"].values

    n = len(fips_arr)
    if n == 0:
        return pd.DataFrame(columns=EVENT_COLUMNS)

    starts = np.r_[0, np.where(np.diff(fips_arr) != 0)[0] + 1, n]
    n_groups = len(starts) - 1
    for gi in range(n_groups):
        a, b = starts[gi], starts[gi + 1]
        fips = int(fips_arr[a])
        rows = process_fips_group(
            fips=fips,
            state_name=str(state_arr[a]),
            county_name=str(county_arr[a]),
            times_ns=times_arr[a:b],
            customers_out=cust_arr[a:b],
            carry=carry,
        )
        all_rows.extend(rows)
        if gi % 500 == 0 and gi > 0:
            print(f"[walk] {year}: {gi}/{n_groups} FIPS, {len(all_rows):,} closed events", flush=True)

    print(
        f"[walk] {year}: {n_groups} FIPS done in {time.time() - t1:.1f}s, "
        f"{len(all_rows):,} closed events, {len(carry):,} open seams",
        flush=True,
    )

    del df, times_arr, cust_arr, fips_arr, state_arr, county_arr
    gc.collect()
    return rows_to_events(all_rows)


def _open_parquet_sink(out_path: str, schema: pa.Schema) -> tuple[pq.ParquetWriter, Any]:
    """Open a streaming ParquetWriter over a local path or a gs:// URI.

    Returns (writer, fh) where fh is the underlying gcsfs file handle (gs://) or
    None (local). Local parents are created so output lands identically to before.
    """
    if gcs_io.is_gcs(out_path):
        import gcsfs

        fh = gcsfs.GCSFileSystem().open(str(out_path), "wb")
        return pq.ParquetWriter(fh, schema), fh
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    return pq.ParquetWriter(out_path, schema), None


def write_batch(
    writer: pq.ParquetWriter | None,
    fh: Any,
    out_path: str,
    frame: pd.DataFrame,
) -> tuple[pq.ParquetWriter | None, Any]:
    if frame.empty:
        return writer, fh
    table = pa.Table.from_pandas(frame, preserve_index=False)
    if writer is None:
        writer, fh = _open_parquet_sink(out_path, table.schema)
    writer.write_table(table)
    return writer, fh


def build_meta(out_path: str, years_processed: list[int], wall_seconds: float) -> dict:
    stats = gcs_io.read_parquet(out_path, columns=["fips", "duration_hours"])
    duration = stats["duration_hours"]
    return {
        "knobs": {
            "GAP_TOLERANCE_minutes": GAP_TOLERANCE.total_seconds() / 60,
            "THRESHOLD_customers_out_gt": THRESHOLD,
            "MIN_DURATION_minutes": MIN_DURATION.total_seconds() / 60,
            "SNAPSHOT_INTERVAL_minutes": SNAPSHOT_INTERVAL.total_seconds() / 60,
        },
        "timestamp_policy": {
            "source_timezone_assumption": SOURCE_TIMEZONE,
            "parquet_time_convention": PARQUET_TIME_CONVENTION,
            "start_time": "inclusive first observed outage snapshot",
            "end_time": "exclusive end = last observed outage snapshot + SNAPSHOT_INTERVAL",
            "year": "UTC calendar year of start_time",
        },
        "years_processed": years_processed,
        "n_fips_in_events": int(stats["fips"].nunique()),
        "n_events_out": int(len(stats)),
        "duration_stats_hours": {
            "min": float(duration.min()),
            "p50": float(duration.median()),
            "mean": float(duration.mean()),
            "p95": float(duration.quantile(0.95)),
            "p99": float(duration.quantile(0.99)),
            "max": float(duration.max()),
        },
        "wall_time_seconds": round(wall_seconds, 1),
    }


def meta_path_for(out_path: str) -> str:
    if str(out_path) == str(OUT_PARQUET):
        return OUT_META
    head, sep, name = str(out_path).rpartition("/")
    stem = name[: -len(".parquet")] if name.endswith(".parquet") else name
    return f"{head}{sep}{stem}_meta.json"


def main() -> int:
    global GAP_TOLERANCE, GAP_TOLERANCE_NS

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--years", type=int, nargs="*", default=YEARS, help="years to ingest")
    parser.add_argument("--sample-fips", type=int, default=None, help="only first N FIPS (smoke test)")
    parser.add_argument("--out", type=str, default=OUT_PARQUET)
    parser.add_argument(
        "--gap-tolerance-minutes",
        type=float,
        default=GAP_TOLERANCE.total_seconds() / 60,
        help="maximum positive-snapshot gap that still extends an event",
    )
    args = parser.parse_args()

    if args.gap_tolerance_minutes < SNAPSHOT_INTERVAL.total_seconds() / 60:
        print("[fail] --gap-tolerance-minutes must be at least the 15-minute snapshot interval", flush=True)
        return 1

    GAP_TOLERANCE = timedelta(minutes=args.gap_tolerance_minutes)
    GAP_TOLERANCE_NS = np.int64(GAP_TOLERANCE.total_seconds() * 1e9)

    years = sorted(args.years)
    if not gcs_io.is_gcs(args.out) and Path(args.out).exists():
        Path(args.out).unlink()  # local stale-file clean; gs:// "wb" open overwrites

    t0 = time.time()
    carry: dict[int, dict] = {}
    writer: pq.ParquetWriter | None = None
    fh: Any = None
    years_processed: list[int] = []
    n_written = 0

    try:
        for year in years:
            if gcs_io.exists(raw_path(year)):
                years_processed.append(year)
            ev_y = process_year(year, carry=carry, sample_fips=args.sample_fips)
            if not ev_y.empty:
                writer, fh = write_batch(writer, fh, args.out, ev_y)
                n_written += len(ev_y)
                print(f"[write] {year}: {len(ev_y):,} rows ({n_written:,} total)", flush=True)
            gc.collect()

        final_rows = []
        for fips, st in sorted(carry.items()):
            closed = close_state(fips, st)
            if closed is not None:
                final_rows.append(closed)
        final_events = rows_to_events(final_rows)
        if not final_events.empty:
            writer, fh = write_batch(writer, fh, args.out, final_events)
            n_written += len(final_events)
            print(f"[write] final seams: {len(final_events):,} rows ({n_written:,} total)", flush=True)
    finally:
        if writer is not None:
            writer.close()
        if fh is not None:
            fh.close()

    if n_written == 0:
        print("[fail] no events constructed", flush=True)
        return 1

    meta = build_meta(args.out, years_processed=years_processed, wall_seconds=time.time() - t0)
    meta_path = meta_path_for(args.out)
    # byte-identical to json.dumps(meta, indent=2, default=str): keep indent's default separators
    gcs_io.write_json(meta, meta_path, indent=2, default=str, separators=(",", ": "))
    print(f"[save] {args.out} ({meta['n_events_out']:,} rows)", flush=True)
    print(f"[save] {meta_path}", flush=True)
    print(f"[done] wall {meta['wall_time_seconds']}s, {meta['n_events_out']:,} events", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
