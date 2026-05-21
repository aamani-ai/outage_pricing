# Source Note: FERC Form 1 / PUDL

Status: candidate Phase 2 source, likely after EIA-861

## Role

FERC Form 1 and PUDL are candidate sources for utility financial, plant, O&M,
and capex proxy features.

Proposed role:

```text
utility investment / plant / O&M context -> grid-condition proxy
```

This is not the first Phase 2 source. It should come after the utility-county
crosswalk and EIA-861 feature logic are stable.

## Why It Matters

Historical outage frequency alone does not say whether the grid is improving or
deteriorating. Utility investment and plant information may help build
forward-looking features:

- distribution plant additions;
- transmission/distribution O&M;
- capital investment proxies;
- utility scale and asset base;
- trend over time.

## Expected Grain

Likely utility-year or utility-account-year.

The challenge is mapping utility-level finance/plant values to county-level
exposure. That requires a defensible utility-county weighting method.

## Proposed Join

Do not join directly to counties first.

Recommended sequence:

```text
FERC/PUDL utility-year fields
-> validate utility identifiers
-> join to EIA utility crosswalk
-> allocate to county-year by customer weights
-> mark feature coverage and caveats
```

## Caveats

- FERC Form 1 primarily covers certain regulated utilities; coverage is not
  universal across co-ops and municipal utilities.
- Accounting fields may not map cleanly to distribution-grid condition.
- Capex does not equal resilience unless we know what was built.
- Utility-level values can be misleading when allocated across heterogeneous
  service territories.

## First Decision Needed

Which capex/O&M fields are defensible as proxies for grid condition?

Recommendation: do not choose until after an exploratory field inventory and
coverage report.

## Official Links

- FERC data portal:
  https://data.ferc.gov/
- PUDL FERC Form 1 documentation:
  https://docs.catalyst.coop/pudl/en/nightly/data_sources/ferc1.html
