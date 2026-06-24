# Task Context — Location Basis (Step 04): calibration notebook → dashboard → live

*Date: 2026-06-23 · Area: location-basis (Step 04) / notebook + dashboard + deploy*

## Objective
Pick up the **Location Basis** lane (Adjusters → within-county density relativity), build the missing
canonical **Step-04 calibration notebook**, fix the known *Manhattan-reads-rural* flaw, then **integrate
it into the Next.js dashboard and deploy it live** — all as a **shadow** layer that never moves the
outward buyer price.

## Background
Location basis = a **mean-1 within-county density relativity** (rural > 1, urban < 1) composed on the
per-customer price. The method + methodology docs were already mature, but `notebooks/04_location_basis/`
was **missing** (01/02/03/05 existed) and the layer had a known flaw: **population density mis-ranks
dense commercial cores** (Midtown Manhattan reads "rural"). The documented fix — a zonal-mean NLCD
impervious guardrail — was "scheduled, not skipped." This session built the notebook, the fix, and the
dashboard surface. House workflow throughout: **research → plan → notebook → dashboard**, documents
first; principles enforced (`docs/principles/`, renewablesinfo_org `docs/principles/ui_design.md`).

## What we did (this session)
1. **Recapped** the prior task history; chose Location Basis as the next Adjusters lane.
2. **Deep-read** plan + discussion + methodology + the archived implementation (workflow + direct reads).
   Locked the **architecture**: calibration is *local/offline* (the notebook) → a versioned *numbers
   artifact* → the dashboard does *math only*; updating = **swap the numbers**.
3. **Designed the Manhattan fix:** a **symmetric, conservative NLCD zonal-impervious guardrail** on the
   density rank (Type A de-uplift built-up cores; Type B conservatively penalize the reverse). **Spiked**
   it on Manhattan *before* committing to any GB download — it worked (Midtown 91% impervious, flips 2/2).
4. **Trimmed scope** to honor the data reality: no new robustness/noise-floor work on thin data (D4),
   keep the calibrated numbers (D2), defer the tract↔town grain unification (D3).
5. **Wrote the notebook plan**, updated the methodology docs to the new direction.
6. **Built the Step-04 notebook** (`location_basis_calibration.ipynb`, §00–§08): reproduces the locked
   calibration *exactly* (ρ, relativity table), implements the guardrail, builds the national tract
   surface + an **on-demand per-address guardrail** (no GB raster), emits the artifact.
7. **Studied** the principles + current dashboard design/IA (workflow) for the integration.
8. **Wrote the dashboard plan** (principles-first). **IA decision evolved**: my initial lean was a 5th
   "Location" tab; the user proposed **expand-in-place**; resolved to **expand-in-place in Adjusters**
   (Location is a *factor*, not a diagnostic layer → decision-read top-level, evidence demoted).
9. **Built the dashboard integration** (steps 1–6): `build_data.py` promotes the artifact → `web/lib/data/location/`;
   `/api/studio` resolves the tract GEOID from the FCC block response + runs the on-demand guardrail;
   `composePremium.location` gets the modeled relativity (Studio only); the Adjusters Location row
   **expands in place** into a detail (position · guardrail · tercile bar · trust · evidence).
10. **Small UI polish:** dotted-underline the physical grid-signal phrases (*undergrounded, looped,
    crew-dense*, etc.) — annotation style, not a link.
11. **Deployed live:** committed (`5a5ffc9`) + pushed to `deploy/outage-pricing` → GHA Docker build →
    Cloud Run (100% traffic). **Verified live** — Midtown flips rural→urban on prod.

## Files touched
**Notebook (created):** `notebooks/04_location_basis/location_basis_calibration.ipynb` ·
`notebooks/outputs/location_basis/{relativity_table,county_lookup,guardrail_spec,tract_rurality}.json` +
`assumptions_to_register.md` + cached CSVs (outputs dir is gitignored; the **web bundle** below is the committed copy).

**Docs (created):** `docs/plan/04_location_basis/{location_basis_notebook_plan,location_basis_dashboard_plan}.md`
**Docs (modified):** `docs/methodology/04_location_basis/{location_basis_fundamentals,location_basis_methodology,location_relativity_factor_derivation}.md`

**Web — data (created/modified):** `web/scripts/build_data.py` (+location block) · `web/lib/data/location.ts` (new reader) ·
`web/lib/data/location/{relativity_table,county_lookup,guardrail_spec,tract_rurality}.json` (new, committed)

**Web — engine/API/UI:** `web/app/api/studio/route.ts` (tract resolve + on-demand guardrail) ·
`web/components/studio/shared.ts` (`LocationRead` + `StudioData.location`) · `web/components/studio/studio-view.tsx`
(thread model relativity + pass T) · `web/components/studio/tabs/adjusters.tsx` (expandable Location row) ·
`web/components/studio/location-detail.tsx` (new — the detail)

**Deploy:** commit `5a5ffc9` on `deploy/outage-pricing`; GHA run `28073766463` (success).
**Memory:** `project_location_basis_rebuild.md` (created + kept current).

## Current status
- ✅ Step-04 notebook built + executed; reproduces the locked numbers exactly; emits the artifact.
- ✅ Manhattan fix (symmetric conservative zonal-impervious guardrail) validated (spike + live).
- ✅ Dashboard integration built (data → API + on-demand guardrail → composed relativity → expandable UI).
- ✅ **Deployed live** — https://outage-pricing-wsd6lcl64q-uc.a.run.app/dashboard/studio (Midtown flips on prod).
- ✅ Shadow / Studio-only — the outward buyer price is unmoved (×1.00).
- 🔲 **User visual review** (light/dark + outside-reader read-back, ship-gate test #6) — not done.
- 🔲 Interactive client render not browser-tested (server 200 + typecheck only).

## Next steps
See `handoff.md`. The Location lane is complete + live as a shadow layer. Remaining = the visual review,
and the documented **append-only** deferrals (national map, raster precompute, out-of-region validation),
plus optionally syncing `main`.
