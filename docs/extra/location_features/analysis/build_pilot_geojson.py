"""Build the dashboard artifact: pilot town polygons (CT/MA/RI) carrying density,
within-county density tercile, county FIPS, and the v0-shadow / empirical
relativity per threshold T. The dashboard adds this as a MapLibre layer so a user
can click a location and see county price x location relativity.

Writes -> price_engine/dashboard/data/location_basis_pilot.geojson
"""
import sys
import json
from pathlib import Path
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / 'lib'))
import town_density_vs_size as tds       # noqa: E402
import town_boundaries as tb             # noqa: E402

REPO = HERE.parents[3]
OUT_GEOJSON = REPO / 'price_engine' / 'dashboard' / 'data' / 'location_basis_pilot.geojson'
RELJSON = HERE / 'outputs' / 'density_relativity.json'
T_HOURS = [1, 2, 4, 8]
USPS = {'Connecticut': 'CT', 'Massachusetts': 'MA', 'Rhode Island': 'RI'}


def main():
    rel = json.loads(RELJSON.read_text())['relativity']           # {'T4': {'v0_shadow':[r,m,u], 'empirical':[...]}}
    cells = pd.read_csv(tds.TARGET)
    towns_gaz = tds.gaz.load_towns()

    # county FIPS (PoUS / legacy, matches the dashboard's plotly counties) per (state, county)
    cf = cells.dropna(subset=['county_fips']).copy()
    cf['county_fips'] = pd.to_numeric(cf['county_fips'], errors='coerce')
    fips_map = cf.groupby(['state', 'county'])['county_fips'].first().to_dict()

    # town density + within-county density tercile (density is T-independent; use the T=4 town table)
    tw = tds.join_landarea(tds.town_table(cells, 4), towns_gaz)
    tw = tw[tw['aland_sqkm'].notna() & (tw['density'] > 0)].copy()
    tw['drank'] = tw.groupby(['state', 'county'])['density'].rank(pct=True)
    tw['terc'] = pd.cut(tw['drank'], [0, 1/3, 2/3, 1.0], labels=False, include_lowest=True).astype(int)
    tw['tercile'] = tw['terc'].map({0: 'rural', 1: 'mid', 2: 'urban'})
    tw['county_fips'] = [int(fips_map[(s, c)]) if (s, c) in fips_map and not pd.isna(fips_map[(s, c)]) else None
                         for s, c in zip(tw['state'], tw['county'])]
    tw['state_usps'] = tw['state'].map(USPS)
    tw['name_norm'] = tw['city'].astype(str).str.strip().str.lower()

    # bake the relativity per T into each town
    for T in T_HOURS:
        tw[f'rel_T{T}'] = tw['terc'].map({i: rel[f'T{T}']['v0_shadow'][i] for i in range(3)}).round(3)
        tw[f'relemp_T{T}'] = tw['terc'].map({i: rel[f'T{T}']['empirical'][i] for i in range(3)}).round(3)

    # attach polygons (join by state + normalized town name)
    g = tb.load_town_polygons().merge(
        tw[['state_usps', 'name_norm', 'state', 'county', 'county_fips', 'city', 'density', 'tercile']
           + [f'rel_T{T}' for T in T_HOURS] + [f'relemp_T{T}' for T in T_HOURS]],
        on=['state_usps', 'name_norm'], how='inner')
    g['density'] = g['density'].round(1)

    g = g.to_crs(4326)
    g['geometry'] = g['geometry'].simplify(0.0015)               # ~150 m, web-friendly
    keep = (['state', 'county', 'county_fips', 'city', 'density', 'tercile']
            + [f'rel_T{T}' for T in T_HOURS] + [f'relemp_T{T}' for T in T_HOURS] + ['geometry'])
    OUT_GEOJSON.parent.mkdir(parents=True, exist_ok=True)
    g[keep].to_file(OUT_GEOJSON, driver='GeoJSON')
    kb = OUT_GEOJSON.stat().st_size / 1024
    print(f'wrote {len(g)} towns -> {OUT_GEOJSON}  ({kb:.0f} KB)')
    print('tercile counts:', g['tercile'].value_counts().to_dict())
    print('counties with FIPS:', int(g['county_fips'].notna().sum()), '/', len(g))


if __name__ == '__main__':
    main()
