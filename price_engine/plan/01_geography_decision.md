# 01 — Geography: State vs County

This is the question that came up first when scoping v0. The short answer: **county for modeling, county for pricing, state for go/no-go and regulatory filing.** Below is the reasoning, because the choice affects everything downstream.

## The two pressures pulling in opposite directions

**Pulling toward state**
- Insurance regulation is state-level: rate filings, admitted vs surplus lines, consumer protection law, agent licensing, complaint adjudication. A "no" from a state DOI is a no for every county in that state.
- Reinsurance treaties are typically structured by state, region, or peril, not by FIPS.
- Sales channels (agencies, MGAs, brokers) operate by state appointment.
- 50 cells is easier to display, audit, and explain to a non-technical buyer than 3,100.

**Pulling toward county**
- The actual outage experience varies enormously within a state. A coastal Florida FIPS and an inland one have different distributions to the same hurricane season. Aggregating them throws away the signal we have.
- EAGLE-I, our base data, is collected and reported at FIPS. State-level numbers are themselves customer-weighted averages of county data — building a model at the state aggregate would be ignoring information we already possess.
- Customer exposure is at a *location*, not at a state. A policy sold to a specific business has a specific FIPS. Premium fairness, in any actuarial sense, has to track that.
- The filtration we want — "this county is unmodelable" — does not exist at the state level. A state can contain very-modelable and unmodelable counties simultaneously.

## Why we don't compromise

The wrong move is to "average" — to pick something intermediate like state or a fixed-radius cluster and hope the resolution is enough. That throws away the FIPS-level signal we have *and* fails the regulatory test, which is binary (you're filed or you're not), not gradient.

The right move is to give each layer the granularity it actually needs:

| Layer | Granularity | Why |
|---|---|---|
| Empirical data ingestion | FIPS | That's the resolution EAGLE-I provides |
| Distribution fitting & `S(T)` | FIPS | Heterogeneity within a state is too large to pool |
| Modelability tier (Green/Amber/Red) | FIPS | Some counties in a state are modelable, others aren't |
| Per-customer quote | FIPS | Fairness and accuracy |
| Sell/don't-sell decision | State (with county overlay) | Regulatory reality |
| Rate filing artifact | State | DOI requirement |
| Dashboard entry point | State | UX — 50 cells, then zoom in |
| Dashboard drill-down | County | Where the substance lives |

## State-level "go/no-go" mechanism

A state is a candidate for sales **only if** at least some minimum portion of its population-weighted counties are Green or Amber. The exact threshold is a v0.1 calibration question, but the structure is:

```
state_quote_eligible(s) =
    sum(population[c] for c in counties(s) if tier(c) in {Green, Amber})
  / sum(population[c] for c in counties(s))
  >= STATE_MIN_COVERED_POPULATION_FRACTION
```

Plus a hard floor: if any county in `{Green, Amber}` falls inside a state, that state is a candidate; states with no quotable county are dropped entirely from the dashboard's "sellable" map.

The reason this is on top of the per-county tier and not folded into it: the question "is California a market we want to be in" is a business and regulatory decision; the question "can we price Inyo County, CA defensibly" is a data decision. Keeping them separate keeps the conversation honest.

## What the dashboard shows

Two coordinated views:

1. **National map.** State polygons. Colour each state by `(% population in Green or Amber counties)`. A state with 100% modelable counties is dark green; one with 20% is faded; one with 0% is grey "no quote".
2. **State zoom.** When you click a state, you get its counties polygon-coloured by tier. Click a county → price drill-down.

This satisfies both audiences. The insurance team sees a state map that maps to their filings world; the modeling team sees a county map that maps to the data world. Same numbers, two granularities of presentation.

## Edge cases worth flagging now

- **Counties straddling utility service areas.** A FIPS may be served by multiple utilities with very different reliability. v0 ignores this (we average customer-weighted within the FIPS). v1 should consider (FIPS, utility) cells. We log this as known basis risk.
- **Very large counties (San Bernardino, Coconino, etc.).** A FIPS the size of West Virginia is being treated as a single homogeneous unit. This is wrong but consistent with the data resolution; v0 accepts the simplification and flags counties above a size threshold in the modelability tier reasoning.
- **City-state-like FIPS (NYC's five boroughs, Baltimore City, St. Louis City).** These get their own FIPS already, which works in our favour.
- **Territories (PR, USVI, etc.).** EAGLE-I coverage is partial. v0 either excludes or treats as Red until we can audit.
