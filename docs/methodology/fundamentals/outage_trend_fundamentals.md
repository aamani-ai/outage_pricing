# Outage Trend (Descriptive Layer) — Fundamentals

*Audience: senior team. Last reviewed: 2026-06-03. Reads naturally after [`event_catalog_fundamentals.md`](event_catalog_fundamentals.md).*

## What the outage trend is, in one paragraph

For each county, we compute the **yearly count of qualifying outage events** across the 11-year window (2015–2025) and fit a **linear regression** to that series. The slope tells us whether the county's event rate appears to be **rising, falling, or holding steady**. The dashboard surfaces this two ways — as a **map color mode** (counties colored red / gray / blue by trend class) and as a **sparkline in the per-county detail panel**. **It is a descriptive view, not a pricing input.** Pricing in v0 still runs against the full 11-year empirical baseline; the trend exists to be the **upstream data foundation** for the future forward-regime modifiers (grid_condition, hazard, weather) — and to give a reviewer a quick visual read on whether a county is drifting.

## What a row looks like

One row per `(fips, T)` at each of the five duration thresholds (T = 2, 4, 8, 12, 24 hours):

| fips  | T | years              | yearly_counts                    | slope | sigma | t_stat | class      |
|-------|---|--------------------|----------------------------------|-------|-------|--------|------------|
| 12001 | 4 | [2015, ..., 2025]  | [28, 31, 26, 34, 41, 39, 47, 33, 36, 44, 51] | +1.84 | 0.62  | 2.97   | worsening  |
| 24001 | 4 | [2015, ..., 2025]  | [12, 15, 11, 13, 14, 12, 16, 13, 11, 14, 13] | +0.07 | 0.20  | 0.35   | stable     |
| 06037 | 4 | [2015, ..., 2025]  | [82, 79, 75, 80, 72, 68, 65, 71, 64, 60, 58] | -2.10 | 0.45  | -4.67  | improving  |

Field definitions:

- **years** — the 11 calendar years 2015 through 2025.
- **yearly_counts** — count of events with `duration_hours ≥ T` in each year for that county.
- **slope** — linear-regression slope of `yearly_counts` against `years`, in *events per year, per year*. Positive = worsening, negative = improving.
- **sigma** — standard error of the slope (estimated from regression residuals).
- **t_stat** — `slope / sigma`. A one-sided significance score against the null hypothesis of zero slope.
- **class** — `worsening` if `t_stat > 1.5`, `improving` if `t_stat < -1.5`, `stable` if within the band, `insufficient_data` if `< 10` events total in the window.

## How to read the visualization (ASCII)

A county's panel-E sparkline plots `yearly_counts` against years, with the regression line and ±1σ band overlaid:

```
  events/yr
   50 ┤                       •
   40 ┤            •     •           •
   30 ┤    •  • • |  •           •
   20 ┤  •    .  /                            ← regression line
   10 ┤     . /                                   (dashed, colored by class)
    0 └─────────────────────────────────────
       '15 '16 '17 '18 '19 '20 '21 '22 '23 '24 '25
                 ←── ±1σ band ──→

       ↗ Worsening · slope +1.84 events/yr/yr (±0.62, t=2.97)
       last-5 vs first-5 avg: +32%
```

The map view applies the same class as a county fill color (red = worsening, gray = stable, blue = improving, very-light gray = insufficient data).

## Why 2014 is excluded

EAGLE-I coverage begins **2014-11-01** — only the last two months of calendar 2014 are observable. If we included 2014 in the regression, every county's slope would be biased upward purely because 2014's event count is artificially low (partial year). That's a **measurement artifact**, not a real trend. Excluding 2014 gives us 11 full calendar years (2015–2025) with consistent observation windows.

## Why we use a slope, not a year-over-year diff

A single hurricane year (e.g., Ian in FL 2022, Helene in NC 2024) can swamp any year-over-year comparison. The **least-squares slope** uses the full 11-year history, so a single big year affects the slope less and the standard error more. The `±1σ` band on the sparkline makes the noise envelope visible to the reader.

## Classification thresholds

| Gate | Rule | Roughly equivalent to |
|---|---|---|
| `worsening` | `t_stat > 1.5` | one-sided 87% confidence slope > 0 |
| `improving` | `t_stat < -1.5` | one-sided 87% confidence slope < 0 |
| `stable` | within the band | slope indistinguishable from zero |
| `insufficient_data` | `< 10` events in 11-year window | not enough signal to fit |

`t_stat = 1.5` is the operational gate. It's strict enough to reject most year-to-year noise but loose enough to surface real signal in an 11-year window. With more years of data we'd raise it.

## Caveats — what to know before reading this

**The most important caveat first**:

1. **EAGLE-I coverage has improved over the window.** The dataset's own descriptor reports utility coverage reaching ~92% by 2022 — earlier years had fewer reporting utilities. So *some* of the apparent "worsening" signal across counties is **mechanical**: more outages are detected today simply because more utilities are scraped. This is the single largest known confound on the trend signal. A backtest or a partial-pull cross-check (counties served by utilities present in EAGLE-I from day one) is needed to separate the coverage drift from real grid trends.

Then:

2. **11 years is short for structural-trend detection.** A single bad year can pull the slope visibly. The `t_stat` gate at 1.5 is the noise-floor protection but it's not bulletproof.
3. **No cause attribution.** The trend is cause-agnostic. We cannot say from EAGLE-I alone whether a county's worsening trend is climate-driven (more storms), grid-driven (aging infrastructure), reporting-driven (more utilities feeding in), or policy-driven (more PSPS events).
4. **The same T sensitivity inherits.** The trend is computed per (fips, T). Counties may have a worsening trend at T=2h but a stable trend at T=24h, or vice versa — short and long outages have different drivers.
5. **It is descriptive, not prescriptive.** A "worsening" classification does NOT mean the county should be repriced upward. v0 pricing remains the full 11-year empirical baseline; the trend is informational evidence for *future* modifier work, not a pricing input.
6. **MCC and per-customer caveats inherit.** The trend uses raw event counts, not per-customer counts, so the MCC-vintage and "customer unit varies by utility" caveats from EAGLE-I propagate forward into any future modifier built on top of the trend.

## Why this matters anyway

Three concrete reasons we surface it even with the coverage-drift caveat:

1. **Forward-regime data foundation.** The grid_condition, hazard, and weather modifiers all need to ask "how is this county changing?" — the trend is the single computed signal that feeds all three. Building it once is cheaper than building it three times inside each modifier.
2. **Reviewer triage.** "Is this county getting worse?" is one of the first questions a domain expert asks when looking at any individual county. Surfacing the slope answers it in one visual.
3. **Conversation starter for partner utilities.** When discussing pilots or capacity with a specific utility, the per-county trend in their territory is a useful starting visual — even if it's descriptive only.

## How the dashboard uses it

- **Map color mode "Outage trend · 11yr · T=4h":** counties colored by trend class at T=4h. Diverging palette (red / gray / blue / very-light gray for insufficient).
- **Detail panel E:** sparkline + slope number + ±1σ band + last-5-vs-first-5 % change + descriptive caveat block + link back to this doc.
- **No pricing surface.** The trend does not flow into λ, multiplier, retail premium, or any priced quantity in v0.

## One-line takeaways

- **The trend is a regression on yearly event counts — descriptive only, not a pricing input.**
- **Worsening / stable / improving / insufficient-data classes are gated by `t_stat > 1.5` against the noise floor.**
- **Some upward signal across counties may reflect EAGLE-I coverage drift, not real grid degradation — read with care.**
- **It is the upstream signal for future grid_condition / hazard / weather modifiers; those activate only after backtest evidence, not because the trend exists.**

## References

- Pipeline: `curated_outage_data/pipelines/county_trend/compute_yearly_trend.py`
- Schema: [`curated_outage_data/schemas/county_yearly_trend.md`](../../../curated_outage_data/schemas/county_yearly_trend.md)
- Output: `price_engine/catalogs/<catalog_id>/pricing/county_yearly_trend.json` (dashboard mirror)
- EAGLE-I source paper (coverage statistics): [Brelsford et al., Nature Scientific Data 2024](https://www.nature.com/articles/s41597-024-03095-5)
- Forward-regime roadmap entry: [`roadmap.md`](../roadmap.md#outage-trend--shipped-2026-06-03--descriptive)
- Forward modifier plan: [`docs/plan/forward_looking_modeling_plan.md`](../../plan/forward_looking_modeling_plan.md)
- Upstream: [`event_catalog_fundamentals.md`](event_catalog_fundamentals.md)
- Inherited assumption registry: [`assumptions.md`](../assumptions.md)
