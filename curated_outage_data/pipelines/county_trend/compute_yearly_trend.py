"""County yearly outage-trend pipeline.

Emits per-(FIPS, T, catalog) rows with:
  - yearly event counts across the full 11-year window (2015-2025 inclusive)
  - linear-regression slope and standard error
  - trend classification (worsening / stable / improving) using a 1.5-sigma gate

This is a DESCRIPTIVE layer feeding the forward-regime modifiers
(grid_condition, hazard, weather). It is NOT used in v0 pricing. The
output is consumed by the dashboard as a sparkline + map color mode.

2014 is excluded because EAGLE-I coverage begins 2014-11-01 — the partial
year would distort the slope toward "worsening" purely from observation-
window artifacts.

Schema: curated_outage_data/schemas/county_yearly_trend.md
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

REPO = Path(__file__).resolve().parents[3]
DEFAULT_CATALOGS = ['eagle-i-30min', 'eagle-i-45min', 'eagle-i-60min']
DEFAULT_OUT_DIR = REPO / 'curated_outage_data' / 'outputs' / 'county_trend'

T_GRID = [2, 4, 8, 12, 24]

# Full-year window used for the trend. 2014 is partial (coverage begins
# 2014-11-01) so it would bias the slope. 2026 has not happened yet in
# the dataset. Window inclusive.
TREND_YEARS = list(range(2015, 2026))  # 2015..2025 = 11 full years

# Classification gates. t_stat = slope / sigma (one-sided significance
# against zero slope). 1.5 chosen as a 87% one-sided gate — strict enough
# to reject most noise, loose enough to surface real signal in 11 years.
T_STAT_GATE = 1.5

# Coverage gate: counties with too few qualifying events across the
# window cannot support a credible slope. Match the per-customer
# pipeline's MIN_QUALIFYING_HARD.
MIN_TOTAL_EVENTS_IN_WINDOW = 10

SOURCE_VERSION = '2026-06-03'


def load_catalog_events(catalog_id: str) -> tuple[pd.DataFrame, float]:
    cat_dir = REPO / 'price_engine' / 'catalogs' / catalog_id / 'data'
    events = pd.read_parquet(
        cat_dir / 'events.parquet',
        columns=['fips', 'duration_hours', 'year'],
    )
    meta = json.loads((cat_dir / 'annualization_meta.json').read_text())
    return events, float(meta['source_observation_years'])


def fit_trend(yearly_counts: np.ndarray, years: np.ndarray) -> dict:
    """Linear regression of yearly_counts vs years.

    Returns slope (events/yr/yr), intercept, sigma (std error of slope),
    t_stat, and a categorical class.
    """
    n = int(len(yearly_counts))
    if n < 3:
        return _null_trend()

    x = years.astype(float)
    y = yearly_counts.astype(float)
    x_mean = float(x.mean())
    y_mean = float(y.mean())
    xc = x - x_mean
    yc = y - y_mean
    sx2 = float((xc * xc).sum())
    if sx2 <= 0:
        return _null_trend()

    slope = float((xc * yc).sum() / sx2)
    intercept = y_mean - slope * x_mean

    # Residuals + standard error of slope
    y_hat = intercept + slope * x
    resid = y - y_hat
    if n > 2:
        s2 = float((resid * resid).sum() / (n - 2))
        sigma = float(np.sqrt(s2 / sx2)) if s2 >= 0 else None
    else:
        sigma = None

    if sigma is None or sigma == 0:
        t_stat = None
        trend_class = 'stable'
    else:
        t_stat = float(slope / sigma)
        if t_stat > T_STAT_GATE:
            trend_class = 'worsening'
        elif t_stat < -T_STAT_GATE:
            trend_class = 'improving'
        else:
            trend_class = 'stable'

    # First5 / last5 split comparison — a second descriptive lens.
    if n >= 10:
        first5 = float(y[:5].mean())
        last5 = float(y[-5:].mean())
        pct_change = (last5 - first5) / first5 if first5 > 0 else None
    else:
        first5 = None
        last5 = None
        pct_change = None

    return {
        'slope_events_per_year': slope,
        'intercept': intercept,
        'sigma': sigma,
        't_stat': t_stat,
        'trend_class': trend_class,
        'first5_mean': first5,
        'last5_mean': last5,
        'pct_change_first5_last5': pct_change,
    }


def _null_trend() -> dict:
    return {
        'slope_events_per_year': None,
        'intercept': None,
        'sigma': None,
        't_stat': None,
        'trend_class': 'insufficient_data',
        'first5_mean': None,
        'last5_mean': None,
        'pct_change_first5_last5': None,
    }


def compute_fips_rows(events_fips: pd.DataFrame, T_grid=T_GRID) -> list[dict]:
    """For each T, compute the yearly trend for this FIPS."""
    rows = []
    years_arr = np.array(TREND_YEARS, dtype=int)
    in_window = events_fips['year'].isin(TREND_YEARS)
    events_window = events_fips[in_window]

    for T in T_grid:
        qual = events_window[events_window['duration_hours'] >= T]
        # Reindex to fill missing years with 0
        per_year = (
            qual.groupby('year').size()
                .reindex(TREND_YEARS, fill_value=0)
                .astype(int)
        )
        yearly_counts = per_year.to_numpy()
        total_in_window = int(yearly_counts.sum())

        row = {
            'T': int(T),
            'years': [int(y) for y in TREND_YEARS],
            'yearly_counts': [int(v) for v in yearly_counts],
            'total_events_in_window': total_in_window,
            'window_years': len(TREND_YEARS),
        }

        if total_in_window < MIN_TOTAL_EVENTS_IN_WINDOW:
            row.update(_null_trend())
            row['trend_class'] = 'insufficient_data'
            rows.append(row)
            continue

        trend = fit_trend(yearly_counts, years_arr)
        row.update(trend)
        rows.append(row)

    return rows


def run_catalog(catalog_id: str, out_dir: Path) -> pd.DataFrame:
    print(f'[{catalog_id}] loading events...')
    events, obs_years = load_catalog_events(catalog_id)

    n_fips = events['fips'].nunique()
    print(f'[{catalog_id}] {len(events):,} events, {n_fips:,} FIPS, '
          f'observation_years={obs_years:.4f}')

    generated_at = datetime.now(timezone.utc).isoformat()

    all_rows: list[dict] = []
    for fips, sub in events.groupby('fips', sort=False):
        fips_int = int(fips)
        for r in compute_fips_rows(sub):
            r['fips'] = fips_int
            r['catalog_id'] = catalog_id
            r['generated_at'] = generated_at
            r['source_version'] = SOURCE_VERSION
            all_rows.append(r)

    df = pd.DataFrame(all_rows)

    # Parquet view — flatten yearly_counts to a list column
    parquet_path = out_dir / f'county_yearly_trend__{catalog_id}.parquet'
    df.to_parquet(parquet_path, index=False)
    print(f'[{catalog_id}] wrote {parquet_path} ({len(df):,} rows)')

    # On-screen summary by trend class
    class_dist = (
        df.groupby(['T', 'trend_class'], dropna=False)
          .size()
          .unstack(fill_value=0)
    )
    print(f'[{catalog_id}] trend-class distribution by T:')
    print(class_dist.to_string())

    # ============================================================
    # Dashboard JSON view: compact per-(FIPS, T) lookup
    # The dashboard fetches this on catalog switch and merges values
    # into its in-memory drilldown structure.
    # ============================================================
    view: dict = {}
    for _, r in df.iterrows():
        fips_key = str(int(r['fips']))
        T_key = str(int(r['T']))
        per_T = view.setdefault(fips_key, {})
        per_T[T_key] = {
            'years': r['years'],
            'yearly_counts': r['yearly_counts'],
            'total_events_in_window': int(r['total_events_in_window']),
            'slope_events_per_year': _safe_float(r['slope_events_per_year']),
            'intercept': _safe_float(r['intercept']),
            'sigma': _safe_float(r['sigma']),
            't_stat': _safe_float(r['t_stat']),
            'trend_class': r['trend_class'],
            'first5_mean': _safe_float(r['first5_mean']),
            'last5_mean': _safe_float(r['last5_mean']),
            'pct_change_first5_last5': _safe_float(r['pct_change_first5_last5']),
        }

    view_payload = {
        'meta': {
            'catalog_id': catalog_id,
            'generated_at': generated_at,
            'source_version': SOURCE_VERSION,
            'observation_years': obs_years,
            'T_grid': list(T_GRID),
            'trend_years': list(TREND_YEARS),
            'window_description': (
                f'Trend computed across {TREND_YEARS[0]}-{TREND_YEARS[-1]} '
                f'({len(TREND_YEARS)} full years). 2014 excluded due to '
                f'partial-year EAGLE-I coverage (begins 2014-11-01).'
            ),
            'classification': {
                't_stat_gate': T_STAT_GATE,
                'worsening': f't_stat > {T_STAT_GATE} (slope significantly > 0)',
                'improving': f't_stat < -{T_STAT_GATE} (slope significantly < 0)',
                'stable': 'within the noise band',
                'insufficient_data': f'< {MIN_TOTAL_EVENTS_IN_WINDOW} events in window',
            },
            'descriptive_only': (
                'This is DESCRIPTIVE. The trend is NOT used in v0 pricing. '
                'It is the upstream data foundation for the forward-regime '
                'modifiers (grid_condition, hazard, weather) — those will '
                'apply the trend as a pricing input only after backtest '
                'evidence supports activation.'
            ),
        },
        'view': view,
    }
    json_path = out_dir / f'county_yearly_trend__{catalog_id}.json'
    json_payload_text = json.dumps(view_payload, separators=(',', ':'))
    json_path.write_text(json_payload_text)
    print(f'[{catalog_id}] wrote {json_path} ({len(view):,} fips)')

    # Mirror into the catalog pricing folder so the static dashboard can
    # fetch it via a sibling relative path. Same pattern as
    # per_customer_view.json.
    catalog_pricing = REPO / 'price_engine' / 'catalogs' / catalog_id / 'pricing'
    if catalog_pricing.exists():
        mirror_path = catalog_pricing / 'county_yearly_trend.json'
        mirror_path.write_text(json_payload_text)
        print(f'[{catalog_id}] mirrored to {mirror_path}')

    return df


def _safe_float(v) -> float | None:
    if v is None:
        return None
    if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def main() -> None:
    ap = argparse.ArgumentParser(description='County yearly outage-trend pipeline.')
    ap.add_argument('--catalogs', nargs='+', default=DEFAULT_CATALOGS,
                    help='Catalogs to process (default: all three).')
    ap.add_argument('--out-dir', default=str(DEFAULT_OUT_DIR),
                    help='Output directory for parquet files.')
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    for cat in args.catalogs:
        run_catalog(cat, out_dir)


if __name__ == '__main__':
    main()
