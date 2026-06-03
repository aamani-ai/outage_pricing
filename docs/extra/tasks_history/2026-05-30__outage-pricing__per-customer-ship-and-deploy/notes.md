# Notes — Implementation Detail

Chronological + topical. Commands, verification, metrics, insights.

## Session opening — context recap

The session started by reading the May 21 task-history handoff plus the methodology docs, plan files, and current dashboard code. Key prior context:

- v0 historical pricing engine reproducible from raw EAGLE-I CSVs.
- Dashboard at `http://127.0.0.1:8001/dashboard/` (port 8001, served from `price_engine/`, long-running since May 17).
- Default catalog: `eagle-i-45min`.
- Adjustment framework planned but not executed.

The session's first substantive question from the user: explain what `max_customers / MCC` (Peak %MCC) actually represents and validate the implementation. This led to the customer-as-policyholder discussion and the dashboard's eye-button tooltip refinements.

## Phase 1 — Math validation notebook

Notebook: `notebooks/per_customer_rate_phase1.ipynb`. Executed via the project venv (`/Users/divy/code/work/infrasure_git_codes/outage_pricing/.venv/`).

Setup gotchas resolved:
- The default jupyter `python3` kernel pointed to a different venv. Fix: registered an `outage-pricing` kernelspec from this venv (`python -m ipykernel install --user --name outage-pricing`).
- `MCC.csv` has a trailing `Grand Total` row that breaks `int` casting on `County_FIPS`. Fix in code: `mcc_df = mcc_df[mcc_df['County_FIPS'].str.fullmatch(r'\d+')]`.

County sample: Alachua FL (12001), Manatee FL (12081), Marion FL (12083), Miami-Dade FL (12086), Custer SD (46033). T grid: 2 / 4 / 8 / 12 / 24. X grid: 500 / 1000 / 2500 / 5000 / 10000.

Headline finding for the team report:

| County | n_events | MCC | retail_v0 @ T=4h, X=$500 | retail_customer (mean) | ratio |
|---|---:|---:|---:|---:|---:|
| Alachua FL | 11,789 | 218,548 | $236,268 | $78.76 | **3,000×** |
| Manatee FL | 6,142 | 266,408 | $251,973 | $66.77 | **3,774×** |
| Marion FL | 9,848 | 217,647 | $302,120 | $121.04 | **2,496×** |
| Miami-Dade FL | 166 | 951,391 | $10,264 | $9.75 | 1,053× |
| Custer SD | 1,341 | 4,481 | $20,527 | $183.38 | **112×** |

Per-customer retail in the $10–$300/yr range, commercially plausible. v0's $10k–$300k/yr is not.

Anchor verification (used throughout the session): Alachua FL, T=4h, X=$500 yields v0 `lambda_county = 307.148490`, Pure = $153,574.25, Retail = $236,268.07. Numbers are byte-identical to the v0 drilldown JSON.

Heavy-tail finding: for Alachua at T≥4h, `mean_customers / MCC` distribution has median 0.000073, mean 0.000333, p99 0.003619, max 0.069097. Mean is 4.5× median. Surfaced as the sensitivity-range UX pattern (mean → median → max) in the dashboard chain footnote.

Cross-catalog stability for the 5-county sample at T=4h was within ±10–15% for adequate-coverage counties; Miami-Dade (sparse coverage) showed a 2× swing between 30-min and 45/60-min catalogs. This motivated the coverage-gate's three-status design (`available` / `caution` / `not_available`).

## Phase 2 — Curated pipeline

Script: `curated_outage_data/pipelines/per_customer_rate/compute_per_customer_lambda.py`.

Run command:
```bash
source .venv/bin/activate
python curated_outage_data/pipelines/per_customer_rate/compute_per_customer_lambda.py
```

Outputs:
```
curated_outage_data/outputs/per_customer_rate/
├── per_customer_lambda__eagle-i-30min.parquet   (~1.7 MB, 15,450 rows)
├── per_customer_lambda__eagle-i-45min.parquet   (~1.7 MB, 15,450 rows)
├── per_customer_lambda__eagle-i-60min.parquet   (~1.7 MB, 15,450 rows)
├── per_customer_view__eagle-i-30min.json        (~8 MB)
├── per_customer_view__eagle-i-45min.json        (~8 MB)
└── per_customer_view__eagle-i-60min.json        (~8 MB)
```

Mirror writes to `price_engine/catalogs/<catalog>/pricing/per_customer_view.json` so the dashboard's static server can fetch as a sibling of `county_drilldown.json`.

Wall time: ~25s for all three catalogs.

Coverage-gate distribution (45-min catalog, full national):

| T | available | caution | not_available |
|---|---:|---:|---:|
| 2 h | 2,798 | 225 | 67 |
| 4 h | 2,753 | 248 | 89 |
| 8 h | 2,273 | 653 | 164 |
| 12 h | 1,690 | 1,177 | 223 |
| 24 h | 729 | 1,844 | 517 |

Monotone in T (fewer counties have enough qualifying events at longer durations). Cross-catalog stability QA: `multiplier_mean` for `available` cells across all three catalogs has p90 relative range of 15.9%. At T=4h, 98.0% of `available` cells are within ±20%. Phase 2 gate passed.

## Phase 3 — Dashboard side-by-side surface

Originally landed as a "shadow" callout with the per-customer view in a teal-bordered block below the v0 chain. Later in the session (after the graduation reframe), this was inverted: per-customer chain renders first in standard `.chain-row` rhythm; v0 county-trigger renders below as a muted `.chain-section.reference` block.

Key implementation pieces:

- `state.matrixView` defaults to `customer` (was `county` initially).
- `state.perCustomer` holds the loaded view JSON per catalog.
- `perCustomerCell(fips, T)` helper for lookup.
- `setMatrixView()` + `syncMatrixViewSeg()` keep the View toggle DOM in sync with the JS state — defensive against the toggle drifting out of sync.
- `renderMatrixLegend()` swaps content based on view mode (`available` / `caution-stripe` / `not-available` dots in per-customer/multiplier modes; standard tier dots in county mode).

CSS class renames during the graduation reframe:
- `.matrix-table td.shadow` → `.matrix-table td.available`
- `.dot.shadow` → `.dot.available`
- `.roadmap-status.shadow` → removed (unused after `Per-customer rate` became `Customer basis risk` with status `shipped`)

## Methodology library — architecture

The library renders `docs/methodology/` files live in the dashboard. Three components:

1. **Symlink:** `price_engine/dashboard/methodology → ../../docs/methodology`. Python `http.server` follows symlinks; the dashboard can fetch markdown via `./methodology/<file>.md`. The deploy workflow replaces the symlink with a real directory copy as a pre-build step so the container is self-contained.

2. **Renderer:** `price_engine/dashboard/vendor/marked.min.js` v13.0.3 (38.7 KB). Downloaded via:
   ```bash
   curl -sSL 'https://cdn.jsdelivr.net/npm/marked@13.0.3/marked.min.js' \
     -o price_engine/dashboard/vendor/marked.min.js
   ```

3. **Section registry:** `LIBRARY_SECTIONS` in `app.js` maps nav keys → file paths + titles. The welcome page is hand-rendered HTML; all other sections are fetched + rendered via `marked.parse(md, { gfm: true })`.

Internal markdown links (`[A001](assumptions.md#a001-...)`) are rewritten by `rewriteLibraryMarkdownLinks()` to navigate inside the library via `data-library-section="<key>"`. External links open in new tabs.

The popover positioning was rebuilt during this session because the inline-info-pop was rendering as a narrow column when sitting inside a flex parent. Fix: re-parent the popover to `document.body` on open (escapes parent layout constraints), then restore on close.

## Roadmap surface — three-bucket sidebar widget

`ROADMAP_GROUPS` in `app.js` is the source of truth (was `ROADMAP_ITEMS` before the three-bucket refactor). Each group has a title and an array of items. `renderRoadmapList()` renders group titles inline with items.

The five tracks, grouped:

```
Basis-risk adjustments
  ✓ shipped   · Customer basis risk
   research    · Location basis risk
Trigger alignment
   blocked     · Trigger source alignment
Forward-regime improvements
   planned     · Grid condition
   planned     · Hazard & weather
```

Click any item → opens the library at the `roadmap` section.

## Deployment — Cloud Run

Service: `outage-pricing` at `https://outage-pricing-wsd6lcl64q-uc.a.run.app`. IAP-gated to `domain:aamani.ai`.

GCP coordinates (all pre-provisioned, shared infra):
- Project: `modeling-nonprod-svc-db5x`
- Region: `us-central1`
- AR repo: `infrasuremodelingdocker`
- WIF provider: `projects/952205173464/locations/global/workloadIdentityPools/infrasure-gh-actions-pool/providers/github-repo-provider`
- Deploy SA: `gh-actions-deploy@modeling-nonprod-svc-db5x.iam.gserviceaccount.com`
- Runtime SA: `project-service-account@modeling-nonprod-svc-db5x.iam.gserviceaccount.com`

GitHub repo creation gotcha: the `Divi-patel` gh account doesn't have org-admin in `aamani-ai`. The `D-ivyy` account (inactive in gh) does. Workaround:
```bash
gh auth switch --user D-ivyy
gh repo create aamani-ai/outage_pricing --public --description "..."
gh auth switch --user Divi-patel
```

Workflow trigger: push to `deploy/outage-pricing`. Build time: ~2 minutes end-to-end (pack build + push + Cloud Run deploy + IAP binding).

Container stack: Paketo `builder-jammy-base`, Python runtime, `server.py` launched via Procfile `web: python server.py`. Static-file server with `/` → `/dashboard/` redirect, using `socketserver.ThreadingTCPServer` (concurrent request handling).

Pre-build step in the workflow resolves the methodology symlink:
```bash
if [ -L "${APP_PATH}/dashboard/methodology" ]; then
  rm "${APP_PATH}/dashboard/methodology"
  cp -r docs/methodology "${APP_PATH}/dashboard/methodology"
fi
```

## Data bundling — what's in the deploy branch vs main

`.gitignore` on `main` excludes:
- `price_engine/catalogs/*/pricing/*.json` (drilldown, per-customer view, event evidence)
- `price_engine/catalogs/*/filtration/*.csv` (county tiers)
- `price_engine/catalogs/*/data/*.json` (annualization, events meta)
- `docs/extra/poweroutage_us/` (NDA-scoped vendor materials)
- `docs/extra/outage_data/` (vendor data exports)
- `.claude/` (session state)

On the `deploy/outage-pricing` branch, the dashboard data is force-added:
```bash
git add -f price_engine/catalogs/eagle-i-{30,45,60}min/pricing/county_drilldown.json \
            price_engine/catalogs/eagle-i-{30,45,60}min/pricing/per_customer_view.json \
            price_engine/catalogs/eagle-i-{30,45,60}min/pricing/event_evidence/ \
            price_engine/catalogs/eagle-i-{30,45,60}min/filtration/county_tiers.csv \
            price_engine/catalogs/eagle-i-{30,45,60}min/data/annualization_meta.json \
            price_engine/catalogs/eagle-i-{30,45,60}min/data/events_meta.json
```

Total bundle size: ~570 MB across three catalogs.

## Re-deploy workflow

For future updates:
```bash
git checkout deploy/outage-pricing
git merge main          # bring in the latest main commits
git push                # CI runs, ~2 min, URL stays the same
```

Or manual trigger via the GitHub Actions UI (workflow has `workflow_dispatch: {}`).

## Cache-bust progression

The dashboard's HTML references both stylesheets and the app script with `?v=YYYYMMDD-N` query params. The discipline: bump both on every dashboard edit so soft-refresh always pulls the matching trio.

Today's progression: `20260530-1` (initial Phase 3 deploy) through `20260530-14` (three-bucket reframe).

Memory entry `feedback_dashboard_cache_busting.md` captures the discipline.

## Key insights from the session

1. **Eye-button tooltips need the "honest one-liner" pattern.** A good tooltip lead is the sentence a reader could quote back without reading the body — not technical jargon. Refining Max out / Mean out / Peak %MCC tooltips from "Highest customers_out value..." to "At the event's worst 15-minute EAGLE-I scrape, this many customers were without power" changed the surface from documentation-style to read-aloud-style. The same principle applies to the per-customer mode-note rewrite.

2. **A "customer" in EAGLE-I = a policyholder in our underwriting frame.** This is the cleanest alignment in the entire pipeline: the data unit is the contract unit. The per-customer chain produces a per-policy expected loss with no further unit conversion. Worth re-emphasizing whenever we explain the math.

3. **The shadow framing was the wrong abstraction.** v0 ships with eight assumptions. Adding a ninth (A011) and calling the chain that depends on it "shadow" while v0 (with bigger known biases) is "the price" inverts the accuracy ordering. The graduation reframe was a genuine improvement, not just a relabel.

4. **Three-bucket roadmap is conceptually correct.** The original two-bucket binary (bias-correction vs forward-regime) lumped trigger-alignment with basis-risk adjustments. They're categorically different — trigger alignment is a contract-data integration, not a derivation. The three-bucket framing matches how the team actually works.

5. **"Fix the data input before improving the model" is the sequencing principle.** A perfect forward-regime modifier on top of a misaligned baseline doesn't compensate — it adds modelled signal to a misaligned starting point. Worth documenting explicitly because the order of work isn't obvious to a fresh reader.

6. **Two CDN-class failures and two browser-cache-class failures in one session.** Vendoring marked.js eliminated one class of risk. Cache-bust discipline eliminated the other. Both are now memory entries so future-me bumps the version on every dashboard edit.

7. **Symlinks + Python `http.server` follows-symlinks is a clean live-render pattern.** No build step, no copy step, edits visible on next section load. The deploy workflow resolves the symlink to a real copy so the container is self-contained.

## Verification commands

To confirm the live deploy:
```bash
gcloud --project=modeling-nonprod-svc-db5x run services describe outage-pricing \
  --region=us-central1 --format='value(status.url)'

curl -sI 'https://outage-pricing-wsd6lcl64q-uc.a.run.app/' | head -8
# Expect: HTTP/2 302 + location: accounts.google.com/o/oauth2/v2/auth (IAP working)
```

To check methodology files served correctly:
```bash
for f in roadmap.md per_customer_view_walkthrough.md assumptions.md; do
  curl -sI "http://127.0.0.1:8001/dashboard/methodology/$f" | head -2
done
```

To re-run the Phase 2 pipeline:
```bash
source .venv/bin/activate
python curated_outage_data/pipelines/per_customer_rate/compute_per_customer_lambda.py
```

To re-execute the Phase 1 notebook:
```bash
source .venv/bin/activate
jupyter nbconvert --to notebook --execute --inplace \
  --ExecutePreprocessor.kernel_name=outage-pricing \
  notebooks/per_customer_rate_phase1.ipynb
```
