<!-- Generated from a grounded survey of our notebooks/MD (workflow studio-section-spec, 2026-06-23).
     The spec to LOCK before building the Underwriting Studio redesign. -->

# InfraSure Outage Pricing — Underwriting Studio Section Spec

## 1. Framing & Information Architecture

The Underwriting Studio is a **single workspace** that turns one address-level quote into a defensible, deep-divable underwriting object. The home tab (**Price Breakdown**) headlines exactly one annual premium as a point plus a quiet confidence band; the three deep-dive tabs unpack *why* that number is what it is, *how confident* we are, and *what moves a county off baseline*. A persistent context bar pins the deal (address · trigger · payout · premium + band) across every tab so the underwriter never loses the anchor. Each tab carries its own honesty question and shows data maturity honestly — `real` factors price; `partial` factors are shadow reads; `framed` factors are placeholders that say so. Global loadings (ER/TM) and the data source live in **Settings**, not the Studio.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  CONTEXT BAR (pinned, all tabs)                                                │
│  📍 123 Main St, Alachua Co. FL   ·   ⏱ T = 8h   ·   💵 payout $10,000          │
│  ──────────────────────────────────────────────────────────────────────────  │
│  PREMIUM  $X / yr   (likely $A – $B, 80%)        [ See the breakdown → ]        │
└──────────────────────────────────────────────────────────────────────────────┘
   │
   ▼  TABS
 ┌────────────────┬───────────┬────────────────────┬──────────────────────────┐
 │ PRICE BREAKDOWN│ BASELINE  │ COUNTY CLUSTERING  │ ADJUSTERS                 │
 │   (home)       │           │                    │                           │
 │ ONE number +   │ Is λ(T)   │ Stable / trend /   │ Location (within-county)  │
 │ band + plain   │ reliable  │ shift / episodic / │ + Forward (climate/grid)  │
 │ risk read +    │ enough to │ insufficient +     │ + per-county tuning.      │
 │ "how it pays"  │ quote?    │ predictability     │ (Global loadings + source │
 │ + Studio link  │ band/range│ confidence + cross-T│  → SETTINGS, not here.)  │
 └────────────────┴───────────┴────────────────────┴──────────────────────────┘
     real             real          real                 partial + framed
```

**Tab → survey-section mapping**

| Studio Tab | Survey section(s) it consolidates |
|---|---|
| Price Breakdown (home) | Price Breakdown Overview (Pricing Home) |
| Baseline | Baseline Frequency Uncertainty (λ(T)) |
| County Clustering | Step 3 — Risk Clustering (Regime Classification) |
| Adjusters | Step 4 — Within-county location adjustment **+** Step 5 — Forward Adjustment Factors |

---

## 2. Data-Maturity Map

| Tab | Section | Maturity | In production price? | One-line state |
|---|---|---|---|---|
| Price Breakdown | Pricing Home | **real** | **Yes** | `composePremium()` ships `{low, point, high, bandDriver}`; band precomputed (A017). |
| Baseline | λ(T) uncertainty | **real** | **Yes** | Per-customer λ is the live headline; band, gate, counts all computed; some plot inputs not yet *exposed* in `studio.json`. |
| County Clustering | Regime classification | **real** | Diagnostic / router (not a multiplier) | Labels, sub-flags, cross-T stability, t-stat already in `studio.json`; confidence-tier + peer fields not yet emitted. |
| Adjusters → Location | Within-county basis | **partial** | **No — shadow only** | Lives in `price_engine/dashboard/data/`, not `web/lib/data/`; rendered as a map mode, never wired into the quote. Validated CT/MA/RI only. |
| Adjusters → Forward | Forward regime | **framed / placeholder** | **No — no signal exists** | Plans + mature research, but **no code** in `build_data.py`, no field in any JSON. Placeholder factor = 1.0. |

```
maturity ladder (deepest → shallowest)
  real  ████████████████████  Price Breakdown · Baseline · County Clustering
  part. ██████████            Adjusters: Location  (shadow, CT/MA/RI only)
  fram. ███                   Adjusters: Forward   (placeholder, no signal)
```

---

## 3. Tab Specs

### 3.1 — Price Breakdown (Home) · `real`

**Underwriter decision.** *What does this address cost per year, and how sure are we?* Deliver ONE annual premium as point + band, contextualize confidence (year-based historical variability), and route every deeper factor (location, regime, forward) into the Studio. The quick read is the deliverable; the detail lives downstream behind one clean link.

**Plots / panels**

| Panel | Type | Source | What it shows |
|---|---|---|---|
| Annual Premium Headline | single value + band | `composePremium.premium = {low, point, high}`; `rateBand` precomputed (A017, year-based bootstrap on masked ≥T counts) | The one number: annual cost to insure this address at T-hour trigger, $X payout. Band width = confidence: tight where history is rich/steady, wide where thin/volatile. |
| Confidence Band (quiet qualifier) | range annotation | `composePremium.bandDriver` + `{low, high}`, labelled "likely $A–$B" | Year-to-year bounce in the observed rate (bootstrap 80% interval) carried linearly to premium. **Not** heterogeneity (customer median..max) — pure epistemic confidence in the county average. |
| Risk Read (one plain sentence) | text descriptor | derived from `composePremium.adjustedRate`: λ=1/years, annualized `(1−e^−λ)×100%` | "An 8h+ outage happens about once every 6 years here (~16% chance in any year)." Drives live with the trigger slider; no curve, no percentile. |
| "How This Pays" | text block | static (`02_outward_pricing_view.md`) recomputed from policy T, X | Pays on **duration at this address**, regardless of cause; pays full $X at the T-hour trigger (not sliding); a just-missed trigger does not pay. Pre-empts basis-risk disputes by stating the rule. |
| County + Provenance line | text descriptor | `county.name/state` + EAGLE-I year range from `annualization_meta.json` (A004) | "Priced from federal EAGLE-I power-outage records for {county}, {state}." Neutral, un-manipulable source; grounds why location/forward exist. |
| Comfort-by-Trigger Mini (collapsed) | mini bars | `studio.perT[T]` counts via `RiskDetailExpandBox` | Under an expandable "Risk detail": event counts per T binned to comfort tiers (green >150, amber 50–150, red <50). One glance at "how data-backed is this T." |
| Studio Link | nav affordance | static link to `/studio`, location pre-loaded from `useQuoteStore` | The single seam outward: "See the breakdown →" opens waterfall, regime, annual series, position-in-county. Factor detail never shows outwardly. |

**Reads (short).**
- The annual premium is the hero — one dominant 4xl number, recomputed live as the buyer drags trigger/payout. No spinner, no modal.
- The band is a *quiet qualifier* ("likely $A–$B"), with a one-time ⓘ in plain language — never a prominent uncertainty display.
- The band is **confidence** (year-to-year bounce), **not heterogeneity** (where in the county this address sits). Heterogeneity is the Studio's position read.
- The risk read is one sentence ("once every N years, ~X%/yr"), not a survival curve.
- "How this pays" is framed as certainty (duration, full payout at trigger, just-missed doesn't pay) to pre-empt basis-risk disputes.
- A confirmable resolved-address chip ("Pricing for 123 Main St — not right? edit") precedes the final premium; a ZIP-centroid match visibly caveats placement.
- No ER slider, no margin lever, no shadow price, no factor highlight outwardly. The seam stays a single link.
- The **visual band tightening/widening as the trigger drags** is itself the main risk read (8h is data-rich and conservative per A014).

**Honesty question.** Is the year-based confidence band honest, or does it over/understate by conflating sampling noise, clustering, and trend? If too tight → underwriters under-reserve; if too wide → they over-reserve and lose deals. Can the underwriter distinguish *confidence* (this band) from *heterogeneity* (the much wider Studio position spread)?

**Caveats.**
- Band is **precomputed** in the pipeline (needs per-year counts). If counts aren't shipped, the engine falls back to `bandDriver='none'` and shows no range.
- A ZIP-centroid geocode = weak placement; the rule to *widen the band* on unvalidated location is documented but **not yet wired** into the outward view.
- Band reflects historical variability only; it does **not** forecast forward regimes. A wired Step-5 factor would move the point but not the baseline band.
- "Once every N years" uses Poisson `1/years` & `e^−λ`; the real process is clustered (D≈5 at T=8h, A017), so "return period" is a convenient frame, not a renewal guarantee.
- "How this pays" omits the duration-measurement method (SCADA vs claim-reported) — that belongs in underwriting collateral, not the buyer price.

---

### 3.2 — Baseline · `real`

**Underwriter decision.** *Is per-customer annual frequency λ(T) reliable enough to quote?* Which counties go to **review** vs **quotable**, and at which trigger thresholds? This tab also **explains the band** that Price Breakdown displays.

**Plots**

| Plot | Type | Source | What it shows |
|---|---|---|---|
| Annual Qualifying Events by Year | line | `studio.json perT[T]` per-year counts + `years` x-axis | Stability of the county's annual count and over how many observed years. Wide swings / short history ⇒ wider premium band. |
| Survival Curve S(T) — share lasting ≥ T | step | **add to studio.json:** `S_T` = `n_events_qualifying / n_events_total` per-T (from `per_customer_view.json`) | How fast qualifying counts drop as trigger rises. Sharp drop ⇒ short events dominate, long-T rates thin & uncertain. |
| Per-Customer Multiplier Distribution | bars (median/mean/max) | **add to studio.json:** `multiplier_{median,mean,max}` from `per_customer_view.json[T]` | The 30–100× heterogeneity cone: median (typical event) sits 5–7× below mean (e.g. Alachua T=4h median 0.000617 vs mean 0.002973). Shown as a *position* read, not the band. |
| Overdispersion Index (Var/Mean) per T | bars | **add to studio.json:** `var/mean` of `perT[T]` counts; validate against source-coverage-masked series | Clustering. Index ≫1 ⇒ storms bundle outages, justifying a wider *year-based* band, not a tight Poisson interval (median index 5.0 at T=8h). |
| Qualifying Event Counts per Trigger | bars (T=2,4,8,12,24h) | `n_events_qualifying` per T (`per_customer_view.json`) → add as `n_qual_by_T` | Sample-size drop-off. Thin samples (<100 at T=24h) trip the coverage gate and suppress the point quote. |
| Year-Based Confidence Band (80% & 90%) | step | `pricing.json[T].lo/.hi` (already computed; 80% outward, 90% in Studio) | The credible range on point λ — widens where history is thin, noisy, or storm-clustered. The honest signal to act on. |
| Regime Label & Trend Signal | strip | `studio.json regime, sub, tstat, labels_by_T, xT`; `regime_classification.csv` | Stable / trending / episodic / insufficient; cross-T flags mixed-T counties for per-T review vs one fixed price. (Detailed view lives in County Clustering.) |

```
sample-size cliff (why long-T routes to review)         band width tracks clustering
events/county/yr (national)                              80% band, illustrative
 2h ███████████████████████████  ~300                    stable  ├──•──┤      tight
 4h ████████████████             ~170                     noisy   ├────•────┤
 8h █████████                    ~90  ← conservative T    storm   ├───────•───────┤  wide
12h █████                        ~55     (A014)
24h ███                          ~44  (43 counties=0,
                                       225 counties <10)
```

**Reads (short).**
- Per-customer λ shipped as the May-2026 headline: `λ_county × E[mean_customers / MCC | duration ≥ T]`; shrinks the v0 county rate 30–100× because most events hit only a share of customers.
- Annual counts cluster heavily (median overdispersion 5.0 at T=8h; 94% of counties overdispersed); a naive Poisson band is ~2× overconfident, so the shipped band uses **observed year-to-year variance**, not independence.
- Sample size drops sharply past T=8h; at T=24h, 43 counties have zero events and 225 have <10, forcing point-quote suppression and routing to review. The gate (`available/caution/not_available`) is precomputed per (fips, T).
- The multiplier is heavy-tailed: median typically 5–7× below mean (Alachua T=4h: 0.000617 vs 0.002973); this is **structural** (core vs periphery), shown as a position read ("this address in upper quartile"), not the confidence band.
- **A011** is load-bearing: the multiplier uses `mean_customers` as a proxy for true per-customer overlap, likely overstating by 2–3× under staggered restoration — a documented (not modeled) conservative cushion.

**Honesty question.** Is baseline λ(T) biased, in which direction, by how much? — A011: `mean_customers` over-counts true customers crossing T in staggered-restoration regimes → ~2–3× conservative cushion (direction confirmed, magnitude gated on PowerOutage.US per-outage data, not yet wired). A017: does the year-based band track real risk, not just observed noise? **Validated** — variance from actual history, no independence assumption; honest where clustering is highest.

**Caveats.**
- A011 cannot be tested from EAGLE-I alone; PowerOutage.US trial (NDA, key 2026-05-23; confirmed 64% of live outages affect ≤1 customer) is the first validator. Per-outage reconstruction is Phase 4 of the per-customer plan (refinement, not a gate).
- A012: one global annualization window (~11.17 yr) for all counties dilutes rates where source coverage is thin (TX 2016: 135/254 counties zero all-duration). `C_source` flags it; the per-county-observed-years fix is pending a pricing decision and doesn't change the preview.
- A016: the all-duration source-coverage mask is applied to T-specific series without T-specific validation. At T=8h it discards ~3,073 genuine ≥8h events (2015–17) from ~772 county-years. Permutation test shows the mask isn't the signal source (~−10% under shuffled targets), but T-specific validation is open.
- S(T) is **empirical, not fitted**; thin counties have noisy long-T S(T) and route to `not_available` rather than show false precision (T=24h: 225 of ~3,090 counties <10 events).
- The band is built from annual counts only, so it conflates sampling noise + clustering + any trend (worsening counties' variance includes the trend); it may slightly over-state pure epistemic uncertainty for trending counties (direction: wider, conservative). Step-5 will decompose trend separately.

---

### 3.3 — County Clustering · `real`

**Underwriter decision.** *Fast regime read:* is this county chronic/stable, trending, shifted to a new level, or storm-spiked? What's its predictability confidence, and how does risk behave across trigger durations? **The regime is a router for which forward machinery a county needs — not a forecast of next year's count.**

**Plots**

| Plot | Type | Source | What it shows |
|---|---|---|---|
| Annual ≥8h series + fitted-pattern overlay | line | `studio.json perT["8"]` + `years` + `county_regime_T8.csv` (slope, r_step, split point) | Does observed history match the label? Flat=stable, upslope=trend, two-level jump=shift, spike+revert=episodic. |
| Cross-T regime pattern | strip | `studio.json labels_by_T` (e.g. `2:shift\|4:shift\|8:trend\|12:trend\|24:stable`) + `xT` | Does the regime hold across durations (T-stable) or shift by threshold (`intensifies@longT` = storm-driven, `weakens@longT`, `T-mixed` = fragile)? |
| Predictability confidence gauge | bars | `county_regime_T8.csv: conf, n_obs, total, stab4` + `studio.json perT` | Is the label SOLID (n_obs≥8, total≥20, stab4≥0.5, consistent across T) or SOFT (thin / recent-change / T-sensitive / borderline tstat)? |
| Volatility rank vs national peers (CV by regime) | distribution | **add:** `county_regime_T8.csv: cv` by regime cohort | Is this stable county TIGHT (cv<0.15) or NOISY (cv>0.25)? Smooth vs ragged trend; percentile vs peers. |
| Spike dominance (peak_share) | bars | **add:** `peak_share` (max_yr/total), `top2_share`, episodic threshold ≥0.40 | Share of 11-yr volume in the single largest year. Episodic if >40% and reverts. |
| Step changepoint (shift counties only) | step | **add:** `r_step`, `jump_z`, `split_idx`; pre/post means | When the jump occurred, how big (≥2σ), and whether RECENT (≤4 yr post-jump, uncertain) or ESTABLISHED. |
| Regime distribution — national position | bars | aggregate `county_regime_T8.csv` | Typical stable (42%) vs rare episodic (1.5%); context for "how unusual is this county." |

```
national regime mix (county_regime_T8.csv)        cross-T honesty mechanism
 stable        ██████████████████████  42%          stab4 ≥ 0.75  → TRUST single T=8 label
 trend         ████████████            23%          stab4  < 0.75  → flag T-sensitive, lower conf
 shift         ███████████             22%          (a flip IS a signal: intensifies@longT
 insufficient  ██████                  11%               = storm-driven long outages)
 episodic      █                       1.5%
```

**Reads (short).**
- FIVE regimes: **stable** (mean-reverting default), **trend** (persistent slope ±), **shift** (jumped to a new level, held ≥3 yr), **episodic** (rare-storm spike that reverted, <2%), **insufficient** (recent change / low volume / short history, ~11%).
- The regime is a **ROUTER, not a forecast** — it says which Step-5 machinery a county needs, not next year's count.
- Cross-T stability (`stab4 ≥0.75`) is the honesty mechanism: when the label holds 2h–24h, trust the single T=8 label; flips/weak agreement flag T-sensitive, lower confidence.
- Confidence (high/low) gates on: `n_obs ≥8`, `total ≥20`, `stab4 ≥0.5` (T-sensitive), `|tstat| ≥2.75` (trend), `r_step ≥0.60` (shift) — clear the bar or be marked low-confidence.
- `intensifies@longT` = the chronic-vs-storm signal: stable at short T, structured at long T ⇒ long outages are rare-weather-driven, not chronic grid issues.

**Honesty question.** Are regime labels honest behavioral descriptions of the county's own history, or overfit to noise? — A013: behavior not cause (no weather/grid inputs); A014: one label at T=8h with a cross-T stability flag; A015: ABSTAIN when data can't support a label; A016: the mask discards ~3,073 real ≥8h events, mostly 2015–17.

**Caveats.**
- Derived from EAGLE-I alone — **behavior, not cause**; weather/grid is Step 5, conditional on the regime (A013).
- One label per county at T=8h (not per-T) to avoid manufacturing unreliable labels at thin thresholds (24h ≈44 events/county/yr vs ≈300 at 2h) (A014).
- ~11% honestly **insufficient** rather than force-fit (A015).
- The all-duration mask applied to the ≥8h series discards ~3,073 real ≥8h events (mostly 2015–17 coverage ramp); flagged in metadata (A016).
- Cross-T stability is moderate (~60% agreement) — a flip across thresholds is itself a signal; flagged per county.
- **No ground-truth label.** Validation is face-validity, defensibility (every typed label passes a significance gate), stability (same county across 30/45/60-min catalogs), and distinctness.

---

### 3.4 — Adjusters · `partial` (Location) + `framed` (Forward)

**Underwriter decision.** *What moves this county off baseline?* Two lanes plus the per-county tuning controls: **(A) Location** — is this address denser/sparser than its county average, and by how much? **(B) Forward** — should we adjust historical frequency for grid/climate/hazard regime change, which lane first, and how capped? Global loadings + data source stay in Settings.

> **Maturity banner (must render in-tab):** Location = **shadow** (validated CT/MA/RI only, not in the quoted premium). Forward = **placeholder** (no signal wired — factor = 1.0). Neither currently moves the price; this tab shows the *candidate* adjusters honestly.

#### 3.4·A — Location (within-county basis) · `partial`

**Plots**

| Plot | Type | Source | What it shows |
|---|---|---|---|
| Within-county density relativity by tercile (T=4h) | bars | `density_relativity.json: relativity.T4.v0_shadow` (rural 1.40× / mid 1.23× / urban 0.80×) | Price multiplier by density rank within county: rural +40%, urban −20%, mid ≈ average. |
| Empirical vs v0-capped relativity by T | step | `density_relativity.json relativity` (T1/T2/T4/T8 × `empirical` vs `v0_shadow`) | Raw PoUS factors (rural 1.76–2.06× across T) vs deliberate 0.80–1.40 cap for cautious activation; how confident we are to place an address in the tail. |
| Within-county dispersion per county | bars | `county_location_basis.json: dispersion` + `validated` flag | High dispersion (≈0.74) = big rural-urban gap, benefits from location pricing; low (≈0.04) = uniform, little effect. `validated` flag = empirical (CT/MA/RI) vs national projection. |
| Within-county relativity map (CONUS, drill-in) | map | `tract_density.json` (log₁₀ density/tract) + TIGERweb boundaries (runtime PiP); county color from `county_location_basis.json` | Geospatial rurality relativity: bright=dense (0.8×), dark=sparse (1.4×); validated (PoUS) vs extrapolated regions; where an address lands in its county's distribution. |
| Density↔outage correlation (Spearman ρ) | strip | `density_spearman_by_county.csv` + `density_spearman_significance.csv` | Which counties show a strong link (ρ ≤ −0.30, significant) vs weak/noisy (ρ≈0); identifies outliers where canopy/topology may dominate. PoUS median \|ρ\|=0.35 (T≥4h). |
| Urban vs rural gradient + conservation check | bars | `town_density_features.csv` + empirical terciles (rural 1.90× / urban 0.71×, T≥4h) | The actuarial magnitude (≈3× span) and the conservation proof: exposure-weighted mean ≈1.0 within a county ⇒ redistributes, doesn't amplify, county total. |

```
within-county tercile relativity (T≥4h)        capped vs empirical (activation throttle)
 rural   ████████████████████  1.90× emp.        emp.   rural 1.76–2.06×  ──┐ throttled to
 mid     █████████████         ~1.0×             cap    rural ≤ 1.40×       ├─ 0.80–1.40 for
 urban   ███████               0.71× emp.        cap    urban ≥ 0.80×     ──┘ attribution conf.
 (conservation: exposure-weighted mean ≈ 1.0)
```

**Reads (short).**
- Density predicts within-county exposure: Spearman ρ(density, relative) = −0.35 (PoUS CT/MA/RI, T≥4h); the rural 1.9× / urban 0.71× span is structural, survives credibility filters.
- Tree canopy tested and **discarded**: partial ρ(canopy \| density) ≈ 0 in NE where canopy saturates (median 68%). Density is the single parsimonious feature.
- **Validated on PoUS only** (CT/MA/RI Jan–Mar 2019, one quiet season, one nor'easter). The national map *extrapolates* density terciles to all CONUS via ACS density — labelled shadow/extrapolated.
- Known flaw: population density under-ranks dense commercial cores (Midtown Manhattan reads "rural"). Fix: zonal-mean NLCD impervious surface, scheduled when location graduates shadow → active.
- Conservation holds: location-adjusted exposure-weighted mean ≈ 1.0 per county — redistributes, doesn't amplify.

**Honesty question.** Is within-county relativity real and causally tied to grid topology (overhead vs underground, radial vs looped, crew density), or a proxy for another driver (socio-economic, measurement artifact, confounded feature)? Once validated in one region, how fast does the link degrade moving out (TX, the West, low-canopy regions)? Does it reverse where ice/wind/terrain dominate over tree contact?

**Caveats.**
- One region, one quiet season — provisional until replicated in TX/the West/a full storm season.
- Cell/town exposure, not premise-verified; town→address last mile needs live outage geometry / AMI.
- Population-density flaw in big-city commercial cores (Manhattan mis-ranks rural); zonal NLCD impervious pending.
- NE-specific proxy ("density alone"); re-test per region where ice/wind/terrain dominate.
- The 0.80–1.40 cap is a **policy choice** for attribution confidence, not the empirical signal (rural 1.90× / urban 0.71×).

#### 3.4·B — Forward (climate / grid / credibility) · `framed`

> **All plots below render as labelled placeholders ("not built — design target") until wired.** No source file exists yet; the table names the *intended* artifact so the build target is unambiguous.

| Plot (placeholder) | Type | Intended source (once built) | What it will show |
|---|---|---|---|
| Forward Modifier Composition | waterfall | `model_runs/forward_*/county_predictions.parquet` (`grid_condition_factor`, `hazard_modifier`, `credibility_modifier`) | Premium impact of each lane stacked on the historical baseline; which lever moves the needle per region. |
| Grid vs Hazard scatter | strip | `curated_outage_data/model_features.parquet` (lagged utility reliability + hazard history) | Whether low-SAIDI counties price lower independent of storm frequency — validates grid as a separate dimension from hazard. |
| Credibility blend (sparse → pooled) | line | `model_runs/forward_*/credibility_pooled_lambda.parquet` | How far each county's premium moves under hierarchical pooling toward state/region, as a function of sample size. |
| Forward backtest (rolling origin) | step | `model_runs/forward_*/backtest_metrics.parquet` | Whether the forward model calibrates better than v0 flat baseline on held-out years — the activation proof. |
| Regional residual bias | bars | `model_runs/forward_*/residual_bias_by_region.parquet` | Regional blind spots (e.g. over-predict SE, under-predict CA) needing subregional refinement. |

```
Step 3 → Step 5 bridge (the unbuilt, gating connection)
  regime label (router)              forward lane (gated)
  ────────────────────               ─────────────────────────────
  episodic / shift-recent  ───────▶  hazard_review  (no numeric factor; manual)
  stable / trend           ───────▶  trend / climate GLM (numeric factor allowed)
  insufficient             ───────▶  credibility pooling (shrink to region)
  *currently: regime is LABELLED but wired to NOTHING*
```

**Reads (short).**
- Framed placeholder: plans + mature hazard research exist, but **no code** in `build_data.py` and **no field** in any JSON. Steps 1–4 are production/shadow; Step 5 is **not built**.
- Three lanes, **unordered**: (1) `grid_condition_modifier` (SAIDI/CAIDI, capex, undergrounding); (2) `hazard_weather_modifier` (storm frequency, wildfire, climate projections); (3) `credibility_modifier` (hierarchical pooling for sparse counties). The Step-3 regime is a **router**, not a modifier.
- The Step 3→5 bridge is critical and unbuilt: regime routing should *gate* which forward method is allowed (sparse/episodic → hazard_review; smooth → trend/climate). Today the label activates nothing.
- Lifecycle distinguishes **bias-correction** (shrinks with better data, e.g. customer_impact, already shipped) from **forward-regime** (structural overlay, does NOT shrink). Grid + hazard are forward-regime; their gate is *external validation*, not internal refinement.
- Activation blockers: (a) cause-tagged event dataset unbuilt (cause coverage ~24%, below 80% gate); (b) PoUS cause-coverage trial closed (May 2026 NDA); (c) no curated grid-feature dataset.
- Proposed sequence: Phase 0 transparent capped overlay → count/survival GLMs (Poisson/NegBin) → ML challenger. Backtest design (rolling-origin, calibration by threshold/state, rank stability) specified, not implemented.
- Hazard sandbox exists (`docs/extra/hazard_modeling/` with tests) but is research, not connected to `price_engine`.

**Honesty question.** Which covariates legitimately move the forward view, gated how? And how does Step 3 (behavior routing) connect to Step 5 (prediction methods) — which regime labels route to numeric factors vs hazard/review gates?

**Caveats.**
- **NO REAL SIGNAL** — forward regime is a design placeholder; "forward" does not exist in today's quoted price.
- **REGIME ≠ FORECAST** — Step 3 labels historical *shape*, not the future; "regime = trend" ≠ "λ is trending forward."
- **UNBUILT ENRICHMENT** — no cause-tagged dataset, so forward models can't separate weather- from equipment-driven outages; all forward adjustments float unanchored.
- **GAP** — no integrated grid-condition features (SAIDI/CAIFI, capex, undergrounding); EIA-861 exists as reference but isn't curated into `model_features.parquet` (Phase 2, not started).
- **UNCERTAINTY NOT QUANTIFIED** — backtest design specified, metrics don't exist; can't yet show "beats flat baseline."
- **GOVERNANCE GATE PENDING** — activation requires external validation (held-out rolling backtest OR a named public/vendor benchmark); no gold-standard benchmark named.
- **CREDIBILITY NOT PARAMETERIZED** — pooling geography/shrinkage/min-sample undecided; placeholder factor = 1.0.

---

## 4. Served vs Needs-Adding Rollup (data work before UI work)

Ground truth from `web/scripts/build_data.py` (emits `pricing.json`, `studio.json`, `counties-by-state.json`):

- `pricing.json[fips].T[t]` currently emits: `lam`, `n` (`n_events_qualifying`), `gate` (`coverage_gate_status`), `lo`, `hi` (year-based 80% band, A017).
- `studio.json[fips]` currently emits: `regime`, `sub`, `stab4`, `labels_by_T`, `xT`, `tstat`, `years`, `perT` (annual counts per T).

```
LEGEND  ✅ served now   ➕ add to build_data.py   🔌 wire/promote (file exists, not in web/lib/data)   🚧 blocked on upstream data
```

| Tab | Field / artifact | Status | Where it comes from |
|---|---|---|---|
| Price Breakdown | `{low, point, high, bandDriver}` | ✅ `composePremium()` consumes `pricing.json lam/lo/hi/gate` | — |
| Price Breakdown | ZIP-centroid → band-widen rule | ➕ outward rule unwired | logic in compose layer |
| Baseline | `perT[T]` annual counts | ✅ `studio.json` | `county_yearly_trend` parquet |
| Baseline | `lo/hi` 80% band; 90% inward | ✅ (80%) / ➕ emit 90% variant | `rel_band()` already computes |
| Baseline | `n_events_qualifying` per T | ✅ as `pricing.json.n`; ➕ surface as `n_qual_by_T` in studio.json | `per_customer_view.json` |
| Baseline | `S_T` (survival = qual/total per T) | ➕ add to `studio.json` | `per_customer_view.json` (qual & total counts) |
| Baseline | `multiplier_{median,mean,max}` | ➕ add to `studio.json` | `per_customer_view.json[T]` |
| Baseline | `overdispersion_index` (var/mean of perT) | ➕ add (derivable from existing `perT`) | compute in `build_data.py` |
| County Clustering | `regime, sub, stab4, labels_by_T, xT, tstat, years, perT` | ✅ `studio.json` | `county_regime_T8.csv` |
| County Clustering | `conf` tier (high/low), `n_obs`, `total` | ➕ add to `studio.json` (exist in CSV) | `county_regime_T8.csv` |
| County Clustering | `cv`, `peak_share`, `top2_share` | ➕ add to `studio.json` (exist in CSV) | `county_regime_T8.csv` |
| County Clustering | `r_step`, `jump_z`, `split_idx` (shift) | ➕ add to `studio.json` (exist in CSV) | `county_regime_T8.csv` |
| County Clustering | national regime distribution | ➕ precompute aggregate (one-time) | aggregate the CSV |
| Adjusters → Location | `density_relativity.json`, `county_location_basis.json`, `tract_density.json` | 🔌 exist in `price_engine/dashboard/data/`, **not** in `web/lib/data/`; promotion gated on validation outside CT/MA/RI | promote + add per-threshold location factors to `studio.json` if it goes active |
| Adjusters → Location | Spearman ρ per county | 🔌 `density_spearman_by_county.csv` (exists, not bundled) | location_features analysis outputs |
| Adjusters → Forward | grid / hazard / credibility factors | 🚧 no field, no code; blocked on cause-tagged dataset (24%→80%) + grid-feature curation | `model_runs/forward_*` (none built) |

**Net data work, ordered by cheapness:**
1. **Pure re-emit (cheap, no new compute):** add `conf, n_obs, total, cv, peak_share, top2_share, r_step, jump_z, split_idx` to `studio.json` — all already in `county_regime_T8.csv`.
2. **Cheap derived:** `overdispersion_index` (var/mean of existing `perT`); national regime distribution (aggregate the CSV); 90% band variant (`rel_band(conf=0.90)`).
3. **Moderate (new reads from `per_customer_view.json`):** `S_T`, `multiplier_{median,mean,max}`, `n_qual_by_T`.
4. **Promotion (no new science, but a governance/validation gate):** copy/wire Location shadow artifacts from `price_engine/dashboard/data/` into `web/lib/data/`.
5. **Blocked (real upstream data work):** all Forward fields — depend on cause-tagging ≥80% + curated grid features that do not exist.

---

## 5. Recommended Build Sequence

Deepest/realest first — ship what we can fully back, defer what's gated. Each step lists *buildable now* vs *blocked*.

```
PHASE 1 ─────────────────────────────────────────────────────────────────────
  Price Breakdown (home) + Baseline tab + Context bar
  realness: ████████████████████ real · prices today
  BUILDABLE NOW:
    • Context bar, premium hero + quiet band (compose.ts already ships these)
    • Risk read, "how this pays", provenance line  (all derive from shipped fields)
    • Baseline plots from shipped studio.json: annual-events-by-year, band step,
      qualifying counts per T (pricing.json.n), regime strip
    • Cheap studio.json additions: overdispersion_index, S_T, multiplier stats,
      n_qual_by_T, 90% band  (steps 1–3 of the rollup)
  BLOCKED / DEFER:
    • ZIP-centroid band-widen rule (small wiring task, schedule with geocode chip)

PHASE 2 ─────────────────────────────────────────────────────────────────────
  County Clustering tab
  realness: ████████████████████ real · diagnostic/router (not a multiplier)
  BUILDABLE NOW:
    • Series+overlay, cross-T strip, regime distribution — from shipped studio.json
    • Confidence gauge, CV-vs-peers, peak_share, changepoint — after re-emitting
      county_regime_T8.csv fields (rollup step 1; zero new science)
  BLOCKED / DEFER:
    • nothing — fully backed by existing CSV; gated only on the re-emit task

PHASE 3 ─────────────────────────────────────────────────────────────────────
  Adjusters tab — Location lane (partial) THEN Forward lane (framed)
  realness: ██████████ shadow (Location) · ███ placeholder (Forward)
  BUILDABLE NOW (Location, as SHADOW with maturity banner):
    • Tercile bars, empirical-vs-capped, dispersion, CONUS map, Spearman strip
      — artifacts exist; promote price_engine/dashboard/data → web/lib/data
    • Hard-label "shadow · validated CT/MA/RI only · not in quoted premium"
  BLOCKED (Location → active pricing):
    • validation outside CT/MA/RI + full storm season; NLCD impervious fix;
      per-threshold location factors into studio.json
  BUILDABLE NOW (Forward, as PLACEHOLDERS):
    • Render all 5 forward plots as labelled "not built — design target" stubs
    • Render the Step 3 → Step 5 routing diagram (it is honest design, not a quote)
  BLOCKED (Forward → any signal):
    • cause-tagged dataset (24%→80% gate); curated grid features (EIA-861);
      rolling-origin backtest metrics; named external-validation benchmark;
      credibility pooling parameterization.  Until then: factor = 1.0, no number.
```

**Sequencing rationale.**
- **Phase 1 first** because it is the deliverable (one premium + honest band) and is 100% backed by fields `compose.ts`/`pricing.json` already ship; the only data work is cheap `studio.json` additions.
- **Phase 2 next** because the regime tab is fully real but needs a zero-science re-emit of CSV columns — low risk, high underwriter value (review-routing).
- **Phase 3 last and explicitly staged**: Location ships as a clearly-labelled shadow read (promotion is plumbing, not science), and Forward ships only as honest placeholders + the routing diagram. **Do not let Forward block Phases 1–2** — it depends on upstream datasets that do not yet exist, and the house rule is to show maturity honestly rather than manufacture depth.

**One-line gate per phase:** P1 — cheap `studio.json` field adds; P2 — re-emit `county_regime_T8.csv` columns; P3a — promote Location shadow artifacts (+ a maturity banner); P3b — *nothing ships as a number* until cause-tagging ≥80% and a backtest beats the flat baseline.

---

**Relevant absolute paths.**
- Pipeline (data work lives here): `/Users/divy/code/work/infrasure_git_codes/outage_pricing/web/scripts/build_data.py`
- Web data bundle (consumed by the app): `/Users/divy/code/work/infrasure_git_codes/outage_pricing/web/lib/data/{studio.json,pricing.json,counties-by-state.json}`
- Pricing engine (point/band): `/Users/divy/code/work/infrasure_git_codes/outage_pricing/web/lib/pricing/compose.ts`
- Location shadow artifacts to promote: `/Users/divy/code/work/infrasure_git_codes/outage_pricing/price_engine/dashboard/data/{density_relativity.json,county_location_basis.json,tract_density.json}`
- Regime source CSV (re-emit columns): `/Users/divy/code/work/infrasure_git_codes/outage_pricing/notebooks/outputs/regime_classification/county_regime_T8.csv`
- Per-customer source (S(T), multiplier stats): `/Users/divy/code/work/infrasure_git_codes/outage_pricing/price_engine/catalogs/eagle-i-45min/pricing/per_customer_view.json`