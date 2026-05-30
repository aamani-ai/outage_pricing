# Assumptions Registry

Every methodology and plan in this project may make explicit assumptions
about data, math, time, scope, product, or operations. Those assumptions
live here with stable IDs so they can be cited from multiple files without
duplication.

This is the audit trail. A reviewer should be able to ask "why do you do X
that way" and follow a citation to a single entry here.

## Conventions

- **IDs** are sortable strings: `A001`, `A002`, etc., assigned in order
  added. Once assigned, an ID is permanent.
- **Status** can change (`active`, `validated`, `retired`, `disputed`)
  but the ID does not move and entries are never deleted — retired
  entries get a `retired` status with a closure note.
- **Categories**: `data`, `time`, `math`, `scope`, `product`,
  `operational`.

## Citation style

In a methodology or plan file:

```text
We treat raw EAGLE-I timestamps as UTC instants ([A001](../methodology/assumptions.md#a001--eagle-i-raw-timestamps-are-utc)).
```

Do not restate the assumption text outside this file. If you find
yourself needing to, the assumption needs an ID and an entry here.

## Template

```text
### A0NN — short title

- **Category:** data | time | math | scope | product | operational
- **Status:** active | validated | retired | disputed
- **First written:** YYYY-MM-DD
- **Last reviewed:** YYYY-MM-DD
- **Owner:** name or role

**Statement.** One paragraph. What we are assuming.

**Justification.** Why this is reasonable; what evidence supports it.

**Impact if wrong.** What changes downstream if this is invalidated.

**Cited from.** Which methodology / plan sections cite this assumption.
```

---

## Registry

### A001 — EAGLE-I raw timestamps are UTC

- **Category:** time
- **Status:** active
- **First written:** 2026-05-30
- **Last reviewed:** 2026-05-30
- **Owner:** modeling

**Statement.** `run_start_time` strings in `eaglei_outages_YYYY.csv`
carry no timezone offset. v0 interprets every such string as a UTC
instant and stores derived event timestamps as timezone-naive UTC.

**Justification.** Cross-year event continuity requires a single
time-zone interpretation; UTC avoids DST artifacts that would shift
durations by ±1h twice per year per FIPS. No DST artifact is observed in
the duration histogram.

**Impact if wrong.** Event start/end timestamps, durations, and
annualization-window boundaries would be misaligned by up to several
hours. `S(T)` at small T (e.g. 2 h) would be biased.

**Cited from.** [Data Ingestion §Time semantics](data_ingestion_methodology.md#time-semantics), [Event Catalog Creation §Time](event_catalog_creation_methodology.md#time-semantics), `price_engine/data/SCHEMA.md`.

---

### A002 — `customers_out > 0` is the inclusion threshold for events

- **Category:** math, scope
- **Status:** active
- **First written:** 2026-05-30
- **Last reviewed:** 2026-05-30
- **Owner:** modeling

**Statement.** A 15-minute snapshot is included in an event if and only
if `customers_out > 0`. No minimum customer count, no minimum percent of
MCC, no severity threshold is applied at event construction.

**Justification.** The v0 contract triggers on the binary question "did
the county have an outage of duration ≥ T," not on how many customers
were affected. Severity belongs in filtration (D-tiers) or in the
customer-impact modifier — not in event existence.

**Impact if wrong.** A higher threshold would drop real short / small
events, inflate `S(T)`, and over-price every contract. A lower (negative)
threshold is not possible.

**Cited from.** [Event Catalog Creation §Choice B](event_catalog_creation_methodology.md#snapshot-threshold), `price_engine/data/EVENT_CONSTRUCTION.md`. Closely related to [A009](#a009--per-customer-customer_impact_multiplier-first-order-estimator), which addresses the downstream effect of this choice on per-customer expected loss.

---

### A003 — Each EAGLE-I 15-min snapshot represents the interval `[t, t + 15 min)`

- **Category:** data, time
- **Status:** active
- **First written:** 2026-05-30
- **Last reviewed:** 2026-05-30
- **Owner:** modeling

**Statement.** A row with `run_start_time = t` and `customers_out = c`
asserts that `c` customers were without power for the half-open interval
beginning at `t`. The event `end_time` is computed as
`last_observed_snapshot_run_start_time + 15 minutes` (exclusive).

**Justification.** The +15-min convention matches EAGLE-I's native
cadence and Figshare descriptor. Without it, single-snapshot events
would have duration zero, which is physically impossible.

**Impact if wrong.** All durations would be biased low by 15 min /
event, equivalent to ~25% on a 1-h median. S(T) curves would shift
left.

**Cited from.** [Event Catalog Creation §Interval rules](event_catalog_creation_methodology.md#interval-rules), `price_engine/data/SCHEMA.md`.

---

### A004 — Annualization denominator is the source observation window

- **Category:** math, time
- **Status:** active
- **First written:** 2026-05-30
- **Last reviewed:** 2026-05-30
- **Owner:** modeling

**Statement.** `n_per_year = n_events_total / source_observation_years`,
where `source_observation_years` is the raw EAGLE-I exposure window
(currently 2014-11-01 04:00 UTC → 2026-01-01 00:00 UTC ≈ 11.167 years).
The denominator is **not** computed from each county's first or last
observed event date, and **not** from a naive count of 12 calendar
years.

**Justification.** First/last per-county event dates would
artificially inflate annual rates for quiet counties whose first
outage happened late in the dataset. Using calendar years (12) would
under-rate counties because 2014 is only a partial year.

**Impact if wrong.** All per-county `lambda(T)` values move by the
ratio. A naive 12-year denominator would understate `lambda` by
~12/11.167 = 7.5%; per-county first/last would overstate rates for
quiet counties.

**Cited from.** [Aggregation and Annualization](aggregation_and_annualization_methodology.md), `price_engine/data/SCHEMA.md`, `price_engine/data/annualization_meta.json`.

---

### A005 — `S(T)` is raw empirical; no parametric duration distribution in v0

- **Category:** math, scope
- **Status:** active
- **First written:** 2026-05-30
- **Last reviewed:** 2026-05-30
- **Owner:** modeling

**Statement.** For each county, `S(T) = |{events with duration_hours ≥
T}| / |{all events}|`. No Lognormal, Weibull, Exponential, GPD, KDE,
or other fitted distribution is used in v0 pricing.

**Justification.** Empirical S(T) is defensible, auditable, and
non-parametric. v0 is the regulator-friendly baseline; parametric
extensions belong in v0.5+ as challengers, with backtest evidence.

**Impact if wrong.** Confidence at long T (e.g. 24 h) is tied to the
amount of evidence, not a smoothed curve. Counties with thin data have
noisy S(T) at long T. v0 accepts this and exposes it through the
modelability filter.

**Cited from.** [Pricing](pricing_methodology.md), `price_engine/data/SCHEMA.md`, `price_engine/plan/02_pricing_math.md`.

---

### A006 — Default loads: ER = 0.20, TM = 0.15, UncLoad = $0

- **Category:** product
- **Status:** active
- **First written:** 2026-05-30
- **Last reviewed:** 2026-05-30
- **Owner:** product / modeling

**Statement.** `Retail = (Pure + UncLoad) / (1 − ER − TM)` with defaults
`ER = 0.20`, `TM = 0.15`, `UncLoad = 0`. ER and TM are configurable in
the dashboard via sliders (0-40% each). UncLoad has a reserved slot but
is zero in v0; v0.5 fills it.

**Justification.** ER and TM are placeholder commercial assumptions
chosen to be in a reasonable range for an SMB parametric product.
UncLoad = 0 in v0 means the v0 retail premium is "pure premium grossed
up by the load denominator," not an uncertainty-adjusted price.

**Impact if wrong.** Retail premium scales by `1 / (1 − ER − TM)`. The
slot for UncLoad is structural; activating it changes the retail
premium chain.

**Cited from.** [Pricing](pricing_methodology.md), `price_engine/plan/02_pricing_math.md`, dashboard pricing controls.

---

### A007 — Each policy is priced standalone (no portfolio correlation in v0)

- **Category:** scope
- **Status:** active
- **First written:** 2026-05-30
- **Last reviewed:** 2026-05-30
- **Owner:** modeling

**Statement.** If `N` policies are written in the same FIPS, v0
prices each as if standalone. All `N` would trigger simultaneously on
the same county event. v0 makes no aggregation adjustment.

**Justification.** Portfolio aggregation is a v1 problem and requires
correlation modeling and customer-count-aware loss math. v0 is
explicitly per-policy and per-FIPS only.

**Impact if wrong.** Aggregate portfolio loss expectation could be
materially understated if customer-count-aware aggregation is required
to price reinsurance or capacity.

**Cited from.** [Pricing](pricing_methodology.md), `price_engine/plan/02_pricing_math.md`, `docs/plan/portfolio_risk_engine_plan.md`.

---

### A008 — MCC is a static per-county "customer" count

- **Category:** data
- **Status:** active
- **First written:** 2026-05-30
- **Last reviewed:** 2026-05-30
- **Owner:** modeling

**Statement.** `MCC` (Modeled County Customers, shipped with EAGLE-I as
`MCC.csv`) is a static per-FIPS estimate of total customers — same
"customer" unit as `customers_out` (metered electric accounts, ~one per
household or small business). It is not population, not refreshed by
year, and not feeder-level.

**The "customer" unit aligns naturally with the contract unit.** An
EAGLE-I / Moehl 2023 "customer" is a metered electric account — one
billed entity behind one meter. That is the same granularity at which
parametric outage insurance is sold: **one policy per insurable entity**
(a residence with one meter, a small business with one meter, etc.).
A 4-person household with one meter is one customer and one
policyholder. A 200-unit building with separate meters per unit is 200
customers and would underwrite as 200 separate policies. The
per-customer pricing math is therefore directly the *per-policy
expected loss* under the assumption of one policy per metered entity —
no further unit conversion is needed between the data layer and the
underwriting layer.

**Justification.** Moehl et al. 2023 (Nature Scientific Data) defines
MCC as a static model output. v0 uses it as the denominator for the
peak %MCC severity proxy and for the per-customer pricing plan (see
[A009](#a009--per-customer-customer_impact_multiplier-first-order-estimator)).

**Impact if wrong.** Counties with fast customer growth since the
MCC modeling year would have an inflated peak %MCC and an inflated
per-customer multiplier. Sensitivity check is part of Phase 1 of the
per-customer plan.

**Cited from.** [Pricing](pricing_methodology.md), [Filtration](filtration_methodology.md), `price_engine/data/SCHEMA.md`, `price_engine/data/INVENTORY.md`, dashboard Peak % MCC tooltip.

---

### A009 — Per-customer `customer_impact_multiplier` first-order estimator

- **Category:** math
- **Status:** active — phase-1 validation in progress
- **First written:** 2026-05-30
- **Last reviewed:** 2026-05-30
- **Owner:** modeling

**Statement.** The first-order estimator for the per-customer impact
multiplier on `lambda(T)` is

```text
customer_impact_multiplier(fips, T)
  = E[ mean_customers / MCC  |  duration_hours >= T ]
```

i.e. the average share of the county's customers affected during
qualifying events, where the average is over the event population
defined by the selected catalog. The resulting per-customer rate is

```text
lambda_customer(T) = lambda_county(T) * customer_impact_multiplier(fips, T)
```

**Justification.** First-order, data-already-available; uses
`mean_customers` (event-level aggregate over observed positive
snapshots) and the documented `MCC` denominator. Avoids assuming any
parametric model. The choice of `mean` over `max` reflects that
customer-outage spans within a county event are typically staggered;
mean is a closer approximation to "share of customers affected during
the event."

**Impact if wrong.** Phase 1 will test sensitivity against `max
/ MCC`, time-weighted mean, and per-outage reconstruction (Path C in
the per-customer plan). If the first-order estimator is biased, the
shadow rate is recomputed before it reaches the dashboard.

**Cited from.** [`docs/plan/per_customer_pricing_plan.md`](../plan/per_customer_pricing_plan.md), [Pricing §Per-customer view](pricing_methodology.md), [Phase 1 notebook (executed 2026-05-30)](../../notebooks/outputs/per_customer_rate_phase1/per_customer_rate_phase1.html).

---

### A010 — Mean (not max) of `customers_out / MCC` is the headline per-customer estimator

- **Category:** math
- **Status:** active — validated by Phase 1
- **First written:** 2026-05-30
- **Last reviewed:** 2026-05-30
- **Owner:** modeling

**Statement.** Where the per-customer multiplier ([A009](#a009--per-customer-customer_impact_multiplier-first-order-estimator))
calls for `E[customers_out / MCC | duration >= T]`, the **headline**
estimator uses `mean_customers / MCC` per event, not `max_customers / MCC`.
The max-based version is computed and published as a **sensitivity
column**, not the headline.

**Justification.** The contract pays based on a customer's own outage
experience during the event, which is closer to the time-averaged share
of customers affected than to the peak instantaneous share. Phase 1
showed the two estimators differ by **5–7×** for Alachua FL at T=4h
(`multiplier_mean = 0.000333` vs `multiplier_max = 0.002113`), so the
choice is not cosmetic — picking max would shift the published shadow
premium by the same factor.

**Impact if wrong.** If max is the more honest estimator (e.g. customer
outage spans are NOT staggered — all affected customers are out the full
event duration), the headline per-customer premium is understated by
5–7×. Phase 4 (PowerOutage.US per-outage cross-check) will measure this
empirically.

**Cited from.** [`docs/plan/per_customer_pricing_plan.md`](../plan/per_customer_pricing_plan.md) (Phase 1 gate close), [Phase 1 notebook §F3](../../notebooks/outputs/per_customer_rate_phase1/per_customer_rate_phase1.html).
