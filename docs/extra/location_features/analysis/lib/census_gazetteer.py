"""Census Gazetteer (county subdivisions) — land area for New England towns.

Source (PINNED): US Census 2023 Gazetteer, county-subdivision files, per state:
  https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_gaz_cousubs_<SS>.txt
  SS = 2-digit state FIPS. Tab-separated, latin-1. **No API key required.**

Provides ALAND (land area, m^2) and the internal point (centroid lat/lon) per
town (MCD). We use land area to turn the in-hand PoUS customer count into a
DENSITY (customers / km^2) — a real rurality proxy that the Step-2a size proxy
only approximated.

GOTCHA (see ../../README.md): the 2023 gazetteer files CT towns under the NEW
2022 planning regions (GEOID county part 110, 120, ...), NOT the legacy counties
(001-015) used by EAGLE-I / PoUS. So callers must JOIN ON (state, town name),
never on the gazetteer county FIPS. Town names are unique within a NE state.

Caches raw bytes under data/raw/census_gazetteer/ (pin + cache principle).
"""
from __future__ import annotations
from pathlib import Path
import io
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[2]      # .../location_features
RAW = ROOT / 'data' / 'raw' / 'census_gazetteer'
URL = ('https://www2.census.gov/geo/docs/maps-data/data/gazetteer/'
       '2023_Gazetteer/2023_gaz_cousubs_{ss}.txt')
GAZ_YEAR = 2023
NE_STATES = {'09': 'CT', '25': 'MA', '44': 'RI'}   # state FIPS -> USPS

# legal-suffix tail stripped to normalize a town name for joining
_SUFFIXES = (' town', ' city', ' borough', ' township', ' plantation',
             ' gore', ' grant', ' purchase', ' location')


def _fetch_raw(ss: str) -> str:
    RAW.mkdir(parents=True, exist_ok=True)
    cache = RAW / f'2023_gaz_cousubs_{ss}.txt'
    if not cache.exists():
        r = requests.get(URL.format(ss=ss), timeout=30)
        r.raise_for_status()
        cache.write_bytes(r.content)
    return cache.read_text(encoding='latin-1')


def normalize_name(name: str) -> str:
    """Lowercase, trim, drop a trailing legal suffix ('Bethany town' -> 'bethany')."""
    n = str(name).strip().lower()
    for suf in _SUFFIXES:
        if n.endswith(suf):
            return n[: -len(suf)].strip()
    return n


def load_towns(states: dict | None = None) -> pd.DataFrame:
    """One row per town: state_usps, geoid, gaz_name, name_norm, aland_sqkm, lat, lon."""
    states = states or NE_STATES
    frames = []
    for ss, usps in states.items():
        df = pd.read_csv(io.StringIO(_fetch_raw(ss)), sep='\t', dtype=str)
        df.columns = [c.strip() for c in df.columns]
        sub = pd.DataFrame({
            'state_usps': usps,
            'geoid': df['GEOID'].str.strip(),
            'gaz_name': df['NAME'].str.strip(),
            'aland_sqkm': df['ALAND'].str.strip().astype(float) / 1e6,
            'lat': df['INTPTLAT'].str.strip().astype(float),
            'lon': df['INTPTLONG'].str.strip().astype(float),
        })
        sub['name_norm'] = sub['gaz_name'].map(normalize_name)
        frames.append(sub)
    return pd.concat(frames, ignore_index=True)


if __name__ == '__main__':
    t = load_towns()
    print(f'{len(t)} towns across {t["state_usps"].nunique()} states; '
          f'name collisions within state: '
          f'{int(t.duplicated(["state_usps", "name_norm"]).sum())}')
    print(t.head())
