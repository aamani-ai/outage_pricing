#!/usr/bin/env python3
"""Build the web app's bundled data from the pricing catalogs — reproducible.

Consolidates what were three scratchpad generators into one committed script, so
`web/lib/data/*.json` can always be rebuilt from source (principles/scaling.md:
no orphaned data; a reproducible pipeline).

Outputs (catalog: eagle-i-45min, the default):
  web/lib/data/pricing.json           per county × T: λ_customer + year-based band (A017) + count
  web/lib/data/studio.json            per county: regime + observed annual history
  web/lib/data/counties-by-state.json state → priced counties (for the search filter)

Run from the repo root:
  ./.venv/bin/python3 web/scripts/build_data.py
"""
import json
import math
import pathlib
from collections import defaultdict

import numpy as np
import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[2]
CATALOG = "eagle-i-45min"
OUT = ROOT / "web" / "lib" / "data"
np.random.seed(7)  # deterministic year-based band (A017) — re-runs reproduce identical numbers


def rel_band(counts: np.ndarray, conf: float = 0.80, B: int = 2000):
    """Year-based bootstrap: relative (low, high) on the mean annual rate."""
    if len(counts) < 2 or counts.mean() <= 0:
        return None
    means = counts[np.random.randint(0, len(counts), size=(B, len(counts)))].mean(1)
    lo, hi = np.percentile(means, [10, 90])
    m = counts.mean()
    return float(lo / m), float(hi / m)


def clean(v):
    return None if (v is None or (isinstance(v, float) and pd.isna(v))) else v


def fnum(v, nd, default=0.0):
    """Finite-only number → JSON-safe (NaN/Inf would be invalid JSON for the strict web bundler)."""
    try:
        f = float(v)
        return round(f, nd) if math.isfinite(f) else default
    except (TypeError, ValueError):
        return default


def rnum(v, nd):
    """Like fnum but None (not 0) when missing — for nullable audit fields the UI renders as '—'."""
    try:
        f = float(v)
        return round(f, nd) if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def main() -> None:
    pricing_dir = ROOT / "price_engine" / "catalogs" / CATALOG / "pricing"
    pc = json.load(open(pricing_dir / "per_customer_view.json"))["view"]
    dd = json.load(open(pricing_dir / "county_drilldown.json"))
    yt = pd.read_parquet(ROOT / "curated_outage_data" / "outputs" / "county_trend" / f"county_yearly_trend__{CATALOG}.parquet")
    yt["fips"] = yt["fips"].astype(str).str.zfill(5)
    reg = pd.read_csv(ROOT / "notebooks" / "outputs" / "regime_classification" / "county_regime_T8.csv", dtype={"fips": str})
    reg["fips"] = reg["fips"].str.zfill(5)

    # per (fips5, T): relative band + observed annual counts + overdispersion; years from T=8
    rel, ann, yrs, od = {}, {}, {}, {}
    for _, r in yt.iterrows():
        yc = np.asarray(r["yearly_counts"], float)
        mk = np.asarray(r["observed_year_mask"], bool)
        c = yc[mk]
        rb = rel_band(c)
        if rb:
            rel[(r["fips"], str(int(r["T"])))] = rb
        ann.setdefault(r["fips"], {})[str(int(r["T"]))] = [int(x) for x in c]
        if len(c) >= 2 and c.mean() > 0:  # overdispersion (Var/Mean): >1 = storm-clustered
            od.setdefault(r["fips"], {})[str(int(r["T"]))] = round(float(c.var() / c.mean()), 2)
        if int(r["T"]) == 8:
            yrs[r["fips"]] = [int(y) for y in np.asarray(r["years"])[mk]]

    # per-customer λ cone (median ≪ mean ≪ max) per (fips5, T) — heterogeneity + the conservative cushion read
    mult = {}
    for fips_raw, pcc in pc.items():
        f5 = str(fips_raw).zfill(5)
        m = {}
        for T in ["2", "4", "8", "12", "24"]:
            e = pcc.get(T)
            if e and e.get("lambda_customer_mean") is not None:
                m[T] = [
                    round(e.get("lambda_customer_median") or 0.0, 6),
                    round(e["lambda_customer_mean"], 6),
                    round(e.get("lambda_customer_max") or 0.0, 6),
                ]
        if m:
            mult[f5] = m

    # cell read (TRUST + POSTURE) per (fips5, T) — the per-customer "believe-it" + "lean-of-margin" tags.
    # Source: notebooks/02_per_customer/inner_event_shape_diagnostics.ipynb (see cell_read_fundamentals.md).
    cr = pd.read_csv(
        ROOT / "notebooks" / "outputs" / "inner_event_shape_diagnostics" / "county_cell_read_by_threshold.csv",
        dtype={"fips": str},
    )
    cr["fips"] = cr["fips"].str.zfill(5)

    # Posture surfaces a cushion claim ONLY where it is established. Our duration-conservatism
    # analysis shows the A011 cushion is robust at long triggers (>=8h) but THIN + timing-sensitive
    # at 2-4h, where the priced event-MEAN is duration-blind: a broad short plateau can be diluted
    # by a long thin tail, so peak/mean cannot establish a cushion. At short triggers we therefore
    # make NO cushion claim -> level "not established", route "Verify" (lead with longer triggers).
    # The rigorous short-trigger treatment (within-event load-duration recovery from the 15-min
    # path) is a deliberate, deferred build. Posture never moves the price. See cell_read_fundamentals.md.
    CUSHION_ESTABLISHED_MIN_T = 8

    def route(trust, level, gate):
        if gate == "not_available" or trust == "Thin":
            return "Suppress"
        if trust == "Medium":
            return "Caveat"
        return "Quote"

    cell = {}
    for _, r in cr.iterrows():
        Ti = int(r["T"])
        T = str(Ti)
        pcc = pc.get(str(int(r["fips"])))
        e = pcc.get(T) if pcc else None
        trust, level = clean(r["trust_lbl"]), clean(r["cushion_level"])
        rt = route(trust, level, clean(r["coverage_gate_status"]))
        if Ti < CUSHION_ESTABLISHED_MIN_T and rt != "Suppress":
            level = "not established"  # duration-blind read can't claim a cushion at short triggers
            rt = "Verify"
        mmv = float(r["mm_ratio"]) if pd.notna(r["mm_ratio"]) else float("nan")
        rec = {
            "trust": trust,
            "tnum": fnum(r["TRUST"], 2),
            "C": [fnum(r["C_source"], 2), fnum(r["C_sample"], 2), fnum(r["C_evt"], 2)],
            "level": level,
            "p2m": fnum(r["p2m_med"], 1),
            "tilt": (clean(r["cushion_tilt"]) or "").replace(" than peers", ""),
            "pctile": fnum(r["p2m_pctile"], 2),
            "n_obs": int(r["n_obs_years"]) if pd.notna(r["n_obs_years"]) else 0,
            "mm": round(mmv, 1) if math.isfinite(mmv) else None,
            "route": rt,
        }
        if e:
            rec["pct"] = [fnum(e.get(k), 6) for k in ("pct_mcc_p10", "pct_mcc_p50", "pct_mcc_p90", "pct_mcc_p99")]
            if e.get("coverage_gate_reason"):
                rec["reason"] = e["coverage_gate_reason"]
        cell.setdefault(r["fips"], {})[T] = rec

    # --- pricing.json ---
    pricing = {}
    for fips, c in dd.items():
        f5 = fips.zfill(5)
        pcc = pc.get(fips)
        if not pcc:
            continue
        per_t = {}
        for T in ["2", "4", "8", "12", "24"]:
            e = pcc.get(T)
            if not e or e.get("lambda_customer_mean") is None:
                continue
            lam = e["lambda_customer_mean"]
            entry = {"lam": round(lam, 6), "n": e.get("n_events_qualifying"), "gate": e.get("coverage_gate_status")}
            rb = rel.get((f5, T))
            if rb:
                entry["lo"], entry["hi"] = round(lam * rb[0], 6), round(lam * rb[1], 6)
            per_t[T] = entry
        if per_t:
            pricing[f5] = {"name": c["county"], "state": c["state"], "tier": c.get("tier"), "quotable": c.get("quotable"), "T": per_t}
    json.dump({"catalog": CATALOG, "estimator": "mean", "band": "year-based-80pct", "counties": pricing},
              open(OUT / "pricing.json", "w"), separators=(",", ":"))

    # --- studio.json ---
    studio = {}
    for _, r in reg.iterrows():
        f = r["fips"]
        studio[f] = {
            "regime": clean(r["regime"]), "sub": clean(r["sub"]),
            "stab4": (round(float(r["stab4"]), 2) if not pd.isna(r["stab4"]) else None),
            "labels_by_T": clean(r["labels_by_T"]), "xT": clean(r["xT"]),
            "tstat": (round(float(r["tstat"]), 2) if not pd.isna(r["tstat"]) else None),
            "conf": clean(r["conf"]),
            "n_obs": (int(r["n_obs"]) if pd.notna(r["n_obs"]) else None),
            "total": (int(r["total"]) if pd.notna(r["total"]) else None),
            "cv": rnum(r["cv"], 2),
            "peak_share": rnum(r["peak_share"], 2),
            "r_step": rnum(r["r_step"], 2),
            "years": yrs.get(f, []), "perT": ann.get(f, {}),
            "mult": mult.get(f, {}), "od": od.get(f, {}), "cell": cell.get(f, {}),
        }
    json.dump({"catalog": CATALOG, "counties": studio}, open(OUT / "studio.json", "w"), separators=(",", ":"))

    # --- regime-dist.json (national context) — recent-change split OUT of "insufficient" ---
    # "insufficient" overloads 3 subs; recent-change counties are data-rich (median ~183 events), not sparse.
    def reg_key(regime, sub):
        if regime == "insufficient":
            return "recent-change" if sub == "recent-change" else "insufficient"
        return regime

    dist: dict[str, int] = {}
    for _, r in reg.iterrows():
        k = reg_key(clean(r["regime"]), clean(r["sub"]))
        if k:
            dist[k] = dist.get(k, 0) + 1
    json.dump(dist, open(OUT / "regime-dist.json", "w"), separators=(",", ":"))

    # --- counties-by-state.json ---
    by = defaultdict(set)
    for c in pricing.values():
        if c.get("state") and c.get("name"):
            by[c["state"]].add(c["name"])
    cbs = {st: sorted(names) for st, names in sorted(by.items())}
    json.dump(cbs, open(OUT / "counties-by-state.json", "w"), separators=(",", ":"))

    print(f"built: pricing {len(pricing)} counties · studio {len(studio)} · {len(cbs)} states "
          f"({sum(len(v) for v in cbs.values())} counties)")


if __name__ == "__main__":
    main()
