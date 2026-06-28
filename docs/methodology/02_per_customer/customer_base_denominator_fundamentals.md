# The Customer-Base Denominator — Fundamentals

*Audience: senior team. Started: 2026-06-28 (living doc — questions pending). Reads after
[`per_customer_pricing_fundamentals.md`](per_customer_pricing_fundamentals.md). The bug-driven origin story is
[`../../dicsscssion/premium_implausibility_investigation/02_understanding_the_denominator.md`](../../dicsscssion/premium_implausibility_investigation/02_understanding_the_denominator.md);
this doc is the durable "what is this number, and what kinds are there."*

---

## Why this doc exists

Going from a county rate to a per-customer rate hangs on one division:

```text
  share-out (multiplier)  =  customers_out (during an event)  ÷  CUSTOMER BASE
  λ_customer              =  λ_county  ×  share-out
  premium                 =  λ_customer  ×  X  ÷  (1 − ER − TM)
```

The **customer base is the denominator** — "how many customers does this county have?" Every per-customer premium
in a county scales **inversely** with it: a base 2× too small makes every premium 2× too big. So it is one of the most
load-bearing single numbers in the whole model.

It is tempting to treat this as trivial — *divide customers-out by a customer-count, QC the outliers, done.* It is
not. **There is no single, clean "customer count."** There are several candidate definitions, they disagree (sometimes
by multiples), the *unit* itself is ambiguous, and the geography doesn't line up. This doc lays out that nuance so the
choice is explicit and reviewable — and flags where the **business side** will force more of it.

---

## First problem: what *is* a "customer"?

A customer is **not a person, not a household, not a building** — it is, almost always, a **metered account**. But even
that isn't uniform. Per Brelsford et al. (the EAGLE-I / MCC source paper), utilities define a customer

> *"in a range of different ways, most typically the electric meter, a building, or a facility."*

So the unit drifts across utilities. And a meter is not a unit of *risk* or *value*:

```text
  1 residential meter   = a house drawing a few kW
  1 commercial meter    = a strip mall, or a 100 MW data center      ← same "1 customer", wildly different load/value
  1 master meter        = a 200-unit apartment block (200 homes, ONE account)
  1 facility "customer"  = a campus with many buildings behind one account
```

This matters two ways: (1) the **count** depends on the metering convention, and (2) one "customer" can be trivial or
enormous — which the average-customer denominator completely flattens (see *Business-side*, below).

---

## The menu — candidate denominators

Each is a different answer to "how many customers." They are not interchangeable.

```text
  SOURCE                          WHAT IT COUNTS                              SCALE vs truth      FAILURE MODE
  ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
  MCC  (EAGLE-I / Brelsford)      modeled county customer accounts            best single proxy   garbage for ~hundreds
    "Modeled County Customers"    (EIA-861 counts → LandScan → HIFLD          (res + commercial)  of counties
    2023 vintage                   service territories, allocated to county)                       (Henderson NC = 24)
  Census households  (B11001)      OCCUPIED homes only                        ~0.85× housing      UNDER-counts seasonal
                                                                                                   (vacation counties)
  Census housing units (B25001)   ALL homes: occupied + vacant + seasonal     ≈ residential       no commercial; ignores
                                  (≈ "one meter per home")                    meters              master-metering
  Observed peak-out               most customers ever simultaneously out      hard LOWER bound    only a floor; not a count
                                  (from our own event catalog)                (can't exceed base)
  Population  (B01003)            PEOPLE                                       ~2.3× households    WRONG UNIT — we insure
                                                                                                   meters, not people
  Utility-reported (EIA-861)      actual customer counts BY CLASS             ground truth        per-UTILITY, not per-county
                                  (residential / commercial / industrial)     (per utility)       (needs re-allocation)
```

Key relationships (verified on our data, 3,222 counties):

```text
  housing_units ≥ households      always (units = occupied + vacant)        100% of counties
  housing_units / households      median 1.18  (the gap = vacant + seasonal homes)
  MCC / housing_units             median ~1.10 (the ~10% ≈ commercial accounts)
  population / households         ~2.3         (people per home — the wrong axis entirely)
```

---

## What we use today — the composite base (A018)

We do **not** trust any single source. We take a **conservative composite**:

```text
  base  =  max( MCC ,  housing_units ,  observed_peak_out )
             │            │                  └ HARD FLOOR: you can't have more out than exist → base ≥ worst outage seen
             │            └ counts every metered home incl. seasonal (fixes vacation counties households misses)
             └ keeps the real utility count where it's largest (carries genuine commercial load)

  EXCLUDE if  observed_peak_out  >  1.5 × max(MCC, housing_units)
              └ the NUMERATOR is corrupt — more "out" than the county can plausibly hold
                (Henderson NC: peak 131,460 vs 56,744 housing units = 2.3×). Pricing it would UNDER-price
                (huge base → tiny share-out), the dangerous direction → decline, don't quote.
```

Outcome across CONUS: **1,856 keep MCC · 935 fall to the housing-unit floor · 335 to the peak floor · 131 excluded.**
Direction of every override is **conservative** (base never made implausibly small). Registered as **A018**; surfaced
per-county in the dashboard County Explorer (`mcc_ok / housing_floor / peak_floor / excluded`).

Why a composite and not one source:

```text
  · MCC alone        → broke on ~hundreds of counties (modeled, 2023 vintage; some values nonsensical)
  · housing units alone → loses commercial load where MCC is genuinely larger (cities, industrial counties)
  · households alone  → under-counts seasonal meters → over-priced vacation counties (the bug we hit first)
  · peak alone        → not a customer count, only a floor
  → max() takes the most-defensible of the three; exclusion catches the case where the data itself is impossible.
```

---

## Second problem: the geography doesn't line up

A county is **not** a utility service territory.

```text
  one utility  serves parts of MANY counties
  one county   is served by MANY utilities
  EAGLE-I       reports outages aggregated to the COUNTY
```

So "the county's customer base" is itself a **county-aggregate of several utilities' customers**. MCC *is* that
aggregate (that's the whole point of the LandScan allocation), but it inherits allocation error wherever a utility's
customers aren't distributed like population. Housing units sidesteps allocation (Census is natively county) but only
captures the residential axis. There is no source that is simultaneously *per-county*, *all customer classes*, and
*ground-truth* — hence the composite.

---

## Business-side challenges (flagged, not yet solved)

The denominator above answers "what is the **average** customer base of the county." The moment we price a **specific
policy**, more questions open up — these are the ones the business will force:

```text
  1. WHO is actually insured?  The modeled base is a county average. The policy covers a SPECIFIC account —
     whose outage risk depends on its feeder/location (→ location basis) and its own class, not the average.

  2. AVERAGE customer ≠ THIS customer.  A 100 MW data center, a hospital, a cold-storage warehouse are each
     "1 customer" in the denominator but carry exposure and payout nothing like an average meter. The share-out
     (avg fraction of customers out) describes a random residential-ish meter, not a large commercial load.

  3. RESIDENTIAL vs COMMERCIAL vs INDUSTRIAL.  MCC mixes all classes into one count; housing units is residential
     only. If we segment pricing by class, the right denominator (and the right share-out) may differ by class.
     EIA-861 has the class split per utility — not yet wired in.

  4. METERING CONVENTION.  Master-metered apartments (1 account, many homes) and facility-level "customers"
     mean the count and the insured unit can diverge from "one home = one customer."

  5. PORTFOLIO / CONCENTRATION.  The denominator sets the per-policy level; writing N policies in one county is a
     second-moment problem the denominator doesn't touch (see the concentration doc). Mean is base-driven; tail is not.
```

None of these are resolved today. They are recorded here so that when the **business segmentation** work starts, the
denominator question is already framed rather than rediscovered.

---

## What this is NOT — keep three things separate

```text
  · NOT the share-out ESTIMATOR.  The base is the denominator; how we AVERAGE the per-event fraction (mean vs
    median vs trimmed) is a different lever — the heavy-tail / mean-over-qualifying-events question (A011).
    See dicsscssion/.../03_the_shareout_is_the_bottleneck.md. Denominator solved ≠ level solved.
  · NOT the location basis.  Location REDISTRIBUTES the county-average rate within the county (rural↔urban); it
    rides on top of this base and should be mean-1 (Step 04). Different layer.
  · NOT a validated premise-level count.  It is a county-aggregate PROXY, conservative by construction, that
    sharpens as better data lands.
```

## How it sharpens (maturity)

```text
  today        max(MCC, housing_units, peak) + exclusion        conservative proxy, shipped
  next         EIA-861 per-utility class split → cleaner per-county count + class segmentation
  validation   PowerOutage.US sub-county / per-customer truth → test the base AND the share-out together
```

---

## One-line takeaways

- **The denominator is "how many customers does the county have," and every per-customer premium scales inversely with it.**
- **There is no single clean customer count** — MCC, households, housing units, peak, EIA-861 all answer differently; a "customer" is a meter/building/facility, not a person.
- **We use a conservative composite: `max(MCC, housing_units, peak)`, exclude where peak is impossible** (A018).
- **The base is the LEVEL's denominator — separate from the share-out estimator (A011) and the location basis (Step 04).**
- **The business side (who's insured, commercial vs residential, large single loads) will demand more nuance — flagged, not solved.**

## Open questions — to resolve (add here)

*(landing spot for the questions that prompted this doc — fill in, then we edit the relevant section above.)*

1. _…_

---

## References

- Origin / bug story: [`../../dicsscssion/premium_implausibility_investigation/02_understanding_the_denominator.md`](../../dicsscssion/premium_implausibility_investigation/02_understanding_the_denominator.md) · [`01_denominator_fix.md`](../../dicsscssion/premium_implausibility_investigation/01_denominator_fix.md)
- The estimator (separate lever): [`../../dicsscssion/premium_implausibility_investigation/03_the_shareout_is_the_bottleneck.md`](../../dicsscssion/premium_implausibility_investigation/03_the_shareout_is_the_bottleneck.md)
- Per-customer mechanics: [`per_customer_pricing_fundamentals.md`](per_customer_pricing_fundamentals.md)
- MCC derivation: [`../cross_cutting/eagle_i_data_fundamentals.md`](../cross_cutting/eagle_i_data_fundamentals.md) · [Brelsford et al., Nature Sci. Data 2024](https://www.nature.com/articles/s41597-024-03095-5) · [Modeled County Customers 2023](https://openenergyhub.ornl.gov/explore/dataset/modeled-county-customers-2023/)
- Assumptions: [`../assumptions.md`](../assumptions.md) — **A018** (composite base) · **A011** (share-out estimator) · **A008** (MCC / customer-unit caveats) · **A010** (mean not max)
- Portfolio: [`../cross_cutting/concentration_and_portfolio_risk.md`](../cross_cutting/concentration_and_portfolio_risk.md)
- Code: `price_engine/data/build_customer_base.py` · `curated_outage_data/pipelines/per_customer_rate/compute_per_customer_lambda.py`
