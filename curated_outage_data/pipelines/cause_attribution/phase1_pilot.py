#!/usr/bin/env python3
"""Phase 1 cause-attribution pilot.

The pilot deliberately stays narrow: Florida, 2017 and 2020, using the
`eagle-i-45min` catalog as the canonical outage-event input.

Outputs are local/reproducible and gitignored.
"""

from __future__ import annotations

import argparse
import html
import json
import math
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import pandas as pd
import requests


REPO_ROOT = Path(__file__).resolve().parents[3]

NOAA_INDEX_URL = "https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/"
PNNL_ZIP_URL = "https://data.openei.org/files/6458/Outage_Dataset_R1.zip"

STATE_ABBR = {
    "Alabama": "AL",
    "Alaska": "AK",
    "Arizona": "AZ",
    "Arkansas": "AR",
    "California": "CA",
    "Colorado": "CO",
    "Connecticut": "CT",
    "Delaware": "DE",
    "District of Columbia": "DC",
    "Florida": "FL",
    "Georgia": "GA",
    "Hawaii": "HI",
    "Idaho": "ID",
    "Illinois": "IL",
    "Indiana": "IN",
    "Iowa": "IA",
    "Kansas": "KS",
    "Kentucky": "KY",
    "Louisiana": "LA",
    "Maine": "ME",
    "Maryland": "MD",
    "Massachusetts": "MA",
    "Michigan": "MI",
    "Minnesota": "MN",
    "Mississippi": "MS",
    "Missouri": "MO",
    "Montana": "MT",
    "Nebraska": "NE",
    "Nevada": "NV",
    "New Hampshire": "NH",
    "New Jersey": "NJ",
    "New Mexico": "NM",
    "New York": "NY",
    "North Carolina": "NC",
    "North Dakota": "ND",
    "Ohio": "OH",
    "Oklahoma": "OK",
    "Oregon": "OR",
    "Pennsylvania": "PA",
    "Rhode Island": "RI",
    "South Carolina": "SC",
    "South Dakota": "SD",
    "Tennessee": "TN",
    "Texas": "TX",
    "Utah": "UT",
    "Vermont": "VT",
    "Virginia": "VA",
    "Washington": "WA",
    "West Virginia": "WV",
    "Wisconsin": "WI",
    "Wyoming": "WY",
}


@dataclass(frozen=True)
class PilotConfig:
    catalog_id: str
    state: str
    years: tuple[int, ...]
    buffer_before_hours: float
    buffer_after_hours: float
    extreme_event_review_hours: float
    timeline_sample_size: int

    @property
    def state_upper(self) -> str:
        return self.state.upper()

    @property
    def state_abbr(self) -> str:
        return STATE_ABBR[self.state]

    @property
    def label(self) -> str:
        years = "_".join(str(y) for y in self.years)
        return f"{self.state_abbr.lower()}_{years}"


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def download(url: str, path: Path) -> Path:
    ensure_dir(path.parent)
    if path.exists() and path.stat().st_size > 0:
        return path

    tmp = path.with_suffix(path.suffix + ".part")
    with requests.get(url, stream=True, timeout=60) as resp:
        resp.raise_for_status()
        with tmp.open("wb") as f:
            for chunk in resp.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)
    tmp.replace(path)
    return path


def discover_noaa_detail_file(year: int) -> str:
    resp = requests.get(NOAA_INDEX_URL, timeout=60)
    resp.raise_for_status()
    pattern = rf"StormEvents_details-ftp_v1\.0_d{year}_c\d+\.csv\.gz"
    matches = sorted(set(re.findall(pattern, resp.text)))
    if not matches:
        raise RuntimeError(f"No NOAA Storm Events details file found for {year}")
    return matches[-1]


def load_catalog_events(config: PilotConfig) -> pd.DataFrame:
    path = (
        REPO_ROOT
        / "price_engine"
        / "catalogs"
        / config.catalog_id
        / "data"
        / "events.parquet"
    )
    cols = [
        "event_id",
        "fips",
        "state",
        "county",
        "start_time",
        "end_time",
        "duration_hours",
        "n_snapshots",
        "min_customers",
        "max_customers",
        "mean_customers",
        "year",
    ]
    df = pd.read_parquet(path, columns=cols)
    df = df[(df["state"] == config.state) & (df["year"].isin(config.years))].copy()
    df["fips"] = df["fips"].astype(str).str.zfill(5)
    df["start_time"] = pd.to_datetime(df["start_time"])
    df["end_time"] = pd.to_datetime(df["end_time"])
    df["catalog_id"] = config.catalog_id
    return df.sort_values(["fips", "start_time", "end_time"]).reset_index(drop=True)


def parse_noaa_utc(local_time: pd.Series, timezone: pd.Series) -> pd.Series:
    dt = pd.to_datetime(local_time, format="%d-%b-%y %H:%M:%S", errors="coerce")
    offsets = timezone.astype("string").str.extract(r"([+-]\d+)$", expand=False)
    offset_hours = pd.to_numeric(offsets, errors="coerce")
    return dt - pd.to_timedelta(offset_hours, unit="h")


def load_noaa_events(config: PilotConfig, raw_dir: Path) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    usecols = [
        "BEGIN_YEARMONTH",
        "BEGIN_DAY",
        "BEGIN_TIME",
        "END_YEARMONTH",
        "END_DAY",
        "END_TIME",
        "EPISODE_ID",
        "EVENT_ID",
        "STATE",
        "STATE_FIPS",
        "YEAR",
        "MONTH_NAME",
        "EVENT_TYPE",
        "CZ_TYPE",
        "CZ_FIPS",
        "CZ_NAME",
        "WFO",
        "BEGIN_DATE_TIME",
        "CZ_TIMEZONE",
        "END_DATE_TIME",
        "DAMAGE_PROPERTY",
        "DAMAGE_CROPS",
        "SOURCE",
        "MAGNITUDE",
        "MAGNITUDE_TYPE",
        "FLOOD_CAUSE",
        "CATEGORY",
        "TOR_F_SCALE",
        "BEGIN_LAT",
        "BEGIN_LON",
        "END_LAT",
        "END_LON",
        "EPISODE_NARRATIVE",
        "EVENT_NARRATIVE",
        "DATA_SOURCE",
    ]

    for year in config.years:
        filename = discover_noaa_detail_file(year)
        path = download(NOAA_INDEX_URL + filename, raw_dir / filename)
        df = pd.read_csv(path, compression="gzip", usecols=usecols, low_memory=False)
        df = df[df["STATE"].astype("string").str.upper() == config.state_upper].copy()
        frames.append(df)

    if not frames:
        return pd.DataFrame()

    df = pd.concat(frames, ignore_index=True)
    df["geo_match_level"] = df["CZ_TYPE"].map({"C": "county", "Z": "zone"}).fillna("unknown")
    df["fips"] = (
        df["STATE_FIPS"].astype("Int64").astype(str).str.zfill(2)
        + df["CZ_FIPS"].astype("Int64").astype(str).str.zfill(3)
    )
    df["source_start_utc"] = parse_noaa_utc(df["BEGIN_DATE_TIME"], df["CZ_TIMEZONE"])
    df["source_end_utc"] = parse_noaa_utc(df["END_DATE_TIME"], df["CZ_TIMEZONE"])
    zero_or_bad = df["source_end_utc"].isna() | (df["source_end_utc"] <= df["source_start_utc"])
    df.loc[zero_or_bad, "source_end_utc"] = df.loc[zero_or_bad, "source_start_utc"] + pd.Timedelta(minutes=1)
    df["source"] = "NOAA_STORM_EVENTS"
    df["source_event_id"] = df["EVENT_ID"].astype(str)
    df["source_episode_id"] = df["EPISODE_ID"].astype(str)
    df["source_event_type"] = df["EVENT_TYPE"].astype("string")
    df["cause_family"] = "weather"
    df["cause_label"] = df["EVENT_TYPE"].astype("string").str.lower()
    df["named_event"] = pd.NA
    keep = [
        "source",
        "source_event_id",
        "source_episode_id",
        "source_event_type",
        "cause_family",
        "cause_label",
        "named_event",
        "fips",
        "STATE",
        "CZ_NAME",
        "geo_match_level",
        "source_start_utc",
        "source_end_utc",
        "CZ_TIMEZONE",
        "WFO",
        "SOURCE",
        "DAMAGE_PROPERTY",
        "DAMAGE_CROPS",
        "MAGNITUDE",
        "MAGNITUDE_TYPE",
        "FLOOD_CAUSE",
        "CATEGORY",
        "TOR_F_SCALE",
        "BEGIN_LAT",
        "BEGIN_LON",
        "END_LAT",
        "END_LON",
        "EPISODE_NARRATIVE",
        "EVENT_NARRATIVE",
    ]
    df = df[keep].copy()
    return df.sort_values(["fips", "source_start_utc", "source_event_id"]).reset_index(drop=True)


def interval_overlap_minutes(
    start_a: pd.Timestamp,
    end_a: pd.Timestamp,
    start_b: pd.Timestamp,
    end_b: pd.Timestamp,
) -> float:
    overlap_start = max(start_a, start_b)
    overlap_end = min(end_a, end_b)
    if overlap_end <= overlap_start:
        return 0.0
    return (overlap_end - overlap_start).total_seconds() / 60.0


def interval_gap_minutes(
    start_a: pd.Timestamp,
    end_a: pd.Timestamp,
    start_b: pd.Timestamp,
    end_b: pd.Timestamp,
) -> float:
    if end_a < start_b:
        return (start_b - end_a).total_seconds() / 60.0
    if end_b < start_a:
        return (start_a - end_b).total_seconds() / 60.0
    return 0.0


def score_match(
    overlap_minutes: float,
    lead_lag_minutes: float,
    max_buffer_minutes: float,
) -> tuple[float, str]:
    geo_score = 0.55
    if overlap_minutes > 0:
        time_score = 0.35
    else:
        closeness = max(0.0, 1.0 - (lead_lag_minutes / max_buffer_minutes))
        time_score = 0.10 + 0.25 * closeness
    score = min(1.0, geo_score + time_score + 0.10)
    if overlap_minutes > 0 and score >= 0.85:
        confidence = "high"
    elif score >= 0.70:
        confidence = "medium"
    else:
        confidence = "low"
    return round(score, 4), confidence


def match_noaa_to_events(
    events: pd.DataFrame,
    noaa: pd.DataFrame,
    config: PilotConfig,
) -> pd.DataFrame:
    county_noaa = noaa[noaa["geo_match_level"] == "county"].copy()
    before = pd.Timedelta(hours=config.buffer_before_hours)
    after = pd.Timedelta(hours=config.buffer_after_hours)
    max_buffer_minutes = max(before.total_seconds(), after.total_seconds()) / 60.0
    rows: list[dict] = []

    noaa_groups = {
        fips: group.sort_values("source_start_utc")
        for fips, group in county_noaa.groupby("fips", sort=False)
    }

    for event in events.itertuples(index=False):
        candidates = noaa_groups.get(event.fips)
        if candidates is None or candidates.empty:
            continue

        start_min = event.start_time - before
        end_max = event.start_time + after
        subset = candidates[
            (candidates["source_end_utc"] >= start_min)
            & (candidates["source_start_utc"] <= end_max)
        ]
        if subset.empty:
            continue

        for source in subset.itertuples(index=False):
            overlap = interval_overlap_minutes(
                event.start_time,
                event.end_time,
                source.source_start_utc,
                source.source_end_utc,
            )
            lead_lag = interval_gap_minutes(
                event.start_time,
                event.end_time,
                source.source_start_utc,
                source.source_end_utc,
            )
            score, confidence = score_match(overlap, lead_lag, max_buffer_minutes)
            event_quality_flag = "ok"
            note = "county FIPS and buffered outage-onset match; evidence not proof of cause"
            if event.duration_hours > config.extreme_event_review_hours:
                event_quality_flag = "extreme_duration_review"
                confidence = "review"
                score = min(score, 0.6)
                note = (
                    "extreme-duration outage interval; NOAA overlap retained as "
                    "context, not assigned as a clean cause label"
                )
            rows.append(
                {
                    "catalog_id": event.catalog_id,
                    "event_id": event.event_id,
                    "fips": event.fips,
                    "state": event.state,
                    "county": event.county,
                    "event_start_utc": event.start_time,
                    "event_end_utc": event.end_time,
                    "event_onset_window_start_utc": start_min,
                    "event_onset_window_end_utc": end_max,
                    "duration_hours": event.duration_hours,
                    "max_customers": event.max_customers,
                    "source": source.source,
                    "source_event_id": source.source_event_id,
                    "source_episode_id": source.source_episode_id,
                    "source_event_type": source.source_event_type,
                    "source_start_utc": source.source_start_utc,
                    "source_end_utc": source.source_end_utc,
                    "source_start_delta_minutes": round(
                        (source.source_start_utc - event.start_time).total_seconds() / 60.0,
                        2,
                    ),
                    "time_overlap_minutes": round(overlap, 2),
                    "lead_lag_minutes": round(lead_lag, 2),
                    "geo_match_level": source.geo_match_level,
                    "match_score": score,
                    "event_quality_flag": event_quality_flag,
                    "cause_family": source.cause_family,
                    "cause_label": source.cause_label,
                    "named_event": source.named_event,
                    "confidence": confidence,
                    "notes": note,
                }
            )

    if not rows:
        return pd.DataFrame()
    return pd.DataFrame(rows).sort_values(
        ["event_start_utc", "fips", "match_score", "source_event_id"],
        ascending=[True, True, False, True],
    )


def load_pnnl(config: PilotConfig, raw_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    zip_path = download(PNNL_ZIP_URL, raw_dir / "Outage_Dataset_R1.zip")
    merged_frames: list[pd.DataFrame] = []
    event_frames: list[pd.DataFrame] = []

    with zipfile.ZipFile(zip_path) as archive:
        for year in config.years:
            merged_name = f"Outage_Dataset/eaglei_outages_{year}_merged.csv"
            with archive.open(merged_name) as f:
                merged = pd.read_csv(f)
            merged = merged[merged["state"] == config.state].copy()
            merged["year"] = year
            merged_frames.append(merged)

            for lag in ("8_hours_lag", "24_hours_lag"):
                event_name = f"Outage_Dataset/eaglei_outages_with_events_{year}_{lag}.csv"
                with archive.open(event_name) as f:
                    events = pd.read_csv(f)
                events = events[events["state"] == config.state].copy()
                events["year"] = year
                events["lag_rule"] = lag.replace("_hours_lag", "h")
                event_frames.append(events)

    merged_df = pd.concat(merged_frames, ignore_index=True)
    event_df = pd.concat(event_frames, ignore_index=True)
    for df in (merged_df, event_df):
        df["fips"] = df["fips"].astype(str).str.zfill(5)
        df["start_time"] = pd.to_datetime(df["start_time"], errors="coerce")
        df["outage_end_time"] = df["start_time"] + pd.to_timedelta(df["duration"], unit="h")
    if not event_df.empty:
        event_df["oe417_event_type"] = event_df["Event Type"].astype("string")
        event_df["source_start_utc"] = pd.to_datetime(
            event_df["Datetime Event Began"], errors="coerce"
        )
        event_df["source_end_utc"] = pd.to_datetime(
            event_df["Datetime Restoration"], errors="coerce"
        )
        missing_or_bad = event_df["source_end_utc"].isna() | (
            event_df["source_end_utc"] <= event_df["source_start_utc"]
        )
        event_df.loc[missing_or_bad, "source_end_utc"] = (
            event_df.loc[missing_or_bad, "source_start_utc"] + pd.Timedelta(minutes=1)
        )
    return merged_df, event_df


def match_pnnl_to_events(
    events: pd.DataFrame,
    pnnl_events: pd.DataFrame,
    config: PilotConfig,
) -> pd.DataFrame:
    if pnnl_events.empty:
        return pd.DataFrame()

    before = pd.Timedelta(hours=config.buffer_before_hours)
    after = pd.Timedelta(hours=config.buffer_after_hours)
    max_buffer_minutes = max(before.total_seconds(), after.total_seconds()) / 60.0
    rows: list[dict] = []

    pnnl_groups = {
        fips: group.sort_values("start_time")
        for fips, group in pnnl_events.groupby("fips", sort=False)
    }

    for event in events.itertuples(index=False):
        candidates = pnnl_groups.get(event.fips)
        if candidates is None or candidates.empty:
            continue

        start_min = event.start_time - before
        end_max = event.start_time + after
        subset = candidates[
            (candidates["outage_end_time"] >= start_min)
            & (candidates["start_time"] <= end_max)
        ]
        if subset.empty:
            continue

        for source in subset.itertuples(index=False):
            pnnl_overlap = interval_overlap_minutes(
                event.start_time,
                event.end_time,
                source.start_time,
                source.outage_end_time,
            )
            pnnl_gap = interval_gap_minutes(
                event.start_time,
                event.end_time,
                source.start_time,
                source.outage_end_time,
            )
            pnnl_delta_minutes = (source.start_time - event.start_time).total_seconds() / 60.0
            lag_bonus = 0.10 if source.lag_rule == "8h" else 0.04
            closeness = max(0.0, 1.0 - (abs(pnnl_delta_minutes) / max_buffer_minutes))
            score = min(1.0, 0.55 + 0.25 * closeness + lag_bonus)
            confidence = "high" if score >= 0.85 and source.lag_rule == "8h" else "medium"
            event_quality_flag = "ok"
            note = (
                "same-FIPS PNNL/OE-417 event-correlated outage scenario near "
                "outage onset; major-disturbance evidence, not outage on/off truth"
            )
            if event.duration_hours > config.extreme_event_review_hours:
                event_quality_flag = "extreme_duration_review"
                confidence = "review"
                score = min(score, 0.65)
                note = (
                    "extreme-duration outage interval; PNNL/OE-417 match retained "
                    "as major-disturbance context, not a clean single-cause label"
                )

            rows.append(
                {
                    "catalog_id": event.catalog_id,
                    "event_id": event.event_id,
                    "fips": event.fips,
                    "state": event.state,
                    "county": event.county,
                    "event_start_utc": event.start_time,
                    "event_end_utc": event.end_time,
                    "event_onset_window_start_utc": start_min,
                    "event_onset_window_end_utc": end_max,
                    "duration_hours": event.duration_hours,
                    "max_customers": event.max_customers,
                    "source": "PNNL_OE417_EVENT_CORRELATED",
                    "source_event_id": str(source.event_id),
                    "source_episode_id": pd.NA,
                    "source_event_type": source.oe417_event_type,
                    "source_start_utc": source.source_start_utc,
                    "source_end_utc": source.source_end_utc,
                    "source_start_delta_minutes": round(
                        (source.source_start_utc - event.start_time).total_seconds() / 60.0,
                        2,
                    )
                    if pd.notna(source.source_start_utc)
                    else pd.NA,
                    "pnnl_lag_rule": source.lag_rule,
                    "pnnl_outage_start_utc": source.start_time,
                    "pnnl_outage_end_utc": source.outage_end_time,
                    "pnnl_outage_start_delta_minutes": round(pnnl_delta_minutes, 2),
                    "pnnl_outage_overlap_minutes": round(pnnl_overlap, 2),
                    "time_overlap_minutes": round(
                        interval_overlap_minutes(
                            event.start_time,
                            event.end_time,
                            source.source_start_utc,
                            source.source_end_utc,
                        )
                        if pd.notna(source.source_start_utc)
                        and pd.notna(source.source_end_utc)
                        else 0.0,
                        2,
                    ),
                    "lead_lag_minutes": round(pnnl_gap, 2),
                    "geo_match_level": "county",
                    "match_score": round(score, 4),
                    "event_quality_flag": event_quality_flag,
                    "cause_family": "major_disturbance",
                    "cause_label": str(source.oe417_event_type).lower(),
                    "named_event": pd.NA,
                    "confidence": confidence,
                    "notes": note,
                }
            )

    if not rows:
        return pd.DataFrame()
    return pd.DataFrame(rows).sort_values(
        ["event_start_utc", "fips", "match_score", "pnnl_lag_rule", "source_event_id"],
        ascending=[True, True, False, True, True],
    )


def duration_bucket(duration_hours: pd.Series) -> pd.Series:
    bins = [-math.inf, 1, 4, 8, 12, 24, math.inf]
    labels = ["<1h", "1-4h", "4-8h", "8-12h", "12-24h", "24h+"]
    return pd.cut(duration_hours, bins=bins, labels=labels, right=False)


def best_pnnl_matches(pnnl_matches: pd.DataFrame) -> pd.DataFrame:
    if pnnl_matches.empty:
        return pd.DataFrame()
    usable = pnnl_matches[pnnl_matches["confidence"] != "review"].copy()
    if usable.empty:
        return pd.DataFrame()
    usable["lag_priority"] = usable["pnnl_lag_rule"].map({"8h": 0, "24h": 1}).fillna(9)
    usable["abs_pnnl_outage_start_delta_minutes"] = usable[
        "pnnl_outage_start_delta_minutes"
    ].abs()
    return usable.sort_values(
        ["event_id", "match_score", "lag_priority", "abs_pnnl_outage_start_delta_minutes"],
        ascending=[True, False, True, True],
    ).drop_duplicates("event_id")


def best_noaa_matches(noaa_matches: pd.DataFrame) -> pd.DataFrame:
    if noaa_matches.empty:
        return pd.DataFrame()
    usable = noaa_matches[noaa_matches["confidence"] != "review"].copy()
    if usable.empty:
        return pd.DataFrame()
    usable["abs_source_start_delta_minutes"] = usable["source_start_delta_minutes"].abs()
    return usable.sort_values(
        ["event_id", "match_score", "abs_source_start_delta_minutes", "source_event_id"],
        ascending=[True, False, True, True],
    ).drop_duplicates("event_id")


def build_enriched_preview(
    events: pd.DataFrame,
    pnnl_matches: pd.DataFrame,
    noaa_matches: pd.DataFrame,
    config: PilotConfig,
) -> pd.DataFrame:
    preview = events[
        [
            "catalog_id",
            "event_id",
            "fips",
            "state",
            "county",
            "start_time",
            "end_time",
            "duration_hours",
            "max_customers",
            "year",
        ]
    ].rename(columns={"start_time": "event_start_utc", "end_time": "event_end_utc"})
    preview = preview.copy()
    preview["event_quality_flag"] = "ok"
    preview.loc[
        preview["duration_hours"] > config.extreme_event_review_hours,
        "event_quality_flag",
    ] = "extreme_duration_review"

    pnnl_counts = (
        pnnl_matches.groupby("event_id").size().rename("pnnl_match_count")
        if not pnnl_matches.empty
        else pd.Series(dtype="int64", name="pnnl_match_count")
    )
    noaa_counts = (
        noaa_matches.groupby("event_id").size().rename("noaa_match_count")
        if not noaa_matches.empty
        else pd.Series(dtype="int64", name="noaa_match_count")
    )
    preview = preview.merge(pnnl_counts, on="event_id", how="left")
    preview = preview.merge(noaa_counts, on="event_id", how="left")
    preview["pnnl_match_count"] = preview["pnnl_match_count"].fillna(0).astype(int)
    preview["noaa_match_count"] = preview["noaa_match_count"].fillna(0).astype(int)

    defaults = {
        "best_cause_source": "unknown",
        "best_cause_family": "unknown",
        "best_cause_label": "unattributed",
        "best_source_event_type": pd.NA,
        "best_source_event_id": pd.NA,
        "best_confidence": "none",
        "best_match_score": pd.NA,
        "best_source_start_utc": pd.NaT,
        "best_source_end_utc": pd.NaT,
        "source_priority_reason": "no defensible public-source match",
    }
    for col, value in defaults.items():
        preview[col] = value

    pnnl_best = best_pnnl_matches(pnnl_matches)
    if not pnnl_best.empty:
        pnnl_best = pnnl_best.set_index("event_id")
        mask = preview["event_id"].isin(pnnl_best.index)
        for idx in preview[mask].index:
            match = pnnl_best.loc[preview.at[idx, "event_id"]]
            preview.at[idx, "best_cause_source"] = "PNNL_OE417_EVENT_CORRELATED"
            preview.at[idx, "best_cause_family"] = "major_disturbance"
            preview.at[idx, "best_cause_label"] = match["cause_label"]
            preview.at[idx, "best_source_event_type"] = match["source_event_type"]
            preview.at[idx, "best_source_event_id"] = match["source_event_id"]
            preview.at[idx, "best_confidence"] = match["confidence"]
            preview.at[idx, "best_match_score"] = match["match_score"]
            preview.at[idx, "best_source_start_utc"] = match["source_start_utc"]
            preview.at[idx, "best_source_end_utc"] = match["source_end_utc"]
            preview.at[idx, "source_priority_reason"] = (
                "PNNL/OE-417 major-disturbance match outranks NOAA weather context"
            )

    noaa_best = best_noaa_matches(noaa_matches)
    if not noaa_best.empty:
        noaa_best = noaa_best.set_index("event_id")
        mask = (preview["best_cause_source"] == "unknown") & preview["event_id"].isin(
            noaa_best.index
        )
        for idx in preview[mask].index:
            match = noaa_best.loc[preview.at[idx, "event_id"]]
            preview.at[idx, "best_cause_source"] = "NOAA_STORM_EVENTS"
            preview.at[idx, "best_cause_family"] = "weather"
            preview.at[idx, "best_cause_label"] = match["cause_label"]
            preview.at[idx, "best_source_event_type"] = match["source_event_type"]
            preview.at[idx, "best_source_event_id"] = match["source_event_id"]
            preview.at[idx, "best_confidence"] = match["confidence"]
            preview.at[idx, "best_match_score"] = match["match_score"]
            preview.at[idx, "best_source_start_utc"] = match["source_start_utc"]
            preview.at[idx, "best_source_end_utc"] = match["source_end_utc"]
            preview.at[idx, "source_priority_reason"] = (
                "NOAA weather event near outage onset; no PNNL/OE-417 match"
            )

    return preview.sort_values(["year", "fips", "event_start_utc"]).reset_index(drop=True)


def source_priority_summary(enriched_preview: pd.DataFrame) -> pd.DataFrame:
    base = (
        enriched_preview.groupby(
            ["best_cause_source", "best_cause_family", "best_cause_label", "best_confidence"],
            dropna=False,
        )
        .agg(events=("event_id", "count"), median_duration_hours=("duration_hours", "median"))
        .reset_index()
        .sort_values("events", ascending=False)
    )
    return base


def enriched_preview_csv_sample(enriched_preview: pd.DataFrame) -> pd.DataFrame:
    pnnl = enriched_preview[
        enriched_preview["best_cause_source"] == "PNNL_OE417_EVENT_CORRELATED"
    ].sort_values(["max_customers", "duration_hours"], ascending=False)
    noaa = enriched_preview[enriched_preview["best_cause_source"] == "NOAA_STORM_EVENTS"].sort_values(
        ["duration_hours", "max_customers"], ascending=False
    )
    unknown = enriched_preview[enriched_preview["best_cause_source"] == "unknown"].sort_values(
        ["duration_hours", "max_customers"], ascending=False
    )
    return pd.concat([pnnl.head(200), noaa.head(200), unknown.head(100)], ignore_index=True)


def pnnl_match_summary(events: pd.DataFrame, pnnl_matches: pd.DataFrame) -> pd.DataFrame:
    matched = set(pnnl_matches["event_id"]) if not pnnl_matches.empty else set()
    usable = (
        set(pnnl_matches[pnnl_matches["confidence"] != "review"]["event_id"])
        if not pnnl_matches.empty
        else set()
    )
    flags = events[["event_id", "duration_hours"]].copy()
    flags["matched_pnnl"] = flags["event_id"].isin(matched)
    flags["usable_pnnl_match"] = flags["event_id"].isin(usable)
    rows = []
    for threshold in [1, 4, 8, 12, 24]:
        subset = flags[flags["duration_hours"] >= threshold]
        rows.append(
            {
                "threshold_hours": threshold,
                "events": int(len(subset)),
                "pnnl_matched_events": int(subset["matched_pnnl"].sum()),
                "usable_pnnl_matched_events": int(subset["usable_pnnl_match"].sum()),
                "match_rate": float(subset["matched_pnnl"].mean()) if len(subset) else None,
                "usable_match_rate": float(subset["usable_pnnl_match"].mean())
                if len(subset)
                else None,
            }
        )
    return pd.DataFrame(rows)


def select_timeline_events(
    enriched_preview: pd.DataFrame, config: PilotConfig
) -> pd.DataFrame:
    groups = []
    pnnl = enriched_preview[
        enriched_preview["best_cause_source"] == "PNNL_OE417_EVENT_CORRELATED"
    ].copy()
    pnnl["sample_reason"] = "pnnl_major_disturbance"
    groups.append(pnnl.sort_values(["max_customers", "duration_hours"], ascending=False).head(4))

    noaa = enriched_preview[enriched_preview["best_cause_source"] == "NOAA_STORM_EVENTS"].copy()
    noaa["sample_reason"] = "noaa_fallback_weather"
    groups.append(noaa.sort_values(["duration_hours", "max_customers"], ascending=False).head(4))

    unknown = enriched_preview[enriched_preview["best_cause_source"] == "unknown"].copy()
    unknown["sample_reason"] = "unknown_long_event"
    groups.append(unknown.sort_values(["duration_hours", "max_customers"], ascending=False).head(4))

    review = enriched_preview[
        enriched_preview["event_quality_flag"] == "extreme_duration_review"
    ].copy()
    review["sample_reason"] = "extreme_duration_review"
    groups.append(review.sort_values(["duration_hours", "max_customers"], ascending=False).head(4))

    samples = pd.concat(groups, ignore_index=True)
    samples = samples.drop_duplicates("event_id").head(config.timeline_sample_size).copy()
    samples["window_start_utc"] = samples["event_start_utc"] - pd.Timedelta(hours=24)
    capped_end = samples["event_start_utc"] + pd.Timedelta(days=14)
    natural_end = samples["event_end_utc"] + pd.Timedelta(hours=24)
    samples["window_end_utc"] = natural_end.where(natural_end <= capped_end, capped_end)
    return samples.reset_index(drop=True)


def load_raw_snapshots(samples: pd.DataFrame) -> pd.DataFrame:
    if samples.empty:
        return pd.DataFrame(
            columns=["fips", "county", "state", "customers_out", "run_start_time", "year"]
        )
    frames = []
    usecols = ["fips_code", "county", "state", "customers_out", "run_start_time"]
    for year, group in samples.groupby("year"):
        path = REPO_ROOT / "price_engine" / "data" / "raw" / f"eaglei_outages_{int(year)}.csv"
        if not path.exists():
            continue
        fips_set = set(group["fips"].astype(str).str.zfill(5))
        min_time = group["window_start_utc"].min()
        max_time = group["window_end_utc"].max()
        for chunk in pd.read_csv(
            path,
            usecols=usecols,
            dtype={"fips_code": "string"},
            chunksize=1_000_000,
            low_memory=False,
        ):
            chunk["fips"] = chunk["fips_code"].astype("string").str.zfill(5)
            chunk = chunk[chunk["fips"].isin(fips_set)].copy()
            if chunk.empty:
                continue
            chunk["run_start_time"] = pd.to_datetime(chunk["run_start_time"], errors="coerce")
            chunk = chunk[
                (chunk["run_start_time"] >= min_time) & (chunk["run_start_time"] <= max_time)
            ].copy()
            if chunk.empty:
                continue
            chunk["customers_out"] = pd.to_numeric(
                chunk["customers_out"], errors="coerce"
            ).fillna(0)
            chunk["year"] = int(year)
            frames.append(
                chunk[["fips", "county", "state", "customers_out", "run_start_time", "year"]]
            )
    if not frames:
        return pd.DataFrame(
            columns=["fips", "county", "state", "customers_out", "run_start_time", "year"]
        )
    return pd.concat(frames, ignore_index=True)


def event_source_windows(
    event_id: str,
    noaa_matches: pd.DataFrame,
    pnnl_matches: pd.DataFrame,
) -> pd.DataFrame:
    frames = []
    if not pnnl_matches.empty:
        pnnl = pnnl_matches[pnnl_matches["event_id"] == event_id].copy()
        if not pnnl.empty:
            pnnl_windows = pnnl[
                [
                    "source",
                    "source_event_id",
                    "source_event_type",
                    "source_start_utc",
                    "source_end_utc",
                    "confidence",
                    "match_score",
                    "pnnl_lag_rule",
                    "pnnl_outage_start_utc",
                    "pnnl_outage_end_utc",
                    "notes",
                ]
            ].copy()
            frames.append(pnnl_windows)
    if not noaa_matches.empty:
        noaa = noaa_matches[noaa_matches["event_id"] == event_id].copy()
        if not noaa.empty:
            noaa_windows = noaa[
                [
                    "source",
                    "source_event_id",
                    "source_event_type",
                    "source_start_utc",
                    "source_end_utc",
                    "confidence",
                    "match_score",
                    "notes",
                ]
            ].copy()
            noaa_windows["pnnl_lag_rule"] = pd.NA
            noaa_windows["pnnl_outage_start_utc"] = pd.NaT
            noaa_windows["pnnl_outage_end_utc"] = pd.NaT
            frames.append(noaa_windows)
    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True).sort_values(
        ["source", "source_start_utc", "source_event_id"]
    )


def time_to_x(ts: pd.Timestamp, start: pd.Timestamp, end: pd.Timestamp, width: int) -> float:
    if pd.isna(ts) or end <= start:
        return 0.0
    return max(0.0, min(width, ((ts - start).total_seconds() / (end - start).total_seconds()) * width))


def bar_svg(
    start: pd.Timestamp,
    end: pd.Timestamp,
    window_start: pd.Timestamp,
    window_end: pd.Timestamp,
    width: int,
    y: int,
    color: str,
    label: str,
) -> str:
    x1 = time_to_x(start, window_start, window_end, width)
    x2 = time_to_x(end, window_start, window_end, width)
    w = max(2.0, x2 - x1)
    safe = html.escape(label)
    return (
        f'<rect x="{x1:.1f}" y="{y}" width="{w:.1f}" height="14" '
        f'rx="2" fill="{color}" opacity="0.78"><title>{safe}</title></rect>'
    )


def snapshot_polyline(
    snapshots: pd.DataFrame,
    window_start: pd.Timestamp,
    window_end: pd.Timestamp,
    width: int,
    y_top: int,
    height: int,
) -> str:
    if snapshots.empty or snapshots["customers_out"].max() <= 0:
        return ""
    max_out = snapshots["customers_out"].max()
    points = []
    for row in snapshots.itertuples(index=False):
        x = time_to_x(row.run_start_time, window_start, window_end, width)
        y = y_top + height - ((row.customers_out / max_out) * height)
        points.append(f"{x:.1f},{y:.1f}")
    return (
        f'<polyline points="{" ".join(points)}" fill="none" '
        f'stroke="#0f766e" stroke-width="1.6" opacity="0.9" />'
    )


def render_timeline_card(
    sample: pd.Series,
    snapshots: pd.DataFrame,
    windows: pd.DataFrame,
) -> str:
    width = 980
    window_start = sample["window_start_utc"]
    window_end = sample["window_end_utc"]
    event_start = sample["event_start_utc"]
    event_end = min(sample["event_end_utc"], window_end)
    svg_parts = [
        f'<svg viewBox="0 0 {width} 172" role="img">',
        '<rect x="0" y="0" width="980" height="172" fill="#ffffff" />',
        '<line x1="0" y1="132" x2="980" y2="132" stroke="#d1d5db" />',
        snapshot_polyline(snapshots, window_start, window_end, width, 18, 92),
        bar_svg(event_start, event_end, window_start, window_end, width, 118, "#1d4ed8", "our constructed outage event"),
    ]
    for row in windows.itertuples(index=False):
        source = row.source
        if source == "PNNL_OE417_EVENT_CORRELATED":
            svg_parts.append(
                bar_svg(
                    row.source_start_utc,
                    row.source_end_utc,
                    window_start,
                    window_end,
                    width,
                    140,
                    "#b45309",
                    f"OE-417 {row.source_event_type}",
                )
            )
            if pd.notna(row.pnnl_outage_start_utc) and pd.notna(row.pnnl_outage_end_utc):
                svg_parts.append(
                    bar_svg(
                        row.pnnl_outage_start_utc,
                        row.pnnl_outage_end_utc,
                        window_start,
                        window_end,
                        width,
                        154,
                        "#7c3aed",
                        "PNNL merged outage scenario",
                    )
                )
        elif source == "NOAA_STORM_EVENTS":
            svg_parts.append(
                bar_svg(
                    row.source_start_utc,
                    row.source_end_utc,
                    window_start,
                    window_end,
                    width,
                    104,
                    "#15803d",
                    f"NOAA {row.source_event_type}",
                )
            )
    svg_parts.append("</svg>")

    rows = []
    for row in windows.head(12).itertuples(index=False):
        rows.append(
            "<tr>"
            f"<td>{html.escape(str(row.source))}</td>"
            f"<td>{html.escape(str(row.source_event_type))}</td>"
            f"<td>{html.escape(str(row.confidence))}</td>"
            f"<td>{html.escape(str(row.source_start_utc))}</td>"
            f"<td>{html.escape(str(row.source_end_utc))}</td>"
            "</tr>"
        )
    table = "".join(rows) if rows else '<tr><td colspan="5">No source windows.</td></tr>'
    max_out = snapshots["customers_out"].max() if not snapshots.empty else 0
    return f"""
<section class="timeline-card">
  <h2>{html.escape(str(sample['county']))} County, {html.escape(str(sample['event_id']))}</h2>
  <p class="meta">
    reason: {html.escape(str(sample['sample_reason']))} ·
    best source: {html.escape(str(sample['best_cause_source']))} ·
    duration: {float(sample['duration_hours']):,.2f}h ·
    max customers: {int(sample['max_customers']):,} ·
    raw-window max customers: {float(max_out):,.0f}
  </p>
  <div class="legend">
    <span><b class="line"></b>EAGLE-I raw snapshots</span>
    <span><b class="event"></b>Our event</span>
    <span><b class="noaa"></b>NOAA</span>
    <span><b class="oe"></b>OE-417</span>
    <span><b class="pnnl"></b>PNNL outage</span>
  </div>
  {''.join(svg_parts)}
  <table>
    <thead><tr><th>Source</th><th>Type</th><th>Confidence</th><th>Start</th><th>End</th></tr></thead>
    <tbody>{table}</tbody>
  </table>
</section>
"""


def build_timeline_review_samples(
    events: pd.DataFrame,
    enriched_preview: pd.DataFrame,
    noaa_matches: pd.DataFrame,
    pnnl_matches: pd.DataFrame,
    config: PilotConfig,
    output_dir: Path,
) -> None:
    ensure_dir(output_dir)
    samples = select_timeline_events(enriched_preview, config)
    samples.to_csv(output_dir / "timeline_samples.csv", index=False)
    snapshots = load_raw_snapshots(samples)
    if not snapshots.empty:
        snapshots.to_parquet(output_dir / "raw_snapshot_samples.parquet", index=False)

    cards = []
    for sample in samples.itertuples(index=False):
        sample_series = pd.Series(sample._asdict())
        event_id = sample_series["event_id"]
        snap = snapshots[
            (snapshots["fips"] == sample_series["fips"])
            & (snapshots["run_start_time"] >= sample_series["window_start_utc"])
            & (snapshots["run_start_time"] <= sample_series["window_end_utc"])
        ].copy()
        snap.to_csv(output_dir / f"{event_id}_raw_snapshots.csv", index=False)
        windows = event_source_windows(event_id, noaa_matches, pnnl_matches)
        windows.to_csv(output_dir / f"{event_id}_source_windows.csv", index=False)
        cards.append(render_timeline_card(sample_series, snap, windows))

    html_doc = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Phase 1 Timeline Review Samples</title>
  <style>
    body {{ margin: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; background: #f8fafc; }}
    h1 {{ font-size: 24px; margin: 0 0 8px; }}
    h2 {{ font-size: 17px; margin: 0 0 6px; }}
    .note, .meta {{ color: #64748b; font-size: 13px; }}
    .timeline-card {{ background: #fff; border: 1px solid #dbe3ea; border-radius: 8px; padding: 16px; margin: 16px 0; }}
    .legend {{ display: flex; gap: 18px; flex-wrap: wrap; font-size: 12px; color: #475569; margin: 10px 0; }}
    .legend b {{ display: inline-block; width: 18px; height: 10px; margin-right: 6px; border-radius: 2px; vertical-align: -1px; }}
    .legend .line {{ height: 3px; background: #0f766e; }}
    .legend .event {{ background: #1d4ed8; }}
    .legend .noaa {{ background: #15803d; }}
    .legend .oe {{ background: #b45309; }}
    .legend .pnnl {{ background: #7c3aed; }}
    svg {{ width: 100%; height: auto; border: 1px solid #e5e7eb; border-radius: 6px; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }}
    th, td {{ border-bottom: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }}
  </style>
</head>
<body>
  <h1>Phase 1 Timeline Review Samples</h1>
  <p class="note">Raw EAGLE-I snapshots, our constructed event, PNNL/OE-417 windows, and NOAA windows. Source matches are evidence, not proof of cause.</p>
  {''.join(cards)}
</body>
</html>
"""
    (output_dir / "index.html").write_text(html_doc)


def write_reports(
    events: pd.DataFrame,
    noaa: pd.DataFrame,
    matches: pd.DataFrame,
    pnnl_matches: pd.DataFrame,
    pnnl_merged: pd.DataFrame,
    pnnl_events: pd.DataFrame,
    config: PilotConfig,
    interim_dir: Path,
    output_dir: Path,
) -> None:
    ensure_dir(interim_dir)
    ensure_dir(output_dir)

    events.to_parquet(interim_dir / "catalog_events.parquet", index=False)
    noaa.to_parquet(interim_dir / "noaa_storm_events.parquet", index=False)
    matches.to_parquet(interim_dir / "event_cause_matches_noaa.parquet", index=False)
    pnnl_matches.to_parquet(interim_dir / "event_cause_matches_pnnl.parquet", index=False)
    pnnl_merged.to_parquet(interim_dir / "pnnl_merged_events.parquet", index=False)
    pnnl_events.to_parquet(interim_dir / "pnnl_oe417_lag_matches.parquet", index=False)

    enriched_preview = build_enriched_preview(events, pnnl_matches, matches, config)
    enriched_preview.to_parquet(interim_dir / "event_enriched_preview.parquet", index=False)
    enriched_preview_csv_sample(enriched_preview).to_csv(
        output_dir / "event_enriched_preview_sample.csv", index=False
    )
    source_priority_summary(enriched_preview).to_csv(
        output_dir / "source_priority_summary.csv", index=False
    )

    matched_event_ids = set(matches["event_id"]) if not matches.empty else set()
    usable_matches = matches[matches["confidence"] != "review"] if not matches.empty else matches
    usable_matched_event_ids = set(usable_matches["event_id"]) if not usable_matches.empty else set()
    event_flags = events[["event_id", "fips", "state", "county", "year", "duration_hours", "max_customers"]].copy()
    event_flags["matched_noaa"] = event_flags["event_id"].isin(matched_event_ids)
    event_flags["usable_noaa_match"] = event_flags["event_id"].isin(usable_matched_event_ids)
    event_flags["event_quality_flag"] = "ok"
    event_flags.loc[
        event_flags["duration_hours"] > config.extreme_event_review_hours,
        "event_quality_flag",
    ] = "extreme_duration_review"
    event_flags["duration_bucket"] = duration_bucket(event_flags["duration_hours"]).astype(str)

    match_rate_by_year = (
        event_flags.groupby("year", dropna=False)
        .agg(
            events=("event_id", "count"),
            noaa_matched_events=("matched_noaa", "sum"),
            usable_noaa_matched_events=("usable_noaa_match", "sum"),
            match_rate=("matched_noaa", "mean"),
            usable_match_rate=("usable_noaa_match", "mean"),
            extreme_duration_review_events=(
                "event_quality_flag",
                lambda s: int((s == "extreme_duration_review").sum()),
            ),
            median_duration_hours=("duration_hours", "median"),
            p95_duration_hours=("duration_hours", lambda s: s.quantile(0.95)),
        )
        .reset_index()
    )
    match_rate_by_year.to_csv(output_dir / "match_rate_by_year.csv", index=False)

    threshold_rows = []
    for threshold in [1, 4, 8, 12, 24]:
        subset = event_flags[event_flags["duration_hours"] >= threshold]
        threshold_rows.append(
            {
                "threshold_hours": threshold,
                "events": int(len(subset)),
                "noaa_matched_events": int(subset["matched_noaa"].sum()),
                "usable_noaa_matched_events": int(subset["usable_noaa_match"].sum()),
                "match_rate": float(subset["matched_noaa"].mean()) if len(subset) else None,
                "usable_match_rate": float(subset["usable_noaa_match"].mean()) if len(subset) else None,
                "extreme_duration_review_events": int(
                    (subset["event_quality_flag"] == "extreme_duration_review").sum()
                ),
            }
        )
    pd.DataFrame(threshold_rows).to_csv(
        output_dir / "match_rate_by_duration_threshold.csv", index=False
    )

    if matches.empty:
        top_types = pd.DataFrame(columns=["source_event_type", "matches", "matched_events"])
    else:
        top_types = (
            matches.groupby("source_event_type")
            .agg(matches=("event_id", "count"), matched_events=("event_id", "nunique"))
            .sort_values(["matched_events", "matches"], ascending=False)
            .reset_index()
        )
    top_types.to_csv(output_dir / "top_noaa_event_types.csv", index=False)

    unmatched_long = event_flags[
        (~event_flags["matched_noaa"]) & (event_flags["duration_hours"] >= 12)
    ].sort_values(["duration_hours", "max_customers"], ascending=False)
    unmatched_long.head(100).to_csv(output_dir / "unmatched_long_events.csv", index=False)

    event_quality_summary = (
        event_flags.groupby(["year", "event_quality_flag"], dropna=False)
        .agg(
            events=("event_id", "count"),
            median_duration_hours=("duration_hours", "median"),
            p95_duration_hours=("duration_hours", lambda s: s.quantile(0.95)),
            max_duration_hours=("duration_hours", "max"),
            max_customers=("max_customers", "max"),
        )
        .reset_index()
    )
    event_quality_summary.to_csv(output_dir / "event_quality_flags.csv", index=False)
    event_flags[event_flags["event_quality_flag"] == "extreme_duration_review"].sort_values(
        ["duration_hours", "max_customers"], ascending=False
    ).head(100).to_csv(output_dir / "extreme_duration_review_events.csv", index=False)

    pnnl_event_construction_comparison(events, pnnl_merged).to_csv(
        output_dir / "pnnl_event_construction_comparison.csv", index=False
    )
    pnnl_lag_comparison(pnnl_events).to_csv(
        output_dir / "pnnl_oe417_lag_comparison.csv", index=False
    )
    pnnl_match_summary(events, pnnl_matches).to_csv(
        output_dir / "pnnl_match_rate_by_duration_threshold.csv", index=False
    )

    manual_sample = build_manual_review_sample(events, matches)
    manual_sample.to_csv(output_dir / "manual_review_sample.csv", index=False)
    build_timeline_review_samples(
        events=events,
        enriched_preview=enriched_preview,
        noaa_matches=matches,
        pnnl_matches=pnnl_matches,
        config=config,
        output_dir=output_dir / "timeline_review_samples",
    )

    summary = {
        "catalog_id": config.catalog_id,
        "state": config.state,
        "years": list(config.years),
        "buffer_before_hours": config.buffer_before_hours,
        "buffer_after_hours": config.buffer_after_hours,
        "extreme_event_review_hours": config.extreme_event_review_hours,
        "catalog_events": int(len(events)),
        "noaa_records_total": int(len(noaa)),
        "noaa_county_records": int((noaa["geo_match_level"] == "county").sum()),
        "noaa_zone_records": int((noaa["geo_match_level"] == "zone").sum()),
        "noaa_matches": int(len(matches)),
        "noaa_matched_events": int(len(matched_event_ids)),
        "usable_noaa_matches": int(len(usable_matches)),
        "usable_noaa_matched_events": int(len(usable_matched_event_ids)),
        "noaa_match_rate": float(len(matched_event_ids) / len(events)) if len(events) else None,
        "usable_noaa_match_rate": float(len(usable_matched_event_ids) / len(events))
        if len(events)
        else None,
        "extreme_duration_review_events": int(
            (event_flags["event_quality_flag"] == "extreme_duration_review").sum()
        ),
        "pnnl_merged_events": int(len(pnnl_merged)),
        "pnnl_oe417_lag_rows": int(len(pnnl_events)),
        "pnnl_match_rows": int(len(pnnl_matches)),
        "pnnl_matched_events": int(pnnl_matches["event_id"].nunique())
        if not pnnl_matches.empty
        else 0,
        "pnnl_first_labeled_events": int(
            (enriched_preview["best_cause_source"] == "PNNL_OE417_EVENT_CORRELATED").sum()
        ),
        "noaa_fallback_labeled_events": int(
            (enriched_preview["best_cause_source"] == "NOAA_STORM_EVENTS").sum()
        ),
        "unknown_events": int((enriched_preview["best_cause_source"] == "unknown").sum()),
        "timestamp_policy": "EAGLE-I catalog timestamps are timezone-naive UTC. NOAA local-standard times are converted to timezone-naive UTC using CZ_TIMEZONE offsets. PNNL/OE-417 timestamps are used as published by the PNNL package for this pilot and need direct OE-417 timezone audit before production use.",
        "interpretation": "Matches are evidence, not proof of cause. NOAA matching is anchored to outage onset, not the full outage duration. Unmatched events are not evidence of no cause.",
    }
    (output_dir / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    (output_dir / "README.md").write_text(report_readme(summary) + "\n")


def pnnl_event_construction_comparison(
    events: pd.DataFrame, pnnl_merged: pd.DataFrame
) -> pd.DataFrame:
    ours = events.copy()
    theirs = pnnl_merged.copy()
    ours["duration_bucket"] = duration_bucket(ours["duration_hours"]).astype(str)
    theirs["duration_bucket"] = duration_bucket(theirs["duration"]).astype(str)
    rows = []

    for year in sorted(set(ours["year"]).union(set(theirs["year"]))):
        ours_y = ours[ours["year"] == year]
        theirs_y = theirs[theirs["year"] == year]
        rows.append(
            {
                "year": year,
                "metric": "all",
                "our_events": int(len(ours_y)),
                "pnnl_merged_events": int(len(theirs_y)),
                "difference_our_minus_pnnl": int(len(ours_y) - len(theirs_y)),
                "our_p95_duration_hours": float(ours_y["duration_hours"].quantile(0.95))
                if len(ours_y)
                else None,
                "pnnl_p95_duration_hours": float(theirs_y["duration"].quantile(0.95))
                if len(theirs_y)
                else None,
            }
        )
        for threshold in [1, 4, 8, 12, 24]:
            ours_n = int((ours_y["duration_hours"] >= threshold).sum())
            theirs_n = int((theirs_y["duration"] >= threshold).sum())
            rows.append(
                {
                    "year": year,
                    "metric": f"duration_ge_{threshold}h",
                    "our_events": ours_n,
                    "pnnl_merged_events": theirs_n,
                    "difference_our_minus_pnnl": ours_n - theirs_n,
                    "our_p95_duration_hours": None,
                    "pnnl_p95_duration_hours": None,
                }
            )
    return pd.DataFrame(rows)


def pnnl_lag_comparison(pnnl_events: pd.DataFrame) -> pd.DataFrame:
    if pnnl_events.empty:
        return pd.DataFrame(
            columns=[
                "year",
                "lag_rule",
                "rows",
                "unique_outage_start_fips",
                "unique_oe417_events",
                "top_event_type",
            ]
        )
    key = pnnl_events["fips"].astype(str) + "|" + pnnl_events["start_time"].astype(str)
    df = pnnl_events.assign(outage_key=key)
    top = (
        df.groupby(["year", "lag_rule", "Event Type"])
        .size()
        .rename("type_rows")
        .reset_index()
        .sort_values(["year", "lag_rule", "type_rows"], ascending=[True, True, False])
    )
    top = top.drop_duplicates(["year", "lag_rule"]).set_index(["year", "lag_rule"])
    rows = []
    for (year, lag), group in df.groupby(["year", "lag_rule"], sort=True):
        top_event_type = None
        if (year, lag) in top.index:
            top_event_type = top.loc[(year, lag), "Event Type"]
        rows.append(
            {
                "year": int(year),
                "lag_rule": lag,
                "rows": int(len(group)),
                "unique_outage_start_fips": int(group["outage_key"].nunique()),
                "unique_oe417_events": int(group["event_id"].nunique()),
                "top_event_type": top_event_type,
            }
        )
    return pd.DataFrame(rows)


def build_manual_review_sample(events: pd.DataFrame, matches: pd.DataFrame) -> pd.DataFrame:
    if matches.empty:
        return events.sort_values("duration_hours", ascending=False).head(30)

    ranked_matches = matches.sort_values(
        ["confidence", "match_score", "duration_hours"],
        ascending=[True, False, False],
    )
    high = ranked_matches[ranked_matches["confidence"] == "high"].head(20)
    medium = ranked_matches[ranked_matches["confidence"] == "medium"].head(20)
    review = ranked_matches[ranked_matches["confidence"] == "review"].head(20)
    matched = set(matches["event_id"])
    unmatched_long = events[~events["event_id"].isin(matched)].sort_values(
        ["duration_hours", "max_customers"], ascending=False
    )
    unmatched_long = unmatched_long.head(20).assign(
        source=pd.NA,
        source_event_id=pd.NA,
        source_event_type=pd.NA,
        source_start_utc=pd.NaT,
        source_end_utc=pd.NaT,
        match_score=pd.NA,
        confidence="unmatched",
        notes="long event with no NOAA county/time match under pilot rule",
    )
    cols = [
        "event_id",
        "fips",
        "state",
        "county",
        "event_start_utc",
        "event_end_utc",
        "duration_hours",
        "max_customers",
        "source",
        "source_event_id",
        "source_event_type",
        "source_start_utc",
        "source_end_utc",
        "match_score",
        "confidence",
        "notes",
    ]
    unmatched_long = unmatched_long.rename(
        columns={"start_time": "event_start_utc", "end_time": "event_end_utc"}
    )
    return pd.concat([high[cols], medium[cols], review[cols], unmatched_long[cols]], ignore_index=True)


def report_readme(summary: dict) -> str:
    return f"""# Phase 1 Cause Attribution Pilot

Catalog: `{summary['catalog_id']}`

State: {summary['state']}

Years: {', '.join(str(y) for y in summary['years'])}

## Summary

| Metric | Value |
|---|---:|
| Catalog outage events | {summary['catalog_events']:,} |
| NOAA records | {summary['noaa_records_total']:,} |
| NOAA county records | {summary['noaa_county_records']:,} |
| NOAA zone records not matched in v1 | {summary['noaa_zone_records']:,} |
| NOAA match rows | {summary['noaa_matches']:,} |
| NOAA matched outage events | {summary['noaa_matched_events']:,} |
| NOAA event match rate | {summary['noaa_match_rate']:.2%} |
| Usable NOAA matched outage events | {summary['usable_noaa_matched_events']:,} |
| Usable NOAA event match rate | {summary['usable_noaa_match_rate']:.2%} |
| Extreme-duration review events | {summary['extreme_duration_review_events']:,} |
| Extreme-duration review threshold | > {summary['extreme_event_review_hours']:,} hours |
| PNNL merged events | {summary['pnnl_merged_events']:,} |
| PNNL OE-417 lag rows | {summary['pnnl_oe417_lag_rows']:,} |
| PNNL match rows | {summary['pnnl_match_rows']:,} |
| PNNL matched outage events | {summary['pnnl_matched_events']:,} |
| PNNL-first labeled events | {summary['pnnl_first_labeled_events']:,} |
| NOAA fallback labeled events | {summary['noaa_fallback_labeled_events']:,} |
| Unknown events | {summary['unknown_events']:,} |

## Timestamp Policy

{summary['timestamp_policy']}

## Interpretation

{summary['interpretation']}

## Files

- `match_rate_by_year.csv`
- `match_rate_by_duration_threshold.csv`
- `top_noaa_event_types.csv`
- `unmatched_long_events.csv`
- `event_quality_flags.csv`
- `extreme_duration_review_events.csv`
- `pnnl_event_construction_comparison.csv`
- `pnnl_oe417_lag_comparison.csv`
- `pnnl_match_rate_by_duration_threshold.csv`
- `source_priority_summary.csv`
- `event_enriched_preview_sample.csv`
- `timeline_review_samples/index.html`
- `manual_review_sample.csv`
- `summary.json`
"""


def run(config: PilotConfig) -> None:
    base_raw = REPO_ROOT / "curated_outage_data" / "data" / "raw" / "cause_attribution"
    noaa_raw = ensure_dir(base_raw / "noaa")
    pnnl_raw = ensure_dir(base_raw / "pnnl")
    interim_dir = (
        REPO_ROOT
        / "curated_outage_data"
        / "data"
        / "interim"
        / "cause_attribution"
        / config.label
    )
    output_dir = (
        REPO_ROOT
        / "curated_outage_data"
        / "outputs"
        / "phase_1_cause_attribution"
        / config.label
    )

    events = load_catalog_events(config)
    noaa = load_noaa_events(config, noaa_raw)
    matches = match_noaa_to_events(events, noaa, config)
    pnnl_merged, pnnl_events = load_pnnl(config, pnnl_raw)
    pnnl_matches = match_pnnl_to_events(events, pnnl_events, config)

    write_reports(
        events=events,
        noaa=noaa,
        matches=matches,
        pnnl_matches=pnnl_matches,
        pnnl_merged=pnnl_merged,
        pnnl_events=pnnl_events,
        config=config,
        interim_dir=interim_dir,
        output_dir=output_dir,
    )

    print(f"Wrote interim artifacts to {interim_dir}")
    print(f"Wrote QA reports to {output_dir}")


def parse_years(value: str) -> tuple[int, ...]:
    years = tuple(int(part.strip()) for part in value.split(",") if part.strip())
    if not years:
        raise argparse.ArgumentTypeError("At least one year is required")
    return years


def main(argv: Iterable[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog-id", default="eagle-i-45min")
    parser.add_argument("--state", default="Florida")
    parser.add_argument("--years", type=parse_years, default=(2017, 2020))
    parser.add_argument("--buffer-before-hours", type=float, default=6.0)
    parser.add_argument("--buffer-after-hours", type=float, default=12.0)
    parser.add_argument("--extreme-event-review-hours", type=float, default=336.0)
    parser.add_argument("--timeline-sample-size", type=int, default=12)
    args = parser.parse_args(argv)

    config = PilotConfig(
        catalog_id=args.catalog_id,
        state=args.state,
        years=tuple(args.years),
        buffer_before_hours=args.buffer_before_hours,
        buffer_after_hours=args.buffer_after_hours,
        extreme_event_review_hours=args.extreme_event_review_hours,
        timeline_sample_size=args.timeline_sample_size,
    )
    run(config)


if __name__ == "__main__":
    main()
