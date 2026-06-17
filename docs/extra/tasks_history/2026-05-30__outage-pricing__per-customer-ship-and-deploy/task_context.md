# Task Context

Date: 2026-05-30
Area: outage-pricing
Slug: per-customer-ship-and-deploy

## Objective

Take the per-customer pricing track from "math + idea" to **shipped headline price on a team-shared Cloud Run deployment**, with full methodology documentation, an in-app reading library, and a refined three-bucket roadmap that team members can navigate without prior context.

## Background

Coming into this session the project state was:

- v0 historical pricing engine fully reproduced from raw EAGLE-I data.
- Dashboard locally served at `http://127.0.0.1:8001/dashboard/` from a long-running `python -m http.server`.
- Plans laid out for adjustment-framework / customer-impact modifier / per-customer pricing — but no execution and no in-app methodology surface.
- One unresolved usability concern from the previous session: v0 retail premium numbers were defensible as math but looked unreasonable as customer-facing prices ($100k–$300k/yr).

The session goal: walk the per-customer track end-to-end, ship it, and put a working surface in front of the team for feedback. Along the way: build the methodology folder + library so the methodology survives team turnover, and refine the roadmap framing so the work order makes structural sense.

## Problems we were solving

1. **The "unreasonable price" gap.** v0 county-trigger retail premium quoted per customer was 30–100× higher than commercially plausible. Reason: the data measures county-event rate, but the contract is sold per customer (one policy per metered electric account). Closing the gap required a per-customer adjustment.
2. **No in-app methodology surface.** Methodology was in markdown files only; readers had to clone the repo to understand the math. Friction for stakeholders, regulators, and future teammates.
3. **Roadmap presentation was muddled.** Tracks were initially presented as a flat "bias-correction vs forward-regime" binary, which obscured the actually-useful distinction the team operates on (basis-risk adjustments / trigger alignment / forward-regime improvements).
4. **Two recurring dashboard fragilities** (cropped up twice this session): browser cache mismatch after edits, and external CDN flakiness for d3 / Plot / maplibre.
5. **Customer-impact "shadow" framing created cognitive friction.** Shipping per-customer as shadow while v0 (with bigger known biases) was the headline inverted the accuracy ordering and confused readers.
6. **Deployment.** Local dashboard only — needed a team-shareable URL with sign-in gating to aamani.ai.

## What we fixed (high level — see notes.md for command-level detail)

1. **Phase 1 — Math validation notebook** at `notebooks/per_customer_rate_phase1.ipynb`. Five-county sample (Alachua, Manatee, Marion, Miami-Dade FL + Custer SD), three catalogs (30 / 45 / 60-min). Reproduced v0 byte-for-byte; documented mean vs median vs max sensitivity; surfaced the heavy-tail + bridged-gap + coverage-density nuances.
2. **Phase 2 — Curated pipeline** at `curated_outage_data/pipelines/per_customer_rate/compute_per_customer_lambda.py`. Emits `per_customer_lambda__<catalog>.parquet` (~15,450 rows per catalog) with mean / median / max estimators, p10–p99 sensitivity bands, three-status coverage gate. Cross-catalog stability passed: 98% of `available` cells at T=4h within ±20% across 30/45/60.
3. **Phase 3 — Dashboard side-by-side surface** with View segmented control (Per-customer / County trigger / Multiplier), drilldown chain reordered so per-customer renders first, dynamic matrix legend explaining the caution-stripe.
4. **Methodology folder** at `docs/methodology/` with:
   - Pipeline-step methodologies (data ingestion / event catalog / aggregation / filtration / pricing).
   - `assumptions.md` stable-ID registry (A001–A011).
   - `per_customer_view_walkthrough.md` end-to-end Boone, MO walkthrough.
   - `roadmap.md` with three-bucket categorization + "Why this order matters" principle.
5. **In-dashboard Methodology Library** — header `Library` button opens a right slide-out drawer rendering markdown live via vendored marked.min.js. 9 sections, internal cross-links, expand-to-full-screen.
6. **Sidebar "What's next" widget** — five tracks grouped into three buckets (basis-risk / trigger alignment / forward-regime). Click opens library at the roadmap.
7. **Eye-button popovers wired to library** — coverage-gate, mode-notes, per-customer chain CTA all link to the relevant methodology section.
8. **GitHub icon + "View source" link** in the library footer.
9. **Cloud Run deployment** at `https://outage-pricing-wsd6lcl64q-uc.a.run.app`, IAP-gated to `domain:aamani.ai`. Source at `https://github.com/aamani-ai/outage_pricing`. Auto-redeploy on push to `deploy/outage-pricing` branch.
10. **Per-customer graduation reframe** (post-deploy session work):
    - Added **A011** capturing the synchronous-outage approximation in the assumptions registry.
    - Updated `customer_impact_v1` model card status: shadow → shipped.
    - Refined the modifier-lifecycle to distinguish bias-risk-adjustment (assumption-registry pattern) from forward-regime (external validation pattern).
    - Removed "shadow" framing throughout dashboard and docs.
    - Per-customer is now the dashboard's headline annual premium; v0 county-trigger renders below as a muted reference / sensitivity view.
11. **Three-bucket roadmap** with "Why this order matters" sequencing principle written into both `roadmap.md` and `outage_baseline_adjustment_framework.md`. Sidebar widget grouped accordingly.
12. **Recurring-incident fixes** captured in memory: cache-bust `?v=` discipline on every dashboard edit; vendored marked.min.js to eliminate the CDN class of failure.
13. **Slack message drafted** for team review, with three bullets and a sequencing-principle paragraph.

## Files touched

### Created (new)

- `notebooks/per_customer_rate_phase1.ipynb` + `notebooks/outputs/per_customer_rate_phase1/`
- `curated_outage_data/pipelines/per_customer_rate/{README.md, compute_per_customer_lambda.py}`
- `curated_outage_data/schemas/per_customer_lambda.md`
- `curated_outage_data/validation/per_customer_lambda_qa_plan.md`
- `curated_outage_data/model_cards/customer_impact_v1.md`
- `curated_outage_data/plan/05_phase_per_customer_rate.md`
- `docs/methodology/` (entire folder: README, assumptions, per_customer_view_walkthrough, roadmap, 5 pipeline-step methodology files)
- `docs/plan/per_customer_pricing_plan.md`
- `docs/plan/methodology_library_plan.md`
- `docs/plan/done/README.md` (archive convention)
- `price_engine/server.py` (Cloud Run static server)
- `price_engine/Procfile`, `price_engine/requirements.txt`
- `price_engine/dashboard/vendor/marked.min.js` (vendored)
- `price_engine/dashboard/methodology` (symlink → ../../docs/methodology)
- `.github/workflows/deploy-outage-pricing.yml`
- `docs/extra/tasks_history/2026-05-30__outage-pricing__per-customer-ship-and-deploy/` (this folder)

### Modified

- `price_engine/dashboard/{index.html, app.js, styles.css}` (extensively across the session)
- `docs/plan/README.md`, `docs/plan/outage_baseline_adjustment_framework.md`, `docs/plan/forward_looking_modeling_plan.md`, `docs/plan/trigger_source_implications.md`
- `docs/dicsscssion/location_aware_outage_pricing/01_problem_framing.md` (cross-links)
- `curated_outage_data/plan/README.md`
- `.gitignore` (added PoUS folder, outage_data exports, .claude/ for public-repo safety)

### Generated locally (gitignored; force-added to deploy branch only)

- `curated_outage_data/outputs/per_customer_rate/per_customer_lambda__<catalog>.parquet` (×3)
- `curated_outage_data/outputs/per_customer_rate/per_customer_view__<catalog>.json` (×3)
- Mirrored at `price_engine/catalogs/<catalog>/pricing/per_customer_view.json` for dashboard serving

### GitHub repo

- Created `aamani-ai/outage_pricing` (public, link-only visibility)
- `main` and `deploy/outage-pricing` branches

### Memory entries added/updated

- `feedback_planning_workflow.md` — research → reason → plan → implementation → feedback discipline
- `reference_done_folder_convention.md`
- `project_per_customer_pricing_plan.md`
- `reference_methodology_folder.md`
- `reference_assumptions_registry.md`
- `reference_walkthrough_docs.md`
- `reference_methodology_library.md`
- `feedback_dashboard_cache_busting.md`

## Current status

- [x] Per-customer chain shipped as dashboard headline price.
- [x] v0 county-trigger preserved as a muted reference view.
- [x] Methodology folder + 11 stable-ID assumptions (A001–A011) documented.
- [x] In-app methodology library with live markdown rendering, working from anywhere in the dashboard.
- [x] Forward-looking roadmap with three-bucket framing + sequencing principle.
- [x] Cloud Run deployment live, IAP-gated to aamani.ai.
- [x] Public GitHub repo with main + deploy branches.
- [x] Slack message drafted for team sharing.
- [x] Recurring-incident fixes (cache-bust, vendored marked.js) in place.
- [ ] Team feedback on the live URL (pending after share).
- [ ] Phase 4 — PowerOutage.US per-`OutageId` validation (queued as refinement; not gating).
- [ ] Location basis-risk adjustment (next bias-risk track; research phase).

## Next steps (post-session)

1. Send the drafted Slack message to the team and collect feedback on the per-customer dollar amounts.
2. When team feedback is in, decide whether to proceed with Phase 4 refinement immediately or pivot to Location basis risk research first.
3. If Phase 4 starts: notebook at `notebooks/per_customer_rate_phase4_pous_validation.ipynb`. Data staged at `docs/extra/poweroutage_us/data/historical_trial/`. City→FIPS join is the first work item.
4. Day-2 ops as needed: custom domain (e.g. `outage-pricing.aamani.ai`), `--min-instances=1` to eliminate cold-start, secrets via Infisical if any new vendor integration lands.
