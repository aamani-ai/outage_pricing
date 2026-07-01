# Outage Modeling Framework — End-to-End Guiding Document

**Status:** living guiding document — the map we keep returning to
**Last reviewed:** 2026-06-22
**Owner:** outage pricing
**Purpose:** the full backend pipeline as a sequence of explicit steps, each
paired with the honest question it must answer. This is the **index + state of
play**, not a restatement of the methodology — detail lives in the per-step docs.

> **How we build it:** see [`principles/`](principles/) — the durable principles we hold
> ourselves to, starting with [**Built to Be Communicated**](principles/communicate_to_share.md)
> (shareability is the deliverable; run its 6-point test before any read / label / chart ships).

---

## Status at a glance

```text
STEP                       BUILD                       IN QUOTED PRICE?
──────────────────────────────────────────────────────────────────────
1  Eventize             ████████████  production        base input
2a County frequency     ████████████  production        base
2b Per-customer mult.   ████████████  production      ●  YES (headline)
   └─ cell read         ███░░░░░░░░░░  diagnostic      ○  no
3  Risk clustering      ██████████░░  shadow (built)  ○  no      ◀ CURRENT
4  Location basis       █████████░░░░  shadow          ○  no
5  Forward regime       ░░░░░░░░░░░░░  not built       ○  no
──────────────────────────────────────────────────────────────────────
 ● in price    ○ not in price    ◀ where we are now
```

How to read each step:

```text
   step              =  what we compute
   honesty question  =  how could it be wrong, and in WHICH DIRECTION
```

| Tag | Meaning |
|---|---|
| **production** | wired into the quoted number today |
| **shadow** | computed + shown, but not in the quoted price |
| **diagnostic** | notebook only; no artifact in the pricing tree |
| **not built** | planned, no code wired |

This document is **living** — when we execute a step, its section updates here.

---

## The shape

```text
                          RAW EAGLE-I  (county, 15-min customers_out)
                                       │
                              ┌────────▼────────┐
                              │  1  EVENTIZE     │  → county event catalog
                              └────────┬────────┘
                                       │
                              ┌────────▼────────┐
                              │  2a λ_county(T)  │  ◀── BASE
                              └────────┬────────┘
                                       │
              ┌────────────────────────┴────────────────────────┐
              ▼  BASIS ALIGNMENT                  FORWARD REGIME  ▼
   "match THIS policy/location"            "match the FUTURE not the past"
   ┌──────────────────────────┐            ┌──────────────────────────┐
   │ 2b per-customer multiplier│            │ 3  risk clustering        │
   │ 4  location basis         │            │ 5  grid/climate/weather   │
   └────────────┬─────────────┘            └─────────────┬────────────┘
                └───────────────────┬───────────────────┘
                                    ▼
                        quoted per-customer price

   ┌──────────────────────────────────────────────────────────────┐
   │  CELL READ rides alongside EVERY arrow:                        │
   │    for each (fips, T):  evidence reliability  +  proxy posture │
   │    "how much do we trust it"   +   "which way is it biased"    │
   └──────────────────────────────────────────────────────────────┘
```

- **basis_alignment** (2, 4) mostly *shrinks* the county number toward one policy — direction largely known.
- **forward_regime** (3, 5) asks if the past level is the right *future* level — direction can go either way.
- Every explicit assumption is registered as A001–A016 in [`methodology/assumptions.md`](methodology/assumptions.md). Cite by ID; never restate.

---

## Step 1 — Eventize

```text
county 15-min snapshots ──▶ bridge positive runs within gap tolerance ──▶ events
                                                                          (start,end,
                                                                           duration,
                                                                           cust stats)
```

**Status:** **production** — `price_engine/data/02_construct_events.py` → `events.parquet` (~14M rows/catalog) at 30 / 45 / 60-min gap tolerance (default 45).

**Honesty question:** *are we over- or under-counting events?*

```text
true 6h outage:   [════════════════════ 6h ════════════════════]
observed rows:    + + + + +  .  .  + + + + + + + + + + + + + + +
                            └gap┘
   strict gap →  [ev A 1.25h]    [ ev B 4.5h ]     split: 1 event → 2
   loose  gap →  [════════ one 6h event ════════]  merge: 2 events → 1

   effect is THRESHOLD-DEPENDENT:
     T=2h  split can OVER-count   │  T=8h  split can UNDER-count (fragments < T)
```

**Open bottlenecks**
- gap-tolerance sensitivity (30/45/60 spread) is the *direct* measure of "how much does price depend on a preprocessing choice" — **not yet quantified per cell.**
- duration is inferred from positive obs, not customer restoration → feeds Step 2's duration question.

**Pointers** — [`event_catalog_creation_methodology.md`](methodology/01_eventization/event_catalog_creation_methodology.md) · [`fundamentals/event_catalog_fundamentals.md`](methodology/01_eventization/event_catalog_fundamentals.md) · [`dicsscssion/eventization_frequency_contract/`](dicsscssion/eventization_frequency_contract/) · nb `event_duration_bucket_analysis.ipynb`

```text
where event mass sits — share of all events by duration (45-min, ~13.2M)
 0–2h   ███████████████████████████  50.2%   ◀ half the catalog is < 2h
 2–4h   █████████████                23.3%
 4–8h   ████████                     15.0%
 8–12h  ███                           5.1%
12–24h  ██                            4.3%
 24h+   █                             2.1%
 cumulative ≥T:  2h 49.8% │ 4h 26.5% │ 8h 11.5% │ 12h 6.4% │ 24h 2.1%
 → longer T = cleaner insured event, thinner sample. read per cell, not globally.
```

---

## Step 2 — County frequency → per-customer frequency

```text
events ──▶ λ_county(f,T) = qualifying events (dur ≥ T) / yr           [2a base]
       ──▶ multiplier(f,T) = mean over those events of                [2b basis]
                             mean_customers_out(e) / MCC(f)
       ──▶ λ_customer = λ_county × multiplier        (shrinks ~30–100×)
```

**Status:** **production headline** — `pipelines/per_customer_rate/compute_per_customer_lambda.py`; per-customer is the dashboard rate (shipped 2026-05-30).

**Honesty question:** *is the multiplier over- or under-estimating?* — this is **A011**.

```text
A011 — does mean_customers overstate who actually crossed T?   (an 8h event)
 customers
  500 ┤█                        periphery: 500 customers out ~1h then restored
      │█                        core:        5 customers out the FULL 8h
      │█
    5 ┤█▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
      └┴──────────────────────┴
       0h                      8h
   mean_customers ≈ 67     N(≥8h)=5     → mean overstates ~13×
   bias = OVERESTIMATE = CONSERVATIVE cushion  (good for insurance)

   plateau event (all core, no periphery):  mean ≈ N(T)  →  NO cushion
     ⇒ "balanced" cells run CLOSEST TO THE BONE; spiky cells are most over-reserved
```

**Open bottlenecks**
- **the live work: cell read = the A011-regime read.** Inner-event shape proxies are the empirical signature of where a cell sits on the synchronous↔core+periphery spectrum — i.e. *how big the cushion is and whether its sign could flip.* Wiring proxy posture to A011 (not as a separate vocabulary) is the first task.
- A011 can't be tested from EAGLE-I alone → PowerOutage.US trial is the first shrink candidate.

**Pointers** — [`fundamentals/per_customer_pricing_fundamentals.md`](methodology/02_per_customer/per_customer_pricing_fundamentals.md) · [`per_customer_view_walkthrough.md`](methodology/02_per_customer/per_customer_view_walkthrough.md) · [`A011`](methodology/assumptions.md) · nb `per_customer_rate_phase1.ipynb`

### Cross-cutting (Steps 1–2): the cell read

```text
cell_read(fips,T) = evidence reliability  +  proxy posture  +  review reason

                EVIDENCE →    thin                 strong
   PROXY POSTURE
   ───────────────────────────────────────────────────────────
   balanced          │   review / thin        quote normally
   likely conserv.   │   review               quote · note the margin
   duration-align?   │   suppress             quote · review note
```

**Status:** **diagnostic** — notebooks only; **no artifact exists**, not on the dashboard. Vocabulary not yet locked.

```text
"spikiness" rises mechanically with T (median max/mean, national)
  2h  █▌          1.54
  4h  ██▏         2.16
  8h  ███▍        3.43   spike-like share 57%
 12h  ████▌       4.59
 24h  ███████▎    7.26   spike-like share 86%
 ⇒ read a county vs the NATIONAL value at the SAME T — not the raw level.
```

**Simplicity ruler:** a proxy/flag earns its place only if it changes a decision (eligibility · estimator · review routing · a number). Drop inert ones (bridge-heavy ≈0% nationally) and fragile ones (min/mean — set by a single snapshot, already dropped from the national table).

**Pointers** — [`02_underwriter_confidence_framing.md`](dicsscssion/eventization_frequency_contract/02_underwriter_confidence_framing.md) · [`03_inner_event_shape_diagnostics.md`](dicsscssion/eventization_frequency_contract/03_inner_event_shape_diagnostics.md) · [`inner_event_shape_confidence_plan.md`](plan/cross_cutting/inner_event_shape_confidence_plan.md) · nb `inner_event_shape_diagnostics.ipynb`

---

## Step 3 — Risk clustering (regime classification)

```text
masked ≥8h annual series per county  ──▶  significance-gated rule tree  ──▶  one regime / county
   (coverage ramp removed)                 (ABSTAIN when data can't support a label)

 STABLE        TREND          SHIFT          EPISODIC        INSUFFICIENT (abstain)
 steady noise  persistent     jumped to a    storm spike     can't type it:
               slope          new plateau    that reverts    recent-change / low-vol / short
 │* *  * *     │       *      │   *****       │     *         │   ?  ?
 │ * * *  *    │    * *        │ **            │ . . . *. .    │
 └────────     └────────      └────────        └────────         └────────
```

**Status:** **shadow** — `regime_classification.ipynb` → `outputs/regime_classification/county_regime_T8.csv` (per-county regime · sub-flag · confidence · cross-T stability). A behavioral **router / identity** — behavior not cause (A013), **not** a forecast, **not** in price. Significance-gated rule tree, adversarially verified (3 lenses).

```text
 distribution (T=8h):  stable 42 · trend 23 · shift 22 · insufficient 11 · episodic 1.5  (% of counties)
 the reframe that made the labels TRUE → ABSTAIN, don't force: ~11% honestly "insufficient"
 instead of force-fit a wrong label (a recent 2-yr surge is NOT a "trend").
```

**Honesty questions** — now registered as assumptions:

```text
 A013  behavior, not cause   regime from outage history alone; weather/grid deferred to Step 5
 A014  one label @ T=8h       + cross-T stability (≈0.60 agreement) — moderate, not rigid; flagged
 A015  ABSTAIN, don't force   ~11% 'insufficient' (recent-change / low-volume / short-history)
 A016  mask is all-duration   applied to T=8 (discards ~3,073 real ≥8h events) — flagged, not silent
```

**How it connects forward.** The regime is a **router**: it says *which* forecasting machinery a county
needs, it does not predict. The forecasting **backtest** (model selection) moved to **Step 5** —
retained there as evidence that routing beats a flat baseline ~+18% out-of-sample (the proof Step-5 is
worth building). The old 7-shape pipeline (`county_trend` / `county_predictability`) is a *teacher, not
a crutch* — superseded; its careful step-change / sparse machinery informed this classifier.

**Pointers** — **START HERE:** [`03_risk_clustering/README.md`](methodology/03_risk_clustering/README.md) (the single shareable Step-3 overview — clean → categorize → output). **canonical HOW:** [`regime_classification_methodology.md`](methodology/03_risk_clustering/regime_classification_methodology.md) (stats classification, the 5 outcomes, the T decision) · [`05_source_coverage_mask.md`](dicsscssion/eventization_frequency_contract/05_source_coverage_mask.md) (the masked series) · nb `source_coverage_mask_analysis.ipynb` · [`regime_routing_backtest_plan.md`](plan/done/2026-06-22_regime_routing_backtest_plan.md) (design history + Step-5 backtest evidence). **superseded / context:** [`outage_trend_fundamentals.md`](methodology/03_risk_clustering/outage_trend_fundamentals.md) (slope = a regime feature) · [`outage_predictability_fundamentals.md`](methodology/_archive/outage_predictability_fundamentals.md) · [`dicsscssion/_archive/risk_based_clustering/`](dicsscssion/_archive/risk_based_clustering/) (7-shape catalog) · [`done/2026-06-22_risk_based_clustering_quantification_plan.md`](plan/done/2026-06-22_risk_based_clustering_quantification_plan.md) · nb `_archive/outage_regime_analysis_initial.ipynb` (first-pass, archived)

---

## Step 4 — Within-county location adjustment (basis alignment)

```text
county per-customer rate ──▶ × within-county density relativity ──▶ address rate

 density relativity (mean-1, capped 0.8–1.4)
   rural  ████████████████  1.4×   sparser grid → more exposed
   mid    ████████████      1.0×
   urban  █████████         0.8×   denser → safer
```

**Status:** **shadow** (shipped 2026-06-18, dashboard-only: map "color by" + matrix "location-adjusted" + Mapbox search). `build_density_relativity.py`, `build_county_dispersion.py`.

**Honesty question:** *is the within-county relativity real, or noise?* — density survived; tree canopy tested & discarded; PoUS-calibrated on CT/MA/RI.

**Open bottlenecks** — most mature adjustment layer → **validate, don't rebuild.** Promotion shadow→active still gated on validation.

**Pointers** — [`location_basis_methodology.md`](methodology/04_location_basis/location_basis_methodology.md) · [`fundamentals/location_basis_fundamentals.md`](methodology/04_location_basis/location_basis_fundamentals.md) · [`dicsscssion/location_aware_outage_pricing/`](dicsscssion/location_aware_outage_pricing/) · [`extra/location_features/`](extra/location_features/)

---

## Step 5 — Forward adjustment factors (forward regime)

```text
historical-regime estimate ──▶ + grid/climate/weather/hazard covariates ──▶ fwd est.
```

**Status:** **not built** — plans exist; hazard infra exists but disconnected; no overlay wired.

**Honesty question:** *which covariates legitimately move the forward view, gated how?* + the structural one: *how does Step 3 connect to prediction?*

```text
Step 3 ──▶ Step 5 bridge   (team model predicts the annual RESIDUAL, not raw counts)

   cluster label  ──gates──▶  which forward method is ALLOWED
     sparse / episodic   →   NO covariate trend  (route to hazard/review)
     smooth / volatile   →   YES consider grid/climate/weather covariate
   clustering DIAGNOSES the residual structure; overlays EXPLAIN it.
```

**Open bottlenecks** — the Step 3→5 bridge above; enriched (cause-tagged) event source unbuilt (PoUS cause coverage ~24%, below ~80% gate).

**Pointers** — [`forward_looking_modeling_plan.md`](plan/05_forward_regime/forward_looking_modeling_plan.md) · [`enriched_event_dataset_plan.md`](plan/05_forward_regime/enriched_event_dataset_plan.md) · [`learning_logs/`](learning_logs/) · [`extra/hazard_modeling/`](extra/hazard_modeling/) · [`extra/poweroutage_us/`](extra/poweroutage_us/)

---

## Cross-cutting layers (ride across all steps)

| Layer | What it is | Where |
|---|---|---|
| **Assumptions** | stable-ID record A001–A016 | [`methodology/assumptions.md`](methodology/assumptions.md) |
| **Adjustment taxonomy** | basis_alignment vs forward_regime; modifier lifecycle | [`dicsscssion/pricing_adjustment_mechanisms/`](dicsscssion/pricing_adjustment_mechanisms/) · [`roadmap.md`](methodology/roadmap.md) |
| **Cell read** | evidence + proxy posture per (fips,T) | see Steps 1–2 |
| **Filtration** | green/amber/red modelability tiers | [`methodology/filtration_methodology.md`](methodology/cross_cutting/filtration_methodology.md) |
| **Portfolio** | intra-county correlation, ELT/YLT, tail | [`methodology/concentration_and_portfolio_risk.md`](methodology/cross_cutting/concentration_and_portfolio_risk.md) |
| **Trigger separation** | pricing source vs live trigger vs bridge | [`plan/trigger_source_options.md`](plan/cross_cutting/trigger_source_options.md) |
| **Data foundation** | EAGLE-I + MCC semantics | [`methodology/fundamentals/eagle_i_data_fundamentals.md`](methodology/cross_cutting/eagle_i_data_fundamentals.md) |

---

## Where we are now

```text
 ✔ 1. Step 1–2 categorization — DONE (analysis level)
        cell read = TRUST + POSTURE (cushion LEVEL + TILT), grounded in Chris's question
        duration-conservatism PROVEN (bounded ~10% knob; conservative by direction) — A011 + 04
        remaining: emit the read-only fips×T artifact (Phase 2) · PoUS magnitude (A011 ceiling)
 ▶ 2. Step 3 — REGIME CLASSIFIER BUILT + adversarially verified (2026-06-22)
        ✔ source-coverage mask BUILT (approach A onset) — dicsscssion/…/05 + notebook
        ✔ STATS classifier BUILT — regime_classification.ipynb (significance-gated rule tree, 3-lens verified):
            outcomes  stable 42 · trend 23 · shift 22 · insufficient 11 · episodic 1.5  (% of counties)
            the reframe — ABSTAIN, don't force: ~11% are honestly "insufficient" (recent-change /
            low-volume / short-history) instead of force-fit a wrong label (A015). one label @ T=8h
            + cross-T stability (A014) + confidence. behavior, not cause (A013). A016 mask caveat.
        ✔ backtest re-filed as STEP-5 evidence (regime_routing_backtest.ipynb): routing CAN beat flat
            +18% OOS (tail protection) — the proof Step-5 forecasting is worth building.
        → next: intuitive-name review w/ team · dashboard color-by-regime + chronic-vs-storm read · revisit A016
        → forecast + adjustment layers come AFTER — the regime is just the foundation they plug into
   3. Step 4 — validate, don't rebuild
   4. Step 5 + the Step 3→5 bridge — research frontier, gated on (2)
   5. Dashboard rebuild — last (full frontend revamp; teammate UI input lands here)

 governing principle: do not tune a step until the upstream series MEANS
                      what we think it means.
```

---

## Document map — step → docs / code / notebooks

| Step | Code | Methodology / discussion | Plan | Notebook |
|---|---|---|---|---|
| 1 Eventize | `price_engine/data/02_construct_events.py` | `event_catalog_creation_methodology.md` · `dicsscssion/eventization_frequency_contract/` | `inner_event_shape_confidence_plan.md` | `event_duration_bucket_analysis` |
| 2 Per-customer | `pipelines/per_customer_rate/compute_per_customer_lambda.py` | `per_customer_pricing_fundamentals.md` · `per_customer_view_walkthrough.md` | `plan/done/…per_customer_pricing` | `per_customer_rate_phase1` |
| cell read | — (no artifact) | `02_underwriter_confidence_framing.md` · `03_inner_event_shape_diagnostics.md` | `inner_event_shape_confidence_plan.md` | `inner_event_shape_diagnostics` |
| 3 Clustering | regime_classification (stats rule tree); `county_trend`/`county_predictability` legacy | **`03_risk_clustering/README.md`** (start here) · `regime_classification_methodology.md` · `05_source_coverage_mask.md` | `regime_routing_backtest_plan.md` · `done/…quantification_plan` | `regime_classification` ✔ · `source_coverage_mask_analysis` · `05_forward_regime/regime_routing_backtest` (Step-5 evidence) |
| 4 Location | `extra/location_features/.../build_density_relativity.py` | `location_basis_methodology.md` · `dicsscssion/location_aware_outage_pricing/` | `location_basis_research_plan.md` | `.../03_density_relativity` |
| 5 Forward | — (not built) | `learning_logs/` · `extra/hazard_modeling/` | `forward_looking_modeling_plan.md` | `.../02_outage_cause_distribution` |

> Paths are current. The `methodology/` + `plan/` reorg into step subfolders updates
> this table and the per-step pointers in the same pass.
