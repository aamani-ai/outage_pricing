# %% [markdown]
# # Weather (Sarasi EOF-XGB, `_ve7_res`) vs our routed statistical baseline
#
# Backtest comparison that decides, per county, whether the weather model should govern the
# forward frequency factor instead of our statistical router. Scored on ONE shared observed target.
#
# - **Scope:** Northeast 189 counties (Sarasi's set, excludes the "stably bad grid" cluster)
# - **Cells:** trigger T in {4, 8, 12, 24}h (overlap of both pipelines) x test years 2023-25
# - **Target:** annual event COUNT (frequency) — the only thing we forecast; per-customer is a static conversion
# - **Metric:** WAPE (weighted absolute % error), lower = better
# - **Fair slice:** 2023-only (both sides train <=2022; ours is rolling-origin, hers fixed 2015-22 train)
#
# Emits `outputs/`: `wape_by_regime.csv`, `wape_pooled.csv`, `routing_map.csv` (the per-county verdict).

# %%
import pandas as pd, numpy as np, pathlib, json
ROOT = pathlib.Path("/Users/divy/code/work/infrasure_git_codes/outage_pricing")
SR = ROOT / "notebooks/outputs/forward_regime/statistical_router"
SA = ROOT / "docs/extra/sarasi_weather_outage_model"
OUT = ROOT / "notebooks/05_forward_regime/weather_vs_stat_routing/outputs"; OUT.mkdir(parents=True, exist_ok=True)
T_OVL, YEARS = [4, 8, 12, 24], [2023, 2024, 2025]

# %% [markdown]
# ## Load: our per-expert predictions, the routed choice, Sarasi's weather preds, regime + names
# %%
pl = pd.read_parquet(SR / "predictions_long.parquet", columns=["fips", "T", "year", "regime", "expert", "obs", "pred"])
pl["fips"] = pl["fips"].astype(str).str.zfill(5)
best = pd.read_csv(SR / "best_expert_by_regime.csv").set_index("regime")["best_expert"].to_dict()
cy = pd.read_parquet(SA / "new_jun_30/county_year_counts_test.parquet"); cy["fips_code"] = cy["fips_code"].astype(str).str.zfill(5)
NE189 = sorted(cy["fips_code"].unique())
w = pd.concat([cy[["fips_code", "year", f"pred_eventcount_XGB_>={T}h", f"pred_eventcount_GLM_>={T}h"]]
               .rename(columns={"fips_code": "fips", f"pred_eventcount_XGB_>={T}h": "xgb", f"pred_eventcount_GLM_>={T}h": "glm"}).assign(T=T) for T in T_OVL])
names = {k: f"{v.get('name','?')}, {v.get('state','')}" for k, v in json.loads((ROOT / "web/lib/data/pricing.json").read_text()).get("counties", {}).items()}

# %% [markdown]
# ## Build the shared-observed comparison frame (routed-stat + flat + linear + weather-XGB)
# %%
base = pl[pl.fips.isin(NE189) & pl["T"].isin(T_OVL) & pl.year.isin(YEARS)].copy()
obs = base.drop_duplicates(["fips", "T", "year"])[["fips", "T", "year", "obs", "regime"]]
flat = base[base.expert == "flat"][["fips", "T", "year", "pred"]].rename(columns={"pred": "flat"})
lin = base[base.expert == "linear"][["fips", "T", "year", "pred"]].rename(columns={"pred": "linear"})
base["best"] = base["regime"].map(best)
routed = base[base.expert == base["best"]][["fips", "T", "year", "pred"]].rename(columns={"pred": "routed_stat"})
df = obs.merge(routed, on=["fips","T","year"]).merge(flat, on=["fips","T","year"]).merge(lin, on=["fips","T","year"]).merge(w, on=["fips","T","year"])
METHODS = ["flat", "linear", "routed_stat", "xgb", "glm"]
for m in METHODS: df[m + "_ae"] = (df[m] - df["obs"]).abs()
print("frame:", df.shape, "· fips:", df.fips.nunique(), "· routed experts:", best)

def wape(g, m):
    s = g["obs"].sum(); return np.nan if s <= 0 else g[m + "_ae"].sum() / s

# %% [markdown]
# ## Overall results (pooled, and the fair 2023-only slice)
# %%
pooled = pd.DataFrame({"all_2023_25": {m: wape(df, m) for m in METHODS},
                       "fair_2023_only": {m: wape(df[df.year == 2023], m) for m in METHODS}}).round(4)
pooled.to_csv(OUT / "wape_pooled.csv")
print("POOLED WAPE:\n", pooled.to_string())
print("xgb vs routed_stat: all", f"{(pooled.loc['routed_stat','all_2023_25']-pooled.loc['xgb','all_2023_25'])/pooled.loc['routed_stat','all_2023_25']:+.1%}",
      "| 2023-only", f"{(pooled.loc['routed_stat','fair_2023_only']-pooled.loc['xgb','fair_2023_only'])/pooled.loc['routed_stat','fair_2023_only']:+.1%}")

# %% [markdown]
# ## By regime (2023-only, the fair slice)
# %%
d23 = df[df.year == 2023]
g1 = pd.DataFrame({m: d23.groupby("regime")[m + "_ae"].sum() / d23.groupby("regime")["obs"].sum() for m in METHODS})
g1["margin_xgb_vs_routed"] = (g1.routed_stat - g1.xgb) / g1.routed_stat
g1["n_counties"] = d23.groupby("regime")["fips"].nunique()
g1.round(3).to_csv(OUT / "wape_by_regime.csv"); print("\nBY REGIME (2023-only):\n", g1.round(3).to_string())

# %% [markdown]
# ## Per-county verdict + the durable-winner routing map
# durable = weather beats routed-stat in ALL 3 test years AND by >=5% pooled margin (not 3-year noise)
# %%
per = df.groupby(["fips", "regime"]).apply(lambda g: pd.Series({
    "routed_wape": wape(g, "routed_stat"), "xgb_wape": wape(g, "xgb"), "obs": g.obs.sum(),
    "cells_won": int((g.xgb_ae.reset_index(drop=True) < g.routed_stat_ae.reset_index(drop=True)).sum()),
}), include_groups=False).reset_index()
yrs = df.groupby(["fips", "year"]).apply(lambda g: wape(g, "routed_stat") > wape(g, "xgb"), include_groups=False)
per["years_won"] = per.fips.map(yrs.groupby("fips").sum().astype(int))
per["margin"] = (per.routed_wape - per.xgb_wape) / per.routed_wape
per["name"] = per.fips.map(names).fillna(per.fips)
per["xgb_wins_pooled"] = per.margin > 0
per["durable_weather_winner"] = (per.years_won == 3) & (per.margin >= 0.05)
per["route"] = np.where(per.durable_weather_winner, "weather", "statistical")
per = per.sort_values("margin", ascending=False)
per[["fips","name","regime","obs","routed_wape","xgb_wape","margin","years_won","cells_won","route"]].to_csv(OUT / "routing_map.csv", index=False)

n = len(per)
print(f"\nPER-COUNTY (of {n}):")
print(f"  weather beats routed-stat pooled:      {per.xgb_wins_pooled.sum()}  ({per.xgb_wins_pooled.mean():.0%})")
print(f"  ... by >=10% pooled margin:            {(per.margin>=0.10).sum()}")
print(f"  DURABLE (all 3 yrs + >=5% margin):     {per.durable_weather_winner.sum()}   <- the routing map's weather set")
print("\nDURABLE WEATHER WINNERS (→ route to weather):")
print(per[per.durable_weather_winner][["name","regime","obs","routed_wape","xgb_wape","margin","years_won"]].to_string(index=False, float_format=lambda x:f"{x:.3f}"))
print("\nrouting map + tables written to", OUT)
