"""Census cartographic-boundary county-subdivision (town) POLYGONS for NE.

Source (PINNED): Census 2023 cartographic boundary, county subdivisions, 500k,
per state:
  https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_<SS>_cousub_500k.zip
Cached under data/raw/census_boundaries/. We join on (state, normalized town
name) — NOT the CT county FIPS (2022 planning-region change), same rule as the
gazetteer. Returns EPSG:4326.
"""
from __future__ import annotations
import sys
from pathlib import Path
import pandas as pd
import requests
import geopandas as gpd

LIB = Path(__file__).resolve().parent
sys.path.insert(0, str(LIB))
from census_gazetteer import normalize_name      # noqa: E402

ROOT = Path(__file__).resolve().parents[2]        # .../location_features
RAW = ROOT / 'data' / 'raw' / 'census_boundaries'
URL = 'https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_{ss}_cousub_500k.zip'
NE_STATES = {'09': 'CT', '25': 'MA', '44': 'RI'}


def _cache_zip(ss: str) -> Path:
    RAW.mkdir(parents=True, exist_ok=True)
    z = RAW / f'cb_2023_{ss}_cousub_500k.zip'
    if not z.exists():
        r = requests.get(URL.format(ss=ss), timeout=60)
        r.raise_for_status()
        z.write_bytes(r.content)
    return z


def load_town_polygons(states: dict | None = None) -> gpd.GeoDataFrame:
    states = states or NE_STATES
    frames = []
    for ss, usps in states.items():
        g = gpd.read_file(_cache_zip(ss)).to_crs(4326)
        g['state_usps'] = usps
        g['name_norm'] = g['NAME'].map(normalize_name)
        frames.append(g[['state_usps', 'NAME', 'NAMELSAD', 'GEOID', 'name_norm', 'geometry']])
    return gpd.GeoDataFrame(pd.concat(frames, ignore_index=True), crs='EPSG:4326')


if __name__ == '__main__':
    g = load_town_polygons()
    print(f'{len(g)} town polygons; states {sorted(g.state_usps.unique())}')
    print(g[['state_usps', 'NAME', 'GEOID']].head())
