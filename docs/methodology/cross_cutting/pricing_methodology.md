# Pricing — Methodology

- **Status:** skeleton (band section filled 2026-06-24)
- **First written:** 2026-05-30
- **Last reviewed:** 2026-06-24

## Scope

How the per-(FIPS, T, X) annual retail premium is computed in v0, plus
the reserved slots for v0.5 / v1 extensions (uncertainty load,
per-customer view, adjustment modifiers).

## Inputs and outputs

| | Items |
|---|---|
| **Inputs** | `price_engine/data/county_summary.parquet`, `price_engine/data/county_durations.parquet`, `price_engine/filtration/county_tiers.csv` |
| **Outputs** | `price_engine/pricing/county_premiums.csv`, `price_engine/pricing/county_drilldown.json`, per-county `event_evidence/{FIPS}.json` |

## Contract structure

> If an outage in your FIPS lasts ≥ T hours, we pay you $X. Annual policy.

T is the deductible / trigger duration; X is the per-event payout. v0
quotes the **annual** retail premium, not a single-event price.

## The math (four numbers)

```text
lambda(T)        = N_per_year * S(T)
Pure premium     = lambda(T) * X
Retail premium   = (Pure + UncLoad) / (1 - ER - TM)
```

- `S(T)` is raw empirical, per [A005](../assumptions.md#a005--st-is-raw-empirical-no-parametric-duration-distribution-in-v0).
- `UncLoad = 0` in v0, slot reserved; ER = 0.20 and TM = 0.15 are
  defaults per [A006](../assumptions.md#a006--default-loads-er--020-tm--015-uncload--0).
- The (T, X) grid is `{2, 4, 8, 12, 24} h × {500, 1000, 2500, 5000, 10000}`,
  giving 25 cells per county.

## The premium band: the experience band (A017)

> **STATUS (2026-06-24): method under review — NOT yet adopted.** What ships today is **v1** (a year-based
> bootstrap of the mean — the *confidence* band). The **experience** method described below is the leading
> proposal; a [pressure test](../../dicsscssion/dashboard_redesign/08_band_pressure_test.md) compares three
> candidates (median widths: confidence ±19% · experience p10/p90 ±53% · experience p25/p75 ±27%) before the
> team decides. The section below describes the proposed experience method.

The quote is a band `{low, point, high}`, not a single-value estimate. The band is the **year-to-year
experience** of the county's qualifying-event frequency — *how much an actual policy year swings
around the average* — per [A017](../assumptions.md). For the underwriter: **wide band = noisy or thin
history (apply judgment); tight band = steady, rich history (trust the headline).**

```text
  point  = mean of the observed annual qualifying-event counts     → the headline lambda(T)
  band   = empirical p10 .. p90 of those SAME annual counts        → the year-to-year bounce
           carried linearly:  {low, high} = (p10/mean , p90/mean) * lambda * X / (1 - ER - TM)
```

One source — the actual yearly counts. Their **average** is the price; their **year-to-year spread**
is the band. Nothing is fitted or modeled — which is exactly why the band widens for thin/volatile
counties and stays tight for rich/steady ones (evidence-driven, not backstopped).

**Why "experience", not "confidence in the mean."** A band can answer two different questions, and
only one is decision-relevant for an annual policy:

```text
  confidence-in-mean   "how well do we know the long-run AVERAGE rate?"  width -> 0 as years -> inf   (REJECTED: v1)
  experience (adopted) "how much does an actual YEAR swing?"             width -> the real spread      (a year still varies)
```

A policy pays on a **single year's** realized outcome, so we price the spread of years, not the
precision of their average. The v1 implementation (a bootstrap of the mean) was the *standard error
of the average* ≈ spread ∕ √(years) — structurally ~√11 ≈ 3× too tight for an ~11-year history, and
it contradicted the "year-to-year bounce" story the dashboard already told (see learning log).

**Why the spread is wide (and Poisson is wrong).** Outages cluster — a storm causes many correlated
outages — so annual-count variance ≫ Poisson mean (median `var/mean` = 5.0 at T=8h; 94% of counties
overdispersed). The experience band captures that clustering automatically because it reads the real
annual swings; a Poisson-on-count band assumes independence and is far too tight.

**Measured effect** (`eagle-i-45min`, 15,135 county×T cells; premise check `scratchpad/band_compare.py`):

```text
   T     median relative spread (hi/mean - lo/mean)    widen vs v1
   2h        0.24  ->  0.65                                2.9x
   8h        0.38  ->  1.07   <- primary trigger            2.9x
  24h        0.56  ->  1.57                                2.8x
   -> 98.3% of cells widen.  Stays honest by county shape:
        Wake NC    (steady, ~295/yr) +/-5%      Pasco FL   +7/-11%
        Alachua FL (volatile)        +48/-42%   Clayton IA (thin, 6/yr)  +50/-33%
```

**Scope (v2).** Experience band **only**. Placement (within-county location basis) and forward
(climate/regime) uncertainty are deferred to a later proper process — never blended into this band
(`communicate_to_share` rule 4: split orthogonal questions, never one opaque score).

**Caveats.** Uses the full observed annual variance, so it conflates trend (direction: wider =
conservative; trend is a Step-5 forward concern); unreliable for <5 observed years or near-zero events
at long T → route to `insufficient` and **suppress the point quote** rather than show a meaningless range.

**Where it lives.** Precomputed in [`web/scripts/build_data.py`](../../../web/scripts/build_data.py)
`rel_band`; the engine reads `{low, point, high}` + a `band_driver` tag and the UI renders it. Full
narrative: learning log [`premium_range_clustering.md`](../../learning_logs/premium_range_clustering.md);
design note [`07_outward_range.md`](../../dicsscssion/dashboard_redesign/07_outward_range.md); build
plan [`premium_experience_band_plan.md`](../../plan/cross_cutting/premium_experience_band_plan.md).

## v0 prices per policy, not per portfolio

v0 prices each policy as standalone per
[A007](../assumptions.md#a007--each-policy-is-priced-standalone-no-portfolio-correlation-in-v0).

## v0 prices on a county trigger but quotes per customer (the gap)

This is the central reason for the per-customer pricing plan. v0
`lambda(T)` is a **county-event rate** — how often the county has an
event ≥ T — not a **per-customer-experience rate**. The policy is
sold per customer. Per
[A009](../assumptions.md#a009--per-customer-customer_impact_multiplier-first-order-estimator)
and [A010](../assumptions.md#a010--mean-not-max-of-customers_out--mcc-is-the-headline-per-customer-estimator),
the first-order per-customer view is

```text
lambda_customer(T) = lambda_county(T) * E[mean_customers / MCC | duration_hours >= T]
```

This shadow rate is being validated by the
[Per-Customer Pricing Plan](../../plan/done/2026-05-30_per_customer_pricing_plan.md). It
does not change v0 pricing.

### Phase 1 evidence (2026-05-30)

Phase 1 of the plan executed a 5-county math-validation notebook
([HTML report](../../../notebooks/outputs/per_customer_rate_phase1/per_customer_rate_phase1.html))
and confirmed the formula reproduces v0 exactly. The v0-to-per-customer
**ratio at T=4h, X=$500** spans roughly **two orders of magnitude across
county shapes** (112× for Custer SD, ~3,000× for Alachua FL, ~3,800× for
Manatee FL). Resulting per-customer retail premiums land in $10-$300/yr
— commercially plausible vs v0's $10k-$300k/yr per customer.

Phase 1 also added [A010](../assumptions.md#a010--mean-not-max-of-customers_out--mcc-is-the-headline-per-customer-estimator)
(mean vs max headline choice) to the registry and identified two
Phase 2 preconditions: a coverage gate for sparse counties, and co-reporting
the median estimator alongside the mean.

### Phase 2 evidence (2026-05-30)

Phase 2 landed the shadow-rate pipeline. The artifacts now exist:

- Per-catalog parquet: [`curated_outage_data/outputs/per_customer_rate/per_customer_lambda__<catalog>.parquet`](../../../curated_outage_data/outputs/per_customer_rate/)
  — ~15,450 rows × 3 catalogs, full national coverage.
- Schema: [`per_customer_lambda.md`](../../../curated_outage_data/schemas/per_customer_lambda.md).
- Model card: [`customer_impact_v1.md`](../../../curated_outage_data/model_cards/customer_impact_v1.md)
  — status **shadow** (not in pricing).
- QA plan: [`per_customer_lambda_qa_plan.md`](../../../curated_outage_data/validation/per_customer_lambda_qa_plan.md).

Stability QA passed: `multiplier_mean` is within ±20% across the 30/45/60-min
catalogs for **98% of `available` cells at T=4h**, 92% at T=8h, and 88% at
T=12h. Long-T (12h, 24h) drift is concentrated in counties with low
qualifying-event counts; the coverage gate already flags those rows as
`caution`.

Three coverage statuses are emitted per (FIPS, T): `available`, `caution`,
`not_available`, with a per-row `coverage_gate_reason`. The dashboard
Phase 3 work consumes this status field to decide whether to render or
hide the per-customer shadow column for any given cell.

v0 pricing math in this engine is unchanged.

### End-to-end pedagogical walkthrough

The nuance-by-nuance walkthrough — what each step in the per-customer chain
actually computes, with a worked Boone, MO example and every assumption
cited by stable ID — lives in
[`per_customer_view_walkthrough.md`](../02_per_customer/per_customer_view_walkthrough.md).
Read that file when you need to explain the per-customer view to a new
team member, a stakeholder, or a regulator. This pricing-methodology file
stays at the level of "the formula, the status, the evidence"; the
walkthrough is the narrative reference.

### Phase 3 evidence (2026-05-30)

Phase 3 landed the dashboard side-by-side surface. The pipeline mirrors
`per_customer_view.json` into each catalog's `pricing/` folder so the static
dashboard can fetch it as a sibling of `county_drilldown.json`. The dashboard
adds:

- A **View** segmented control in the matrix card — `County trigger` (default,
  v0 unchanged), `Per-customer` (shadow, teal-tinted cells), `Multiplier`
  (dimensionless, shown as percent).
- A **per-customer gate badge** in Panel A and at the head of the per-customer
  chain section.
- A **Per-customer view (shadow)** sub-section in Panel C, derivation-style,
  showing the multiplier, `lambda_customer(T)`, pure premium, and retail —
  plus a one-line sensitivity footnote with the median and max-estimator
  retail.
- Caution cells render as a diagonal amber stripe; `not_available` cells
  show "—" with the gate reason in the tooltip.

All visual elements re-use existing CSS tokens (IBM Plex font stack,
`--primary` / `--tier-*` palette, `--space-*` scale, tabular nums).
`gateBadge` mirrors `tierBadge` exactly. v0 pricing math and v0 dashboard
output values are unchanged.

## Tier gate

Red counties are no-quote. Amber counties get a flagged quote. Green
counties quote without a modelability flag. The tier is computed in
[Filtration](filtration_methodology.md).

## Worked example

Alachua County, FL (FIPS 12001), T = 4 h, X = $500:

```text
N_per_year          = 1,055.7
S(4h)               = 0.2909
lambda_county(4h)   = 307.1
Pure premium        = $153,574 / yr
Retail premium      = $236,268 / yr      (ER=0.20, TM=0.15)
```

This is a per-customer **quoted** annual premium that reflects a
**county-trigger expected payout**. The per-customer-aware shadow rate
will be added once the [per-customer plan](../../plan/done/2026-05-30_per_customer_pricing_plan.md)
exits its Phase 3 gate.

## Validation

- Premium grid is internally consistent (T monotone non-increasing in
  cell value, X monotone increasing).
- Sum of per-event historical payouts ÷ observation years matches the
  Pure premium for the same (FIPS, T, X) cell.
- Tier × premium correlations sanity-check.

## Known limitations

- Per-customer disconnect ([A009](../assumptions.md#a009--per-customer-customer_impact_multiplier-first-order-estimator)).
- No uncertainty load ([A006](../assumptions.md#a006--default-loads-er--020-tm--015-uncload--0)).
- No portfolio correlation ([A007](../assumptions.md#a007--each-policy-is-priced-standalone-no-portfolio-correlation-in-v0)).
- No forward-looking adjustment in v0; see
  [`../plan/forward_looking_modeling_plan.md`](../../plan/05_forward_regime/forward_looking_modeling_plan.md).
- No back-validation against EIA-861 or utility after-action reports
  yet; reconciliation is eyeballed in v0.

## Implementation pointers

| Aspect | File |
|---|---|
| Pricing script | `price_engine/pricing/05_price.py` |
| Math spec | `price_engine/plan/02_pricing_math.md` |
| Drilldown schema | `price_engine/data/SCHEMA.md` §Event Evidence JSON |
| Dashboard math display | `web/components/studio/tabs/price-breakdown.tsx` (build-up to premium) |

## Cross-references

- [Event Catalog Creation Methodology](../01_eventization/event_catalog_creation_methodology.md)
- [Aggregation and Annualization Methodology](../02_per_customer/aggregation_and_annualization_methodology.md)
- [Filtration Methodology](filtration_methodology.md)
- [Per-Customer Pricing Plan](../../plan/done/2026-05-30_per_customer_pricing_plan.md)
- [Outage Baseline Adjustment Framework](../../plan/cross_cutting/outage_baseline_adjustment_framework.md)
- [Forward-Looking Modeling Plan](../../plan/05_forward_regime/forward_looking_modeling_plan.md)
