# %% [markdown]
# # Weather forecast vs statistical forecast — comparison + the wiring artifact
#
# Sarasi's actual forecast (`annual_event_count_forecast_ALL.parquet`, 300 NE counties, XGB, with
# p5/p90/p95 bands) vs our statistical forward factor. Builds the per-county comparison and emits
# `outputs/weather_factor.json` — the artifact the dashboard reads to show the weather forecast (and
# why it was / wasn't chosen) in the Forecast detail. Weather GOVERNS only the 16 durable winners.

# %%
import pandas as pd, numpy as np, json, pathlib
ROOT = pathlib.Path("/Users/divy/code/work/infrasure_git_codes/outage_pricing")
SA = ROOT / "docs/extra/sarasi_weather_outage_model/new_jun_30"
SR = ROOT / "notebooks/outputs/forward_regime/statistical_router"
HERE = ROOT / "notebooks/05_forward_regime/weather_vs_stat_routing"
OUT = HERE / "outputs"
T_DASH = [4, 8, 12, 24]  # dashboard triggers with weather coverage (no 2h in the weather file)

# %% [markdown]
# ## Load: weather forecast · our statistical factor (λ_full, stat forecast, cred) · the routing verdict
# %%
wf = pd.read_parquet(SA / "annual_event_count_forecast_ALL.parquet")
wf["fips_code"] = wf["fips_code"].astype(str).str.zfill(5)
wf = wf[(wf.model == "XGB") & (wf.threshold_h.isin(T_DASH))]  # XGB is primary; keep overlapping triggers
assert wf.groupby(["fips_code", "threshold_h"]).size().max() == 1, "expected one row per (county, trigger)"
fwd = json.loads((SR / "forward_factor.json").read_text())  # {fips: {regime, expert, conf, T:{f,lam_full,fc,cred,raw}}}
route = pd.read_csv(OUT / "routing_map.csv"); route["fips"] = route["fips"].astype(str).str.zfill(5)
winners = set(route[route.route == "weather"].fips)
verdict = route.set_index("fips")[["routed_wape", "xgb_wape", "margin", "years_won"]].to_dict("index")
print(f"weather forecast: {wf.fips_code.nunique()} counties · durable winners (weather governs): {len(winners)}")

# %% [markdown]
# ## Build the weather factor the SAME way as the stat factor (one-directional, credibility-shrunk, capped [1.0,1.5])
# so it composes identically — then decide the route per county via the `cluster` column + the backtest verdict.
# %%
def weather_factor(weather_mean, lam_full, cred):
    if not lam_full or lam_full <= 0 or not np.isfinite(weather_mean):
        return None
    raw = max(1.0, weather_mean / lam_full)          # one-directional (uplift or hold), like A020
    return float(np.clip(1 + (raw - 1) * cred, 1.0, 1.5))

art = {}
rows = []
for fips, g in wf.groupby("fips_code"):
    cluster = g["cluster"].iloc[0]
    name = f'{g["county_name"].iloc[0]}, {g["state"].iloc[0]}'
    f_ent = fwd.get(fips)
    # decide route
    if cluster != "NE_good":
        rte, why = "excluded", "chronic-grid cluster — excluded by the weather model (not weather-driven)"
    elif fips in winners:
        v = verdict.get(fips, {})
        rte = "weather"; why = f"weather beats the statistical baseline on the 2023–25 backtest (WAPE {v.get('xgb_wape',float('nan')):.3f} vs {v.get('routed_wape',float('nan')):.3f}; wins all {int(v.get('years_won',0))} years)"
    else:
        v = verdict.get(fips, {})
        rte = "statistical"; why = (f"statistical baseline wins the backtest (WAPE {v.get('routed_wape',float('nan')):.3f} vs {v.get('xgb_wape',float('nan')):.3f})" if v else "not a durable weather winner on the backtest")
    perT = {}
    for _, r in g.iterrows():
        T = int(r.threshold_h)
        st = (f_ent or {}).get("T", {}).get(str(T), {})
        lam_full, cred = st.get("lam_full"), st.get("cred", 1.0)
        wfac = weather_factor(r.event_count_mean, lam_full, cred)
        perT[str(T)] = {
            "weather_factor": wfac,
            "weather_mean": round(float(r.event_count_mean), 2),
            "weather_p5": round(float(r.event_count_p5), 2), "weather_p95": round(float(r.event_count_p95), 2),
            "stat_factor": st.get("f"), "lam_full": lam_full,
        }
        if T == 8 and lam_full:
            rows.append({"fips": fips, "name": name, "cluster": cluster, "route": rte, "lam_full": round(lam_full,1),
                         "stat_fc": round(st.get("fc",np.nan),1), "weather_mean": round(float(r.event_count_mean),1),
                         "stat_factor": st.get("f"), "weather_factor": wfac})
    art[fips] = {"cluster": cluster, "county_name": g["county_name"].iloc[0], "state": g["state"].iloc[0], "route": rte, "why": why, "T": perT}

(OUT / "weather_factor.json").write_text(json.dumps(art, indent=1))
print(f"wrote weather_factor.json — {len(art)} NE counties")

# %% [markdown]
# ## Sanity check — the 16 winners (T=8h): weather vs stat factor, and the forecast vs λ_full
# %%
comp = pd.DataFrame(rows)
print("\n=== 16 DURABLE WINNERS (T=8h) — weather governs ===")
print(comp[comp.route == "weather"][["name","lam_full","stat_fc","weather_mean","stat_factor","weather_factor"]].to_string(index=False))
print("\n=== route distribution (per county) ===")
print(comp.groupby(["cluster","route"]).size().to_string())
print("\n=== factor summary (T=8h) ===")
print("weather_factor: min", round(comp.weather_factor.min(),3), "median", round(comp.weather_factor.median(),3), "max", round(comp.weather_factor.max(),3))
print("winners' weather_factor vs stat_factor (mean):", round(comp[comp.route=='weather'].weather_factor.mean(),3), "vs", round(comp[comp.route=='weather'].stat_factor.mean(),3))
