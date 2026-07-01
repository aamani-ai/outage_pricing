# Outage Pricing — Modeling Q&A, Assumptions & Caveats

> **Purpose.** Read this once and you should be able to answer almost any "why did you do it this way?" about the outage-pricing model — and know exactly where the model is soft. This is the **bridge doc**: it ties the step map to the atomic assumption registry with a narrative Q→A plus a first-class, honest caveats section.
>
> **Audience.** Carriers, external actuaries, internal teammates, and future-us.
>
> **Status.** v0 production model — applied model layers (per-customer baseline, location, routed forward) + placeholder layers (grid), as shipped to the dashboard.
> **Last reviewed.** 2026-07-01.

**Contents.**

```
   0  How to use this doc + the 3-doc system (+ glossary)
   1  What we price — the product and the one formula
   2  Data foundation — EAGLE-I, events, denominators, time
   3  County frequency — the base everything multiplies
   4  Per-customer conversion — the share-out
   5  Risk clustering — regime (behaviour, not cause)
   6  Forward / statistical forecast — frequency only
   7  Weather / climate — the challenger (Sarasi EOF model)
   8  Location basis — within-county density relativity
   9  Loadings & governance — who sets what
  10  Portfolio / concentration — mean correct, tail not
  11  CAVEATS & honest limitations (C-1…C-14)  ← the point of the doc; start with the QUICK MAP
  12  What we'd improve / not yet robustly tested
      Appendix — cross-reference index
```

> **In a hurry?** Read the §11 QUICK MAP (direction-of-bias table) — it is the one-screen summary of where the model is soft.

---

## 0. How to use this doc + the 3-doc system

There are three documents and they do not overlap. Use whichever answers your question:

```
            WHAT / WHERE                          THE ATOMIC RULES                    THE NARRATIVE + HONESTY
  ┌─────────────────────────────┐      ┌──────────────────────────────┐    ┌──────────────────────────────┐
  │ OUTAGE_MODELING_FRAMEWORK.md │      │ docs/methodology/assumptions.md│    │  THIS DOC                    │
  │ the STEP MAP                 │ ───▶ │ the stable-ID REGISTRY         │ ──▶│  MODEL_QA_AND_CAVEATS.md     │
  │ 5 backend steps + cross-cut  │      │ A001 … A026 (all registered)   │    │  Q→A + caveats that tie       │
  │ each w/ an honesty question  │      │ cite by ID, never restate      │    │  the other two together       │
  └─────────────────────────────┘      └──────────────────────────────┘    └──────────────────────────────┘
```

- **`OUTAGE_MODELING_FRAMEWORK.md`** — the step map. Five backend steps (eventize → per-customer → clustering → location → forward) plus cross-cutting cell-read, each paired with an honesty question.
- **`docs/methodology/assumptions.md`** — the registry. Every assumption has a stable ID (A001 … A026). We **cite by ID, never restate** — the registry is authoritative for wording.
- **This doc** — the narrative. A plain-language Q→A for each layer, a single consolidated caveats section, and a cross-reference index.

**How to read an answer.** Each Q→A carries a **STATUS tag** and **cross-references** (assumption IDs, file paths, notebook/output, external links).

```
STATUS vocabulary  (the dashboard badge shows the same word)
  active       in the composed premium today                     (badge: green "active")
  modeled      composed into the premium, an estimate            (badge: amber "modeled")
  placeholder  not plugged in; holds at ×1.00, moves no price    (badge: hollow grey ring)
  diagnostic   notebook-only; no artifact wired into pricing
  not-built    planned, no code wired
```

**Glossary** (load-bearing terms used below; defined once here so the doc reads standalone):

```
  WAPE        Weighted Absolute Percentage Error — Σ|actual−pred| / Σ|actual|. The forecast-error
              metric behind §6/§7; lower = better. (Weights by volume, so big-count years dominate.)
  EOF         Empirical Orthogonal Functions ≈ PCA on a space-time weather field; "PC1/PC2" are the
              leading two components used as features in Sarasi's weather model (§7).
  Forward "experts" (the per-regime forecast methods, §6):
    wtd_recent   exponentially-weighted recent mean (α≈0.6) — leans on recent years, smooth
    capped_lin   linear-slope extrapolation, magnitude-capped — for a persistent drift
    persist      last observed year's count carried forward — for an abrupt level
    flat         the full-period mean (the baseline the experts must beat)
  λ_county/λ_customer   the county event rate / the per-customer rate after the share-out (§4)
  S(T)        survival fraction — share of events lasting ≥ T hours
  MCC         ORNL Modeled County Customers (the static modeled customer count per county, §2)
  MGA         Managing General Agent (InfraSure, under delegated underwriting authority, §9)
  PSPS        Public Safety Power Shutoff (utility-initiated wildfire de-energization, §9–§10)
```

> **Two things to know before anything else** (both are real and partly contradictory across sources):
>
> 1. **One premium everywhere — no "shadow."** The engine (`web/lib/pricing/compose.ts`) composes `baseline × location × routed-forward × loadings`, and **both** the Studio and the outward Pricing view now price on it (the outward page reads `/api/studio` and applies the same factors — 2026-07-01). Location and the routed forward (statistical, or the **weather** challenger where it wins the backtest — §7) are **applied**, as `modeled` factors. Layer maturity is expressed as **confidence** (location is pilot-calibrated; weather is a routed challenger), never as a not-priced "shadow" status. Grid is still a `placeholder` (×1.00).
> 2. **Registry now runs A001–A026** (extended 2026-06-30 in the docs consolidation): **A022/A023** register the location cap + validation status (previously "defined-in-use"); **A024/A025/A026** register the eventization knobs (gap-merge / restoration / min-duration) that had been *mis-citing* A005/A006/A007 — that ID collision is now fixed.

---

## 1. What we price — the product and the one formula

**Q: What is the product?**
A: An annual parametric outage policy. *"If an outage in your FIPS lasts ≥ T hours, we pay you $X."* `T` = trigger/deductible duration (hours); `X` = per-event payout (dollars). v0 quotes the **annual retail premium**, not a single-event price. The offered grid is `{2,4,8,12,24}h × {500,1000,2500,5000,10000}` = 25 cells/county; **T=8h is the primary trigger.**
STATUS: **active**. Cite: `docs/methodology/cross_cutting/pricing_methodology.md`.

**Q: What is the one formula?**
A: There is exactly one, and it lives in one place (`web/lib/pricing/compose.ts`):

```
premium = λ_customer(T) × location_relativity × forward_factor × X ÷ (1 − ER − TM)
          └─ expected loss (pure premium) = adjustedRate × X ─┘   └─ retail gross-up ─┘
```

The engine is **pure** (same inputs → same output, no I/O) and **fails loud**: it throws on non-finite/negative `lambdaCustomer`, `X ≤ 0`, `relativity ≤ 0`, `factor ≤ 0`, and `1 − ER − TM ≤ 0`. The single engine replaced an old dashboard that duplicated the math 5× — ending that divergence is the stated reason it exists. Stated discipline: *"A crash you notice today beats a wrong premium discovered in three weeks."*
STATUS: **active**. Cite: `web/lib/pricing/{compose.ts,types.ts,README.md,compose.test.ts}`; `docs/principles/structural_verification.md`.

**Q: What is the layer underneath λ_customer?**
A: The county math:

```
λ_county(T) = N_per_year × S(T)          N_per_year = events/yr ;  S(T) = fraction of events lasting ≥ T
Pure premium = λ(T) × X
Retail       = (Pure + UncLoad) / (1 − ER − TM)        UncLoad = 0 in v0 (A006)
```

`S(T)` is a **raw empirical** survival fraction — no fitted distribution (A005).
STATUS: **active**. Cite: A005, A006; `pricing_methodology.md`.

**The factor stack and each layer's status:**

```
LAYER          SYMBOL                 STATUS (outward quote = Studio — one premium)
─────────────────────────────────────────────────────────────────────────────────────
Baseline       λ_customer(T)          active   (headline)
Location       location_relativity    modeled  (applied; pilot-calibrated, capped 0.80–1.40)
Forward        forward_factor         modeled  (applied; routed frequency expert × grid)
  ├ statistical  stat                 governs most counties
  ├ climate      weather (EOF-XGB)    governs the 16 backtest winners; else the shown challenger
  └ grid         ×1.0                 placeholder (planned)
Loadings       ÷ (1 − ER − TM)        active
```

Omitted location/forward default to a neutral `1.0` (tested by an IDENTITY canary). The band `{low, point, high}` carries through the same factors **linearly** (`bandDriver ∈ {'confidence','placement-widened','none'}`).

> **Want every layer threaded into one number?** A single county (Honolulu, FIPS 15003) is traced end-to-end — mask → λ_county → per-customer → regime → location → band → premium, with real values at each hand-off — in `docs/methodology/cross_cutting/end_to_end_worked_example.md`. The Boone MO example in §4 stops at the per-customer retail (before location/forward); use the Honolulu trace to see the full composed Studio premium.

**Q: What does a policy actually pay on — the county or my address?**
A: A **county-level** parametric trigger. If *the county* records an outage event ≥ T hours, the policy pays $X. It does **not** verify the specific insured address lost power — county is the only spatial unit in the data (§2). This is real basis risk; the per-customer and location layers narrow it but do not remove it.
STATUS: **active**.

**Q: Why is λ "per customer" when the trigger is a whole county?**
A: This is the central modeling move. Raw `λ_county(T)` is a county-event rate; the policy is sold per customer. Pricing the county rate to one customer over-charges by **~30–100×**. v0 scales it down by the customer-impact multiplier: `λ_customer = λ_county × E[mean_customers/base | duration ≥ T]` (§4).
STATUS: **active — headline**. Cite: A009/A010/A011; A018.

**Q: Why divide by (1 − ER − TM) instead of adding a markup?**
A: It grosses the pure premium up so expense and margin are a fixed *fraction of the retail price*, not of the loss cost. Defaults ER=0.20, TM=0.15 → denom 0.65 → ~1.538×. Configurable 0–40% each.
STATUS: **active**. Cite: A006.

**Q: Why no uncertainty load?**
A: `UncLoad = 0` in v0 — the slot is reserved but empty, so v0 retail is "pure premium grossed up," not an uncertainty-adjusted price. Filling it is a v0.5 change.
STATUS: **placeholder slot**. Cite: A006.

---

## 2. Data foundation — EAGLE-I, events, denominators, time

**Q: What is the base data source?**
A: **EAGLE-I** (ORNL), the only public, national, multi-year, county-level US power-outage record.

```
Provenance   Figshare article 24237376 (DOI 10.6084/m9.figshare.24237376)
Coverage     2014-11-01 04:00 UTC → 2026-01-01 00:00 UTC  ≈ 11.167 effective observation years
Resolution   15-minute county-level snapshots; ~3,090 reporting counties
Scale        ~250 GB uncompressed across 12 yearly files
Paper        Brelsford, Tennille, Myers et al., Sci Data 11, 308 (2024), doi:10.1038/s41597-024-03095-5
```

Two tables joined: a **snapshot table** (`fips_code | customers_out | run_start_time`, an instantaneous count, not cumulative) and a static **MCC reference** (one modeled customer count per county).
STATUS: **active** (sole base source). Cite: A001–A004; `eagle_i_data_fundamentals.md`; `price_engine/data/INVENTORY.md`.

**Q: Why reconstruct events instead of trusting PNNL's pre-merged files?**
A: PNNL's merge rules (gap tolerance, threshold, min duration) are undocumented to us. v0 needs event boundaries to be *our explicit, written-down choice* — *"when someone asks why this 90-minute gap became two events, the answer is in our code, not someone else's."* DOE OE-417, NOAA Storm Events, EIA-861 SAIDI/SAIFI and PRESTO are all deliberately **not** used as the base layer (wrong granularity, cause-attribution, or forward-simulator scope).
STATUS: **active**. Cite: `data_ingestion_methodology.md`; `INVENTORY.md`.

**Q: What exactly is an "event"?**
A: A derived layer — one row = one continuous outage in one county — built deterministically per-FIPS by walking snapshots in time order, on three knobs:

```
1. Onset / threshold   snapshot included iff customers_out > 0  (no min count, no %MCC)   (A002)
2. Gap-merge           new non-zero snapshot within G minutes of restoration → merge       ← largest discretionary choice
3. Min-duration        events < 15 min (one snapshot) retained but flagged as artifacts
```

Catalog scale (verified, the **shipped `eagle-i-45min` catalog**): **13,190,684 events across 3,090 FIPS**. Duration hours: min 0.25, p50 1.75, mean 4.54, p95 14.0, p99 41.5, max 9,088. (The 30-min catalog has 14.2M events, the 60-min 12.4M — the sensitivity spread; only 45-min is on the dashboard.)
STATUS: **active**. Cite: A002; `event_catalog_fundamentals.md`; `events_meta.json`.

> **Three gap-merge catalogs exist; the dashboard ships exactly one.** `-30min / -45min / -60min` are built so the gap-tolerance sensitivity is surfaced, not hidden. The dashboard **builds from and ships `eagle-i-45min` only** (`build_data.py: CATALOG = "eagle-i-45min"`; `pricing.json` / `studio.json` both carry `"catalog":"eagle-i-45min"`), so **`G = 45 min` is the shipped default** — consistent with the methodology prose. The 30/60-min catalogs are computed for sensitivity but not wired into the dashboard. (Each catalog's own `events_meta.json` correctly records its own `G`; there is no shipped ambiguity.)

**Q: How do you handle time?**
A: Three interval assumptions:
- **A001** — every `run_start_time` is treated as a **UTC** instant (no offset in the raw data); avoids DST artifacts.
- **A003** — each 15-min snapshot is the half-open interval `[t, t+15min)`; `end_time = last snapshot + 15 min`. Without it, single-snapshot events would have duration 0.
- **A004** — the annualization denominator is the **single global** observation window (≈11.167 yr), **not** per-county first/last event date, **not** a naive 12 calendar years. A naive 12-yr denominator would understate λ by ~12/11.167 = **7.5%**.
STATUS: **active**. Cite: A001, A003, A004.

**Q: What number divides into `customers_out` to get the share — and why not raw MCC?**
A: **Not raw MCC.** MCC (ORNL Modeled County Customers) is a static 2023 model — `c_{u,i} = p_{u,i} × (C_u/P_u)` (EIA-861 customers × LandScan pop ÷ HIFLD territory) — and it is broken in a long tail (Henderson NC = 24 customers in a 120k-person county; ~30% under-count in seasonal-home counties). The validated denominator is a conservative composite (A018):

```
cap_ref = max(MCC, housing_units)                               best estimate
base    = max(MCC, housing_units, observed_peak_out)            ≥ homes, ≥ utility count, ≥ worst outage
EXCLUDE if observed_peak_out > 1.5 × cap_ref                    numerator corrupt → would UNDER-price → no quote
per-event customer fraction capped at 1.0                       (in the lambda pipeline)
```

Census **housing units (ACS B25001)** — not households (occupied-only, B11001) — because an electric customer is a *meter* and every home including seasonal/vacation has one (housing up to ~4.6× households in the Adirondacks/Sierra). `MCC ≈ 1.10 × housing units` (log-log r = 0.976).

```
CONUS denominator outcome (verified, customer_base.csv, 3,257 rows)
  mcc_ok          1,856     keep MCC
  housing_floor     935     MCC under-counted seasonal homes
  peak_floor        335     observed peak forced the floor up
  excluded          131     peak_exceeds_base → declined, not quoted
```

**Direction of bias: conservative for the insurer.** `base` is the larger of the candidates → if anything *under-states* the true count → slightly *over-prices*; the cap can only lower the share-out; exclusion catches the dangerous under-pricing direction.
STATUS: **active**. Cite: A008, A018; `price_engine/data/build_customer_base.py`.

**Q: Why not use EAGLE-I's `total_customers` column as the denominator?**
A: **Evaluated and rejected (A019).** `total_customers` (2024 inline) and `MCC.csv` (2022 side-file) are the **same ORNL model** — same `c_i = p_i × (C/P)` allocation — so they share the same failure, running **both ways**: too small (Henderson 24; San Francisco −45%; Hoonah-Angoon −21×) AND too big (Berkshire 284,790; Staunton 36,366). A naive `max(MCC, total_customers)` is unsafe — `max()` can pick the inflated one → under-price. Kept as a **QC cross-check only, never the divisor.** Housing's known weakness (high-vacancy shore/resort counties — Cape May 59% vacant, housing 99k vs ~56k accounts) is documented; two refinements (vacancy haircut; housing-primary where MCC over-states) are parked pending a proper EIA-861×HIFLD allocation.
STATUS: **research, A018 stands**. Cite: A019; `notebooks/02_per_customer/customer_base_denominator_eval.ipynb`.

**Q: What is a "customer" — a person, a household?**
A: Almost always a **metered account**, but per Brelsford et al. utilities define it *"in a range of different ways, most typically the electric meter, a building, or a facility."* So one "customer" can be a house, a data center, or a master-metered apartment block. The ratio `customers_out/MCC` is internally consistent *within* a utility's territory (same convention top and bottom) but carries cross-utility unit-noise. Convenient alignment: the EAGLE-I "customer" ≈ one billed meter ≈ the natural underwriting unit (one policy per metered entity).
STATUS: **active**. Cite: A008.

> ⚠ **Citation inconsistency to reconcile.** The MCC source paper is cited three ways across docs: Brelsford et al. 2024 (Sci Data 11:308), Moehl et al. 2023, and Moehl et al. 2024 (Sci Data 11:271). These should be reconciled before the doc ships externally.

---

## 3. County frequency — the base everything multiplies

**Q: How do you turn raw events into an annual county rate?**
A: `λ_county(f,T) = (n_events_total / observation_years) × S(T)`, where `S(T) = |events ≥ T| / |all events|`. Raw empirical, no fitted curve.
STATUS: **active**. Cite: A004, A005; `compute_per_customer_lambda.py`.

**Q: Why no parametric (Weibull / Lognormal / GPD) duration curve?**
A: Empirical S(T) is *"defensible, auditable, and non-parametric — the regulator-friendly baseline."* Parametric extensions are deferred to v0.5+ as challengers with backtest evidence. The cost: counties with thin data have noisy S(T) at long T (pure variance, no systematic direction; surfaced via the modelability filter).
STATUS: **active**. Cite: A005.

**Q: How is the displayed price band computed — and why is it so wide?**
A: This is an **OPEN decision.** All three candidates carry **linearly** through the formula, so the **point premium is identical**; only `low`/`high` change.

```
                  METHOD                        QUESTION IT ANSWERS              MEDIAN WIDTH
  v1  confidence   bootstrap of the MEAN rate    "how precisely do we know       ±19%   ← SHIPS TODAY
                                                   the average?"
  v2  experience   empirical p10/p90 of years    "how much does an actual        ±53%
                                                   YEAR swing?"
  v2b experience   empirical p25/p75 of years    "the middle HALF of years"      ±27%
```

```
Width distribution (T=8h · 3,032 counties · eagle-i-45min)
  band width            v1 conf   v2 p10/p90   v2b p25/p75
  ±<5%  absurdly tight     3%          0%           2%
  ±5–15% tight            32%          4%          18%
  ±15–25% reasonable      34%         10%          25%
  ±25–45% wide            23%         26%          33%
  ±>45% very wide          7%         60%          22%
```

Why a simple Poisson interval is wrong: outages **cluster** (one storm → many correlated outages), so annual-count variance ≫ Poisson mean — median dispersion `var/mean = 5.0` at T=8h (12.6 at T=2h), **94% of counties overdispersed** (A017; `08_band_pressure_test.md`). Why v1↔v2 is structural not a knob: a bootstrap of the *mean* is the standard error of the average ≈ spread/√years; with ~11 years, √11 ≈ 3.3 → the experience band is ~3× wider **by construction** (A017 measures median ~2.9× at T=8h, 0.38 → 1.07).
STATUS: **v1 active — estimator under review**. Cite: A017; `docs/dicsscssion/dashboard_redesign/08_band_pressure_test.md`. See §11 C-4 for the honest direction-of-bias.

---

## 4. Per-customer conversion — the share-out

**Q: Why isn't a county event rate the right number to quote a single insured?**
A: λ_county answers "how often does a qualifying outage happen *anywhere* in the county?" The customer needs "how often do **I** lose power?" — much smaller, because most county events affect only a portion of customers. We multiply by the average share affected:

```
multiplier(f,T)     = mean over qualifying events of ( mean_customers_out(e) / base )
λ_per_customer(f,T) = λ_county(f,T) × multiplier(f,T)
```

This lowers the per-customer expected-loss number by **~30 to 100×** depending on the county (the Phase-1 figure was wider, 100×–4000×). Per-event fraction is capped at 1.0.
STATUS: **active — headline**. Cite: A009; `compute_per_customer_lambda.py`.

```
Worked example — Boone County, MO (T=8h, X=$5,000, 45-min catalog)
  MCC                 121,913
  λ_county(8h)        79.8765 /yr
  multiplier_mean     0.2632%  (0.002632)
  λ_customer(8h)      0.210211 /yr        → an outage ≥8h roughly once every 5 years (1/0.21)
  Pure @ $5,000       $1,051.05 /yr
  Retail              $1,617.01 /yr       (median → $159.63 · max → $3,860.32)
```

**Q: Why the MEAN of the per-event share, not the max?**
A: The payout reflects a customer's own outage experience during the event — closest to the **time-averaged** share, not the peak instant. Median and max are published as sensitivities (median = robust to outlier storms, usually 3–5× smaller; max = the average event at its peak, usually 5–7× larger). Alachua FL T=4h: `mean 0.000333` vs `max 0.002113` (5–7×). If max is the more honest reading (outages NOT staggered), the headline is understated by 5–7×.
STATUS: mean **active — headline**; median/max **active — sensitivities**. Cite: A010.

**Q: What single assumption is the whole per-customer chain resting on?**
A: The **synchronous-outage approximation (A011)** — `mean_customers` is treated as one persistent set of M customers out for the full event, so a random customer's P(out ≥ T) = M/base. EAGLE-I publishes 15-min **counts, not customer identifiers**, so synchronous-vs-staggered cannot be distinguished from this dataset alone. This is the **single load-bearing assumption** the per-customer layer adds. See §11 C-1 for the full direction-of-bias treatment (a conservative ~2–3× cushion — but from a handful of worked cases + one PoUS probe, **not a guaranteed floor**: it is eroded by C-2 coverage dilution in poorly-covered counties, and it does NOT protect the tail).
STATUS: **active — shipped with documented data constraint**. Cite: A011.

**Q: When do you refuse to surface a per-customer price?**
A: Three gated states on qualifying-event count:

```
not_available   base missing/excluded  OR  n_qualifying(T) < 10
caution         n_qualifying(T) < 100  OR  n_total < 500
available       otherwise  (≥100 qualifying AND ≥500 total)
```

Caution cells are "direction-only" — most likely to swing across the 30/45/60-min catalogs.
STATUS: **active**. Cite: `compute_per_customer_lambda.py`.

> ⚠ **Stale "shadow" labels in older code/docs.** The 2026-05-30 walkthrough and the `compute_per_customer_lambda.py` docstring still call per-customer "shadow / not used in v0." The newer fundamentals doc, A009/A010/A011, and the shipped engine all treat it as the **live headline** — those older strings are stale. Likewise the pipeline docstring describes a superseded `households × 1.324` denominator repair; the live logic is the A018 composite. Cite the A018 composite, never the `×1.324` figure.

---

## 5. Risk clustering — regime (behaviour, not cause)

**Q: What does clustering decide, in one line?**
A: *"We type a county's long-outage behaviour only when the data earns it — stable, trending, shifted, or storm-spiked — and we say 'insufficient' (with the reason) when it doesn't. It's an identity, not a forecast, and it moves no price."*
STATUS: **built — router only, moves no price**. Cite: A013–A016; `03_risk_clustering/README.md`.

**Q: What are the regimes?**

```
stable        steady, mean-reverting noise; the long-run mean is the honest summary   (DEFAULT)
trend         a real persistent slope; a fitted line beats the mean
shift         jumped to a new level and held it (≥3 post-years)
episodic      one/two storm-spike years that REVERT; rare (~1.5%), most UW-critical
insufficient  the honest abstention (NOT a behaviour); reasons: short-history / low-volume / recent-change
```

```
Distribution (T=8h, verified against county_regime_T8.csv, 3,090 counties)
  stable        1306   42.3%
  trend          718   23.2%
  shift          675   21.8%
  insufficient   344   11.1%   (low-volume 129 · recent-change 125 · short-history 90)
  episodic        47    1.5%
```

**The actual gates** (significance-gated tree, evaluated in priority order — so the "defensible
line-by-line" claim is self-contained here; full spec in `regime_classification_methodology.md` §4):

```
  0. GATES      n_obs < 5 → insufficient/short-history · total < 15 → insufficient/low-volume
                constant series → stable
  1. EPISODIC   (peak_share ≥ 0.40 OR top2_share ≥ 0.60) AND the spike REVERTS (last yr < 0.6·peak)
                AND the de-peaked remainder has no significant slope
  2. SHIFT      a changepoint with ≥3 post-jump years   (a 1–2 yr jump → insufficient/recent-change)
  3. TREND      |OLS t-stat| ≥ 2.5  AND  sign(OLS) == sign(Theil–Sen)   (robust, persistent slope)
  4. STABLE     none of the above fire  (DEFAULT)
```

Tests are on **shape, not magnitude** (a 300/yr and a 30/yr county classify by the same logic), and every
typed (non-stable) label must clear a statistical-significance test, not a hand-picked cutoff.

**Q: Why behaviour-only — why not feed weather / grid age / hazard maps?**
A: Behaviour is observable in the counts; cause is not required to detect it and is **defensible to a carrier with no climate model in the room**. Cause data enters later (Step 5) as a forecasting expert the regime routes to — never load-bearing for routing.
STATUS: **active**. Cite: A013.

**Q: Why a rule tree, not unsupervised ML clustering?**
A: We *assign* counties to known, named behaviours (a classification) rather than *discover* unknown groups. The categories are pre-defined and intuitive, the tree is defensible to a carrier line-by-line, and shape-based (not magnitude-based) tests classify a 300/yr and a 30/yr county by the same logic. Adversarial verification confirmed the gates are not knife-edge: ±20% threshold perturbation churns **≤8% of labels**, all boundary-adjacent.
STATUS: **active**. Cite: methodology §4.

**Q: Why one label at T=8h, not one per trigger?**
A: Data thins hard at high T (nationwide qualifying events: 2h≈6.6M, 8h≈1.5M, 24h≈0.27M ⇒ ~1–2 events/county/yr — a `(0,1,2,1,0)` series). Classifying trend/shift/episodic on a 0–2 integer series is noise, not signal. 8h is the sweet spot (~44 events/county/yr, low boundary noise). A cross-T stability flag (`xT`, `stab4`) carries the honesty; cross-T agreement ≈ **0.60** (moderate, not rigid). The `intensifies@longT` flag catches counties like Baldwin AL (steady short outages but storm-driven long ones).
STATUS: **active, partially validated**. Cite: A014.

**Q: Why does the model sometimes refuse to label?**
A: *"Abstain, don't force."* For thin / near-zero / recently-changed counties the evidence can't support a label; forcing one produces confident WRONG labels (an earlier draft mislabeled Cherry NE `[0,2,4,0,22,39]` as a "trend"). ~11% land in `insufficient`.
STATUS: **active**. Cite: A015. See §11 C-3 for the "two faces of insufficient" surfacing rule.

**Q: Does the regime move the price?**
A: **No.** It is descriptive, and is consumed downstream as the **routing key** for the Step-5 forward factor (itself an applied, routed model factor) and for dashboard views.
STATUS: **router only**.

---

## 6. Forward / statistical forecast — frequency only

**Q: Is there a forward (next-year) adjustment?**
A: Yes — the **statistical "stat" factor**, the stat in `FORWARD = stat × climate × grid` (climate and grid are ×1.0 placeholders, so the forward factor today *is* the stat factor). It is a per-county, regime-routed forecast of next-year **frequency**, expressed as a multiplier on the full-period mean:

```
stat_factor(fips,T) = clip( 1 + (max(1, forecast/λ_full) − 1) × credibility , 1.0, 1.5 )
  · forecast    = the regime's expert run on the county's own ≥T annual history
  · λ_full      = full-period mean (the untouched baseline audit anchor)
  · ONE-DIRECTIONAL (uplift or hold, never discount)   · CREDIBILITY-SHRUNK (thin → ×1.0)
  · CAPPED +50%   · ABSTAIN on `insufficient` (→ ×1.0)   · ASYMMETRIC LOSS (under-pred penalised ~3×)
  · the +50% cap is a v0 face-validity throttle (no single year should move the priced rate >1.5×),
    not a fitted bound — deliberately conservative pending OOS validation; 18% of cells hit it at T=8h

Method per regime (shipped):  stable→wtd_recent · trend→capped_lin · shift→capped_lin
                              episodic→persist · insufficient→persist
T=8h calibration:  median ×1.15 · mean ×1.20 · 70% uplift · 18% at the cap   (stat_forward_factor_model_card.md)
```

STATUS: **modeled (applied)** — built, calibrated, composed into the premium (Studio + outward quote). Cite: A020, A021; `web/lib/data/forward.ts`; `stat_forward_factor_model_card.md`.

**Q: Why a router instead of one method everywhere?**
A: The county-specificity principle — avoid both one-method-for-all and per-county-everything. The regime (Step 3) is the routing key; the estimator is the machinery.
STATUS: **active**. Cite: A020; `docs/principles/county_specificity.md`.

**Q: Why one-directional (uplift or hold, never discount)?**
A: `λ_full` is biased low by the EAGLE-I coverage ramp (see §11 C-5), so honest corrections are upward. Declining counties keep the higher mean as cushion. Under-reserving is the dangerous error → asymmetric loss penalises under-prediction ~3×. Discounting is a documented future refinement.
STATUS: **active design**. Cite: A020; `model_to_the_consequence.md`.

**Q: Does the forward expert vary by trigger T?**
A: No (first-order). Routed by **county regime alone** (one per county, A014); only the per-T input series varies. `regime × T` routing is a **v1 candidate (promoted 2026-06-30)** but adopted only where it earns a stable OOS win. The session analysis shows the trigger dimension is **INERT for statistical-expert selection** (see §12 D-3).
STATUS: regime-only routing **active**; cluster×T **in-scope candidate, not adopted**. Cite: A021.

**Out-of-sample skill (national, the basis for the IDEA):** regime-routed experts beat the flat mean — typical-cell WAPE **0.356 → 0.257, +27.7%**, wins in **66% of cells** (rolling-origin, 14,383 county-cells). **Read with C-5: ~2/3 of this apparent skill is the EAGLE-I coverage ramp, not a causal forward signal — so genuine forward skill is roughly one-third of the headline +27.7%.** Quoted standalone, the +27.7% and 66% over-state real forecasting skill ~3×.

```
Per-regime best expert (median WAPE)
  stable        wtd_recent  0.280
  trend         persist     0.218   (capped_lin 0.225)
  shift         persist     0.224   (wtd_recent 0.235)
  episodic      persist     0.833   ← near-hopeless
  insufficient  wtd_recent  0.458
```

> ⚠ **Shipped-mapping discrepancy.** The raw equal-weight backtest (`best_expert_by_regime.csv`, `model_card.md`) picks `trend→persist, shift→persist`. The **shipped** factor (A020 / `stat_forward_factor_model_card.md`) uses the coverage-stable, asymmetric-loss selection `trend→capped_lin, shift→capped_lin`. The model card notes "asym weight is a minor knob (magnitude is structural)." **Cite A020 / the model card as authoritative for the dashboard; footnote the CSV disagreement** — do not silently merge them.

**THE BIG HONEST CAVEAT** (verbatim, A020): *"~2/3 of the apparent forward 'skill' is the EAGLE-I coverage ramp, not a causal forward signal."* See §11 C-5 — this is one of the most important caveats in the whole model.

---

## 7. Weather / climate — the challenger (Sarasi EOF model)

**Q: What is it, and is it in pricing?**
A: Sarasi's **EOF-XGB event-count residual model** (`ve7_res`), the first hard challenger to the statistical baseline. It predicts per-county annual event counts by duration from weather features (leading 2 EOF principal components + elevation + log population density + year). It is **backtest-only — not built into pricing.** No live weather forecasts are wired.

```
Run-at-a-glance
  Region    Northeast, 189 counties (excludes the "stably bad grid" chronic cluster)
  Target    monthly event-count rate residual per duration bucket → annual
  Train     2015–2022     Test 2023–2025
  Models    XGB (primary), GLM (weaker)
  Features  PC1, PC2, elevation, log pop-density, year trend  (EOF v1)
```

STATUS: **not-built into pricing / challenger under evaluation**. Cite: `docs/dicsscssion/forward_expert_routing/00_README.md`; `docs/extra/sarasi_weather_outage_model/`.

**Q: What is the verdict — does weather beat our routed-stat?**
A: **No, not on what we can score.** Scored on ONE shared observed (the two pipelines' observed counts agree: corr 0.997–0.999, median ratio 1.000), NE-189 × {4,8,12,24}h × test years 2023–25:

```
Pooled WAPE (lower = better)
  routed_stat   0.152   ← OUR baseline
  linear        0.168
  xgb (weather) 0.194   ← 27% WORSE than routed-stat (20% worse on the fair 2023-only slice)
  flat          0.198
  glm           0.236

Routed-stat wins every regime (2023-only):  trend −36% · shift −31% · stable −13% · insufficient −3%
  (the insufficient margin −3% is within noise, not a clean win)

Per-county (pooled over triggers): weather beats routed-stat in 71/189 (38%), 45 by ≥10%,
  overwhelmingly STABLE (55 of 71). Many "wins" flip sign year-to-year = noise, so we gate for
  durability: wins ALL 3 test years AND ≥5% margin → exactly 16 counties (14 stable + 2 shift):
  Saratoga/Chenango/Rensselaer/Seneca/Rockland/Cortland/Tioga NY, St. Mary's MD, Chittenden VT,
  Grafton/Sullivan NH, Union PA, Androscoggin/Waldo ME, Hudson NJ, Kent RI. These are the routing map.
```

**Mechanism:** weather beats the naive flat/trend baselines (matching Sarasi's own finding) but **not our regime-ROUTED stat** (persist for trend/shift, wtd_recent for stable). The router exists *because* routed stat already beats flat/trend.
STATUS: statistical preferred overall; the **16 durable winners are routed to weather, which governs their price**. Cite: `notebooks/05_forward_regime/weather_vs_stat_routing/` (`outputs/routing_map.csv`, `outputs/weather_factor.json`).

**Q: How is the weather model used in the dashboard?**
A: As a **per-county router**, applied — not shadow. The forward factor is a routed choice between two frequency experts: for each county the router uses whichever won the 2023–25 backtest. In the **16 durable winners the weather factor governs the composed forward and prices** (statistical stands down); everywhere else the statistical expert governs and weather is shown as the challenger the router didn't pick; the chronic-grid cluster is excluded. The Studio → Forecast detail shows both experts' forecasts (annual event count + 90% band + factor) and the routing verdict, with the chosen one flagged as governing. The internal dashboard shows the **final composed premium** — the chosen forecast is the one that prices; there is no separate shadow. Applied in the Studio and the Analytics national batch via `routedForward()` (`web/lib/pricing/compose.ts`); reader `web/lib/data/weather.ts`; artifact `web/lib/data/forward/weather_factor.json` (300 NE counties → 16 weather / 173 statistical / 111 excluded). The backtest fit will be swapped for a **live current-year forecast** when Sarasi delivers one (ask #3); the routing mechanism is unchanged.
STATUS: applied (per-county router). See §12 D-2, A021.

**Q: What would we need before using the weather model?**
A: Three things, in order:
1. **An episodic-county test outside the Northeast.** NE-189 has **0 episodic counties** (episodic lives in the interior West — KS/WY/UT/ND/MT; 47 nationally, ~1.5%). Episodic is weather's *best theoretical case* and this comparison cannot reach it.
2. **A coverage-clean re-score** — both sides train on the ramp years; score on a coverage-stable footing.
3. **Live weather wiring** + an exposure (not counts-only) evaluation; a separate `_vc7_res` exposure model exists.
STATUS: pending. See §12 D-2 (and the C-14 caveat in §11).

> **Net framing for a carrier:** on what we can score (NE-189, counts-only, 3 coverage-ramp-contaminated test years, **0 episodic counties**), the regime-routed statistical baseline beats the EOF weather challenger 27% pooled and wins every regime (insufficient by only −3%, within noise). But this comparison **cannot reach weather's one theoretical edge — episodic** — so it is not a verdict on weather in general. And because ~2/3 of the stat "win" is itself a coverage-artifact correction (§6), a future weather model could still become the first *genuine* forward signal even though it loses this round — its episodic edge is exactly the case we can't yet test.

---

## 8. Location basis — within-county density relativity

> **Assumption IDs (now registered, 2026-06-30).** The location layer's two governing assumptions are **A022 (cap = policy throttle)** and **A023 (validated CT/MA/RI only)** — both **now in `assumptions.md`**. The location docs also use an **LB-1…LB-4** namespace for finer internal points (mean-1 · ALAND · within-county-density · town-grain); those are self-consistent but not yet folded into the A-series (a low-priority follow-up).

**Q: What does location basis do?**
A: It **redistributes** the per-customer rate *within* a county by population density split into within-county terciles (rural / mid / urban), each mapped to a multiplicative relativity. `price_location = price_per_customer × relativity(tercile, T)`. It owns the within-county *redistribution* only; the county baseline + per-customer layer own the *level*.
STATUS: **modeled (applied)** — composed into the premium (Studio + outward quote); `validated:false` everywhere outside the pilot (confidence is pilot-grade, bounded by the cap). Cite: `docs/methodology/04_location_basis/location_basis_methodology.md`; `compose.ts`.

**Q: Why a multiplier, and why within-county rank not absolute density?**
A: A multiplier matches expected-loss math, preserves the county baseline (mean-1 → county total unchanged), composes cleanly across payouts/durations, and avoids double-counting county rurality (already in λ_county). Within-county rank because the county baseline already carries overall rurality — location basis is only the residual. *"A density of 50/km² is 'rural' inside dense Fairfield County but near-average inside rural Litchfield."*
STATUS: **modeled**. Cite: `docs/methodology/04_location_basis/location_relativity_factor_derivation.md` §3.

```
The relativity table (relativity_table.json) — empirical → v0_shadow, cap [0.80, 1.40]
  T threshold   rural emp → v0       mid emp → v0      urban emp → v0
  1h            1.762 → 1.448        1.125 → 1.163     0.789 → 0.827
  2h            1.775 → 1.419        1.187 → 1.203     0.753 → 0.811
  4h            1.900 → 1.402        1.227 → 1.228     0.708 → 0.801
  8h            2.058 → 1.372        1.296 → 1.270     0.640 → 0.784
  (T≥8h reuses the T8 factors; the 0.80–1.40 cap is a confidence throttle, NOT the signal size)
```

**Three v0 governance controls:** monotone (rural ≥ mid ≥ urban, physics prior), mean-1 renormalization (the `renormalizeMeanOne` firewall — location can only redistribute, never move the county total), and the attribution-confidence cap `[0.80, 1.40]`. The cap is set **deliberately tighter than the raw empirical signal** (raw rural 1.76–2.06×): a v0 face-validity throttle that ships only ~±40% of an unvalidated within-county effect, not a fitted bound — chosen conservatively pending the outcome validation it doesn't yet have.

**Validation — honest:** the signal is **real and structural** on the only region with sub-county outcomes (PoUS, CT/MA/RI, Jan–Mar 2019): within-county Spearman **ρ = −0.35** (median over 24 counties, Jan–Mar 2019 only), 22/24 counties negative, sign-test **p = 1.79e-5**; the tail survives a ≥3-event filter and credibility shrink. **But it is one region, one quiet season** — every other county is nationally extrapolated, not independently validated.
STATUS: applied everywhere (capped); outcome-validated CT/MA/RI, nationally extrapolated elsewhere. See §11 C-8.

**The known flaw + the fix:** population density mis-ranks dense commercial cores — Midtown Manhattan reads **p13 ("rural")** and would wrongly get an uplift. The fix is a **symmetric, conservative zonal-mean NLCD impervious % guardrail** (a veto on contradictions, not a replacement): Type A (density-rural but built-up → reclassify urban → discount) fires only on a strong signal; Type B (density-urban but not built-up → higher premium) is deliberately conservative ("discounts require stronger evidence than uplifts"). The calibration notebook is built and executed, and the guardrail is **live** — the Studio API (`/api/studio`) applies it on demand.
STATUS: fix built + **applied** (guardrail live in the pricing API). Cite: `notebooks/04_location_basis/location_basis_calibration.ipynb`; `web/app/api/studio/route.ts`.

> **Assumption IDs.** **A022** (cap = policy throttle) and **A023** (validated CT/MA/RI only, `validated:false` elsewhere) are now registered (2026-06-30). Note the dashboard code historically cited the range "A018–A023" for location; A018/A019 are actually the per-customer *denominator* — location is A022/A023. The finer **LB-1…LB-4** namespace in the location docs is self-consistent but not yet folded into the A-series (low-priority follow-up).

---

## 9. Loadings & governance — who sets what

**Q: How are loadings applied?**
A: `Retail = (Pure + UncLoad) / (1 − ER − TM)`, defaults ER=0.20, TM=0.15, UncLoad=$0. At defaults the gross-up is `1/0.65 ≈ 1.538×`. ER/TM are configurable sliders (0–40%); the engine fails loud if `1 − ER − TM ≤ 0`. These are **placeholder commercial assumptions** in a reasonable SMB range — not yet carrier-filed.
STATUS: **active**. Cite: A006; `compose.ts`.

**Q: Who decides ER/TM, eligibility, limits — the carrier or the underwriter?**
A: The core governance insight: **rules are BOUNDS, the underwriter picks VALUES.** The carrier holds capital and eats losses → sets the bounds (Rules Engine, locked); InfraSure (the MGA, under delegated authority) picks values inside them (Studio); the policyholder sees a read-only quote (Pricing).

```
PARAMETER     CARRIER (Rules Engine) — the BOUND        UNDERWRITER (Studio) — the VALUE
  Margin        target margin ≥ X%  (a floor)             chosen TM (≥ floor)
  Expense       expense allowance ≤ Y%  (a cap)           chosen ER (≤ cap)
  Discretion    max manual load ±L%                       actual per-county load + reason
  Eligibility   excluded territories                      cannot override — refer / decline only
  Limit         max line / location, min premium          quoted payout (within cap)
```

Shipped house defaults (`web/lib/rules.ts`): `expenseCap 0.25, marginFloor 0.15, triggerMinHours 6, triggersOffered [8,12,24]`.
STATUS: **active (display)**. Cite: A006; `rules_engine_governance/00_…md`; `rules.ts`.

> ⚠ **Bounds are displayed context, not a runtime clamp.** `rules.ts` states "NOT enforced in code this pass (no hard clamp)." And: **no carrier has handed InfraSure a rules table** — every governance bound shown today is an InfraSure house default, not a filed carrier rule. The Rules Engine marks each field real / house-default / scaffold and says so plainly.

---

## 10. Portfolio / concentration — mean correct, tail not

**Q: Why standalone per-policy, no portfolio aggregation?**
A: Expected portfolio loss is **concentration-invariant** (linearity of expectation), so v0 is **correct on the mean**. Variance and tail are **not**: under true joint-trigger correlation the portfolio variance blows up O(N).

```
Worked example  (N=100 policies in one county, p=0.30, X=$500)
                      Independent (v0 implicit)     True joint-trigger
  E[total loss]       $15,000                       $15,000   (UNCHANGED)
  Var[total loss]     $5,250,000                     $525,000,000
  SD[total loss]      ≈ $2,291                       ≈ $22,913   (10× larger)
  Tail                ~0 prob all 100 hit            30% prob all 100 hit → $50,000 single-year loss

  Var ratio = N (linear) ;  SD ratio = √N ;  the $50k loss is ROUTINE, not a freak tail
```

The A011 cushion lives on the **mean** and adds **zero** to portfolio variance — *"a 3× cushion on EL does not blunt a 10× SD blow-up."* This is the one place v0's conservative-on-the-mean posture does **not** help. Latent at SMB scale (1–3 policies/county); bites first in hazard-prone counties as the book scales.
STATUS: assumption **active**; concentration machinery **not-built** (lagged-implementation track). Cite: A007; `concentration_and_portfolio_risk.md`.

**Activation trigger (a threshold, not a date):** any hazard-prone county with N ≥ 10, OR a book passing 1,000 total policies. Until then: track exposure-per-FIPS even though it isn't priced. Treatment paths (none built): concentration loading → portfolio YLT (AAL/OEP/TVaR) → reinsurance/capital.

---

## 11. CAVEATS & honest limitations (first-class, not a footnote)

This is the point of the doc. Each caveat names the **direction of bias** — which way it's wrong, and whether that is safe (conservative for the insurer) or dangerous (anti-conservative). Two biases pull opposite ways and partly cancel (C-1 cushion vs C-2 dilution) — that cancellation is itself unvalidated.

```
QUICK MAP — direction of bias
  CONSERVATIVE (safe; over-prices/over-reserves)        ANTI-CONSERVATIVE (dangerous; under-prices)
    C-1  per-customer synchronous approx (~2–3×)          C-2  global-window coverage dilution
    C-4  experience band (wider)                          C-4  v1 confidence band (~2.9× too tight)
    C-5  forward stat factor (uplift)                     C-9  no portfolio tail (O(N) variance)
    C-8  location cap + Type-B guardrail                  C-3  survivorship skew toward "stable"
                                                          (B-context) bounds not enforced in code

  UNKNOWN direction (cannot yet sign the bias)
    C-13  no systematic external back-test (EIA-861 SAIDI/SAIFI, after-action reports)
```

### C-1 — A011: per-customer rests on a synchronous-outage approximation
The single load-bearing caveat. EAGLE-I gives 15-min counts, not customer identifiers → synchronous vs staggered cannot be distinguished. **Direction: OVERESTIMATE = conservative.** Realistic "core + periphery" outages → the multiplier overstates the per-customer rate ~**2–3×** (worked cases show ~3×; an extreme periphery-churn case ~13×). The knife-edge exception (durations clustered exactly at T) is the only regime that understates and has no physical reason to occur. It is a **free cushion, not a designed one**, it sits on top of the loads, and it is **bounded by market-price discipline**. Critically, it **only insulates the mean — no protection against tail/variance (that is C-9).** Resolution: PowerOutage.US per-OutageId data (Phase 4); a PoUS probe found `sync_ratio 1.00 → 0.53 @ 8h` (the share-out over-states the persistently-out set ~2×). Cite: A011.

### C-2 — A012: per-customer exposure uses ONE global window → dilutes partial-coverage counties
**Direction: UNDERSTATEMENT = anti-conservative (under-pricing).** This pulls **opposite** to C-1 — in poorly-covered counties it **erodes the A011 cushion**. A county truly observed ~8 of ~12 yr is ~1.4× understated (Concho TX, 2016 interior gap, ~1.2×; Texas 2016 has 135/254 counties with zero source events). Detection is shipped (the cell-read now computes per-county `C_source` so affected cells read "Thin" not falsely "Strong"); the **fix (per-county observed years) is a pending pricing decision, not yet wired.** Cite: A012.

### C-3 — A016: the coverage mask is a cross-resolution proxy, applied to the T-specific series
The all-duration coverage onset mask is applied unchanged to the ≥8h series, discarding ~1,469 county-years that still carried a non-null T=8h count — **772 nonzero, ~3,073 genuine ≥8h events**, concentrated 2015–2017. **Direction: removes early events → survivorship skew toward "stable"/flat for ramp counties.** A permutation test confirms the mask is **not** the source of routing skill (skill collapses to ≈−10% under shuffled targets with the mask in place). OPEN: derive a T-specific coverage signal before the actuarial-consultant ship. Cite: A016.

### C-4 — A017: the premium band estimator is UNDER REVIEW
**v1 (bootstrap of the mean, "confidence") ships today and is ~2.9× too tight at the median** — it contradicts the year-to-year-bounce framing the dashboard itself tells. A Poisson-on-count band is rejected (overconfident ~2×, up to 8–10× for storm-prone counties; 94% overdispersed at T=8h). The experience band (p10/p90) is **wider = conservative** but **conflates trend**, and the p25/p75 variant has a trap: it trims the storm-year tail → can **under-reserve** (the dangerous direction for outage insurance, where storm years are the thing being priced). For thin counties (<5 yr; 43 zero / 76 tiny at T=8h) the band is unreliable → route to `insufficient`, suppress the point quote. Decision pending team feedback. Cite: A017.

### C-5 — A020: the forward stat factor is ~2/3 a COVERAGE-RAMP ARTIFACT, not forecasting skill
Verbatim: *"~2/3 of the apparent forward 'skill' is the EAGLE-I coverage ramp, not a causal forward signal."* Among counties observed every year, typical relative level: 0.55 (2015) → 0.94 (2018) → 1.25 (2025) — a near-uniform +70% jump by 2018 = reporting ramping up, not real outages. Drop 2015–2017 and flat-mean bias falls **−17% → −6%.** So the shipped stat factor is *"largely a per-county coverage/level correction labelled as forward,"* honestly "recent experience vs the long-run mean," not a clean prediction. **Direction: uplift → over-reserve → conservative.** It is applied (it moves the price), but that conservative direction — plus the cap, credibility shrink, and abstain — keeps it safe. The trap: a future climate/grid challenger "beating the stat baseline" is partly beating a data artifact (this is why §7 frames weather's loss carefully, and why weather governing the 16 is a routing choice, not a claim it's a cleaner signal). Cite: A020; `forward_router_became_baseline_cleanup.md`.

### C-6 — A008: MCC is a non-uniform customer unit on a static 2023 vintage
A "customer" is usually a meter but sometimes a building/facility (per each utility's EIA-861 convention) → cross-utility unit noise. Three failure modes: customer-growth drift since 2023 (biases the multiplier **up** → over-states), allocation error where LandScan is a poor density proxy (bias **varies by county**), and the non-uniform unit. The ratio is internally consistent *within* a utility's territory. Cite: A008.

### C-7 — A006: loadings are placeholder commercial values; UncLoad is $0
ER=0.20, TM=0.15, UncLoad=$0 are placeholder SMB assumptions, not carrier-filed. The reserved UncLoad slot is empty → v0 retail is "pure premium grossed up," **not** uncertainty-adjusted. Cite: A006.

### C-8 — Location (A022/A023): pilot-calibrated, nationally extrapolated, NOT validated
`validated: false` **everywhere today** — calibrated only on the CT/MA/RI pilot (one quiet season, town-grain). Every other county is nationally extrapolated, not independently validated. The guardrail thresholds are v0 physics + face-validity, **not fit on outcomes**; the cap is a confidence throttle, not the signal (raw rural 1.76–2.06×). **Direction: mean-1 means it only redistributes (never moves the county total); the cap and Type-B guardrail are conservative** (over-charge an ambiguous location rather than under-charge), but Type B may over-penalize leafy, well-served tracts (an accepted, flagged anti-policyholder bias). A022/A023 are **not yet in the registry** — see the §8 flag. Cite: A022, A023 (pending registration).

### C-9 — A007: no portfolio tail — v0 gets the mean right, NOT the tail
**Direction: anti-conservative on the second moment.** Expected portfolio loss is concentration-invariant (v0 correct on the mean), but under true joint-trigger `Var ≈ N²·p(1−p)·X²` (O(N) blow-up; SD O(√N)). The A011 cushion lives on the mean and does **not** blunt the concentration tail. Latent at SMB scale; bites first in hurricane belts / storm corridors / PSPS fire zones as the book scales. Cite: A007.

### C-10 — The high-premium tail is REAL frequency, not a bug
Top counties (Doddridge WV 44.8 ≥8h events/yr, Clay WV 72.9, Hamilton NY 44.7) are **frequency-driven**, not denominator-driven — the worst-reliability rural counties (Appalachia, Adirondacks, Sierra PSPS, USVI), robustly measured over 11 yr. **Reframe: this is an ELIGIBILITY/product question, not a pricing bug.** When λ_customer ≈ 1/yr, premium ≈ 1.5× payout — no risk transfer left; the trigger T is the lever (Doddridge: T=2h→2.62/yr, T=8h→1.04/yr, T=24h→0.39/yr). Distinct from the A018/A019 denominator artifact (which produced the $50k–$3M garbage premiums). Cite: `high_frequency_county_eligibility/00_the_high_premium_tail.md`.

### C-11 — Eventize: gap-tolerance sensitivity not yet quantified per cell
Gap tolerance 30/45/60 min splits/merges events; the effect is threshold-dependent and **not yet quantified per cell**. Restoration is **inferred** (a drop to 0), not observed; one mis-reported zero can split one real event into two; sub-15-min events are invisible (biases counts down). Cite: A002, A003; §2.3 caveats.

### C-12 — Severity and exposure are NOT forecast
v0 forecasts **frequency only** (counts). The forward layer does not predict per-event severity, customer exposure, or dollar loss. The parametric payout `X` is fixed by contract, so severity is bounded — but any future move to exposure-weighted pricing needs the `_vc7_res`-style exposure model, untested here. Cite: A009 (frequency × fixed payout); §7.

### C-13 — No back-validation against EIA-861 / utility after-action reports yet
Reconciliation against independent reliability data (EIA-861 SAIDI/SAIFI, utility after-action reports) is currently "eyeballed" in v0 — not a systematic external back-test. **Direction of bias: UNKNOWN.** Every other caveat here is internal consistency or internal backtest; this is the only place the model is checked against an *independent* source, and it isn't yet. **→ a systematic external bias of unknown sign and size remains undetectable until this back-test is built** — which is why it sits in the QUICK MAP as the lone UNKNOWN-direction item despite reading as a short caveat. Cite: `pricing_methodology.md` §Known limitations.

### C-14 — Weather challenger evaluated NE-only; the episodic case is untestable here
The Sarasi EOF-XGB weather model was scored only on NE-189 counties, counts-only, over 3 coverage-ramp-contaminated test years (2023–25). It loses to routed-stat 27% pooled — but **0 of those counties are episodic**, and episodic (rare storm-spike, interior West) is weather's *one theoretical edge*. So "weather loses" is a verdict on this footprint, **not** on weather in general. **Direction of bias: cannot be signed** — the comparison can't reach the regime where weather might win. Cite: §7, §12 D-2.

---

## 12. What we'd improve / not yet robustly tested

The honest open-validation roadmap. Nothing here is a pricing change yet.

### D-1 — Forward Step 5 is NOT built (the research frontier)
Plans exist; hazard infra exists but is disconnected; **no climate/grid overlay wired** (both ×1.00 placeholders). The Step 3→5 bridge (predict the annual **residual**, not raw counts; the cluster label gates which forward method is allowed) is unbuilt. An enriched cause-tagged event source is unbuilt (PoUS cause coverage ~24%, below the ~80% gate).

### D-2 — Weather (Sarasi EOF-XGB) vs routed-stat — applied as a per-county router
Routed-stat beats weather **27% pooled** (20% on the fair 2023 slice), wins every regime (insufficient by only −3%, within noise). Weather's genuine theoretical edge — **episodic counties — is untested** (NE-189 has none). The analysis is committed (`notebooks/05_forward_regime/weather_vs_stat_routing/`, `.py`+`.ipynb`+`outputs/`), and the verdict is **applied**: a per-county router (`routedForward()`, `web/lib/pricing/compose.ts`) uses whichever expert won the backtest, so the **16 durable winners are routed to weather and it governs their composed forward** (Studio + Analytics batch); elsewhere statistical governs and weather is shown as the challenger. Still open before leaning harder on weather: an episodic test outside the NE, a coverage-clean re-score, **a live current-year forecast** (the shipped fit is a backtest fit, to be swapped when Sarasi delivers), and an exposure (not counts-only) evaluation. Numbers in §7; findings in `docs/extra/sarasi_weather_outage_model/new_jun_30/`.

### D-3 — Cluster vs cluster×trigger granularity — trigger axis is INERT for stat selection
The best statistical expert flips by trigger in only **8% of (regime,T) cells** (only at T=24h in thin shift/insufficient buckets); stable→wtd_recent and trend→persist at every trigger. OOS gain of cluster×T over cluster ≈ **0%** (national pooled 0.1811 vs 0.1812). Conclusion: regime-only granularity is validated and well-reasoned; the trigger dimension is inert for statistical-expert selection (the experts are scale-free recency/persistence operators — regime picks the operator, trigger just rescales the count). The trigger dimension matters for the **weather-vs-stat routing decision, not** for stat-expert selection. Registered in A021.

### D-4 — Other named tracks
```
A011  measure the empirical staggering bias via PoUS per-OutageId data (Phase 4)
      → output: confirmation within the sensitivity band, OR an empirical correction factor
A012  replace the global denominator with per-county observed years (pending pricing decision)
A016  derive a T-specific coverage signal before the actuarial-consultant ship
A017  land the band estimator decision (confidence vs experience p10/p90 vs p25/p75)
LOC   VALIDATE (don't rebuild) location; cap-widening gated on validation;
      A018/A019 parked refinements (vacancy haircut; housing-primary where MCC over-states)
ELIG  carrier-set λ_customer eligibility gate + trigger-T restructure for the high-frequency tail
A007  build concentration loading + portfolio YLT once the activation threshold trips
CELL  emit the read-only fips×T cell-read artifact (Phase 2); wire proxy posture to A011
DOCS  ✓ DONE 2026-06-30: registered A022–A026 + fixed the A005/A006/A007 ID collision (eventization
      knobs → A024/A025/A026); archival consolidation (done/ + _archive/ across dicsscssion/plan/methodology).
      Remaining: reconcile the MCC source-paper citation (Brelsford 2024 = EAGLE-I vs Moehl 2024 = MCC model);
      reconcile best_expert_by_regime.csv (persist) vs the shipped model-card mapping (capped_lin);
      drop the stale "deck needs refresh" canary in web/lib/pricing/README.md (deck is current, 2026-06-28);
      fold the location LB-1…LB-4 namespace into the A-series; refresh the framework's stale Step 4/5 labels.
```

### The principles that keep us honest
```
communicate_to_share      shareability IS the deliverable; a dropped load-bearing caveat is a defect
model_to_the_consequence  loss is asymmetric — under-reserve = solvency risk (penalise ~3×);
                          conservative default = the cheap-error direction; abstain when unsure
county_specificity        not one-size-fits-all, not one-rule-per-county; the craft is the right grouping
structural_verification   tests/asserts/FAIL-LOUD; the dominant risk in fast-moving LLM-built code
                          is a SILENT wrong number
reproducible_from_lake    every number rebuilds from the GCS lake; one env switch flips local↔GCS
```

---

## Appendix — cross-reference index

```
CLAIM / LAYER                         ASSUMPTION   EVIDENCE (notebook / doc / code / external)
─────────────────────────────────────────────────────────────────────────────────────────────────
One premium formula                   —            web/lib/pricing/{compose.ts,types.ts,README.md,compose.test.ts}
Timestamps are UTC                    A001         eagle_i_data_fundamentals.md
Onset threshold (customers_out > 0)   A002         event_catalog_fundamentals.md ; events_meta.json
Snapshot = [t, t+15min)               A003         event_catalog_fundamentals.md
Global 11.167-yr annualization        A004         annualization_meta.json (11.16723705224732)
Empirical S(T), no fitted curve       A005         pricing_methodology.md ; compute_per_customer_lambda.py
Loadings ÷(1−ER−TM); UncLoad=0        A006         compose.ts ; rules.ts ; rules_engine_governance/00_…md
No portfolio correlation (mean-only)  A007         concentration_and_portfolio_risk.md
MCC modeled, non-uniform unit         A008         eagle_i_data_fundamentals.md ; Brelsford et al. 2024 (Sci Data 11:308)
λ_customer = λ_county × multiplier     A009         per_customer_pricing_fundamentals.md ; compute_per_customer_lambda.py
Mean (not max) share-out              A010         per_customer_pricing_fundamentals.md
Synchronous-outage approximation      A011         per_customer_view_walkthrough.md ; PoUS Phase 4
Coverage-dilution understatement      A012         the cell-read C_source ; assumptions.md
Regime is behaviour-based             A013         03_risk_clustering/regime_classification_methodology.md
One regime at T=8h + cross-T flag     A014         notebooks/outputs/regime_classification/county_regime_T8.csv
Abstain-don't-force (insufficient)    A015         03_risk_clustering/README.md
Coverage mask = cross-res proxy       A016         dicsscssion/eventization_frequency_contract/05_source_coverage_mask.md
Premium band (open decision)          A017         dicsscssion/dashboard_redesign/08_band_pressure_test.md ; web/scripts/build_data.py
Housing-anchored denominator          A018         price_engine/data/build_customer_base.py ; customer_base.csv
total_customers rejected as divisor   A019         notebooks/02_per_customer/customer_base_denominator_eval.ipynb ; Moehl et al. 2024
Forward stat factor (regime-routed)   A020         web/lib/data/forward.ts ; stat_forward_factor_model_card.md
Regime-only routing; cluster×T cand.  A021         dicsscssion/forward_expert_routing/00_README.md ; session analysis
Location cap = policy throttle        A022 (TBD)   location-detail.tsx ; location_basis_dashboard_plan.md  (PENDING REGISTRATION)
Location validated CT/MA/RI only      A023 (TBD)   location.ts ; shared.ts (validated:false)               (PENDING REGISTRATION)
Weather EOF challenger (not built)    A020/A021    docs/extra/sarasi_weather_outage_model/ ; weather_vs_stat_routing/ (scratchpad)
High-frequency tail = eligibility     —            dicsscssion/high_frequency_county_eligibility/00_the_high_premium_tail.md

External  EAGLE-I  Figshare 24237376, DOI 10.6084/m9.figshare.24237376 ; Brelsford et al., Sci Data 11:308 (2024)
          MCC      Moehl et al. 2024, Sci Data 11:271 (PMC10915145) ; EIA Form 861 ; LandScan USA ; HIFLD territories
          Census   ACS B25001 (housing units), Gazetteer ALAND, TIGERweb ; NLCD (impervious/canopy)
          Weather  Sarasi EOF-XGB, run ve7_res (EOF v1: PC1/PC2 + elevation + log pop-density + year)
```

> **Open items still needing a human decision:** (1) MCC source-paper citation (Brelsford 2024, Sci Data 11:308 = EAGLE-I, vs Moehl 2024, 11:271 = the MCC allocation model — confirm which is cited where); (2) `best_expert_by_regime.csv` (persist) vs the shipped model-card mapping (capped_lin) for trend/shift; (3) fold the location `LB-1…LB-4` namespace into the A-series; (4) drop the stale "deck needs refresh" canary comment in `web/lib/pricing/README.md`.
>
> **Resolved 2026-07-01:** the **weather challenger is APPLIED** as a per-county router — it governs the forward factor (and prices) in the 16 durable NE winners, statistical elsewhere (§7, A021, `routedForward()`); the **outward Pricing quote now composes the same factors as the Studio** (one premium everywhere — it reads `/api/studio`); and **"shadow" terminology was purged** — location + forward are *applied* (maturity stated as confidence: location pilot-calibrated, weather a routed challenger), not a not-priced shadow status.
>
> **Resolved in the 2026-06-30 consolidation:** the **A005/A006/A007 ID collision** is fixed — the eventization knobs are now **A024 (gap-merge) / A025 (restoration) / A026 (min-duration)**, and **A022/A023** (location cap + validation) are registered (registry now A001–A026); the **gap-merge default is 45 min** (dashboard ships `eagle-i-45min` only; 30/60-min are unwired sensitivity catalogs); the §2 event/duration stats were corrected to the shipped 45-min catalog; the methodology **deck is current** (refreshed 2026-06-28); and the discussion / plan / methodology folders were archived into `done/` + `_archive/` with cross-references repaired.
