"""
Resolve a repo-relative data path to either the LOCAL repo file or the GCS bucket object, based on
ONE env var, OUTAGE_PRICING_DATA_ROOT:

  unset             -> resolve under the local repo (today's behavior; offline-friendly)
  gs://<bucket>     -> resolve under the bucket, mapping the repo tree to the lake layout
                       (sources/  catalogs/  derived/  app/)

So flipping the whole pipeline local<->GCS is one env var. Pair with `gcs_io` to read/write.

  export OUTAGE_PRICING_DATA_ROOT=gs://infrasure-outage-pricing-data   # read/write the bucket
  (unset)                                                              # local repo

Lake-layout map (repo path -> bucket key):
  price_engine/data/raw/eaglei_outages_*.csv  -> sources/eagle_i/*
  price_engine/data/raw/MCC.csv               -> sources/mcc/MCC.csv
  price_engine/data/raw/acs_county_*.json     -> sources/acs/*
  price_engine/data/raw/{DQI,coverage_*}.csv  -> sources/reference/*
  price_engine/catalogs/<id>/...              -> catalogs/<id>/...
  price_engine/data/customer_base.csv         -> derived/customer_base.csv
  curated_outage_data/outputs/<x>             -> derived/<x>
  notebooks/outputs/<x>                       -> derived/notebooks/<x>
  price_engine/data/<working>                 -> working/<working>   (events.parquet etc. — Wave 2)
  price_engine/filtration/<working>           -> working/filtration/<working>   (county_tiers.csv)
"""
from __future__ import annotations

import os
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
_ROOT = os.environ.get("OUTAGE_PRICING_DATA_ROOT", "").strip().rstrip("/")


def using_gcs() -> bool:
    return _ROOT.startswith("gs://")


def root_label() -> str:
    return _ROOT if using_gcs() else f"(local) {REPO}"


def _bucket_key(rel: str) -> str:
    if rel.startswith("price_engine/data/raw/"):
        f = rel[len("price_engine/data/raw/") :]
        if f.startswith("eaglei_outages_"):
            return "sources/eagle_i/" + f
        if f == "MCC.csv":
            return "sources/mcc/MCC.csv"
        if f.startswith("acs_county"):
            return "sources/acs/" + f
        return "sources/reference/" + f
    if rel.startswith("price_engine/catalogs/"):
        return "catalogs/" + rel[len("price_engine/catalogs/") :]
    if rel == "price_engine/data/customer_base.csv":
        return "derived/customer_base.csv"
    if rel.startswith("curated_outage_data/outputs/"):
        return "derived/" + rel[len("curated_outage_data/outputs/") :]
    if rel.startswith("notebooks/outputs/"):
        return "derived/notebooks/" + rel[len("notebooks/outputs/") :]
    if rel.startswith("price_engine/data/"):  # working intermediates (events.parquet, county_*) — Wave 2
        return "working/" + rel[len("price_engine/data/") :]
    if rel.startswith("price_engine/filtration/"):  # filtration intermediates (county_tiers.csv)
        return "working/filtration/" + rel[len("price_engine/filtration/") :]
    if rel.startswith("price_engine/pricing/"):  # pricing outputs (county_premiums.csv, drilldown, event_evidence/)
        return "working/pricing/" + rel[len("price_engine/pricing/") :]
    raise ValueError(f"data_paths: no bucket mapping for {rel!r}")


def resolve(rel: str | Path) -> str:
    """repo-relative posix path -> local absolute path (str) or gs:// URI."""
    rel = str(rel).replace("\\", "/").lstrip("/")
    if using_gcs():
        return f"{_ROOT}/{_bucket_key(rel)}"
    return str(REPO / rel)
