# Notes — 2026-06-23

## Data layer (build_data.py)
`web/scripts/build_data.py` is the single reproducible generator for the web bundle. Run from repo root:
```
.venv/bin/python3 web/scripts/build_data.py
# → built: pricing 3023 counties · studio 3090 · 53 states (3019 counties)
```
Added this session, emitted into `web/lib/data/studio.json` per county:
- `mult[T] = [median, mean, max]` per-customer λ (from `per_customer_view.json` lambda_customer_*)
- `od[T]` overdispersion Var/Mean of annual counts
- `conf, n_obs, total, cv, peak_share, r_step` (regime audit fields, from `county_regime_T8.csv`)
- `cell[T] = {trust, tnum, C:[c_source,c_sample,c_evt], level, p2m, tilt, pctile, n_obs, mm, route, pct, reason}`
  — the **Trust & Posture cell read**, from `notebooks/02_per_customer/inner_event_shape_diagnostics.ipynb`
  → `notebooks/outputs/inner_event_shape_diagnostics/county_cell_read_by_threshold.csv` (**gitignored**,
  present on disk; build_data reads it locally and bakes the result into the committed studio.json).
- New file `web/lib/data/regime-dist.json` — national regime distribution with `recent-change` split out of `insufficient`.

**Gotcha (cost a build):** Python `json.dump` writes `NaN`/`Infinity` (valid to Python, **invalid JSON**)
for non-finite values (e.g. `mm_ratio` when median≈0). The web bundler rejects them ("Unable to make a
module from invalid JSON"). Fix: `fnum()`/`rnum()` sanitize non-finite → default/None before dump.
Verify strict-valid: `json.loads(open(...).read(), parse_constant=lambda x:(_ for _ in()).throw(ValueError(x)))`.

## basePath gotcha (cost the broken logo + would have 404'd APIs)
With `basePath=/dashboard`, Next prefixes Link + `/_next/*` automatically but NOT raw `fetch('/api/...')`
or raw `<img src="/brand/...">`. Both 404 under the basePath. Fix: `web/lib/base-path.ts` exports
`api()` (used on the price/studio/geocode fetches) and `asset()` (used on the sidebar lockup imgs).
`next.config.ts` applies basePath only when `NEXT_PUBLIC_BASE_PATH` is set → "" locally, "/dashboard" in prod.

Local verification of the prod basePath (before pushing):
```
NEXT_PUBLIC_BASE_PATH=/dashboard npm run build        # green
NEXT_PUBLIC_BASE_PATH=/dashboard PORT=8090 npm run start &
curl -o /dev/null -w "%{http_code}" localhost:8090/          # 404 (app is under /dashboard) ✓
curl -o /dev/null -w "%{http_code}" localhost:8090/dashboard # 200 ✓
curl localhost:8090/dashboard | grep brand                   # src="/dashboard/brand/..." ✓
curl "localhost:8090/dashboard/api/price?lat=29.65&lon=-82.34"  # Alachua 4h lam=0.102387 → $78.76 ✓
```

## Deploy chronology (3 failed attempts → live)
Deploy = push to `deploy/outage-pricing` → `.github/workflows/deploy-outage-pricing.yml` (WIF auth →
GHA SA `gh-actions-deploy@modeling-nonprod-svc-db5x`). Watched with `gh run watch <id> --exit-status`.
1. **pack buildpacks** → FAIL: Turbopack `next build` "Symlink node_modules is invalid, points out of
   filesystem root." → switched to `web/Dockerfile` (real node_modules). ✅ build green.
2. **`--no-traffic --tag next`** → preview deployed at `https://next---outage-pricing-wsd6lcl64q-uc.a.run.app/dashboard`,
   validated (canary $79, basePath, geocode token). But couldn't flip:
   - `gh workflow run promote-...` → **403 Must have admin rights** (token lacks repo-admin).
   - local `gcloud ... update-traffic` → **PERMISSION_DENIED artifactregistry.downloadArtifacts** (personal
     account `divy@aamani.ai` lacks it; the GHA SA has it).
3. **deploy-to-live (removed --no-traffic)** → green, but main URL still served the OLD dashboard. Cause:
   earlier `--no-traffic` had **pinned** traffic to a specific (old) revision, so a plain deploy won't
   auto-migrate. Fix: added `gcloud run services update-traffic outage-pricing --to-latest` step.
4. ✅ **LIVE.** Verified main URL:
```
M=https://outage-pricing-wsd6lcl64q-uc.a.run.app
curl "$M/dashboard"            # 200 · <title>Pricing</title>  (new app)
curl "$M/dashboard/brand/lockup-on-light.svg"   # 200  (logo loads)
curl "$M/dashboard/api/price?lat=29.65&lon=-82.34"   # Alachua 4h → $79 (= $78.76 canary)
curl "$M/dashboard/api/geocode?q=boston&session=smoke"  # 200 (MAPBOX_TOKEN runtime env)
```

## Commits (deploy/outage-pricing)
- `a743442` Build redesigned Outage Pricing dashboard + methodology updates (the whole web/ app + docs)
- `8f64741` Wire Next.js deploy: basePath-aware fetches, Procfile, GHA preview cutover
- `005df2d` Deploy via Dockerfile (Turbopack rejects buildpack symlinked node_modules)
- `a4e6b83` Fix logo: basePath-prefix the brand lockup img srcs
- `55ecafc` Deploy to live traffic on push
- `95e67cd` Force traffic to the new revision (--to-latest)
- (on `main`) `211b14f` Add promote-outage-pricing workflow (dispatchable from default branch)

## Research workflows used
- `studio-section-spec` (5 readers + synth) → `docs/plan/dashboard_redesign/02_studio_section_spec.md`
- `cell-read-trust-posture` (5 readers + synth) → confirmed the Trust & Posture framing + the data path
  (the gitignored cell-read CSV that wasn't wired into build_data).

## Key insights
- When a number looks wrong, check whether it's **quantitative / code / communication** before "fixing"
  the model. The regime "insufficient" was purely communication; the classifier was right.
- Show the underwriter the *dimensions* (events, gate, band, peak/mean), not just a color — and never
  merge orthogonal axes (trust vs posture) into one score.
- Cloud Run: `--no-traffic` pins traffic; future deploys don't auto-migrate until `--to-latest`.
- Personal gcloud ≠ the GHA SA's permissions — deploy via the SA (push), not personal `gcloud`.
