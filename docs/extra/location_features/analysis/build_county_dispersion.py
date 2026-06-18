"""Build the NATIONAL county location-basis read for the dashboard map.

- Non-pilot states (48 + DC): within-county **tract** density dispersion =
  std of log10(ACS5 tract population / Census tract land area), per county.
  DESCRIPTIVE / unvalidated (shadow) — "how much does location vary here."
- Pilot (CT/MA/RI): town-based dispersion + the VALIDATED relativity (from the
  pilot geojson), using legacy county FIPS so CT matches the dashboard's map.

Output: price_engine/dashboard/data/county_location_basis.json  (fips -> read).
Needs CENSUS_API_KEY in .env (gitignored). Caches every raw pull (resumable).
"""
import json
import math
import time
from pathlib import Path
from collections import defaultdict
import requests
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REPO = HERE.parents[3]
RAW_ACS = ROOT / 'data' / 'raw' / 'acs_tracts'
RAW_GAZ = ROOT / 'data' / 'raw' / 'tract_gazetteer'
OUT = REPO / 'price_engine' / 'dashboard' / 'data' / 'county_location_basis.json'
TRACT_OUT = REPO / 'price_engine' / 'dashboard' / 'data' / 'tract_density.json'  # {tract_geoid: density} for drill-in
PILOT_GEOJSON = REPO / 'price_engine' / 'dashboard' / 'data' / 'location_basis_pilot.geojson'
KEY = next((l.split('=', 1)[1].strip() for l in (ROOT / '.env').read_text().splitlines()
            if l.startswith('CENSUS_API_KEY=')), None)
ACS_URL = "https://api.census.gov/data/2022/acs/acs5?get=B01003_001E&for=tract:*&in=state:{ss}&key={key}"
GAZ_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_gaz_tracts_{ss}.txt"
# all state FIPS + DC (11), excluding the pilot 09/25/44 and nonexistent codes
STATE_FIPS = ['01', '02', '04', '05', '06', '08', '10', '11', '12', '13', '15', '16', '17', '18',
              '19', '20', '21', '22', '23', '24', '26', '27', '28', '29', '30', '31', '32', '33',
              '34', '35', '36', '37', '38', '39', '40', '41', '42', '45', '46', '47', '48', '49',
              '50', '51', '53', '54', '55', '56']


def acs_tracts(ss):
    RAW_ACS.mkdir(parents=True, exist_ok=True)
    cache = RAW_ACS / f'{ss}.json'
    if not cache.exists():
        r = requests.get(ACS_URL.format(ss=ss, key=KEY), timeout=90)
        r.raise_for_status()
        cache.write_text(r.text)
        time.sleep(0.1)
    rows = json.loads(cache.read_text())
    hdr = rows[0]
    out = []
    for row in rows[1:]:
        rec = dict(zip(hdr, row))
        try:
            out.append((rec['state'] + rec['county'] + rec['tract'], float(rec['B01003_001E'])))
        except (TypeError, ValueError):
            pass
    return out


def gaz_tracts(ss):
    RAW_GAZ.mkdir(parents=True, exist_ok=True)
    cache = RAW_GAZ / f'{ss}.txt'
    if not cache.exists():
        r = requests.get(GAZ_URL.format(ss=ss), timeout=90)
        r.raise_for_status()
        cache.write_bytes(r.content)
        time.sleep(0.05)
    df = pd.read_csv(cache, sep='\t', dtype=str, encoding='latin-1')
    df.columns = [c.strip() for c in df.columns]
    return dict(zip(df['GEOID'].str.strip(), pd.to_numeric(df['ALAND'], errors='coerce')))


def disp(densities):
    d = [x for x in densities if x and x > 0]
    if len(d) < 2:
        return None
    logs = [math.log10(x) for x in d]
    m = sum(logs) / len(logs)
    return (sum((x - m) ** 2 for x in logs) / len(logs)) ** 0.5


def main():
    counties = {}
    tract_density = {}   # geoid -> density (people/km^2), for the dashboard drill-in
    for ss in STATE_FIPS:
        try:
            pops = acs_tracts(ss)
            areas = gaz_tracts(ss)
        except Exception as e:
            print(f'  {ss} FAILED: {e}')
            continue
        bycounty = defaultdict(list)
        for geoid, pop in pops:
            a = areas.get(geoid)
            if a and a > 0:
                dens = pop / (a / 1e6)                          # people / km^2
                bycounty[geoid[:5]].append(dens)
                tract_density[geoid] = round(dens, 1)
        n = 0
        for cfips, dens in bycounty.items():
            sd = disp(dens)
            if sd is not None:
                counties[str(int(cfips))] = {'dispersion': round(sd, 3), 'n_subunits': len(dens), 'validated': False}
                n += 1
        print(f'  {ss}: {n} counties')

    # pilot CT/MA/RI from the pilot geojson (validated + relativity, legacy FIPS)
    geo = json.loads(PILOT_GEOJSON.read_text())
    pbc = defaultdict(list)
    for f in geo['features']:
        k = f['properties'].get('county_fips')
        if k is not None:
            pbc[str(int(float(k)))].append(f['properties'])
    for fips, towns in pbc.items():
        sd = disp([t['density'] for t in towns])
        def rng(T):
            r = [t[f'rel_T{T}'] for t in towns if t.get(f'rel_T{T}') is not None]
            return {'min': min(r), 'max': max(r)} if r else None
        counties[fips] = {'dispersion': round(sd, 3) if sd else None, 'n_subunits': len(towns),
                          'validated': True, 'county': towns[0].get('county'),
                          'rel': {str(T): rng(T) for T in (2, 4, 8)}}

    OUT.write_text(json.dumps(counties))
    print(f'\nwrote {len(counties)} counties -> {OUT}  ({OUT.stat().st_size/1024:.0f} KB)')
    TRACT_OUT.write_text(json.dumps(tract_density))
    print(f'wrote {len(tract_density)} tracts -> {TRACT_OUT}  ({TRACT_OUT.stat().st_size/1024:.0f} KB)')
    vals = sorted(c['dispersion'] for c in counties.values() if c.get('dispersion') is not None)
    if vals:
        print(f'dispersion p10/p50/p90/max: {vals[len(vals)//10]:.2f} / {vals[len(vals)//2]:.2f} '
              f'/ {vals[9*len(vals)//10]:.2f} / {vals[-1]:.2f}')


if __name__ == '__main__':
    main()
