# Outage Trend — Validation Plan

**Owner:** modeling
**Status:** open · tracked future work (not blocking v0 pricing)
**First written:** 2026-06-03

> **Update (2026-06-22).** The central confound this plan names — **EAGLE-I coverage drift biasing
> slopes upward** — is now handled upstream by the **source-coverage mask** (the asymmetric onset
> mask; coverage-RAMP finding): [`../../dicsscssion/eventization_frequency_contract/05_source_coverage_mask.md`](../../dicsscssion/eventization_frequency_contract/05_source_coverage_mask.md).
> So "validate the trend class" is reframed: the slope is now a **regime feature** run on the masked
> series, and validation happens via the **group-level holdout backtest**, not per-class confound
> review — [`../../OUTAGE_MODELING_FRAMEWORK.md`](../../OUTAGE_MODELING_FRAMEWORK.md) Step 3 ▸ *Reframe*.

## Why this plan exists

The [outage trend](../../methodology/03_risk_clustering/outage_trend_fundamentals.md) layer is shipped as **descriptive only**. It is not a pricing input. But before it can graduate into the forward-regime modifier track (grid_condition / hazard / weather), the signal needs to be **validated against its known confounds**.

The single largest confound is **EAGLE-I coverage drift**: utility coverage in the dataset has grown over the 11-year window (~92% of customers by 2022 vs lower in earlier years). That mechanical growth adds detected events over time and **biases every county's slope upward**.

The trend map on the live dashboard now shows most of the CONUS as "worsening" at T=4h. We **cannot conclude grids are degrading** until this confound is separated from real signal. This plan lays out the explicit work to do that separation, with tracking gates.

## The asymmetric-confound principle

The validation work is organized around a key insight:

> **Coverage drift can only ADD events over time. It cannot create an improving (blue) classification.**

So the validation plan treats the two classes asymmetrically:

| Class | Validation question | Difficulty |
|---|---|---|
| **Improving (blue)** | "Is this real, or noise?" | Easier — coverage drift cannot mask the answer |
| **Stable (gray)** | "Is the noise band actually masking real change?" | Medium — needs sensitivity analysis at multiple T |
| **Worsening (red)** | **"How much is real climate/grid vs coverage drift?"** | Hard — this is the main work |
| **Insufficient data** | n/a | Not a claim |

The hardest case is the most common one (red). That's where the bulk of the work below sits.

## Tracked validation tracks

### Track 1 — Coverage-stable subset analysis · **highest priority**

**Question:** *"If we restrict to counties served by utilities present in EAGLE-I from day one (2014–2015), how does the trend distribution change?"*

**Why:** A coverage-stable subset removes the coverage-drift confound by construction. If the worsening-share drops significantly in this subset vs the full population, coverage drift is a major part of the apparent signal. If the share stays high, the trend is more likely real.

**Method:**
1. Build a utility-by-year coverage table from EAGLE-I metadata or by inferring from utility-level outage records per year.
2. Identify the set of utilities present in EAGLE-I in 2015 (the start of our trend window) AND still present in 2025.
3. For each county, compute the fraction of its MCC served by Day-1 utilities. Mark counties where this fraction is ≥ 0.95 as "coverage-stable."
4. Recompute the trend classification on the coverage-stable subset.
5. Compare class distributions (worsening / stable / improving / insufficient) between full and subset.

**Gate / decision rule:**
- If coverage-stable worsening share is **within ±5 percentage points** of full-population worsening share → the trend signal is mostly real.
- If coverage-stable worsening share is **>10 percentage points lower** → coverage drift is a dominant driver and the trend should not be used as a forward-regime input without correction.

**Status:** not started.

**Effort estimate:** 1–2 days of analysis + a notebook in `notebooks/outputs/trend_validation/`.

---

### Track 2 — NOAA Storm Events overlay

**Question:** *"Does the county-by-county trend slope correlate with the trend in NOAA Storm Events counts in the same county over the same window?"*

**Why:** If a county's outage-event-count trend correlates strongly with its storm-event-count trend, that's evidence the worsening is climate-driven (real). If there's no correlation, the worsening is either coverage drift OR non-storm grid degradation.

**Method:**
1. Pull NOAA Storm Events Database (CSV bulk) for 2015–2025.
2. Aggregate to county-year storm-event counts (filtering to outage-causing event types: thunderstorm wind, hurricane, tornado, ice storm, winter storm, heat, etc.).
3. Compute the same linear-regression slope on storm-event counts per (fips, year).
4. Scatter-plot outage-trend slope vs storm-trend slope across all counties. Compute correlation.

**Expected outcomes:**
- Strong positive correlation → climate is a real driver of the apparent worsening.
- Weak / no correlation → worsening is mostly NOT climate (could be grid stress, coverage drift, or unknown).

**Status:** not started.

**Effort estimate:** 2–3 days of analysis + a small overlay notebook + crosswalk table.

**Depends on:** NOAA Storm Events ingestion (planned in `forward_looking_modeling_plan.md`).

---

### Track 3 — Utility-level disaggregation

**Question:** *"Within a county served by multiple utilities, does the trend differ by utility?"*

**Why:** If County X is worsening overall but Utility A inside X is stable while Utility B is steeply worsening, that disaggregates the signal usefully — and lets us start asking why Utility B specifically is worsening (grid condition? service-territory growth? coverage entry/exit?).

**Method:**
1. Requires per-utility event records, which EAGLE-I does NOT publish — it only aggregates to county.
2. The PowerOutage.US live feed has `UtilityId` per outage. Building this analysis requires either a PoUS subscription + multi-month polling archive OR a per-utility extract from PoUS (currently not delivered for us).
3. Defer until either of those becomes available.

**Status:** blocked on PoUS subscription / per-utility extract.

---

### Track 4 — Cross-T consistency

**Question:** *"Do counties classified as worsening at T=4h also show worsening at T=2h, T=8h, T=12h, T=24h?"*

**Why:** A county whose trend signal is real should show up consistently across multiple thresholds (with monotone-ish effect sizes). A county whose trend shows up only at T=2h but flips to stable at T=24h is more likely a noise / coverage-drift artifact (lots of small short events were missed earlier; bigger longer events are harder to miss).

**Method:**
1. The trend pipeline already computes per (fips, T) at five T values.
2. For each county, compute a cross-T consistency score: fraction of T values where trend_class == "worsening."
3. Map this consistency score. Counties with high consistency (4+/5) are more credibly real-worsening. Counties consistent only at small T are more likely coverage-drift artifacts.

**Status:** not started — but **easy to ship** since data is already in the parquet.

**Effort estimate:** half-day notebook + small dashboard surface change to overlay the consistency score.

---

### Track 5 — PowerOutage.US per-outage cross-check · **deferred**

**Question:** *"Does the per-outage record from PoUS show the same yearly-count trend as our EAGLE-I aggregate?"*

**Why:** PoUS scrapes from a similar utility-map population but stores per-outage records (OutageId, geometry, customer count, timestamps) — a structurally different aggregate. If both sources show similar trends for overlapping counties, the trend is more likely real. If they diverge, at least one is biased.

**Method:**
1. Requires the per-outage PoUS historical extract (currently only have city × utility × hourly aggregate; no OutageId).
2. The vendor request for that extract is documented in [docs/extra/poweroutage_us/docs/05_historical_dataset_inventory.md](../../extra/poweroutage_us/docs/05_historical_dataset_inventory.md).
3. Even with the aggregate we have, we can do a partial check on MA/CT/RI/VT for Jan–Mar 2019 (the trial window).

**Status:** partial — possible on the small 2019 sample; full check blocked on vendor data extract.

---

## Tracking matrix

| Track | Priority | Status | Blocking on | Effort |
|---|---|---|---|---|
| 1 · Coverage-stable subset | 🔴 highest | not started | — | 1–2 days |
| 2 · NOAA storm overlay | 🟡 high | not started | NOAA ingestion | 2–3 days |
| 4 · Cross-T consistency | 🟡 high | not started | — | half-day |
| 3 · Utility disaggregation | 🟢 medium | blocked | PoUS subscription | — |
| 5 · PoUS cross-check | 🟢 medium | partial possible | vendor extract | — |

## Activation gate for the trend as a pricing input

The trend will NOT enter v0 pricing. It will only graduate to a pricing input under the forward-regime modifier framework when:

1. **Track 1 (coverage-stable subset)** has been completed and the result documented.
2. **Track 4 (cross-T consistency)** has been completed and counties with strong cross-T consistency are identified.
3. At least one of **Track 2 (NOAA)** or **Track 5 (PoUS cross-check)** corroborates the signal.
4. A model card is written for the resulting modifier with backtest evidence.
5. The dashboard's modifier-activation control switches the modifier on, only for counties that pass the validation gates.

This is the same activation discipline as other modifiers — see [`outage_baseline_adjustment_framework.md`](../cross_cutting/outage_baseline_adjustment_framework.md).

## Communication discipline (until then)

Until the validation tracks above land:

- **Internal:** describe the trend as descriptive only, with the asymmetric-confound caveat ("blue is reliable, red is ambiguous").
- **External (client / LP / partner conversations):** **lead with the methodology framing** — *"this is a descriptive layer, not a pricing input. We deliberately do not let it touch the rate until we've separated coverage drift from real signal."* Never let a partner see the trend map without that framing first.
- **In-app dashboard:** the existing panel-E disclaimer + map-legend "Descriptive only · not a pricing input" footnote is the minimum required surfacing. Keep both visible.

## Cross-references

- Methodology: [`docs/methodology/fundamentals/outage_trend_fundamentals.md`](../../methodology/03_risk_clustering/outage_trend_fundamentals.md)
- Schema: [`curated_outage_data/schemas/county_yearly_trend.md`](../../../curated_outage_data/schemas/county_yearly_trend.md)
- Roadmap: [`docs/methodology/roadmap.md`](../../methodology/roadmap.md) — the forward-regime section
- Forward modifier plan: [`docs/plan/forward_looking_modeling_plan.md`](../05_forward_regime/forward_looking_modeling_plan.md)
- Activation framework: [`docs/plan/outage_baseline_adjustment_framework.md`](../cross_cutting/outage_baseline_adjustment_framework.md)
