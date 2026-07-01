# Slack draft → Sarasi (weather `_ve7_res` findings)

*Draft for Divy to send. Attachments: the notebook (`weather_vs_stat_routing.ipynb`), the writeup
(`findings_ve7_res.md`), and `routing_map.csv`.*

---

Hi Sarasi — dug into the `_ve7_res` Northeast drop against our side. Full picture below, honest, with the notebook + writeup + routing map attached. **TL;DR: your EOF model clearly beats the naïve baselines, and there's a solid set of counties where it beats *our* forecaster too — those are the ones we'd hand to weather.**

**What we did.** Scored your XGB event-count predictions against **our regime-routed statistical forecaster** (not just flat/trend), on one shared observed target — our annual ≥T county counts match yours to r ≈ 0.997. NE-189 · triggers {4, 8, 12, 24}h · test years 2023–25 · trained ≤2022. We compared on **event counts (frequency)** — that's the only thing our pipeline forecasts (the per-customer step is a static conversion), so we didn't score the exposure output here.

**What your model is up against** — our candidate pool, routed per county behaviour regime:
`flat · recent-k3/k5 · wtd_recent · linear · capped_lin · theil_sen · persist · changepoint` → routed (stable→wtd_recent, trend/shift→persist). That **routed baseline** is the thing to beat, not the flat mean.

**Overall (WAPE, lower = better):**
• routed-stat **0.152** · your XGB **0.194** · flat 0.198  → fair 2023-only slice: routed **0.121** · XGB **0.145**
• So XGB beats flat/trend (matches your own read 👍) but sits ~20–27% behind our routed baseline pooled, and routed-stat wins in **every** regime bucket (trend/shift/stable/insufficient).

**Where your model wins — and we'd use it:** county-by-county, XGB beats routed-stat in **71 / 189**; gating for robustness (wins all 3 test years, ≥5% margin) gives a solid **16-county durable set** — Saratoga/Chenango/Rensselaer/Seneca/Rockland NY, St. Mary's MD, Chittenden VT, Grafton/Sullivan NH, Union PA, Androscoggin/Waldo ME, Tioga NY, Hudson NJ, Kent RI (full list in the routing map). Interesting tell: they're mostly **stable** counties — your model is smoothing the steady ones better than our recency experts.

**How we'd wire it:** our Forecast factor decomposes into `statistical × climate/weather × grid`. For those 16 we'd let **weather govern** (weather ≠ 1, stat = 1); everywhere else stat governs (stat ≠ 1, weather = 1); grid = 1 for now. We're moving that routing to **county-level, not cluster** — precisely because no *cluster* shows a clean weather win, but this durable county subset does.

**Honest caveats:** counts only (not exposure) · 3 test years · NE only · and the big one — **episodic counties (rare storm-spike) are exactly where your model should win most, and NE has zero of them** (they're interior-West), so this comparison structurally can't test your strongest suit.

**Three asks:**
1. Sanity-check we scored you fairly — shared observed = annual ≥T county event counts; is that your target?
2. Could you run an **episodic-region set** (interior West — KS/WY/UT/ND/MT)? That's the untested case where weather should shine.
3. When ready: current-year forecasts for the 16 winners (in a form we can turn into a factor = forecast ÷ long-run mean) so we can wire them.

Happy to walk through the notebook whenever.
