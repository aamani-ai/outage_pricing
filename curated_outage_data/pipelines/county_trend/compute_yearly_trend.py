"""County yearly outage-trend pipeline.

Emits per-(FIPS, T, catalog) rows with:
  - yearly event counts across the 2015-2025 review window
    (missing/partial source years are represented as null, not zero)
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
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / "price_engine"))
from core import gcs_io, data_paths  # noqa: E402 — inputs/outputs resolve local↔GCS via OUTAGE_PRICING_DATA_ROOT

DEFAULT_CATALOGS = ['eagle-i-30min', 'eagle-i-45min', 'eagle-i-60min']

T_GRID = [2, 4, 8, 12, 24]

# Full-year window used for the trend. 2014 is partial (coverage begins
# 2014-11-01) so it would bias the slope. 2026 has not happened yet in
# the dataset. Window inclusive.
TREND_YEARS = list(range(2015, 2026))  # 2015..2025 = 11 full years

# Classification gates. t_stat = slope / sigma (one-sided significance
# against zero slope). 1.5 chosen as a 87% one-sided gate — strict enough
# to reject most noise, loose enough to surface real signal in 11 years.
T_STAT_GATE = 1.5

# Coverage gates: counties with too few qualifying events or too few observed
# calendar years cannot support a credible slope. Match the per-customer
# pipeline's MIN_QUALIFYING_HARD for event volume, then require a majority of
# the 11-year review window to be observed before fitting a line.
MIN_TOTAL_EVENTS_IN_WINDOW = 10
MIN_OBSERVED_YEARS_FOR_TREND = 6

SOURCE_VERSION = '2026-06-20'

CT_LEGACY_COUNTY_FIPS = {9001, 9003, 9005, 9007, 9009, 9011, 9013, 9015}
CT_PLANNING_REGION_FIPS = set(range(9110, 9200, 10))


def load_catalog_events(catalog_id: str) -> tuple[pd.DataFrame, float]:
    cat_dir = f'price_engine/catalogs/{catalog_id}/data'
    events = gcs_io.read_parquet(
        data_paths.resolve(f'{cat_dir}/events.parquet'),
        columns=['fips', 'duration_hours', 'year'],
    )
    meta = gcs_io.read_json(data_paths.resolve(f'{cat_dir}/annualization_meta.json'))
    return events, float(meta['source_observation_years'])


def fit_trend(yearly_counts: np.ndarray, years: np.ndarray) -> dict:
    """Linear regression of observed yearly_counts vs observed years.

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

    return {
        'slope_events_per_year': slope,
        'intercept': intercept,
        'sigma': sigma,
        't_stat': t_stat,
        'trend_class': trend_class,
        'first5_mean': None,
        'last5_mean': None,
        'pct_change_first5_last5': None,
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


def observed_year_metadata(events_fips: pd.DataFrame) -> dict:
    """Return source-observation metadata for one FIPS.

    The EAGLE-I event catalog only contains positive outage observations. For
    annual trend fitting, a threshold-specific zero is trustworthy inside a
    FIPS' observed positive-event window, but leading/trailing years outside
    that window are not treated as observed zeros.

    This is intentionally conservative and explicit. It also handles the
    Connecticut 2025 geography transition: old county FIPS and new planning
    region FIPS are partial-year / non-comparable in 2025, so they are excluded
    from annual trend fitting until a full-year bridge exists.
    """
    fips = int(events_fips['fips'].iloc[0])
    source_years = {
        int(y)
        for y in events_fips['year'].dropna().astype(int).unique().tolist()
        if int(y) in TREND_YEARS
    }

    first_source_year = min(source_years) if source_years else None
    last_source_year = max(source_years) if source_years else None

    observed_mask: list[bool] = []
    source_presence: list[bool] = []
    missing_reasons: dict[str, str] = {}

    for year in TREND_YEARS:
        has_source_presence = year in source_years
        source_presence.append(has_source_presence)

        observed = (
            first_source_year is not None
            and last_source_year is not None
            and first_source_year <= year <= last_source_year
        )
        reason = None if observed else 'outside_fips_positive_source_window'

        if fips in CT_LEGACY_COUNTY_FIPS and year == 2025:
            observed = False
            reason = 'ct_legacy_county_partial_2025'
        elif fips in CT_PLANNING_REGION_FIPS:
            if year < 2025:
                observed = False
                reason = 'ct_planning_region_pre_2025_geography_not_reported'
            elif year == 2025:
                observed = False
                reason = 'ct_planning_region_partial_2025'

        observed_mask.append(observed)
        if not observed:
            missing_reasons[str(year)] = reason or 'not_observed'

    return {
        'observed_year_mask': observed_mask,
        'source_year_presence': source_presence,
        'missing_years': [int(y) for y, ok in zip(TREND_YEARS, observed_mask, strict=True) if not ok],
        'missing_year_reasons': missing_reasons,
        'observed_year_count': int(sum(observed_mask)),
        'missing_year_count': int(len(TREND_YEARS) - sum(observed_mask)),
        'first_source_year': first_source_year,
        'last_source_year': last_source_year,
        'observation_policy': (
            'observed_zero_requires_fips_positive_source_window; '
            'ct_2025_geography_transition_excluded'
        ),
    }


def fixed_window_comparison(yearly_counts: list[int | None]) -> dict:
    """Compute fixed 2015-2019 vs 2021-2025 means only when fully observed."""
    by_year = dict(zip(TREND_YEARS, yearly_counts, strict=True))

    def mean_if_complete(window: list[int]) -> float | None:
        values = [by_year.get(y) for y in window]
        if any(v is None for v in values):
            return None
        return float(np.mean([float(v) for v in values]))

    first5 = mean_if_complete(list(range(2015, 2020)))
    last5 = mean_if_complete(list(range(2021, 2026)))
    pct_change = (last5 - first5) / first5 if first5 is not None and last5 is not None and first5 > 0 else None
    return {
        'first5_mean': first5,
        'last5_mean': last5,
        'pct_change_first5_last5': pct_change,
    }


def insufficient_reason(total_events: int, observed_year_count: int) -> str | None:
    if observed_year_count < MIN_OBSERVED_YEARS_FOR_TREND:
        return 'fewer_than_min_observed_years'
    if total_events < MIN_TOTAL_EVENTS_IN_WINDOW:
        return 'fewer_than_min_events'
    return None


def compute_fips_rows(events_fips: pd.DataFrame, T_grid=T_GRID) -> list[dict]:
    """For each T, compute the yearly trend for this FIPS."""
    rows = []
    years_arr = np.array(TREND_YEARS, dtype=int)
    in_window = events_fips['year'].isin(TREND_YEARS)
    events_window = events_fips[in_window]
    obs_meta = observed_year_metadata(events_fips)
    observed_mask = obs_meta['observed_year_mask']

    for T in T_grid:
        qual = events_window[events_window['duration_hours'] >= T]
        # Reindex to fill observed years with true zero counts, while keeping
        # missing/partial source years as null. The old implementation filled
        # every absent year with 0, which contaminated slopes and clustering.
        per_year = (
            qual.groupby('year').size()
                .reindex(TREND_YEARS, fill_value=0)
                .astype(int)
        )
        yearly_counts: list[int | None] = [
            int(v) if is_observed else None
            for v, is_observed in zip(per_year.to_numpy(), observed_mask, strict=True)
        ]
        observed_pairs = [
            (year, count)
            for year, count in zip(TREND_YEARS, yearly_counts, strict=True)
            if count is not None
        ]
        observed_years_arr = np.array([year for year, _ in observed_pairs], dtype=int)
        observed_counts_arr = np.array([count for _, count in observed_pairs], dtype=int)
        total_in_window = int(observed_counts_arr.sum()) if len(observed_counts_arr) else 0
        first_last = fixed_window_comparison(yearly_counts)

        row = {
            'T': int(T),
            'years': [int(y) for y in TREND_YEARS],
            'yearly_counts': yearly_counts,
            'total_events_in_window': total_in_window,
            'window_years': len(TREND_YEARS),
            **obs_meta,
        }

        reason = insufficient_reason(total_in_window, int(obs_meta['observed_year_count']))
        if reason is not None:
            row.update(_null_trend())
            row['trend_class'] = 'insufficient_data'
            row['insufficient_reason'] = reason
            row.update(first_last)
            rows.append(row)
            continue

        trend = fit_trend(observed_counts_arr, observed_years_arr)
        row.update(trend)
        row.update(first_last)
        row['insufficient_reason'] = None
        rows.append(row)

    return rows


def run_catalog(catalog_id: str) -> pd.DataFrame:
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
    parquet_path = data_paths.resolve(
        f'curated_outage_data/outputs/county_trend/county_yearly_trend__{catalog_id}.parquet'
    )
    gcs_io.write_parquet(df, parquet_path, index=False)
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
            'observed_year_mask': r['observed_year_mask'],
            'source_year_presence': r['source_year_presence'],
            'observed_year_count': int(r['observed_year_count']),
            'missing_year_count': int(r['missing_year_count']),
            'missing_years': r['missing_years'],
            'missing_year_reasons': r['missing_year_reasons'],
            'first_source_year': None if pd.isna(r['first_source_year']) else int(r['first_source_year']),
            'last_source_year': None if pd.isna(r['last_source_year']) else int(r['last_source_year']),
            'observation_policy': r['observation_policy'],
            'insufficient_reason': None if pd.isna(r.get('insufficient_reason')) else r.get('insufficient_reason'),
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
                'insufficient_data': (
                    f'< {MIN_TOTAL_EVENTS_IN_WINDOW} events in observed years or '
                    f'< {MIN_OBSERVED_YEARS_FOR_TREND} observed calendar years'
                ),
            },
            'observation_policy': {
                'observed_zero': (
                    'A zero is treated as a real zero only inside the FIPS positive-source '
                    'observation window.'
                ),
                'missing_year': (
                    'Leading/trailing years outside that window, and CT 2025 transition '
                    'years, are encoded as null and excluded from regression.'
                ),
                'min_observed_years_for_trend': MIN_OBSERVED_YEARS_FOR_TREND,
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
    json_path = data_paths.resolve(
        f'curated_outage_data/outputs/county_trend/county_yearly_trend__{catalog_id}.json'
    )
    gcs_io.write_json(view_payload, json_path, separators=(',', ':'))
    print(f'[{catalog_id}] wrote {json_path} ({len(view):,} fips)')

    # Mirror into the catalog pricing folder so the static dashboard can
    # fetch it via a sibling relative path. Same pattern as
    # per_customer_view.json.
    catalog_pricing = f'price_engine/catalogs/{catalog_id}/pricing'
    if gcs_io.exists(data_paths.resolve(catalog_pricing)):
        mirror_path = data_paths.resolve(f'{catalog_pricing}/county_yearly_trend.json')
        gcs_io.write_json(view_payload, mirror_path, separators=(',', ':'))
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
    args = ap.parse_args()

    for cat in args.catalogs:
        run_catalog(cat)


if __name__ == '__main__':
    main()
