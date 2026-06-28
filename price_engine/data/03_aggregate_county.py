"""
03_aggregate_county.py — roll events.parquet up to per-FIPS artifacts.

Reads:
  - price_engine/data/events.parquet
  - price_engine/data/raw/coverage_history.csv  (year, state, total_customers, min/max_covered, min/max_pct_covered)
  - price_engine/data/raw/MCC.csv               (County_FIPS, Customers)
  - price_engine/data/raw/DQI.csv               (fema, year, success_rate, ..., DQI)

Writes:
  - price_engine/data/county_summary.parquet
  - price_engine/data/county_durations.parquet

Notes on the real schemas (verified after Figshare download):
  - MCC is the per-FIPS modeled customer count — direct merge.
  - Annualization uses the raw source exposure window for the processed years,
    not first/last event dates. This avoids inflating quiet counties simply
    because their first observed outage happened late in the source window.
  - coverage_history is keyed by (year, state), covers only 2018-2022 in the
    current Figshare release, and is retained as a coverage-quality diagnostic.
  - DQI is keyed by (FEMA region, year). We average DQI per state across
    years — state→FEMA region mapping is embedded.

Usage:
    python 03_aggregate_county.py
    python 03_aggregate_county.py --events ../catalogs/eagle-i-45min/data/events.parquet
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import timedelta
from pathlib import Path

import numpy as np
import pandas as pd

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "price_engine"))
from core import gcs_io, data_paths  # noqa: E402

# Repo-relative prefix for the raw source files; each file under it maps to its
# own lake location (eagle_i / mcc / reference), so resolve per-file, not the dir.
RAW_DIR = "price_engine/data/raw"
EVENTS = data_paths.resolve("price_engine/data/events.parquet")
COVERAGE = data_paths.resolve("price_engine/data/raw/coverage_history.csv")
MCC = data_paths.resolve("price_engine/data/raw/MCC.csv")
DQI = data_paths.resolve("price_engine/data/raw/DQI.csv")

OUT_SUMMARY = data_paths.resolve("price_engine/data/county_summary.parquet")
OUT_DURATIONS = data_paths.resolve("price_engine/data/county_durations.parquet")

SNAPSHOT_INTERVAL = timedelta(minutes=15)
YEAR_SECONDS = 365.25 * 86400

# State -> 2-letter for matching events ("Alabama" -> "AL")
STATE_NAME_TO_ABBR = {
    'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO',
    'Connecticut':'CT','Delaware':'DE','District of Columbia':'DC','Florida':'FL','Georgia':'GA',
    'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY',
    'Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN',
    'Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH',
    'New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND',
    'Ohio':'OH','Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC',
    'South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA',
    'Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY','Puerto Rico':'PR',
    'Virgin Islands':'VI','Guam':'GU','American Samoa':'AS','Northern Mariana Islands':'MP',
}

# FEMA region -> states (for matching DQI to states)
FEMA_REGION_STATES = {
    1: ['CT','ME','MA','NH','RI','VT'],
    2: ['NJ','NY','PR','VI'],
    3: ['DE','DC','MD','PA','VA','WV'],
    4: ['AL','FL','GA','KY','MS','NC','SC','TN'],
    5: ['IL','IN','MI','MN','OH','WI'],
    6: ['AR','LA','NM','OK','TX'],
    7: ['IA','KS','MO','NE'],
    8: ['CO','MT','ND','SD','UT','WY'],
    9: ['AZ','CA','HI','NV','AS','GU','MP'],
    10:['AK','ID','OR','WA'],
}


def _safe_read_csv(path: str | Path) -> pd.DataFrame:
    if not gcs_io.exists(path):
        name = str(path).rsplit("/", 1)[-1]
        print(f"[warn] {name} missing; downstream columns will be NaN", flush=True)
        return pd.DataFrame()
    return gcs_io.read_csv(path)


def compute_state_coverage_history_years(coverage: pd.DataFrame) -> dict[str, float]:
    """coverage_history: (year, state, ...). Diagnostic only, not annualization."""
    if coverage.empty:
        return {}
    cov = coverage.copy()
    cov["year_dt"] = pd.to_datetime(cov["year"], format="%m/%d/%y", errors="coerce")
    cov["year_int"] = cov["year_dt"].dt.year
    grp = cov.groupby("state")["year_int"].agg(["min", "max"])
    grp["coverage_history_years"] = (grp["max"] - grp["min"] + 1).astype(float)
    return grp["coverage_history_years"].to_dict()


def raw_timestamp_bounds(path: str | Path) -> tuple[pd.Timestamp, pd.Timestamp]:
    """Read only timestamps to find the observed bounds inside one raw yearly file."""
    name = str(path).rsplit("/", 1)[-1]
    mins = []
    maxs = []
    for chunk in gcs_io.read_csv(path, usecols=["run_start_time"], chunksize=1_000_000, low_memory=False):
        ts = pd.to_datetime(chunk["run_start_time"], errors="coerce")
        ts = ts.dropna()
        if not ts.empty:
            mins.append(ts.min())
            maxs.append(ts.max())
    if not mins:
        raise RuntimeError(f"{name}: no parseable run_start_time values")
    return min(mins), max(maxs)


def source_exposure_interval_for_year(raw_dir: str, year: int) -> tuple[pd.Timestamp, pd.Timestamp]:
    """Return the source exposure interval represented by one yearly CSV.

    For complete yearly files, count the full calendar year even if the final
    positive outage row is earlier than Dec 31 23:45. For a genuinely partial
    first or final source file, trim to the raw observed boundary.
    """
    path = data_paths.resolve(f"{raw_dir}/eaglei_outages_{year}.csv")
    raw_min, raw_max = raw_timestamp_bounds(path)
    nominal_start = pd.Timestamp(year=year, month=1, day=1)
    nominal_end = pd.Timestamp(year=year + 1, month=1, day=1)

    start = raw_min if raw_min > nominal_start else nominal_start
    final_snapshot_end = raw_max + SNAPSHOT_INTERVAL

    if raw_max >= nominal_end - timedelta(days=1):
        end = nominal_end
    else:
        end = final_snapshot_end

    if end <= start:
        name = str(path).rsplit("/", 1)[-1]
        raise RuntimeError(f"{name}: invalid source exposure interval {start} -> {end}")
    return start, end


def nominal_year_interval(year: int) -> tuple[pd.Timestamp, pd.Timestamp]:
    return pd.Timestamp(year=year, month=1, day=1), pd.Timestamp(year=year + 1, month=1, day=1)


def compute_source_exposure(raw_dir: str, years: list[int]) -> dict:
    years = sorted(set(int(y) for y in years))
    first_year = years[0]
    last_year = years[-1]
    intervals = []
    for year in years:
        path = data_paths.resolve(f"{raw_dir}/eaglei_outages_{year}.csv")
        if not gcs_io.exists(path):
            continue
        if year in (first_year, last_year):
            start, end = source_exposure_interval_for_year(raw_dir, year)
        else:
            start, end = nominal_year_interval(year)
        intervals.append({"year": year, "start": start, "end": end})

    if not intervals:
        raise RuntimeError("no raw yearly files available to compute source exposure")

    seconds = sum((row["end"] - row["start"]).total_seconds() for row in intervals)
    return {
        "source_window_start": min(row["start"] for row in intervals),
        "source_window_end": max(row["end"] for row in intervals),
        "source_observation_years": seconds / YEAR_SECONDS,
        "intervals": intervals,
    }


def events_meta_path(events_path: str | Path) -> str:
    """Sibling *_meta.json for the events file. String-based so it works for
    both local paths and gs:// URIs (same trailing-segment rewrite either way)."""
    p = str(events_path)
    head, _, name = p.rpartition("/")
    prefix = f"{head}/" if head else ""
    if name == "events.parquet":
        return f"{prefix}events_meta.json"
    stem = name.rsplit(".", 1)[0]
    return f"{prefix}{stem}_meta.json"


def processed_years_for_annualization(events_path: str | Path, events: pd.DataFrame) -> tuple[list[int], str]:
    """Prefer construction metadata so zero-event processed years stay in exposure."""
    meta_path = events_meta_path(events_path)
    if gcs_io.exists(meta_path):
        try:
            meta = gcs_io.read_json(meta_path)
            years = [int(y) for y in meta.get("years_processed", [])]
            if years:
                return sorted(set(years)), str(meta_path)
        except (json.JSONDecodeError, TypeError, ValueError) as exc:
            print(f"[warn] could not read {meta_path}: {exc}; falling back to event years", flush=True)

    years = sorted(int(y) for y in events["year"].dropna().unique())
    return years, "events.year fallback"


def state_to_dqi(dqi: pd.DataFrame) -> dict[str, float]:
    if dqi.empty:
        return {}
    # Average DQI per FEMA region over years, then broadcast to states
    region_avg = dqi.groupby("fema")["DQI"].mean().to_dict()
    out = {}
    for region, states in FEMA_REGION_STATES.items():
        v = region_avg.get(region)
        if v is None:
            continue
        for s in states:
            out[s] = float(v) / 100.0  # DQI in file is 0-100; normalize to 0-1
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--events", type=str, default=EVENTS)
    parser.add_argument("--raw-dir", type=str, default=RAW_DIR)
    parser.add_argument("--out-summary", type=str, default=OUT_SUMMARY)
    parser.add_argument("--out-durations", type=str, default=OUT_DURATIONS)
    args = parser.parse_args()

    coverage_path = data_paths.resolve(f"{args.raw_dir}/coverage_history.csv")
    mcc_path = data_paths.resolve(f"{args.raw_dir}/MCC.csv")
    dqi_path = data_paths.resolve(f"{args.raw_dir}/DQI.csv")

    if not gcs_io.exists(args.events):
        print(f"[fail] {args.events} not found; run 02_construct_events.py first", flush=True)
        return 1

    print(f"[load] {args.events}", flush=True)
    events = gcs_io.read_parquet(args.events)
    events["fips"] = events["fips"].astype("int64")
    print(f"[load] {len(events):,} events across {events['fips'].nunique():,} FIPS", flush=True)

    coverage = _safe_read_csv(coverage_path)
    mcc = _safe_read_csv(mcc_path)
    dqi = _safe_read_csv(dqi_path)

    # Pre-compute lookups
    coverage_history_years = compute_state_coverage_history_years(coverage)
    state_dqi = state_to_dqi(dqi)

    # Normalize MCC columns (handle BOM on County_FIPS) and 'Grand Total' footer row
    if not mcc.empty:
        mcc.columns = [c.lstrip('\ufeff').strip() for c in mcc.columns]
        mcc["County_FIPS"] = pd.to_numeric(mcc["County_FIPS"], errors="coerce")
        mcc["Customers"]   = pd.to_numeric(mcc["Customers"],   errors="coerce")
        mcc = mcc.dropna(subset=["County_FIPS", "Customers"])
        mcc_lookup = dict(zip(mcc["County_FIPS"].astype(int), mcc["Customers"].astype(float)))
    else:
        mcc_lookup = {}

    # Per-FIPS aggregates
    print("[agg ] computing per-FIPS summary…", flush=True)
    base = events.groupby("fips").agg(
        state_name=("state", "first"),
        county=("county", "first"),
        n_events_total=("event_id", "count"),
        duration_p50=("duration_hours", lambda x: float(np.percentile(x, 50))),
        duration_p90=("duration_hours", lambda x: float(np.percentile(x, 90))),
        duration_p95=("duration_hours", lambda x: float(np.percentile(x, 95))),
        duration_p99=("duration_hours", lambda x: float(np.percentile(x, 99))),
        duration_max=("duration_hours", "max"),
        mean_customers_overall=("mean_customers", "mean"),
        first_event=("start_time", "min"),
        last_event=("end_time", "max"),
    ).reset_index()

    # Resolve state name → abbreviation
    base["state"] = base["state_name"].map(STATE_NAME_TO_ABBR).fillna(base["state_name"])

    annualization_years, annualization_years_source = processed_years_for_annualization(args.events, events)
    source_exposure = compute_source_exposure(args.raw_dir, annualization_years)
    source_observation_years = float(source_exposure["source_observation_years"])

    print(
        "[annual] source exposure "
        f"{source_exposure['source_window_start']} -> {source_exposure['source_window_end']} "
        f"= {source_observation_years:.3f} years",
        flush=True,
    )

    # Annualization uses source exposure, not event span. Event span is retained
    # as a diagnostic because using it as the denominator biases quiet counties.
    base["event_span_years"] = (
        (base["last_event"] - base["first_event"]).dt.total_seconds() / (365.25 * 86400)
    )
    base["coverage_history_years"] = base["state"].map(coverage_history_years).fillna(np.nan)
    base["source_observation_years"] = source_observation_years
    base["source_window_start"] = source_exposure["source_window_start"]
    base["source_window_end"] = source_exposure["source_window_end"]
    base["observation_years"] = source_observation_years

    base["n_per_year"] = base["n_events_total"] / base["observation_years"]

    # MCC
    base["mcc"] = base["fips"].map(mcc_lookup)

    # DQI (via state)
    base["dqi"] = base["state"].map(state_dqi)

    base = base[[
        "fips", "state", "county",
        "n_events_total", "observation_years", "n_per_year",
        "source_observation_years", "source_window_start", "source_window_end",
        "event_span_years", "coverage_history_years",
        "mcc", "dqi",
        "duration_p50", "duration_p90", "duration_p95", "duration_p99", "duration_max",
        "mean_customers_overall",
    ]]
    gcs_io.write_parquet(base, args.out_summary, index=False)
    print(f"[save] {args.out_summary} ({len(base):,} FIPS)", flush=True)

    # Long-form durations
    durations = events[["fips", "duration_hours", "year"]].copy()
    gcs_io.write_parquet(durations, args.out_durations, index=False)
    print(f"[save] {args.out_durations} ({len(durations):,} rows)", flush=True)

    # Quick stats
    print(f"[stat] obs_years range:  {base['observation_years'].min():.1f}–{base['observation_years'].max():.1f}", flush=True)
    print(f"[stat] events/year p50:  {base['n_per_year'].median():.1f}", flush=True)
    print(f"[stat] events/year p90:  {base['n_per_year'].quantile(0.9):.1f}", flush=True)
    print(f"[stat] MCC matched:      {base['mcc'].notna().sum():,}/{len(base):,}", flush=True)
    print(f"[stat] DQI matched:      {base['dqi'].notna().sum():,}/{len(base):,}", flush=True)

    exposure_meta = {
        "annualization_policy": "n_per_year = n_events_total / source_observation_years",
        "years_processed": annualization_years,
        "years_source": annualization_years_source,
        "source_window_start": str(source_exposure["source_window_start"]),
        "source_window_end": str(source_exposure["source_window_end"]),
        "source_observation_years": source_observation_years,
        "intervals": [
            {"year": row["year"], "start": str(row["start"]), "end": str(row["end"])}
            for row in source_exposure["intervals"]
        ],
        "note": (
            "The denominator is the raw source exposure window for processed years. "
            "It deliberately does not use first_event/last_event per county."
        ),
    }
    out_head, _, _ = str(args.out_summary).rpartition("/")
    out_prefix = f"{out_head}/" if out_head else ""
    meta_path = f"{out_prefix}annualization_meta.json"
    gcs_io.write_json(exposure_meta, meta_path, indent=2, separators=(",", ": "))
    print(f"[save] {meta_path}", flush=True)

    return 0


if __name__ == "__main__":
    sys.exit(main())
