"""County outage predictability-pattern pipeline.

Builds a descriptive pattern layer from the county yearly trend artifact.
The output is not a pricing input. It answers a narrower question:

    How usable is the simple annual trend line for this county/threshold?

The rules are intentionally transparent. They separate direction
(worsening/stable/improving) from reliability (residual noise, outliers,
one-year dominance, sparse history, and step changes).

Schema: curated_outage_data/schemas/county_predictability.md
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

REPO = Path(__file__).resolve().parents[3]
DEFAULT_CATALOGS = ["eagle-i-30min", "eagle-i-45min", "eagle-i-60min"]
DEFAULT_OUT_DIR = REPO / "curated_outage_data" / "outputs" / "county_predictability"

BANDS = {
    "p10p90": 1.2815515655446004,
    "p5p95": 1.6448536269514722,
    "p1p99": 2.5758293035489004,
}

MIN_TOTAL_EVENTS_IN_WINDOW = 10
MIN_OBSERVED_YEARS_FOR_PATTERN = 6
SOURCE_VERSION = "2026-06-20"

EPISODIC_PEAK_SHARE_THRESHOLD = 0.35
EPISODIC_TOP2_SHARE_THRESHOLD = 0.55

VOLATILE_RESIDUAL_CV_THRESHOLD = 0.55
VOLATILE_OUTLIER_COUNT_THRESHOLD = 3
VOLATILE_DIRECTIONAL_R2_THRESHOLD = 0.35

STEP_MIN_SIDE_YEARS = 3
STEP_MIN_ABS_SHIFT = 5.0
STEP_MIN_REL_SHIFT = 0.50
STEP_MIN_PIECEWISE_RSS_REDUCTION = 0.25

PATTERN_DEFINITIONS = {
    "smooth_worsening": "Positive trend, low residual noise, few outliers.",
    "volatile_worsening": "Positive trend exists, but repeated residual noise or outliers make the simple line less reliable.",
    "step_change_up": "Observed lower regime followed by an observed higher regime; better read as a level shift than a smooth line.",
    "smooth_improving": "Negative trend, low residual noise, few outliers.",
    "volatile_improving": "Negative trend exists, but repeated residual noise or outliers make the simple line less reliable.",
    "step_change_down": "Observed higher regime followed by an observed lower regime; better read as a level shift than a smooth line.",
    "stable_predictable": "Flat trend with low year-to-year residual noise.",
    "stable_noisy": "No reliable direction, but high year-to-year noise or outliers make the average less clean.",
    "episodic_spiky": "One or two years dominate the 11-year history.",
    "sparse_low_history": "Too few qualifying events to classify a stable pattern.",
}


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


def safe_div(num: float, den: float) -> float | None:
    if den is None or den == 0:
        return None
    return float(num) / float(den)


def clean_json_value(value):
    """Return a strict-JSON-safe copy with NaN/Inf converted to null."""
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


def clamp(value: float, lo: float, hi: float) -> float:
    return min(max(value, lo), hi)


def observed_pairs_from_series(years: list[int], counts: list[int | None]) -> list[tuple[int, int]]:
    return [
        (int(year), int(count))
        for year, count in zip(years, counts, strict=True)
        if count is not None
    ]


def residual_features(years: list[int], counts: list[int | None], slope, intercept) -> dict:
    observed_pairs = observed_pairs_from_series(years, counts)
    observed_years = [year for year, _ in observed_pairs]
    y = np.array([count for _, count in observed_pairs], dtype=float)
    total = float(y.sum())
    mean = float(y.mean()) if len(y) else 0.0
    std = float(y.std(ddof=0)) if len(y) else 0.0
    peak_count = int(y.max()) if len(y) else 0
    peak_idx = int(y.argmax()) if len(y) else 0
    top2 = float(np.sort(y)[-2:].sum()) if len(y) >= 2 else total

    out = {
        "observed_year_count": int(len(y)),
        "missing_year_count": int(len(counts) - len(y)),
        "mean_count": mean,
        "std_count": std,
        "cv_count": safe_div(std, mean),
        "observed_zero_year_count": int((y == 0).sum()),
        # Backward-compatible alias. This now means observed zero years only;
        # missing years are counted separately as missing_year_count.
        "zero_year_count": int((y == 0).sum()),
        "peak_year": int(observed_years[peak_idx]) if observed_years else None,
        "peak_count": peak_count,
        "peak_share_total": safe_div(peak_count, total),
        "top2_share_total": safe_div(top2, total),
        "residual_sigma": None,
        "residual_cv": None,
        "r_squared": None,
        "max_abs_residual": None,
        "max_abs_residual_pct_mean": None,
        "outlier_count_p10p90": None,
        "outlier_count_p5p95": None,
        "outlier_count_p1p99": None,
        "outlier_years_p10p90": [],
    }

    slope = safe_float(slope)
    intercept = safe_float(intercept)
    if slope is None or intercept is None or len(y) <= 2:
        return out

    x = np.array(observed_years, dtype=float)
    fitted = intercept + slope * x
    residuals = y - fitted
    rss = float((residuals * residuals).sum())
    tss = float(((y - mean) * (y - mean)).sum())
    sigma = float(np.sqrt(rss / max(1, len(y) - 2)))
    max_abs = float(np.max(np.abs(residuals))) if len(residuals) else 0.0

    out["residual_sigma"] = sigma
    out["residual_cv"] = safe_div(sigma, mean)
    out["r_squared"] = None if tss <= 0 else 1.0 - rss / tss
    out["max_abs_residual"] = max_abs
    out["max_abs_residual_pct_mean"] = safe_div(max_abs, mean)

    if sigma > 0:
        for key, z in BANDS.items():
            offset = z * sigma
            is_outlier = np.abs(residuals) > offset
            out[f"outlier_count_{key}"] = int(is_outlier.sum())
            if key == "p10p90":
                out["outlier_years_p10p90"] = [int(observed_years[i]) for i, flag in enumerate(is_outlier) if flag]
    else:
        for key in BANDS:
            out[f"outlier_count_{key}"] = 0

    return out


def step_change_features(
    years: list[int],
    counts: list[int | None],
    slope,
    intercept,
) -> dict:
    """Evaluate whether a two-level regime fit beats a single line.

    This is a transparent screening statistic, not a formal causality test. It
    enforces observed support on both sides so missing early years cannot create
    fake step-change labels.
    """
    out = {
        "step_change_candidate": False,
        "step_change_direction": None,
        "step_change_year": None,
        "step_pre_mean": None,
        "step_post_mean": None,
        "step_abs_shift": None,
        "step_rel_shift": None,
        "step_linear_rss": None,
        "step_piecewise_rss": None,
        "step_piecewise_rss_reduction": None,
    }

    pairs = observed_pairs_from_series(years, counts)
    if len(pairs) < 2 * STEP_MIN_SIDE_YEARS:
        return out

    observed_years = np.array([year for year, _ in pairs], dtype=float)
    y = np.array([count for _, count in pairs], dtype=float)
    slope = safe_float(slope)
    intercept = safe_float(intercept)
    if slope is None or intercept is None:
        return out

    fitted = intercept + slope * observed_years
    linear_rss = float(((y - fitted) * (y - fitted)).sum())
    if linear_rss <= 0:
        return out

    best = None
    n = len(y)
    for split_idx in range(STEP_MIN_SIDE_YEARS, n - STEP_MIN_SIDE_YEARS + 1):
        left = y[:split_idx]
        right = y[split_idx:]
        left_mean = float(left.mean())
        right_mean = float(right.mean())
        piecewise_rss = float(((left - left_mean) * (left - left_mean)).sum())
        piecewise_rss += float(((right - right_mean) * (right - right_mean)).sum())
        reduction = (linear_rss - piecewise_rss) / linear_rss
        abs_shift = abs(right_mean - left_mean)
        rel_shift = abs_shift / max(abs(left_mean), 1.0)
        candidate = {
            "split_idx": split_idx,
            "step_change_year": int(pairs[split_idx][0]),
            "pre_mean": left_mean,
            "post_mean": right_mean,
            "abs_shift": abs_shift,
            "rel_shift": rel_shift,
            "piecewise_rss": piecewise_rss,
            "reduction": reduction,
        }
        if best is None or reduction > best["reduction"]:
            best = candidate

    if best is None:
        return out

    direction = "up" if best["post_mean"] > best["pre_mean"] else "down"
    is_candidate = (
        best["abs_shift"] >= STEP_MIN_ABS_SHIFT
        and best["rel_shift"] >= STEP_MIN_REL_SHIFT
        and best["reduction"] >= STEP_MIN_PIECEWISE_RSS_REDUCTION
    )

    out.update({
        "step_change_candidate": bool(is_candidate),
        "step_change_direction": direction,
        "step_change_year": int(best["step_change_year"]),
        "step_pre_mean": float(best["pre_mean"]),
        "step_post_mean": float(best["post_mean"]),
        "step_abs_shift": float(best["abs_shift"]),
        "step_rel_shift": float(best["rel_shift"]),
        "step_linear_rss": linear_rss,
        "step_piecewise_rss": float(best["piecewise_rss"]),
        "step_piecewise_rss_reduction": float(best["reduction"]),
    })
    return out


def trend_magnitude_bucket(slope_pct_of_mean: float | None, slope_abs: float | None) -> str:
    if slope_pct_of_mean is not None:
        v = abs(slope_pct_of_mean)
        if v >= 0.20:
            return "strong"
        if v >= 0.08:
            return "moderate"
        return "weak"
    if slope_abs is not None and abs(slope_abs) >= 5:
        return "moderate"
    return "weak"


def score_predictability(features: dict, trend_class: str, pattern_group: str) -> tuple[int, str]:
    if features["total_events_in_window"] < MIN_TOTAL_EVENTS_IN_WINDOW:
        return 0, "insufficient"
    if features.get("observed_year_count", 0) < MIN_OBSERVED_YEARS_FOR_PATTERN:
        return 0, "insufficient"

    residual_cv = features.get("residual_cv")
    residual_component = 0.5 if residual_cv is None else 1.0 - clamp(residual_cv / 1.5, 0.0, 1.0)

    outliers = features.get("outlier_count_p10p90")
    outlier_component = 0.5 if outliers is None else 1.0 - clamp(float(outliers) / 4.0, 0.0, 1.0)

    peak_share = features.get("peak_share_total")
    dominance_component = 0.5 if peak_share is None else 1.0 - clamp(float(peak_share) / 0.45, 0.0, 1.0)

    observed_year_count = float(features.get("observed_year_count") or 0)
    zero_den = max(1.0, min(6.0, observed_year_count))
    zero_component = 1.0 - clamp(float(features.get("observed_zero_year_count") or 0) / zero_den, 0.0, 1.0)
    coverage_component = clamp(observed_year_count / 11.0, 0.0, 1.0)

    r2 = features.get("r_squared")
    if r2 is None:
        fit_component = residual_component
    elif trend_class == "stable":
        fit_component = residual_component
    else:
        fit_component = clamp(float(r2), 0.0, 1.0)

    score = 100.0 * (
        0.30 * residual_component
        + 0.18 * outlier_component
        + 0.18 * dominance_component
        + 0.12 * zero_component
        + 0.10 * fit_component
        + 0.12 * coverage_component
    )

    if pattern_group == "step_change":
        score = min(score, 65.0)
    elif pattern_group == "episodic":
        score = min(score, 45.0)

    score_i = int(round(clamp(score, 0.0, 100.0)))
    if score_i >= 70:
        rating = "high"
    elif score_i >= 45:
        rating = "medium"
    else:
        rating = "low"
    return score_i, rating


def classify_pattern(row: dict, features: dict) -> dict:
    trend_class = row.get("trend_class") or "insufficient_data"
    total = int(row.get("total_events_in_window") or 0)
    slope = safe_float(row.get("slope_events_per_year"))
    mean = features["mean_count"]
    slope_pct = safe_div(slope or 0.0, mean) if mean > 0 else None

    features["slope_pct_of_mean"] = slope_pct
    features["trend_magnitude_bucket"] = trend_magnitude_bucket(slope_pct, slope)

    if (
        total < MIN_TOTAL_EVENTS_IN_WINDOW
        or trend_class == "insufficient_data"
        or features.get("observed_year_count", 0) < MIN_OBSERVED_YEARS_FOR_PATTERN
    ):
        pattern = "sparse_low_history"
        group = "sparse"
        rule = "observation_gate"
    else:
        residual_cv = features.get("residual_cv")
        outliers = features.get("outlier_count_p10p90") or 0
        peak_share = features.get("peak_share_total") or 0.0
        top2_share = features.get("top2_share_total") or 0.0
        r2 = features.get("r_squared")

        volatile = (
            (residual_cv is not None and residual_cv >= VOLATILE_RESIDUAL_CV_THRESHOLD)
            or outliers >= VOLATILE_OUTLIER_COUNT_THRESHOLD
            or (
                trend_class != "stable"
                and r2 is not None
                and r2 < VOLATILE_DIRECTIONAL_R2_THRESHOLD
            )
        )

        episodic = (
            peak_share >= EPISODIC_PEAK_SHARE_THRESHOLD
            or top2_share >= EPISODIC_TOP2_SHARE_THRESHOLD
        )

        if episodic:
            pattern = "episodic_spiky"
            group = "episodic"
            rule = "dominance_gate"
        elif features.get("step_change_candidate") and features.get("step_change_direction") == "up":
            pattern = "step_change_up"
            group = "step_change"
            rule = "piecewise_regime_gate"
        elif features.get("step_change_candidate") and features.get("step_change_direction") == "down":
            pattern = "step_change_down"
            group = "step_change"
            rule = "piecewise_regime_gate"
        elif trend_class == "worsening":
            pattern = "volatile_worsening" if volatile else "smooth_worsening"
            group = "volatile_trend" if volatile else "smooth_trend"
            rule = "direction_gate"
        elif trend_class == "improving":
            pattern = "volatile_improving" if volatile else "smooth_improving"
            group = "volatile_trend" if volatile else "smooth_trend"
            rule = "direction_gate"
        else:
            pattern = "stable_noisy" if volatile else "stable_predictable"
            group = "stable_noisy" if volatile else "stable_regular"
            rule = "no_direction_gate"

    score, rating = score_predictability(
        {**features, "total_events_in_window": total},
        trend_class,
        group,
    )

    return {
        "pattern_label": pattern,
        "pattern_group": group,
        "predictability_score": score,
        "predictability_rating": rating,
        "classification_rule": rule,
    }


def build_row(fips: str, T: str, trend_row: dict, catalog_id: str, generated_at: str) -> dict:
    years = [int(y) for y in trend_row.get("years", [])]
    counts = [
        None if c is None else int(c)
        for c in trend_row.get("yearly_counts", [])
    ]
    features = residual_features(
        years,
        counts,
        trend_row.get("slope_events_per_year"),
        trend_row.get("intercept"),
    )
    features.update(step_change_features(
        years,
        counts,
        trend_row.get("slope_events_per_year"),
        trend_row.get("intercept"),
    ))
    fallback_total = sum(int(c) for c in counts if c is not None)
    trend_total = trend_row.get("total_events_in_window")
    features["total_events_in_window"] = int(trend_total) if trend_total is not None else int(fallback_total)
    labels = classify_pattern(trend_row, features)

    return {
        "catalog_id": catalog_id,
        "generated_at": generated_at,
        "source_version": SOURCE_VERSION,
        "fips": int(fips),
        "T": int(T),
        "trend_class": trend_row.get("trend_class") or "insufficient_data",
        "slope_events_per_year": safe_float(trend_row.get("slope_events_per_year")),
        "slope_pct_of_mean": safe_float(features.get("slope_pct_of_mean")),
        "trend_magnitude_bucket": features.get("trend_magnitude_bucket"),
        "pct_change_first5_last5": safe_float(trend_row.get("pct_change_first5_last5")),
        "first5_mean": safe_float(trend_row.get("first5_mean")),
        "last5_mean": safe_float(trend_row.get("last5_mean")),
        "total_events_in_window": features["total_events_in_window"],
        "observed_year_count": features.get("observed_year_count"),
        "missing_year_count": features.get("missing_year_count"),
        "missing_years": trend_row.get("missing_years", []),
        "observed_zero_year_count": features.get("observed_zero_year_count"),
        "insufficient_reason": trend_row.get("insufficient_reason"),
        "mean_count": safe_float(features.get("mean_count")),
        "cv_count": safe_float(features.get("cv_count")),
        "residual_sigma": safe_float(features.get("residual_sigma")),
        "residual_cv": safe_float(features.get("residual_cv")),
        "r_squared": safe_float(features.get("r_squared")),
        "max_abs_residual": safe_float(features.get("max_abs_residual")),
        "max_abs_residual_pct_mean": safe_float(features.get("max_abs_residual_pct_mean")),
        "outlier_count_p10p90": features.get("outlier_count_p10p90"),
        "outlier_count_p5p95": features.get("outlier_count_p5p95"),
        "outlier_count_p1p99": features.get("outlier_count_p1p99"),
        "outlier_years_p10p90": features.get("outlier_years_p10p90"),
        "zero_year_count": features.get("zero_year_count"),
        "peak_year": features.get("peak_year"),
        "peak_count": features.get("peak_count"),
        "peak_share_total": safe_float(features.get("peak_share_total")),
        "top2_share_total": safe_float(features.get("top2_share_total")),
        "step_change_candidate": features.get("step_change_candidate"),
        "step_change_direction": features.get("step_change_direction"),
        "step_change_year": features.get("step_change_year"),
        "step_pre_mean": safe_float(features.get("step_pre_mean")),
        "step_post_mean": safe_float(features.get("step_post_mean")),
        "step_abs_shift": safe_float(features.get("step_abs_shift")),
        "step_rel_shift": safe_float(features.get("step_rel_shift")),
        "step_piecewise_rss_reduction": safe_float(features.get("step_piecewise_rss_reduction")),
        **labels,
    }


def summarize_fips(rows: list[dict]) -> dict:
    sufficient = [r for r in rows if r["pattern_group"] != "sparse"]
    if not sufficient:
        return {
            "sufficient_thresholds": 0,
            "dominant_trend_class": "insufficient_data",
            "trend_consistency_score": 0.0,
            "dominant_pattern_group": "sparse",
            "pattern_consistency_score": 0.0,
            "mean_predictability_score": 0.0,
            "predictable_threshold_count": 0,
            "high_predictability_threshold_count": 0,
            "summary_label": "insufficient_history",
        }

    trend_counts = Counter(r["trend_class"] for r in sufficient)
    pattern_counts = Counter(r["pattern_group"] for r in sufficient)
    dominant_trend, trend_n = trend_counts.most_common(1)[0]
    dominant_pattern, pattern_n = pattern_counts.most_common(1)[0]
    scores = [float(r["predictability_score"]) for r in sufficient]
    predictable_count = sum(r["predictability_rating"] in ("high", "medium") for r in sufficient)
    high_count = sum(r["predictability_rating"] == "high" for r in sufficient)
    mean_score = float(np.mean(scores)) if scores else 0.0
    trend_consistency = trend_n / len(sufficient)
    pattern_consistency = pattern_n / len(sufficient)

    if mean_score >= 70 and trend_consistency >= 0.6:
        summary_label = "consistent_predictable"
    elif dominant_pattern in ("episodic", "volatile_trend", "stable_noisy") or mean_score < 45:
        summary_label = "low_predictability"
    else:
        summary_label = "mixed_predictability"

    return {
        "sufficient_thresholds": len(sufficient),
        "dominant_trend_class": dominant_trend,
        "trend_consistency_score": trend_consistency,
        "dominant_pattern_group": dominant_pattern,
        "pattern_consistency_score": pattern_consistency,
        "mean_predictability_score": mean_score,
        "predictable_threshold_count": int(predictable_count),
        "high_predictability_threshold_count": int(high_count),
        "summary_label": summary_label,
    }


def compact_cell(row: dict) -> dict:
    keep = [
        "trend_class",
        "slope_events_per_year",
        "slope_pct_of_mean",
        "trend_magnitude_bucket",
        "pct_change_first5_last5",
        "total_events_in_window",
        "observed_year_count",
        "missing_year_count",
        "missing_years",
        "observed_zero_year_count",
        "insufficient_reason",
        "mean_count",
        "residual_cv",
        "r_squared",
        "max_abs_residual_pct_mean",
        "outlier_count_p10p90",
        "outlier_count_p5p95",
        "outlier_count_p1p99",
        "outlier_years_p10p90",
        "zero_year_count",
        "peak_year",
        "peak_count",
        "peak_share_total",
        "top2_share_total",
        "step_change_candidate",
        "step_change_direction",
        "step_change_year",
        "step_pre_mean",
        "step_post_mean",
        "step_abs_shift",
        "step_rel_shift",
        "step_piecewise_rss_reduction",
        "pattern_label",
        "pattern_group",
        "predictability_score",
        "predictability_rating",
        "classification_rule",
    ]
    return {k: row.get(k) for k in keep}


def run_catalog(catalog_id: str, out_dir: Path) -> pd.DataFrame:
    trend_path = REPO / "price_engine" / "catalogs" / catalog_id / "pricing" / "county_yearly_trend.json"
    if not trend_path.exists():
        raise FileNotFoundError(f"{trend_path} missing; run county_trend pipeline first")

    trend_payload = json.loads(trend_path.read_text())
    generated_at = datetime.now(timezone.utc).isoformat()
    all_rows: list[dict] = []
    for fips, per_t in trend_payload.get("view", {}).items():
        for T, trend_row in per_t.items():
            all_rows.append(build_row(fips, T, trend_row, catalog_id, generated_at))

    df = pd.DataFrame(all_rows)
    out_dir.mkdir(parents=True, exist_ok=True)

    parquet_path = out_dir / f"county_predictability__{catalog_id}.parquet"
    df.to_parquet(parquet_path, index=False)
    print(f"[{catalog_id}] wrote {parquet_path} ({len(df):,} rows)")

    view: dict[str, dict[str, dict]] = {}
    summary: dict[str, dict] = {}
    for fips, sub in df.groupby("fips", sort=False):
        fips_key = str(int(fips))
        rows = sub.to_dict("records")
        view[fips_key] = {str(int(r["T"])): compact_cell(r) for r in rows}
        summary[fips_key] = summarize_fips(rows)

    payload = {
        "meta": {
            "catalog_id": catalog_id,
            "generated_at": generated_at,
            "source_version": SOURCE_VERSION,
            "T_grid": trend_payload.get("meta", {}).get("T_grid", [2, 4, 8, 12, 24]),
            "trend_years": trend_payload.get("meta", {}).get("trend_years", list(range(2015, 2026))),
            "minimum_events_for_pattern": MIN_TOTAL_EVENTS_IN_WINDOW,
            "minimum_observed_years_for_pattern": MIN_OBSERVED_YEARS_FOR_PATTERN,
            "missing_year_policy": (
                "yearly_counts may contain null for missing/partial source years. "
                "Residuals, outliers, peak share, zero-year counts, and scores use observed years only."
            ),
            "classification_order": [
                "observation_gate",
                "dominance_gate",
                "piecewise_regime_gate",
                "direction_gate",
                "no_direction_gate",
            ],
            "classification_thresholds": {
                "episodic_peak_share": EPISODIC_PEAK_SHARE_THRESHOLD,
                "episodic_top2_share": EPISODIC_TOP2_SHARE_THRESHOLD,
                "volatile_residual_cv": VOLATILE_RESIDUAL_CV_THRESHOLD,
                "volatile_outlier_count": VOLATILE_OUTLIER_COUNT_THRESHOLD,
                "volatile_directional_r2": VOLATILE_DIRECTIONAL_R2_THRESHOLD,
                "step_min_side_years": STEP_MIN_SIDE_YEARS,
                "step_min_abs_shift": STEP_MIN_ABS_SHIFT,
                "step_min_rel_shift": STEP_MIN_REL_SHIFT,
                "step_min_piecewise_rss_reduction": STEP_MIN_PIECEWISE_RSS_REDUCTION,
            },
            "bands": {k: {"z": v} for k, v in BANDS.items()},
            "pattern_definitions": PATTERN_DEFINITIONS,
            "descriptive_only": (
                "This predictability layer is descriptive and is NOT used in v0 pricing. "
                "It rates how usable a simple annual trend line is for review."
            ),
        },
        "summary": summary,
        "view": view,
    }

    json_text = json.dumps(clean_json_value(payload), separators=(",", ":"), allow_nan=False)
    json_path = out_dir / f"county_predictability__{catalog_id}.json"
    json_path.write_text(json_text)
    print(f"[{catalog_id}] wrote {json_path} ({len(view):,} fips)")

    catalog_pricing = REPO / "price_engine" / "catalogs" / catalog_id / "pricing"
    if catalog_pricing.exists():
        mirror_path = catalog_pricing / "county_predictability.json"
        mirror_path.write_text(json_text)
        print(f"[{catalog_id}] mirrored to {mirror_path}")

    dist = df.groupby(["T", "pattern_label"], dropna=False).size().unstack(fill_value=0)
    print(f"[{catalog_id}] pattern distribution by T:")
    print(dist.to_string())
    return df


def main() -> None:
    parser = argparse.ArgumentParser(description="County outage predictability-pattern pipeline.")
    parser.add_argument("--catalogs", nargs="+", default=DEFAULT_CATALOGS)
    parser.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    for catalog_id in args.catalogs:
        run_catalog(catalog_id, out_dir)


if __name__ == "__main__":
    main()
