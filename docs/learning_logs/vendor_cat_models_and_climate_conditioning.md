# Vendor Cat Models And Climate Conditioning

Date: 2026-05-20

## Why This Note Exists

We need to understand whether RMS, Verisk, Aon, CoreLogic/Cotality, KatRisk,
and similar catastrophe-model vendors adjust modeled risk for ongoing climate
and weather changes.

The short answer:

```text
Yes, many vendors have ways to adjust or condition selected catastrophe models
for current or future climate.

No, we should not assume every peril/model/product is climate-adjusted in the
same way, or that public documentation reveals enough detail to treat the
outputs as transparent event catalogs.
```

This matters because our architecture separates:

```text
historical catalog
stochastic / synthetic event set
forward-looking adjustment
forward-looking stochastic catalog
```

Vendor models may combine these layers internally. For our own modeling, we
should keep them separate.

## The Core Modeling Question

If a base stochastic catalog represents current climate risk, how do we move it
to a future or changing-climate view?

Possible mechanisms:

```text
1. Reweight events.
2. Resample catalog years.
3. Adjust event rates.
4. Adjust event severity/intensity.
5. Adjust event footprints or tracks.
6. Regenerate events from climate-conditioned hazard models.
7. Adjust vulnerability or exposure separately.
```

These are not equivalent.

```text
rate adjustment
  -> more/fewer events, same event shapes

severity adjustment
  -> same events, stronger/weaker intensity fields

footprint adjustment
  -> different spatial extent or track behavior

resampling
  -> different set of catalog years/events, preserving event mechanics

full regeneration
  -> new event set under new climate assumptions
```

The right method depends on the peril and the scientific evidence.

## What Public Vendor Documentation Shows

### Moody's RMS

Public RMS documentation shows climate-related functionality in multiple forms.

RMS Risk Modeler has a climate-change calculation operation that recalculates
AAL and EP metrics for portfolio and treaty results. The documentation says RMS
Climate Change Models provide probabilistic views across RCP scenarios for
North Atlantic hurricanes and Europe windstorms/floods, and SSP/RCP-style
scenarios for North America wildfire. It also notes that these are licensed
extensions to base reference models.

RMS Climate on Demand is a separate API/product family for physical climate
risk. Public documentation says it supports hazard scoring and financial impact
modeling for real assets across risk categories such as floods, heat stress,
hurricanes/typhoons, sea level rise, water stress, and wildfires. It returns
outputs such as annualized damage rates, damage volatility, average annual
damage, and impact scores for eligible products.

RMS HD model documentation also makes clear that many models are simulation
based and can represent event hazard, damage, loss propagation, clustering,
duration, and seasonality. That is the right structure for climate conditioning,
but the public docs do not expose every internal climate adjustment mechanism.

What we can infer:

```text
RMS architecture supports climate-conditioned views for selected perils.
The API can recalculate portfolio AAL/EP metrics under scenarios.
Climate conditioning is product/peril/license dependent.
The internal event-level mechanics are not fully public.
```

### Verisk

Verisk public documentation is unusually explicit for U.S. wildfire.

The Verisk wildfire climate-projection technical guide says the current
Wildfire Model is event-based and uses stochastic catalogs. It describes 10,000,
50,000, and 100,000-year catalogs for current-climate annual wildfire activity.
It then describes climate projections as conditioning the existing wildfire
model to future climates of interest.

For the wildfire climate projections, Verisk partitions the model domain into
EPA level III ecoregions, builds relationships between climate variables and
wildfire burned area, uses variables such as vapor pressure deficit and
precipitation, uses CMIP6 output under SSP/RCP scenarios, and creates
climate-adjusted catalogs by resampling events from the existing 10K catalog.

Verisk also states in Touchstone Re documentation that model updates address
climate change where research finds clear relationships between perils, such as
flooding or fire activity, and climate change.

Important limitations from Verisk's own wildfire projection docs:

```text
future loss projections use present-day exposure and vulnerability
county-level changes can reflect the sampling algorithm in low-exposure areas
some event/loss changes are stochastic artifacts rather than clean climate signals
```

What we can infer:

```text
Verisk can climate-condition at least some models through model updates and
specific climate-projection products.

For U.S. wildfire, one documented method is scenario/ecoregion-based catalog
resampling, not necessarily full event regeneration.

Exposure and vulnerability changes may be held fixed in some climate
projections, so hazard change is not the same as total future risk change.
```

### Aon Impact Forecasting

Aon public materials describe Impact Forecasting as a catastrophe model
developer with probabilistic and scenario models across many perils and
territories. Public pages also describe catastrophe model, automated event
response, hazard/risk data, and climate risk advisory capabilities.

For U.S. hurricane, Aon announced an updated model with an "adjusted-rate" view
that incorporates scientific research and reflects shifts in tropical cyclone
occurrence between the historical reference view and a 2030-2050 timeframe.

What we can infer:

```text
Aon supports climate-informed views in at least some models.
For the cited hurricane case, the public mechanism is rate adjustment.
The details of the full event-set adjustment are not public in the materials
checked here.
```

### CoreLogic / Cotality

CoreLogic announced Climate Risk Analytics designed to measure and model
physical risks through 2050. Public launch material says its models include
large volumes of scientific and climate simulations across current and future
climate conditions and multiple perils, including hurricane, storm surge, flood,
severe convective storms, winter storms, wildfire, tsunami, earthquakes, and
fire following.

CoreLogic/Cotality also markets a large catastrophe-model suite and climate risk
analytics products.

What we can infer:

```text
CoreLogic/Cotality has future-climate physical risk products through 2050.
Public product material suggests current and future climate simulations.
The public material does not provide enough event-catalog mechanics to audit
how each peril is adjusted.
```

### KatRisk

KatRisk public materials describe hazard data covering inland flood, tropical
cyclone wind, storm surge, severe convective storm, wildfire, and earthquake,
with return-period hazard values and risk scores. Public pages state that
climate change data layers help users understand future risk change.

KatRisk also states that some probabilistic models use long synthetic track
sets, such as 50,000 years for tropical-cyclone wind/storm-surge/flood-related
models, and that its model suite is built with climate change considerations
and climate variability enabled.

What we can infer:

```text
KatRisk offers climate-change data layers and climate-aware model products.
The public material gives product-level capability, not enough detail to
independently audit the event adjustment method for every peril.
```

## What They Do

Based on public documentation, vendors may:

```text
build current-climate stochastic event catalogs
update models as observed/current climate evidence changes
condition catalogs to future scenarios
recalculate AAL and EP metrics under climate scenarios
provide hazard scores and financial impact metrics
offer adjusted-rate views for selected perils
resample or reweight catalog events under climate scenarios
use climate variables such as VPD, precipitation, sea surface temperature,
storm environment, or climate model output
keep exposure/vulnerability fixed in some future-hazard projections
```

This confirms the broad architecture is valid:

```text
base stochastic catalog
        |
        v
climate conditioning / scenario adjustment
        |
        v
climate-conditioned stochastic catalog or adjusted loss metrics
```

## What They May Not Do

Do not assume:

```text
every model is climate-conditioned
every peril has the same quality of climate signal
the public AAL/score output includes event-level catalog access
the future projection changes exposure, vulnerability, mitigation, or adaptation
the method regenerates completely new physics-based events
the method captures secondary hazards or infrastructure interdependencies
the method is transparent enough for us to reproduce
the scenario view is appropriate for one-year insurance pricing
```

The most important distinction:

```text
hazard climate adjustment != future loss adjustment
```

Future total loss may change because of:

```text
hazard frequency
hazard severity
hazard footprint
event clustering
exposure growth
asset vulnerability
mitigation/adaptation
inflation and replacement cost
insurance terms
```

If a vendor holds exposure and vulnerability fixed, the result is closer to:

```text
future hazard impact on today's portfolio
```

not:

```text
full economic loss in a changed future world
```

Both are useful, but they answer different questions.

## What We Do Not Know From Public Docs

For most commercial models, public material does not fully reveal:

```text
full event-generation algorithms
whether climate-conditioned catalogs are reweighted, resampled, adjusted, or regenerated
how event clustering and spatial dependence change under scenarios
how secondary hazards are modeled
how vulnerability changes, if at all
how adaptation and mitigation are represented
how uncertainty across climate models is propagated into loss
how much validation is hindcast versus expert judgment
whether event-level YELT/ELT data is available to users for the climate-conditioned view
```

So the right posture is:

```text
use vendor products as strong references and benchmarks
do not treat them as self-explaining truth
document exactly which layer they provide
```

## The Right Architecture For Us

Our architecture should keep the layers separate even if vendor products bundle
them together.

```text
HARMONIZED HISTORICAL CATALOG
observed/reconstructed events
        |
        v
BASE STOCHASTIC CATALOG
current-climate plausible event space
        |
        v
CLIMATE / WEATHER CONDITIONING LAYER
scenario, horizon, driver variables, adjustment logic, uncertainty
        |
        v
CLIMATE-CONDITIONED STOCHASTIC CATALOG
same schema, new rates/weights/severities/footprints/years
        |
        v
RISK MODEL
exposure + vulnerability + financial terms + portfolio aggregation
```

The conditioning layer should explicitly say what it changes:

| Adjustment target | Example |
|---|---|
| event rate | more/fewer events per year |
| intensity | larger hail size, stronger wind, greater flood depth |
| footprint | larger burned area, broader flood extent |
| track/location | storm tracks shift, fire regions shift |
| seasonality | event season length changes |
| clustering | more multi-event years or compound-event years |
| dependence | changed co-occurrence across regions/perils |
| vulnerability | asset response changes due to hardening or degradation |
| exposure | portfolio growth, relocation, land-use change |

For modeling discipline, separate hazard adjustment from non-hazard adjustment:

```text
hazard adjustment:
    frequency, intensity, footprint, seasonality, clustering

exposure adjustment:
    where assets are, what they are worth, what is insured

vulnerability adjustment:
    how assets respond, mitigation, degradation, hardening

financial adjustment:
    deductibles, limits, terms, inflation, payout structure
```

Do not put all of that inside one "climate factor."

## Practical Decision Rules

Use this when evaluating a vendor or our own future model.

| Question | Good answer | Weak answer |
|---|---|---|
| What climate variable drives the adjustment? | specific peril-relevant driver | generic climate uplift |
| What layer changes? | rate, severity, footprint, clustering, vulnerability, etc. | unclear |
| Is the base catalog preserved? | yes, versioned separately | no distinction |
| Is the climate scenario explicit? | SSP/RCP/horizon listed | "future climate" only |
| Are event IDs/YELT available? | yes, portfolio replay possible | only location score/AAL |
| Are exposure and vulnerability held fixed? | explicitly stated | unclear |
| Is uncertainty shown? | scenario/model spread, confidence | single number |
| Is hindcast validation possible? | yes | no |
| Are secondary hazards included? | explicit treatment | ignored or implied |

## My View

Vendor models are moving in the right direction: climate-conditioned catalogs,
scenario analysis, adjusted rates, future hazard scores, and climate risk
analytics are all real product patterns.

But the right internal stance is cautious:

```text
accept that vendor models can provide useful climate-conditioned views
do not assume they solve all non-stationarity
do not assume the same method applies to all perils
do not collapse hazard, exposure, vulnerability, and financial changes
```

For our work, the best design is:

```text
1. Build the clean historical catalog.
2. Build or borrow a base stochastic catalog.
3. Add a transparent conditioning layer by peril.
4. Keep scenario, horizon, and driver assumptions explicit.
5. Compare against vendor outputs where possible.
6. Show uncertainty rather than one false-precise future number.
```

The core learning:

```text
Climate adjustment is not a final multiplier.
It is a layer in the event-catalog architecture.
```

## References

- Moody's RMS Risk Modeler climate-change calculation:
  https://developer.rms.com/risk-modeler/reference/runclimatechangev2
- Moody's RMS Climate on Demand overview:
  https://developer.rms.com/climate-on-demand/docs/introduction-to-climate-on-demand
- Moody's RMS HD model overview:
  https://developer.rms.com/platform/docs/hd-models
- Verisk Touchstone Re climate-change note:
  https://docs.risksolutions.verisk.com/TouchstoneRe/12.0/ts-tsre_all/help_ts-tsre_model_climate-change.html
- Verisk U.S. wildfire climate projections summary:
  https://docs.risksolutions.verisk.com/ModelDescriptions/wf-us-climateChange/climate-projections_us-wf/climate-projections-us-wf_summary.html
- Verisk U.S. wildfire climate projections, catastrophe model section:
  https://docs.risksolutions.verisk.com/ModelDescriptions/wf-us-climateChange/climate-projections_us-wf/climate-projections-us-wf_intro_catastrophe-models.html
- Verisk U.S. wildfire future loss projections:
  https://docs.risksolutions.verisk.com/ModelDescriptions/wf-us-climateChange/climate-projections_us-wf/climate-projections-us-wf_results_future-loss-proj.html
- Aon Impact Forecasting overview:
  https://www.aon.com/reinsurance/impact-forecasting/default.jsp
- Aon U.S. hurricane model climate-adjusted-rate announcement:
  https://aon.mediaroom.com/2024-08-14-Cutting-Edge-Climate-Research-Integral-to-Aons-Latest-U-S-Hurricane-Catastrophe-Model
- CoreLogic Climate Risk Analytics launch:
  https://www.businesswire.com/news/home/20221212005090/en/CoreLogic-Launches-Climate-Risk-Analytics-to-Model-and-Predict-Property-Risk-Through-2050
- KatRisk hazard data overview:
  https://www.katrisk.com/hazard-data/
- KatRisk catastrophe risk modeling overview:
  https://www.katrisk.com/
