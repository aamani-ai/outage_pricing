# Weather vs Statistical routing (Step 5)

Backtest comparison deciding, **per county**, whether Sarasi's EOF weather model (`_ve7_res`) or our
regime-routed statistical baseline governs the forward **frequency** factor.

- `weather_vs_stat_routing.py` — the **backtest** analysis (source of truth, percent format): scores
  weather vs routed-stat and emits the routing verdict.
- `forecast_comparison.py` — takes the verdict + Sarasi's actual forecast
  (`annual_event_count_forecast_ALL.parquet`) and builds the **dashboard artifact**: each NE county's
  weather factor (same one-directional/capped construction as the stat factor), forecast band, and route.
- `*.ipynb` — executed renders (jupytext) for sharing.
- `outputs/`
  - `wape_pooled.csv` — pooled WAPE per method (all 2023–25 + fair 2023-only slice).
  - `wape_by_regime.csv` — WAPE by regime (fair 2023 slice).
  - `routing_map.csv` — **the per-county verdict**: routed-stat vs weather WAPE, margin, years-won, and
    `route` (`weather` for the 16 durable winners; `statistical` otherwise).
  - `weather_factor.json` — **the shadow wiring artifact** (300 NE counties): per-county `route`, `why`,
    and per-trigger weather factor + forecast band + the stat factor it sits beside. Promoted by
    `web/scripts/build_data.py` → `web/lib/data/forward/weather_factor.json` → read by `web/lib/data/weather.ts`.
    SHADOW — shown in the Studio Forecast detail, does **not** price.

Run: `./.venv/bin/python3 notebooks/05_forward_regime/weather_vs_stat_routing/weather_vs_stat_routing.py`
(regenerates `outputs/`). Findings writeup: `docs/extra/sarasi_weather_outage_model/new_jun_30/findings_ve7_res.md`.

**Headline:** weather beats the naïve baselines but not our routed baseline pooled (−27%; −20% fair 2023);
routed-stat wins every regime; but **16 NE counties** (mostly `stable`) are durable weather winners → routed to weather.
Episodic (weather's best case) is untested — NE has no episodic counties.
