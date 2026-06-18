"""EXPERIMENT (not pricing): does NLCD impervious-surface % beat population
density as the within-county rurality proxy?

Motivation: population density mis-ranks commercial / low-residential urban cores
as "rural" (Midtown Manhattan read p13 within its county, getting a wrong uplift).
Impervious surface measures built-up-ness directly (Midtown ≈ 94%, rural ≈ 0%),
so it should fix that — IF it still predicts the within-county outage relativity
in the PoUS pilot at least as well as density.

Samples NLCD 2021 impervious % at the pilot town centroids (MRLC WMS, like the
canopy probe), then compares within-county correlation with the relative:
rho(density, rel) vs rho(impervious, rel). Plus a national commercial-core
spot-check. Experiment only — changes no pricing.
"""
import sys
import time
from pathlib import Path
import numpy as np
import pandas as pd
import requests

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / 'lib'))
import town_density_vs_size as tds   # noqa: E402

RAW = HERE.parent / 'data' / 'raw' / 'nlcd_impervious'
WMS = 'https://www.mrlc.gov/geoserver/mrlc_display/wms'
LAYER = 'NLCD_2021_Impervious_L48'
FEATS = HERE / 'outputs' / 'town_density_features.csv'


def imperv_at(lat, lon, d=0.0008, timeout=30):
    bbox = f'{lon - d},{lat - d},{lon + d},{lat + d}'
    p = dict(SERVICE='WMS', VERSION='1.1.1', REQUEST='GetFeatureInfo', LAYERS=LAYER, QUERY_LAYERS=LAYER,
             SRS='EPSG:4326', BBOX=bbox, WIDTH=5, HEIGHT=5, X=2, Y=2, INFO_FORMAT='application/json')
    r = requests.get(WMS, params=p, timeout=timeout)
    r.raise_for_status()
    f = r.json().get('features', [])
    if not f:
        return None
    v = f[0]['properties'].get('PALETTE_INDEX')
    return float(v) if v is not None and 0 <= float(v) <= 100 else None


def sample(df):
    RAW.mkdir(parents=True, exist_ok=True)
    cache = RAW / 'town_impervious.csv'
    done = pd.read_csv(cache) if cache.exists() else pd.DataFrame()
    keys = set(zip(done.state, done.county, done.city)) if len(done) else set()
    rows = done.to_dict('records') if len(done) else []
    n = 0
    for r in df.dropna(subset=['lat', 'lon']).itertuples(index=False):
        if (r.state, r.county, r.city) in keys:
            continue
        try:
            v = imperv_at(r.lat, r.lon)
        except Exception:
            v = None
        rows.append({'state': r.state, 'county': r.county, 'city': r.city, 'impervious': v})
        n += 1
        if n % 50 == 0:
            pd.DataFrame(rows).to_csv(cache, index=False)
            print(f'  ...sampled {n} new')
        time.sleep(0.03)
    out = pd.DataFrame(rows)
    out.to_csv(cache, index=False)
    print(f'[impervious] {len(out)} towns ({n} new)')
    return out


def main():
    feats = pd.read_csv(FEATS)
    imp = sample(feats)
    df = feats.merge(imp, on=['state', 'county', 'city'], how='left')
    df = df[df['rel'].notna() & df['density'].notna() & df['impervious'].notna()].copy()
    df['towns_in_county'] = df.groupby(['state', 'county'])['city'].transform('size')

    rd, ri = [], []
    for _, g in df[df['towns_in_county'] >= 4].groupby(['state', 'county']):
        if len(g) >= 4:
            rd.append(tds.spearman(g['density'], g['rel']))
            ri.append(tds.spearman(g['impervious'], g['rel']))
    med = lambda a: float(np.nanmedian([x for x in a if not np.isnan(x)]))

    print(f"\nWithin-county correlation with the outage relative (pilot, {len(rd)} counties, T>=4h):")
    print(f"  median rho(density,    rel) = {med(rd):+.3f}")
    print(f"  median rho(impervious, rel) = {med(ri):+.3f}   (more negative = stronger urban->lower-risk)")
    corr = np.corrcoef(df['impervious'], np.log10(df['density'].clip(lower=1)))[0, 1]
    print(f"\nImpervious: median {df['impervious'].median():.0f}%, range {df['impervious'].min():.0f}-{df['impervious'].max():.0f}%")
    print(f"corr(impervious, log10 density) = {corr:+.2f}  (high => they largely agree in the pilot)")

    # national commercial-core spot-check: impervious vs the pop-density mis-rank
    print("\nNational spot-check (impervious % — fixes the commercial-core flaw):")
    for nm, lat, lon in [('Midtown Manhattan (ESB)', 40.7484, -73.9857),
                         ('rural Litchfield CT', 41.75, -73.20),
                         ('suburban Naperville IL', 41.748, -88.165)]:
        try:
            print(f"  {nm:<26} impervious={imperv_at(lat, lon):.0f}%")
        except Exception as e:
            print(f"  {nm}: {e}")
    df[['state', 'county', 'city', 'density', 'impervious', 'rel']].to_csv(HERE / 'outputs' / 'impervious_vs_density.csv', index=False)


if __name__ == '__main__':
    main()
