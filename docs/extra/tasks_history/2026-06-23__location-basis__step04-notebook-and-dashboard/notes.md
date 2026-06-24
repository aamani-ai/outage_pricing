# Notes — 2026-06-23 (Location Basis Step 04)

## The notebook (`notebooks/04_location_basis/location_basis_calibration.ipynb`)
24 cells, executes clean on kernel `outage_pricing_venv`, 3 figures, 0 errors. Sections:
- **§00** framing (lane discipline, composition, status, the forward-update process).
- **§01** reproduce the within-county target → **conservation = 1.0** at every T (LB-1).
- **§02** pilot density + join (CT/MA/RI Gazetteer) → **445/459 (96.9%)**, 14 MA "Town city" misses *named* (fix deferred, D2/D3).
- **§03** Spearman regression check → median ρ **−0.41 / −0.41 / −0.35 / −0.29** (T=1/2/4/8), sign-test **p < 2e-5** — matches the locked file exactly.
- **§04** relativity table (empirical + capped) → matches `density_relativity.json` to the digit (T4 capped **[1.40, 1.23, 0.80]**).
- **§05 ★** the guardrail: point-impervious loses (**ρ −0.20 vs −0.35**, median 0% zero-heavy); the **zonal mean** flips Midtown 92% / FiDi 89% rural→urban **2/2**.
- **§06** national tract surface (**81,356 tracts / 3,116 counties / 48 states**; pilot states excluded = town-grain, D3) + the **on-demand per-address guardrail** (Midtown→urban 0.80; rural TX→stays 1.40, no false flip).
- **§07** activation gate + forward-update runbook (documented, not executed).
- **§08** emit + strict-validate the artifact (no NaN/Inf) + assumptions A018–A023.

Built via a **throwaway scratchpad builder** (`scratchpad/build_nb.py`) using `nbformat`, executed with
`jupyter nbconvert --execute`. The **.ipynb is the artifact**; the builder is disposable. Gotcha that cost a
build: a nested `"""docstring"""` inside a `code(r"""...""")` block closed the raw string early → SyntaxError
(fixed by using `#` comments). §05/§06 WMS results are **cached to CSV** so re-execution doesn't re-hit MRLC.

## The spike (de-risk before the GB download)
`scratchpad/locbasis_spike.py` — confirmed *before* building: within New York County, Midtown (ESB) and the
Financial District rank **p13 / p15** by *residential* density ("rural" bug), but read **91% / 89%** zonal
impervious → the guardrail flips both to urban. Also showed **zonal beats point** (suburban Naperville single
point = 94% noise vs a stable zonal mean). MRLC WMS worked in-sandbox (ESB 94%, rural Litchfield 3%).

## Dashboard data flow (confirmed against the code)
```
notebooks/outputs/location_basis/*.json
  → web/scripts/build_data.py  (new location block)
  → web/lib/data/location/{relativity_table,county_lookup,guardrail_spec,tract_rurality}.json  (committed; tract file 2.4MB)
  → web/lib/data/location.ts   (typed, SERVER-ONLY reader: getTract/getCounty/getRelativity; T>=8 clamps to T8)
  → /api/studio:  lat,lon → geo.fcc.gov block/find → County.FIPS + Block.FIPS
                  tract GEOID = Block.FIPS.slice(0,11)   ← NO extra call
                  getTract → tercile; if rural/urban → on-demand MRLC WMS zonal-impervious (3×3, concurrent,
                  5s timeout, graceful fallback) → guardrail reclassify → relativityByT
  → composePremium.location {relativity, status}  (Studio only; /api/price untouched → outward unmoved)
  → Adjusters Location row (expand) → location-detail.tsx
```
`composePremium` already had a `location:{relativity,status}` layer (default neutral 1.0) + `renormalizeMeanOne`
firewall + fail-loud — so this was **populate-the-skeleton**, not build-from-scratch.

## Commands used
```
# rebuild + promote the artifact into the web bundle
.venv/bin/python3 web/scripts/build_data.py
#   → built: pricing 3023 · studio 3090 · 53 states · location 81356 tracts / 3116 counties

# notebook build + execute (throwaway builder in scratchpad)
.venv/bin/python3 scratchpad/build_nb.py
.venv/bin/python3 -m jupyter nbconvert --to notebook --execute --inplace \
  --ExecutePreprocessor.kernel_name=outage_pricing_venv --ExecutePreprocessor.timeout=600 \
  notebooks/04_location_basis/location_basis_calibration.ipynb

# web checks
cd web && npm run typecheck                                  # clean
cd web && NEXT_PUBLIC_BASE_PATH=/dashboard npm run build     # green (/api/studio dynamic, /studio prerendered)
cd web && PORT=3000 npm run dev                              # local: http://localhost:3000/studio

# deploy (push triggers GHA → Docker → Cloud Run, live traffic)
git push origin deploy/outage-pricing
gh run watch 28073766463 --exit-status                       # success in ~2m24s
```

## Verification
```
# local API (dev) — the guardrail end-to-end
curl "localhost:3000/api/studio?lat=40.7484&lon=-73.9857"   # Midtown: base rural -> urban, Type A, imp 92%, relT8 0.784
curl "localhost:3000/api/studio?lat=29.30&lon=-103.30"      # rural Brewster TX: stays rural, relT8 1.372 (no false flip)
curl "localhost:3000/api/studio?lat=40.7736&lon=-73.9566"   # Upper East Side: urban, unchanged

# LIVE (prod, basePath /dashboard)
M=https://outage-pricing-wsd6lcl64q-uc.a.run.app
curl "$M/dashboard"                                          # 200
curl "$M/dashboard/studio"                                   # 200
curl "$M/dashboard/api/studio?lat=40.7484&lon=-73.9857"      # Midtown: guardrail Type A (92%) -> urban 0.784  ✓ LIVE
```

## Metrics
- Notebook: 24 cells, 3 figures, 0 errors. Reproduction exact (ρ + relativity table).
- National surface: 81,356 tracts · 3,116 counties · 48 states (227 single-tract counties → neutral 1.0).
- Artifact sizes: tract_rurality.json 2.4MB · county_lookup.json 160KB · relativity_table 442B · guardrail_spec 525B.
- Deploy: GHA run 28073766463, build-and-deploy 2m24s, success, 100% traffic to the new revision.

## Key insights
- **Location is a *factor*, not a *diagnostic layer*** — that single reframe settled the IA (expand-in-place,
  not a 5th tab) and which content is decision vs evidence.
- **Spike before the heavy download.** A handful of WMS calls on Manhattan proved the fix and the zonal-vs-point
  point before committing to the GB raster — which we then deferred entirely (on-demand per-address suffices).
- **The tract GEOID is free** from the FCC `block/find` response (`Block.FIPS.slice(0,11)`) — no second geocode.
- **The skeleton was already there** at both layers: `composePremium.location` (engine) and the Adjusters
  FactorRow (UI) existed as placeholders — integration was populate, not build.
- **Both deferrals are append-only.** Calibration refresh (more PoUS data → swap numbers) and the raster
  precompute (static-map guardrail → append a per-tract field) drop into the skeleton without restructuring.

## Gotchas
- **`noUncheckedIndexedAccess`** is on → JSON imports need `as unknown as` casts and index lookups need guards
  (`location.ts` `getRelativity`/`getRelativityRow` throw if T8 is missing; `tercileFromIdx` falls back).
- **Server-only**: `tract_rurality.json` (2.4MB) is imported only by `location.ts` (server). The client component
  (`location-detail.tsx`) imports only the 442-byte `relativity_table.json` for its evidence charts.
- **WMS latency**: the on-demand guardrail fires *only* for rural/urban terciles (skips mid), runs the 9 points
  concurrently, 5 s timeout, and falls back to the density tercile if MRLC is unavailable — never blocks the price.
- **Pilot states (CT/MA/RI) are not in the national tract surface** (town-grain, D3) → a CT/MA/RI address gets
  `location: null` → the Adjusters row shows the honest "no within-county data here — county average" fallback.
- **Deploy = `deploy/outage-pricing` only.** `main` is the separate non-deploying record and was NOT synced.

## Commits
- `5a5ffc9` Wire location basis (Step 04) into the dashboard — shadow, expand-in-place (on `deploy/outage-pricing`).
