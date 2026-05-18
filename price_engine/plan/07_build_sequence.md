# 07 — Build Sequence

How we actually get from "plan exists" to "dashboard works." Ordered, with explicit decision points where I'll come back to you.

The principle: build end-to-end at the smallest possible scale first (one state, three counties), get the engine and the dashboard talking to each other, then widen coverage. Do not try to perfect any one stage before the others exist.

## The seven steps

### Step 1 — Data inventory & event-log canonical form
**Goal.** A single `data/events.parquet` matching the schema in `06_data_pipeline.md`, populated from whatever EAGLE-I-derived files we already have.

**Tasks.**
- Audit existing repo for prior event-log work (likely under `outage_modeling_us/data/` or a sibling).
- Decide whether to reuse the existing event boundary logic or recompute.
- Produce `events.parquet`, verify spot-checks against a known event (e.g. a publicised hurricane).
- Output a one-page `data/INVENTORY.md` documenting what was found, what was reused, what was rebuilt.

**Come-back point.** After audit, before building any new logic — I'll surface what already exists and you decide reuse vs rebuild.

### Step 2 — Aggregation & summary artifacts
**Goal.** `county_summary.parquet` and `county_durations.parquet` populated for every FIPS in EAGLE-I coverage.

**Tasks.**
- Implement Stage 2 of the pipeline.
- Pull average-customers from Census + EAGLE-I as needed.
- Spot-check three counties manually (one populous, one rural, one heavy-storm).

**Come-back point.** Show you the summary file for the spot-check counties before moving on.

### Step 3 — Filtration & tier assignment
**Goal.** `county_tiers.csv` for all counties, plus a quick national distribution: how many Green / Amber / Red, by state.

**Tasks.**
- Implement Stage 3 with thresholds from `filtration/thresholds.yml` as specified in `03_filtration_framework.md`.
- Generate national tier histogram.
- Output an "early calibration" markdown showing where the threshold defaults are too loose or tight, with the option to revise them before proceeding.

**Come-back point.** Show you the tier distribution; we may want to adjust thresholds before pricing.

### Step 4 — Pricing engine + per-county premiums
**Goal.** `county_premiums.csv` and `county_drilldown.json`, computed for every Green and Amber FIPS at the standard `(T, X)` grid.

**Tasks.**
- Implement `pricing/empirical_s.py`, `pricing/exposure.py`, `pricing/premium.py`.
- Add `confidence/load.py` stub (returns zero, ignores everything else).
- Run end-to-end; produce premium CSV.
- Sanity check: do premiums vary in the directions we'd expect (urban-hurricane > rural-stable > etc.)?

**Come-back point.** Show you a sample premium matrix for ten counties across diverse profiles. If anything looks wrong, fix here before building UI.

### Step 5 — Dashboard skeleton (one state)
**Goal.** Static site that loads the three CSVs and renders Map + Matrix + Drill-down for a single state (probably Florida — high data density, lots of variation, clean test).

**Tasks.**
- Pick tech stack: lean toward MapLibre + Observable Plot in a Vite + React static build. Open to changes here.
- Implement all three views end-to-end.
- Make Florida fully clickable; everything else greyed out.
- Deploy to GitHub Pages for review.

**Come-back point.** Live demo of the Florida slice. You review UX, drill-down readability, what's missing.

### Step 6 — National rollout
**Goal.** All 50 states + DC live on the dashboard.

**Tasks.**
- Wire all counties into the Map.
- Generate all per-county drill-down JSONs.
- Performance pass (county polygons total ~3,100; need to be smart about not rendering all at national zoom).
- Update README with deployed URL.

**Come-back point.** National demo, with you exploring it yourself for an hour. Punch list of fixes.

### Step 7 — Documentation, write-up, handoff
**Goal.** A v0 reviewable by both the modeling team and the insurance team.

**Tasks.**
- Top-level write-up explaining what v0 is, what it isn't, how to read the dashboard.
- "Insurance team primer" — 2-page non-technical overview.
- "Modeling team defense" — 5-page technical justification.
- Open issues list for v0.5 (confidence load + distribution-family fitting) and v1.

**Final review.** Walk through with you, identify the first v0.5 work to start on.

## Estimated effort (not commitments, just rough sizing)

| Step | Rough effort |
|---|---|
| 1 — Inventory | 1 working session |
| 2 — Aggregation | 1–2 sessions |
| 3 — Filtration | 1 session |
| 4 — Pricing engine | 1–2 sessions |
| 5 — Dashboard skeleton | 3–4 sessions |
| 6 — National rollout | 2 sessions |
| 7 — Documentation | 1 session |

Total: roughly 10–12 working sessions to ship v0. The dashboard is the long pole.

## Decision points where I will explicitly stop and ask

- **End of Step 1.** Reuse vs rebuild event-log code.
- **End of Step 3.** Tier-threshold calibration before pricing.
- **End of Step 4.** Premium sanity check before UI.
- **End of Step 5.** UX review on the Florida slice before national rollout.
- **End of Step 6.** Final punch list.

At any other point: if I hit something ambiguous, I will ask rather than pick.

## What I'd like to do *next* (immediately after this plan is approved)

Step 1 — data inventory. I'd open the existing `outage_modeling_us/data/` and adjacent folders, document what we already have, and surface the reuse-vs-rebuild question. That's a low-risk, high-information first move.

Confirm and I start there.
