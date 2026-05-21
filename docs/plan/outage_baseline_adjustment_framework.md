# Outage Baseline Adjustment Framework

Date: 2026-05-21

## Status

Planning note. Do not change `price_engine/` pricing from this file yet.

This document consolidates the adjustment ideas that are currently split across:

- `docs/plan/forward_looking_modeling_plan.md`
- `docs/dicsscssion/location_aware_outage_pricing/`
- `price_engine/plan/04_confidence_load_stub.md`
- `curated_outage_data/plan/03_phase_forward_modeling_support.md`

## Goal

Keep v0 as the clean historical baseline, then define which overlays can adjust
that baseline later.

Current v0:

```text
lambda_historical(fips, T)
  = count(EAGLE-I county events with duration >= T) / source observation years
```

Possible future view:

```text
lambda_adjusted(location, T, horizon)
  = lambda_historical(fips, T)
    * credibility_modifier(fips, T)
    * regime_modifier(fips, T)
    * grid_condition_modifier(location or fips, horizon)
    * hazard_weather_modifier(location or fips, horizon)
    * location_basis_modifier(location, fips)
    * trigger_alignment_modifier(trigger_source, location, T)
```

This is a planning decomposition, not final production math.

## Core Rule

Every modifier starts as one of:

```text
1.0          validated neutral value
not_used     not yet implemented
unavailable  product should not quote until evidence exists
gate_only    eligibility flag, not a numeric multiplier
```

Do not invent numeric discounts or uplifts just because the direction feels
right.

## Adjustment Layers

| Layer | What it asks | First status |
|---|---|---|
| credibility | Do we trust this county's empirical rate? | v0.5 uncertainty load / credibility blend |
| regime | Is the historical average dominated by specific years or event regimes? | lab/notebook analysis first |
| grid condition | Is the serving grid stronger or weaker than county history implies? | curated utility/grid features |
| hazard/weather | Is weather-driven outage risk elevated or changing? | forward model / scenario layer |
| location basis | Is this premise materially different from county average? | separate location-aware design |
| trigger alignment | Does EAGLE-I county event behavior match the payout oracle? | requires overlap validation |
| commercial viability | Does the resulting premium make sense versus alternatives? | product/underwriting filter |

## Granularity Loopholes

The most important loophole is:

```text
county outage event != premise outage event
```

County-level history can overstate a resilient downtown premise and understate a
weak feeder, rural edge, or exposed service area.

Granularity issues to document before changing prices:

| Issue | Why it matters |
|---|---|
| county-to-location basis risk | customer may not share county average outage experience |
| utility service territory mismatch | county can contain multiple utilities and grid conditions |
| feeder/circuit heterogeneity | local reliability can differ sharply inside one county |
| outage-source mismatch | EAGLE-I event may not match OMS/sensor/public-map trigger event |
| event-definition mismatch | 30/45/60 minute stitching changes event count and duration |
| data-quality heterogeneity | EAGLE-I coverage, DQI, and reporting gaps vary by region |

## What We Should Build First

1. Keep historical v0 unchanged.
2. Build adjustment features in `curated_outage_data/`.
3. Backtest each modifier as a challenger, not as a pricing change.
4. Report each adjustment as lift/discount from v0.
5. Cap or gate modifiers until validation is strong.
6. Only move a modifier into pricing after it has a model card and rollback
   path.

## Resource Backlog For Adjustment Work

These sources are worth saving now. Later, when transcripts/slides/papers are
available, extract the method details into feature ideas, validation rules, and
modeling constraints.

| Resource | Why it is useful for us | How to use later |
|---|---|---|
| WISER North American Forecasting Model webinar | Directly aligned with weather, outage, load, and damage forecasting; useful strategic reference | get transcript/slides, extract architecture, data sources, phases, validation language |
| WISER North American Forecasting Model project page | Mentions CONUS + Quebec scope, proprietary/public data, EAGLE-I, HRRR, CONUS404, outage/damage/load modules | compare with our architecture and curated-data roadmap |
| UConn/Eversource Predicting Outages | Operational OPM reference with high-resolution weather, vegetation, geographic data, up-to-three-day view, six-hour updates | extract operational lead times, data families, location-basis features |
| UConn/Eversource OPM and emergency response page | Discusses many storm simulations, geographic/electrical attributes, restoration and emergency response use | separate outage occurrence, damage, and restoration modeling |
| Dynamic thunderstorm outage prediction paper | Good example of event dynamics and hourly outage modeling instead of only event-total counts | use for regime/time-dynamics design |
| Lead-time weather forecast uncertainty paper | Shows how forecast uncertainty propagates into outage prediction and why 1-3 day vs 4-5 day horizons differ | use for uncertainty bands and forecast-horizon governance |
| ORNL EAGLE-I + NWS outage prediction paper | Directly relevant because it combines EAGLE-I with NWS weather alert datasets | use as state-level public-data baseline reference |
| ORNL RePOWERD restoration paper | Focuses restoration rate and estimated restoration time after severe-weather outages | keep separate from outage occurrence pricing; useful for duration/restoration layer |
| HRRR public archive | Operational 3-km, hourly, radar-assimilating weather model | possible weather forecast/history feature source |
| CONUS404 and CONUS404 PGW | High-resolution historical hydroclimate and future-perturbed weather/climate dataset | possible historical weather baseline and climate-adjustment scenario source |

## Transcript Extraction Template

When we process a webinar or paper, extract:

```text
source title
source type
hazard/peril scope
geography
forecast horizon
target variable
input data families
spatial grain
temporal grain
model family
validation metric
operational decision supported
known limitations
ideas for our adjustment framework
```

The output should not be a generic summary. It should answer:

```text
Which modifier does this improve?
What data would we need?
What failure mode does it address?
What would prove it beats v0?
```

## Similar Sources To Mine First

### WISER / UConn / Eversource

- WISER IUCRC webinar:
  https://wiser-iucrc.com/north-american-forecasting-model-webinar
- WISER project page:
  https://wiser-iucrc.com/north-american-forecasting-model-outage-damage-and-load
- UConn/Eversource Predicting Outages:
  https://www.eversource.uconn.edu/predicting-outages/
- UConn/Eversource OPM and emergency response:
  https://www.eversource.uconn.edu/outage-prediction-modeling-and-emergency-response/
- UConn/Eversource high-resolution weather forecasting:
  https://www.eversource.uconn.edu/high-resolution-weather-forecasting/

### Papers And Research Notes

- Dynamic Modeling of Power Outages Caused by Thunderstorms:
  https://www.mdpi.com/2571-9394/2/2/151
- The Effect of Lead-Time Weather Forecast Uncertainty on Outage Prediction
  Modeling:
  https://www.mdpi.com/2571-9394/3/3/31
- Predicting Power Outage During Extreme Weather with EAGLE-I and NWS Datasets:
  https://www.ornl.gov/publication/predicting-power-outage-during-extreme-weather-eagle-i-and-nws-datasets
- RePOWERD: Restoration of Power Outage from Wide-Area Severe Weather
  Disruptions:
  https://www.ornl.gov/publication/repowerd-restoration-power-outage-wide-area-severe-weather-disruptions

### Weather And Climate Data For Adjustment Features

- NOAA HRRR public archive:
  https://registry.opendata.aws/noaa-hrrr-pds/
- CONUS404 and CONUS404 PGW:
  https://ral.ucar.edu/dataset/conus404-and-conus404-pgw

## Open Questions

- Should the first adjustment target `lambda(T)` only, or also duration
  survival `S(T)`?
- Should weather/hazard adjustment be historical-feature based first, or use
  forecast products such as HRRR immediately?
- Should location-basis adjustment be an eligibility gate until live-trigger
  overlap data exists?
- What is the minimum backtest needed before a modifier can affect pricing?
- How should we cap modifiers so they cannot create unjustified premium jumps?

## Near-Term Recommendation

Use the WISER webinar and project page as a reference bookmark now.

Next concrete modeling step:

```text
build county-year targets and features
run v0 benchmark backtest
add one challenger at a time:
  credibility -> grid condition -> hazard/weather -> trigger alignment
```

Do not jump directly from the webinar to pricing changes. Use the transcript to
improve the adjustment architecture and feature roadmap first.
