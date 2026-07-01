# Slack draft → Sarasi (weather `_ve7_res` findings)

*Draft for Divy to send.*

---

Hi Sarasi — dug into the `_ve7_res` Northeast drop. Notebook, writeup, and the per-county routing map are on GitHub:
• Notebook: https://github.com/aamani-ai/outage_pricing/blob/deploy/outage-pricing/notebooks/05_forward_regime/weather_vs_stat_routing/weather_vs_stat_routing.ipynb
• Findings: https://github.com/aamani-ai/outage_pricing/blob/deploy/outage-pricing/docs/extra/sarasi_weather_outage_model/new_jun_30/findings_ve7_res.md
• Routing map (the verdict): https://github.com/aamani-ai/outage_pricing/blob/deploy/outage-pricing/notebooks/05_forward_regime/weather_vs_stat_routing/outputs/routing_map.csv

**What was tested.** The EOF-XGB event-count predictions, scored against the regime-routed statistical baseline (not just flat/trend), on a shared observed target — the annual ≥T county counts line up to r ≈ 0.997. NE-189 · triggers {4, 8, 12, 24}h · test years 2023–25 (trained ≤2022). Comparison is on event **counts** (frequency); the exposure output wasn't scored here.

**Results (WAPE, lower = better):** routed-stat **0.152** · EOF-XGB **0.194** · flat 0.198 — fair 2023-only slice: **0.121 vs 0.145**. So EOF-XGB clearly beats the naïve baselines, but sits ~20–27% behind the routed statistical baseline pooled, which wins in every regime bucket.

**Where the weather model wins:** county-by-county it beats routed-stat in **71 / 189**; gated for robustness (wins all 3 test years, ≥5% margin) that's a solid **16-county durable set** — Saratoga/Chenango/Rensselaer/Seneca/Rockland NY, St. Mary's MD, Chittenden VT, Grafton/Sullivan NH, Union PA, Androscoggin/Waldo ME, Tioga NY, Hudson NJ, Kent RI. Mostly **stable** counties — the weather model smooths the steady ones better than the recency experts. Those 16 would be routed to the weather factor; everywhere else stays statistical.

**Worth flagging:** counts-only, NE-only — and NE has **zero episodic (rare storm-spike) counties**, which is exactly where a weather model should win most. So this can't test its strongest suit.

A few things that would help:
1. Does the scoring look fair — shared observed = annual ≥T county event counts, is that the right target?
2. Any chance of a run over an **episodic region** (interior West — KS/WY/UT/ND/MT)? That's the untested case.
3. Eventually, current-year forecasts for those 16 counties (as forecast ÷ long-run mean) to wire them in.

Happy to walk through the notebook anytime.
