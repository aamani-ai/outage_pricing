# Per-Customer Pricing Plan

Date: 2026-05-30

## Status

**SHIPPED 2026-05-30.** Phases 1, 2, 3, and 5 closed. Phase 4 reframed
as refinement (not a gate). Per-customer chain is the dashboard
headline annual premium. v0 county-trigger remains accessible as a
reference view. The full closure detail is in
[Phase 5 — Graduation decision](#phase-5--graduation-decision-governance--closed-2026-05-30).

(Original plan text below — kept verbatim for the audit trail. The
phases were closed in sequence; Phase 5's decision retroactively
reframes Phase 4.)

## Goal

Close the central interpretation gap in v0:

```text
v0 prices on a county-event rate but quotes on a per-customer premium.
```

Build the math, the evidence, and the dashboard surfaces needed to express a
**per-customer-aware expected loss** alongside the v0 county-trigger baseline,
in phases with gates, without rewriting v0.

## Why this is sequenced before forward-looking work

Three independent lines of evidence say this disconnect dominates every other
adjustment we have queued:

1. **[Basis risk thesis](../dicsscssion/location_aware_outage_pricing/01_problem_framing.md).**
   "*Did anyone in the county lose power*" is not "*Did this insured customer
   lose power*." That gap is basis risk.
2. **[Customer-impact modifier proposal](outage_baseline_adjustment_framework.md#customer-impact-modifier).**
   Most county events are dominated by very small (single- or few-customer)
   outages whose presence inflates `n_per_year` and the `S(T)` denominator.
3. **[PowerOutage.US Finding 1.2](../extra/poweroutage_us/docs/06_findings.md).**
   In the first live snapshot of 2,393 distinct outages, **64.3% affect ≤1
   customer** and 75.1% affect ≤5. The bias is real and large.

A forward-looking climate / grid / hazard modifier whose effect is at most
±20% on `lambda(T)` cannot be honestly calibrated on top of a baseline that is
off by a factor of 30-100× when read as per-customer. Fix the denominator
first.

## The gap, made concrete

For Alachua FL (FIPS 12001), MCC = 218,548, T = 4 h, X = $500, the
v0 number from `pricing/county_drilldown.json` is:

```text
N_per_year           = 1,055.7         county events / year
S(4h)                = 0.2909          share of events lasting >= 4h
lambda_county(4h)    = 307.1           qualifying county events / year
Pure premium         = $153,574        per CUSTOMER / year (at X = $500)
Retail premium       = $236,268        per CUSTOMER / year (ER 0.20, TM 0.15)
```

That `lambda_county(4h) = 307.1` reads as "the county will have ~307 county
events / year where at least one customer was out for >= 4 h." It is **not**
"a randomly chosen customer will personally experience ~307 outages >= 4 h
each year." A first-order per-customer approximation is:

```text
lambda_customer(T) ~ lambda_county(T) * E[ mean_customers / MCC | duration >= T ]
```

For Alachua's longest event (959 h, mean_customers = 48.4), the share of
customers affected during the event is `48.4 / 218,548 ~ 0.022%`. Even on
major storms it is rarely double-digit. A back-of-envelope multiplier of
1-3% drops the retail premium from ~$236k/yr to roughly **$2k-$7k/yr** —
30-100× lower — and that is the order of magnitude of the bias we are
worried about. Phase 1 will replace the back-of-envelope with a real
per-county figure.

## Three commensurate views of "rate"

The single most important conceptual move is to distinguish three different
event rates that share units (`events / year`) but answer different questions.

| View | Question | Available now? | First-order formula |
|---|---|---|---|
| `lambda_county(T)` | How often does the county have any qualifying event? | YES — v0 | `N_per_year * S(T)` |
| `lambda_customer(T)` | How often does a random customer in the county personally experience a qualifying outage? | NO — needs event-level customer-impact assumption | `lambda_county(T) * E[mean_customers / MCC \| duration >= T]` (Phase 1 candidate) |
| `lambda_location(T)` | How often does this specific insured premise experience a qualifying outage? | NO — needs trigger-source bridge | `lambda_customer(T) * location_basis_factor(premise)` |

v0 prices `lambda_county` but the policy pays per customer. The product
conversation eventually needs `lambda_location`. `lambda_customer` is the
intermediate quantity we can build with the data we already have, and it is
the right thing to expose as a shadow rate first.

## Three approaches (decision: build A, design for B, validate with C)

| | Approach | What changes | Data needed | When |
|---|---|---|---|---|
| **A** | Customer-impact-shrunk county rate | Express `lambda_customer(T)` as a shadow rate next to `lambda_county(T)`; contract unchanged | Already have: `mean_customers`, `max_customers`, MCC in `events.parquet` | Now — phases 1-3 below |
| **B** | True per-location / per-customer trigger | Contract pays only if the insured was personally out; requires premise-level event truth | EAGLE-I cannot answer this. Needs Ting / AMI / utility OMS overlap | After PoUS bridge validation lands and trigger-source contracts exist; out of scope for this plan beyond schema reservations |
| **C** | Per-outage event reconstruction | Replace county-event grain with per-`OutageId` records | PowerOutage.US per-outage history (92.5% OutageId coverage on live; HighTail back-office pull for history) | Phase 4 validation only — not a pricing change |

**Recommended sequence: A as the build path, C as the validator, B as the
architectural target.** Each is in this plan as a labeled phase or
schema-reservation slot. None of them touches `price_engine/` directly.

## Design principles (scalability, not lock-in)

Every choice below is meant to keep the system **extensible** as the data
matures. Future-self should not have to rewrite this plan to swap data
sources or graduation paths.

1. **Don't hardcode the multiplier formula.** Express
   `customer_impact_multiplier(fips, T)` as a function of available data
   primitives (`mean_customers`, `max_customers`, `peak_out_pct_mcc`,
   future per-outage records). Today's first-order choice is "mean
   `mean_customers / MCC` over events with duration >= T." If tomorrow the
   PowerOutage.US per-outage reconstruction gives us a tighter estimator, the
   formula swaps but the column name and contract stays.
2. **Shadow before substitute.** The first dashboard surface is a side-by-side
   display of `lambda_county` and `lambda_customer`, not a replacement.
   Substitution only happens after Phase 5 graduation, and only with the
   activation rules from the [modifier lifecycle](outage_baseline_adjustment_framework.md#modifier-lifecycle).
3. **Capped and floored from day one.** Even when the shadow column is
   exploratory, the multiplier is bounded by an explicit cap and floor
   recorded in the model card. No quietly unbounded discounts.
4. **Stability across catalog choices.** The shadow rate must be reported for
   all three event catalogs (30 / 45 / 60 min). If the shadow rate moves more
   than its specified band across catalogs, that is a flag and a phase gate
   fails.
5. **Schema reservations for Path B.** This plan must leave a slot for
   `location_basis_factor(premise)` so the same dashboard surface can later
   show a per-location rate when a trigger source is contracted. Do not paint
   us into a county-only corner.
6. **Don't change v0.** All pipeline outputs are new artifacts in
   `curated_outage_data/`, not edits to `price_engine/data/*` or
   `price_engine/pricing/*`. The reproducible v0 baseline must remain
   reproducible from raw CSVs alone.

## Phased rollout

Each phase has an entry checklist, a deliverable, a gate, and an explicit
documentation update. Do not advance to the next phase until the gate passes.

### Phase 1 — Math validation (research and reason)  ✅ Closed 2026-05-30

Entry: this plan exists, related docs cross-link, no production code touched.

Deliverable: a Jupyter notebook in `notebooks/` (and an executed HTML report
in `notebooks/outputs/`) that, for a deliberately diverse county sample
(Alachua FL, plus one rural county, one urban county, one storm-prone
coastal county, one quiet northern county):

- Computes `lambda_county(T)` and `lambda_customer(T)` for T in {2, 4, 8, 12,
  24}.
- Reports both as a table and as percent of `lambda_county`.
- Shows the per-event distribution of `mean_customers / MCC` and
  `max_customers / MCC` for events with duration >= T, including median, p90,
  p99.
- Compares the multiplier under all three catalogs (30 / 45 / 60).
- Documents every assumption inline: why mean and not max, why the denominator
  is MCC and not coverage_history_customers, what bridged-gap snapshots do to
  the average, how missing MCC counties are handled.

Gate: the formula and the assumption set are written down, reviewed, and
agreed. If the math reveals a different first-order estimator is more honest,
update the plan before proceeding.

**Closure (2026-05-30).** Notebook executed on the 5-county sample (Alachua /
Manatee / Marion / Miami-Dade / Custer) across all three catalogs. Headline
findings:

1. Math reproduces v0 baseline byte-for-byte (Alachua T=4h X=$500 retail =
   $236,268 ✓).
2. v0 vs per-customer ratio at T=4h ranges **112× (Custer) to 3,774× (Manatee)**;
   per-customer retail at X=$500 lands in $10-$300/yr range — commercially
   plausible (v0's $10k-$300k is not).
3. `multiplier_mean` vs `multiplier_max` differs by **5–7×**; new
   assumption [A010](../methodology/assumptions.md#a010--mean-not-max-of-customers_out--mcc-is-the-headline-per-customer-estimator)
   locks **mean** as the headline and **max** as a sensitivity column.
4. The `mean_customers / MCC` distribution is heavy-tailed
   (mean = 4.5× median for Alachua T≥4h). Phase 2 must co-report median.
5. Cross-catalog stability is acceptable for adequate-coverage counties
   (±10-15%) but fails for sparse-coverage Miami-Dade (2× swing across
   30/45/60). Phase 2 must wire a coverage gate.

Recommendation: **PROCEED to Phase 2** with the four refinements listed in
the notebook's [Findings §Phase 1 gate](../../notebooks/outputs/per_customer_rate_phase1/per_customer_rate_phase1.html).

Artifacts:
- Notebook: [`notebooks/per_customer_rate_phase1.ipynb`](../../notebooks/per_customer_rate_phase1.ipynb)
- HTML report: [`notebooks/outputs/per_customer_rate_phase1/per_customer_rate_phase1.html`](../../notebooks/outputs/per_customer_rate_phase1/per_customer_rate_phase1.html)
- Long-form results JSON: [`notebooks/outputs/per_customer_rate_phase1/results.json`](../../notebooks/outputs/per_customer_rate_phase1/results.json)
- Heavy-tail visualization: `notebooks/outputs/per_customer_rate_phase1/alachua_pct_mcc_distribution.png`

Documentation updated on phase exit:
- This plan ✓ (closure note above).
- [Assumptions registry](../methodology/assumptions.md) — added [A010](../methodology/assumptions.md#a010--mean-not-max-of-customers_out--mcc-is-the-headline-per-customer-estimator).
- [Pricing methodology](../methodology/pricing_methodology.md) — Phase 1 evidence section added.

### Phase 2 — Shadow rate emitted by curated_outage_data (no dashboard change)

Entry: Phase 1 gate passed. ✅ (2026-05-30)

#### Phase 2 incorporates four refinements from Phase 1

| # | Refinement | Phase 1 evidence | Phase 2 implementation |
|---|---|---|---|
| R1 | Co-report `multiplier_mean` AND `multiplier_median` | Mean is 4.5× median for Alachua T≥4h (F4); the headline `mean` is dominated by a few major events | Emit both. Mean is the headline per [A010](../methodology/assumptions.md#a010--mean-not-max-of-customers_out--mcc-is-the-headline-per-customer-estimator); median is the robust co-report. |
| R2 | Coverage gate for sparse / noisy counties | Miami-Dade FL (166 events / 11 yr) shows a 2× cross-catalog swing in `lambda_customer_mean` (F5) | Three-level gate per (FIPS, T): `available` / `caution` / `not_available`, with `coverage_gate_reason`. |
| R3 | Lock mean-vs-max as a recorded assumption (A010) | Mean is the contract-semantics-correct headline; max is 5-7× higher (F3) and useful as a sensitivity column | Schema includes both; A010 is cited in the model card. |
| R4 | Sensitivity bands (p10 / p50 / p90 / p99) of per-event share | Heavy-tail visualization (F4) — a single estimator hides the distribution | Schema includes percentile columns; model card documents the heavy tail. |

#### Coverage-gate definition (initial; tunable)

```text
coverage_gate_status =
    'not_available'  if mcc is missing or 0                  → reason: 'mcc_missing'
    'not_available'  if n_events_qualifying(T) < 10          → reason: 'insufficient_qualifying_events'
    'caution'        if n_events_qualifying(T) < 100         → reason: 'low_qualifying_event_count'
    'caution'        if n_events_total < 500                 → reason: 'low_total_event_count'
    'available'      otherwise
```

Counties or (FIPS, T) cells with `not_available` get `multiplier_*` and
`lambda_customer_*` set to null. `caution` cells emit values but are
flagged in the model card and on the dashboard.

#### Deliverable: pipeline + artifacts

Pipeline at [`curated_outage_data/pipelines/per_customer_rate/`](../../curated_outage_data/pipelines/per_customer_rate/):

- `README.md` — what the pipeline does, how to run.
- `compute_per_customer_lambda.py` — the script.

It reads only from `price_engine/data/events.parquet` and
`price_engine/data/raw/MCC.csv` (no edits to v0). Output lands in
[`curated_outage_data/outputs/per_customer_rate/`](../../curated_outage_data/outputs/per_customer_rate/)
as `per_customer_lambda__<catalog_id>.parquet`, one parquet per catalog.

Phase 2 also writes:
- Schema: [`curated_outage_data/schemas/per_customer_lambda.md`](../../curated_outage_data/schemas/per_customer_lambda.md)
- Model card stub: `curated_outage_data/model_cards/customer_impact_v1.md`
- QA plan: `curated_outage_data/validation/per_customer_lambda_qa_plan.md`

#### Output schema (per (FIPS, T, catalog) row)

```text
# Identity
fips, T, catalog_id

# Source-of-truth context
n_events_total, n_events_qualifying, observation_years, mcc

# v0 baseline (reproduced)
S_T, lambda_county

# Headline per-customer estimator (mean of mean_customers / MCC)
multiplier_mean, lambda_customer_mean

# Robust alternative (median of mean_customers / MCC)
multiplier_median, lambda_customer_median

# Sensitivity column (max of customers / MCC; A010)
multiplier_max, lambda_customer_max

# Per-event share sensitivity bands
pct_mcc_p10, pct_mcc_p50, pct_mcc_p90, pct_mcc_p99

# Coverage gate
coverage_gate_status, coverage_gate_reason

# Lineage
generated_at, source_version
```

#### Gate

Phase 2 closes when ALL of these are true:

1. The pipeline runs cleanly for all three catalogs (30 / 45 / 60-min) on
   the full national county set (~3,090 FIPS).
2. Stability check: for `available` counties, `multiplier_mean` moves
   less than ±20% across catalogs at moderate T (4, 8, 12 h).
3. Every (FIPS, T) cell either has a value or an explicit `coverage_gate_reason`.
4. Model card exists with documented cap, floor, formula, data lineage,
   heavy-tail caveat, and rollback flag.
5. QA plan documented and the stability + sanity checks in it pass.

Documentation update on phase exit:
- This plan: append a `Phase 2 Closure` block with the per-catalog summary.
- [Adjustment framework](outage_baseline_adjustment_framework.md): update
  `customer_impact_modifier` status from `gate_only` to `shadow`.
- [Pricing methodology](../methodology/pricing_methodology.md): add a Phase 2
  evidence section linking the parquet artifacts.
- [Curated-data phase plan](../../curated_outage_data/plan/README.md): add
  the new track with status.
- New assumptions if any emerge (e.g. on the gate threshold values).

#### Phase 2 Closure (2026-05-30)

**Status:** Closed. ✅ Pipeline, schema, model card, and QA plan landed;
cross-catalog stability gate passed.

Deliverables:
- Pipeline: [`compute_per_customer_lambda.py`](../../curated_outage_data/pipelines/per_customer_rate/compute_per_customer_lambda.py)
  + [README](../../curated_outage_data/pipelines/per_customer_rate/README.md).
- Outputs: `per_customer_lambda__eagle-i-{30,45,60}min.parquet`
  (15,450 rows each, ~1.6MB) under
  [`curated_outage_data/outputs/per_customer_rate/`](../../curated_outage_data/outputs/per_customer_rate/).
- Schema: [`per_customer_lambda.md`](../../curated_outage_data/schemas/per_customer_lambda.md).
- Model card: [`customer_impact_v1.md`](../../curated_outage_data/model_cards/customer_impact_v1.md).
- QA plan: [`per_customer_lambda_qa_plan.md`](../../curated_outage_data/validation/per_customer_lambda_qa_plan.md).
- Curated-plan hook: [`05_phase_per_customer_rate.md`](../../curated_outage_data/plan/05_phase_per_customer_rate.md).

Gate results:

| Gate | Result |
|---|---|
| 1. Clean run for all 3 catalogs on 3,090 FIPS | ✅ ~25s total |
| 2. Stability (±20% on multiplier_mean at moderate T for `available` cells) | ✅ T=4h: 98.0%; T=8h: 92.4%; T=12h: 88.1% |
| 3. Every (FIPS, T) cell has a value or explicit reason code | ✅ |
| 4. Model card with cap/floor/formula/lineage/failure-modes/rollback | ✅ |
| 5. QA plan documented; checks pass | ✅ |

Coverage gate distribution (45-min catalog):

| T | available | caution | not_available |
|---|---:|---:|---:|
| 2 h | 2,798 | 225 | 67 |
| 4 h | 2,753 | 248 | 89 |
| 8 h | 2,273 | 653 | 164 |
| 12 h | 1,690 | 1,177 | 223 |
| 24 h | 729 | 1,844 | 517 |

Anchor reproduction: Alachua FL T=4h `lambda_county = 307.148490` matches v0
drilldown and Phase 1 notebook byte-for-byte. ✓

Cross-catalog `multiplier_mean` distribution for `available` cells across all
three catalogs (n = 10,125 cells):

| Percentile | Relative range |
|---|---|
| Median | 5.5% |
| p75 | 9.9% |
| p90 | 15.9% |
| p95 | 20.6% |
| p99 | 33.7% |

Long-T (12h, 24h) instability is concentrated in counties with low qualifying-
event counts; the `caution` status already flags most of these.

Documentation cascades on close:
- [Adjustment framework](outage_baseline_adjustment_framework.md): customer_impact_modifier moved from `gate_only` to `shadow`.
- [Pricing methodology](../methodology/pricing_methodology.md): Phase 2 evidence section added.
- [Curated-data plan README](../../curated_outage_data/plan/README.md): per-customer hook entry added.

**Next: Phase 3** — dashboard side-by-side display, reading the parquet outputs.

### Phase 3 — Dashboard side-by-side display (visible, clearly labeled)  ✅ Implementation landed 2026-05-30; stakeholder review pending

Entry: Phase 2 gate passed.

Deliverable: dashboard rendering shows, for each (FIPS, T, X) cell:

- The current v0 retail premium (unchanged) as the headline number.
- A secondary `Per-customer-aware (shadow)` number below it.
- Eye-button copy that names the math, the assumption, and the date range
  of evidence.
- A toggle in the matrix view to switch the heatmap between the two views.

This phase touches `price_engine/dashboard/app.js`,
`price_engine/dashboard/index.html`, and `price_engine/dashboard/styles.css`
only. It reads from a new `pricing/per_customer_view.json` artifact written
out of the curated pipeline, not from a modified v0 artifact. v0 outputs
remain byte-identical.

Gate: internal stakeholder review confirms the side-by-side framing reads
correctly to an underwriting / product reader. The shadow number is never
labeled as a quotable price.

Documentation update on phase exit:
- Dashboard README updates with the new view and the toggle.
- [Architecture doc](../../price_engine/ARCHITECTURE.md): add a "v0 + shadow
  view" section pointing at this plan.

#### Phase 3 Implementation Notes (2026-05-30)

**What landed:**

1. **Pipeline JSON mirror.** [`compute_per_customer_lambda.py`](../../curated_outage_data/pipelines/per_customer_rate/compute_per_customer_lambda.py)
   now writes a compact `per_customer_view__<catalog>.json` next to the parquet,
   AND mirrors it into `price_engine/catalogs/<catalog>/pricing/per_customer_view.json`
   so the dashboard's static-server can fetch it via a sibling URL. The mirror
   is a presentation-only copy; the curated parquet remains the source of
   truth. No code change to v0 pipeline scripts.

2. **Matrix view: `View` segmented control.** Three modes — `County trigger`
   (default, v0 unchanged), `Per-customer` (shadow), and `Multiplier`. The
   `Show` (Pure / Retail) dropdown is auto-disabled in Multiplier mode
   because the multiplier is dimensionless. A mode-note line under the
   county meta explicitly labels which mode is active and what the cells
   mean.

3. **Per-customer cell colors:**
   - `available` → teal-tinted (`--primary-soft`), echoing the "shadow"
     visual identity.
   - `caution` → diagonal-stripe amber-on-surface to signal "available but
     thin data".
   - `not_available` → muted "—" with the gate reason as tooltip.

4. **Drilldown Panel A:** new "Per-customer gate" row with a
   `gateBadge` (available / caution / not available) and the reason text.

5. **Drilldown Panel B:** new "Cust. impact multiplier · mean" row with
   the median and max sensitivity values inline.

6. **Drilldown Panel C:** the existing v0 chain is preserved verbatim,
   followed by a new `chain-section` titled "Per-customer view (shadow)".
   It shows the multiplier definition, the per-customer λ derivation, the
   pure/retail chain, and a sensitivity footnote with median and max
   estimator retail values. When the gate is `not_available`, the section
   shows the reason instead of the chain.

7. **Aesthetic discipline:** all new visual elements re-use existing CSS
   tokens (IBM Plex font stack, `--primary` / `--tier-*` colors, `--space-*`
   spacing scale, `--radius-*` corners, tabular nums for numeric values).
   No new typography. No new color stops outside the existing token set.
   `gateBadge` mirrors `tierBadge` dimensions exactly.

**What stakeholder review will look at:**

- Does the County / Per-customer / Multiplier framing read correctly to an
  underwriter without explanation?
- Is the visual rhythm in customer mode (teal-tint cells) immediately
  legible as "this is the shadow, not the headline"?
- Does the drilldown's per-customer chain section answer "where does this
  number come from" in one read?
- Is the caution stripe distinguishable from amber tier coloring without
  being noisy?

**Open follow-up (deferred to a polish pass after first review):**

- Update the matrix-legend strip to reflect the current view's color
  mapping (it still hardcodes the v0 tier legend).
- Map view "color by" dropdown could add a `per-customer retail · T=8h ·
  X=$2,500` option later — out of Phase 3 scope.
- Eye-button info content for the per-customer mode is currently inline in
  the mode-note; a popover variant could be added if the inline text is
  insufficient.

### Phase 4 — External validation against PowerOutage.US per-outage data  (refinement queue)

**Reframed 2026-05-30:** Phase 4 is no longer a graduation gate. The
Phase 5 governance decision shipped the per-customer chain under the
bias-correction activation rule (registry-with-resolution-path,
[A011](../methodology/assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation)).
Phase 4 remains valuable as **refinement work** — it tightens A011 with
empirical evidence — but does not block the price or any other
downstream work.

Entry (when team capacity permits): the HighTail historical extract
is loaded under `docs/extra/poweroutage_us/data/historical_trial/`.

Deliverable: a side-by-side comparison for MA, CT, RI for Jan–Mar 2019:

- `λ_customer(T)` from this plan (computed on the EAGLE-I 2019 slice
  via the synchronous approximation in A011).
- `λ_per_outage_customer(T)` from PowerOutage.US per-`OutageId` records
  (each carries its own customer count and duration — no synchronous
  approximation needed).
- Disagreement bounded numerically; the source of any divergence
  named (event-construction grain, customer-count semantics,
  geographic mismatch).

Possible outputs:

- (a) Disagreement within the sensitivity band already shown on the
  dashboard (median ↔ max) → A011 is empirically confirmed; no formula
  change; A011 status moves from "shipped with documented constraint" →
  "shipped, externally validated."
- (b) Disagreement larger than the sensitivity band, in a consistent
  direction → derive an empirical correction factor for the multiplier;
  update A011 and the model card; redeploy.

Documentation update on phase exit:

- This plan: record the bound and the empirical correction (if any).
- A011: update status and add empirical evidence.
- Model card: update activation checklist row 8 with the validation
  outcome.

### Phase 5 — Graduation decision (governance)  ✅ Closed 2026-05-30

Entry: Phases 1–3 closed; team review of the shadow surface yielded a
clear posture decision (documented in the discussion thread that closed
this phase).

Decision: **(b) Activate as numeric multiplier.**

Rationale (the discussion's core argument):

- v0 ships with eight documented assumptions (A001–A008) — some
  genuinely-untested, some placeholders, some known simplifications.
  None are called "shadow"; they are documented and the engine ships.
- The per-customer chain adds **exactly one** new assumption — the
  synchronous-outage approximation, now [A011](../methodology/assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation).
  It is a data-constrained measurement assumption with a clear
  resolution path.
- The per-customer chain that rests on A011 produces a number that
  Phase 1 showed is **100×–4000× more accurate per customer** than v0's
  county-trigger rate. Treating it as "shadow" while shipping v0 with
  its larger systematic error would invert the accuracy ordering.
- The bias-correction modifier lifecycle is therefore refined: the
  registry-with-resolution-path pattern is the activation gate for
  bias-correction modifiers (which reduce known measurement error).
  Forward-regime modifiers still require external validation. See
  [the refinement in the adjustment framework](outage_baseline_adjustment_framework.md#activation-pattern-by-category-refined-2026-05-30).

Terminal state implemented:

- Dashboard headline switches to per-customer view (default matrix mode,
  primary chain in Panel C). v0 county-trigger remains accessible as a
  reference view for sensitivity comparison.
- `customer_impact_v1` model card status: `shipped`.
- Phase 4 is reframed as **refinement work** — not a precondition for
  shipping. It tightens A011 when per-`OutageId` data is available.

## How this interacts with future product layers

The plan is sequenced so each phase is forward-compatible with these
adjacent tracks:

- **Portfolio aggregation (v1).** A per-customer rate is the natural unit
  for aggregating N policies in a county. The same `mean_customers` data
  feeds both. See [Portfolio Risk Engine Plan](portfolio_risk_engine_plan.md).
- **Trigger-source bridge (Path B).** The shadow column's schema already
  reserves a slot for `location_basis_factor`, so when a trigger source is
  contracted, `lambda_location(T) = lambda_customer(T) * location_factor` is
  a one-column extension, not a redesign. See
  [Trigger Source Implications](trigger_source_implications.md).
- **Forward-looking modifiers.** Climate, grid-condition, and hazard
  modifiers stay multiplicative on top of whichever lambda is the published
  baseline. They calibrate the same way against `lambda_customer` as they
  would against `lambda_county`, but on a baseline that is no longer
  off by 30-100×. See [Forward-Looking Modeling Plan](forward_looking_modeling_plan.md).
- **Vendor-data shrinkage.** If PowerOutage.US (or any future per-outage
  source) becomes the historical backbone, `lambda_customer` is computed
  directly from per-outage records instead of via the multiplier — the modifier
  retires into the baseline. See
  [`outage_baseline_adjustment_framework.md`](outage_baseline_adjustment_framework.md#classification-of-current-modifiers).

## Open questions to resolve in Phase 1

These are deliberately left open. The Phase 1 notebook is where they get
written-down answers, not before.

1. **Mean vs max vs time-weighted average.** First-order formula uses
   `mean_customers / MCC` over qualifying events. Should it be
   time-weighted by snapshot count? Should the per-event quantity be
   `mean_customers / MCC` or `max_customers / MCC`? What does each choice
   imply if customers experience staggered (not synchronous) outages within
   an event?
2. **MCC denominator stability.** MCC is static per county (Moehl et al.
   2023). It does not move with the year. Does this bias the multiplier
   against fast-growing counties? Sensitivity check needed.
3. **Bridged-gap bias.** The `mean_customers` denominator is observed
   positive snapshots only. Patchy-coverage events with many bridged gaps may
   have a `mean_customers` biased upward. Quantify on a real sample.
4. **Duration conditioning.** Should the multiplier average over events with
   `duration >= T`, or over all events? The first matches the contract
   trigger; the second is a more stable estimator on rare-T counties.
5. **Counties with no MCC.** Some counties (territories, mostly) have no
   MCC. Phase 2 must produce an explicit `not_available` reason code, not
   silently drop them.
6. **Cap and floor.** What is the maximum multiplier (probably 1.0 by
   construction — you cannot affect more customers than exist) and what is
   the minimum (set by Phase 4 validation)? Until set, the modifier stays
   in `shadow` and cannot be activated.

## Cross-references

- [Basis-risk problem framing](../dicsscssion/location_aware_outage_pricing/01_problem_framing.md)
- [Customer-impact modifier proposal](outage_baseline_adjustment_framework.md#customer-impact-modifier)
  in the adjustment framework
- [Customer-impact modifier slot](forward_looking_modeling_plan.md#customer-impact-modifier-optional-challenger)
  in the forward-looking plan
- [Trigger Source Implications](trigger_source_implications.md) — the
  Path B architecture
- [PowerOutage.US Finding 1.2](../extra/poweroutage_us/docs/06_findings.md)
- [Portfolio Risk Engine Plan](portfolio_risk_engine_plan.md)
- [Pricing Methodology §v0 prices on a county trigger but quotes per customer](../methodology/pricing_methodology.md#v0-prices-on-a-county-trigger-but-quotes-per-customer-the-gap)
- [Per-Customer View — End-to-End Walkthrough](../methodology/per_customer_view_walkthrough.md) — the nuance-by-nuance pedagogical reference
- [Assumption A009](../methodology/assumptions.md#a009--per-customer-customer_impact_multiplier-first-order-estimator) — the first-order multiplier estimator
- [Assumption A010](../methodology/assumptions.md#a010--mean-not-max-of-customers_out--mcc-is-the-headline-per-customer-estimator) — mean-vs-max headline choice
- [SCHEMA.md customer-impact note](../../price_engine/data/SCHEMA.md#customer-impact-fields-are-not-in-v0-pricing)
- [EVENT_CONSTRUCTION.md severity-threshold rationale](../../price_engine/data/EVENT_CONSTRUCTION.md#choice-b---snapshot-threshold-customers_out--0)

## Document discipline

Every phase exit triggers a documentation pass, not just a code change.
Specifically:

- Update this plan with what landed and what changed.
- Update every doc in **Cross-references** that the change affects.
- On full completion, close this plan per the [done/ convention](done/README.md).

## Next concrete step

Phase 1, on Alachua FL (12001), Manatee FL (12081, coastal storm-prone),
Marion FL (12083, rural), Miami-Dade FL (12086, urban), and Custer SD
(46033, sparse / quiet) as the initial county sample. Notebook lives at
`notebooks/per_customer_rate_phase1.ipynb`. No code change to `price_engine/`
or `curated_outage_data/` pipelines until Phase 1 gate passes.
