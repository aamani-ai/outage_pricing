"""Phase 2 pipeline: per-customer shadow rate.

Emits per-(FIPS, T, catalog) rows with the v0 lambda_county baseline plus the
headline mean-based per-customer estimator, the robust median, the max-based
sensitivity column, distribution percentiles, and the coverage gate status.

Schema: curated_outage_data/schemas/per_customer_lambda.md
Plan:   docs/plan/per_customer_pricing_plan.md (Phase 2)

This script reads from price_engine/ only. It does not modify v0 outputs.
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
DEFAULT_OUT_DIR = REPO / 'curated_outage_data' / 'outputs' / 'per_customer_rate'

T_GRID = [2, 4, 8, 12, 24]

# Coverage-gate thresholds. See Phase 2 plan + pipeline README.
MIN_QUALIFYING_HARD = 10
MIN_QUALIFYING_CAUTION = 100
MIN_TOTAL_CAUTION = 500

SOURCE_VERSION = '2026-05-30'


def load_customer_base() -> dict[int, dict]:
    """Validated customer-base denominator → {fips: {'base': float|None, 'excluded': bool}}.

    Source: price_engine/data/customer_base.csv (build_customer_base.py) — keeps MCC where it agrees with
    Census households, REPAIRS broken MCC (MCC/households < 0.5) via households×1.324, and EXCLUDES counties
    whose customers_out itself is implausible (observed peak > the repaired base). This replaces the raw MCC,
    whose garbage values (Henderson NC = 24) drove multi-$M premiums. See
    docs/dicsscssion/premium_implausibility_investigation/.
    """
    p = REPO / 'price_engine' / 'data' / 'customer_base.csv'
    cb = pd.read_csv(p)
    out: dict[int, dict] = {}
    for _, r in cb.iterrows():
        base = float(r['base']) if pd.notna(r['base']) else None
        out[int(r['fips'])] = {'base': base, 'excluded': bool(r['excluded'])}
    return out


def load_catalog(catalog_id: str) -> tuple[pd.DataFrame, float]:
    cat_dir = REPO / 'price_engine' / 'catalogs' / catalog_id / 'data'
    events = pd.read_parquet(
        cat_dir / 'events.parquet',
        columns=['fips', 'duration_hours', 'mean_customers', 'max_customers'],
    )
    meta = json.loads((cat_dir / 'annualization_meta.json').read_text())
    return events, float(meta['source_observation_years'])


def compute_fips_rows(
    events_fips: pd.DataFrame,
    base: float | None,
    excluded: bool,
    obs_years: float,
    T_grid=T_GRID,
) -> list[dict]:
    n_total = int(len(events_fips))
    rows = []
    base_valid = (not excluded) and base is not None and float(base) > 0

    durations = events_fips['duration_hours'].to_numpy() if n_total > 0 else np.array([])

    for T in T_grid:
        row: dict = {
            'T': int(T),
            'n_events_total': n_total,
            'observation_years': float(obs_years),
            'mcc': float(base) if base_valid else None,
        }

        # Denominator gate: no usable customer base (missing, or excluded as data-invalid) → cannot price.
        if not base_valid:
            row.update({
                'n_events_qualifying': None,
                'S_T': None,
                'lambda_county': None,
                'multiplier_mean': None,
                'lambda_customer_mean': None,
                'multiplier_median': None,
                'lambda_customer_median': None,
                'multiplier_max': None,
                'lambda_customer_max': None,
                'pct_mcc_p10': None,
                'pct_mcc_p50': None,
                'pct_mcc_p90': None,
                'pct_mcc_p99': None,
                'coverage_gate_status': 'not_available',
                'coverage_gate_reason': 'mcc_invalid' if excluded else 'mcc_missing',
            })
            rows.append(row)
            continue

        qual_mask = durations >= T
        nq = int(qual_mask.sum())
        row['n_events_qualifying'] = nq

        if n_total > 0:
            S_T = nq / n_total
            row['S_T'] = float(S_T)
            row['lambda_county'] = float((n_total / obs_years) * S_T)
        else:
            row['S_T'] = None
            row['lambda_county'] = None

        # Qualifying-event gate
        if nq < MIN_QUALIFYING_HARD:
            row.update({
                'multiplier_mean': None,
                'lambda_customer_mean': None,
                'multiplier_median': None,
                'lambda_customer_median': None,
                'multiplier_max': None,
                'lambda_customer_max': None,
                'pct_mcc_p10': None,
                'pct_mcc_p50': None,
                'pct_mcc_p90': None,
                'pct_mcc_p99': None,
                'coverage_gate_status': 'not_available',
                'coverage_gate_reason': 'insufficient_qualifying_events',
            })
            rows.append(row)
            continue

        qual = events_fips.loc[qual_mask]
        # cap each event's customer fraction at 1.0 — a single event cannot exceed 100% of the base (guardrail).
        pct_mcc_mean = (qual['mean_customers'] / base).clip(upper=1.0)
        pct_mcc_max = (qual['max_customers'] / base).clip(upper=1.0)

        mult_mean = float(pct_mcc_mean.mean())
        mult_median = float(pct_mcc_mean.median())
        mult_max = float(pct_mcc_max.mean())

        row['multiplier_mean'] = mult_mean
        row['lambda_customer_mean'] = row['lambda_county'] * mult_mean if row['lambda_county'] is not None else None
        row['multiplier_median'] = mult_median
        row['lambda_customer_median'] = row['lambda_county'] * mult_median if row['lambda_county'] is not None else None
        row['multiplier_max'] = mult_max
        row['lambda_customer_max'] = row['lambda_county'] * mult_max if row['lambda_county'] is not None else None

        row['pct_mcc_p10'] = float(pct_mcc_mean.quantile(0.10))
        row['pct_mcc_p50'] = float(pct_mcc_mean.quantile(0.50))
        row['pct_mcc_p90'] = float(pct_mcc_mean.quantile(0.90))
        row['pct_mcc_p99'] = float(pct_mcc_mean.quantile(0.99))

        # Caution levels
        if nq < MIN_QUALIFYING_CAUTION:
            row['coverage_gate_status'] = 'caution'
            row['coverage_gate_reason'] = 'low_qualifying_event_count'
        elif n_total < MIN_TOTAL_CAUTION:
            row['coverage_gate_status'] = 'caution'
            row['coverage_gate_reason'] = 'low_total_event_count'
        else:
            row['coverage_gate_status'] = 'available'
            row['coverage_gate_reason'] = None

        rows.append(row)

    return rows


def run_catalog(catalog_id: str, out_dir: Path) -> pd.DataFrame:
    print(f'[{catalog_id}] loading events + meta...')
    events, obs_years = load_catalog(catalog_id)
    cbase = load_customer_base()

    n_fips = events['fips'].nunique()
    n_excl = sum(1 for v in cbase.values() if v['excluded'])
    print(f'[{catalog_id}] {len(events):,} events, {n_fips:,} FIPS, observation_years={obs_years:.4f}')
    print(f'[{catalog_id}] customer base: {len(cbase):,} counties ({n_excl} excluded as data-invalid)')

    generated_at = datetime.now(timezone.utc).isoformat()

    all_rows: list[dict] = []
    for fips, sub in events.groupby('fips', sort=False):
        fips_int = int(fips)
        cb = cbase.get(fips_int, {'base': None, 'excluded': True})
        county_rows = compute_fips_rows(sub, cb['base'], cb['excluded'], obs_years)
        for r in county_rows:
            r['fips'] = fips_int
            r['catalog_id'] = catalog_id
            r['generated_at'] = generated_at
            r['source_version'] = SOURCE_VERSION
            all_rows.append(r)

    df = pd.DataFrame(all_rows)
    cols = [
        'fips', 'T', 'catalog_id',
        'n_events_total', 'n_events_qualifying', 'observation_years', 'mcc',
        'S_T', 'lambda_county',
        'multiplier_mean', 'lambda_customer_mean',
        'multiplier_median', 'lambda_customer_median',
        'multiplier_max', 'lambda_customer_max',
        'pct_mcc_p10', 'pct_mcc_p50', 'pct_mcc_p90', 'pct_mcc_p99',
        'coverage_gate_status', 'coverage_gate_reason',
        'generated_at', 'source_version',
    ]
    df = df[cols]

    out_path = out_dir / f'per_customer_lambda__{catalog_id}.parquet'
    df.to_parquet(out_path, index=False)
    print(f'[{catalog_id}] wrote {out_path} ({len(df):,} rows)')

    # Quick on-screen summary
    gate_dist = (
        df.groupby(['T', 'coverage_gate_status'], dropna=False)
          .size()
          .unstack(fill_value=0)
          .reindex(columns=['available', 'caution', 'not_available'], fill_value=0)
    )
    print(f'[{catalog_id}] gate distribution by T:')
    print(gate_dist.to_string())

    # ============================================================
    # Dashboard JSON view: compact per-(FIPS, T) lookup
    # The dashboard fetches this on catalog switch and merges values
    # into its in-memory drilldown structure. Format is intentionally
    # narrow — only fields the matrix and Panel C consume.
    # ============================================================
    view_rows = df[df['coverage_gate_status'].notna()].copy()
    view: dict = {}
    for _, r in view_rows.iterrows():
        fips_key = str(int(r['fips']))
        T_key = str(int(r['T']))
        per_T = view.setdefault(fips_key, {})
        per_T[T_key] = {
            'lambda_county': _safe_float(r['lambda_county']),
            'multiplier_mean': _safe_float(r['multiplier_mean']),
            'multiplier_median': _safe_float(r['multiplier_median']),
            'multiplier_max': _safe_float(r['multiplier_max']),
            'lambda_customer_mean': _safe_float(r['lambda_customer_mean']),
            'lambda_customer_median': _safe_float(r['lambda_customer_median']),
            'lambda_customer_max': _safe_float(r['lambda_customer_max']),
            'pct_mcc_p10': _safe_float(r['pct_mcc_p10']),
            'pct_mcc_p50': _safe_float(r['pct_mcc_p50']),
            'pct_mcc_p90': _safe_float(r['pct_mcc_p90']),
            'pct_mcc_p99': _safe_float(r['pct_mcc_p99']),
            'n_events_qualifying': _safe_int(r['n_events_qualifying']),
            'coverage_gate_status': r['coverage_gate_status'],
            'coverage_gate_reason': (r['coverage_gate_reason']
                                     if pd.notna(r['coverage_gate_reason']) else None),
        }

    view_payload = {
        'meta': {
            'catalog_id': catalog_id,
            'generated_at': generated_at,
            'source_version': SOURCE_VERSION,
            'observation_years': obs_years,
            'T_grid': list(T_GRID),
            'description': (
                'Per-customer shadow rate. Headline estimator is '
                'lambda_customer_mean = lambda_county * mean(mean_customers / MCC | duration >= T). '
                'Not used in v0 pricing.'
            ),
        },
        'view': view,
    }
    json_path = out_dir / f'per_customer_view__{catalog_id}.json'
    json_payload_text = json.dumps(view_payload, separators=(',', ':'))
    json_path.write_text(json_payload_text)
    print(f'[{catalog_id}] wrote {json_path} ({len(view):,} fips)')

    # Mirror the JSON into the catalog's pricing folder so the static dashboard
    # (served from price_engine/) can fetch it via a sibling relative path. This
    # is a presentation-only mirror — the source of truth is the parquet + JSON
    # under curated_outage_data/outputs/ and the curated pipeline is the only
    # writer.
    catalog_pricing = REPO / 'price_engine' / 'catalogs' / catalog_id / 'pricing'
    if catalog_pricing.exists():
        mirror_path = catalog_pricing / 'per_customer_view.json'
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


def _safe_int(v) -> int | None:
    f = _safe_float(v)
    return int(f) if f is not None else None


def main() -> None:
    ap = argparse.ArgumentParser(description='Phase 2 per-customer shadow rate pipeline.')
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
