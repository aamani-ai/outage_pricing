# Loss Modeling: Event-Based Versus Continuous Effects

Date: 2026-05-19

## Why This Note Exists

When we talk about loss at a foundational level, there are at least two
different axes that are easy to mix together:

```text
Axis 1: nature of loss process
    event-based loss
    continuous / cumulative-effect loss

Axis 2: reporting or pricing period
    per-event
    annual
    lifetime
    portfolio period
```

These are not the same axis.

An event-based loss can still be reported annually:

```text
annual expected loss = event frequency x event severity
```

A continuous degradation process can also be summarized annually:

```text
annual revenue leakage = degraded performance x price / production value
```

But the underlying loss process is different, and that difference changes the
data, methods, validation, and financial translation.

This file focuses on the **loss process axis**. For the broader taxonomy across
loss category, time/reporting, spatial aggregation, financial expression, and
actionability, see:

```text
docs/learning_logs/loss_taxonomy_axes.md
```

## High-Level Map

```text
LOSS MODELING
├── Event-based loss
│   ├── discrete event occurrence
│   ├── event magnitude
│   ├── vulnerability / impact
│   └── financial loss or payout
│
├── Continuous / cumulative-effect loss
│   ├── stress exposure over time
│   ├── asset state degradation
│   ├── performance or failure-probability drift
│   └── financial leakage / replacement / O&M cost
│
└── Hybrid loss
    ├── events affect asset state
    ├── continuous state changes event vulnerability
    └── repeated stresses create nonlinear future loss
```

## Event-Based Loss

Event-based loss starts with a discrete occurrence.

```text
hazard event -> magnitude -> impact -> financial loss
```

Examples:

| Domain | Event | Magnitude | Loss translation |
|---|---|---|---|
| outage | outage interval | duration, customers out | business interruption / parametric payout |
| hail | hailstorm footprint | hail size, kinetic energy | roof, vehicle, panel damage |
| flood | flood event | depth, velocity, duration | building/equipment damage |
| wind | windstorm | gust speed, duration, direction | structural or equipment damage |
| equipment | component failure | outage duration, repair scope | repair cost, downtime |

The basic modeling shape is:

```text
frequency x severity x vulnerability
```

For outage v0:

```text
frequency = events per year
severity  = duration
trigger   = duration >= T
payout    = X
```

## Continuous / Cumulative-Effect Loss

Continuous loss does not begin with a clean event. It comes from accumulated
stress, aging, wear, or gradual operating-condition exposure.

```text
stress history -> asset state -> performance loss -> financial loss
```

Examples:

| Domain | Continuous process | State variable | Financial effect |
|---|---|---|---|
| solar | UV, heat, humidity, thermal cycling, soiling | module health / capacity factor | lost generation, lower asset value |
| wind | fatigue loading, turbulence, starts/stops | remaining useful life | O&M, derating, failure probability |
| gas turbine | thermal stress, starts, fuel quality, cycling | component life / heat-rate drift | maintenance, forced outage, efficiency loss |
| battery | cycling, temperature, calendar aging | capacity / internal resistance | degradation, replacement timing |
| grid | vegetation growth, asset aging, loading | failure probability / resilience | outage risk, restoration cost |

The modeling shape is:

```text
exposure over time -> state evolution -> performance / failure / cost
```

This is often harder than event modeling because the loss is hidden in a slowly
changing state variable.

## Continuous-Loss Five-Piece Framework

For event-based risk, the reusable architecture is:

```text
event catalog
exposure database
vulnerability curves
financial terms
portfolio aggregation
```

For continuous loss, the equivalent architecture is more state-centered:

```text
stress / driver history
asset state database
degradation / response model
financial translation
decision / optimization layer
```

Side by side:

| Event-based framework | Continuous framework |
|---|---|
| event catalog | stress / driver history |
| exposure database | asset state database |
| vulnerability curves | degradation / response model |
| financial terms | financial translation |
| portfolio aggregation | decision / optimization layer |

The biggest conceptual difference:

```text
event-based:
    loss happens because an event intersects exposure

continuous:
    loss happens because asset state drifts over time
```

ASCII view:

```text
┌──────────────────────┐
│ Stress / Driver      │
│ History              │
│ weather, operations  │
└──────────┬───────────┘
           │ updates
           ▼
┌──────────────────────┐
│ Asset State          │
│ Database             │
│ health, age, condition│
└──────────┬───────────┘
           │ evolves through
           ▼
┌──────────────────────┐
│ Degradation /        │
│ Response Model       │
│ state_t -> state_t+1 │
└──────────┬───────────┘
           │ converts into
           ▼
┌──────────────────────┐
│ Financial            │
│ Translation          │
│ revenue/O&M/value    │
└──────────┬───────────┘
           │ supports
           ▼
┌──────────────────────┐
│ Decision /           │
│ Optimization Layer   │
│ maintain/price/invest│
└──────────────────────┘
```

### 1. Stress / Driver History

This is the continuous analog of an event catalog.

It records what the asset was exposed to over time:

```text
temperature
UV
humidity
wind loading
starts / stops
cycling
soiling
loading
fuel quality
maintenance actions
operating regime
```

For a continuous model, the history matters because the same asset state can be
reached through many different paths, and the path can affect future behavior.

### 2. Asset State Database

This records what condition the asset is in.

Examples:

```text
asset age
capacity
efficiency
module health
battery state of health
turbine component life
heat rate
maintenance history
prior damage
remaining useful life
```

The state can be directly measured, indirectly inferred, or partly hidden. The
more hidden it is, the harder the modeling problem becomes.

### 3. Degradation / Response Model

This describes how stress changes state.

Generic form:

```text
state_t+1 = state_t + degradation(stress_t, operations_t, maintenance_t)
```

Examples:

```text
heat accelerates battery degradation
starts/stops consume turbine component life
humidity and thermal cycling degrade solar modules
turbulence and loading consume wind turbine fatigue life
vegetation growth increases grid outage probability
```

### 4. Financial Translation

This converts changed state into money.

Examples:

```text
lower MWh
higher heat rate
higher O&M
earlier replacement
lower asset value
higher forced outage probability
lower backup capacity
```

This piece is different from a simple event payout. Continuous losses often
show up as revenue leakage, cost drift, valuation impact, or replacement timing.

### 5. Decision / Optimization Layer

This is the action the model supports.

Examples:

```text
price risk
schedule maintenance
justify mitigation
value warranty reserve
optimize replacement
underwrite asset
choose cleaning schedule
decide retrofit timing
```

For continuous loss, the model is often less about "what is the claim from this
event?" and more about "what action changes the future state trajectory?"

## Solar Example

Solar is a clean example because it has both continuous and event-based loss.

### Continuous Solar Loss

```text
stress / driver history:
    UV, heat, humidity, soiling, thermal cycling, operating history

asset state database:
    module age, degradation rate, inverter health, cleaning history,
    prior damage, measured performance ratio

degradation / response model:
    state_t+1 = state_t - degradation(stress_t, operations_t, maintenance_t)

financial translation:
    lost MWh x power price
    lower asset value
    higher O&M
    earlier replacement

decision:
    cleaning schedule
    warranty reserve
    asset valuation
    mitigation ROI
    maintenance timing
```

### Event-Based Solar Loss

```text
event catalog:
    hailstorm, windstorm, flood, wildfire smoke, outage event

exposure database:
    site boundary, panel type, tilt, tracker, inverter, project layout

vulnerability:
    damage ratio as a function of hail size, wind speed, flood depth,
    smoke/soiling severity, or outage duration

financial terms:
    repair cost, deductible, lost revenue, insurance payout

portfolio aggregation:
    many solar sites hit by the same storm or regional event
```

### Hybrid Solar Loss

The hybrid view is often the most realistic:

```text
continuous degradation raises vulnerability
hail event causes immediate damage
heat stress accelerates degradation
prior microcracks change hail/wind fragility
maintenance or replacement resets part of the state
```

That means a static vulnerability curve may be too simple:

```text
loss_ratio = f(hail_size)
```

The richer form is:

```text
loss_ratio = f(hail_size, module_age, prior_microcracks, maintenance_state)
```

This is why event and continuous frameworks should be connected, even though
they should be conceptually separated.

## Hybrid Loss

Many real systems are not purely event-based or purely continuous.

Hybrid pattern:

```text
events + stress history -> asset state -> changed vulnerability -> loss
```

Solar example:

```text
heat and UV slowly degrade modules
soiling reduces output gradually
hail event causes immediate damage
prior degradation changes fragility
maintenance resets part of the state
```

Outage/grid example:

```text
vegetation and asset aging increase outage probability
storm event creates immediate outage
prior grid condition affects restoration duration
repeated outages change customer resilience decisions
```

This matters because a vulnerability curve is not always static.

```text
loss = vulnerability(hazard magnitude, asset condition)
asset condition = f(age, stress history, maintenance, prior events)
```

If asset condition changes over time, the same hazard magnitude can create a
different loss tomorrow than it created five years ago.

## Event-Based Versus Continuous: Key Differences

| Dimension | Event-based loss | Continuous / cumulative loss |
|---|---|---|
| starting point | discrete event | ongoing stress process |
| main variable | event magnitude | asset state |
| time scale | minutes to days, sometimes weeks | months to decades |
| data shape | event log | time series / panel / maintenance history |
| common model | frequency-severity | state evolution / degradation curve |
| validation | event labels, claims, sensor triggers | performance drift, inspections, failure records |
| financial output | claim/payout/repair cost | revenue leakage, O&M, replacement, valuation impact |
| main risk | bad event definition | hidden state and attribution error |

## Why Continuous Effects Are Underappreciated

Continuous effects are hard to see because they rarely announce themselves as
one clean record in a dataset.

Example:

```text
solar output is down 3%
```

Possible explanations:

```text
module degradation
soiling
weather normalization error
curtailment
inverter behavior
sensor drift
availability issue
tracker issue
temperature correction error
```

Attribution is harder than with a labeled event. The signal is often mixed with
measurement noise, operational changes, and confounders.

That does not make continuous loss less important. It often matters more for
long-horizon economics because it compounds.

## State Variables Matter

Continuous loss modeling usually needs a state variable.

Examples:

```text
asset health
remaining useful life
module efficiency
battery capacity
turbine component life
heat rate
failure probability
vegetation risk score
grid resilience score
```

The model is often trying to estimate:

```text
state_t+1 = state_t + degradation(stress_t, operations_t, maintenance_t)
```

Then loss is derived from the state:

```text
loss_t = financial_value(baseline performance - actual performance)
```

## Time Horizon Matters

Event-based loss often works naturally on an annual basis:

```text
expected annual loss = annual event rate x event loss
```

Continuous loss often needs a longer horizon:

```text
lifetime energy loss
net present value of degradation
replacement timing
maintenance optimization
multi-year failure probability
```

The right time horizon depends on the decision:

| Decision | Time horizon |
|---|---|
| annual insurance price | policy year |
| battery warranty | warranty term |
| solar asset valuation | remaining asset life |
| maintenance planning | next service interval |
| resilience investment | payback period / asset life |
| portfolio risk | annual plus multi-year stress scenarios |

## Financial Translation Changes

Event-based financial translation:

```text
event happens -> loss or payout happens
```

Examples:

```text
outage duration >= T -> pay X
hail size damages roof -> repair cost
flood depth reaches equipment -> replacement cost
```

Continuous-effect financial translation:

```text
state slowly worsens -> performance or cost drifts
```

Examples:

```text
solar degradation -> lower MWh -> lower revenue
battery capacity fade -> lower usable capacity -> lower arbitrage / backup value
turbine heat-rate drift -> higher fuel cost
component fatigue -> earlier replacement / higher forced-outage probability
```

So the financial module has to match the loss nature. A clean parametric payout
may be natural for event loss, while NPV or performance leakage may be more
natural for continuous loss.

## Validation Changes

Event validation asks:

```text
Did the event happen?
Was the magnitude measured correctly?
Did the event intersect the exposure?
Did the loss/payout trigger?
```

Continuous validation asks:

```text
Is the baseline correct?
Is the state variable observable?
Can we separate degradation from weather, operations, and measurement error?
Does the model predict future drift or failure better than a simple baseline?
```

This is a different validation problem.

## Mitigation Logic Changes

Event-based mitigation often reduces:

```text
event probability
event magnitude at exposure
vulnerability at a given magnitude
financial loss after impact
```

Examples:

```text
backup generator reduces outage loss
hail-resistant roof reduces hail damage
flood barrier reduces flood depth at asset
wind retrofit reduces failure probability
```

Continuous mitigation often changes:

```text
degradation rate
maintenance timing
asset condition
failure probability trajectory
```

Examples:

```text
panel cleaning reduces soiling losses
better cooling slows battery degradation
predictive maintenance extends turbine life
vegetation management reduces grid failure probability
```

Hybrid mitigation can do both.

## Where This Connects To Vulnerability Curves

A simple vulnerability curve often looks like:

```text
loss_ratio = f(hazard_magnitude)
```

But for real assets it may need to be:

```text
loss_ratio = f(hazard_magnitude, asset_condition, mitigation, prior_events)
```

This is where continuous effects connect directly to event-based loss.

Example:

```text
same hail size
different panel age / glass condition / prior microcracks
different damage probability
```

Or:

```text
same storm
different grid vegetation / maintenance / asset age
different outage duration
```

So continuous effects can shift the vulnerability curve even if the event
catalog is unchanged.

## Working Framework

Before modeling loss, classify the process:

```text
1. Is there a discrete event?
2. Is there an accumulating state?
3. Does the event change the state?
4. Does the state change future event vulnerability?
5. Is the financial loss immediate, gradual, or both?
```

ASCII decision map:

```text
                    ┌─────────────────────┐
                    │ What is the loss     │
                    │ process?             │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
     │ Event-Based    │ │ Continuous     │ │ Hybrid         │
     │                │ │                │ │                │
     │ event -> loss  │ │ stress -> state│ │ event + state  │
     └───────┬────────┘ └───────┬────────┘ └───────┬────────┘
             │                  │                  │
             ▼                  ▼                  ▼
     frequency-severity   state evolution    dynamic vulnerability
     trigger logic        degradation curve   + event model
```

## Method Implications

| Loss nature | First model | Next complexity | Common mistake |
|---|---|---|---|
| event-based | empirical event rate and severity | fitted severity, EVT, event simulation, dependence | fitting tails before event definition is stable |
| continuous | baseline-normalized performance trend | degradation/state-space model, survival/failure model | confusing measurement drift with degradation |
| hybrid | separate event and state components | dynamic vulnerability, maintenance/state feedback | treating vulnerability as static |

## Open Questions For Future Work

- Can we create a shared schema that separates events from continuous state?
- How should asset condition enter vulnerability curves?
- Which continuous effects are material enough for pricing or underwriting?
- Can we measure degradation directly, or only infer it from noisy performance?
- How should mitigation be represented for event loss versus continuous loss?
- Can we build a common "asset state" layer that supports multiple hazards?
- Where does continuous degradation become an insurable loss versus an operating
  cost?

## Initial Takeaway

Event-based and continuous losses are connected, but they require different
mental models.

```text
event loss:
    event -> magnitude -> vulnerability -> financial loss

continuous loss:
    stress history -> asset state -> performance drift -> financial loss

hybrid loss:
    events and stress update asset state;
    asset state changes future vulnerability
```

Clean summary:

```text
Event risk is event-centered.
Continuous risk is state-centered.
Hybrid risk is event-plus-state-centered.
```

For climate and infrastructure products, the hybrid view may be the most
important long-term one. It connects hazard events, asset condition,
maintenance, vulnerability curves, and financial outcomes into one coherent
loss framework.
