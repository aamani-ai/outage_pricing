# 02 — Pricing Math

The end-to-end chain that turns an EAGLE-I event log into a premium. Short, deliberately simple, and entirely empirical. No simulation, no distribution-family fitting in v0 — those land in v0.5.

## The contract

A per-event indemnity:

> "If a power outage at your customer location lasts at least `T` hours, we pay you `X` dollars. Annual policy."

Two policyholder-facing parameters: `T` (deductible, in hours) and `X` (payout, in dollars). Everything else flows from data.

## The pricing chain

The annual **pure premium** (expected loss per policy, before any expense/profit/uncertainty load) is:

```
PurePremium(FIPS, T, X) = λ(FIPS, T) · X
```

where `λ(FIPS, T)` is the **expected number of qualifying events per policy-year**:

```
λ(FIPS, T) = (annual rate of events in FIPS) · P(D ≥ T | event in FIPS)
           = N_per_year(FIPS) · S_FIPS(T)
```

That's it. Two factors. One is the local frequency. One is the survival function evaluated at the deductible.

The retail premium adds loads on top:

```
RetailPremium = (PurePremium + UncertaintyLoad(FIPS, T)) / (1 - ExpenseRatio - TargetMargin)
```

`UncertaintyLoad` is the slot for v0.5's confidence work (defaulted to zero in v0). `ExpenseRatio` and `TargetMargin` are business inputs, hard-coded as v0 placeholders and configurable per-state in v1.

## How we estimate the two factors empirically

### `N_per_year(FIPS)` — the annual event rate

Count distinct outage events in the FIPS over the EAGLE-I observation window, divide by the number of years observed.

```
N_per_year(FIPS) = total_events_in_FIPS / observation_years
```

Caveats baked into the modelability tier (not the rate itself):
- Short coverage windows penalise the tier, not the rate.
- High year-to-year variance in event count penalises the tier (this is one of the Amber/Red flags in `03_filtration_framework.md`).

### `S_FIPS(T)` — the empirical survival function

For v0, we use the **raw empirical survival function** of the duration distribution in the FIPS, with no parametric fit:

```
S_FIPS(T) = (number of historical events in FIPS with duration ≥ T) / (total historical events in FIPS)
```

This is direct historical counting. v0 does **not** assume a Lognormal, Weibull, Exponential, GPD, Poisson-duration, or any other fitted duration distribution for `S(T)`. Since the event log has observed start and end times, we are not currently modeling censoring either. In survival-analysis language, this direct empirical curve is equivalent to the no-censoring case, but the implementation is just:

```text
count durations >= T
divide by total durations
```

That explicit no-distribution assumption matters for interpretation. Confidence in `S(T)` depends on event density: a county with many historical events has a more stable empirical curve than a county with sparse evidence.

**Why no Lognormal/Weibull/GPD fit in v0?** Because v0's job is the end-to-end pipeline. The empirical `S(T)` is correct for `T` values that have data behind them. It only fails for `T` values past the longest observed event in the FIPS, and there the right answer in v0 is "amber/red modelability" — not a heroic extrapolation. The distribution-family work belongs to v0.5, alongside the confidence load.

### What this looks like in code

```python
# pricing/empirical_s.py
def lambda_T(events, observation_years, T):
    """events: list of durations (hours) in this FIPS over observation_years."""
    n = len(events)
    if n == 0:
        return 0.0
    n_per_year = n / observation_years
    s_T = sum(1 for d in events if d >= T) / n
    return n_per_year * s_T
```

That is the entire engine. A page of math, ten lines of code.

## The standard `(T, X)` grid

v0 ships with a fixed grid that the dashboard renders as a matrix. The customer-facing inputs to the dial are restricted to grid points until v1.

| Dimension | Values |
|---|---|
| Deductible `T` (hours) | 2, 4, 8, 12, 24 |
| Payout `X` ($) | 500, 1000, 2500, 5000, 10000 |

`T = 2h` is included to let users see a high-frequency low-deductible quote (useful for residential add-ons). `T = 24h` is the catastrophic-only end. Five × five matrix per county, 25 cells.

The dashboard's drill-down allows continuous `T` and `X` to be entered; we recompute on the fly.

## Why customer counts do NOT appear in v0

The contract triggers on a **county-level event**: an outage of duration ≥ T occurred in the customer's FIPS. The customer is in that FIPS, so by definition they are exposed to that event. The number of *other* customers in the county who were also without power during the same event does not change whether *this* customer's contract triggers.

This means:

- No "per-policy exposure normalisation" step.
- No `customer-hours` weighting.
- No conversion between county rate and per-policy rate.
- `λ(T)` is the *county* event rate; the customer's expected number of triggers per year is that same `λ(T)`.

The EAGLE-I customer-count fields (`min_customers`, `max_customers`, `mean_customers`) are stored in the parquet but are not used by v0 pricing. They will be used later for portfolio correlation modeling — if we write 50 policies in the same FIPS, the customer-count tells us how many will trigger simultaneously — but that is a v1 problem.

### A note on what this assumes

This treats the FIPS as a uniform-exposure unit — every customer in the FIPS sees the same event distribution. That is an approximation. A customer at a feeder edge sees a different distribution from one in a downtown urban core within the same FIPS. v0 absorbs this approximation; the modelability tier (`03_filtration_framework.md`) implicitly downgrades counties large enough or heterogeneous enough that this approximation hurts.

For v1 we may move to `(FIPS, utility)` cells to tighten this. For v0 the FIPS-uniform assumption is the right level of simplification.

## Worked example

Green-tier county. 412 historical events over 7.5 years, of which 21 lasted at least 12 hours.

```
N_per_year   = 412 / 7.5 = 54.9 events/year
S(12h)       = 21 / 412  = 0.0510
λ(12h)       = 54.9 × 0.0510 = 2.80 events/year with duration ≥ 12h
```

A customer in this FIPS sees, on average, 2.80 outages per year that last 12 hours or more.

For a contract with payout `X = $2,500`:

```
PurePremium     = 2.80 × $2,500 = $7,000/year
UncertaintyLoad = $0 (v0 default; v0.5 nonzero)
ExpenseRatio    = 25% (placeholder)
TargetMargin    = 10% (placeholder)
RetailPremium   = $7,000 / (1 - 0.25 - 0.10) = $7,000 / 0.65 ≈ $10,769/year
```

**That premium is high — deliberately so.** A county that experiences 2.80 sustained 12h+ outages per year is genuinely high-risk; an insurance product priced fairly against that risk should look expensive. This is one of the places where v0 will be useful as a forcing function: counties where the historical rate is this high will look uninsurable at typical retail prices, which is the honest signal we want.

Most counties will have `λ(12h)` in the 0.01–0.5 range, producing premiums in the $40–$2,000 range for `X = $2,500`. The dashboard's matrix view will surface this distribution explicitly.

Click a cell and the drill-down shows all five lines of the chain above.

## What the engine returns (the contract between engine and dashboard)

A single call to the engine returns this structured object, which the dashboard renders:

```json
{
  "fips": "12086",
  "fips_name": "Miami-Dade County, FL",
  "state": "FL",
  "tier": "Green",
  "T_hours": 12,
  "X_dollars": 2500,
  "inputs": {
    "n_events_total": 412,
    "n_events_qualifying": 21,
    "observation_years": 7.5
  },
  "intermediates": {
    "n_per_year": 54.9,
    "s_T_empirical": 0.0510,
    "lambda_T": 2.80
  },
  "premium": {
    "pure": 7000.00,
    "uncertainty_load": 0.00,
    "expense_ratio": 0.25,
    "target_margin": 0.10,
    "retail": 10769.23
  },
  "tier_rationale": [
    "412 events ≥ minimum (200)",
    "7.5 year window ≥ minimum (5)",
    "Year-to-year event-count CV = 0.18 ≤ amber threshold (0.5)",
    "21 qualifying events at T=12h ≥ minimum tail count (10)"
  ]
}
```

This shape is the contract between the pricing engine and the dashboard. Locking it now means the front-end can be built against a stub while the engine matures.
