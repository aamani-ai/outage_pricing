"""MCC (EAGLE-I customer count) vs Census ACS households — denominator validation.

Question: can Census households serve as the customer-base denominator, and what is the
MCC/households relationship on the GOOD counties (so broken MCC can be repaired, not guessed)?

Reads:
  - price_engine/data/raw/MCC.csv  (via the per-customer parquet's mcc column)
  - ACS 2022 acs5 county: B11001_001E households, B25001_001E housing units, B01003_001E population
    (CENSUS_API_KEY in docs/extra/location_features/.env; raw pull cached)
  - price_engine/data/events.parquet  (observed peak customers out, the hard floor on the true base)

Writes:
  - mcc_vs_census_county.csv  (per-county: mcc, households, ratio, repaired base, corrupt flag)

Run:  .venv/bin/python docs/dicsscssion/premium_implausibility_investigation/mcc_vs_census.py
"""
from __future__ import annotations
import json
from pathlib import Path
import numpy as np
import pandas as pd
import requests

REPO = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
CACHE = HERE / "acs_county_2022.json"
ACS_URL = ("https://api.census.gov/data/2022/acs/acs5?"
           "get=NAME,B11001_001E,B25001_001E,B01003_001E&for=county:*&key={key}")


def census_key() -> str:
    env = (REPO / "docs/extra/location_features/.env").read_text().splitlines()
    return next(l.split("=", 1)[1].strip() for l in env if l.startswith("CENSUS_API_KEY="))


def load_acs() -> pd.DataFrame:
    if CACHE.exists():
        rows = json.loads(CACHE.read_text())
    else:
        r = requests.get(ACS_URL.format(key=census_key()), timeout=60)
        r.raise_for_status()
        rows = r.json()
        CACHE.write_text(json.dumps(rows))
    acs = pd.DataFrame(rows[1:], columns=rows[0]).rename(
        columns={"B11001_001E": "households", "B25001_001E": "housing_units", "B01003_001E": "population"})
    for c in ("households", "housing_units", "population"):
        acs[c] = pd.to_numeric(acs[c], errors="coerce")
    acs["fips"] = (acs["state"].astype(str).str.zfill(2) + acs["county"].astype(str).str.zfill(3)).astype(int)
    return acs


def main() -> None:
    acs = load_acs()
    pc = pd.read_parquet(REPO / "curated_outage_data/outputs/per_customer_rate/per_customer_lambda__eagle-i-45min.parquet")
    mcc = pc.dropna(subset=["mcc"]).groupby("fips")["mcc"].first().rename("mcc")
    ev = pd.read_parquet(REPO / "price_engine/data/events.parquet", columns=["fips", "max_customers"])
    peak = ev.groupby("fips")["max_customers"].max().rename("peak")

    df = acs.merge(mcc, on="fips", how="inner").merge(peak, on="fips", how="left")
    df["ratio_hh"] = df["mcc"] / df["households"]

    band = df.loc[(df["ratio_hh"] >= 0.3) & (df["ratio_hh"] <= 3), "ratio_hh"]
    RATIO = float(band.median())
    r = float(np.corrcoef(np.log10(df.loc[band.index, "mcc"]), np.log10(df.loc[band.index, "households"]))[0, 1])
    print(f"counties joined: {len(df)} | MCC/hh median {RATIO:.3f} | IQR {band.quantile(.25):.3f}-{band.quantile(.75):.3f} | log-log r {r:.3f}")
    print(f"broken: <0.1 {int((df.ratio_hh<0.1).sum())} | <0.5 {int((df.ratio_hh<0.5).sum())} | >3 {int((df.ratio_hh>3).sum())}")

    broken = df["ratio_hh"] < 0.5
    df["base_repaired"] = np.where(broken, (df["households"] * RATIO).round(), df["mcc"])
    df["corrupt_outage"] = df["peak"] > df["base_repaired"]   # even repaired base < observed peak → outage data suspect
    print(f"repair (ratio<0.5): {int(broken.sum())} | of those exclude (peak>repaired): {int((broken & df.corrupt_outage).sum())}")

    cols = ["fips", "NAME", "mcc", "households", "housing_units", "population", "peak",
            "ratio_hh", "base_repaired", "corrupt_outage"]
    out = HERE / "mcc_vs_census_county.csv"
    df[cols].sort_values("ratio_hh").to_csv(out, index=False)
    print(f"saved -> {out.relative_to(REPO)}")


if __name__ == "__main__":
    main()
