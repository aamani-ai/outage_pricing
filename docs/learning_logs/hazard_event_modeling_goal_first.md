# Hazard Event Modeling: Goal First, Method Second

Date: 2026-05-19

## Why This Note Exists

Outage pricing raised a more general modeling question:

```text
When should we use empirical counting, fitted distributions, event simulation,
EVT, copulas, or a full catastrophe-model style engine?
```

This is not unique to outages. The same structure appears across many hazards:

| Hazard | Event | Magnitude / severity | Frequency question |
|---|---|---|---|
| outage | outage event | duration, customers out | how often does outage exceed T hours? |
| hail | hailstorm / hail swath | hail size, kinetic energy, damage ratio | how often does hail exceed size/damage threshold? |
| wind | windstorm / gust event | peak gust, duration, direction | how often does wind exceed design threshold? |
| flood | flood event | depth, velocity, duration | how often does depth exceed floor/equipment elevation? |
| wildfire | fire event / smoke event | burn intensity, proximity, outage disruption | how often does exposure exceed tolerance? |

The modeling ingredients are similar:

```text
event definition
frequency
magnitude / severity
spatial footprint
time evolution
exposure intersection
loss function
portfolio aggregation
```

But the right method is not universal. It depends on the decision being served.

## The Core Principle

Do not start with the method.

Start with the decision goal:

```text
Who is using the model?
What decision are they making?
What output do they need?
At what spatial scale?
At what time horizon?
At what confidence level?
What error matters most?
```

Only after that should we choose between empirical analysis, fitted
distributions, simulation, EVT, dependence models, or catastrophe-style event
sets.

## Same Hazard, Different Goals

The same underlying hazard data can support very different users.

Example: hail.

| User / goal | Typical question | Method implication |
|---|---|---|
| underwriting one asset | is this location high or low hail risk? | local empirical history + hazard maps + exposure features |
| pricing one policy | expected annual loss for this deductible and limit | frequency x severity / vulnerability |
| portfolio manager | how do many policies lose together? | event footprints, portfolio replay, dependence |
| capital modeler | what is 1-in-100 or 1-in-250 aggregate loss? | stochastic event set, EVT/tail, simulation |
| claims operations | where will claims arrive after today's storm? | live radar/event nowcast + exposure overlay |
| risk engineer | what mitigation changes loss? | vulnerability curves and site-level features |

The same is true for outage:

| User / goal | Typical question | Method implication |
|---|---|---|
| v0 pricing | how often did county outage duration exceed T? | empirical event counting |
| product manager | is the premium commercially sensible? | pricing + generator/battery alternative analysis |
| underwriter | is this location close to county-average risk? | location adjustment, utility/grid features |
| trigger designer | did this premise lose power? | OMS, sensor, outage oracle, basis-risk bridge |
| portfolio manager | will many policies trigger together? | regional event replay, co-trigger matrices |
| forward modeler | is outage risk changing? | hazard, grid condition, cause, climate, utility covariates |

The modeling path changes because the decision changes.

## Why Generic Catastrophe Platforms Exist

Large platforms such as RMS-style catastrophe models separate three ideas:

```text
hazard event set
exposure portfolio
vulnerability / financial module
```

That separation is powerful because the same hazard event can be replayed
against many different portfolios and decision contexts.

Example:

```text
same simulated hail event
  -> homeowner roof portfolio
  -> auto portfolio
  -> solar farm portfolio
  -> commercial property portfolio
```

The hazard event is not the final answer. It becomes useful only after it is
intersected with exposure and translated through a loss function.

This maps directly to outage:

```text
same regional outage episode
  -> one SMB policy
  -> many SMB policies
  -> utility service territory stress
  -> backup-power product opportunity
  -> claims operations load
```

The event is reusable. The model output depends on the goal.

## Ready Event Catalogs Versus Modeled Event Catalogs

Outage v0 is unusually friendly to empirical pricing because the EAGLE-I
history, after event construction, gives us a usable event catalog:

```text
event = county outage interval
magnitude = duration_hours
frequency = count of events over observed source years
```

That means the current survival curve is empirical:

```text
S(T) = share of observed events with duration >= T
lambda(T) = observed exceedance count / observed source years
```

No parametric distribution, KDE, EVT model, or copula is required for that first
historical county-pricing question.

For many hazards, the situation is different. A ready-to-price event catalog may
not exist directly in the raw data. Hail, wind, flood, wildfire, and heat often
start from radar, stations, reports, satellite data, reanalysis, or physics
models. The modeler then has to construct the event catalog before pricing can
even start:

```text
raw hazard observations
  -> quality control
  -> spatial / temporal reconstruction
  -> event definition
  -> magnitude field
  -> stochastic or historical event catalog
```

So fitted distributions, KDE, EVT, or simulation are not automatically
"unnecessary complexity." They are unnecessary only when the empirical event
catalog already answers the decision. For other hazards, those methods may be
part of creating the catalog, extending sparse tails, or preserving
portfolio-level dependence.

Rule:

```text
Use empirical exceedance when the observed event catalog directly supports the
decision. Add distributional or simulation machinery only when it buys a needed
capability: reconstruction, smoothing, extrapolation, forecasting, or
portfolio aggregation.
```

Portfolio-specific implications are captured separately in
[`portfolio_event_catalogs_and_aggregation.md`](portfolio_event_catalogs_and_aggregation.md).

## The Five-Piece Risk Product Architecture

The reusable architecture is:

```text
event catalog
exposure database
vulnerability curves
financial terms
portfolio aggregation
```

If these five pieces are cleanly separated, the same foundation can support
insurance pricing, mitigation ROI, resilience planning, underwriting, portfolio
risk, capital modeling, and climate-product design.

ASCII view:

```text
┌────────────────┐
│  Event Catalog │
│  hazard truth  │
└───────┬────────┘
        │ intersects with
        ▼
┌────────────────┐
│ Exposure       │
│ Database       │
│ assets/policies│
└───────┬────────┘
        │ translates through
        ▼
┌────────────────┐
│ Vulnerability  │
│ Curves / Logic │
│ impact function│
└───────┬────────┘
        │ applies
        ▼
┌────────────────┐
│ Financial      │
│ Terms          │
│ deductible/limit│
└───────┬────────┘
        │ aggregates into
        ▼
┌────────────────┐
│ Portfolio      │
│ Aggregation    │
│ loss/risk view │
└────────────────┘
```

### 1. Event Catalog

The event catalog describes the hazard itself.

Examples:

| Hazard | Event catalog unit |
|---|---|
| outage | outage interval by county, utility area, feeder, sensor region, or premise |
| hail | storm swath with hail-size field |
| wind | gust footprint or storm event |
| flood | inundation depth surface over time |
| wildfire | fire perimeter, smoke plume, outage-linked disruption |

This is where frequency, magnitude, footprint, timing, and event identity live.
For our current outage model, EAGLE-I gives us a county-level event catalog
after we construct events from 15-minute snapshots.

### 2. Exposure Database

The exposure database says what is at risk.

Examples:

| Product | Exposure unit |
|---|---|
| SMB outage policy | business location, meter, utility service point |
| property hail policy | building, roof, address |
| auto hail portfolio | vehicles, parking geography, time-of-day exposure |
| solar hail/wind portfolio | panels, trackers, site boundary |
| flood product | building footprint, floor height, equipment location |

This piece is often underrated. A strong hazard event catalog is not enough if
the exposure location, asset attributes, or time-at-risk are weak.

### 3. Vulnerability Curves / Impact Logic

Vulnerability turns hazard magnitude into physical or operational impact.

Examples:

```text
hail size -> roof damage ratio
wind gust -> roof or equipment failure probability
flood depth -> equipment damage
outage duration -> business interruption impact
heat duration -> productivity or equipment stress
```

This is one of the most dangerous places to be casual. The hazard magnitude is
not the same as the loss.

```text
hail size at location != roof loss
outage duration != business interruption loss
flood depth != equipment damage
wind gust != roof failure
heat index != productivity loss
```

The loss quality often depends more on exposure and vulnerability assumptions
than on another decimal place of hazard-model precision.

### 4. Financial Terms

Financial terms translate impact into payout or economic value.

Examples:

```text
trigger threshold
deductible
limit
attachment point
payout amount
waiting period
exclusion
coinsurance
margin / expense / uncertainty load
```

For our current outage product, this is the `T` and `X` grid:

```text
pay X dollars if outage duration >= T
```

For mitigation products, financial terms might instead be:

```text
avoided loss
payback period
resilience ROI
capital cost versus risk reduction
```

### 5. Portfolio Aggregation

Portfolio aggregation answers the joint-loss question:

```text
What happens when many exposures are hit together?
```

This is where dependence matters. A standalone location can often be priced
from its marginal loss distribution. A portfolio needs co-movement:

```text
same storm hits many counties
same outage affects many businesses
same flood inundates a corridor
same heat wave stresses many locations
same wildfire smoke event affects a region
```

This is why copulas, stochastic catalogs, spatial dependence, and historical
event replay are usually portfolio tools before they are single-policy tools.

## Shared Framework, Hazard-Specific Truth

The biggest multi-hazard fallacy is treating "multi-hazard" as one generic
model.

Better framing:

```text
multi-hazard platform = shared architecture
multi-hazard model    = hazard-specific event logic + exposure + vulnerability
```

The five pieces can be standardized as a framework, but the hazard truth cannot
be flattened too early.

| Hazard | Event shape | Magnitude | Critical nuance |
|---|---|---|---|
| outage | network/service interruption | duration, customers out | location basis risk and trigger source |
| hail | storm swath / footprint | hail size, kinetic energy | hit/miss at asset and asset vulnerability |
| flood | inundation surface | depth, velocity, duration | elevation, local terrain, basement/equipment height |
| wind | spatial gust field | peak gust, duration, direction | exposure height, terrain, construction class |
| wildfire | perimeter / ember / smoke / disruption | intensity, distance, duration | path uncertainty, suppression, smoke vs burn loss |
| heat | regional temporal episode | temperature, humidity, duration | persistence and human/equipment thresholds |

The same architecture applies across hazards:

```text
hazard event -> exposure -> vulnerability -> financial terms -> aggregation
```

But each hazard has a different:

```text
event definition
spatial footprint
time scale
magnitude variable
data source
validation method
dependence structure
vulnerability mechanism
```

So the right rule is:

```text
standardize the architecture
specialize the hazard truth
```

## Method Depends On Goal And Hazard Nature

The method should depend on more than available data.

Better formula:

```text
method = f(
    decision goal,
    hazard nature,
    historical data support,
    exposure grain,
    vulnerability confidence,
    spatial-temporal dependence,
    need for extrapolation
)
```

Not:

```text
method = f(data available)
```

Historical data availability can be misleading. A hazard with beautiful history
may still be weak for the decision if exposure or vulnerability is poorly
specified. A hazard with sparse history may still be useful if the physical
mechanism is strong, the exposure is well described, and there are validated
borrowed models.

Examples:

| Situation | What not to do | Better response |
|---|---|---|
| strong hazard data, weak vulnerability | over-trust the loss model | flag vulnerability uncertainty |
| sparse local data, strong regional physics | force local-only fit | pool regionally / use credibility |
| high-resolution hazard, coarse exposure | pretend precision carries through | degrade output to exposure grain |
| county outage data, location policy | price as if county equals premise | add location-basis bridge |
| many hazards in one platform | use one generic model | shared framework, hazard-specific modules |

## Dependence Is Hazard-Specific

Dependence is not a generic afterthought.

Each hazard clusters differently:

| Hazard | Dependence structure |
|---|---|
| hail | storm-cell tracks, swaths, convective clusters |
| outage | grid topology, weather, utility operations, restoration constraints |
| flood | watershed, drainage, topography, levees, storm surge |
| wind | storm fields, terrain, height, exposure category |
| wildfire | spread dynamics, wind, fuels, suppression, evacuation zones |
| heat | broad regional persistence, grid stress, urban heat island |

The portfolio aggregation engine can be shared, but the dependence structure
feeding it must respect the hazard.

A useful sequence:

```text
1. Build hazard-specific event catalog.
2. Replay historical events against the portfolio.
3. Measure observed co-hit / co-trigger structure.
4. Add stochastic simulation or copulas only if replay is insufficient.
```

## What Can Be Borrowed Versus Built In-House

These five pieces do not all need to be built from scratch.

| Piece | Often build in-house | Often borrow / license |
|---|---|---|
| event catalog | custom event definitions, trigger alignment, curated outage events | RMS/AIR/event sets, NOAA, EAGLE-I, radar products, hazard vendors |
| exposure database | customer portfolio, product-specific fields, underwriting attributes | geocoding, parcel/building data, business datasets |
| vulnerability | product-specific impact logic, calibration to claims/operations | engineering curves, academic/industry vulnerability functions |
| financial terms | policy logic, pricing loads, product design | actuarial templates, regulatory constraints |
| aggregation | portfolio views, scenario replay, risk dashboards | catastrophe platforms, simulation engines, capital-model components |

The strategic advantage is not building every piece. It is knowing which pieces
need proprietary thinking and which can be responsibly borrowed.

For outage, likely proprietary / high-value pieces are:

```text
event construction choices
county-to-location trigger bridge
business interruption / resilience value logic
commercial viability layer
portfolio co-trigger replay for power interruption
```

For hail, the borrowed pieces may be stronger:

```text
radar-derived hail swaths
hail size recurrence products
engineering vulnerability functions
catastrophe-model event sets
```

But even with borrowed event sets, the product logic still needs careful
exposure, vulnerability, financial, and aggregation design.

## The Method Ladder

A useful way to choose modeling complexity:

| Level | Method | What it buys | What it cannot do well |
|---|---|---|---|
| 1 | raw empirical record | transparent description of what happened | extrapolate beyond observed history |
| 2 | empirical CDF / survival | direct exceedance probabilities inside observed support | sparse tails, future shifts |
| 3 | confidence / bootstrap / credibility | uncertainty around empirical estimates | new physical regimes |
| 4 | fitted distributions | smoothing, interpolation, compact process model | wrong-family model risk |
| 5 | EVT / tail models | rare exceedance extrapolation | requires threshold choices and enough tail data |
| 6 | regime / cause models | separates routine vs catastrophe behavior | needs labels/features |
| 7 | forward-looking covariate models | adjusts future risk from drivers | needs validation and leakage discipline |
| 8 | event simulation / stochastic catalog | portfolio tail, stress, unseen events | high model and calibration burden |
| 9 | dependence / copulas | joint tail and aggregation structure | weak if marginals/events are poorly specified |

The ladder is not a maturity trophy. Higher is not automatically better. Each
level should be added only when the decision requires the capability it buys.

## Outage Versus Hail: A Useful Comparison

### Outage

Current v0:

```text
event = county outage interval
magnitude = duration_hours
trigger = duration >= T
frequency = count(trigger events) / observation years
```

This is close to a parametric insurance trigger, but the spatial unit is coarse:
county event does not prove premise outage.

### Hail

A hail model might be:

```text
event = hailstorm footprint
magnitude = max hail size or kinetic energy
trigger = hail size >= threshold at location
frequency = count/exceedance rate at location
loss = vulnerability(hail size, roof/asset type)
```

The analogous spatial issue:

```text
hail in county != hail at insured building
```

So both problems require a bridge from broad hazard evidence to location-level
trigger or loss.

## Goal-First Examples

### If the goal is historical pricing

Use empirical exceedance first.

```text
How many observed events exceeded the trigger?
```

Do not fit a distribution just because the data has a magnitude variable.

### If the goal is a middle threshold

If raw event magnitudes exist, count directly.

```text
Outage: count duration >= 6h
Hail: count hail_size >= 1.5 inch
```

Interpolation is a display convenience, not the first pricing method.

### If the goal is sparse tail pricing

Empirical counting may be too unstable.

Now EVT, pooling, or fitted tails can add value.

```text
Outage: 72h+ or 168h+ duration
Hail: very large hail beyond local sample
Flood: 100-year depth
```

### If the goal is portfolio capital

One-location marginal frequency is not enough.

Now we need event footprints and dependence:

```text
Which policies are hit together?
What is aggregate annual loss?
What is 1-in-100 portfolio loss?
```

This is where catastrophe event sets, historical replay, copulas, and spatial
simulation become more relevant.

### If the goal is forward-looking underwriting

Historical frequency alone is not enough.

Now the model needs drivers:

```text
hazard trend
grid condition
utility capex/reliability
vegetation
urban/rural topology
building characteristics
mitigation
trigger oracle coverage
```

## The Fundamental Modeling Questions

Before selecting a method, answer these:

1. What is the event?
2. What is the magnitude?
3. What is the trigger or loss threshold?
4. What is the spatial unit of the hazard record?
5. What is the spatial unit of the policy/exposure?
6. What time horizon is being priced or forecast?
7. Is the output for one asset, one policy, or a portfolio?
8. Is the need descriptive, predictive, or capital/stress-oriented?
9. Is extrapolation beyond observed data required?
10. Is dependence between locations/policies important?
11. What assumptions are introduced by the chosen method?
12. What would convince us that the added complexity improved the answer?

## Working Philosophy

The empirical method is not "less professional" than a fitted distribution.
It is often the right first answer when the decision is inside observed support.

The fitted distribution is not "more correct" by default.
It is more useful only when it buys a necessary capability:

```text
uncertainty
pooling
extrapolation
forecasting
simulation
dependence
```

This is the philosophy we should carry into outage, hail, flood, wind, and any
other event-based loss model.

## Open Questions For Future Discussion

- Can we define a shared event schema across outage, hail, wind, flood, and
  wildfire?
- Should event catalogs be first-class artifacts, separate from pricing models?
- Can we build a general "hazard event to portfolio loss" framework?
- Where does empirical replay stop being enough for portfolio risk?
- How should we document the goal before choosing method?
- What minimum evidence is required before adding EVT or copulas?
- How should we represent spatial basis risk explicitly?

## Initial Takeaway

The method should follow the goal.

```text
same event data + different decision goal = different correct model
```

That is why generic hazard platforms are powerful, but also why they can become
black boxes if the decision goal is not explicit. The event engine, exposure
engine, vulnerability/loss engine, and financial engine should remain separable
so we can choose the right level of complexity for each use case.
