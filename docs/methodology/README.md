# Methodology Documentation

The authoritative description of **how** this project executes each major
step in the outage pricing pipeline. Methodology files here consolidate the
detailed implementation specs that currently live next to the code
(`price_engine/data/SCHEMA.md`, `price_engine/data/EVENT_CONSTRUCTION.md`,
`price_engine/plan/02_pricing_math.md`, `price_engine/ARCHITECTURE.md`,
etc.) into a single, regulator-friendly reference.

## What this folder is

A canonical methodology reference. Each file describes one step of the
pipeline at the level a reviewer, auditor, or new team member needs to
understand and defend it without reading code.

## What this folder is not

- **Not a plan folder.** `docs/plan/` is for sequencing what to build next
  and gating phased work. Methodology is for documenting what we
  consistently do.
- **Not a learning log.** `docs/learning_logs/` is for modeling philosophy
  and exploratory frameworks. Methodology is committed practice.
- **Not the code.** Implementation pointers at the bottom of each file
  link to the authoritative scripts in `price_engine/` and
  `curated_outage_data/`.

## How to read this folder

Read in pipeline order:

| Step | File |
|---|---|
| 1. Data ingestion | [`data_ingestion_methodology.md`](data_ingestion_methodology.md) |
| 2. Event catalog creation | [`event_catalog_creation_methodology.md`](event_catalog_creation_methodology.md) |
| 3. Aggregation and annualization | [`aggregation_and_annualization_methodology.md`](aggregation_and_annualization_methodology.md) |
| 4. Filtration (modelability tiers) | [`filtration_methodology.md`](filtration_methodology.md) |
| 5. Pricing | [`pricing_methodology.md`](pricing_methodology.md) |
| 6. Location basis | [`location_basis_methodology.md`](location_basis_methodology.md) |

Cross-cutting:

- [`assumptions.md`](assumptions.md) — registry of every explicit
  assumption made by any methodology or plan in this project. Cite by ID
  (e.g. `[A001](assumptions.md#a001-...)`); do not restate.

Pedagogical walkthroughs (long-form, worked examples, nuance-surfaced):

- [`per_customer_view_walkthrough.md`](per_customer_view_walkthrough.md)
  — end-to-end walk through the per-customer shadow rate, step-by-step,
  with a worked Boone, MO example. Read this if you need to explain the
  per-customer view to a new team member, a stakeholder, or a regulator.
- [`location_relativity_factor_derivation.md`](location_relativity_factor_derivation.md)
  — audit appendix for the rural / mid / urban location relativity factors:
  why they are multiplicative, how the bucket ratios were derived, and which
  scripts and outputs reproduce the numbers.

Strategic / market reference:

- [`competitive_landscape.md`](competitive_landscape.md) — the
  canonical reference for who else is in the parametric outage segment
  (Adaptive Insurance / GridProtect, Whisker Labs Ting, PowerOutage.US,
  adjacent-vertical proof points like Parametrix and Ki). How we
  position relative to each. Refresh every 60–90 days.

## Status

All files in this folder were created as skeletons on **2026-05-30**.
Each file's `Status` field at the top records its current maturity:

- `skeleton` — section headers exist but content is placeholder
- `in-progress` — partially populated as the corresponding work executes
- `complete` — fully described and validated; the file is the source of truth for that step

Methodology files are filled in as the corresponding step's work matures
and as plans in [`../plan/`](../plan/) execute their gates. A plan that
exits a phase must update both the plan AND any methodology file it
touched.

## Relationship to other docs

```
docs/plan/             — what we will build next; sequencing and gates
docs/methodology/      — how we execute each canonical step (this folder)
docs/learning_logs/    — modeling philosophy and broader frameworks
docs/dicsscssion/      — exploratory discussion; pre-plan reasoning
price_engine/          — the historical v0 implementation
curated_outage_data/   — the enrichment / challenger implementation
```

## Document discipline

Every time a methodology file is updated, the change must:

1. Update the `Last reviewed` date at the top of the file.
2. Move any newly-explicit assumption into [`assumptions.md`](assumptions.md)
   with a new stable ID, and reference that ID from the methodology page.
3. Update any cross-referenced plan in [`../plan/`](../plan/) so the
   sequencing remains coherent.
