# Per-Customer View — End-to-End Walkthrough

- **Status:** complete (covers Phase 1–3 of the
  [Per-Customer Pricing Plan](../plan/per_customer_pricing_plan.md))
- **First written:** 2026-05-30
- **Last reviewed:** 2026-05-30
- **Read alongside:** [Pricing Methodology](pricing_methodology.md), [Assumptions Registry](assumptions.md), [Per-Customer Pricing Plan](../plan/per_customer_pricing_plan.md), [`customer_impact_v1` model card](../../curated_outage_data/model_cards/customer_impact_v1.md)

## Why this file exists

The per-customer "shadow" view on the dashboard converts the v0 county-event
rate into a per-customer-experience rate. Five numbers, simple formulas —
but each number rests on a non-trivial modelling choice. This document is the
pedagogical walkthrough: one worked county example, one nuance at a time,
every assumption cited by stable ID.

If you only have five minutes, read the **chain at-a-glance** and the
**worked example** and skip the nuance sections. If you're about to defend
this number to a regulator, an underwriter, or a stakeholder, read every
section.

## The chain at-a-glance

```text
mean_customers          (one number per event)
       |
       | ÷ MCC
       v
per-event share         (one fraction per event)
       |
       | average over events with duration ≥ T
       v
customer-impact         (one fraction per county × T)
   multiplier_mean
       |
       | × λ_county(T)
       v
λ_customer(T)           (per-customer events / year)
       |
       | × X
       v
Pure premium (per-cust.)   (annual expected payout, before load)
       |
       | ÷ (1 − ER − TM)
       v
Retail premium (per-cust., shadow)
```

Five steps. Each has nuance worth understanding before quoting the number.

## Worked example — Boone County, MO

Anchor case for the rest of this document. Selecting the dashboard cell
(Boone, MO; T = 8 h; X = $5,000; 45-min catalog) yields:

| Quantity | Value | Source |
|---|---|---|
| MCC (modeled county customers) | 121,913 | `MCC.csv`, Moehl et al. 2023 ([A008](assumptions.md#a008--mcc-is-a-static-per-county-customer-count)) |
| Total events in 11.167-year window | 9,329 | EAGLE-I 45-min catalog ([A002](assumptions.md#a002--customers_out--0-is-the-inclusion-threshold-for-events), [A003](assumptions.md#a003--each-eagle-i-15-min-snapshot-represents-the-interval-t-t--15-min)) |
| Qualifying events at T = 8 h | ~933 | events with `duration_hours ≥ 8` |
| λ_county(T = 8 h) | 79.8765 / yr | `(n_events_total / observation_years) × S(T)` |
| `multiplier_mean` | 0.2632 % | `mean(mean_customers / MCC | duration_hours ≥ 8)` |
| λ_customer(T = 8 h) | 0.210211 / yr | λ_county × multiplier |
| Pure premium @ X = $5,000 | $1,051.05 / yr / customer | λ_customer × X |
| Retail premium (shadow) | $1,617.01 / yr / customer | Pure / (1 − 0.20 − 0.15) |

Read in one sentence: *a Boone, MO customer is expected to experience a
power outage of duration ≥ 8 h roughly once every five years (1/0.21), and
the shadow per-customer retail premium for a $5,000-per-event contract is
about $1,617 per year.*

Now we walk through each step and surface its nuance.

## Step 1 — `mean_customers` for one event

### Definition

For an event composed of `n_snapshots` observed positive 15-minute
snapshots, with `customers_out` values `c_1, c_2, …, c_n`:

```text
mean_customers = (c_1 + c_2 + … + c_n) / n_snapshots
```

### Tiny worked example

Suppose Boone has an event lasting 1 hour, with snapshots at 14:15, 14:30,
14:45, 15:00 reporting `customers_out = [500, 1200, 300, 100]`.

```text
n_snapshots     = 4
mean_customers  = (500 + 1200 + 300 + 100) / 4 = 525
max_customers   = 1200
duration_hours  = 1.0
```

So during this event, an average of 525 customers were without power across
the four observed snapshots. The peak instantaneous count was 1,200.

### Nuance

**1. Mean is over OBSERVED snapshots, not over wall-clock time.**
If a snapshot is missing — for example a 15-minute gap that the 45-min
catalog bridges because of an EAGLE-I scrape failure — that slot has no
`customers_out` value and is **not** in the average. The denominator is
`n_snapshots`, never `duration_hours / 0.25`. Events with patchy coverage
have means biased toward whichever direction the observed snapshots lean
(see [A002](assumptions.md#a002--customers_out--0-is-the-inclusion-threshold-for-events)).

**2. It's not a roster of distinct customers.**
EAGLE-I publishes a count per snapshot, not an identifier per affected
customer. If 100 customers were out at 14:15 and a *different* 100 at
14:30, `mean_customers = 100` — but 200 *distinct* customers actually
experienced an outage during the event. EAGLE-I cannot distinguish those
cases. The data is a *count* metric, not a *cohort* metric.

**3. It collapses time shape.**
A 4-hour event with one peak snapshot of 5,000 customers and three
near-zero snapshots has the same `mean_customers` as a 4-hour event with a
steady 1,250 customers throughout. Both describe meaningfully different
real-world severity profiles. The mean is a single scalar; it does not
preserve shape.

## Step 2 — `mean_customers / MCC` as a per-event ratio

### Definition

The per-event ratio expresses the event's customer impact as a fraction of
the county's modelled total customer base:

```text
per_event_share = mean_customers / MCC
```

For Boone, MO with MCC = 121,913, a `mean_customers = 525` event yields
`per_event_share = 0.43 %`.

### Pros

- **Dimensionally clean.** Both numerator and denominator are EAGLE-I
  "customers" — metered electric accounts in the same sense ([A008](assumptions.md#a008--mcc-is-a-static-per-county-customer-count)).
  The ratio is a pure fraction.
- **Easy to communicate.** "About 0.43 % of the county's customer base was
  affected during this event."
- **Comparable across counties of any size.** The ratio normalises away
  county-population effects so a 3,000-customer county and a 1.5-million-
  customer county speak the same language.

### Cons

- **"Customer" is not a person.** A customer is a metered electric account.
  A 4-person household = 1 customer. A high-rise with separately metered
  units = many customers. The ratio answers "share of accounts affected,"
  not "share of people affected." Important when communicating with
  product or marketing stakeholders.
- **MCC is static** ([A008](assumptions.md#a008--mcc-is-a-static-per-county-customer-count)).
  Moehl et al. 2023 published a single modelling vintage; the value does
  not refresh per year. A county with rapid growth since the modelling
  year has an *under-stated* denominator, biasing the ratio UP. Phase 4 of
  the per-customer plan flags this for empirical measurement against
  current customer counts.
- **MCC is county-level.** The ratio is a county-aggregate share, *not* a
  spatial footprint. A 0.43 % ratio could be one rural feeder taking 100 %
  of its load offline (concentrated) or scattered service interruptions
  across the county (diffuse). The ratio does not tell you which — that
  would require feeder-level data.
- **The ratio describes AVERAGE share, not PER-CUSTOMER probability.**
  This is the synchronous-outage assumption (see Step 4 — the deepest
  nuance in the chain).

## Step 3 — `multiplier_mean = E[mean_customers / MCC | duration ≥ T]`

### Definition

For each (FIPS, T), filter the county's events to those with
`duration_hours ≥ T`, compute `mean_customers / MCC` for each, then average:

```python
qualifying = events[(events.fips == 29019) & (events.duration_hours >= 8)]
per_event_share = qualifying.mean_customers / 121913
multiplier_mean = per_event_share.mean()  # = 0.002632 for Boone @ T=8h
```

### Why condition on `duration ≥ T`

The contract triggers on duration. We only care about events that would
have paid out. Their average share-affected is what matters for sizing
per-customer expected loss. Averaging over *all* events would mix in
short events that the contract would never have triggered for — diluting
the multiplier with irrelevant evidence.

### Nuance

**4. The per-event distribution is heavy-tailed.**
Phase 1 measured this directly for Alachua, FL at T ≥ 4 h: median = 0.0073 %,
mean = 0.0333 %, p99 = 0.36 %, max = 6.9 % — a 4–5× ratio between mean and
median driven by a handful of major-storm events. The mean estimator is
honest but optimistic relative to a typical event. The median estimator is
co-reported in the parquet and in the dashboard chain footnote as a
robust sensitivity (see [A010](assumptions.md#a010--mean-not-max-of-customers_out--mcc-is-the-headline-per-customer-estimator)).

**5. Mean vs max is a 5–7× choice.**
Reporting `multiplier_max = E[max_customers / MCC | dur ≥ T]` instead
gives a larger number because the per-event peak share is larger than the
per-event average share. Mean is the headline ([A010](assumptions.md#a010--mean-not-max-of-customers_out--mcc-is-the-headline-per-customer-estimator))
because the contract pays for an event, and the time-averaged share
during the event is the closest scalar approximation to "share of
customers affected during the event." Max is reported alongside as a
sensitivity column; the dashboard shows it in the chain footnote.

## Step 4 — `λ_customer(T) = λ_county(T) × multiplier_mean`

This is where the deepest interpretive nuance lives. Multiplying a
*county-event rate* by an *average share* and calling the result a
*per-customer event rate* requires a specific assumption.

### The synchronous-outage assumption

We treat the M customers represented by `mean_customers` as a *single,
persistent set* out for the full event duration. Under that model, for an
event of duration D ≥ T, a random customer's probability of being out for
≥ T hours is exactly M / MCC. Averaging M / MCC across qualifying events
gives the per-customer annual rate.

### Why this is honest

- **It's simple and falls out of "expected customer-event count per
  year" directly.** Sum over events: each event contributes M customer-
  events, total per year is `λ_county × E[M]`, divide by MCC and you get
  per-customer events per year.
- **It uses data we already have.** No new sources, no new joins, no new
  vendor relationships.
- **It is dimensionally consistent.** Per-customer events per year × $
  per event = $ per year per customer.

### Why it is a model and not a measurement

Reality lies on a spectrum between two extremes:

- **Fully synchronous:** all M customers are out for the full duration D.
  Under this model, M of the county's customers each experience a single
  D-hour outage during the event. If D ≥ T, all of them qualify.
  Multiplier is *right* under this regime.
- **Fully staggered:** different customers are out at different snapshots.
  At each 15-minute slot, M_t customers are out, and the average is M.
  But no individual customer is out for the full D. Most customers were
  briefly out (say, 30 min) and back. Under this regime, very few
  customers actually experience an outage ≥ T, and the multiplier
  *overstates* the per-customer rate — possibly by a lot.

EAGLE-I publishes snapshot counts only. It cannot distinguish synchronous
from staggered. **PowerOutage.US per-`OutageId` records DO carry
individual outage lifespans, which is why Phase 4 of the per-customer
plan exists** — measuring staggering directly is the next concrete
validation step.

### Customer correlation is also ignored

`λ_customer(T)` is an *average across customers*, not a per-individual
probability. A real customer on a vulnerable feeder is hit repeatedly; a
real customer on a resilient feeder is rarely hit. The single
per-customer number describes the *county average*, not any one customer.
This is the same county-aggregation limitation v0 has, just scaled by the
multiplier.

The location-aware product track (Path B in the
[Per-Customer Pricing Plan](../plan/per_customer_pricing_plan.md)) is
where this gets addressed properly, via a `location_basis_factor` and
trigger-source bridge data we do not yet have.

## Step 5 — Pure and Retail

```text
Pure_customer(T, X)   = λ_customer(T) × X
Retail_customer(T, X) = Pure_customer / (1 − ER − TM)
```

For Boone at T = 8 h, X = $5,000:

```text
Pure   = 0.210211 × $5,000 = $1,051.05 / yr
Retail = $1,051.05 / 0.65   = $1,617.01 / yr
```

Same formula chain as v0; the only thing that changed is the rate term.
The default loads (ER = 0.20, TM = 0.15, UncLoad = 0) are inherited from
[A006](assumptions.md#a006--default-loads-er--020-tm--015-uncload--0).

### One reading-level nuance

The Retail figure is a *per-customer-per-year expected payout under the
assumption that each policy is sold to one EAGLE-I "customer" — one
metered account*. Not one person. Not one address. Not one feeder.

A small business with one electric meter = one customer = one policy.
A 200-unit apartment building with separately metered units = 200
customers = 200 policies. A household with a single meter = one customer
regardless of household size.

### Customer = policyholder = single insurable entity

The reason the per-customer view is the "right" pricing frame, and not
just an academic transformation of the v0 number, is that EAGLE-I's
"customer" unit aligns with the contract unit
([A008](assumptions.md#a008--mcc-is-a-static-per-county-customer-count)).
Parametric outage insurance is sold per insurable entity — one policy
per residence, one per business, one per industrial facility — and
that entity is exactly what EAGLE-I and the MCC paper call a
"customer": one metered electric account, one billed entity behind one
meter.

So:

- The customer in this math is a **policyholder**, not a person.
- A policyholder may be a single-family home, an apartment unit, a
  small business, a commercial property, a manufacturing plant, or
  another entity — whatever sits behind a single billed meter.
- The per-customer rate is therefore directly the **per-policy
  expected loss** under the natural one-policy-per-metered-entity
  underwriting model. No further unit conversion sits between the
  data layer and the policy.

This alignment is convenient and not accidental: the EAGLE-I
"customer" abstraction *is* the underwriting abstraction. It is also
why the per-customer view, despite all the nuances above, is the
honest pricing frame for the product as it would actually be sold.

## The sensitivity range — why we surface median and max

A reader who only sees the headline `multiplier_mean` number can mistake
the per-customer view for a single committed estimate. Heavy tails
([A009](assumptions.md#a009--per-customer-customer_impact_multiplier-first-order-estimator)
finding F4), the mean-vs-max modelling choice ([A010](assumptions.md#a010--mean-not-max-of-customers_out--mcc-is-the-headline-per-customer-estimator)),
and the synchronous-vs-staggered assumption (Step 4) all argue for
showing a **range**, not a single number.

The chain footnote in the dashboard surfaces the two bounds:

- **Median estimator** — `median(mean_customers / MCC | duration ≥ T)`.
  Robust to heavy-tail outliers. Usually 3–5× *smaller* than the mean
  headline. A defensible *floor* — "even under a typical-event view, the
  number is at least this."
- **Max estimator** — `E[max_customers / MCC | duration ≥ T]`. Treats the
  peak instantaneous share as the relevant share. Usually 5–7× *larger*
  than the mean headline. A defensible *ceiling* — "even under a fully
  synchronous peak-share view, the number is at most this."

For Boone at T = 8 h, X = $5,000 the dashboard chain footnote reads
roughly: `median → $159.63 · max → $3,860.32 / yr`. The headline mean
($1,617.01) sits comfortably inside.

That range is not a hedge. It is an honest disclosure that the
per-customer rate is a model output with two interpretive knobs
(estimator choice, synchronous assumption), and the dashboard exposes
both.

## Coverage gate — when not to lean on the number

Phase 1 also documented the failure mode where a county has too few
qualifying events for the mean to be stable. The coverage gate (see the
matrix-legend popover on the dashboard, and the
[`per_customer_lambda.md` schema](../../curated_outage_data/schemas/per_customer_lambda.md))
gates each (FIPS, T) into three statuses:

- **Available** — ≥ 100 qualifying events AND ≥ 500 total county events.
  Lean on the headline; the sensitivity bands are informative.
- **Caution** — 10–99 qualifying events, OR < 500 total. Number is shown
  but treat it as direction-only. The Phase 1 stability QA showed
  caution cells are the ones most likely to swing across the 30 / 45 /
  60-min catalogs.
- **Not available** — < 10 qualifying events, or MCC missing. Number is
  not emitted.

The model card has the exact threshold values and the rationale; the
walkthrough's job here is just to remind readers that the per-customer
number is only as good as its evidence base.

## The one assumption you must read — A011

The per-customer chain is the dashboard's headline price as of
2026-05-30 (governance terminal state **(b) — Activate as numeric
multiplier**). It inherits the v0 assumption stack (A001–A008) and
adds **exactly one** material assumption of its own:
[**A011**](assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation),
the synchronous-outage approximation. This section is the long-form
explanation of A011, which any reader quoting the per-customer number
should be familiar with.

### What the approximation says

Under the **synchronous-outage view**, the M customers represented by
`mean_customers` are modelled as a single persistent set, out for the
full event duration. A random customer's probability of being out for
≥ T then equals M / MCC. Averaging that ratio over qualifying events
yields the multiplier, and multiplying through gives the per-customer
annual rate.

Under a fully **staggered view**, M is a snapshot-average across
customers cycling in and out, and no individual is out for the full D.
The same multiplier in that regime overstates the per-customer rate.

Real events sit somewhere on the spectrum between those two extremes.

### Why we cannot test it from EAGLE-I alone

EAGLE-I publishes per-snapshot **counts**, not customer **identifiers**.
There is no field in the input data that distinguishes "the same 500
customers were out continuously" from "200 different customers cycled
in and out, averaging 500." Both produce the same `mean_customers`.

This is a **data constraint**, not a modelling oversight. It is the
specific reason A011 exists as a documented assumption rather than as
a validated formula.

### What we ship in the meantime

- The headline per-customer number uses the **mean** estimator
  ([A010](assumptions.md#a010--mean-not-max-of-customers_out--mcc-is-the-headline-per-customer-estimator)).
- The dashboard chain footnote shows the **median** estimator (robust
  to heavy-tail outliers — typically smaller than the headline) and the
  **max-based** estimator (treats peak instantaneous share as the
  proxy — typically larger). Together they bracket the plausible range.
- The coverage gate flags (FIPS, T) cells with thin evidence so a
  reader knows when to lean less on the headline.

These are the working tools that make A011 honest at the point of use.

### Suggested resolution path

The empirical fix is per-`OutageId` data — vendor or utility feeds that
carry individual outage lifespans, not just snapshot counts. Two
candidates already documented in the project:

- A contracted PowerOutage.US live API ([`docs/extra/poweroutage_us/`](../extra/poweroutage_us/)
  — the trial extract is staged locally; commercial agreement pending).
- Utility OMS overlap on a target footprint (longer lead time; requires
  vendor relationships).

When either source is available, [Phase 4 of the per-customer pricing
plan](../plan/per_customer_pricing_plan.md#phase-4--external-validation-against-poweroutageus-per-outage-data)
runs the validation: build per-`OutageId` events for a comparable
window, compute the per-customer rate directly (no synchronous
approximation), and compare to the EAGLE-I-derived multiplier. The
output is either (a) confirmation that the synchronous approximation
is within the sensitivity band, or (b) an empirical correction factor
that we fold back into the multiplier.

Phase 4 is **refinement work**, not a gate on the price. The price
ships now; the refinement tightens A011 when capacity permits.

### Why this is treated as a documented assumption, not a "shadow"

v0 already ships with eight documented assumptions
(A001–A008) — including some genuinely-untested ones like A001 (UTC
timestamps), placeholder commercial defaults like A006 (ER = 0.20,
TM = 0.15), and known simplifications like A007 (no portfolio
correlation). None of those are called "shadow"; they are documented
in the registry and the engine ships.

A011 is the same shape. It is a **data-constrained measurement
assumption** with a clear resolution path. The per-customer chain that
rests on it produces a number that is, by every empirical measure we
have so far, **more accurate than v0's county-trigger rate** — Phase 1
showed v0 over-prices the per-customer expected loss by 100×–4000×
depending on the county, which is a far larger systematic error than
the plausible synchronous-vs-staggered band of A011.

Treating per-customer as "shadow" while shipping v0 as "the price"
would invert the accuracy ordering. The correct posture is: ship
per-customer as the headline, document its one new assumption (A011)
in the registry alongside v0's assumptions, and queue Phase 4 as
ongoing refinement.

This refines the modifier lifecycle in the
[adjustment framework](../plan/outage_baseline_adjustment_framework.md#modifier-lifecycle):
**bias-correction modifiers** (like this one) graduate via the
assumption registry once their data constraint is documented;
**forward-regime modifiers** (climate, grid condition, hazard) still
require external validation because they project future conditions
rather than correct present measurement.

## What this stage is not

A short, deliberately explicit list of things this view does **not**
claim:

- It is **not** a quotable price. The headline figure on the dashboard
  for any cell is still the v0 county-trigger retail premium. The
  per-customer view is shadow-only.
- It does **not** measure per-individual probability. It measures
  county-average per-customer rate.
- It does **not** account for customer-feeder correlation.
- It does **not** account for staggered outage profiles within an event
  (synchronous-outage assumption).
- It does **not** reflect any forward-looking adjustment (climate, grid,
  hazard). Those are separate overlays in the
  [adjustment framework](../plan/outage_baseline_adjustment_framework.md).
- It does **not** replace v0. v0 numbers in this engine are unchanged.

## What it does do

- Closes the most material interpretation gap in v0 — pricing on a
  county-event rate while quoting per customer.
- Surfaces order-of-magnitude information about the per-customer expected
  loss in a commercially plausible range ($10–$300 / yr / customer at
  T = 4 h, X = $500 across the Phase 1 county sample, vs $10k–$300k under
  the unadjusted v0 number for the same cells).
- Documents every choice with a stable-ID assumption.
- Exposes a sensitivity range so reviewers can judge robustness without
  re-running the math.
- Forward-compatible with the location-aware product track and the
  PowerOutage.US per-outage validation.

## Cross-references

- [Pricing Methodology](pricing_methodology.md) — formula-level summary,
  status of v0 vs Phase-2 shadow output.
- [Per-Customer Pricing Plan](../plan/per_customer_pricing_plan.md) —
  phased rollout, gates, open questions.
- [`customer_impact_v1` model card](../../curated_outage_data/model_cards/customer_impact_v1.md)
  — cap, floor, failure modes, rollback path.
- [`per_customer_lambda.md` schema](../../curated_outage_data/schemas/per_customer_lambda.md)
  — exact field semantics in the parquet output.
- [Phase 1 notebook (HTML)](../../notebooks/outputs/per_customer_rate_phase1/per_customer_rate_phase1.html)
  — the empirical evidence that motivated this whole track.
- [Assumptions registry](assumptions.md) — A001 through A010 are all
  cited in this walkthrough.
