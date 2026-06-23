# Curated-Data Phase Hook — Per-Customer Shadow Rate

This file is a **thin hook** that pulls the per-customer-rate work into the
`curated_outage_data/` phase plan. The master plan and the canonical
sequencing live elsewhere:

- **Master plan:** [`docs/plan/per_customer_pricing_plan.md`](../../docs/plan/02_per_customer/per_customer_pricing_plan.md)
- **Schema:** [`schemas/per_customer_lambda.md`](../schemas/per_customer_lambda.md)
- **Pipeline:** [`pipelines/per_customer_rate/`](../pipelines/per_customer_rate/)
- **Model card:** [`model_cards/customer_impact_v1.md`](../model_cards/customer_impact_v1.md)
- **QA plan:** [`validation/per_customer_lambda_qa_plan.md`](../validation/per_customer_lambda_qa_plan.md)
- **Outputs:** [`outputs/per_customer_rate/`](../outputs/per_customer_rate/)

## Why this is a hook, not a full curated phase

The per-customer rate is fundamentally a **pricing-engine bias correction**
that happens to use curated-data primitives (event aggregates + MCC). It
fits the project's "don't change v0; build challengers in curated" rule, but
its master sequencing is the per-customer pricing plan, not the curated-data
phase sequence (cause attribution → grid features → forward-looking).

This hook exists so anyone reading `curated_outage_data/plan/` discovers the
track and knows where to look for the canonical plan.

## Where this curated track sits in the phase table

The master plan's five phases map to curated-data artifacts as follows:

| Master phase | Curated-data artifact |
|---|---|
| 1 — Math validation | Notebook in `notebooks/` (lives outside curated for now) |
| 2 — Shadow rate emitted | **This pipeline:** `pipelines/per_customer_rate/`, schema + model card + QA plan |
| 3 — Dashboard side-by-side | Dashboard read-only; no curated artifact new |
| 4 — External validation | New PoUS-overlap pipeline (TBD); validation lives in `validation/` |
| 5 — Graduation | Governance decision; no new pipeline |

## Status

- **Master Phase 1:** Closed 2026-05-30.
- **Master Phase 2:** Closed 2026-05-30 (pipeline + schema + model card +
  QA plan all landed; cross-catalog stability gate passed at T=4/8/12 h).
- **Master Phase 3+:** Pending.

## Workflow status (per [`workflow_template.md`](workflow_template.md))

| Step | Status | Where it landed |
|---|---|---|
| Research | done | Notebook + Phase 1 findings |
| Reason | done | Master plan §Three approaches |
| Decide | done | [A010](../../docs/methodology/assumptions.md#a010--mean-not-max-of-customers_out--mcc-is-the-headline-per-customer-estimator) + Phase 2 plan |
| Plan | done | Master Phase 2, this file, schema, model card |
| Execute | done | Pipeline ran 2026-05-30; cross-catalog QA passed |
| Feedback | pending | Phase 3 dashboard review will surface stakeholder feedback |
| Learning | pending | Final closure goes into `learning/` and the plan moves to `docs/plan/done/` |
