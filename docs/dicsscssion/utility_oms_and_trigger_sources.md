# Utility OMS And Trigger Source Discussion

Date: 2026-05-18

## Question

Do utilities already provide location-specific outage data through OMS, AMI, or
public outage-map systems, and should that be our trigger source?

## Short Answer

Utilities have the best raw outage truth internally, but that does not make
utility data the best practical trigger source for a national SMB parametric
insurance product.

The distinction is:

```text
Best raw truth: utility OMS / AMI
Best scalable commercial trigger today: Ting-style sensor oracle
Best historical pricing source: EAGLE-I
Best utility-map fallback/comparison source: PowerOutage.us enterprise
```

## What Utilities Actually Have

Utilities often know outage status at a very granular level through:

- OMS: outage management systems.
- AMI: smart meters and last-gasp meter signals.
- SCADA / distribution automation.
- Crew, restoration, circuit, transformer, and ETR systems.

In principle, this is close to the ideal outage trigger because it can identify
whether power was out at or near a specific service location.

## Why Public Utility OMS Feeds Are Different

Public utility outage maps are usually built for public communication, not for
third-party insurance payout determination.

They often expose:

- affected-customer counts
- approximate outage points or polygons
- city, ZIP, county, borough, or circuit summaries
- estimated restoration times
- cause or crew status when available

They usually do not expose:

- exact insured-premise outage status
- a legally reliable historical archive
- stable schemas across utilities
- commercial permission for payout use
- service-level agreements
- indemnity or audit obligations
- consistent event-stitching rules

So the statement "utilities provide location-specific data" is true internally,
but not automatically true as a usable commercial trigger source.

## Where Utility OMS Has Real Scope

### 1. Single-utility or single-state pilot

If we partner with one utility, OMS or AMI could be excellent. A product inside
one utility service territory could be much cleaner than a national product.

Potential strengths:

- direct restoration/onset records
- better location specificity
- lower basis risk
- clearer operating territory

Main limitation:

- not scalable nationally without repeating the partnership many times.

### 2. Utility-affinity distribution

If the utility is also a distribution partner, then customer-authorized data,
utility operational data, or AMI signals become more realistic.

This could support a product sold through or with the utility, especially for
larger commercial customers or selected territories.

### 3. Validation and enrichment

Direct utility data could be very useful even if it is not the main trigger.

Uses:

- validate EAGLE-I event construction
- compare Ting or PowerOutage.us trigger detections
- understand outage cause and restoration behavior
- enrich county-level risk with utility-level reliability context
- improve forward-looking model features

## Where Utility OMS Breaks For A National SMB Product

For a national SMB product, direct utility OMS is hard because:

- there are many utilities and service territories
- each utility has different systems and outage-map vendors
- public endpoints can change without notice
- schemas and spatial precision differ materially
- historical data is usually not publicly accessible
- public maps are not designed as audit-grade trigger records
- premise-level data raises privacy and critical infrastructure concerns
- commercial insurance use would require negotiated agreements
- SLA, indemnity, retention, and methodology-change terms are not standard

This is why building directly on utility OMS would likely slow us down unless
we first pick a narrow utility-backed pilot market.

## Practical Recommendation

For the product we are currently exploring:

1. Keep EAGLE-I as the historical pricing and backtesting source.
2. Treat Ting Insights or a similar sensor-network oracle as the likely primary
   live trigger candidate.
3. Treat PowerOutage.us enterprise as a licensed fallback, verifier, or
   comparison source.
4. Use utility OMS/AMI data opportunistically for pilots, validation, and
   enrichment.
5. Do not rely on informal public utility endpoints for insurance payouts.

## Modeling Implications

This affects our model design directly.

We should keep separate:

- `pricing_catalog`: EAGLE-I historical events.
- `trigger_catalog`: the live payout event definition from Ting, PowerOutage.us,
  utility OMS, or another oracle.
- `bridge_catalog`: overlap analysis comparing pricing events to trigger events.

The bridge matters because a county-level EAGLE-I event does not always mean a
specific SMB location lost power. A sensor or utility trigger can be more local,
so `lambda(T)` from EAGLE-I may need an alignment factor before it becomes a
payout frequency.

Example:

```text
lambda_trigger(fips, T)
  = lambda_eaglei(fips, T) * alignment_factor(fips, T)
```

That alignment factor should be measured from overlapping data, not guessed.

## Product Implications

A county can be good for historical pricing but still weak for live product
eligibility if the trigger source has poor coverage or weak auditability.

Future modelability should eventually include:

- historical outage data quality
- trigger oracle coverage
- trigger basis risk
- auditability
- commercial license readiness
- fallback availability
- regulatory defensibility

This is separate from the current Green/Amber/Red data-centric tiering.

## Source Links

### EAGLE-I and historical outage data

- EAGLE-I dataset descriptor, Nature Scientific Data:
  https://www.nature.com/articles/s41597-024-03095-5
- ORNL OpenEnergy Hub, EAGLE-I historic outages 2014-2025:
  https://openenergyhub.ornl.gov/explore/dataset/eaglei_outages_2014/
- ORNL EAGLE-I project context:
  https://www.ornl.gov/project/geospatial-data-sets

### Utility OMS public endpoint examples

- ODS utility scraper documentation covering PG&E, Duke, SCE, Con Edison, and
  FPL examples:
  https://ods-docs.pages.dev/data-sources/utilities/

### Customer-authorized utility data

- DOE Green Button overview:
  https://www.energy.gov/data/green-button
- Green Button Connect My Data standard:
  https://www.greenbuttonalliance.org/green-button-connect-my-data-cmd

### Sensor-network trigger candidate

- Consolidated competitive landscape reference:
  [`docs/methodology/competitive_landscape.md`](../methodology/competitive_landscape.md)
- Whisker Labs Ting Insights:
  https://www.whiskerlabs.com/ting-insights/
- Whisker Labs technology overview:
  https://www.whiskerlabs.com/our-technology/
- Tokio Marine HCC and Adaptive Insurance GridProtect announcement:
  https://www.tmhcc.com/en-us/news-and-articles/company-news/adaptive-insurance-and-tokio-marine-hcc-partner-to-tackle-150bn-power-outage-losses

### PowerOutage.us / PowerOutage.com

- PowerOutage.us Terms of Use:
  https://poweroutage.us/legal/termsofuse
- PowerOutage.com commercial products:
  https://poweroutage.com/products
- PowerOutage.us About:
  https://poweroutage.us/about

### Enrichment and forward-looking sources

- EIA-861 detailed data files:
  https://www.eia.gov/electricity/data/eia861/
- EIA reliability metrics table:
  https://www.eia.gov/electricity/annual/table.php?t=epa_11_01
- NOAA Storm Events Database:
  https://www.ncei.noaa.gov/stormevents/
- NOAA Storm Events bulk CSV access:
  https://www.ncei.noaa.gov/stormevents/ftp.jsp

## Preserved View

My current view is that direct utility OMS/AMI is the best technical truth but
not the best first national trigger architecture. It is best pursued later as a
pilot or enrichment layer unless we have a specific utility partner. For the
current project, the better path is EAGLE-I for pricing, a sensor-network oracle
for live triggers, PowerOutage.us enterprise as fallback/comparison, and a
measured bridge between historical pricing events and live trigger events.
