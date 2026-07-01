# 05 — Analytics Studio v2 (QC → an intuitive, multi-granularity analytics workbench)

**Status:** plan — Phase 0 (quick wins) building now; Phases 1–5 await sign-off + a couple of decisions.
**Grounds:** [`04_analytics_studio.md`](../done/2026-06-28_dashboard_04_analytics_studio_v1.md) (v1) · [`dicsscssion/analytics_studio/00`](../../dicsscssion/analytics_studio/00_purpose_and_shape.md). Direction from Divy 2026-06-28.

---

## The reframe (Divy's key insight)

v1 is labelled "Book overview" but it is really **Quality Control** — and that's good, QC is the load-bearing job.
v2 keeps the QC, makes it **intuitive and playable**, adds the tools to actually *act* on what QC surfaces
(browse/verify clustering, scope to a state, flag uncomfortable counties), and sets up the **root-cause
investigation** of the implausible numbers QC found. A true "book overview" comes later, once we know more.

```text
  Underwriting Studio = depth on ONE quote
  Analytics Studio    = breadth across MANY — and v2 makes it: explore · verify · scope · investigate
```

---

## Phase 0 — quick wins (building now, independent of the rest)

```text
  0a COLOR    map ramp back to a WARM/risk gradient (Divy: indigo is too subtle to pick out high-risk).
              Use an aesthetic rose→crimson sequential (NOT the solid alert-red pill) — a choropleth
              gradient is a different visual register from a status badge, so it doesn't collide with the
              "red = alert" rule (this overrides the v1 review's indigo call; product legibility wins).
  0b CONUS    drop Alaska + Hawaii + territories from the batch (we don't target them; MA-first). Filter
              non-CONUS states in /api/analytics so KPIs / distribution / map / QC are all CONUS.
  0c i-BUTTONS  InfoHint ("i") on the KPI row and on every section (map, distribution) — a first-time
              user should understand each number/panel without asking. (QC card already has one.)
```

## Phase 1 — IA + naming (tabbed section)

The Analytics Studio becomes a **tabbed** section (like the Underwriting Studio), with a **scope control**
(Phase 3) shared across tabs:

```text
  ANALYTICS STUDIO
  ├─ Quality control   (v1, reframed — KPIs · map · distribution · filter · QC tables)   ◀ rename from "Book overview"
  └─ County explorer   (Phase 4 — browse every county's history to verify clustering + decide flags)
```

**Decision needed:** tab/nav names. Proposal: section "Analytics Studio"; tabs **"Quality control"** +
**"County explorer"**. (Open to "Book scan", "Spread & QC", "Clustering review", etc.)

## Phase 2 — interactive filter / cross-filter (fills the gap below the distribution)

The whitespace under the distribution becomes a **filter panel** that makes the section *playable* — choose
a price range / threshold (and optionally tier · regime · excluded) and the matching counties light up on
the map while the rest dim; the distribution shades the selected band; a live "N counties match" updates.

```text
  filter:  premium  [≥ $___]  [≤ $___]      tier [green|amber]   regime [all ▾]   excluded [hide|show]
           ───────────────────────────────────────────────────────────────────────────────────────
           → map: matching counties full-color, others dimmed   → "412 counties match · median $640"
```
This is coordinated-views/brushing (map ↔ distribution ↔ filter). It answers "show me everything between
$X and $Y" and "where are the expensive ones" directly. Cheap data-wise — all rows are already client-side.

## Phase 3 — granularity scope (National · State; city later)

A scope selector at the top of the section: **National | State**. Pick a state (MA first) → KPIs,
distribution, QC, and filter all recompute on that state's counties (client-side filter — no new API), and
the map **fitBounds** to the state. Reuses the sidebar's "context" idea.

```text
  scope:  [ National ▾ ]   →   [ Massachusetts ▾ ]      "MA · 14 counties priced · median $___"
```
**City** is *not* natural for county-level pricing (a city = within-county = the Location factor, a
different lane). Recommend **state for v2, defer city** (could later mean "a metro's counties"). Decision:
confirm state-only for v2.

## Phase 4 — County explorer (verify clustering + decide flags)

A searchable **county dropdown** (scoped) → click a county → its **historical timeline** (annual qualifying
events per year, from `studio.json perT`) + **regime read** (label · confidence · sub · cross-T) +
exclusion status & reason. The breadth tool for **QC-ing the clustering** (does the label match the
history?) and for **deciding which counties we're not comfortable pricing** (mostly insufficient-data).
Deep-links to the full Underwriting Studio for depth.

```text
  [ search county ▾ ]   Henderson, NC
  regime  Trend · high conf · ↑           timeline ▁▂▃▄▆█▇  (annual ≥8h events, 2015–2025)
  n_obs 11 · total 2,012                  → "does the trend label match? flag / comfortable?"
```
Data: reuse `/api/studio` via the county centroid (already wired) for the per-county series; or extend the
batch to carry a compact timeline. **Flagging mechanism** (persisted "do-not-price") is a follow-on that
connects to the Rules Engine *excluded territories* — Phase 4 first makes the decision *informed*.

## Phase 5 — root-cause the implausible λ (the real prize)

QC surfaced it; now fix it. **Investigation workstream** (lives in the pricing pipeline / notebooks, not
web/):

```text
  1. TRACE   Henderson NC λ_customer≈715/yr @ 8h (→ $3M) back through build_data.py → per-customer λ
             → λ_county × share-out → the event catalog. Where does 715/yr come from? (over-counted
             events? share-out≈1 bug? MCC/customer-base error? missing-data-as-zero?)
  2. CAUSE   identify the mechanism for the ~5 high outliers AND the broader pattern (17 counties >$10k).
  3. FIX     correct in the pipeline; re-emit pricing.json; re-verify the Analytics tails.
  4. DOCUMENT  write it up (a learning log + an assumption/cell-read note) so it can't silently recur.
  + FLAGGING POLICY  decide how we mark "not comfortable pricing" (insufficient-data + artifact counties)
             — feeds the County explorer (Phase 4) and the Rules Engine excluded set.
```
This is research-grade and needs the actual pipeline data; scope it as its own effort after the UI v2.

---

## Sequencing

```text
  Phase 0  quick wins (now)          → review on localhost
  Phase 1  tabbed IA + naming        → small, after naming decision
  Phase 2  interactive filter        → medium (the "playable" win)
  Phase 3  state granularity         → medium
  Phase 4  county explorer           → medium  (Phases 2–4 each reviewed before the next)
  Phase 5  λ investigation + flags   → separate research workstream (the necessary prize)
```

## Decisions to confirm
1. **Color** — warm rose→crimson gradient (my pick) vs a specific shade you have in mind. (See it live in Phase 0.)
2. **Tab/section names** — "Quality control" + "County explorer" under "Analytics Studio"?
3. **Granularity** — state-only for v2, city deferred?
4. **Investigation ownership** — is Phase 5 mine to drive (trace + propose fix + document), with you on the cause call?

## Principles
`communicate_to_share` (i-buttons; the filter/explorer must each change a decision; one headline) ·
`model_to_the_consequence` (QC stays the spine; the investigation targets the costly under/over-price) ·
`county_specificity` (the explorer verifies the *grouping* — clustering — directly).
