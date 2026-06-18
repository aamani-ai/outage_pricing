"""NLCD Tree Canopy Cover (CONUS 2021) — canopy % at a point, via MRLC WMS.

Source (PINNED): MRLC GeoServer WMS, layer `nlcd_tcc_conus_2021_v2021-4`:
  https://www.mrlc.gov/geoserver/mrlc_display/wms   (GetFeatureInfo)
Tree Canopy Cover (TCC) = the % of a 30 m pixel under tree canopy (0-100). We do
NOT download the CONUS raster (gigabytes); we point-sample each town centroid via
GetFeatureInfo, which returns the pixel value as `PALETTE_INDEX`. Non-processing /
NoData values (>100, e.g. 254/255) -> NaN.

LIMITATION (documented): one centroid pixel is NOT the town-mean canopy; it is a
representative interior sample. Good enough for a directional "does canopy add
beyond density?" test; a zonal mean over the town is the refinement.

Caches every sampled point under data/raw/nlcd_canopy/ so re-runs are free and
the analysis is reproducible (pin + cache principle).
"""
from __future__ import annotations
from pathlib import Path
import time
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[2]      # .../location_features
RAW = ROOT / 'data' / 'raw' / 'nlcd_canopy'
WMS = 'https://www.mrlc.gov/geoserver/mrlc_display/wms'
LAYER = 'nlcd_tcc_conus_2021_v2021-4'
PRODUCT = 'NLCD Tree Canopy Cover, CONUS, 2021 (v2021-4)'


def canopy_at(lat: float, lon: float, d: float = 0.002, timeout: int = 30):
    """Return tree-canopy % (0-100) at a lat/lon, or None if NoData/missing."""
    bbox = f'{lon - d},{lat - d},{lon + d},{lat + d}'
    params = dict(SERVICE='WMS', VERSION='1.1.1', REQUEST='GetFeatureInfo',
                  LAYERS=LAYER, QUERY_LAYERS=LAYER, SRS='EPSG:4326',
                  BBOX=bbox, WIDTH=5, HEIGHT=5, X=2, Y=2,
                  INFO_FORMAT='application/json')
    r = requests.get(WMS, params=params, timeout=timeout)
    r.raise_for_status()
    feats = r.json().get('features', [])
    if not feats:
        return None
    props = feats[0].get('properties', {})
    val = props.get('PALETTE_INDEX', props.get('GRAY_INDEX'))
    if val is None:
        return None
    val = float(val)
    return val if 0 <= val <= 100 else None      # >100 => nodata / non-processing


def sample_points(df, key_cols=('state', 'county', 'city'),
                  lat='lat', lon='lon', cache_name='town_canopy.csv'):
    """Sample canopy for each row; resume-safe cache under data/raw/nlcd_canopy/."""
    RAW.mkdir(parents=True, exist_ok=True)
    cache = RAW / cache_name
    done = pd.read_csv(cache) if cache.exists() else pd.DataFrame()
    done_keys = set(map(tuple, done[list(key_cols)].astype(str).values)) if len(done) else set()
    rows = done.to_dict('records') if len(done) else []
    n_new = 0
    for r in df.dropna(subset=[lat, lon]).itertuples(index=False):
        k = tuple(str(getattr(r, c)) for c in key_cols)
        if k in done_keys:
            continue
        try:
            c = canopy_at(float(getattr(r, lat)), float(getattr(r, lon)))
        except Exception:
            c = None
        rec = {c2: getattr(r, c2) for c2 in key_cols}
        rec['canopy_pct'] = c
        rows.append(rec)
        n_new += 1
        if n_new % 50 == 0:
            pd.DataFrame(rows).to_csv(cache, index=False)     # checkpoint
            print(f'  ...sampled {n_new} new points')
        time.sleep(0.03)
    out = pd.DataFrame(rows)
    out.to_csv(cache, index=False)
    print(f'[canopy] {len(out)} towns in cache ({n_new} new) -> {cache}')
    return out


if __name__ == '__main__':
    feats = pd.read_csv(ROOT / 'analysis' / 'outputs' / 'town_density_features.csv')
    sample_points(feats)
