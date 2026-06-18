"""Choropleth map — the within-county location-basis signal, on real town
boundaries. Two panels for CT/MA/RI towns (T>=4h):
  left  : town density (the rurality proxy / the input)
  right : within-county relativity (the signal; red=rural >1, blue=urban <1)
County boundaries (PoUS grouping) overlaid in black; each county averages to 1.0.

Inputs: analysis/outputs/town_density_features.csv (density, rel) + town polygons
(lib/town_boundaries.py). Writes outputs/town_relativity_map.png.
"""
from __future__ import annotations
import sys
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / 'lib'))
import town_boundaries as tb       # noqa: E402

OUT = HERE / 'outputs'
USPS = {'Connecticut': 'CT', 'Massachusetts': 'MA', 'Rhode Island': 'RI'}
PROJ = 5070   # CONUS Albers equal-area, for an undistorted map


def main():
    feats = pd.read_csv(OUT / 'town_density_features.csv').dropna(subset=['rel', 'density'])
    feats['state_usps'] = feats['state'].map(USPS)
    feats['name_norm'] = feats['city'].astype(str).str.strip().str.lower()

    poly = tb.load_town_polygons()
    g = poly.merge(feats[['state_usps', 'name_norm', 'county', 'city', 'density', 'rel', 'town_tracked']],
                   on=['state_usps', 'name_norm'], how='inner')
    print(f'[map] {len(g)}/{len(feats)} town polygons joined to data '
          f'({len(g) / len(feats) * 100:.0f}%)')

    g = g.to_crs(PROJ)
    counties = g.dissolve(by=['state_usps', 'county'])

    fig, axes = plt.subplots(1, 2, figsize=(16, 7.5))

    # SHARED scheme on both panels: RED = rural, BLUE = urban, so the eye can
    # compare input (density) and signal (relativity) directly.
    # left — density: low density (rural) -> red. RdBu maps low->red, diverge at median.
    ld = np.log10(g['density'].clip(lower=1))
    dnorm = mcolors.TwoSlopeNorm(vmin=ld.min(), vcenter=float(ld.median()), vmax=ld.max())
    g.plot(column=ld, cmap='RdBu', norm=dnorm,
           linewidth=0.15, edgecolor='white', ax=axes[0], legend=True,
           legend_kwds={'label': 'log10 customers/km²   (red = rural, blue = urban)', 'shrink': 0.55})
    counties.boundary.plot(ax=axes[0], color='black', linewidth=0.7)
    axes[0].set_title('Town density  (the rurality proxy / input)')
    axes[0].axis('off')

    # right — relativity: high rel (rural) -> red. RdBu_r maps high->red, diverge at 1.0.
    rnorm = mcolors.TwoSlopeNorm(vmin=0.3, vcenter=1.0, vmax=3.0)
    g.plot(column=g['rel'].clip(0.3, 3.0), cmap='RdBu_r', norm=rnorm,
           linewidth=0.15, edgecolor='white', ax=axes[1], legend=True,
           legend_kwds={'label': 'within-county relativity, T>=4h   (red >1, blue <1)', 'shrink': 0.55})
    counties.boundary.plot(ax=axes[1], color='black', linewidth=0.7)
    axes[1].set_title('Within-county relativity  (the signal / output)')
    axes[1].axis('off')

    fig.suptitle('Location basis is a within-county redistribution — CT/MA/RI towns, '
                 'Jan-Mar 2019 (T>=4h)\nRED = rural / above county average,  BLUE = urban / below;  '
                 'black lines = counties (each averages to 1.0x)',
                 fontweight='bold', fontsize=12)
    fig.tight_layout(rect=[0, 0, 1, 0.96])
    fig.savefig(OUT / 'town_relativity_map.png', dpi=130, bbox_inches='tight')
    print(f'[map] wrote {OUT / "town_relativity_map.png"}')


if __name__ == '__main__':
    main()
