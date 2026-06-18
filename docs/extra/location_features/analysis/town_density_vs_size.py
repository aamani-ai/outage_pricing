"""Step 2b core — does town DENSITY beat raw SIZE at predicting the within-county
relative outage rate?

  density = PoUS customers-tracked / Census land area (km^2)   [a real rurality proxy]
  size    = PoUS customers-tracked                              [the Step-2a in-hand proxy]

If density and size predict the within-county relative equally well, the in-hand
size proxy is sufficient and we need no external data for the rurality signal
(parsimony win). If density is clearly stronger, the land-area join earns its place.

Inputs: PoUS target ../poweroutage_us/.../within_county_relative_rate.csv (Findings 6-7)
        + Census gazetteer land area (lib/census_gazetteer.py).
Writes aggregate stats + the joined town feature table to outputs/.
"""
from __future__ import annotations
import sys
from pathlib import Path
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent              # .../location_features/analysis
sys.path.insert(0, str(HERE / 'lib'))
import census_gazetteer as gaz                       # noqa: E402

EXTRA = HERE.parents[1]                              # .../docs/extra
TARGET = EXTRA / 'poweroutage_us' / 'analysis' / 'outputs' / 'within_county_relative_rate.csv'
OUT = HERE / 'outputs'
OUT.mkdir(parents=True, exist_ok=True)
T_HOURS = [1, 2, 4, 8]
PRIMARY_T = 4
MIN_UNITS = 4
USPS = {'Connecticut': 'CT', 'Massachusetts': 'MA', 'Rhode Island': 'RI'}


def spearman(x, y):
    x, y = pd.Series(x).rank(), pd.Series(y).rank()
    if x.std(ddof=0) == 0 or y.std(ddof=0) == 0:
        return np.nan
    return float(np.corrcoef(x, y)[0, 1])


def wmean(v, w):
    v, w = np.asarray(v, float), np.asarray(w, float)
    m = ~np.isnan(v) & (w > 0)
    return float(np.average(v[m], weights=w[m])) if m.any() else np.nan


def town_table(cells, T):
    keys = ['state', 'county', 'city']
    tw = cells.groupby(keys).agg(town_tracked=('tracked', 'sum'),
                                 nqual=(f'nqual_T{T}', 'sum')).reset_index()
    wx = (cells[f'A_T{T}'] * cells['tracked']).groupby(
        [cells['state'], cells['county'], cells['city']]).sum().reset_index(name='wx')
    tw = tw.merge(wx, on=keys)
    tw['town_A'] = tw['wx'] / tw['town_tracked']
    cmean = (tw['town_A'] * tw['town_tracked']).groupby([tw['state'], tw['county']]).transform('sum') \
        / tw['town_tracked'].groupby([tw['state'], tw['county']]).transform('sum')
    tw['rel'] = np.where(cmean > 0, tw['town_A'] / cmean, np.nan)
    tw['towns_in_county'] = tw.groupby(['state', 'county'])['city'].transform('size')
    tw['state_usps'] = tw['state'].map(USPS)
    tw['name_norm'] = tw['city'].astype(str).str.strip().str.lower()
    return tw


def join_landarea(tw, towns):
    g = (towns[['state_usps', 'name_norm', 'aland_sqkm', 'lat', 'lon']]
         .drop_duplicates(['state_usps', 'name_norm']))
    j = tw.merge(g, on=['state_usps', 'name_norm'], how='left')
    j['density'] = np.where(j['aland_sqkm'] > 0, j['town_tracked'] / j['aland_sqkm'], np.nan)
    return j


def main():
    cells = pd.read_csv(TARGET)
    towns = gaz.load_towns()
    print(f'[gazetteer] {len(towns)} NE towns; within-state name collisions: '
          f'{int(towns.duplicated(["state_usps", "name_norm"]).sum())}')

    # ---- join + match-rate audit (no silent drops) ----
    base = join_landarea(town_table(cells, PRIMARY_T), towns)
    matched = base['aland_sqkm'].notna()
    print(f'[join] {matched.sum()}/{len(base)} towns matched a gazetteer land area '
          f'({matched.mean()*100:.1f}%); {(~matched).sum()} unmatched')
    if (~matched).any():
        miss = base[~matched].sort_values('town_tracked', ascending=False).head(8)
        print('  largest unmatched (by tracked): '
              + ', '.join(f'{r.city}/{r.state_usps}({int(r.town_tracked)})' for r in miss.itertuples()))

    # ---- size vs density: which predicts the within-county relative? ----
    print(f'\n{"T":>3} | {"med rho(size,rel)":>17} {"med rho(dens,rel)":>17} | '
          f'{"rel low-dens 3rd":>16} {"rel high-dens 3rd":>17} | {"rel small 3rd":>13} {"rel large 3rd":>13}')
    rows = []
    for T in T_HOURS:
        twj = join_landarea(town_table(cells, T), towns)
        twj = twj[twj['aland_sqkm'].notna()]
        elig = twj[twj['towns_in_county'] >= MIN_UNITS]
        rs, rd = [], []
        for _, d in elig.groupby(['state', 'county']):
            dd = d.dropna(subset=['rel'])
            if len(dd) >= MIN_UNITS:
                rs.append(spearman(dd['town_tracked'], dd['rel']))
                rd.append(spearman(dd['density'], dd['rel']))
        rs = np.array([x for x in rs if not np.isnan(x)])
        rd = np.array([x for x in rd if not np.isnan(x)])
        # within-county terciles: density (low dens = rural) and size (small = rural)
        twj['drank'] = twj.groupby(['state', 'county'])['density'].rank(pct=True)
        twj['srank'] = twj.groupby(['state', 'county'])['town_tracked'].rank(pct=True)
        d_lo, d_hi = twj[twj['drank'] <= 1/3], twj[twj['drank'] >= 2/3]
        s_lo, s_hi = twj[twj['srank'] <= 1/3], twj[twj['srank'] >= 2/3]
        rel_dlo, rel_dhi = wmean(d_lo['rel'], d_lo['town_tracked']), wmean(d_hi['rel'], d_hi['town_tracked'])
        rel_slo, rel_shi = wmean(s_lo['rel'], s_lo['town_tracked']), wmean(s_hi['rel'], s_hi['town_tracked'])
        print(f'{T:>3} | {np.median(rs):>17.3f} {np.median(rd):>17.3f} | '
              f'{rel_dlo:>16.2f} {rel_dhi:>17.2f} | {rel_slo:>13.2f} {rel_shi:>13.2f}')
        rows.append({'T_hours': T, 'med_rho_size': float(np.median(rs)), 'med_rho_density': float(np.median(rd)),
                     'rel_lowdens_3rd': rel_dlo, 'rel_highdens_3rd': rel_dhi,
                     'rel_small_3rd': rel_slo, 'rel_large_3rd': rel_shi})

    pd.DataFrame(rows).to_csv(OUT / 'town_density_vs_size.csv', index=False)
    base[['state', 'county', 'city', 'town_tracked', 'aland_sqkm', 'density', 'lat', 'lon', 'rel']] \
        .to_csv(OUT / 'town_density_features.csv', index=False)

    # ---- figure: the rurality gradient (T = PRIMARY_T) ----
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    b = base[base['density'].notna() & base['rel'].notna() & (base['rel'] > 0)]
    fig, ax = plt.subplots(1, 2, figsize=(12, 4.8))
    ax[0].scatter(b['density'], b['rel'], s=np.clip(b['town_tracked'] / 200, 5, 220),
                  alpha=0.45, edgecolor='none', color='#2166ac')
    ax[0].set_xscale('log'); ax[0].set_yscale('log')
    ax[0].axhline(1.0, color='k', lw=0.8, ls='--')
    ax[0].set_xlabel('town density  (PoUS customers / km², log)')
    ax[0].set_ylabel(f'within-county relative, T>={PRIMARY_T}h (log)')
    ax[0].set_title('Lower density (rural) -> above county average')
    b = b.copy()
    b['dt'] = pd.cut(b.groupby(['state', 'county'])['density'].rank(pct=True),
                     [0, 1/3, 2/3, 1.0], labels=['low\n(rural)', 'mid', 'high\n(urban)'], include_lowest=True)
    order = ['low\n(rural)', 'mid', 'high\n(urban)']
    means = [wmean(b[b['dt'] == k]['rel'], b[b['dt'] == k]['town_tracked']) for k in order]
    ax[1].bar(order, means, color=['#b2182b', '#999999', '#2166ac'])
    ax[1].axhline(1.0, color='k', lw=0.8, ls='--')
    ax[1].set_ylabel(f'exposure-weighted relative, T>={PRIMARY_T}h')
    ax[1].set_title('Within-county relative by density tercile')
    for i, m in enumerate(means):
        ax[1].text(i, m + 0.03, f'{m:.2f}x', ha='center', fontweight='bold')
    fig.suptitle('Within-county location basis ~ rurality  (CT/MA/RI, Jan-Mar 2019)', fontweight='bold')
    fig.tight_layout()
    fig.savefig(OUT / 'town_density_vs_size.png', dpi=110, bbox_inches='tight')
    print(f'[fig] wrote {OUT / "town_density_vs_size.png"}')

    print('\n=== Reading ===')
    print('rho(size,rel) is the Step-2a result (negative = smaller towns higher). For DENSITY,')
    print('low density = rural, so rho(dens,rel) negative and rel(low-dens 3rd) > 1 > rel(high-dens 3rd)')
    print('would confirm density carries the rurality signal. Compare the density tercile gap to the')
    print('size tercile gap: if density is NOT wider, the in-hand size proxy is already sufficient.')


if __name__ == '__main__':
    main()
