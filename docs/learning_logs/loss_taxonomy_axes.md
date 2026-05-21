# Loss Taxonomy Axes For Modeling

Date: 2026-05-19

## Why This Note Exists

When we say "loss," we can mean several different things:

```text
how the loss forms
what business variable is hurt
over what time horizon it is measured
where it is aggregated
how it becomes money
what action can reduce it
```

These are separate dimensions. Confusing them leads to bad modeling choices.

The clean framing:

```text
PRIMARY AXES
1. Loss process axis
2. Loss category axis

SECONDARY AXES
3. Time / reporting axis
4. Spatial / portfolio axis
5. Financial expression axis
6. Actionability axis
```

The key correction:

```text
event-based vs continuous = loss process axis
generation / price / revenue / contract / hazard = loss category axis
per-event / annual / lifetime = time or reporting axis
```

Those are not competing classifications. They stack.

## One-Line Summary

```text
Loss process tells us how loss forms.
Loss category tells us what is hurt.
Time and aggregation tell us how the result is summarized.
Financial expression tells us how it becomes money.
Actionability tells us what we can do about it.
```

## The Core Map

```text
┌──────────────────────────────────────────────────────────────┐
│                         LOSS TAXONOMY                         │
└──────────────────────────────────────────────────────────────┘

PRIMARY AXES

  Axis 1: Loss Process
      event-based
      continuous / cumulative
      hybrid

  Axis 2: Loss Category
      generation
      price
      revenue
      hazard / physical damage
      contract
      basis / capture price
      availability
      O&M / replacement
      counterparty / credit
      regulatory / policy

SECONDARY AXES

  Axis 3: Time / Reporting
      per event
      hourly / daily
      annual
      lifetime
      portfolio period

  Axis 4: Spatial / Portfolio
      component
      asset
      site
      county / zone
      portfolio
      region

  Axis 5: Financial Expression
      lost MWh
      lost revenue
      repair cost
      payout
      reserve
      O&M cost
      valuation impact

  Axis 6: Actionability
      hedge
      insure
      mitigate
      maintain
      reprice
      avoid
      accept
```

## Why This Matters For Modeling

Different axes imply different modeling needs.

If the process is event-based, we usually start with:

```text
frequency x severity x vulnerability
```

If the process is continuous, we usually start with:

```text
stress history -> asset state -> performance / cost drift
```

If the category is price risk, the model needs market prices and basis.

If the category is hazard damage, the model needs physical hazard intensity and
vulnerability.

If the time view is lifetime, annual expected loss is not enough.

If the aggregation is portfolio, single-location marginal risk is not enough.

If the action is mitigation, the model needs a before/after counterfactual, not
just a risk score.

## Primary Axis 1: Loss Process

Question:

```text
How does the loss physically or operationally form?
```

Main classes:

| Process | Meaning | Typical model |
|---|---|---|
| event-based | discrete event creates impact | frequency-severity, event catalog, vulnerability |
| continuous / cumulative | stress accumulates and changes state | degradation, state evolution, performance drift |
| hybrid | events and state interact | dynamic vulnerability, event + state model |

Examples:

| Example | Process |
|---|---|
| outage causing business interruption | event-based |
| hailstorm damaging solar panels | event-based |
| solar module degradation | continuous |
| battery capacity fade | continuous |
| heat stress increasing equipment failure rate | hybrid |
| prior microcracks increasing hail vulnerability | hybrid |

This axis determines whether we should begin with an event catalog or an asset
state model.

## Primary Axis 2: Loss Category

Question:

```text
What business or economic variable is hurt?
```

For solar and renewable infrastructure, common categories are:

| Category | What is hurt | Example |
|---|---|---|
| generation / resource | physical output | lower MWh from lower irradiance or degradation |
| price | market price received | lower power prices |
| basis / capture price | realized node/asset price vs benchmark | congestion, capture price decline |
| revenue | total money earned | lower MWh x lower price, curtailment |
| availability | ability to operate | inverter failure, forced outage |
| hazard / physical damage | asset condition | hail, wind, flood, wildfire |
| O&M / replacement | cost base | higher maintenance, earlier replacement |
| contractual | obligations and penalties | PPA shortfall, liquidated damages |
| merchant / hedge | hedge settlement exposure | shape mismatch, volume mismatch |
| interconnection / grid | ability to export | curtailment, upgrade delay |
| regulatory / policy | rules, tariffs, incentives | tax credit, tariff, permitting change |
| counterparty / credit | payment or default risk | offtaker default |
| insurance / coverage | retained risk after insurance | deductible, exclusion, limit exhaustion |
| valuation / refinancing | asset value and cost of capital | lower forecast cash flow, refinancing risk |

This axis determines which data and financial model are needed.

## Secondary Axis 3: Time / Reporting

Question:

```text
Over what period is the loss measured or reported?
```

Common views:

| Time view | Example use |
|---|---|
| per event | parametric payout, repair estimate |
| hourly / daily | operations, dispatch, market settlement |
| monthly / seasonal | O&M planning, resource shape |
| annual | insurance pricing, budget, expected annual loss |
| multi-year | financing, warranty, degradation, capex planning |
| lifetime | asset valuation, lifecycle economics |
| portfolio period | capital, risk appetite, reinsurance |

Important distinction:

```text
per-event vs annual is not the same as event-based vs continuous
```

An event-based process can be annualized. A continuous process can be reported
annually. The reporting period is a view of the output, not the underlying loss
mechanism.

## Secondary Axis 4: Spatial / Portfolio

Question:

```text
At what spatial or portfolio level is the loss evaluated?
```

Common levels:

| Level | Example |
|---|---|
| component | inverter, panel, turbine blade |
| asset | solar project, building, turbine |
| site | project boundary, facility, plant |
| policy | insured contract |
| county / zone | EAGLE-I outage FIPS, ISO price zone |
| portfolio | many assets/policies |
| region | market, weather system, service territory |

This axis is where basis risk and aggregation risk appear.

Example:

```text
county outage event != specific business outage
hail in county != hail at insured building
node price != portfolio realized price
```

## Secondary Axis 5: Financial Expression

Question:

```text
How does the modeled impact become money?
```

Common expressions:

| Expression | Example |
|---|---|
| lost MWh | generation shortfall |
| lost revenue | MWh x realized price |
| repair cost | physical damage repair |
| replacement cost | component or asset replacement |
| O&M cost | maintenance, inspection, labor |
| payout | insurance or parametric payment |
| reserve | warranty, claims, capital reserve |
| penalty | contractual liquidated damages |
| basis loss | node/hub or asset/benchmark spread |
| valuation impact | lower expected cash flows, higher discount rate |

This axis matters because two losses can have the same physical cause but very
different financial translations.

## Secondary Axis 6: Actionability

Question:

```text
What can be done about the risk?
```

Common action classes:

| Action | Example |
|---|---|
| hedge | price risk, basis risk |
| insure | physical hazard, outage interruption |
| mitigate | flood barrier, backup power, hail stow |
| maintain | cleaning, predictive maintenance, replacement |
| redesign | stronger asset, better site selection |
| reprice | premium, contract terms, reserve |
| avoid | do not write, do not invest, exit exposure |
| accept | retain if cost of mitigation exceeds benefit |

This axis changes the model output. A model for pricing risk is not always the
same as a model for deciding mitigation.

## Solar Example: Same Asset, Many Losses

Solar project risk can be mapped through the axes.

| Risk | Process | Category | Time view | Financial expression | Action |
|---|---|---|---|---|---|
| module degradation | continuous | generation / asset performance | annual + lifetime | lost MWh, lower valuation | maintenance, warranty, replacement |
| hail damage | event-based | hazard / physical damage | event + annual | repair cost, downtime, deductible | insurance, hail stow, resilient panels |
| capture price decline | continuous / regime | price / revenue | hourly + annual + multi-year | lower $/MWh | hedge, storage, market selection |
| curtailment | hybrid | revenue / grid | hourly + annual | lost revenue, contract shortfall | storage, interconnection, contract design |
| inverter failure | event-based / hybrid | availability / O&M | event + annual | repair cost, downtime | maintenance, redundancy |
| soiling | continuous | generation / O&M | daily + seasonal + annual | lost MWh, cleaning cost | cleaning schedule |
| PPA shortfall | hybrid | contractual | annual + contract term | penalties, lower revenue | contract design, reserve |
| offtaker default | event-based / regime | counterparty / credit | event + portfolio period | unpaid revenue, replacement PPA | credit screen, collateral |
| tax credit change | event/regime | regulatory / policy | multi-year | lower after-tax value | structuring, policy monitoring |
| deductible exhaustion | event-based | insurance / coverage | event + annual | retained loss | coverage design |

This table shows why "solar loss" is not one thing. It is a bundle of loss
categories and loss processes.

## Worked Examples

### Solar Module Degradation

```text
Process:
    continuous

Category:
    generation / asset performance

Time view:
    annual leakage + lifetime valuation

Financial expression:
    lost MWh x realized price
    lower asset value

Action:
    warranty reserve
    cleaning / maintenance
    replacement timing
```

Modeling implication:

```text
start with baseline-normalized performance trend
then add degradation / state model if it improves forecast or valuation
```

### Solar Hail Damage

```text
Process:
    event-based

Category:
    hazard / physical damage

Time view:
    event loss + annual expected loss

Financial expression:
    repair cost
    downtime
    insurance deductible / payout

Action:
    insurance
    hail stow
    panel selection
```

Modeling implication:

```text
start with hail event catalog + exposure + vulnerability curve
then add portfolio event replay if many sites are exposed together
```

### Capture Price Decline

```text
Process:
    continuous / regime-based

Category:
    price / revenue

Time view:
    hourly shape + annual capture + multi-year trend

Financial expression:
    realized price shortfall

Action:
    hedge
    storage
    market selection
    contract design
```

Modeling implication:

```text
event catalog is not the natural starting point
market time-series and regime analysis matter more
```

### Outage Parametric Policy

```text
Process:
    event-based

Category:
    business interruption / availability

Time view:
    event payout + annual expected premium

Financial expression:
    X-dollar payout if duration >= T

Action:
    insure
    install backup power
    improve resilience
```

Modeling implication:

```text
event catalog and trigger definition are central
location-basis risk matters because county event != premise outage
```

## Choosing Where To Work

This taxonomy should help choose modeling priorities.

A practical scoring table:

| Risk | Process | Category | Data | Business value | Tractability | Priority |
|---|---|---|---|---|---|---|
| hail damage | event | hazard / physical damage | good external data | high | medium | high |
| degradation | continuous | generation / asset performance | asset telemetry needed | high | medium if data exists | high if data exists |
| capture price | continuous / regime | price / revenue | market data strong | high | high | high |
| curtailment | hybrid | revenue / grid | ISO data varies | high | medium | medium-high |
| contractual penalties | hybrid | contractual | contract-specific | high | low without docs | later |

Prioritize where three things overlap:

```text
business value
data support
modeling tractability
```

ASCII prioritization:

```text
                  high business value
                         ▲
                         │
        avoid for now    │     priority zone
        if no data       │     if tractable
                         │
data weak ───────────────┼────────────── data strong
                         │
        low priority     │     useful but maybe
                         │     incremental
                         ▼
                  low business value
```

## Relationship To Other Learning Logs

This file defines the broad taxonomy.

Related notes:

```text
loss_modeling_event_vs_continuous.md
    deep dive on the Loss Process Axis

hazard_event_modeling_goal_first.md
    deep dive on hazard/event modeling and goal-first method choice

docs/dicsscssion/distributions_evt_copulas_outage_pricing.md
    outage-specific discussion of empirical methods, distributions, EVT,
    and copulas
```

## Fundamental Questions For Any Loss Model

Before choosing a method, ask:

1. What is the loss process?
2. What is the loss category?
3. What time horizon matters?
4. What spatial or portfolio level matters?
5. What financial expression matters?
6. What action should the model support?
7. What data supports each axis?
8. Which axis is the weakest link?
9. Does the method solve the weakest link, or just make the model look more
   sophisticated?
10. What would make the output decision-relevant?

## Initial Takeaway

The taxonomy should prevent category mistakes.

```text
event-vs-continuous is about how loss forms
generation-vs-price-vs-contract is about what is hurt
per-event-vs-annual is about how we report or aggregate
payout-vs-revenue-vs-valuation is about how money is measured
hedge-vs-insure-vs-mitigate is about what action follows
```

For modeling, this matters because each axis changes the correct method.

The best loss model is not the most complex model. It is the model whose
structure matches the loss process, category, horizon, financial expression,
and decision goal.
