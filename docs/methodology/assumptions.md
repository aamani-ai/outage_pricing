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
We treat raw EAGLE-I timestamps as UTC instants ([A001](assumptions.md#a001--eagle-i-raw-timestamps-are-utc)).
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

**Cited from.** [Data Ingestion §Time semantics](01_eventization/data_ingestion_methodology.md#time-semantics), [Event Catalog Creation §Time](01_eventization/event_catalog_creation_methodology.md#time-semantics), `price_engine/data/SCHEMA.md`.

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

**Cited from.** [Event Catalog Creation §Choice B](01_eventization/event_catalog_creation_methodology.md#snapshot-threshold), `price_engine/data/EVENT_CONSTRUCTION.md`. Closely related to [A009](#a009--per-customer-customer_impact_multiplier-first-order-estimator), which addresses the downstream effect of this choice on per-customer expected loss.

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

**Cited from.** [Event Catalog Creation §Interval rules](01_eventization/event_catalog_creation_methodology.md#interval-rules), `price_engine/data/SCHEMA.md`.

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

**Cited from.** [Aggregation and Annualization](02_per_customer/aggregation_and_annualization_methodology.md), `price_engine/data/SCHEMA.md`, `price_engine/data/annualization_meta.json`.

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

**Cited from.** [Pricing](cross_cutting/pricing_methodology.md), `price_engine/data/SCHEMA.md`, `price_engine/plan/02_pricing_math.md`.

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

**Cited from.** [Pricing](cross_cutting/pricing_methodology.md), `price_engine/plan/02_pricing_math.md`, dashboard pricing controls.

---

### A007 — Each policy is priced standalone (no portfolio correlation in v0)

- **Category:** scope
- **Status:** active
- **First written:** 2026-05-30
- **Last reviewed:** 2026-06-03
- **Owner:** modeling

**Statement.** If `N` policies are written in the same FIPS, v0
prices each as if standalone. All `N` would trigger simultaneously on
the same county event. v0 makes no aggregation adjustment.

**Justification.** Portfolio aggregation is a v1 problem and requires
correlation modeling and customer-count-aware loss math. v0 is
explicitly per-policy and per-FIPS only.

**Impact if wrong.** The mean-vs-tail split matters here and v0 only
gets the mean right:

- **Expected portfolio loss is concentration-invariant.** By linearity
  of expectation, `E[Σ payouts] = N · per-policy EL` whether or not
  intra-county triggers are correlated. v0's per-policy expected-loss
  pricing is *correct on the mean* for portfolios, assuming the
  per-policy `p` is correct.
- **Variance and tail are NOT invariant.** Under v0's implicit
  independence assumption, portfolio `Var ≈ N · p(1−p) · X²`. Under
  the true joint-trigger model (one county event triggers all `N`
  policies simultaneously), `Var ≈ N² · p(1−p) · X²` — an `O(N)`
  blow-up in variance and `O(√N)` in standard deviation. The tail
  event becomes "with probability `p`, lose `N · X`" rather than
  "with probability ~`p^N`, lose `N · X`." Reinsurance, capacity, and
  capital math live in this second moment.
- **The per-customer overestimation cushion does not help here.** The
  cushion documented under [A011](#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation)
  lives on the *mean*. It does not blunt the concentration-induced
  tail blow-up.

**Scale sensitivity.** Latent at SMB scale (typical per-county policy
counts 1–3 keep absolute tail dollars small). Bites first in
hazard-prone counties (hurricane belt, storm corridors, fire zones) as
the book scales, because both `p` and `N` rise together there. Treated
as a **lagged-implementation track** rather than an immediate gate; see
[concentration_and_portfolio_risk.md](cross_cutting/concentration_and_portfolio_risk.md)
and the [roadmap entry](roadmap.md#portfolio-concentration-handling-lagged).

**Cited from.** [Pricing](cross_cutting/pricing_methodology.md), `price_engine/plan/02_pricing_math.md`, [`docs/plan/portfolio_risk_engine_plan.md`](../plan/05_forward_regime/portfolio_risk_engine_plan.md), [`concentration_and_portfolio_risk.md`](cross_cutting/concentration_and_portfolio_risk.md), [Roadmap §Portfolio concentration handling (lagged)](roadmap.md#portfolio-concentration-handling-lagged).

---

### A008 — MCC is a static per-county "customer" count

- **Category:** data
- **Status:** active
- **First written:** 2026-05-30
- **Last reviewed:** 2026-06-03
- **Owner:** modeling

**Statement.** `MCC` (Modeled County Customers, shipped alongside the
EAGLE-I dataset as `MCC.csv` — the [Modeled County Customers 2023
release](https://openenergyhub.ornl.gov/explore/dataset/modeled-county-customers-2023/))
is a static per-FIPS estimate of total electric utility customers.
It is derived per [Brelsford et al. (Nature Scientific Data
2024)](https://www.nature.com/articles/s41597-024-03095-5) by spatially
allocating each utility's EIA-861 total customer count across the
counties intersected by its HIFLD electric retail service territory,
weighted by LandScan day+night population. The county's MCC is the
sum of allocations from every utility whose service area touches it.
Formally, for utility *u* and county *i*:

```text
c_{u,i} = p_{u,i} × (C_u / P_u)

MCC(i) = Σ_u  c_{u,i}
```

where `C_u` is the utility's total EIA-861 customer count, `P_u` is its
service-area LandScan population, and `p_{u,i}` is the LandScan
population of county *i* lying inside utility *u*'s HIFLD territory.

**The "customer" unit is not uniform across utilities.** Brelsford
et al. note verbatim that utilities define "customers" *"in a range of
different ways, most typically the electric meter, a building, or a
facility."* So a "customer" in MCC is usually a meter — but for some
utilities it is a building or a facility, depending on each utility's
own reporting convention to EIA-861. This adds a layer of noise to any
per-customer ratio: counties served by per-meter reporters are not
strictly comparable to counties served by per-building reporters.

**Where it aligns with the contract unit.** When a utility reports
customers as meters (the most typical case), MCC's customer unit aligns
naturally with the parametric outage contract unit — one policy per
metered entity. A 4-person household with one meter is one customer and
one policyholder; a 200-unit building with separate meters per unit is
200 customers and would underwrite as 200 separate policies. When a
utility instead reports customers as buildings or facilities, the
alignment loosens, though `customers_out` in EAGLE-I and `customers`
in MCC use the same source convention so the *ratio* `customers_out /
MCC` remains internally consistent within each utility's territory.

The dataset is a **static 2023 model output**, not refreshed by year,
and not feeder-level.

**Justification.** Brelsford et al. 2024 (the canonical EAGLE-I paper)
documents the MCC derivation methodology end-to-end. Its three inputs
are themselves authoritative: EIA-861 (mandatory annual utility
filings), LandScan USA (the standard high-resolution US population
product), and HIFLD electric retail service territories. v0 uses MCC
as the denominator for the peak %MCC severity proxy and for the
per-customer pricing chain (see
[A009](#a009--per-customer-customer_impact_multiplier-first-order-estimator)).

**Impact if wrong.** Three distinct failure modes:

1. **Customer-growth drift.** Counties with material customer growth
   since the 2023 MCC vintage have an inflated peak %MCC and an
   inflated per-customer multiplier. Sensitivity check is part of
   Phase 1 of the per-customer plan.
2. **Allocation error.** If LandScan population is a poor proxy for
   customer density within a utility's territory (e.g. a service area
   that is geographically large but population-sparse on one side and
   dense on the other, with non-uniform customer density), the
   per-county allocation `c_{u,i}` is biased. The bias direction varies
   by county.
3. **Non-uniform customer unit.** Per-county comparisons across
   counties with different utility-mix compositions (per-meter vs
   per-building vs per-facility reporters) carry a unit-noise term that
   we cannot remove without per-utility unit metadata.

**Cited from.** [Pricing](cross_cutting/pricing_methodology.md), [Filtration](cross_cutting/filtration_methodology.md), `price_engine/data/SCHEMA.md`, `price_engine/data/INVENTORY.md`, dashboard Peak % MCC tooltip, [`fundamentals/eagle_i_data_fundamentals.md`](cross_cutting/eagle_i_data_fundamentals.md), [`fundamentals/per_customer_pricing_fundamentals.md`](02_per_customer/per_customer_pricing_fundamentals.md).

---

### A009 — Per-customer `customer_impact_multiplier` first-order estimator

- **Category:** math
- **Status:** active — shipped
- **First written:** 2026-05-30
- **Last reviewed:** 2026-05-30
- **Owner:** modeling

> **Shipping status (2026-05-30):** the per-customer chain is the dashboard
> headline price as of this date. The first-order estimator described
> here is shipped; the underlying synchronous-outage data constraint is
> documented separately in [A011](#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation).

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

**Cited from.** [`docs/plan/per_customer_pricing_plan.md`](../plan/02_per_customer/per_customer_pricing_plan.md), [Pricing §Per-customer view](cross_cutting/pricing_methodology.md), [Phase 1 notebook (executed 2026-05-30)](../../notebooks/outputs/per_customer_rate_phase1/per_customer_rate_phase1.html).

---

### A010 — Mean (not max) of `customers_out / MCC` is the headline per-customer estimator

- **Category:** math
- **Status:** active — shipped (mean is the headline; max is the sensitivity upper bound shown in the per-customer chain footnote)
- **First written:** 2026-05-30
- **Last reviewed:** 2026-06-03
- **Owner:** modeling

**Statement.** Where the per-customer multiplier ([A009](#a009--per-customer-customer_impact_multiplier-first-order-estimator))
calls for `E[customers_out / MCC | duration >= T]`, the **headline**
estimator uses `mean_customers / MCC` per event, not `max_customers / MCC`.
The max-based version is computed and published as a **sensitivity
column**, not the headline.

**Two distinct sensitivities live alongside the headline — they answer
different questions and perturb the estimator at different levels.**

| Estimator | Inner (per-event) statistic | Outer (across-events) statistic | Question answered |
|---|---|---|---|
| `multiplier_mean` (headline) | `mean_customers` | `mean` | average qualifying event |
| `multiplier_median` (sensitivity) | `mean_customers` (same as headline) | **`median`** | *typical* qualifying event (robust to outlier storms) |
| `multiplier_max` (sensitivity) | **`max_customers`** | `mean` | average qualifying event evaluated at its peak instant |

`multiplier_median` is a **Level-2 (outer) swap** — it asks "what is the
multiplier for a typical qualifying event, ignoring rare catastrophic
events that pull the mean upward?" It has the same inner statistic as
the headline. It is **not** the median of per-event medians; it is the
median across events of the same per-event-mean ratio the headline uses.

`multiplier_max` is a **Level-1 (inner) swap** — it asks "what if mean is
the wrong summary of the per-event snapshots and we should use the peak
instead?" It has the same outer aggregator as the headline.

**Justification.** The contract pays based on a customer's own outage
experience during the event, which is closer to the time-averaged share
of customers affected than to the peak instantaneous share. Phase 1
showed `multiplier_mean` and `multiplier_max` differ by **5–7×** for
Alachua FL at T=4h (`multiplier_mean = 0.000333` vs
`multiplier_max = 0.002113`), so the inner-statistic choice is not
cosmetic — picking max would shift the published shadow premium by the
same factor. The median sensitivity adds a complementary view (robust to
outlier events) that the inner-statistic max sensitivity cannot give.

**Impact if wrong.** If max is the more honest estimator (e.g. customer
outage spans are NOT staggered — all affected customers are out the full
event duration), the headline per-customer premium is understated by
5–7×. Phase 4 (PowerOutage.US per-outage cross-check) will measure this
empirically. If the headline mean is being pulled upward by a few
outlier major-storm events, `multiplier_median` shows by how much; the
gap between mean and median is itself a heavy-tail diagnostic for the
qualifying-event population.

**Cited from.** [`docs/plan/per_customer_pricing_plan.md`](../plan/02_per_customer/per_customer_pricing_plan.md) (Phase 1 gate close), [Phase 1 notebook §F3](../../notebooks/outputs/per_customer_rate_phase1/per_customer_rate_phase1.html).

---

### A011 — Per-customer multiplier rests on a synchronous-outage approximation

- **Category:** math
- **Status:** active — shipped with documented data constraint
- **First written:** 2026-05-30
- **Last reviewed:** 2026-06-03
- **Owner:** modeling

**Statement.** The per-customer chain treats `mean_customers` (per-event
customer-count aggregate from EAGLE-I) as a proxy for the share of
customers actually affected during the event. This rests on a
**synchronous-outage approximation**: the M customers represented by
`mean_customers` are modelled as a single persistent set, out for the
full event duration, so the per-customer probability of being out for
≥ T equals M / MCC. EAGLE-I publishes 15-minute customer-count snapshots
only — not customer identifiers — so synchronous vs staggered outage
profiles cannot be distinguished from this dataset alone. The
approximation is intrinsic to the input data and is the constraint that
the rest of the per-customer chain inherits.

**Justification.** Without per-customer identifiers, no scalar proxy is
exact. The mean of `mean_customers / MCC` over qualifying events is the
most defensible first-order estimator under the synchronous model: it
falls out of "expected customer-event count per year" directly
([A009](#a009--per-customer-customer_impact_multiplier-first-order-estimator)),
it is simple, and it uses only data already in our pipeline. The
accompanying [A010](#a010--mean-not-max-of-customers_out--mcc-is-the-headline-per-customer-estimator)
sensitivity (median + max bounds reported alongside the headline) makes
the per-event distribution shape visible to the reader without forcing
a single choice on the assumption.

**Impact if wrong.** Reality lies on a spectrum between two extremes,
and the direction of bias depends on how individual outage durations
are distributed relative to the trigger threshold `T`:

- **Fully synchronous** (all M customers out for the full duration) — the
  multiplier is exact.
- **Fully staggered with individual durations < T** (different customers
  cycling through each snapshot, averaging to M, none crossing T) — no
  individual customer is out for the full duration; the multiplier
  **overstates** the per-customer rate. This is the realistic
  *core + periphery* regime: a small set of customers inside the damage
  radius is out for the full event (correctly triggers) plus a much
  larger set of brief restoration-churn outages well below T (lifts M
  but does not trigger). Worked Cases B and C in the
  [per-customer view walkthrough](02_per_customer/per_customer_view_walkthrough.md#why-it-is-a-model-and-not-a-measurement)
  show overstatement factors of ~3× in the canonical core+periphery
  case.
- **Knife-edge regime — durations clustered at T** (Case D in the
  walkthrough) — the only regime where the multiplier *understates*; it
  has no physical reason to occur and requires individual outage
  durations to align narrowly with a contract-chosen threshold.

Realistic outages live in the second bullet, so the systematic
direction of bias under real-world staggered restoration is
**overestimation** — the **conservative direction for insurance
pricing**. It produces a 2–3× cushion on expected loss that sits on
top of the explicit retail loadings (`TM`, `ER`, `UncLoad`), bounded
only by market-price discipline. This cushion is real on the mean
but provides **no protection against portfolio concentration tail
risk** — that is [A007](#a007--each-policy-is-priced-standalone-no-portfolio-correlation-in-v0)
territory; see [`concentration_and_portfolio_risk.md`](cross_cutting/concentration_and_portfolio_risk.md).
The dashboard's sensitivity footnote brackets the plausible range with
two complementary views of the same headline (see [A010](#a010--mean-not-max-of-customers_out--mcc-is-the-headline-per-customer-estimator)
for the formal distinction):

- `multiplier_median` — the median **across qualifying events** of the
  same per-event-mean ratio the headline uses. A robust point estimate
  of the typical-event multiplier; insensitive to a few major-storm
  outliers.
- `multiplier_max` — the mean **across qualifying events** of the
  per-event **max** ratio (peak instant, not time-average). The upper
  bound implied by replacing the synchronous-mean assumption with a
  synchronous-peak assumption.

The empirical bias of the headline within that bracket is what we
cannot measure from EAGLE-I alone.

**Suggested resolution path.** Per-`OutageId` records — e.g. a
contracted PowerOutage.US live feed, or utility OMS overlap — carry
individual outage lifespans and let us measure the synchronous-vs-
staggered mix directly. The concrete first step is documented in
[Phase 4 of the per-customer pricing plan](../plan/02_per_customer/per_customer_pricing_plan.md#phase-4--external-validation-against-poweroutageus-per-outage-data).
The output would be either (a) confirmation that the synchronous
approximation is within the sensitivity band, or (b) an empirical
correction factor that tightens the headline. Pending that work, the
per-customer chain ships with this constraint **documented**, not
**gated**.

This is the only known systematic assumption added by the per-customer
chain on top of v0; every other piece (`λ_county`, `S(T)`, MCC,
annualization, ER / TM defaults) is inherited from v0's existing
assumption stack (A001–A008).

**Cited from.** [Per-customer view walkthrough §The one assumption you must read](02_per_customer/per_customer_view_walkthrough.md#the-one-assumption-you-must-read--a011), [`customer_impact_v1` model card](../../curated_outage_data/model_cards/customer_impact_v1.md), [Per-Customer Pricing Plan](../plan/02_per_customer/per_customer_pricing_plan.md), dashboard mode-notes for the per-customer view.

---

### A012 — Per-customer exposure uses one global window (dilutes partial-coverage counties)

- **Category:** math, data
- **Status:** active — flagged; per-county fix is a pending pricing decision
- **First written:** 2026-06-22
- **Last reviewed:** 2026-06-22
- **Owner:** modeling

**Statement.** `compute_per_customer_lambda.py` divides every county's qualifying-event
count by the **same global** `source_observation_years` (~11.17 yr, per
[A004](#a004--annualization-denominator-is-the-source-observation-window)); it is not
adjusted for per-county source coverage. A county whose source was reliably observed
for only part of the window is still divided by the full ~11.17 yr, so its
`lambda_county` — and therefore `lambda_customer` — is biased **low**.

**Justification (why A004 chose this, and where it breaks).** A004 deliberately avoids
per-county first/last-event windows because they inflate rates for genuinely *quiet*
counties whose first outage happened late. That is correct for a quiet-but-fully-observed
county. It does **not** hold for a county with genuine **missing source years** (e.g.
Texas 2016, where 135/254 counties have zero all-duration source events): there the
global window counts unobserved years as exposure and dilutes the rate. A004's
denominator conflates "quiet" with "unobserved."

**Impact if wrong / direction of bias.** Direction is **understatement** →
**anti-conservative** (under-pricing). It pulls **opposite** to the
[A011](#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation)
conservative cushion, so in poorly-covered counties the exposure dilution **erodes the
A011 cushion** — and invisibly, because the cell-read `C_source` historically used this
same flat number. Magnitude scales with the coverage gap: a county truly observed ~8 of
~12 yr is ~1.4× understated; Concho TX (interior 2016 gap) ~1.2×.

**Detection vs fix (sequencing).**
- *Detection (shipped, diagnostic):* the Step 1–2 cell read now computes `C_source` from
  **per-county** coverage (distinct observed years / window) + known-gap hard-flags, so
  affected cells read **Thin** instead of falsely **Strong**. No price change.
- *Fix (pending pricing decision):* replace the global denominator with **per-county
  observed years**, counting only genuinely-observed years — which preserves A004's
  anti-inflation intent (a fully-observed quiet county keeps the full window) while
  excluding true source gaps. This moves `lambda_customer` for affected counties and must
  be validated, so it is sequenced as its own item, not slipped into the diagnostic.
- *Prerequisite:* the per-year observed-vs-missing **source-coverage mask** (also the
  Step-3 clustering prerequisite) is the shared artifact powering both the fix and a
  fuller `C_source`.

**Cited from.** [`inner_event_shape_diagnostics.ipynb`](../../notebooks/02_per_customer/inner_event_shape_diagnostics.ipynb) (Step 1–2 cell read), [Eventization & Frequency Contract discussion](../dicsscssion/eventization_frequency_contract/01_eventization_frequency_discussion.md) (observed-zero vs missing-year); related to [A004](#a004--annualization-denominator-is-the-source-observation-window) and [A011](#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation).

### A013 — Risk regime is behavior-based (outage history alone; cause data deferred)

- **Category:** modeling
- **Status:** active — Step-3 design decision
- **First written:** 2026-06-22
- **Last reviewed:** 2026-06-22
- **Owner:** modeling

**Statement.** The Step-3 risk regime is derived **only** from a county's masked annual
qualifying-event count series and features computed from it. Cause covariates
(weather / climate, grid condition, asset age, geography, hazard exposure) are **not** inputs
to regime derivation. The regime classifies *behavior* ("episodic / trendy / flat"), not *cause*.

**Justification.** Behavior is observable in the counts; cause is not required to detect it. A
behavior-based regime is defensible to a carrier with no climate model in the room, and it lets
the regime be built today on EAGLE-I history. Cause data enters later as (1) a richer forecasting
expert the regime routes to, or (2) enrichment that explains/refines a regime — neither is
load-bearing for routing.

**Impact if wrong / direction.** If behavior alone is too weak to separate counties that need
different estimators, the backtest's aggregate routing-vs-flat check (Q2) fails and we default to
flat — a visible null result, not a hidden error. No price bias either direction.

**Cited from.** [`regime_routing_backtest_plan.md`](../plan/03_risk_clustering/regime_routing_backtest_plan.md); [`OUTAGE_MODELING_FRAMEWORK.md`](../OUTAGE_MODELING_FRAMEWORK.md) Step 3 ▸ Reframe.

### A014 — Regime derived at T=8h and asserted T-invariant (one per county)

- **Category:** modeling
- **Status:** active — **partially validated** (moderate, not exact T-stability; see result below)
- **First written:** 2026-06-22
- **Last reviewed:** 2026-06-22
- **Owner:** modeling

**Statement.** A county receives **one primary** regime label, derived from its annual series at the
**T = 8h** duration threshold — *not* a separate label per T. It is **not** asserted blanket-invariant
(that was the original framing); instead the classifier is run at every T and each county carries a
**cross-T stability flag** (Option C). High-agreement counties are trusted as a fixed identity;
T-sensitive counties are flagged for lower confidence and handled per-T in Step-5 forecasting. See
[`regime_classification_methodology.md`](03_risk_clustering/regime_classification_methodology.md) §5.

**Validation result (2026-06-22, [`regime_classification.ipynb`](../../notebooks/03_risk_clustering/regime_classification.ipynb)).** Mean cross-T agreement (T=2/4/12/24 vs T=8h) is **≈0.60** on the
5-outcome label — well above chance — so the regime carries real cross-T signal but is an
**approximation, not a rigid identity**. Each county carries a stability flag; T-sensitive ones are
flagged lower-confidence rather than trusted as fixed. (The earlier backtest prototype found the
same shape: 57/62% per-T on its labels, more stable on the binary stable-vs-typed split.) Treat
T=8h as the reference label and route low-agreement counties cautiously.

**Justification.** T=8h is the robustly-conservative threshold (strong structural over-count, low
boundary mass — [A011](#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation),
[`04_duration_conservatism.md`](../dicsscssion/eventization_frequency_contract/04_duration_conservatism.md)).
One regime per county is a routing identity, not a per-threshold estimate — consistent with the
"router, not forecast" framing.

**Impact if wrong / direction.** If a county's behavior genuinely differs by T, a single label
mis-routes the other thresholds. Mitigation: the backtest's **cross-T stability check (Q3)**
measures regime agreement across thresholds; material disagreement downgrades the label to flat
or flags it, rather than silently trusting T=8h.

**Cited from.** [`regime_routing_backtest_plan.md`](../plan/03_risk_clustering/regime_routing_backtest_plan.md).

### A015 — When the data can't support a label, the classifier ABSTAINS (`insufficient`)

- **Category:** modeling
- **Status:** active — Step-3 design decision (the "abstain, don't force" reframe)
- **First written:** 2026-06-22
- **Last reviewed:** 2026-06-22
- **Owner:** modeling

**Statement.** A county is assigned the explicit **`insufficient`** outcome — *not* force-fit a
behavioral regime — when (a) too few observed years (`n < 5`, *short-history*), (b) too few total
events (`< 15`, *low-volume* — peak-share etc. are ratios of ~nothing), or (c) a detected jump/surge
has fewer than 3 post-change years (*recent-change* — too new to call trend vs shift vs one-off).
~11% of counties land here. The other counties get `stable / trend / shift / episodic`; a genuinely
constant series is `stable`.

**Justification.** Short / near-zero / recently-changed histories cannot support a defensible label;
forcing one produces confident *wrong* labels (an earlier draft mislabeled Cherry NE `[0,2,4,0,22,39]`
as "trend"). Abstaining is honest and protects the labels that genuinely hold. The issue in these
cases is the data and the framing, not the rule logic.

**Impact if wrong / direction.** Some counties that *could* be typed are left `insufficient` (a missed
classification, not a wrong one). Conservative by construction; revisited as histories lengthen.

**Cited from.** [`regime_routing_backtest_plan.md`](../plan/03_risk_clustering/regime_routing_backtest_plan.md); inherits the masked series from [A012](#a012--per-customer-exposure-uses-one-global-window-dilutes-partial-coverage-counties)'s prerequisite mask.

### A016 — The all-duration coverage mask is applied as a proxy for T-specific observability

- **Category:** data
- **Status:** active — flagged; cross-resolution proxy, not yet T-validated
- **First written:** 2026-06-22
- **Last reviewed:** 2026-06-22
- **Owner:** modeling

**Statement.** The source-coverage onset mask (observed vs missing per `(fips, year)`) is derived
from **all-duration** EAGLE-I event presence, then applied **unchanged** to the threshold-specific
series (e.g. T=8h) used for regime routing. A `(fips, year)` judged under-covered on all-duration
activity is nulled for *every* T.

**Justification.** Coverage is a property of whether the county's feed was reporting at all, which
is threshold-agnostic — a sensor that wasn't onboarded missed long and short outages alike. So
all-duration presence is a defensible single coverage signal across thresholds, and it lets one
mask serve all T.

**Impact if wrong / direction.** Applying it to T=8h **discards ~1,469 county-years that still
carried a non-null T=8h count — 772 of them nonzero, totalling ~3,073 genuine ≥8h events**,
concentrated in 2015–2017. If all-duration low coverage does *not* imply those specific ≥8h events
were unreliable, the mask is over-nulling real long-outage signal in early years (direction:
removes early events → contributes to the survivorship skew toward flat for ramp counties). The
backtest is conservative either way (fewer, more-reliable years), but the proportions shift.

**Detection / mitigation (shipped).** The notebook reports the discarded-event count explicitly,
stratifies the regime distribution by first-observed-year and a confidence tier (so ramp-masked
short-history counties are visibly lower-confidence, not silently "flat"), and the permutation
test confirms the mask is **not** the source of the routing skill (improvement collapses to ≈−10%
under shuffled targets *with the mask in place*). **Open:** derive or sanity-check a T-specific
coverage signal before this ships to the actuarial consultant.

**Cited from.** [`regime_routing_backtest_plan.md`](../plan/03_risk_clustering/regime_routing_backtest_plan.md); [`regime_classification.ipynb`](../../notebooks/03_risk_clustering/regime_classification.ipynb); builds on the mask in [`05_source_coverage_mask.md`](../dicsscssion/eventization_frequency_contract/05_source_coverage_mask.md); related to [A014](#a014--regime-derived-at-t8h-and-asserted-t-invariant-one-per-county).

### A017 — The premium band is year-based & overdispersion-aware (estimator under review: confidence vs experience)

- **Category:** modeling
- **Status:** **under review (2026-06-24)** — **v1 (year-based bootstrap of the mean) currently ships**; a change to the **experience band** (empirical p10/p90 or p25/p75 of the annual counts) is proposed and under pressure-test. Decision pending team feedback.
- **First written:** 2026-06-23
- **Last reviewed:** 2026-06-24
- **Owner:** modeling

**Statement.** The premium shows as a band `{low, point, high}`. **How `low`/`high` are computed is an
open decision** — three candidates, differing greatly in width; all carry linearly through
`premium = λ·X/(1−ER−TM)` and leave the **point premium unchanged**. Full evidence + trade-offs:
[`08_band_pressure_test.md`](../dicsscssion/dashboard_redesign/08_band_pressure_test.md).

```text
  v1  confidence — bootstrap of the MEAN rate (std error ≈ spread∕√years).  median ±19%.  SHIPS TODAY.
                   Collapses to indefensible precision for high-volume steady counties (e.g. ±2%).
  v2  experience — empirical p10/p90 of the annual counts (the year swing; 80% of years). median ±53%.
                   Honest about storm years; but 60% of counties exceed ±45%.
  v2b experience — empirical p25/p75 (the middle HALF of years). median ±27%. Commercially clean, but
                   TRIMS the storm-year tail — for some counties even narrower than v1 (under-reserves).
```

A **Poisson interval on the count K** is rejected under all candidates: it assumes independent events
and is far too tight because outages cluster. Heterogeneity (the per-customer multiplier `median..max`)
is **not** the band; it is a separate *position-in-county* read — never blended in. Placement (location
basis) and forward/climate widening are likewise **out of scope** for this band, deferred to a later
proper process.

**History.** v1 shipped 2026-06-23 (bootstrap of the mean, labelled "confidence"). On 2026-06-24 a
pressure test showed v1 contradicts the year-to-year-bounce framing the dashboard already tells (the
tooltip, `07_outward_range.md`'s pitch, the learning log's "STEP 2"), and is **~2.9× too tight at the
median** — prompting the experience-band proposal and this open review. The shipped code (`rel_band`)
still implements v1 until the decision lands.

**Justification.** Outages **cluster** (a storm causes many correlated outages), so the annual-count
variance far exceeds the Poisson mean: median dispersion `var/mean = 5.0` at T=8h (12.6 at T=2h),
**94% of counties overdispersed** at T=8h. That is why a count-based Poisson band is wrong — and why
the experience band is wide exactly where it should be. The v1→v2 widening is **structural, not a
tuning choice**: a bootstrap of the mean is the standard error of the average ≈ (year-to-year spread)
∕ √(years); with ~11 observed years √11 ≈ 3.3, so using the spread itself is ≈3× wider. Measured
directly on `eagle-i-45min` (15,135 county×T cells): the experience band is a **median ~2.9× wider**
than the v1 bootstrap-of-mean band, consistently across triggers (at T=8h the median relative spread
`hi/mean − lo/mean` goes 0.38 → 1.07), wider for **98.3%** of cells. It still behaves honestly —
steady, data-rich counties stay tight (Wake NC T=8h ±5%), volatile (Alachua FL +48/−42%) and thin
(Clayton IA, ~6 events/yr, +50/−33%) counties widen. Evidence-only, no fitted distribution —
consistent with the v0 empirical method.

**Impact if wrong / direction.** The experience band uses the *full* observed annual variance, so it
conflates sampling noise, clustering, **and** trend (a worsening county's year-to-year variance
includes its trend) — direction: **wider = conservative**; trend handling is a Step-5 forward concern.
It is **not** an epistemic confidence measure — it is realized experience. For **thin** counties this
bites hardest: with **<5 observed years** or near-zero events at long T (43 zero / 76 tiny at T=8h;
89 / 225 at T=24h) we cannot separate a worsening trend from real year-to-year jitter, so the band is
unreliable → route to `insufficient` / **suppress the point quote** rather than show a meaningless
range. (Unchanged from v1.)

**Detection / mitigation.** Overdispersion and the v1/v2 widening measured on the masked annual series
(premise check `scratchpad/band_compare.py`; to be formalized in
[`premium_range`](../../notebooks/premium_range/outward_range_exploration.ipynb)). **v2 by design —
iterable**: negative-binomial / overdispersed-Poisson predictive, Bühlmann credibility, Bayesian
Gamma-Poisson remain documented alternatives if we later want a *named* parametric tail (e.g. to
justify p5/p95). The engine returns `{low, point, high}` + a `band_driver` tag and never blends
experience with heterogeneity (`communicate_to_share`). The band is **precomputed** in the pipeline
([`web/scripts/build_data.py`](../../web/scripts/build_data.py) `rel_band`).

**Cited from.** Pressure test / open decision: [`08_band_pressure_test.md`](../dicsscssion/dashboard_redesign/08_band_pressure_test.md); design note [`07_outward_range.md`](../dicsscssion/dashboard_redesign/07_outward_range.md); learning log [`premium_range_clustering.md`](../learning_logs/premium_range_clustering.md); methodology [`pricing_methodology.md`](cross_cutting/pricing_methodology.md#the-premium-band-the-experience-band-a017); plan [`premium_experience_band_plan.md`](../plan/cross_cutting/premium_experience_band_plan.md); builds on the masked annual series from [A012](#a012--per-customer-exposure-uses-one-global-window-dilutes-partial-coverage-counties) / [A016](#a016--the-all-duration-coverage-mask-is-applied-as-a-proxy-for-t-specific-observability).
