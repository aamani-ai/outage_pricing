# Location Basis — End-to-End Methodology

- **Status:** v1 shipped as a **shadow** read (map mode + matrix view + address lookup); not active pricing.
- **First written:** 2026-06-18
- **Last reviewed:** 2026-06-18
- **Read alongside:** [Per-Customer Pricing](../02_per_customer/per_customer_pricing_fundamentals.md), [Pricing Methodology](../cross_cutting/pricing_methodology.md), [Location Relativity Factor Derivation](location_relativity_factor_derivation.md), [Assumptions Registry](../assumptions.md), and the workstream [`docs/extra/location_features/`](../../extra/location_features/) (build scripts + findings).

## Why this file exists

The policy is sold for a **specific location**, but our outage history is
**county-level**. Location basis is the layer that bridges that gap: it asks,
*"given the county's rate, is THIS location above, at, or below its county
average?"* This document is the canonical reference — from the granularity basics,
through a brand-new kind of input data (Census), to exactly how we compute it and
how it moves the price, and an **honest account of what is validated, what is
not, and the work still ahead.**

If you have five minutes: read **§1 (the ladder)**, **§3 (the chain)**, and
**§7 (validation — what works / what doesn't)**.

---

## 1. The granularity ladder — where location basis sits

Pricing is built as a credible base rate times a stack of named modifiers. The
*spatial grain* sharpens at each step:

```text
  EAGLE-I county          per-customer              WITHIN-COUNTY            premise
  outage rate       →     (customer_impact)   →     location basis     →     (future)
  λ_county(T)             λ_customer(T)              × relativity             point / meter
  ───────────────         ─────────────────         ───────────────          ────────────
  national, validated     national, shipped         THIS LAYER · shadow      not built (needs
  (the backbone)          (~30–100× smaller)        pilot-validated          live geometry / AMI)
```

The pricing stack, multiplicatively:

```text
λ_location(T) = λ_county(T) × customer_impact × location_basis
```

- **`λ_county(T)`** — county qualifying-event rate (EAGLE-I). The backbone.
- **`customer_impact`** — county-event view → the *average customer's* expected
  experience (shipped; see [per-customer fundamentals](../02_per_customer/per_customer_pricing_fundamentals.md)).
- **`location_basis`** — **this layer**: redistributes that per-customer average
  *within* the county. A customer in a rural pocket runs above the county average;
  one in a dense, undergrounded core runs below.

**Load-bearing property — conservation.** `location_basis` is **mean-1,
exposure-weighted, within each county**. It *redistributes* risk inside a county;
it does **not** change the county total (that is the job of `λ_county` and
`customer_impact`). This is what keeps it from double-counting the layers beneath
it. (Assumption **LB-1**.)

---

## 2. The data — and why Census is a new *kind* of source

Until now the engine used essentially one source: **EAGLE-I** (outage *outcomes*),
plus MCC. Location basis introduces **geographic / demographic reference data** —
a different species of input. It is the first time we join external **feature**
data (land area, population, boundaries) to the price, rather than outage
outcomes.

| Dataset | Grain | Role | Free? | Runtime or calibration |
|---|---|---|---|---|
| **EAGLE-I** | county | outage baseline `λ_county` | yes | runtime (backbone) |
| **PowerOutage.US (PoUS)** | town × utility | the within-county **validation outcome** (NDA trial) | trial | **calibration only** |
| **Census Gazetteer** | town / tract | **land area** (`ALAND`) → the density denominator | yes | runtime feature |
| **Census ACS (5-yr)** | tract | **population** → the density numerator (national) | yes (API key) | calibration (build-time) |
| **Census TIGERweb** | tract | tract **geometry** (drill-in, point→tract) | yes (CORS) | runtime (browser) |
| **Nominatim (OpenStreetMap)** | address | **address → lat/lon** (geocoding) | yes (CORS) | runtime (browser) |
| **NLCD** (tree canopy, impervious) | 30 m raster | **tried** as proxies — see §7 | yes | not used (canopy) / future (impervious) |

### What is "CONUS" data?

**CONUS = the Conterminous (lower-48) United States + DC.** NLCD rasters and our
national ACS tract pull both cover CONUS — that is the **2,916 counties / ~81,000
tracts** the national map colors. **Alaska, Hawaii, and Puerto Rico** are separate
Census/NLCD products and are **not in v1** (they grey out). So when this doc says
"national," it means **CONUS**.

### The validated vs. national split (important)

- The **relativity itself** (the price factor) is validated **only on the PoUS
  pilot: CT / MA / RI, Jan–Mar 2019**. Inside the dashboard those counties are
  marked **validated**.
- The **national map** extends the *descriptive* within-county density read to all
  CONUS counties (ACS tracts) and **extrapolates** the relativity there — labeled
  **extrapolated / shadow**. It is *not* independently validated outside the pilot.

---

## 3. The chain at-a-glance

```text
  address                       "lat, lon"
     │ geocode (Nominatim)          │ parse
     └──────────────┬───────────────┘
                    ▼
            point (lon, lat)
        ┌───────────┴────────────────────────────┐
   point-in-polygon                          TIGERweb
   over Census counties                      point → tract
        │                                         │
        ▼                                         ▼
   county FIPS                              tract  ──►  density = population / land-area (km²)
        │                                                    │
        │ per_customer_view.json                             │ rank within the county's units
        ▼                                                    ▼
   per-customer price                          tercile:  rural · mid · urban
   (λ_customer × X / load)                             │
        │                                              ▼
        │                                   location relativity  (mean-1, capped)
        └───────────────────┬──────────────────────────┘
                            ▼
              LOCATION PRICE = per-customer price × location relativity
```

The county is resolved by **point-in-polygon over the same county polygons the map
and `per_customer_view` use** (so it always matches the pricing data, including
the legacy-county CT case — see §10). The within-county *position* comes from the
tract's density rank.

---

## 4. How density is calculated

Density is our proxy for **rurality** — really, for *grid exposure*: long overhead
radial feeders through trees (rural) vs. undergrounded, looped, crew-dense
networks (urban). We cannot observe the grid, so we proxy it:

```text
density(unit) = population / land_area_km²            (Census ALAND, land only — excludes water)
```

Two estimators, same idea, different grain:

| Where | Numerator | Denominator | Source |
|---|---|---|---|
| **Pilot** (CT/MA/RI) | PoUS customers tracked in the town | town land area | PoUS + Gazetteer |
| **National (CONUS)** | ACS-2022 tract population | tract land area | ACS + Gazetteer |

Worked: an ACS tract with population 4,075 and land area 81.3 km² →
`density = 50.1 people/km²` (rural). A dense Manhattan residential tract →
~30,000/km² (urban). We use **log₁₀(density)** throughout, because density spans
~5 orders of magnitude and outage exposure tracks the *order of magnitude*, not
the linear value.

> **Why land-only (`ALAND`)?** A town that is 60 % lake should not read as
> "low-density rural" because of the water. `ALAND` excludes water. It still
> includes uninhabited forest — correct in direction for rurality, but it conflates
> "few people" with "much wild land." (Assumption **LB-2**.)

---

## 5. The three categories (terciles)

Within **each county**, rank its units (towns nationally→tracts) by density and
split into thirds:

```text
   within-county density rank
   0% ────────────── 33% ───────────── 67% ────────────── 100%
   │     RURAL        │      MID         │      URBAN        │
   │  (sparsest 3rd)  │                  │  (densest 3rd)    │
   relativity > 1     │   ≈ county avg   │   relativity < 1  │
```

**Why *within-county*, not absolute density?** The county baseline already carries
the county's overall rurality. Location basis is only the *residual* — how a
location compares to **its own county**. Using absolute density would double-count
the county level and break the mean-1 conservation (LB-1). A density of 50/km² is
"rural" inside dense Fairfield County but near-average inside rural Litchfield.
(Assumption **LB-3**.)

---

## 6. How it affects the price — the relativity

Each tercile maps to a multiplicative **relativity** — the actuarial expression of
the layer. It is fit on the pilot, made **monotone** (denser → lower, the physics
prior), **renormalized to mean-1**, then **capped** for *attribution confidence*
(how confidently we can place a specific address in the tail — not the signal
size).

For the audit trail behind these factors — including the exact scripts, output
artifacts, and the Spearman significance check — see
[Derivation of Location Relativity Factors](location_relativity_factor_derivation.md).

| density tercile | empirical (T≥4h) | v0 shadow (capped 0.80–1.40) |
|---|---|---|
| **rural** (sparsest) | 1.90× | **1.40×** |
| **mid** | 1.23× | 1.23× |
| **urban** (densest) | 0.71× | **0.80×** |

(Empirical spread is larger — p90 ≈ 1.9× — and **widens with duration** (rural
≈ 2.1× at T≥8h). The cap is the deliberate v0 throttle, not the data.)

The final price, composed on the **per-customer** base (never the over-priced
county-trigger base):

```text
location price = per-customer price × location_basis relativity
```

**Worked example — New Haven County, CT (validated):**

```text
per-customer retail  (T = 4 h, X = $2,500)   ≈ $303
  × urban relativity 0.80   →   ≈ $243      (dense, undergrounded part of the county)
  × rural relativity 1.40   →   ≈ $425      (wooded, radial-feeder part)
```

A customer's address within New Haven County could see ~$243–$425 for the same
contract, depending on its within-county location — a span the single county
number hides. **Where you see it:** the map (`color by → Location basis`), the
drill-in (click a county → its sub-units shaded rural→urban), and the matrix
**"Location-adjusted"** view + the **"Price a location"** address box.

---

## 7. Validation — honest: what works, what doesn't

Validated against the one dataset that resolves below county grain: **PoUS,
CT/MA/RI, Jan–Mar 2019** (the only region with sub-county outage *outcomes*).

### ✅ What works

| Finding | Evidence |
|---|---|
| The within-county signal is **real and structural** | worst-cell/county-avg p90 ≈ 1.9× and **survives** an ≥3-event filter + credibility shrink (not sampling noise) |
| **Density predicts** the within-county relative | within-county Spearman ρ(density, relative) = **−0.35** (24 counties, T≥4h); robust to the metric definition |
| **Face validity** | the uplift tail is rural/wooded/exposed towns (Bethany, Glocester, Aquinnah); the map's rural=red / urban=blue gradient is clean; per-county exposure-weighted mean ≈ **1.00** (conservation holds) |

### ⚠️ What does NOT work (and we keep, honestly)

| Tried | Result | Why we did not adopt it |
|---|---|---|
| **NLCD tree canopy** | partial ρ(canopy \| density) ≈ **0** | NE canopy saturates (median 68%) — it can't discriminate rural vs urban *within* a county; density already captures it |
| **NLCD impervious (point)** | within-county ρ = **−0.20** vs density's −0.35 | a town **centroid** is 0%-heavy (lands in undeveloped land) and a single 30 m pixel is noisy (road = 94%, lawn = 0%) — too noisy as an aggregate proxy |
| **Population density in commercial cores** | **mis-ranks** them | Midtown Manhattan read **p13 ("rural")** — few *residents*, but the most urban, undergrounded grid there is. Pop density measures residents, not built intensity. **This is a real flaw** (see §8) |

### Honest limits of the validation

- **One region, one quiet season** (a single nor'easter). All national numbers are
  **provisional extrapolation** until replicated (e.g. Texas, a storm season).
- **Cell/town grain, not premise.** We measure a town's exposure, not a verified
  individual address. The town→premise last mile needs live outage geometry / AMI
  (the whole ecosystem is downstream of utility-published maps, which stop at
  town/case grain). (Assumption **LB-4**.)
- **NE-specific proxy.** "Density alone" is validated in New England; in low-tree
  regions other drivers (wind, ice, terrain) may matter more.

---

## 8. Known limitation + the work still ahead (we will do this)

**The flaw, stated plainly:** the national extrapolation uses **population**
density, which **under-ranks dense commercial / low-residential cores** — they can
read as "rural" and wrongly get an uplift. It bites only the *unvalidated, shadow*
national layer in big-city downtowns; it does **not** touch the validated pilot.
But it is wrong, and we will fix it.

**The fix — and it is real work:** replace point/population density with a
**zonal mean of NLCD impervious surface (or developed land-cover) per tract.**
Impervious is the right signal — at a true point, Midtown reads **94 %** and rural
Litchfield **3 %** — but it must be a **tract zonal mean**, not a point sample
(point impervious failed in §7 precisely because a single pixel is noisy).

```text
proposed:  built_intensity(tract) = mean( NLCD impervious % over the tract's pixels )
           → replaces / blends with population density in the within-county rank
```

This needs **raster zonal-statistics over the CONUS NLCD impervious raster**
(GB-scale download + `rasterio`/zonal-stats over ~81k tracts) — heavier than any
point sample, which is why it is **scheduled, not skipped**. It is the right time
to do it when location basis graduates **shadow → active** and earns national
outcome validation. Tracking: [`docs/extra/location_features/`](../../extra/location_features/),
experiment `impervious_experiment.py`.

> A cheap partial guard exists for the **address** feature specifically (where we
> have a real point, not a centroid): clamp the rural uplift when the queried
> address sits on high-impervious land. Optional, address-only.

---

## 9. The architecture (so adding the next dataset is cheap)

Adding a new feature source is now a known motion, which is why the impervious
refinement is "complexity, not risk":

```text
docs/extra/location_features/
  analysis/lib/    cache-backed fetch clients (Gazetteer, canopy, impervious, boundaries)
  analysis/        experiment scripts  (density vs size, canopy, impervious)
  data/raw/        cached source bytes  (.env holds the Census key, gitignored)
  docs/            findings (01) + end-to-end + this methodology's evidence
```

Workflow for any new proxy: **experiment** (notebook/script) → **discussion**
(findings doc) → **implement** (build artifact + dashboard). The impervious test
followed exactly this and produced a clear "not yet" — which is the system working.

---

## 10. What it is NOT (guardrails)

- **Not active pricing.** Everything above is a **shadow** read — a candidate
  factor shown for review, not a filed rate.
- **Not validated nationally.** Only CT/MA/RI is PoUS-validated; the rest is
  descriptive density + extrapolated relativity, labeled as such.
- **Not premise-level.** Town/tract grain; an address is placed in its tract, not
  verified at the meter.
- **Not a hazard or forward model.** This is *static* basis risk (where you are),
  not *forward regime* (storm/climate/grid change) — that is a separate lane.
- **CT footnote.** Connecticut adopted planning-region county-equivalents in
  Census products beginning in 2022, while our EAGLE-I raw outage source appears
  to switch from legacy county FIPS (`090xx`) to planning-region FIPS (`091xx`)
  around 2025-05-29. The v0 quote path should keep a CT address tied to the
  legacy county price until a stitched CT time series is approved, while also
  retaining the modern planning-region FIPS for display and future joins. See the
  [CT FIPS transition bridge](../../extra/poweroutage_us/docs/10_connecticut_fips_transition_bridge.md).

---

## Assumptions introduced here

These should be promoted into the [registry](../assumptions.md) with stable IDs:

- **LB-1** — the location-basis modifier is mean-1, exposure-weighted, within each
  county (conservation; no double-count with the layers beneath).
- **LB-2** — density uses Census land area (`ALAND`, water excluded); it conflates
  "few people" with "much wild land."
- **LB-3** — the relativity keys on **within-county** density position, not
  absolute density.
- **LB-4** — town/tract exposure is a proxy for premise outage experience; the last
  mile is unverified without live geometry / meter data.

## Cross-references

- Evidence + experiments: [`docs/extra/location_features/docs/01_findings.md`](../../extra/location_features/docs/01_findings.md)
- End-to-end + data lineage: [`docs/extra/location_features/docs/02_end_to_end_and_data_lineage.md`](../../extra/location_features/docs/02_end_to_end_and_data_lineage.md)
- Plain-language primer: [`docs/extra/location_features/docs/00_concepts.md`](../../extra/location_features/docs/00_concepts.md)
- Factor derivation appendix: [Derivation of Location Relativity Factors](location_relativity_factor_derivation.md)
- Design note: [`docs/dicsscssion/location_aware_outage_pricing/03_location_basis_risk_design.md`](../../dicsscssion/location_aware_outage_pricing/03_location_basis_risk_design.md)
- Per-customer base this composes on: [Per-Customer Pricing](../02_per_customer/per_customer_pricing_fundamentals.md)
