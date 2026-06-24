# Handoff — 2026-06-23 (Location Basis Step 04) → next session

## 60-second summary
1. **Location basis (Step 04) is LIVE** as a **shadow** layer: https://outage-pricing-wsd6lcl64q-uc.a.run.app/dashboard/studio → search address → **Adjusters** → click **Location (within-county)** to expand.
2. **Architecture locked:** calibration is *local/offline* (the notebook) → a *numbers artifact* → the dashboard does *math only*. New data → re-run → **swap the numbers**. No calibration in dashboard code.
3. **Built the missing Step-04 notebook** `notebooks/04_location_basis/location_basis_calibration.ipynb` (§00–§08): reproduces the locked calibration **exactly** (ρ −0.35, relativity table), then adds the fix.
4. **The Manhattan fix** = a **symmetric, conservative NLCD zonal-impervious guardrail** on the density rank (Type A de-uplift built-up cores; Type B conservatively penalize the reverse). Validated by spike + live.
5. **No GB download:** the guardrail runs **on-demand per address** via MRLC WMS in `/api/studio` (3×3 grid, concurrent, 5s timeout, graceful fallback). The CONUS raster precompute is **deferred** (append-only).
6. **Data wired:** `build_data.py` promotes the artifact → `web/lib/data/location/*` (+ server-only reader `web/lib/data/location.ts`); the tract GEOID comes free from the FCC `Block.FIPS.slice(0,11)` — no extra call.
7. **IA resolved (with the user):** **expand-in-place in Adjusters**, NOT a 5th tab — Location is a *factor*, not a diagnostic layer; decision-read top-level, evidence in a nested ExpandBox.
8. **Outward price unmoved:** the modeled relativity composes into `composePremium.location` **only** in the Studio path; `/api/price` (outward) is untouched → the buyer premium stays ×1.00 while shadow.
9. **Deployed:** commit `5a5ffc9` → push `deploy/outage-pricing` → GHA `28073766463` → Cloud Run, 100% traffic. Live-verified: Midtown flips rural→urban on prod.
10. **Remaining = the visual review** (light/dark + outside-reader read-back) and documented **append-only** deferrals; nothing blocking.

## Repro / verify current state
```
# rebuild + promote the artifact (after any notebook change)
.venv/bin/python3 web/scripts/build_data.py          # → location 81356 tracts / 3116 counties

# web checks
cd web && npm run typecheck                                    # clean
cd web && NEXT_PUBLIC_BASE_PATH=/dashboard npm run build       # green
cd web && PORT=3000 npm run dev                                # localhost:3000/studio

# LIVE verify
M=https://outage-pricing-wsd6lcl64q-uc.a.run.app
curl "$M/dashboard/studio"                                     # 200
curl "$M/dashboard/api/studio?lat=40.7484&lon=-73.9857"        # Midtown → guardrail Type A (92%) → urban 0.784
# deploy = push to deploy/outage-pricing; watch:
gh run watch $(gh run list --workflow=deploy-outage-pricing.yml --branch deploy/outage-pricing --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status
```

## Files to read before continuing
- **Plans (read first):** `docs/plan/04_location_basis/{location_basis_notebook_plan.md, location_basis_dashboard_plan.md}` (the dashboard plan leads with the **principles ship-gate** + the resolved IA + data flow + open decisions D1–D9).
- **Method (canonical):** `docs/methodology/04_location_basis/{location_basis_methodology.md (§8 = the guardrail), location_basis_fundamentals.md, location_relativity_factor_derivation.md}`.
- **Notebook:** `notebooks/04_location_basis/location_basis_calibration.ipynb` (the calibration; the "Status — skeleton complete" closing cell explains the two append-only deferrals).
- **Code:** `web/lib/data/location.ts` · `web/app/api/studio/route.ts` (tract resolve + on-demand guardrail) · `web/components/studio/location-detail.tsx` + `tabs/adjusters.tsx` (the expand-in-place UI) · `web/scripts/build_data.py` (location block).
- **Principles (hold these):** `docs/principles/communicate_to_share.md` (the 6-point ship-gate) + renewablesinfo_org `docs/principles/{ui_design.md, presentability.md}`.
- **Memory:** `project_location_basis_rebuild.md` (distilled index of all the above).

## NEXT ACTION
**Phase A — the visual review (ship-gate test #6; the one thing not yet done).**
Open `/dashboard/studio` (or `localhost:3000/studio`), search an address, **Adjusters → expand Location**.
- Verify it reads correctly in **both light and dark** (every chart uses `useChartColors` → should be theme-correct).
- Search **Midtown** (Type-A guardrail flip rural→urban) and a **rural** address (stays, no guardrail note); a **CT/MA/RI** address shows the honest "no within-county data here — county average" fallback (pilot states excluded from the tract surface, D3).
- Have someone *outside the build* read the Location panel back — confirm it communicates "where am I, can I trust it, did the guardrail fire" without the math.
- Confirm the **price-breakdown waterfall** Location $ bucket populates in the Studio (it does when relativity ≠ 1).
- The interactive client render (clicking the row + ECharts) was NOT browser-tested here — if anything throws, grab the browser-console error.

**Phase B — optional housekeeping.** Sync `main` if you want the record consistent (deploy went via `deploy/outage-pricing` only; `main` is the non-deploying record — sync is by re-commit, see `docs/BRANCHING.md`). Add `web/tsconfig.tsbuildinfo` to `.gitignore` (it's a build cache, currently untracked).

**Phase C — the append-only deferrals (when the data/need arrives, NOT now).**
- **Calibration refresh:** when PowerOutage.US sends out-of-region / storm-season data → re-run §01–§05 → swap the artifact. This is also what **clears the activation gate** (shadow → priced).
- **Raster precompute:** download the CONUS NLCD impervious GeoTIFF + `rasterio` zonal-stats over ~81k tracts → append a per-tract impervious field → bake the guardrail into a **static national map** layer (the only thing the on-demand path can't color). The guardrail rule already exists in `guardrail_spec.json`.
- **pilot_polygons.geojson** for a validated-pilot map overlay (CB town shapefiles are on disk under `docs/extra/location_features/data/raw/census_boundaries/`).
- Register **LB-1..LB-4 / A018–A023** in `docs/methodology/assumptions.md` (the list is in `notebooks/outputs/location_basis/assumptions_to_register.md`).

## Known issues / access constraints
- None blocking. Location is intentionally **shadow / validated:false** (pilot-calibrated, nationally extrapolated).
- On-demand WMS adds ~1–2 s to the Studio API for rural/urban addresses; falls back gracefully if MRLC is down.
- Deploy only via **push to `deploy/outage-pricing`** (personal gcloud can't flip Cloud Run traffic; the GHA SA does it). `main` not auto-deployed.
- Notebook outputs dir (`notebooks/outputs/`) is gitignored; the **committed** copy the dashboard uses is `web/lib/data/location/`.
