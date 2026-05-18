"""
Build static event catalogs for the outage pricing dashboard.

Each catalog is a full artifact set built from the same EAGLE-I raw snapshots
with one explicit event-continuity setting. The dashboard reads these folders
directly, so there is no server-side catalog service.

Usage:
    python catalogs/build_catalogs.py
    python catalogs/build_catalogs.py --catalog eagle-i-45min
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd


ENGINE_ROOT = Path(__file__).resolve().parents[1]
CATALOG_ROOT = ENGINE_ROOT / "catalogs"
DEFAULT_CATALOG = "eagle-i-45min"


@dataclass(frozen=True)
class CatalogSpec:
    id: str
    label: str
    short_label: str
    gap_tolerance_minutes: int
    status: str
    description: str


CATALOGS = [
    CatalogSpec(
        id="eagle-i-30min",
        label="EAGLE-I · 30 min",
        short_label="30 min",
        gap_tolerance_minutes=30,
        status="conservative baseline",
        description="Bridges one missing 15-minute intermediate snapshot; useful as the stricter historical baseline.",
    ),
    CatalogSpec(
        id="eagle-i-45min",
        label="EAGLE-I · 45 min",
        short_label="45 min",
        gap_tolerance_minutes=45,
        status="recommended candidate",
        description="Bridges two missing 15-minute intermediate snapshots; current best balance from the lab sensitivity work.",
    ),
    CatalogSpec(
        id="eagle-i-60min",
        label="EAGLE-I · 60 min",
        short_label="60 min",
        gap_tolerance_minutes=60,
        status="sensitivity",
        description="Bridges three missing 15-minute intermediate snapshots; useful for over-merge sensitivity, not the default.",
    ),
]


def catalog_paths(catalog_id: str) -> dict[str, Path]:
    root = CATALOG_ROOT / catalog_id
    return {
        "root": root,
        "events": root / "data" / "events.parquet",
        "events_meta": root / "data" / "events_meta.json",
        "summary": root / "data" / "county_summary.parquet",
        "durations": root / "data" / "county_durations.parquet",
        "annualization_meta": root / "data" / "annualization_meta.json",
        "tiers": root / "filtration" / "county_tiers.csv",
        "premiums": root / "pricing" / "county_premiums.csv",
        "drilldown": root / "pricing" / "county_drilldown.json",
        "catalog": root / "catalog.json",
    }


def run(cmd: list[str]) -> None:
    print("[run ] " + " ".join(cmd), flush=True)
    subprocess.run(cmd, cwd=ENGINE_ROOT, check=True)


def build_catalog(spec: CatalogSpec, downstream_only: bool = False) -> dict:
    paths = catalog_paths(spec.id)
    for key in ("events", "summary", "durations", "tiers", "premiums", "drilldown"):
        paths[key].parent.mkdir(parents=True, exist_ok=True)

    py = sys.executable
    if not downstream_only:
        run([
            py,
            "data/02_construct_events.py",
            "--gap-tolerance-minutes",
            str(spec.gap_tolerance_minutes),
            "--out",
            str(paths["events"]),
        ])
    elif not paths["events"].exists():
        raise FileNotFoundError(f"{paths['events']} missing; cannot use --downstream-only")
    run([
        py,
        "data/03_aggregate_county.py",
        "--events",
        str(paths["events"]),
        "--out-summary",
        str(paths["summary"]),
        "--out-durations",
        str(paths["durations"]),
    ])
    run([
        py,
        "filtration/04_filter.py",
        "--summary",
        str(paths["summary"]),
        "--out",
        str(paths["tiers"]),
    ])
    run([
        py,
        "pricing/05_price.py",
        "--summary",
        str(paths["summary"]),
        "--durations",
        str(paths["durations"]),
        "--tiers",
        str(paths["tiers"]),
        "--out-csv",
        str(paths["premiums"]),
        "--out-json",
        str(paths["drilldown"]),
    ])

    return write_catalog_json(spec)


def write_catalog_json(spec: CatalogSpec) -> dict:
    paths = catalog_paths(spec.id)
    paths["catalog"].parent.mkdir(parents=True, exist_ok=True)
    meta = {}
    if paths["events_meta"].exists():
        meta = json.loads(paths["events_meta"].read_text())
    annualization = {}
    if paths["annualization_meta"].exists():
        annualization = json.loads(paths["annualization_meta"].read_text())

    tier_counts: dict[str, int] = {}
    if paths["tiers"].exists():
        tiers = pd.read_csv(paths["tiers"])
        tier_counts = {str(k): int(v) for k, v in tiers["tier"].value_counts().sort_index().items()}

    record = {
        "id": spec.id,
        "label": spec.label,
        "short_label": spec.short_label,
        "status": spec.status,
        "description": spec.description,
        "source": "EAGLE-I raw outage snapshots",
        "algorithm": "price_engine/data/02_construct_events.py",
        "gap_tolerance_minutes": spec.gap_tolerance_minutes,
        "snapshot_interval_minutes": 15,
        "threshold_customers_out_gt": 0,
        "years_processed": meta.get("years_processed", []),
        "event_count": meta.get("n_events_out"),
        "n_fips_in_events": meta.get("n_fips_in_events"),
        "duration_stats_hours": meta.get("duration_stats_hours", {}),
        "annualization": annualization,
        "tier_counts": tier_counts,
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "paths": {
            "drilldown": f"../catalogs/{spec.id}/pricing/county_drilldown.json",
            "tiers": f"../catalogs/{spec.id}/filtration/county_tiers.csv",
            "events_meta": f"../catalogs/{spec.id}/data/events_meta.json",
            "annualization_meta": f"../catalogs/{spec.id}/data/annualization_meta.json",
            "catalog": f"../catalogs/{spec.id}/catalog.json",
        },
    }
    paths["catalog"].write_text(json.dumps(record, indent=2))
    print(f"[save] {paths['catalog']}", flush=True)
    return record


def write_manifest() -> None:
    records = []
    for spec in CATALOGS:
        paths = catalog_paths(spec.id)
        if paths["catalog"].exists():
            record = json.loads(paths["catalog"].read_text())
        else:
            record = write_catalog_json(spec)
        records.append(record)

    manifest = {
        "default_catalog": DEFAULT_CATALOG,
        "catalogs": records,
        "future_comparators": [
            {
                "id": "external-event-log",
                "status": "planned",
                "description": "Normalize a third-party derived event log into this same catalog contract for model-validation comparisons.",
            }
        ],
        "updated_at": datetime.now(UTC).isoformat(timespec="seconds"),
    }
    out = CATALOG_ROOT / "manifest.json"
    out.write_text(json.dumps(manifest, indent=2))
    print(f"[save] {out}", flush=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--catalog",
        action="append",
        choices=[spec.id for spec in CATALOGS],
        help="catalog id to build; repeat for multiple. Defaults to all catalogs.",
    )
    parser.add_argument(
        "--downstream-only",
        action="store_true",
        help="reuse existing events.parquet and rebuild aggregate/filter/pricing/dashboard artifacts",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    selected = set(args.catalog or [spec.id for spec in CATALOGS])

    for spec in CATALOGS:
        if spec.id in selected:
            build_catalog(spec, downstream_only=args.downstream_only)

    write_manifest()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
