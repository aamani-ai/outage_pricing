"""Step 2b (canopy) — does NLCD tree canopy add lift BEYOND density?

Reusable analysis behind the canopy onboarding notebook. Run as a script to
print the headline table; import load_joined / county_stats from the notebook so
the notebook and the script never drift.

Logic: within each county, compare three Spearman correlations with the
within-county relative — density, canopy, and canopy-vs-density (collinearity) —
plus the PARTIAL Spearman of canopy given density. A positive partial means
canopy carries signal the density proxy misses; ~0 means density already
captures the rurality and canopy is redundant (the parsimony outcome).
"""
import sys
from pathlib import Path
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / 'lib'))
import town_density_vs_size as tds   # noqa: E402
import nlcd_canopy as nc             # noqa: E402

T_HOURS = [1, 2, 4, 8]
PRIMARY_T = 4
MIN_UNITS = 4


def load_canopy():
    return pd.read_csv(nc.RAW / 'town_canopy.csv')


def load_joined(cells, towns, canopy, T):
    tw = tds.join_landarea(tds.town_table(cells, T), towns)
    tw = tw.merge(canopy[['state', 'county', 'city', 'canopy_pct']],
                  on=['state', 'county', 'city'], how='left')
    return tw[tw['aland_sqkm'].notna() & tw['canopy_pct'].notna() & tw['rel'].notna()].copy()


def partial_spear(d, c, y):
    """partial Spearman(canopy c, relative y | density d) in one county."""
    r_cy, r_cd, r_dy = tds.spearman(c, y), tds.spearman(c, d), tds.spearman(d, y)
    if any(np.isnan([r_cy, r_cd, r_dy])):
        return np.nan
    denom = np.sqrt(max(1e-9, 1 - r_cd ** 2) * max(1e-9, 1 - r_dy ** 2))
    return (r_cy - r_cd * r_dy) / denom


def county_stats(df):
    rd, rc, rcd, pp = [], [], [], []
    for _, g in df[df['towns_in_county'] >= MIN_UNITS].groupby(['state', 'county']):
        if len(g) >= MIN_UNITS:
            rd.append(tds.spearman(g['density'], g['rel']))
            rc.append(tds.spearman(g['canopy_pct'], g['rel']))
            rcd.append(tds.spearman(g['canopy_pct'], g['density']))
            pp.append(partial_spear(g['density'].values, g['canopy_pct'].values, g['rel'].values))
    f = lambda a: float(np.nanmedian(a))
    return dict(rho_dens=f(rd), rho_canopy=f(rc), rho_canopy_dens=f(rcd),
                partial_canopy=f(pp), n_counties=len([x for x in rd if not np.isnan(x)]))


def main():
    cells = pd.read_csv(tds.TARGET)
    towns = tds.gaz.load_towns()
    canopy = load_canopy()
    ok = canopy['canopy_pct'].notna()
    print(f'[canopy] {ok.sum()}/{len(canopy)} towns have a value; '
          f'median {canopy.loc[ok, "canopy_pct"].median():.0f}%, '
          f'range {canopy.loc[ok, "canopy_pct"].min():.0f}-{canopy.loc[ok, "canopy_pct"].max():.0f}%')
    print(f'\n{"T":>3} | {"rho(dens,rel)":>13} {"rho(canopy,rel)":>15} {"rho(can,dens)":>13} | '
          f'{"partial(can|dens)":>17} | {"rel locanopy 3rd":>16} {"rel hicanopy 3rd":>16}')
    for T in T_HOURS:
        df = load_joined(cells, towns, canopy, T)
        s = county_stats(df)
        df['crank'] = df.groupby(['state', 'county'])['canopy_pct'].rank(pct=True)
        lo, hi = df[df['crank'] <= 1/3], df[df['crank'] >= 2/3]
        rl, rh = tds.wmean(lo['rel'], lo['town_tracked']), tds.wmean(hi['rel'], hi['town_tracked'])
        print(f'{T:>3} | {s["rho_dens"]:>13.3f} {s["rho_canopy"]:>15.3f} {s["rho_canopy_dens"]:>13.3f} | '
              f'{s["partial_canopy"]:>17.3f} | {rl:>16.2f} {rh:>16.2f}')
    print('\nrho(canopy,rel) POSITIVE = more canopy -> higher relative (wooded = worse).')
    print('rho(can,dens) strongly NEGATIVE = canopy & density are two views of the same rurality.')
    print('partial(can|dens) ~0 => density already captures it (parsimony); >0 => canopy adds signal.')


if __name__ == '__main__':
    main()
