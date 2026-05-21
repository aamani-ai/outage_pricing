#!/usr/bin/env python3
"""Compare generated event catalogs by continuity/gap tolerance."""

from __future__ import annotations

from pathlib import Path

import pandas as pd


REPO_ROOT = Path(__file__).resolve().parents[3]
CATALOGS = ("eagle-i-30min", "eagle-i-45min", "eagle-i-60min")
OUTPUT_DIR = REPO_ROOT / "curated_outage_data" / "outputs" / "event_catalog_gap_analysis"


def load_catalog(catalog_id: str) -> pd.DataFrame:
    path = REPO_ROOT / "price_engine" / "catalogs" / catalog_id / "data" / "events.parquet"
    cols = ["fips", "state", "county", "duration_hours", "n_snapshots", "max_customers", "year"]
    df = pd.read_parquet(path, columns=cols)
    df["catalog_id"] = catalog_id
    df["observed_minutes"] = df["n_snapshots"] * 15
    df["duration_minutes"] = df["duration_hours"] * 60
    df["bridged_minutes"] = (df["duration_minutes"] - df["observed_minutes"]).clip(lower=0)
    df["has_bridged_gap"] = df["bridged_minutes"] > 0
    return df


def q(series: pd.Series, value: float) -> float:
    return float(series.quantile(value)) if len(series) else 0.0


def catalog_summary(df: pd.DataFrame) -> dict:
    bridged = df[df["has_bridged_gap"]]
    return {
        "catalog_id": df["catalog_id"].iloc[0],
        "events": int(len(df)),
        "median_duration_hours": q(df["duration_hours"], 0.50),
        "p95_duration_hours": q(df["duration_hours"], 0.95),
        "p99_duration_hours": q(df["duration_hours"], 0.99),
        "max_duration_hours": float(df["duration_hours"].max()),
        "events_gt_14d": int((df["duration_hours"] > 336).sum()),
        "bridged_gap_events": int(len(bridged)),
        "bridged_gap_event_pct": float(len(bridged) / len(df)) if len(df) else 0.0,
        "bridged_minutes_mean_all_events": float(df["bridged_minutes"].mean()),
        "bridged_minutes_mean_when_any": float(bridged["bridged_minutes"].mean())
        if len(bridged)
        else 0.0,
        "bridged_minutes_median_when_any": q(bridged["bridged_minutes"], 0.50),
        "bridged_minutes_p90_when_any": q(bridged["bridged_minutes"], 0.90),
        "bridged_minutes_p99_when_any": q(bridged["bridged_minutes"], 0.99),
    }


def bridge_distribution(df: pd.DataFrame) -> pd.DataFrame:
    bins = [-1, 0, 15, 30, 45, 60, 90, 120, 240, 10**12]
    labels = ["0", "1-15", "16-30", "31-45", "46-60", "61-90", "91-120", "121-240", ">240"]
    bucket = pd.cut(df["bridged_minutes"], bins=bins, labels=labels, include_lowest=True)
    out = bucket.value_counts(sort=False).rename_axis("bridged_minutes_bucket").reset_index(name="events")
    out["event_pct"] = out["events"] / len(df)
    out.insert(0, "catalog_id", df["catalog_id"].iloc[0])
    return out


def state_summary(df: pd.DataFrame) -> pd.DataFrame:
    grouped = (
        df.groupby(["catalog_id", "state"], dropna=False)
        .agg(
            events=("duration_hours", "size"),
            median_duration_hours=("duration_hours", "median"),
            p95_duration_hours=("duration_hours", lambda s: s.quantile(0.95)),
            events_gt_14d=("duration_hours", lambda s: int((s > 336).sum())),
            bridged_gap_event_pct=("has_bridged_gap", "mean"),
            bridged_minutes_mean_all_events=("bridged_minutes", "mean"),
        )
        .reset_index()
    )
    return grouped.sort_values(["catalog_id", "events"], ascending=[True, False])


def florida_pilot_summary(df: pd.DataFrame) -> dict:
    fl = df[(df["state"] == "Florida") & (df["year"].isin([2017, 2020]))]
    result = catalog_summary(fl)
    result["scope"] = "Florida 2017/2020"
    return result


def write_readme(summary: pd.DataFrame, fl_summary: pd.DataFrame) -> None:
    default = summary[summary["catalog_id"] == "eagle-i-45min"].iloc[0]
    text = f"""# Event Catalog Gap Analysis

This diagnostic compares the generated 30/45/60 minute EAGLE-I event catalogs.

It uses all available generated catalog events for 2014-2025. It does not scan
raw CSV rows directly.

## Main Finding

The 45-minute catalog remains a reasonable middle setting.

At national scale:

- `eagle-i-30min` has {int(summary.loc[summary.catalog_id.eq('eagle-i-30min'), 'events'].iloc[0]):,} events.
- `eagle-i-45min` has {int(default['events']):,} events.
- `eagle-i-60min` has {int(summary.loc[summary.catalog_id.eq('eagle-i-60min'), 'events'].iloc[0]):,} events.

For the 45-minute catalog, {default['bridged_gap_event_pct']:.2%} of events
include at least one inferred bridged gap. Across all events, the average
bridged time is {default['bridged_minutes_mean_all_events']:.2f} minutes. Among
events with any bridged gap, the median bridged time is
{default['bridged_minutes_median_when_any']:.1f} minutes and the p90 is
{default['bridged_minutes_p90_when_any']:.1f} minutes.

That means the default is not mostly manufacturing continuity from large gaps.
Most events have no inferred bridged gap, but enough events do have short gaps
that a strict 15/30-minute view would likely over-fragment.

## Files

- `catalog_gap_sensitivity_summary.csv`
- `bridged_minutes_distribution.csv`
- `state_gap_sensitivity.csv`
- `fl_2017_2020_gap_sensitivity_summary.csv`

## Interpretation

`bridged_minutes` is inferred from generated events:

```text
duration_minutes - (n_snapshots * 15)
```

It is not a direct raw-source missingness audit. It measures how much unobserved
time exists inside a constructed event after the catalog's continuity rule has
bridged positive snapshots.
"""
    (OUTPUT_DIR / "README.md").write_text(text)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    frames = [load_catalog(catalog_id) for catalog_id in CATALOGS]

    summary = pd.DataFrame([catalog_summary(df) for df in frames])
    summary.to_csv(OUTPUT_DIR / "catalog_gap_sensitivity_summary.csv", index=False)

    fl_summary = pd.DataFrame([florida_pilot_summary(df) for df in frames])
    fl_summary.to_csv(OUTPUT_DIR / "fl_2017_2020_gap_sensitivity_summary.csv", index=False)

    dist = pd.concat([bridge_distribution(df) for df in frames], ignore_index=True)
    dist.to_csv(OUTPUT_DIR / "bridged_minutes_distribution.csv", index=False)

    state = pd.concat([state_summary(df) for df in frames], ignore_index=True)
    state.to_csv(OUTPUT_DIR / "state_gap_sensitivity.csv", index=False)

    write_readme(summary, fl_summary)
    print(f"Wrote gap analysis outputs to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
