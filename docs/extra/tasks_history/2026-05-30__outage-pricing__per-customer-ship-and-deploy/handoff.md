# Handoff — 2026-05-30

For the next session / model switch / new teammate. Read this in 60 seconds; act on the **Next action** section.

## 10-bullet summary

1. **Per-customer chain is the dashboard's headline annual premium as of today.** v0 county-trigger remains as a muted reference / sensitivity view below it. Phase 5 governance decision: terminal state (b) Activate as numeric multiplier.
2. **A011 is the one new assumption** (synchronous-outage approximation), captured in the registry with a stated resolution path. Bias-risk adjustment activation pattern: registry-with-resolution-path, not external-validation gate.
3. **Dashboard is live at https://outage-pricing-wsd6lcl64q-uc.a.run.app**, IAP-gated to `@aamani.ai`. Auto-redeploys on push to `deploy/outage-pricing`.
4. **GitHub repo: https://github.com/aamani-ai/outage_pricing** (public, link-only sharing). Created via the `D-ivyy` gh account (only one with aamani-ai org admin). Main branch is data-free; deploy branch carries the ~570 MB bundled artifacts.
5. **Methodology folder + library are live.** 11 stable-ID assumptions (A001–A011). In-app `Library` button opens a slide-out drawer rendering markdown via vendored marked.min.js. No CDN dependency for the renderer.
6. **Three-bucket roadmap** in the sidebar widget: Basis-risk adjustments (customer ✓, location pending) / Trigger alignment (blocked) / Forward-regime improvements (grid, hazard). Sequencing principle "fix data input before improving the model" documented in both `roadmap.md` and `outage_baseline_adjustment_framework.md`.
7. **Per-customer chain numbers land in $10–$300/yr range** (vs v0's $10k–$300k/yr) for typical SMB-scale T and X. Sensitivity bands (median and max estimators) are shown in the chain footnote so the reader sees the heavy-tail dependency.
8. **Phase 4 (PoUS per-`OutageId` validation) is queued as refinement, not a gate.** Data already staged at `docs/extra/poweroutage_us/data/historical_trial/` (gitignored — local-only). Notebook 03 design exists in `06_findings.md` "Next experiments" section.
9. **Slack message drafted** at the end of the session for sharing the live URL with the team. Asks one core question: "does the dollar amount look reasonable now?"
10. **Two recurring fragilities resolved in memory:** cache-bust `?v=` discipline on every dashboard edit; vendored marked.min.js to eliminate the CDN class of failure. Both saved as feedback / reference memory.

## Files to read first (in order)

```text
docs/extra/tasks_history/2026-05-30__outage-pricing__per-customer-ship-and-deploy/task_context.md
docs/methodology/roadmap.md          ← the three-bucket framing + sequencing principle
docs/methodology/per_customer_view_walkthrough.md   ← the per-customer math, Boone MO example, A011 in long form
docs/methodology/assumptions.md       ← A001-A011 with stable IDs
docs/plan/per_customer_pricing_plan.md   ← all five phases of the per-customer track (Phase 5 closure block at the top)
docs/plan/outage_baseline_adjustment_framework.md   ← the refined three-bucket activation table + sequencing principle
curated_outage_data/model_cards/customer_impact_v1.md   ← status: shipped; A011 cited; Phase 4 = refinement queue
curated_outage_data/schemas/per_customer_lambda.md   ← exact field semantics
```

For the dashboard surface itself:
```text
price_engine/dashboard/app.js         ← ~2300 lines; sections marked with ============ headers
price_engine/dashboard/index.html
price_engine/dashboard/styles.css
.github/workflows/deploy-outage-pricing.yml
```

## Repro commands

Verify the live deploy is up:
```bash
gcloud --project=modeling-nonprod-svc-db5x run services describe outage-pricing \
  --region=us-central1 --format='value(status.url)'
# Expect: https://outage-pricing-wsd6lcl64q-uc.a.run.app

curl -sI 'https://outage-pricing-wsd6lcl64q-uc.a.run.app/' | head -8
# Expect: HTTP/2 302 + location: accounts.google.com/o/oauth2/v2/auth (IAP working)
```

Re-run the Phase 2 pipeline (~25s):
```bash
cd /Users/divy/code/work/infrasure_git_codes/outage_pricing
source .venv/bin/activate
python curated_outage_data/pipelines/per_customer_rate/compute_per_customer_lambda.py
```

Re-execute the Phase 1 notebook:
```bash
source .venv/bin/activate
jupyter nbconvert --to notebook --execute --inplace \
  --ExecutePreprocessor.kernel_name=outage-pricing \
  notebooks/per_customer_rate_phase1.ipynb
```

Local dashboard (long-running server already on :8001):
```bash
# If not running:
python -m http.server 8001 --bind 127.0.0.1 --directory \
  /Users/divy/code/work/infrasure_git_codes/outage_pricing/price_engine
# Open: http://127.0.0.1:8001/dashboard/
```

To deploy after future edits:
```bash
# Edit on main, commit, then:
git checkout deploy/outage-pricing
git merge main          # brings in the new commits
git push                # CI runs ~2 min, URL stays the same
```

## Next action (primary focus — start executing from here)

The session ended with the dashboard live and a Slack message drafted. The team review is the input to the next session.

### Phase A — Collect team feedback (no code work)

1. User sends the Slack message (drafted in the final assistant message of this session — recover from the chat transcript or paste from the `decisions.md` Decision 4 area).
2. Wait for feedback. Core feedback question: **does the dollar amount look reasonable now?** Secondary feedback: anything aesthetic / wording / methodology unclear?

### Phase B — Triage the feedback and pick the next track

Three plausible next directions, depending on what the team says:

**Path B1 — Phase 4 (PoUS per-`OutageId` validation).** Tightens A011 with empirical evidence. Concrete steps:

1. Read `docs/extra/poweroutage_us/docs/06_findings.md` "Next experiments" section.
2. Create `notebooks/per_customer_rate_phase4_pous_validation.ipynb`.
3. Load `docs/extra/poweroutage_us/data/historical_trial/POUS_Citybyutility_Hourly_20190101_20190331.csv`.
4. Stitch consecutive nonzero hours into per-`(City, Utility)` events with their own durations and peak counts.
5. Map city → FIPS using the `CountyName` field already present in the extract.
6. Compute `lambda_per_outage_customer(T)` directly — no synchronous approximation.
7. Compute `lambda_customer(T)` from EAGLE-I 2019 slice for MA / CT / RI.
8. Compare side-by-side; quantify the disagreement.
9. Output: either confirmation of A011 within sensitivity band (update status to `validated`) or a correction factor folded into the multiplier formula.

Expected effort: 1–2 days of analysis. Data is already staged. No vendor dependency.

**Path B2 — Location basis risk research.** Next bias-risk adjustment in the queue. Concrete steps:

1. Read `docs/dicsscssion/location_aware_outage_pricing/01_problem_framing.md` and `02_research_backlog.md` if it exists, otherwise the framing doc alone.
2. Identify candidate data sources: utility service-territory shapefiles, AMI penetration, feeder maps, PoUS per-outage point geometry.
3. Define a candidate `location_basis_factor(premise, county, T)` — proposed formula + assumption (the new A012 entry in the registry once written).
4. Build a county-year backtest where premise-level data is available (probably MA / CT / RI from PoUS).
5. Output: a Phase-2-style shadow column for location adjustment, or a documented "blocked on premise data" status.

Expected effort: 1–2 weeks (longer than Phase 4 because data sources are not all in hand).

**Path B3 — Dashboard polish based on team feedback.** If team feedback is mostly about wording / aesthetics / specific cells looking weird, this is the right path. Likely items:

1. Specific counties or T/X combinations the team flags as unintuitive.
2. Possible additional methodology library sections (e.g. "How to read the matrix" tutorial).
3. Map view "color by" addition (per-customer retail at a specific T/X is currently county-trigger only).

### Phase C — Whichever path B picks, follow the workflow

Established discipline:
- Plan doc first (write or extend the relevant `docs/plan/` file)
- Notebook / lab work next
- Pipeline / dashboard implementation after
- Methodology doc updates AS the implementation lands, not after
- Cache-bust + commit + merge to deploy + push for each iteration

## Critical context / gotchas

1. **Cache-bust on every dashboard edit.** Bump both `app.js?v=` and `styles.css?v=` in `index.html`. Memory entry `feedback_dashboard_cache_busting.md` has the full reasoning. Current version: `20260530-14`.

2. **The methodology symlink.** `price_engine/dashboard/methodology → ../../docs/methodology`. Don't delete or replace locally — the dashboard library 404s without it. The deploy workflow resolves it to a real copy in CI.

3. **GitHub repo creation requires the `D-ivyy` gh account** (the only one with aamani-ai org admin). `Divi-patel` is the daily-driver account but can't create repos in the org. For any new repo creation: `gh auth switch --user D-ivyy && gh repo create ... && gh auth switch --user Divi-patel`.

4. **Two GitHub accounts and an SSH alias.** Remote uses `git@github.com-work:aamani-ai/outage_pricing.git`. The `github.com-work` SSH alias is configured in the user's `~/.ssh/config`. Don't use plain `github.com` — it'll try to push as `Divi-patel`'s personal SSH key.

5. **NDA-scoped vendor materials.** `docs/extra/poweroutage_us/` and `docs/extra/outage_data/` are gitignored. Vendor PDFs, raw API responses, and the API key live there. **Do not commit anything from these folders, ever.**

6. **The `.claude/` session-state folder is gitignored.** Memory persists across sessions via `/Users/divy/.claude/projects/-Users-divy-code-work-infrasure-git-codes-outage-pricing/memory/`.

7. **v0 pricing math has not changed and must not change without explicit user approval.** `price_engine/data/`, `pricing/`, `filtration/` are byte-identical to the pre-session state. Per-customer is a curated_outage_data/-side derivation, served alongside v0 in the dashboard. The user is firm on this — v0 stays defensible and reproducible from raw CSVs.

8. **Phase 4 is refinement, not a gate.** If anyone says "we can't ship per-customer until Phase 4 lands," gently correct: the bias-risk-adjustment activation pattern (registry-with-resolution-path, documented in the adjustment framework) is the right activation rule. External validation is refinement. The reasoning is in `docs/methodology/per_customer_view_walkthrough.md#the-one-assumption-you-must-read--a011`.

9. **The dashboard's `python server.py` is a custom ThreadingHTTPServer.** Don't replace with `python -m http.server` for Cloud Run — the custom version handles `/` → `/dashboard/` redirect and threading. Local dev still uses `python -m http.server` on port 8001; production uses `server.py`.

## Data state (what's already available vs what needs fetching)

Already available locally (gitignored):
- `price_engine/data/raw/eaglei_outages_YYYY.csv` × 12 (2014–2025), `MCC.csv`, `coverage_history.csv`, `DQI.csv`
- `price_engine/data/events.parquet` (~14M rows) and per-catalog variants
- `price_engine/catalogs/eagle-i-{30,45,60}min/` full artifact sets (pricing, filtration, data)
- `curated_outage_data/outputs/per_customer_rate/per_customer_lambda__<catalog>.{parquet,json}` (×3)
- `notebooks/outputs/per_customer_rate_phase1/` (HTML report + results.json)
- `docs/extra/poweroutage_us/data/historical_trial/POUS_Citybyutility_Hourly_20190101_20190331.csv` (MA / CT / RI hourly, ~1M rows)
- `docs/extra/poweroutage_us/data/snapshots/` (live API captures)

Needs fetching:
- A vendor-licensed PowerOutage.US live API contract (for any production trigger-source work).
- VT historical extract (was missing from the original PoUS HighTail delivery).
- EIA-861 reliability data (for grid-condition track when that track activates).
- NOAA Storm Events for hazard-weather track.

## Acceptance criteria for this session — all met

- [x] Per-customer chain shipped as the dashboard headline.
- [x] A011 in the registry with resolution path.
- [x] Methodology folder + library live.
- [x] Roadmap surface with three-bucket framing + sequencing principle.
- [x] Cloud Run deploy live + IAP-gated.
- [x] GitHub repo public, source visible.
- [x] Slack message drafted for team review.
- [x] Memory entries persisted for cross-session continuity.
- [x] Task documentation in `docs/extra/tasks_history/` (this file).
