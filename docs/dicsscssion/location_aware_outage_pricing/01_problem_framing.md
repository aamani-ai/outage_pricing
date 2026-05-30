# Location-Aware Outage Pricing: Problem Framing

Date: 2026-05-19

## Why This Discussion Exists

Our current v0 event catalog is built from EAGLE-I county-level 15-minute outage
snapshots:

```text
fips_code + run_start_time + customers_out
```

That is enough to build a county-level historical outage event catalog. It is
not enough, by itself, to prove that a specific building or business location
lost power.

This matters because the product conversation keeps moving toward
location-based coverage:

```text
Did this insured location lose power for at least T hours?
```

That question is materially different from:

```text
Did anyone in the county lose power for at least T hours?
```

If we confuse those two questions, we can overprice low-risk locations,
underprice high-risk locations, and make short-duration triggers look
commercially unrealistic.

## Current v0 Data Grain

EAGLE-I raw data gives us:

| Item | Grain |
|---|---|
| timestamp | 15-minute snapshot |
| geography | county FIPS |
| outage value | customers out in that county |
| event construction | our algorithm groups county snapshots into county events |

So the current event is:

```text
county outage event
```

not:

```text
address outage event
feeder outage event
transformer outage event
meter outage event
business premise outage event
```

## What A Utility Outage Map Shows

Public utility maps can look much more spatially detailed. Central Hudson is a
good example: its outage map guide says outage information is updated every 10
minutes, outage symbols represent outage cases, users can view county and
municipality summaries, and the map can search by address. It also explicitly
says exact street-address outage views are not displayed for customer security.

That means the public map is useful, but it is still not automatically an
audit-grade premise-level insurance trigger.

## Why County-Based Pricing Can Overstate Location Risk

Suppose a county has many outage events because one part of the county is rural,
tree-heavy, or served by a weak feeder. A policy located in a dense downtown
network or served by a more resilient circuit may not share that full county
risk.

Current v0 pricing sees:

```text
county had qualifying event
```

but the insured cares about:

```text
my building had qualifying interruption
```

The gap between those two is basis risk.

## Why It Can Also Understate Location Risk

The opposite can also happen. A county-average view may underprice a weak local
feeder, islanded service area, rural commercial site, or weather-exposed edge
of the county.

County history is an average over many locations. A location product needs a
location adjustment, even if EAGLE-I remains the best historical backbone.

## Trigger Source And Pricing Source Should Be Separate

We should keep four concepts separate:

| Concept | Question | Candidate sources |
|---|---|---|
| Historical pricing source | What has happened over many years? | EAGLE-I, PNNL-derived event data, utility archives if available |
| Live trigger source | What determines payout now? | utility OMS/AMI, sensor oracle, licensed outage oracle, public map feed |
| Spatial exposure model | How does this location differ from county average? | utility territory, feeder/circuit if available, land cover, hazard, grid condition, urban/rural context |
| Validation bridge | How do county events map to local outage triggers? | overlapping OMS/sensor/map data, pilot utility data, forward-collected public map snapshots |

The current price engine mostly has the first row. A location-based product
needs at least a defensible plan for the other three.

## Proposed Architecture Direction

For v1, the pricing architecture should look more like:

```text
county historical baseline
  -> event regime decomposition
  -> location adjustment
  -> trigger-source alignment factor
  -> commercial viability filter
```

In formula form:

```text
lambda_location(T)
  = lambda_county_eaglei(T)
    * regime_adjustment(county, T)
    * location_vulnerability_factor(location)
    * trigger_alignment_factor(source, location, T)
```

This is not final math. It is a clearer separation of problems.

## What We Should Not Do Yet

Do not simply lower prices by applying an arbitrary county-to-location discount.
That would hide the problem instead of solving it.

Do not use public utility map endpoints as insurance triggers without checking:

- historical availability;
- schema stability;
- update frequency;
- spatial precision;
- permissions and terms;
- auditability;
- outage event stitching rules;
- retention and replay ability;
- whether restored outages disappear from the map.

Do not assume an address search on a utility map means the map exposes exact
address-level outage status.

## Practical Product Implication

There may be two different products:

### County proxy product

Uses EAGLE-I county history directly. It is easier to backtest nationally, but
it should be honestly described as a county proxy. This may work for broader
area-based parametric coverage or internal pricing experiments.

### Location-aware product

Uses EAGLE-I as historical backbone, but requires a local trigger and a
location adjustment layer. This is more commercially defensible for SMBs, but
it needs more data engineering and validation.

## Initial Decision

Keep the current county catalog as the historical baseline.

Start a separate location-aware design track before changing production pricing.
The next task is not to rewrite the price engine immediately; it is to define
the data levels and bridge logic we can defend.

## Related Plan

The first phased build addressing this gap — without committing yet to a
full location-aware product — is
[`docs/plan/per_customer_pricing_plan.md`](../../plan/per_customer_pricing_plan.md).
That plan treats the **customer-experience rate** as the intermediate
quantity we can build today (Path A in the plan), reserves a slot for the
location-basis factor described here (Path B), and uses PowerOutage.US
per-outage data as validation (Path C). It explicitly does not change v0
pricing.

## Sources

- Central Hudson Outage Map Guide:
  https://www.cenhud.com/en/emergency-website/outage-map-guide/
- Existing project discussion on OMS and trigger sources:
  `docs/dicsscssion/utility_oms_and_trigger_sources.md`
- Price engine raw data schema:
  `price_engine/data/SCHEMA.md`
