"""Audit the density -> within-county relative Spearman claim.

This is a small validation helper for the methodology appendix. The displayed
rho in the docs is the median of county-level within-county Spearman
correlations, not one pooled city-level fit. This script records the sample
structure and a simple directional sign test across county-level rhos.

Inputs:
  - PoUS-derived within-county target, via town_density_vs_size.TARGET
  - Census Gazetteer land area, via town_density_vs_size.gaz

Outputs:
  - outputs/density_spearman_significance.csv
  - outputs/density_spearman_by_county.csv
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import pandas as pd

import town_density_vs_size as tds


OUT = Path(__file__).resolve().parent / "outputs"
OUT.mkdir(parents=True, exist_ok=True)


def one_sided_sign_p(negative_count: int, n: int) -> float:
    """P(X >= negative_count), X ~ Binomial(n, 0.5)."""
    return sum(math.comb(n, k) for k in range(negative_count, n + 1)) / (2 ** n)


def by_county_rows(cells: pd.DataFrame, towns: pd.DataFrame, T: int) -> list[dict]:
    tw = tds.join_landarea(tds.town_table(cells, T), towns)
    tw = tw[tw["aland_sqkm"].notna() & tw["rel"].notna() & tw["density"].notna()].copy()
    tw = tw[tw["towns_in_county"] >= tds.MIN_UNITS]

    rows: list[dict] = []
    for (state, county), county_df in tw.groupby(["state", "county"]):
        if len(county_df) < tds.MIN_UNITS:
            continue
        rho = tds.spearman(county_df["density"], county_df["rel"])
        if np.isnan(rho):
            continue
        rows.append(
            {
                "T_hours": T,
                "state": state,
                "county": county,
                "n_towns": int(len(county_df)),
                "spearman_density_rel": float(rho),
            }
        )
    return rows


def main() -> None:
    cells = pd.read_csv(tds.TARGET)
    towns = tds.gaz.load_towns()

    county_rows: list[dict] = []
    summary_rows: list[dict] = []
    for T in tds.T_HOURS:
        rows = by_county_rows(cells, towns, T)
        county_rows.extend(rows)
        rhos = np.array([r["spearman_density_rel"] for r in rows], dtype=float)
        negative_count = int((rhos < 0).sum())
        n_counties = int(len(rows))
        p_one_sided = one_sided_sign_p(negative_count, n_counties) if n_counties else np.nan
        summary_rows.append(
            {
                "T_hours": T,
                "n_counties": n_counties,
                "n_towns_total": int(sum(r["n_towns"] for r in rows)),
                "min_towns_per_county": int(min(r["n_towns"] for r in rows)) if rows else 0,
                "max_towns_per_county": int(max(r["n_towns"] for r in rows)) if rows else 0,
                "negative_counties": negative_count,
                "pct_negative_counties": float(negative_count / n_counties) if n_counties else np.nan,
                "median_spearman_density_rel": float(np.median(rhos)) if n_counties else np.nan,
                "one_sided_sign_p": float(p_one_sided),
            }
        )

    pd.DataFrame(summary_rows).to_csv(OUT / "density_spearman_significance.csv", index=False)
    pd.DataFrame(county_rows).to_csv(OUT / "density_spearman_by_county.csv", index=False)
    print(f"wrote {OUT / 'density_spearman_significance.csv'}")
    print(f"wrote {OUT / 'density_spearman_by_county.csv'}")


if __name__ == "__main__":
    main()
