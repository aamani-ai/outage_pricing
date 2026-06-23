# 02 · End-to-end — how the location-basis layer was built, and what it depends on

*The whole story in one place: what we set out to do, every step we took, every
dataset we leaned on (and whether the **product** actually depends on it), how we
did it, and the honest limits. Written so you can explain the work to a teammate,
an actuary, or a capacity provider **without reading the code**.*

Date: 2026-06-17. New here? Read [`00_concepts.md`](00_concepts.md) first.

## What we're building

A **within-county location-basis modifier** — a correction that turns a
county-average outage rate into a location-specific one. It is a **mean-1,
exposure-weighted within-county frequency relativity** keyed on **rurality**:
rural locations run above their county average, urban below, and within any
county it averages back to 1.0. It sits in the pricing stack as:

```text
lambda_location(T) = lambda_county(T) x customer_impact_modifier x location_basis_modifier
                     (EAGLE-I baseline)  (already shipped)          (this work)
```

## End to end, step by step

| Step | What we did | Result | Evidence |
|---|---|---|---|
| 0 | County outage baseline from EAGLE-I — the backbone | county λ(T) | `price_engine/` |
| 1 | Built the within-county **target** from PoUS city×utility: a per-customer qualifying-outage rate, normalized **mean-1 within each county** | the signal is real, structural, not noise | PoUS Finding 6 |
| 2a | Attributed it with **in-hand** data: town size (rurality proxy) + utility identity | **rurality is the signal**; utility is collinear (≤4%) → it belongs in the grid/duration lane, not here | PoUS Finding 7 |
| 2b | Replaced the size proxy with **real density** (Census land area); tested **tree canopy** | density beats size; **canopy adds nothing beyond density** in NE | [`01_findings.md`](01_findings.md) |
| map | Choropleth on real town boundaries | rural = red / urban = blue, each county balances to 1.0 | `analysis/map_relativity.py` |
| 3 | Built the density **relativity** (mean-1, monotone, capped) across the full PoUS sample | deployable modifier + JSON artifact; rural 1.90× / urban 0.71× (T≥4h), **shadow** | [`03_density_relativity.ipynb`](../analysis/notebooks/03_density_relativity.ipynb) |
| 4 | Wired location basis into the dashboard: a `color by: Location basis` map mode (**national** — within-county density dispersion for ~2,900 counties via ACS tracts; CT/MA/RI pilot validated, rest descriptive) **+** a matrix **"Location-adjusted"** view (per-customer price × location relativity range). Shadow, like predictability | national location-aware read | `price_engine/dashboard/` |
| next | Validate out-of-region (TX); address / lat-lon entry (geocode → point → county + density tercile → price) | full location-aware quoting | planned |

> Dashboard note (the base matters): the location relativity is a mean-1 factor on the **per-customer** price (`lambda_customer_mean`), NOT the county-trigger price. An earlier build wrongly multiplied the county-trigger base — λ≈322/yr → ~$1.2M for a $2,500 payout, the known over-priced "anyone-in-the-county" view. Composed on per-customer, New Haven reads ~**$303**, with a location range ~**$243 (urban) → ~$425 (rural)** at T=4h. The map colors counties by *how much* location matters (within-county density dispersion); the hover shows the relativity range and the per-customer × location price. Validated on PoUS CT/MA/RI, Jan–Mar 2019; shadow, density-based v1.

National coverage: the map's dispersion is computed for ~2,900 counties from ACS
census-tract population ÷ tract land area (free Census key, gitignored in
`location_features/.env`); only the *relativity* (price) stays CT/MA/RI-validated.
The matrix **"Location-adjusted"** view shows per-customer × the location
relativity range (New Haven T=4h ≈ $243–$425), applied nationally —
**extrapolated/amber** outside the pilot. **Drill-in:** in Location-basis mode,
clicking a county renders its sub-units (pilot → towns; elsewhere → census tracts
via TIGERweb, on-demand) colored by within-county density (rural → urban) — the
actual within-county pattern the county color only summarizes. `tract_density.json`
(~81k tracts) holds the precomputed density so the key stays server-side.

## Data lineage — what we depended on (and whether the *product* does)

| Dataset | Role | Grain | Free? | Runtime or calibration-only |
|---|---|---|---|---|
| **EAGLE-I** | county outage baseline (backbone) | county | yes | **runtime** |
| **PoUS** city×utility (NDA trial) | the within-county **validation target** | town×utility | trial | **calibration-only — NOT in the product** |
| **Census Gazetteer** | town land area → density | town (MCD) | yes | **runtime feature** |
| **NLCD** Tree Canopy Cover | tested as a feature | 30 m raster | yes | tested → **parked** (no lift beyond density) |
| **Census CB boundaries** | maps | town polygons | yes | presentation only |
| **EIA-861** (planned) | independent reliability corroboration | utility | yes | calibration check |

**The one sentence that matters:** the only NDA / limited dataset (PoUS) is used
**only to validate** that density predicts within-county outage frequency. The
**shipped modifier runs on free, national data (Census density)** — there is **no
PoUS dependency at quote time.**

## Why we lean INTO the PoUS sample (rather than around it)

PoUS is the **only free sub-county *outcome* source** we have: EAGLE-I is
county-only, EIA-861 is utility-level. So for *empirical within-county*
validation it is the best signal available, even at one region and one quiet
season. We therefore **use the full CT/MA/RI breadth — ~28 counties, ~445
towns — not a single county** — to extract the most signal the sample can give.
That maximizes confidence in the *magnitude* while the product itself stays
PoUS-free.

## How we keep it robust despite a thin sample (the legs we stand on)

1. **Physics-first direction.** "Rural → out more often" is grid engineering —
   long overhead radial feeders, vegetation contact, far-flung restoration. PoUS
   only pins the *magnitude*, not the direction.
2. **Simple, single feature + a cap.** One feature (density), capped for
   *attribution confidence* — by design hard to over-fit on a small sample.
3. **Independent, PoUS-free corroboration.** EIA-861 utility reliability
   (SAIDI/SAIFI) and published density→reliability relationships cross-check the
   slope.
4. **Calibrate-once, apply-nationally; expand over time.** PoUS is training-time;
   refresh and widen as forward collection / utility partnerships / meter data
   arrive (the Gen-2 channel).

## How (method, briefly)

- **Target** = per-customer qualifying-outage rate at threshold T, **mean-1
  exposure-weighted within each county** (conservation: it *redistributes* risk
  inside a county, it does not change the county total).
- **Validation** = within-county Spearman + exposure-weighted tercile contrasts +
  partial correlation (canopy vs density), with a credibility floor for thin
  cells (structural-vs-noise check).
- **Modifier (planned)** = a monotone, mean-1, capped `f(density)`, fit across the
  **full** PoUS sample and anchored to the physics/literature prior, validated
  out-of-sample (hold-out counties) and out-of-region (e.g. TX) before activation.

## Honest limitations

- **One region, one quiet season** (CT/MA/RI Jan–Mar 2019, a single nor'easter) —
  provisional until replicated.
- **Cell/town exposure, not premise** — the town→address last mile needs live
  geometry / meter data. This is structural: the whole ecosystem is downstream of
  utility-published maps, which stop at town/case grain.
- **Centroid canopy ≠ town-mean**; single-town numbers are noisy in one season —
  trust the rural-vs-urban gradient and the conservation, not one town.
- **NE-specific:** "density alone" may not hold where trees don't saturate
  (parts of TX/the West) — re-test per region.

## Artifacts (show-and-tell)

- Primer: [`00_concepts.md`](00_concepts.md) · Findings: [`01_findings.md`](01_findings.md),
  [`../../poweroutage_us/docs/06_findings.md`](../../poweroutage_us/docs/06_findings.md) (sets 6–7)
- Shareable executed notebook: [`../analysis/notebooks/02_nlcd_canopy.ipynb`](../analysis/notebooks/02_nlcd_canopy.ipynb) (+ `.html`)
- Map: [`../analysis/outputs/town_relativity_map.png`](../analysis/outputs/town_relativity_map.png)
- Design + pricing stack: [`../../../dicsscssion/location_aware_outage_pricing/03_location_basis_risk_design.md`](../../../dicsscssion/location_aware_outage_pricing/03_location_basis_risk_design.md)
- Method + target definition: [`../../../plan/location_basis_research_plan.md`](../../../plan/04_location_basis/location_basis_research_plan.md)
