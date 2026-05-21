# Portfolio Event Catalogs And Aggregation

Date: 2026-05-19

## Why This Note Exists

We were discussing whether RMS, Verisk, or similar catastrophe modeling
platforms preserve the relationship between spatial points. Example:

```text
If a portfolio has assets in Texas and New York, does the event catalog know
whether the same modeled event can affect both locations, or are the locations
treated like independent point estimates?
```

This is a fundamental distinction. Single-location pricing can often use a
marginal frequency or exceedance curve. Portfolio risk cannot. A portfolio model
must know which locations are hit together, in which event, and in which
simulated year.

## Short Answer

Good catastrophe event catalogs are built specifically to preserve event-level
spatial and temporal structure. They do not just provide isolated location loss
costs.

But the dependence is still modeled dependence, not guaranteed truth.

The practical rule:

```text
location AAL / loss cost can price one point
event loss table can aggregate one event across many points
year loss table can estimate portfolio annual tail risk
```

If the model only gives independent point estimates, it is weak for portfolio
aggregation. If it gives event IDs, event footprints, event rates, and simulated
years, it can support portfolio aggregation because the same event can be
replayed against every exposure.

Clean historical event catalogs can already support meaningful portfolio
dependence analysis. The important caveat is scope:

```text
historical event catalog
  -> historical replay, empirical co-hit rates, co-trigger matrices,
     concentration diagnostics, historical YLT

stochastic / synthetic event catalog
  -> rare-tail expansion, many simulated years, unseen event combinations,
     capital-style OEP/AEP beyond observed history
```

So yes: if the historical catalog has timeline and spatial footprint
information, we can calculate portfolio correlation and adjustment logic from
it. But we should call it empirical dependence or historical replay, not full
tail simulation.

## Four Different Objects That People Confuse

| Object | What it answers | Portfolio-ready? |
|---|---|---|
| Hazard map | How intense is the hazard at this place? | No, not by itself |
| Location AAL / loss cost | What is the long-run average loss at this location? | Weak, because dependence is lost |
| Event loss table (ELT) | What does each event do to each exposure or portfolio? | Yes, event-level aggregation |
| Year loss table (YLT) | What is total loss in each simulated year? | Yes, annual tail and capital metrics |

ASCII view:

```text
Hazard map
  -> good for local risk view
  -> weak for portfolio tail

Location AAL
  -> good for pricing baseline
  -> weak for co-loss / accumulation

ELT
  -> event_id x exposure loss
  -> supports event aggregation

YLT
  -> simulated_year x total loss
  -> supports annual EP curves and capital view
```

## Why Event Catalogs Matter

An event catalog is the object that carries dependence.

Minimum useful fields:

| Field | Why it matters |
|---|---|
| `event_id` | Keeps all affected locations tied to the same event |
| `peril` | Separates hurricane, hail, wildfire, flood, outage, etc. |
| `event_rate` or `annual_probability` | Turns catalog events into frequency |
| `event_start` / `season` / `day` | Supports temporal clustering and seasonal exposure |
| `simulated_year` | Allows multiple events to occur in the same modeled year |
| `footprint_geometry` | Defines where the event reaches |
| `intensity_field` | Gives location-specific hazard magnitude inside the event |
| `secondary_uncertainty` | Allows alternative loss outcomes for the same event |
| `source_model_version` | Keeps results reproducible and auditable |

For a loss model, the catalog is then joined to exposure:

```text
event footprint + exposure location -> hazard intensity at asset
hazard intensity + vulnerability -> damage / interruption
damage / interruption + financial terms -> loss / payout
losses across exposures -> portfolio loss
```

## Texas And New York Example

Suppose we have three assets:

```text
Asset A: Texas
Asset B: Texas
Asset C: New York
```

If we only have independent location AALs:

```text
AAL(A) = 100
AAL(B) = 120
AAL(C) = 90
```

We can add average loss:

```text
portfolio AAL = 310
```

But we cannot correctly answer:

```text
What is the 1-in-100 aggregate portfolio loss?
Can A, B, and C be hit in the same modeled year?
Do A and B lose together from the same Texas event?
Can a broad hurricane, winter storm, heat wave, or grid event create
cross-state accumulation?
```

For that, we need event identity:

| Sim year | Event ID | Texas A | Texas B | New York C | Portfolio loss |
|---:|---|---:|---:|---:|---:|
| 1 | HURR_001 | 0 | 0 | 500 | 500 |
| 2 | SCS_014 | 700 | 600 | 0 | 1300 |
| 3 | WINTER_008 | 400 | 300 | 250 | 950 |

Now the model can represent co-loss:

```text
same event hits A and B
same simulated year can include multiple events
broad regional event can hit multiple states
```

That is the basic reason portfolio models need event catalogs, not only point
scores.

## What A Clean Historical Catalog Can Do

A harmonized historical event catalog with event IDs, timestamps, footprints,
and magnitudes can answer several portfolio questions directly:

| Question | Historical catalog can answer? | How |
|---|---|---|
| Which exposures were hit by the same event? | Yes | intersect event footprints with exposure locations |
| Which counties/assets trigger together? | Yes | event-exposure incidence matrix |
| How concentrated is the portfolio in known event corridors? | Yes | aggregate historical hits by region, utility, peril, event family |
| What was the historical annual loss distribution? | Yes | group event losses by calendar year |
| What is empirical co-trigger probability? | Yes | count events or years where both exposures trigger |
| What is a 1-in-100 modeled tail? | Not reliably | historical window is too short unless a stochastic layer is added |
| What happens under unobserved event combinations? | Not reliably | needs simulation, stress tests, or scenario expansion |

The useful first product is not a correlation coefficient by itself. It is a
portfolio replay table:

```text
historical event catalog
        |
        v
event x exposure trigger/loss matrix
        |
        |-- event loss table
        |-- year loss table
        |-- co-trigger matrix
        |-- concentration report
        `-- distance / region dependence diagnostics
```

### Historical Replay Example

Assume four insured assets:

```text
A = Dallas solar site
B = Fort Worth warehouse
C = Houston retailer
D = New York office
```

And a clean historical hail/outage catalog:

| Year | Event ID | Event family | Footprint | A | B | C | D |
|---:|---|---|---|---:|---:|---:|---:|
| 2021 | HAIL_TX_001 | severe convective storm | North Texas | 1 | 1 | 0 | 0 |
| 2021 | WIND_TX_003 | severe convective storm | Gulf/TX | 0 | 0 | 1 | 0 |
| 2022 | WINTER_002 | winter storm / grid stress | TX + Northeast | 1 | 1 | 1 | 1 |
| 2023 | HAIL_TX_007 | severe convective storm | North Texas | 1 | 1 | 0 | 0 |

The `1` values mean the event footprint and trigger logic hit the exposure.

From this alone we can calculate:

```text
P(B triggers | A triggers) = 3 / 3 = 100%
P(C triggers | A triggers) = 1 / 3 = 33%
P(D triggers | A triggers) = 1 / 3 = 33%
```

This is already valuable. It tells us A and B are not independent because the
same North Texas events hit both. It also shows that D is usually independent of
A, except for broad winter-storm/grid-stress events.

If the payout is fixed at 100 per triggered asset:

| Year | Event ID | Triggered assets | Event loss |
|---:|---|---:|---:|
| 2021 | HAIL_TX_001 | 2 | 200 |
| 2021 | WIND_TX_003 | 1 | 100 |
| 2022 | WINTER_002 | 4 | 400 |
| 2023 | HAIL_TX_007 | 2 | 200 |

Historical annual aggregation:

| Year | Event count | Aggregate loss | Max event loss |
|---:|---:|---:|---:|
| 2021 | 2 | 300 | 200 |
| 2022 | 1 | 400 | 400 |
| 2023 | 1 | 200 | 200 |

This gives a historical YLT:

```text
2021 -> 300
2022 -> 400
2023 -> 200
```

That supports empirical AAL and basic stress discussion:

```text
historical AAL = (300 + 400 + 200) / 3 = 300
```

But it does not prove the 1-in-100 portfolio loss. The catalog only observed
three years in this toy example. Even with 30 years, rare portfolio-tail
estimates are thin.

### Mathematical Replay Walkthrough

The clean way to think about the process is matrix-first.

Define:

```text
E = number of events
N = number of exposures
Y = number of historical or simulated years

I[e, i] = 1 if event e hits/triggers exposure i, else 0
X[i]    = payout or insured value for exposure i
L[e, i] = loss for event e and exposure i
```

For a binary parametric trigger with fixed payout:

```text
L[e, i] = I[e, i] * X[i]
```

If all four assets have payout `X = 100`, the event-exposure incidence matrix is:

| Event | A | B | C | D |
|---|---:|---:|---:|---:|
| HAIL_TX_001 | 1 | 1 | 0 | 0 |
| WIND_TX_003 | 0 | 0 | 1 | 0 |
| WINTER_002 | 1 | 1 | 1 | 1 |
| HAIL_TX_007 | 1 | 1 | 0 | 0 |

The event loss matrix is:

| Event | A loss | B loss | C loss | D loss | Event loss |
|---|---:|---:|---:|---:|---:|
| HAIL_TX_001 | 100 | 100 | 0 | 0 | 200 |
| WIND_TX_003 | 0 | 0 | 100 | 0 | 100 |
| WINTER_002 | 100 | 100 | 100 | 100 | 400 |
| HAIL_TX_007 | 100 | 100 | 0 | 0 | 200 |

Formula:

```text
event_loss[e] = sum_i L[e, i]
```

Then group events by year:

```text
annual_loss[y] = sum_{e in year y} event_loss[e]
max_event_loss[y] = max_{e in year y} event_loss[e]
```

That gives:

| Year | Events | Annual loss | Max event loss |
|---:|---|---:|---:|
| 2021 | HAIL_TX_001, WIND_TX_003 | 300 | 200 |
| 2022 | WINTER_002 | 400 | 400 |
| 2023 | HAIL_TX_007 | 200 | 200 |

Now the basic portfolio metrics are:

```text
AAL = mean(annual_loss)
OEP curve = exceedance curve of max_event_loss by year
AEP curve = exceedance curve of annual_loss by year
```

For the toy example:

```text
AAL = (300 + 400 + 200) / 3 = 300
```

This is the foundation of portfolio replay.

### Co-Trigger Matrices

From the same incidence matrix, we can calculate co-trigger counts:

```text
co_count[i, j] = sum_e I[e, i] * I[e, j]
trigger_count[i] = sum_e I[e, i]
```

For the example:

| Pair | Co-trigger count | Interpretation |
|---|---:|---|
| A-B | 3 | A and B trigger together in all three A-triggering events |
| A-C | 1 | A and C only co-trigger in the winter/grid-stress event |
| A-D | 1 | A and D only co-trigger in the broad winter event |
| C-D | 1 | C and D only co-trigger in the broad winter event |

Conditional co-trigger probability:

```text
P(j triggers | i triggers) = co_count[i, j] / trigger_count[i]
```

Example:

```text
P(B | A) = 3 / 3 = 1.00
P(C | A) = 1 / 3 = 0.33
P(D | A) = 1 / 3 = 0.33
```

This is often more interpretable than a generic correlation coefficient because
it directly answers:

```text
If one exposure triggers, how often does the other trigger in the same event?
```

### Correlation Matrix

You can also compute a binary event-level correlation matrix from the columns of
`I`. This is the phi correlation for two binary trigger variables.

For two exposures `i` and `j`:

```text
n11 = events where i=1 and j=1
n10 = events where i=1 and j=0
n01 = events where i=0 and j=1
n00 = events where i=0 and j=0

phi = (n11*n00 - n10*n01)
      / sqrt((n11+n10)(n01+n00)(n11+n01)(n10+n00))
```

Toy example correlation matrix:

| Exposure | A | B | C | D |
|---|---:|---:|---:|---:|
| A | 1.00 | 1.00 | -0.58 | 0.33 |
| B | 1.00 | 1.00 | -0.58 | 0.33 |
| C | -0.58 | -0.58 | 1.00 | 0.58 |
| D | 0.33 | 0.33 | 0.58 | 1.00 |

This is mathematically valid for the tiny example, but it is not the best
decision object by itself.

Nuance:

```text
Correlation is symmetric.
Conditional trigger probability is directional.
Event replay is causal/mechanical in the weak sense that the same event
footprint is hitting exposures together.
```

For insurance and hazard portfolio work, the most useful order is usually:

```text
1. event replay
2. co-trigger / conditional probability matrix
3. annual loss distribution
4. correlation matrix as a summary diagnostic
5. stochastic simulation if tail or unseen combinations matter
```

### Event-Level Versus Year-Level Dependence

There are two dependence questions:

```text
event-level: do two exposures trigger in the same event?
year-level: do two exposures tend to lose money in the same year?
```

Event-level dependence uses `I[e, i]`.

Year-level dependence uses annualized losses:

```text
L_year[y, i] = sum_{e in year y} L[e, i]
```

Example annual exposure losses:

| Year | A | B | C | D |
|---:|---:|---:|---:|---:|
| 2021 | 100 | 100 | 100 | 0 |
| 2022 | 100 | 100 | 100 | 100 |
| 2023 | 100 | 100 | 0 | 0 |

Event-level correlation tells us about shared events. Year-level correlation
tells us about annual aggregation and capital risk.

Do not mix them casually.

### Nuances Before Using These Matrices

| Nuance | Why it matters |
|---|---|
| sample size | a 10-year historical matrix may be unstable for rare events |
| event definition | changing event grouping changes `I[e, i]` and all correlations |
| exposure changes | historical dependence may not match today's portfolio footprint |
| loss is not trigger | two assets can be hit by the same event but have different vulnerability |
| intensity matters | binary hit matrices discard severity unless `L[e, i]` uses intensity |
| peril family matters | dependence differs for hail, hurricane, flood, wildfire, outage, heat |
| spatial grain matters | county footprints can overstate premise-level co-trigger |
| non-stationarity | future dependence may shift with climate, grid, land use, or mitigation |

Recommended outputs from a historical catalog:

```text
event_exposure_matrix.parquet
event_loss_table.parquet
year_loss_table.parquet
co_trigger_counts.csv
conditional_trigger_matrix.csv
correlation_matrix.csv
distance_decay.csv
accumulation_summary.csv
```

### Correlation Adjustment Versus Event Replay

The phrase "correlation adjustment" can mean two different things.

Weak version:

```text
start with independent location loss costs
apply a correlation matrix
simulate correlated losses
```

This is compact, but it can hide event mechanics.

Stronger version:

```text
use event IDs and footprints
replay the same event against every exposure
derive co-trigger and annual loss structure from event reality
```

For hazard portfolios, event replay is usually the better first step. It gives
correlation as an output of shared events, not as an abstract input.

Useful empirical dependence outputs:

| Output | Meaning |
|---|---|
| co-hit matrix | how often exposure i and j are hit by the same event |
| conditional trigger matrix | `P(j triggers | i triggers)` |
| regional accumulation | loss concentration by state, county, utility, watershed, storm corridor |
| annual loss correlation | correlation of annual losses by region or peril |
| distance-decay curve | how co-hit probability falls with distance |
| event-family split | dependence by hurricane, hail, winter storm, grid stress, wildfire, etc. |

## Where Historical Dependence Fails

Historical catalogs are useful, but they do not solve everything.

Main failure modes:

| Failure mode | Why it matters |
|---|---|
| short history | a 10-30 year catalog cannot directly estimate 1-in-100 or 1-in-250 annual portfolio loss |
| unobserved combinations | history may not contain the worst spatial alignment for the current portfolio |
| changing exposure | today's portfolio may be concentrated where historical exposure was sparse |
| reporting bias | report-based hazards can understate rural or low-population events |
| coarse footprints | county-level events can overstate or understate asset-level co-hit |
| non-stationarity | climate, land use, grid condition, and mitigation can change future event behavior |
| event definition error | different grouping thresholds change co-trigger and annual aggregation |
| vulnerability uncertainty | co-hit is not co-loss if assets respond differently to the same intensity |

The key rule:

```text
Historical replay is the best first dependence diagnostic.
It is not automatically enough for rare-tail capital modeling.
```

## Rare And Secondary Hazards

The historical-catalog approach is weakest for rare secondary hazards.

Here, "secondary hazard" means a hazard or loss mechanism that is triggered by,
or conditional on, another event:

```text
hurricane -> storm surge -> flood loss
wildfire -> smoke -> business interruption / health impact
earthquake -> fire following / utility outage
hail/wind -> grid outage -> business interruption
heat wave -> grid stress -> outage
flood -> access disruption -> delayed repair
```

These are hard because the data requirement multiplies:

```text
primary event must be observed
secondary hazard must be observed
exposure must be present
vulnerability must be known
financial loss must be measurable
all within the same event timeline
```

Even a clean historical catalog may have only a handful of such events.

Example:

```text
If we have 30 years of hail data, we may have many hail swaths.
If we need hail-caused solar damage, fewer events have claims.
If we need hail-caused outage plus business interruption, the sample may be tiny.
```

In that situation, the historical catalog is still valuable, but mainly for:

```text
event structure
timing
co-hazard identification
calibration anchors
scenario design
sanity checks
```

It usually cannot carry the full tail estimate alone.

Better workflow for rare secondary hazards:

```text
1. Build the clean historical primary-event catalog.
2. Tag observed secondary outcomes where evidence exists.
3. Estimate conditional secondary probability where sample supports it.
4. Use engineering/domain logic for the missing mechanism.
5. Stress-test plausible secondary outcomes as scenarios.
6. Add stochastic simulation only after the historical replay shows what
   dependence structure needs to be preserved.
```

In short:

```text
historical catalog = anchor and replay
stochastic catalog = tail expansion
forward-looking model = future shift
engineering/vulnerability logic = secondary mechanism
```

For vendor climate-conditioned catastrophe-model practices and the limits of
what public docs tell us, see
[`vendor_cat_models_and_climate_conditioning.md`](vendor_cat_models_and_climate_conditioning.md).

## What Catastrophe Platforms Are Trying To Preserve

Catastrophe platforms generally separate:

```text
event module
hazard / intensity module
vulnerability module
financial module
portfolio aggregation
```

The important part for portfolio risk is that a modeled event has a coherent
footprint. The same simulated hurricane, wildfire, winter storm, convective
storm, or flood is replayed against the full portfolio.

That makes it possible to calculate:

| Metric | Meaning |
|---|---|
| `AAL` | Average annual loss |
| `ELT` | Event loss table: losses by event |
| `YLT` | Year loss table: total losses by simulated year |
| `OEP` | Occurrence exceedance probability: biggest event loss in a year |
| `AEP` | Aggregate exceedance probability: total annual loss |
| `TVaR` | Average of losses beyond a selected tail percentile |

For portfolio management, `AEP` and `OEP` matter because two portfolios can have
similar AAL but very different tail risk.

## Why This Is Different From Our Current Outage v0

Our current outage v0 is mostly a county-level historical pricing engine:

```text
county event catalog
duration threshold T
payout amount X
annualized empirical trigger rate
premium = lambda(T) x X / (1 - ER - TM)
```

That is a valid first layer for a single county/product question:

```text
How often did this county exceed T hours in the observed EAGLE-I history?
```

It is not yet a full portfolio aggregation model:

```text
Which insured locations trigger together?
What is the portfolio annual loss distribution?
What is the 1-in-100 annual payout?
How much concentration do we have in one utility, storm region, or grid regime?
```

To get there, the outage model needs a first-class event catalog with regional
event identity. County rows alone are not enough unless they can be grouped into
shared regional events.

## Why Outage Is Empirical-Friendly, But Many Hazards Are Not

The outage v0 can use empirical survival directly because the constructed event
catalog already has the key magnitude:

```text
event = county outage interval
magnitude = duration_hours
survival S(T) = count(duration_hours >= T) / count(events)
lambda(T) = count(duration_hours >= T) / observation_years
```

No fitted distribution is required for the current v0 question.

Many physical hazards are different. Often the ready-to-price event catalog does
not exist as a clean observed table. It has to be built:

```text
radar / station / satellite / reports / reanalysis
  -> quality control
  -> spatial interpolation or physics model
  -> event definition
  -> stochastic simulation or return-period layer
  -> event catalog
```

In that case, distributions, KDE, EVT, reanalysis, and simulation are not just
"extra pricing complexity." They may be part of constructing the event catalog
itself.

Useful rule:

```text
Empirical exceedance is strongest when:
  event definition is stable
  magnitude is directly observed or credibly reconstructed
  spatial unit matches the exposure decision
  observed history covers the trigger range

Modeled catalogs become necessary when:
  historical events are sparse
  exposure is point-level but observations are coarse
  tail risk is outside observed support
  portfolio dependence is the main question
  future climate or grid condition shifts matter
```

## Why Portfolio Work Should Be A Separate Workstream

The current `price_engine/` should stay focused on historical pricing and the
static county dashboard. Portfolio aggregation is a different product layer.

A separate workstream, and maybe later a separate repo, makes sense because it
needs different contracts:

```text
portfolio exposure schema
event catalog schema
vulnerability / payout module
financial terms engine
ELT builder
YLT builder
EP curve calculator
accumulation dashboard
scenario replay tools
```

Possible repo or project names:

```text
portfolio_risk_engine
portfolio_risk_lab
hazard_portfolio_engine
```

Suggested boundary:

| Project | Role |
|---|---|
| `price_engine/` | County-level historical outage pricing and dashboard |
| `curated_outage_data/` | Enriched outage event and feature datasets |
| future `portfolio_risk_engine` | Exposure import, event replay, ELT/YLT, EP curves, accumulation |

Do not move this into `price_engine/` too early. It will make the first engine
harder to reason about.

## Minimum Future Portfolio Engine

The smallest useful version would take:

```text
1. exposure table
2. outage event catalog with regional event IDs
3. payout terms per exposure
4. event-to-exposure trigger logic
5. simulated or historical years
```

And produce:

```text
event_loss_table.parquet
year_loss_table.parquet
portfolio_summary.json
ep_curve.csv
accumulation_by_state_county_utility.csv
```

Example schema:

```text
event_loss_table
  catalog_id
  event_id
  event_year
  exposure_id
  fips
  utility_id
  trigger_threshold_hours
  payout_amount
  triggered
  gross_loss
  net_loss

year_loss_table
  catalog_id
  simulated_year
  gross_loss
  net_loss
  max_event_loss
  event_count
  triggered_exposure_count
```

## Model Trust Checklist

Before trusting a vendor or internal event catalog for portfolio aggregation,
ask:

1. Does every event have an event ID?
2. Does the footprint have a coherent spatial intensity field?
3. Are event rates and simulated years documented?
4. Are seasonal cycles and regional clustering preserved?
5. Does the catalog support event loss tables and year loss tables?
6. Can we inspect known historical event replays?
7. Can we compare AAL, OEP, and AEP against independent evidence?
8. Are uncertainty, vulnerability, and financial assumptions separated?
9. Are model versions documented enough to reproduce results?
10. Does the model answer our decision goal, or only produce attractive maps?

## How This Changes Our Outage Roadmap

Near term:

```text
keep empirical county pricing as baseline
improve location-basis discussion
add event density and credibility layers
build enriched outage datasets
```

Next modeling layer:

```text
group county outage rows into regional events
tag causes and regimes where possible
measure co-trigger structure across counties
build historical portfolio replay
```

Later portfolio layer:

```text
add exposure import
build ELT and YLT outputs
create EP curves
test concentration by state, county, utility, trigger threshold, and catalog
decide whether a separate `portfolio_risk_engine` repo is justified
```

## References Checked

- Moody's catastrophe modeling overview:
  https://www.moodys.com/web/en/us/capabilities/catastrophe-modeling.html
- Moody's RMS model overview:
  https://developer.rms.com/platform/docs/models
- Verisk Catalog Viewer documentation:
  https://docs.risksolutions.verisk.com/CatalogViewer/catg-viewer/catg-viewer_intro.html
- Verisk wildfire climate projections technical guide, catastrophe model section:
  https://docs.risksolutions.verisk.com/ModelDescriptions/wf-us-climateChange/climate-projections_us-wf/climate-projections-us-wf_intro_catastrophe-models.html
