#!/usr/bin/env python3
"""Build Connecticut legacy-county to planning-region bridge artifacts.

This script is intentionally dependency-free. It documents the Connecticut
geography transition that affects county-FIPS continuity in EAGLE-I /
PoUS-derived outage pricing artifacts.
"""

from __future__ import annotations

import csv
from collections import defaultdict
from datetime import datetime
from pathlib import Path
import re


REPO_ROOT = Path(__file__).resolve().parents[4]

TOWN_FEATURES = (
    REPO_ROOT
    / "docs/extra/location_features/analysis/outputs/town_density_features.csv"
)
CT_GAZETTEER = (
    REPO_ROOT
    / "docs/extra/location_features/data/raw/census_gazetteer/2023_gaz_cousubs_09.txt"
)
EAGLEI_2025 = REPO_ROOT / "price_engine/data/raw/eaglei_outages_2025.csv"
OUTPUT_DIR = REPO_ROOT / "docs/extra/poweroutage_us/analysis/outputs"


LEGACY_COUNTY_FIPS = {
    "Fairfield": "09001",
    "Hartford": "09003",
    "Litchfield": "09005",
    "Middlesex": "09007",
    "New Haven": "09009",
    "New London": "09011",
    "Tolland": "09013",
    "Windham": "09015",
}

PLANNING_REGION_NAMES = {
    "09110": "Capitol Planning Region",
    "09120": "Greater Bridgeport Planning Region",
    "09130": "Lower Connecticut River Valley Planning Region",
    "09140": "Naugatuck Valley Planning Region",
    "09150": "Northeastern Connecticut Planning Region",
    "09160": "Northwest Hills Planning Region",
    "09170": "South Central Connecticut Planning Region",
    "09180": "Southeastern Connecticut Planning Region",
    "09190": "Western Connecticut Planning Region",
}

KNOWN_LEGACY_COUNTY_CORRECTIONS = {
    # PoUS pilot output left Hartland as Unknown; historically it is Hartford
    # County. The 2023 Census planning-region gazetteer places it in Northwest
    # Hills Planning Region.
    "Hartland": "Hartford",
}

POUS_ALIASES = {
    # PoUS has Southport as a tracked city/cell. It is not a Connecticut
    # municipality in the Census county-subdivision gazetteer; it is a village
    # within Fairfield town.
    "Southport": {
        "planning_town_name": "Fairfield",
        "planning_region_fips": "09120",
        "bridge_status": "pous_city_alias",
        "bridge_note": "PoUS city/cell alias; mapped to Fairfield town for planning-region bridge.",
    },
}

GAZETTEER_ONLY_LEGACY_COUNTIES = {
    # Bozrah is a true CT town in the gazetteer but is absent from the PoUS pilot
    # feature table used for the CT/MA/RI calibration sample.
    "Bozrah": "New London",
}

CROSSWALK_FIELDS = [
    "legacy_county_fips",
    "legacy_county_name",
    "planning_region_fips",
    "planning_region_name",
    "planning_town_name",
    "pous_city_name",
    "pous_tracked_customers_2019q1",
    "pilot_customer_density",
    "pilot_within_county_relative_rate",
    "planning_cousub_geoid",
    "gazetteer_name",
    "gazetteer_land_area_sq_m",
    "gazetteer_lat",
    "gazetteer_lon",
    "bridge_status",
    "bridge_note",
]

OVERLAP_FIELDS = [
    "legacy_county_fips",
    "legacy_county_name",
    "planning_region_fips",
    "planning_region_name",
    "n_bridge_rows",
    "n_pous_weighted_rows",
    "pous_tracked_customers_2019q1",
    "share_of_legacy_pous_weight",
    "share_of_planning_region_pous_weight",
    "bridge_statuses",
]

TRANSITION_FIELDS = [
    "fips_code",
    "region_name",
    "fips_family",
    "first_seen",
    "last_seen",
    "raw_rows",
    "max_customers_out",
]


def town_key(name: str) -> str:
    """Normalize CT town/city/borough labels for PoUS-vs-Gazetteer joins."""

    clean = str(name or "").strip()
    clean = re.sub(r"\s+(town|city|borough)$", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\s+", " ", clean)
    return clean.lower()


def read_csv(path: Path, delimiter: str = ",") -> list[dict[str, str]]:
    with path.open(newline="") as f:
        return list(csv.DictReader(f, delimiter=delimiter))


def write_csv(path: Path, rows: list[dict[str, object]], fieldnames: list[str]) -> None:
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def as_float(value: str | None) -> float:
    if value is None or value == "":
        return 0.0
    return float(value)


def load_pous_towns() -> dict[str, dict[str, object]]:
    rows = {}
    for row in read_csv(TOWN_FEATURES):
        if row["state"] != "Connecticut":
            continue
        legacy_county = KNOWN_LEGACY_COUNTY_CORRECTIONS.get(row["city"], row["county"])
        rows[town_key(row["city"])] = {
            "legacy_county_fips": LEGACY_COUNTY_FIPS.get(legacy_county, ""),
            "legacy_county_name": legacy_county if legacy_county != "Unknown" else "",
            "pous_city_name": row["city"],
            "pous_tracked_customers_2019q1": row["town_tracked"],
            "pilot_customer_density": row["density"],
            "pilot_within_county_relative_rate": row["rel"],
        }
    return rows


def load_ct_gazetteer() -> dict[str, dict[str, object]]:
    rows = {}
    for row in read_csv(CT_GAZETTEER, delimiter="\t"):
        if row["NAME"] == "County subdivisions not defined":
            continue
        planning_region_fips = row["GEOID"][:5]
        planning_town_name = re.sub(
            r"\s+(town|city|borough)$", "", row["NAME"], flags=re.IGNORECASE
        )
        rows[town_key(planning_town_name)] = {
            "planning_region_fips": planning_region_fips,
            "planning_region_name": PLANNING_REGION_NAMES[planning_region_fips],
            "planning_town_name": planning_town_name,
            "planning_cousub_geoid": row["GEOID"],
            "gazetteer_name": row["NAME"],
            "gazetteer_land_area_sq_m": row["ALAND"],
            "gazetteer_lat": row["INTPTLAT"],
            "gazetteer_lon": row["INTPTLONG"],
        }
    return rows


def build_crosswalk() -> list[dict[str, object]]:
    pous = load_pous_towns()
    gaz = load_ct_gazetteer()
    all_keys = sorted(set(pous) | set(gaz))
    rows: list[dict[str, object]] = []

    for key in all_keys:
        row: dict[str, object] = {field: "" for field in CROSSWALK_FIELDS}
        if key in pous:
            row.update(pous[key])
        if key in gaz:
            row.update(gaz[key])

        if key in pous and key in gaz:
            row["bridge_status"] = "matched"
        elif key in pous:
            row["bridge_status"] = "pous_only"
        else:
            row["bridge_status"] = "gazetteer_only"

        display_name = str(row.get("pous_city_name") or row.get("planning_town_name"))
        if display_name in POUS_ALIASES:
            alias = POUS_ALIASES[display_name]
            target_key = town_key(str(alias["planning_town_name"]))
            if target_key in gaz:
                row.update(gaz[target_key])
            row.update(alias)
            row["planning_region_name"] = PLANNING_REGION_NAMES[
                str(alias["planning_region_fips"])
            ]

        if display_name in GAZETTEER_ONLY_LEGACY_COUNTIES:
            legacy_county = GAZETTEER_ONLY_LEGACY_COUNTIES[display_name]
            row["legacy_county_name"] = legacy_county
            row["legacy_county_fips"] = LEGACY_COUNTY_FIPS[legacy_county]
            row["bridge_note"] = (
                "True CT municipality present in Census gazetteer but absent from PoUS pilot feature table."
            )

        if row["bridge_status"] == "pous_only" and not row["bridge_note"]:
            row["bridge_note"] = "PoUS row did not match a 2023 CT county-subdivision town."
        if row["bridge_status"] == "gazetteer_only" and not row["bridge_note"]:
            row["bridge_note"] = "Census county-subdivision town absent from PoUS pilot feature table."

        if not row["pous_tracked_customers_2019q1"]:
            row["pous_tracked_customers_2019q1"] = "0"

        rows.append(row)

    return sorted(
        rows,
        key=lambda r: (
            str(r["legacy_county_fips"]),
            str(r["planning_region_fips"]),
            str(r["planning_town_name"]),
            str(r["pous_city_name"]),
        ),
    )


def build_overlap_summary(crosswalk: list[dict[str, object]]) -> list[dict[str, object]]:
    groups: dict[tuple[str, str, str, str], dict[str, object]] = {}
    legacy_totals: defaultdict[str, float] = defaultdict(float)
    region_totals: defaultdict[str, float] = defaultdict(float)

    for row in crosswalk:
        legacy_fips = str(row["legacy_county_fips"])
        planning_fips = str(row["planning_region_fips"])
        if not legacy_fips or not planning_fips:
            continue
        key = (
            legacy_fips,
            str(row["legacy_county_name"]),
            planning_fips,
            str(row["planning_region_name"]),
        )
        group = groups.setdefault(
            key,
            {
                "legacy_county_fips": legacy_fips,
                "legacy_county_name": str(row["legacy_county_name"]),
                "planning_region_fips": planning_fips,
                "planning_region_name": str(row["planning_region_name"]),
                "n_bridge_rows": 0,
                "n_pous_weighted_rows": 0,
                "pous_tracked_customers_2019q1": 0.0,
                "bridge_statuses": set(),
            },
        )
        weight = as_float(str(row["pous_tracked_customers_2019q1"]))
        group["n_bridge_rows"] = int(group["n_bridge_rows"]) + 1
        group["n_pous_weighted_rows"] = int(group["n_pous_weighted_rows"]) + int(
            weight > 0
        )
        group["pous_tracked_customers_2019q1"] = (
            float(group["pous_tracked_customers_2019q1"]) + weight
        )
        group["bridge_statuses"].add(str(row["bridge_status"]))
        legacy_totals[legacy_fips] += weight
        region_totals[planning_fips] += weight

    rows: list[dict[str, object]] = []
    for group in groups.values():
        legacy_fips = str(group["legacy_county_fips"])
        planning_fips = str(group["planning_region_fips"])
        weight = float(group["pous_tracked_customers_2019q1"])
        group["share_of_legacy_pous_weight"] = (
            weight / legacy_totals[legacy_fips] if legacy_totals[legacy_fips] else ""
        )
        group["share_of_planning_region_pous_weight"] = (
            weight / region_totals[planning_fips] if region_totals[planning_fips] else ""
        )
        group["bridge_statuses"] = ",".join(sorted(group["bridge_statuses"]))
        rows.append(group)

    return sorted(
        rows,
        key=lambda r: (
            str(r["legacy_county_fips"]),
            -float(r["share_of_legacy_pous_weight"] or 0),
            str(r["planning_region_fips"]),
        ),
    )


def parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value)


def build_eaglei_2025_transition() -> list[dict[str, object]]:
    groups: dict[str, dict[str, object]] = {}
    legacy_by_fips = {fips: name for name, fips in LEGACY_COUNTY_FIPS.items()}

    for row in read_csv(EAGLEI_2025):
        fips = row["fips_code"]
        if not fips.startswith("09"):
            continue
        timestamp = parse_timestamp(row["run_start_time"])
        if fips in legacy_by_fips:
            fips_family = "legacy_county_090xx"
            region_name = legacy_by_fips[fips]
        elif fips in PLANNING_REGION_NAMES:
            fips_family = "planning_region_091xx"
            region_name = PLANNING_REGION_NAMES[fips]
        else:
            fips_family = "other_ct"
            region_name = row["county"]

        group = groups.setdefault(
            fips,
            {
                "fips_code": fips,
                "region_name": region_name,
                "fips_family": fips_family,
                "first_seen_dt": timestamp,
                "last_seen_dt": timestamp,
                "raw_rows": 0,
                "max_customers_out": 0,
            },
        )
        group["first_seen_dt"] = min(group["first_seen_dt"], timestamp)
        group["last_seen_dt"] = max(group["last_seen_dt"], timestamp)
        group["raw_rows"] = int(group["raw_rows"]) + 1
        group["max_customers_out"] = max(
            int(group["max_customers_out"]), int(as_float(row["customers_out"]))
        )

    rows: list[dict[str, object]] = []
    for group in groups.values():
        rows.append(
            {
                "fips_code": group["fips_code"],
                "region_name": group["region_name"],
                "fips_family": group["fips_family"],
                "first_seen": group["first_seen_dt"].strftime("%Y-%m-%d %H:%M"),
                "last_seen": group["last_seen_dt"].strftime("%Y-%m-%d %H:%M"),
                "raw_rows": group["raw_rows"],
                "max_customers_out": group["max_customers_out"],
            }
        )

    return sorted(rows, key=lambda r: (str(r["fips_family"]), str(r["fips_code"])))


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    crosswalk = build_crosswalk()
    summary = build_overlap_summary(crosswalk)
    transition = build_eaglei_2025_transition()

    write_csv(
        OUTPUT_DIR / "ct_legacy_county_planning_region_town_crosswalk.csv",
        crosswalk,
        CROSSWALK_FIELDS,
    )
    write_csv(
        OUTPUT_DIR / "ct_legacy_county_planning_region_overlap_summary.csv",
        summary,
        OVERLAP_FIELDS,
    )
    write_csv(
        OUTPUT_DIR / "ct_eaglei_2025_fips_transition_summary.csv",
        transition,
        TRANSITION_FIELDS,
    )

    print(f"Wrote {len(crosswalk):,} CT bridge rows")
    print(f"Wrote {len(summary):,} overlap summary rows")
    print(f"Wrote {len(transition):,} EAGLE-I 2025 CT FIPS rows")


if __name__ == "__main__":
    main()
