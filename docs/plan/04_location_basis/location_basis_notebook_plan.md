# Location Basis — Step-04 Notebook & Local-Calibration Plan

- **Status:** **notebook BUILT & executed (2026-06-23)** — §00–§08 reproduce the locked calibration
  exactly, add the symmetric/conservative guardrail (Midtown/FiDi flip 2/2), build the national
  surface + on-demand guardrail, and emit the dashboard artifact. Still **shadow** (not in the quoted
  premium); the two deferrals — **calibration refresh** (more PoUS data) and **raster precompute**
  (static-map guardrail) — are **append-only**, not rebuilds. **Skeleton + contract complete → ready
  for the dashboard phase.** *(Original plan-of-record retained below as the design record.)*
- **Date:** 2026-06-23
- **Companions:** research plan [`location_basis_research_plan.md`](location_basis_research_plan.md) ·
  pre-op [`location_basis_risk_preop_plan.md`](location_basis_risk_preop_plan.md) ·
  design note [`../../dicsscssion/location_aware_outage_pricing/03_location_basis_risk_design.md`](../../dicsscssion/location_aware_outage_pricing/03_location_basis_risk_design.md) ·
  canonical method [`../../methodology/04_location_basis/location_basis_methodology.md`](../../methodology/04_location_basis/location_basis_methodology.md)

---

## 1. Why this notebook exists

Notebooks exist for steps 01, 02, 03, 05 — **04 was missing.** The location-basis
*method* is mature and documented; what's missing is the clean, reviewable,
well-commented notebook that **re-derives the calibration from source** and adds the
work that lets us eventually drop the "shadow only / extrapolated" hedges — most of
all the **commercial-core fix** (Midtown Manhattan reads "rural").

This notebook is **the local calibration**. It is the thing we re-run when new data
arrives. It is *not* dashboard code.

---

## 2. The architecture this locks in

```
   notebooks/04_location_basis/          notebooks/outputs/location_basis/      web/ dashboard
   (LOCAL · OFFLINE)                      (a versioned NUMBERS artifact)         (CONSUMER · math only)
   ──────────────────────────            ──────────────────────────────        ────────────────────
   PoUS + Census + NLCD impervious  ──►   relativity_table.json            ──►  per_customer_price
   → calibrate + validate + fix           tract_rurality.json                   × relativity(tract,T)
     (all experiments live here)          county_lookup.json                    NO calibration logic.
                                          pilot_polygons.geojson
            re-run when new data ─────────────► swap the numbers ─────────────► dashboard unchanged
```

- **Calibration never enters dashboard code.** Heavy work (raster zonal-stats) is
  offline, by design.
- **Update process = swap the numbers.** New PoUS data → re-run this notebook →
  regenerate the artifact → `web/scripts/build_data.py` promotes it → dashboard keeps
  working. Documented as the intended forward process (Section 07 + the methodology).
- **Not customer-facing yet.** We're building the *process*; the numbers are "what we
  have today, sharpen with data." No pricing-accuracy theater.

---

## 3. Scope decisions (locked with the user)

| # | Decision | Why |
|---|---|---|
| **D1** | **Manhattan fix = NLCD zonal-mean impervious as a targeted commercial-core GUARDRAIL on top of validated population density** — not a replacement. Promote to blend/replace **only** if zonal impervious shows incremental within-county lift beyond density under partial-Spearman (the keep/drop criteria). | Keeps the already-calibrated relativity numbers valid (fixes *which tercile a tract lands in*, not the multipliers — which we can't re-fit without new outcomes). Point-impervious already lost to density (ρ −0.20 vs −0.35); zonal is the untested-but-correct remedy. Independently corroborated by the deep-read synthesis. |
| **D2** | **Reproduce and KEEP the validated relativity numbers** (T1–T8, empirical + capped). Re-derive cleanly from source and assert they match the existing artifact; do **not** re-fit. | No new outcome data exists. Re-fitting would change nothing and risks drift. |
| **D3** | **Defer the tract↔town grain unification.** Keep: validated on **towns** (pilot), applied on **tracts** (national). Document the seam honestly. | We have no new data to re-validate at tract grain; it's housekeeping, not a correctness fix; honors "don't complicate." |
| **D4** | **No new robustness / noise-floor / masking analysis.** Keep the calibration exactly as-is (per D2); the only new work is the impervious feature fix. | The purpose of this run is narrow — fix the feature mis-ranking (Manhattan-as-rural), not re-litigate the calibration's statistical confidence on thin data. With one quiet season there is no new confidence to extract. (The EAGLE-I coverage mask is already baked into the per-customer base this multiplies; location basis is a mean-1 relativity on top and doesn't recompute county rates — so masking is moot here.) |
| **D5** | **Emit BOTH empirical and capped numbers.** The cap `[0.80,1.40]` becomes an explicit, documented, tunable *attribution-confidence* parameter (not signal size). | Honesty about how much is throttled; matches the "numbers we update" model. Retires the dead `[0.85,1.35]` rail. |
| **D6** | **Deferred (future, not now):** out-of-region/storm-season re-validation; the user's other datasets; full grain unification. | No data yet; keep the process simple and shippable. |
| **D7** | **The guardrail is SYMMETRIC but CONSERVATIVE (an insurance design).** It overrides the density rank both ways: **Type A** (sparse residents + high impervious → rural→**urban**, a *discount*) fires on the strong, unambiguous high-impervious signal; **Type B** (dense residents + low impervious → urban→**higher**, an *uplift/penalty*) is accepted as **deliberately conservative** — for outage insurance, over-charging an ambiguous location beats under-charging — and **documented** as such (low impervious is ambiguous: urban greenspace reads low, so Type B may over-penalize some leafy tracts; optional greenspace guard later). | A one-way correction biases the book. Asymmetric *evidence bar*: discounts need the reliable signal; penalties are the safe side, per the pre-op rule "discounts require stronger evidence than uplifts." |

---

## 4. Where things live

```
notebooks/04_location_basis/
  location_basis_calibration.ipynb     # the reviewable notebook (sections 00–08)
  calibration.py                       # optional local module for the HEAVY bits
                                        # (NLCD raster zonal-stats), imported by the nb
notebooks/outputs/location_basis/      # the numbers artifact (git-tracked, swappable)
  relativity_table.json                # empirical + capped, per T  (the calibrated numbers)
  county_lookup.json                   # FIPS → {dispersion, n_subunits, validated}
  tract_rurality.json                  # GEOID → {density, impervious, rank, tercile, relativity}
  pilot_polygons.geojson               # validated pilot town polygons (for the map)
  spearman_by_county.csv + significance # the validation evidence (for the Studio strip)
  assumptions_to_register.md           # LB-1..LB-4 → A018+ text, to seed into assumptions.md
```

- **Reference only — never written to:** `price_engine/dashboard/data/`,
  `docs/extra/location_features/`, `docs/extra/poweroutage_us/`. These are the archived
  workstream; we read them, re-derive cleanly, and assert our numbers match.
- **NDA discipline:** PoUS raw rows are gitignored and stay so. The notebook reads them
  locally and writes only aggregate stats — same rule the existing scripts follow.

---

## 5. Data situation — on disk vs. needs acquisition

| Dataset | Role | Status | Action |
|---|---|---|---|
| PoUS within-county target `within_county_relative_rate.csv` | the validation TARGET (calibration-only) | **on disk** | load in §01 |
| Census 2023 Gazetteer cousubs (09/25/44) | pilot town land area (density denominator) | **on disk** | load in §02; fix the 14 MA "Town city" join misses |
| CB 2023 town polygons (09/25/44) | pilot polygons for zonal-stats + map | **on disk** | §05 pilot validation, §08 map |
| ACS5 2022 tract pop (48 states) + tract gazetteer | national density feature | **partial** (pilot 09/25/44 missing) | national surface uses what's cached; pilot stays town-grain per **D3** |
| **NLCD 2021 Impervious CONUS raster** (GeoTIFF) | the commercial-core fix | **MISSING — fetch** | download from MRLC; cache under `docs/extra/location_features/data/raw/nlcd_impervious/` |
| `rasterio` + `rasterstats` | zonal-stats over polygons | **MISSING — install** | `pip install rasterio rasterstats` (routine dev tooling) |
| NLCD impervious centroid CSV; canopy CSV | failed earlier attempts | on disk | **reference baseline the zonal approach must beat** — do not repeat point-sampling |
| Reference build artifacts (`density_relativity.json`, spearman CSVs) | numbers to reproduce | on disk | **regression check** — assert fresh numbers match |

**Acquisition gate:** before the raster step I'll confirm the exact MRLC product +
download size with you (it's multi-GB). Sections 00–04 + 06 are fully useful even if
§05's raster runs separately.

---

## 6. The notebook — section plan

Every section follows the EDA notebook principles: **interpret every variable**
(value + meaning + units + use-decision), **understand-before-use**, **pin + cache**,
**no silent windows/sampling** (report region/date/match-rate + exclusions), **every
output earns a takeaway**. Markdown narration throughout so it reads top-to-bottom.

```
00  FRAMING & LANE DISCIPLINE
    does:    state purpose (within-county FREQUENCY relativity, basis-risk correction);
             the hard lane boundary (frequency only — NO duration/severity/utility-identity,
             those are the grid/forward lane); composition it feeds; data-maturity status;
             AND the forward-update process ("new data → re-run → swap numbers").
    out:     framing cells; the masking note (D4); cross-refs to current doc paths.
    retires: scope confusion; sets the honesty frame.

01  REPRODUCE THE WITHIN-COUNTY TARGET  (mean-1, exposure-weighted)
    does:    load within_county_relative_rate.csv; per T∈{1,2,4,8}h aggregate cells →
             sub-unit rate A; county exposure-weighted mean; rel = A / cmean.
    asserts: per-county exposure-weighted mean(rel) ≈ 1.0 (CONSERVATION invariant — a
             correctness check, NOT a robustness study).
    does:    one clean sample-flow table with explicit drop accounting (no silent drops).
    inputs:  docs/extra/poweroutage_us/analysis/outputs/within_county_relative_rate.csv
    out:     target_by_subunit (per T); sample-flow.
    note:    reproduction of the existing derivation so 04 stands alone — NO noise-floor /
             credibility / robustness work (D4).

02  PILOT DENSITY FEATURE + JOIN  (CT/MA/RI towns)
    does:    load 2023 Gazetteer; density = tracked / ALAND_km²; join PoUS↔gazetteer on
             (state, normalized town name) — NEVER county FIPS (CT planning-region gotcha);
             FIX the 14 MA "X Town city" misses; report match-rate (target > 96.9%);
             within-county pct-rank → tercile.
    inputs:  census_gazetteer/2023_gaz_cousubs_{09,25,44}.txt + §01 target
    out:     town_density_features (state,county,city,tracked,ALAND_km²,density,lat,lon,rel,rank,tercile)
    retires: silent join drops; improves the documented match-rate.

03  REPRODUCE THE HEADLINE VALIDATION NUMBER  (regression check — NOT new work)
    does:    re-compute the already-documented within-county Spearman(density, rel) + sign
             test, purely to ASSERT our clean re-derivation matches the locked numbers.
    asserts: REPRODUCES median ρ ≈ −0.41/−0.41/−0.35/−0.29 at T=1/2/4/8; sign-test p < 2e-5
             (regression check vs reference CSVs). We do NOT extend or stress-test it.
    out:     spearman_by_county.csv + significance.csv (feeds the Studio Spearman strip)
    note:    if you'd rather skip even this, we take the locked numbers as given — see the
             open question at the end.

04  DERIVE THE RELATIVITY TABLE  (empirical + capped — KEEP the numbers)
    does:    per T: exposure-weighted tercile relativity → monotone-PAV non-increasing →
             renormalize mean-1 (EMPIRICAL) → clip to attribution-confidence cap →
             renormalize (CAPPED). Document the SINGLE canonical rank→relativity mapping
             (resolve the old two-mapping inconsistency).
    asserts: fresh numbers match the existing artifact (v0_shadow T4 ≈ [1.402,1.228,0.801];
             empirical T8 rural ≈ 2.058); per-county mean ≈ 1.0.
    out:     relativity_table.json (empirical + capped, cap as explicit param)
    retires: the dead [0.85,1.35] rail; buried-in-JSON cap choice (D5).

05 ★ COMMERCIAL-CORE FIX — SYMMETRIC, CONSERVATIVE NLCD ZONAL-IMPERVIOUS GUARDRAIL  (the point of this run)
    basis:   PHYSICS + FACE VALIDITY, not a stats test on thin data. Impervious directly
             measures built-up-ness: a high-impervious tract IS a built-up core regardless
             of resident count (Midtown ≈ 91% zonal, rural ≈ 3%).
    does:    compute ZONAL-MEAN impervious per tract (tract mean, NEVER a single point); use
             it to override the density rank ONLY where the two contradict — SYMMETRICALLY:
               Type A  density=rural + impervious=built-up  → rural→URBAN (discount).
                       Fires on the strong, unambiguous high-impervious signal.
               Type B  density=urban + impervious=not-built → urban→HIGHER (uplift/penalty).
                       CONSERVATIVE by design (for outage insurance, over-charging an
                       ambiguous location beats under-charging); DOCUMENTED that low
                       impervious is ambiguous (urban greenspace reads low) so Type B may
                       over-penalize leafy tracts — accepted bias; optional greenspace guard.
    done:    SPIKE (2026-06-23) validated the Type A direction — Midtown p13→91%, FiDi
             p15→89%, flipped rural→urban 2/2; and the zonal mean is stable where a single
             point is noisy (Naperville point=94% — the exact noise that sank point-impervious).
    does:    set the impervious thresholds; demonstrate before/after on the canonical cores;
             optional confirmatory ρ(impervious|density) on the pilot (sanity, NOT a gate).
    inputs:  NLCD impervious (WMS-zonal for §05 spot-checks; raster for §06 national); tract polygons
    out:     per-tract impervious; the symmetric guardrail rule + thresholds; before/after table.
    retires: ★ the Manhattan-reads-rural flaw (Type A) + the reverse under-pricing (Type B).

06  NATIONAL TRACT SURFACE + APPLY GUARDRAIL  (CONUS extrapolation)
    does:    per-tract density (ACS5 pop / tract ALAND_km²) for cached states; within-county
             rank → relativity; apply the §05 guardrail at tract grain; per-county dispersion =
             std(log10 tract density); handle n_subunits=1 → relativity 1.0 + flag.
    notes:   national stays validated:false (extrapolated). The town↔tract seam is documented (D3).
    inputs:  acs_tracts/{SS}.json + tract_gazetteer/{SS}.txt; NLCD impervious (national tract zonal)
    out:     tract_rurality.json (GEOID→score); county_lookup.json (FIPS→dispersion,n,validated)
    retires: nothing new (extrapolation) — but the guardrail makes the national surface correct in cores.

07  ACTIVATION GATE + FORWARD-UPDATE RUNBOOK  (documented; deliberately not executed)
    does:    EXECUTE only the correctness/face checks (join, conservation, commercial-core
             spot-check). DOCUMENT — do not run — the deferred gate: out-of-region (TX) + a
             storm season vs a sub-county OUTCOME source before any move into the quoted
             premium. Record the forward-update runbook ("new data → re-run → swap numbers").
    out:     gate checklist (executed vs deferred); the "values change with new data" note.
    retires: the vague "shadow" word → a precise, named, honest gate (without pretending to clear it).

08  EMIT THE NUMBERS ARTIFACT  (dashboard math-only contract)
    does:    write relativity_table.json, tract_rurality.json, county_lookup.json,
             pilot_polygons.geojson, spearman CSVs to notebooks/outputs/location_basis/;
             emit BOTH empirical + capped; list assumptions to register (A018+).
    asserts: strict-valid JSON (no NaN/Inf — the build_data gotcha); a composition sanity
             check (relativity multiplicative, missing → 1.0).
    out:     the swappable numbers artifact + assumptions_to_register.md
    retires: hand-off ambiguity — defines exactly what the dashboard consumes.
```

---

## 7. Validation gates — executed now vs. deferred

| Gate | Now? | Note |
|---|---|---|
| **Join** (match-rate + explicit unknown bucket) | ✅ | §02; fix MA misses, reconcile the 445/440/437 drift |
| **Reproduction** (ρ + numbers match locked values) | ✅ | §03/§04 regression check — *reproduction, not new validation* |
| **Conservation** (per-county mean ≈ 1.0, monotone) | ✅ | §01 + §04 numeric asserts — *correctness invariant* |
| **Face** (commercial-core spot-checks read correctly) | ✅ | §05 Midtown/ESB — the acceptance test for the fix |
| **Noise-floor / robustness / outcome / out-of-region** | ⏸ NOT done | **deliberately not pursued** (thin data, per D4). The out-of-region + storm-season activation gate is *documented* for the future, not executed. |

Location basis stays `status=modeled, validated=false` (not wired into the quoted
premium) until the deferred activation gate is met. The notebook documents that gate
rather than pretending to clear it.

> **Addendum (2026-06-28) — Conservation holds in calibration but NOT in the shipped tercile factors.**
> The "per-county mean ≈ 1.0" invariant above is satisfied by the *continuous* relativity, but the
> 3-tercile + capped artifact the dashboard actually applies is **not** mean-1. Applying
> `relativity(tract, T)` by tercile gives a per-county *tract-weighted* mean of **~1.10 (capped) /
> ~1.24 (empirical)** at T8 (tracts ≈ equal-pop, so ≈ pop-weighted). The asymmetric cap `[0.8, 1.4]`
> helps (pulls 1.24 → 1.10) but does not restore it. **Effect:** the Studio (which applies location)
> prices ~9–10% above the Analytics/QC view (location held at 1.0) *and* above the county-average
> baseline — a level shift, not just the intended rural↔urban redistribution. Surfaced via the
> Studio-vs-QC reconciliation. **Fix at the next calibration:** re-center the applied tercile factors to
> pop-weighted mean-1 within county (after the cap) and re-assert Conservation on the *applied* factors —
> gated on the PoUS validation that decides whether any residual level is real signal vs. artifact. No
> dashboard change now (the layer is shadow / `validated=false`; the engine is one engine and correct).

---

## 8. Documentation updates (part of "build properly")

| File | Update |
|---|---|
| `docs/methodology/04_location_basis/location_basis_methodology.md` | elevate zonal impervious from "parked point-sample" to "the guardrail remedy"; replace `[0.85,1.35]` language with the attribution-confidence cap; re-point artifact paths to the new outputs/artifact; state the town↔tract seam (D3) and the masking analogue (D4). |
| `docs/methodology/04_location_basis/location_relativity_factor_derivation.md` | document the single canonical rank→relativity mapping (resolve the old two-mapping inconsistency); restate the conservation check. |
| `docs/methodology/assumptions.md` | register **LB-1..LB-4 → A018+** (conservation/mean-1; density-as-rurality + ALAND conflation; within-county ranking; town/tract-not-premise + one-region calibration ceiling). Cite by ID thereafter. |
| `docs/OUTAGE_MODELING_FRAMEWORK.md` (Step 4) | re-point from the OLD python dashboard surface to the new flow (notebook → outputs → build_data → web); record the activation gate + the forward-update process. |
| `docs/dicsscssion/.../03_location_basis_risk_design.md` + plans | short addenda: mark the utility-identity-as-location row and the `[0.85,1.35]` rail superseded; note the calibration-local / dashboard-math-only architecture. (Do not rewrite the design record.) |

---

## 9. Out of scope (explicit non-goals)

- **No dashboard code** in this step — that's the next phase, referencing the archived
  dashboard for structure and the principles for what-goes-where.
- **No re-fitting** of the relativity magnitudes (D2) and **no grain unification** (D3).
- **No forward/grid/hazard, no utility-identity feature, no premise-level** — different lanes.
- **No activation into the quoted premium** — stays shadow/modeled until the deferred gate.

---

## 10. Open risks / dependencies

- **NLCD raster is the heavy piece** — multi-GB GeoTIFF + zonal-stats over ~81k tracts.
  Mitigation: process per-state to bound memory; cache results; confirm the download with
  you first; keep §05 separable so the rest of the notebook stands alone.
- **`rasterio`/`rasterstats` install** — routine, but a new dependency in the venv.
- **National tract polygons** (TIGER/CB tracts) aren't all cached — fetch as needed for §06
  zonal stats; or apply the guardrail only where pop-density flags a likely core (lighter).
- **MA "Town city" join misses** — fixing them shifts the match-rate; report before/after so
  the change is auditable.

---

## 11. One open question for you

**How much of the existing calibration should the notebook reproduce?**

- **(a) Reproduce-then-fix** *(recommended)* — re-derive the numbers from source (§01–04),
  assert they match the locked `density_relativity.json` (a regression check), then add the
  impervious fix. 04 becomes a real, self-contained, navigable notebook like 01/02/03/05.
  This is *reproduction*, not robustness.
- **(b) Minimal fix** — take the locked numbers as given (load the JSON), and only do the
  impervious guardrail + national surface + emit. Leaner; but 04 won't document the method
  end-to-end and won't carry the regression check.

I lean **(a)** because you asked to build it properly and it matches the other notebooks —
but it's your call, and (b) is legitimate if you want the smallest possible footprint.

## 12. Sequence

1. **You review this plan.** Adjust scope/decisions.
2. Build `notebooks/04_location_basis/location_basis_calibration.ipynb` (§00–04, 06–08 first;
   §05 raster after the download is confirmed).
3. You review the notebook; iterate.
4. Update the docs (Section 8).
5. **Then** the dashboard phase (separate plan), consuming the numbers artifact.
