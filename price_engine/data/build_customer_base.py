"""build_customer_base.py — the validated customer-base denominator (replaces raw MCC where it's wrong).

WHY: MCC.csv (EAGLE-I modeled customer count) is wrong for many counties → mean_customers/MCC explodes →
implausible premiums. See docs/dicsscssion/premium_implausibility_investigation/.

KEY: the right denominator is Census **HOUSING UNITS** (B25001), not households (B11001) — every home,
INCLUDING seasonal/vacation, has an electric meter. Households (occupied only) under-counts vacation
counties (Adirondacks, Sierra Nevada, lake country: housing units up to ~4.6× households), which is why an
earlier households-based fix left those over-priced (Hamilton NY share-out 7.15%). MCC/housing-units is
tight (median ~1.10, r 0.976).

Policy (per county):
  cap_ref  = max(MCC, housing_units)                 best estimate of the true customer base
  EXCLUDE  if observed peak-out > 1.5 × cap_ref      customers_out implausibly exceeds the base → numerator
                                                     corrupt, would UNDER-price → don't price (e.g. Henderson)
  base     = max(MCC, housing_units, peak)           ≥ peak (no event > 100%), ≥ homes (counts seasonal),
                                                     ≥ utility count (keeps commercial uplift where real)

Inputs:  raw/MCC.csv · raw/acs_county_2022.json (cached ACS-2022 B11001 households + B25001 housing units;
         fetched once via CENSUS_API_KEY) · events.parquet (observed peak). Output: customer_base.csv.

Run:  ./.venv/bin/python price_engine/data/build_customer_base.py
"""
from __future__ import annotations
import json
from pathlib import Path
import numpy as np
import pandas as pd
import requests

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
RAW = HERE / "raw"
ACS_CACHE = RAW / "acs_county_2022.json"
OUT = HERE / "customer_base.csv"

EXCLUDE_PEAK_MULT = 1.5   # peak-out > this × max(MCC, housing_units) → outage data corrupt, exclude
ACS_URL = "https://api.census.gov/data/2022/acs/acs5?get=NAME,B11001_001E,B25001_001E&for=county:*&key={key}"


def census_key() -> str:
    env = (REPO / "docs/extra/location_features/.env").read_text().splitlines()
    return next(l.split("=", 1)[1].strip() for l in env if l.startswith("CENSUS_API_KEY="))


def load_acs() -> pd.DataFrame:
    if ACS_CACHE.exists():
        rows = json.loads(ACS_CACHE.read_text())
    else:
        r = requests.get(ACS_URL.format(key=census_key()), timeout=60)
        r.raise_for_status()
        rows = r.json()
        RAW.mkdir(parents=True, exist_ok=True)
        ACS_CACHE.write_text(json.dumps(rows))
    acs = pd.DataFrame(rows[1:], columns=rows[0]).rename(columns={"B11001_001E": "households", "B25001_001E": "housing_units"})
    for c in ("households", "housing_units"):
        acs[c] = pd.to_numeric(acs[c], errors="coerce")
    acs["fips"] = (acs["state"].astype(str).str.zfill(2) + acs["county"].astype(str).str.zfill(3)).astype(int)
    return acs.set_index("fips")[["households", "housing_units"]]


def load_mcc() -> pd.Series:
    m = pd.read_csv(RAW / "MCC.csv", dtype={"County_FIPS": str})
    m.columns = [c.lstrip("﻿").strip() for c in m.columns]
    m = m[m["County_FIPS"].str.fullmatch(r"\d+")].copy()
    m["fips"] = m["County_FIPS"].astype(int)
    m["mcc"] = pd.to_numeric(m["Customers"], errors="coerce")
    return m.set_index("fips")["mcc"]


def main() -> None:
    acs = load_acs()
    mcc = load_mcc()
    peak = pd.read_parquet(HERE / "events.parquet", columns=["fips", "max_customers"]).groupby("fips")["max_customers"].max()

    recs = []
    for f in sorted(set(mcc.index) | set(acs.index)):
        m = float(mcc[f]) if f in mcc.index and pd.notna(mcc[f]) else None
        hu = float(acs.loc[f, "housing_units"]) if f in acs.index and pd.notna(acs.loc[f, "housing_units"]) else None
        hh = float(acs.loc[f, "households"]) if f in acs.index and pd.notna(acs.loc[f, "households"]) else None
        pk = float(peak[f]) if f in peak.index and pd.notna(peak[f]) else None

        cap_ref = max([v for v in (m, hu) if v is not None], default=None)   # best base estimate
        cand = [v for v in (m, hu, pk) if v is not None]
        base = max(cand) if cand else None

        excluded, reason, status = False, "", "mcc_ok"
        if base is None:
            excluded, reason, status = True, "no_base", "excluded"
        elif pk is not None and cap_ref is not None and pk > EXCLUDE_PEAK_MULT * cap_ref:
            excluded, reason, status = True, "peak_exceeds_base", "excluded"   # numerator corrupt
        elif base == m:
            status = "mcc_ok"
        elif base == hu:
            status = "housing_floor"            # MCC under-counted (seasonal) → housing units is the base
        else:
            status = "peak_floor"               # base pinned to observed peak

        recs.append({
            "fips": f, "mcc_raw": m, "households": hh, "housing_units": hu, "peak": int(pk) if pk is not None else None,
            "base": round(base) if base is not None else None, "status": status,
            "excluded": excluded, "reason": reason,
        })

    df = pd.DataFrame(recs)
    df.to_csv(OUT, index=False)
    print(f"customer_base: {len(df)} counties")
    print(df["status"].value_counts().to_string())
    print(f"excluded: {int(df['excluded'].sum())} (peak_exceeds_base {int((df.reason=='peak_exceeds_base').sum())}, no_base {int((df.reason=='no_base').sum())})")
    print(f"wrote {OUT.relative_to(REPO)}")


if __name__ == "__main__":
    main()
