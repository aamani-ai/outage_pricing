"""Build the within-county DENSITY RELATIVITY — the deployable location-basis
modifier: f(within-county density position) -> mean-1 frequency relativity.

Why within-county density POSITION (not absolute density): the relativity must
stay mean-1 inside each county (it redistributes; the county baseline already
owns the level). Using absolute density would double-count the county's overall
rurality. So we rank a town's density WITHIN its county and bin into terciles
(rural = sparsest third ... urban = densest third).

Construction (physics-anchored, thin-sample-robust):
  1. tercile relativity = exposure-weighted mean within-county relative;
  2. enforce MONOTONE non-increasing (denser -> safer = the physics prior);
  3. renormalize to exposure-weighted mean 1.0 (conservation);
  4. 'v0 shadow' = cap to an attribution-confidence band, then renormalize again.
We report both empirical and v0-shadow, by threshold T, and check per-county
conservation. Runtime feature = Census density only (PoUS is calibration here).

Inputs: PoUS target (within_county_relative_rate.csv) + gazetteer land area.
Outputs: outputs/density_relativity_table.csv + density_relativity.json.
"""
import sys
import json
from pathlib import Path
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / 'lib'))
import town_density_vs_size as tds   # noqa: E402

OUT = HERE / 'outputs'
OUT.mkdir(exist_ok=True)
T_HOURS = [1, 2, 4, 8]
TERCILES = ['rural', 'mid', 'urban']
MIN_TOWNS = 4
CAP = (0.80, 1.40)   # v0 shadow: attribution-confidence band (a policy choice, not the signal size)


def wmean(v, w):
    v, w = np.asarray(v, float), np.asarray(w, float)
    m = ~np.isnan(v) & (w > 0)
    return float(np.average(v[m], weights=w[m])) if m.any() else float('nan')


def monotone_decr(vals, w):
    """3-point exposure-weighted pool-adjacent-violators -> non-increasing."""
    v = list(vals)
    changed = True
    while changed:
        changed = False
        for i in range(len(v) - 1):
            if v[i] < v[i + 1] - 1e-12:
                m = (v[i] * w[i] + v[i + 1] * w[i + 1]) / (w[i] + w[i + 1])
                v[i] = v[i + 1] = m
                changed = True
    return v


def build_T(cells, towns, T):
    tw = tds.join_landarea(tds.town_table(cells, T), towns)
    tw = tw[tw['aland_sqkm'].notna() & tw['rel'].notna() & (tw['density'] > 0)
            & (tw['towns_in_county'] >= MIN_TOWNS)].copy()
    # within-county density rank -> tercile (0=rural sparsest .. 2=urban densest)
    tw['drank'] = tw.groupby(['state', 'county'])['density'].rank(pct=True)
    tw['terc'] = pd.cut(tw['drank'], [0, 1/3, 2/3, 1.0], labels=False, include_lowest=True).astype(int)

    w = [tw.loc[tw.terc == i, 'town_tracked'].sum() for i in range(3)]
    raw = [wmean(tw.loc[tw.terc == i, 'rel'], tw.loc[tw.terc == i, 'town_tracked']) for i in range(3)]
    mono = monotone_decr(raw, w)
    mono = [m / wmean(tw['terc'].map(dict(enumerate(mono))), tw['town_tracked']) for m in mono]  # renorm mean-1
    cap = [min(max(m, CAP[0]), CAP[1]) for m in mono]
    cap = [c / wmean(tw['terc'].map(dict(enumerate(cap))), tw['town_tracked']) for c in cap]      # renorm again

    tw['mod'] = tw['terc'].map(dict(enumerate(cap)))
    cc = tw.groupby(['state', 'county']).apply(lambda g: wmean(g['mod'], g['town_tracked']), include_groups=False)
    return dict(T=T, n_towns=int(len(tw)), n_counties=int(tw.groupby(['state', 'county']).ngroups),
                raw=[round(x, 3) for x in raw], empirical=[round(x, 3) for x in mono],
                v0_shadow=[round(x, 3) for x in cap],
                cmean_min=round(float(cc.min()), 3), cmean_med=round(float(cc.median()), 3),
                cmean_max=round(float(cc.max()), 3))


def main():
    cells = pd.read_csv(tds.TARGET)
    towns = tds.gaz.load_towns()
    res = [build_T(cells, towns, T) for T in T_HOURS]

    print('Within-county density relativity (mean-1). Terciles: rural / mid / urban (by density).')
    print(f'{"T":>3} | {"empirical (uncapped)":>22} | {"v0 shadow capped":>18} | {"per-county mean min/med/max":>27}')
    for r in res:
        e, s = r['empirical'], r['v0_shadow']
        print(f'{r["T"]:>3} | {e[0]:6.2f} {e[1]:6.2f} {e[2]:6.2f}      | {s[0]:5.2f} {s[1]:5.2f} {s[2]:5.2f}  | '
              f'{r["cmean_min"]:.2f} / {r["cmean_med"]:.2f} / {r["cmean_max"]:.2f}')

    table = [{'T_hours': r['T'], 'density_tercile': t,
              'relativity_empirical': r['empirical'][i], 'relativity_v0_shadow': r['v0_shadow'][i]}
             for r in res for i, t in enumerate(TERCILES)]
    pd.DataFrame(table).to_csv(OUT / 'density_relativity_table.csv', index=False)

    artifact = {
        'modifier': 'location_basis (within-county density relativity)',
        'method': 'within-county density tercile; exposure-weighted; monotone non-increasing; mean-1; v0 capped',
        'cap_v0_shadow': list(CAP),
        'terciles': TERCILES,
        'apply': 'point -> county -> density rank within the county\'s towns -> tercile -> relativity. Mean-1 within county.',
        'runtime_dependency': 'Census density only (PoUS used for calibration, not at runtime)',
        'status': 'shadow (not active pricing); validate out-of-region before activation',
        'relativity': {f'T{r["T"]}': {'empirical': r['empirical'], 'v0_shadow': r['v0_shadow']} for r in res},
    }
    (OUT / 'density_relativity.json').write_text(json.dumps(artifact, indent=2))
    print(f'\nwrote {OUT / "density_relativity_table.csv"} and density_relativity.json')


if __name__ == '__main__':
    main()
