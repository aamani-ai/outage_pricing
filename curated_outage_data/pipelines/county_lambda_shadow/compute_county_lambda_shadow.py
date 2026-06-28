"""County lambda shadow-pricing pipeline.

Builds a candidate lambda adjustment layer from the yearly trend and
predictability artifacts. This is a shadow-pricing artifact: it does not mutate
v0 premiums. It answers:

    If the trend/pattern layer were activated, which lambda estimator would we
    use for this county/threshold, and what premium pressure would that imply?

Schema: curated_outage_data/schemas/county_lambda_shadow.md
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / "price_engine"))
from core import data_paths, gcs_io  # noqa: E402 — inputs/outputs resolve local↔GCS via OUTAGE_PRICING_DATA_ROOT

DEFAULT_CATALOGS = ["eagle-i-30min", "eagle-i-45min", "eagle-i-60min"]
DEFAULT_OUT_REL = "curated_outage_data/outputs/county_lambda_shadow"
SOURCE_VERSION = "2026-06-16"
PAYOUT_REFERENCE = 2500

MIN_FACTOR = 0.75
MIN_FACTOR_VOLATILE_DOWN = 0.90
MIN_FACTOR_STEP_DOWN = 0.80
MAX_FACTOR = 2.50


def safe_float(value) -> float | None:
    if value is None:
        return None
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    if np.isnan(value) or np.isinf(value):
        return None
    return value


def safe_div(num: float | None, den: float | None) -> float | None:
    if num is None or den is None or den == 0:
        return None
    return float(num) / float(den)


def clamp(value: float, lo: float, hi: float) -> float:
    return min(max(value, lo), hi)


def clean_json_value(value):
    if isinstance(value, dict):
        return {str(k): clean_json_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [clean_json_value(v) for v in value]
    if isinstance(value, tuple):
        return [clean_json_value(v) for v in value]
    if value is None:
        return None
    if isinstance(value, np.bool_):
        return bool(value)
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.floating):
        value = float(value)
    if isinstance(value, float):
        if np.isnan(value) or np.isinf(value):
            return None
        return value
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return value


def blend(base: float | None, target: float | None, weight: float) -> float | None:
    if base is None:
        return target
    if target is None:
        return base
    return (1.0 - weight) * base + weight * target


def projected_lambda(trend_row: dict) -> float | None:
    years = trend_row.get("years") or []
    if not years:
        return None
    slope = safe_float(trend_row.get("slope_events_per_year"))
    intercept = safe_float(trend_row.get("intercept"))
    if slope is None or intercept is None:
        return None
    next_year = int(max(years)) + 1
    return max(0.0, intercept + slope * next_year)


def weight_from_score(score: float | None, high: float, medium: float, low: float) -> float:
    if score is None:
        return low
    if score >= 70:
        return high
    if score >= 45:
        return medium
    return low


def cap_candidate(candidate: float | None, lambda_v0: float | None, min_factor: float, max_factor: float) -> tuple[float | None, bool]:
    if candidate is None or lambda_v0 is None or lambda_v0 <= 0:
        return candidate, False
    lo = lambda_v0 * min_factor
    hi = lambda_v0 * max_factor
    capped = clamp(candidate, lo, hi)
    return capped, capped != candidate


def candidate_rule(
    lambda_v0: float | None,
    trend_row: dict,
    pattern_row: dict,
) -> dict:
    label = pattern_row.get("pattern_label") or "sparse_low_history"
    group = pattern_row.get("pattern_group") or "sparse"
    trend_class = trend_row.get("trend_class") or pattern_row.get("trend_class") or "insufficient_data"
    score = safe_float(pattern_row.get("predictability_score"))
    rating = pattern_row.get("predictability_rating") or "unknown"
    recent5 = safe_float(trend_row.get("last5_mean"))
    first5 = safe_float(trend_row.get("first5_mean"))
    trend_next = projected_lambda(trend_row)
    uncertainty_load_hint_pct = 0.0
    raw = lambda_v0
    capped = False
    weight = 0.0
    target = lambda_v0
    action = "keep_v0_average"
    estimator = "historical_average"
    confidence = "medium"
    reason = "Current historical-average lambda remains the candidate estimator."
    min_factor = MIN_FACTOR
    max_factor = MAX_FACTOR

    if lambda_v0 is None:
        return {
            "lambda_candidate": None,
            "lambda_candidate_raw": None,
            "lambda_recent5": recent5,
            "lambda_trend_next": trend_next,
            "lambda_target": None,
            "rule_weight": None,
            "cap_applied": False,
            "pricing_action": "missing_v0_lambda",
            "candidate_estimator": "none",
            "confidence": "insufficient",
            "uncertainty_load_hint_pct": None,
            "reason": "No v0 lambda is available for this county/threshold.",
        }

    if label == "smooth_worsening":
        target = trend_next
        weight = weight_from_score(score, high=0.65, medium=0.45, low=0.25)
        raw = max(lambda_v0, blend(lambda_v0, target, weight) or lambda_v0)
        action = "trend_blend_up"
        estimator = "trend_projection_blend"
        confidence = "high" if rating == "high" else "medium"
        reason = "Smooth worsening history supports blending v0 lambda toward the fitted forward trend."
    elif label == "smooth_improving":
        target = trend_next
        weight = weight_from_score(score, high=0.55, medium=0.35, low=0.20)
        raw = min(lambda_v0, blend(lambda_v0, target, weight) or lambda_v0)
        action = "trend_blend_down_guarded"
        estimator = "trend_projection_blend"
        confidence = "medium"
        reason = "Smooth improving history supports a guarded blend toward the fitted forward trend; discount is capped."
    elif label == "step_change_up":
        target = recent5
        weight = 0.75
        raw = max(lambda_v0, blend(lambda_v0, target, weight) or lambda_v0)
        action = "recent_regime_up"
        estimator = "recent5_regime_blend"
        confidence = "medium"
        reason = "Recent regime is materially higher than the early period, so the full-history average is likely stale."
    elif label == "step_change_down":
        target = recent5
        weight = 0.50
        raw = min(lambda_v0, blend(lambda_v0, target, weight) or lambda_v0)
        action = "recent_regime_down_guarded"
        estimator = "recent5_regime_blend"
        confidence = "medium"
        min_factor = MIN_FACTOR_STEP_DOWN
        reason = "Recent regime is lower than the early period, but the discount is guarded until persistence is validated."
    elif label == "volatile_worsening":
        target = trend_next
        weight = 0.25
        raw = max(lambda_v0, blend(lambda_v0, target, weight) or lambda_v0)
        action = "light_trend_blend_up_review"
        estimator = "light_trend_projection_blend"
        confidence = "low"
        uncertainty_load_hint_pct = 0.10
        reason = "Worsening direction exists, but noise/outliers make this a light blend plus review rather than a full trend price."
    elif label == "volatile_improving":
        target = trend_next
        weight = 0.15
        raw = min(lambda_v0, blend(lambda_v0, target, weight) or lambda_v0)
        action = "light_trend_blend_down_review"
        estimator = "light_trend_projection_blend"
        confidence = "low"
        min_factor = MIN_FACTOR_VOLATILE_DOWN
        uncertainty_load_hint_pct = 0.10
        reason = "Improving direction is noisy, so any downward adjustment is small and requires review."
    elif label == "stable_predictable":
        action = "keep_v0_average"
        estimator = "historical_average"
        confidence = "high"
        reason = "Stable, regular annual history supports the existing long-run historical average."
    elif label == "stable_noisy":
        action = "keep_v0_average_uncertainty_review"
        estimator = "historical_average"
        confidence = "low"
        uncertainty_load_hint_pct = 0.10
        reason = "Direction is stable but noisy; keep lambda average and evaluate a confidence load rather than changing frequency."
    elif label == "episodic_spiky":
        action = "hazard_context_required"
        estimator = "historical_average"
        confidence = "low"
        uncertainty_load_hint_pct = 0.15
        reason = "One or two years dominate the history; simple trend is not the right pricing estimator without hazard context."
    elif label == "sparse_low_history" or trend_class == "insufficient_data" or group == "sparse":
        action = "no_trend_adjustment_sparse"
        estimator = "historical_average_or_no_quote"
        confidence = "insufficient"
        reason = "Too few qualifying events to justify a trend or recency adjustment."

    candidate, capped = cap_candidate(raw, lambda_v0, min_factor=min_factor, max_factor=max_factor)
    return {
        "lambda_candidate": candidate,
        "lambda_candidate_raw": raw,
        "lambda_recent5": recent5,
        "lambda_first5": first5,
        "lambda_trend_next": trend_next,
        "lambda_target": target,
        "rule_weight": weight,
        "cap_applied": capped,
        "min_factor": min_factor,
        "max_factor": max_factor,
        "pricing_action": action,
        "candidate_estimator": estimator,
        "confidence": confidence,
        "uncertainty_load_hint_pct": uncertainty_load_hint_pct,
        "reason": reason,
    }


def build_row(fips: str, T: str, drill_row: dict, trend_row: dict, pattern_row: dict, catalog_id: str, generated_at: str) -> dict:
    grid_cell = (drill_row.get("grid") or {}).get(str(T)) or {}
    lambda_v0 = safe_float(grid_cell.get("lambda_T"))
    retail_v0 = safe_float((grid_cell.get("X") or {}).get(str(PAYOUT_REFERENCE), {}).get("retail"))
    pure_v0 = safe_float((grid_cell.get("X") or {}).get(str(PAYOUT_REFERENCE), {}).get("pure"))
    rule = candidate_rule(lambda_v0, trend_row, pattern_row)
    lambda_candidate = rule["lambda_candidate"]
    factor = safe_div(lambda_candidate, lambda_v0)
    retail_candidate = retail_v0 * factor if retail_v0 is not None and factor is not None else None
    pure_candidate = pure_v0 * factor if pure_v0 is not None and factor is not None else None

    return {
        "catalog_id": catalog_id,
        "generated_at": generated_at,
        "source_version": SOURCE_VERSION,
        "fips": int(fips),
        "T": int(T),
        "tier": drill_row.get("tier"),
        "quotable": bool(drill_row.get("quotable")),
        "trend_class": trend_row.get("trend_class") or pattern_row.get("trend_class"),
        "pattern_label": pattern_row.get("pattern_label"),
        "pattern_group": pattern_row.get("pattern_group"),
        "predictability_score": safe_float(pattern_row.get("predictability_score")),
        "predictability_rating": pattern_row.get("predictability_rating"),
        "lambda_v0": lambda_v0,
        **rule,
        "adjustment_factor": factor,
        "adjustment_pct": None if factor is None else factor - 1.0,
        "pure_v0_x2500": pure_v0,
        "pure_candidate_x2500": pure_candidate,
        "pure_delta_x2500": None if pure_v0 is None or pure_candidate is None else pure_candidate - pure_v0,
        "retail_v0_x2500": retail_v0,
        "retail_candidate_x2500": retail_candidate,
        "retail_delta_x2500": None if retail_v0 is None or retail_candidate is None else retail_candidate - retail_v0,
        "shadow_only": True,
    }


def compact_cell(row: dict) -> dict:
    keep = [
        "trend_class",
        "pattern_label",
        "pattern_group",
        "predictability_score",
        "predictability_rating",
        "lambda_v0",
        "lambda_candidate",
        "lambda_candidate_raw",
        "lambda_recent5",
        "lambda_first5",
        "lambda_trend_next",
        "lambda_target",
        "adjustment_factor",
        "adjustment_pct",
        "pricing_action",
        "candidate_estimator",
        "confidence",
        "rule_weight",
        "cap_applied",
        "min_factor",
        "max_factor",
        "uncertainty_load_hint_pct",
        "retail_v0_x2500",
        "retail_candidate_x2500",
        "retail_delta_x2500",
        "reason",
    ]
    return {k: row.get(k) for k in keep}


def summarize_fips(rows: list[dict]) -> dict:
    factors = [float(r["adjustment_factor"]) for r in rows if safe_float(r.get("adjustment_factor")) is not None]
    actions = Counter(r["pricing_action"] for r in rows if r.get("pricing_action"))
    if not factors:
        return {
            "dominant_pricing_action": "missing_v0_lambda",
            "mean_adjustment_factor": None,
            "max_adjustment_factor": None,
            "min_adjustment_factor": None,
            "adjusted_threshold_count": 0,
            "uplift_threshold_count": 0,
            "discount_threshold_count": 0,
        }
    adjusted = [f for f in factors if abs(f - 1.0) >= 0.02]
    return {
        "dominant_pricing_action": actions.most_common(1)[0][0] if actions else "unknown",
        "mean_adjustment_factor": float(np.mean(factors)),
        "max_adjustment_factor": float(np.max(factors)),
        "min_adjustment_factor": float(np.min(factors)),
        "adjusted_threshold_count": int(len(adjusted)),
        "uplift_threshold_count": int(sum(f > 1.02 for f in factors)),
        "discount_threshold_count": int(sum(f < 0.98 for f in factors)),
    }


def run_catalog(catalog_id: str, out_rel: str) -> pd.DataFrame:
    pricing_rel = f"price_engine/catalogs/{catalog_id}/pricing"
    drill_rel = f"{pricing_rel}/county_drilldown.json"
    trend_rel = f"{pricing_rel}/county_yearly_trend.json"
    predictability_rel = f"{pricing_rel}/county_predictability.json"
    for rel in (drill_rel, trend_rel, predictability_rel):
        if not gcs_io.exists(data_paths.resolve(rel)):
            raise FileNotFoundError(f"{rel} missing; build pricing/trend/predictability first")

    drilldown = gcs_io.read_json(data_paths.resolve(drill_rel))
    trend = gcs_io.read_json(data_paths.resolve(trend_rel))
    predictability = gcs_io.read_json(data_paths.resolve(predictability_rel))
    generated_at = datetime.now(timezone.utc).isoformat()

    rows: list[dict] = []
    for fips, drill_row in drilldown.items():
        trend_by_t = trend.get("view", {}).get(str(fips), {})
        pattern_by_t = predictability.get("view", {}).get(str(fips), {})
        for T in trend.get("meta", {}).get("T_grid", [2, 4, 8, 12, 24]):
            trend_row = trend_by_t.get(str(T), {})
            pattern_row = pattern_by_t.get(str(T), {})
            rows.append(build_row(str(fips), str(T), drill_row, trend_row, pattern_row, catalog_id, generated_at))

    df = pd.DataFrame(rows)

    parquet_path = data_paths.resolve(f"{out_rel}/county_lambda_shadow__{catalog_id}.parquet")
    gcs_io.write_parquet(df, parquet_path, index=False)
    print(f"[{catalog_id}] wrote {parquet_path} ({len(df):,} rows)")

    view: dict[str, dict[str, dict]] = {}
    summary: dict[str, dict] = {}
    for fips, sub in df.groupby("fips", sort=False):
        fips_key = str(int(fips))
        rows_for_fips = sub.to_dict("records")
        view[fips_key] = {str(int(r["T"])): compact_cell(r) for r in rows_for_fips}
        summary[fips_key] = summarize_fips(rows_for_fips)

    payload = {
        "meta": {
            "catalog_id": catalog_id,
            "generated_at": generated_at,
            "source_version": SOURCE_VERSION,
            "T_grid": trend.get("meta", {}).get("T_grid", [2, 4, 8, 12, 24]),
            "trend_years": trend.get("meta", {}).get("trend_years", list(range(2015, 2026))),
            "reference_payout": PAYOUT_REFERENCE,
            "factor_caps": {
                "global_min": MIN_FACTOR,
                "global_max": MAX_FACTOR,
                "volatile_down_min": MIN_FACTOR_VOLATILE_DOWN,
                "step_down_min": MIN_FACTOR_STEP_DOWN,
            },
            "shadow_only": True,
            "pricing_boundary": (
                "This artifact does not mutate v0 pricing. It is a candidate "
                "lambda-adjustment read for validation, backtesting, and review."
            ),
        },
        "summary": summary,
        "view": view,
    }

    clean_payload = clean_json_value(payload)
    json_path = data_paths.resolve(f"{out_rel}/county_lambda_shadow__{catalog_id}.json")
    gcs_io.write_json(clean_payload, json_path, separators=(",", ":"), allow_nan=False)
    print(f"[{catalog_id}] wrote {json_path} ({len(view):,} fips)")

    mirror_path = data_paths.resolve(f"{pricing_rel}/county_lambda_shadow.json")
    gcs_io.write_json(clean_payload, mirror_path, separators=(",", ":"), allow_nan=False)
    print(f"[{catalog_id}] mirrored to {mirror_path}")

    dist = df.groupby(["T", "pricing_action"], dropna=False).size().unstack(fill_value=0)
    print(f"[{catalog_id}] pricing-action distribution by T:")
    print(dist.to_string())
    return df


def main() -> None:
    parser = argparse.ArgumentParser(description="County lambda shadow-pricing pipeline.")
    parser.add_argument("--catalogs", nargs="+", default=DEFAULT_CATALOGS)
    parser.add_argument("--out-dir", default=DEFAULT_OUT_REL)
    args = parser.parse_args()

    out_rel = args.out_dir
    for catalog_id in args.catalogs:
        run_catalog(catalog_id, out_rel)


if __name__ == "__main__":
    main()
