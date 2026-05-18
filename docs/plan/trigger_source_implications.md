# Trigger Source Implications

Date: 2026-05-18

Source reviewed:
`docs/extra/outage_modeling_us/docs/trigger_sources_research.md`

## Executive Read

The research changes how we should think about the product architecture.
EAGLE-I is still the right backbone for historical pricing and backtesting, but
it should not be treated as the production payout oracle. A live parametric
product needs a contractual trigger source with licensing, audit records, uptime
expectations, and a fallback path.

The working architecture should therefore split the product into three layers:

1. Pricing event catalog: our EAGLE-I-derived county event catalogs.
2. Trigger event catalog: the event definition used by a live oracle such as
   Ting Insights or a licensed PowerOutage.us feed.
3. Bridge calibration: a measured adjustment between the two catalogs, so the
   premium is based on the event frequency we will actually pay against.

## Main Learnings

### 1. Pricing data and trigger data are different jobs

EAGLE-I gives us a long county-level historical record. That is valuable for
estimating empirical event rates, survival curves, modelability tiers, and
county-level pricing. It is weaker as a contractual trigger because it is a
historical public dataset, not a live commercial service with policy-grade
obligations.

Implication: keep EAGLE-I in the current engine, but stop describing it as the
future production oracle. The product should say, in effect: "we price from the
long historical outage archive, then calibrate to the live trigger source."

### 2. The best trigger candidate appears to be a sensor-network oracle

The trigger-source file argues for Whisker Labs Ting Insights as the primary
candidate. Current public material supports the broad direction: Whisker
describes Ting Insights as a real-time, hyper-local outage and grid-intelligence
network with more than one million sensors and broad proximity coverage, and it
also says Adaptive Insurance uses Ting outage and restoration data for its
GridProtect parametric product.

Implication: if we pursue an SMB parametric product, the most important vendor
question is not just "can we get the data?" It is whether we can get a contract
that allows insurance payout use, historical calibration extracts, audit logs,
methodology-change notice, and service-level commitments.

### 3. PowerOutage.us is useful, but likely as backup or calibration

PowerOutage.us/PowerOutage.com exposes commercial outage products, including
live API access, CSV reporting, and historical data partially back to 2016. Its
public website terms restrict ordinary use to noncommercial use unless a
separate written/commercial agreement exists.

Implication: do not scrape or casually ingest it for product use. If it becomes
part of the model, it needs a formal license and a precise event-construction
agreement. It is a good candidate for backup oracle, comparison data, or
coverage validation, but county/city granularity still creates basis risk for
SMB locations.

### 4. Our 30/45/60 minute catalogs become product assumptions

The catalog sensitivity work we already added is directly relevant. A live
oracle will also need rules for temporary restoration, missing samples, and
brief gaps. If pricing uses one stitching rule and the trigger uses another, the
frequency of paid events can drift from the priced frequency.

Implication: the catalog switcher is not just an internal dashboard feature. It
is a way to expose event-definition sensitivity. Before a filing or capacity
conversation, we should be able to show how premiums and modelability tiers
change under 30, 45, and 60 minute gap-merge assumptions.

### 5. Current Green/Amber/Red tiers need more dimensions

Our current modelability tiers are mostly data-centric and state/county-centric.
That is correct for the historical v0 baseline, but it is incomplete for an
insurance product.

Additional trigger-readiness dimensions should be added later:

- Trigger oracle coverage: whether the target location has enough live oracle
  coverage.
- Trigger basis risk: how well the oracle signal maps to the insured address,
  not just the county.
- Trigger auditability: whether raw trigger records can be retained and reviewed.
- Commercial license readiness: whether the data can legally determine payouts.
- Fallback readiness: whether a backup oracle exists for the location.
- Regulatory defensibility: whether the event source and methodology can be
  explained cleanly in policy forms and filings.

These should be visually distinct from the current v0 tiers. A gray or separate
"not modeled yet" state is appropriate until we have vendor data.

## Modeling Implications

### Separate catalogs

Add a formal distinction in code and docs:

- `pricing_catalog`: EAGLE-I event catalog used to estimate `lambda(T)`,
  survival, durations, tiers, and premiums.
- `trigger_catalog`: oracle-specific event catalog used to simulate or define
  payout triggers.
- `bridge_catalog`: overlap dataset comparing pricing events and trigger events
  over the same time, geography, and thresholds.

The current `eagle-i-30min`, `eagle-i-45min`, and `eagle-i-60min` catalogs are
pricing catalogs.

### Bridge factor

The key missing quantity is an alignment factor:

```text
lambda_trigger(fips, T) = lambda_eaglei(fips, T) * alignment_factor(fips, T)
```

The alignment factor should be estimated from overlapping data, not guessed.
Possible dimensions:

- county FIPS
- state or FEMA region when county data is too thin
- threshold duration `T`
- season or storm regime
- urban/rural density
- utility service territory
- trigger oracle coverage density

The factor could be above or below 1. County-level EAGLE-I can overstate
address-level triggers because a partial-county outage may miss a specific SMB.
But sensor networks can also detect localized events below a county-level public
OMS signal.

### Event schema extensions

Any future trigger/bridge catalog should carry explicit fields for:

- `event_source`
- `source_cadence_minutes`
- `source_timezone`
- `spatial_unit`
- `spatial_resolution`
- `gap_merge_minutes`
- `minimum_duration_minutes`
- `outage_threshold_definition`
- `coverage_score`
- `is_trigger_eligible`
- `trigger_unavailable_reason`
- `created_from_raw_version`

This is also where we should keep the timestamp discipline already documented in
`price_engine/data/SCHEMA.md`: event timestamps are UTC and durations are
computed from UTC instants.

## Product Implications

- A county can be Green for historical pricing and still not be eligible for a
  live product if trigger coverage is weak.
- White/no-data areas on the map should eventually distinguish between no
  historical EAGLE-I data, insufficient pricing credibility, and insufficient
  trigger-oracle coverage.
- The dashboard should eventually allow users to compare:
  - pricing catalog: 30, 45, 60 minute EAGLE-I assumptions
  - trigger-readiness layer: unknown, ready, weak, unavailable
  - bridge-adjusted premium: once vendor calibration data exists
- The current `$0` uncertainty-load stub should not be confused with trigger
  basis risk. Trigger basis risk is a separate adjustment or eligibility gate.

## Immediate Plan

1. Keep EAGLE-I as the baseline pricing catalog.
2. Add planning docs and schema placeholders for trigger catalogs, but do not
   implement an external comparator yet.
3. Build the enriched event dataset first, because it will support both trigger
   calibration and forward-looking pricing.
4. Create a vendor data request checklist for Ting Insights and PowerOutage.us
   when we are ready to engage.
5. Later, build a bridge-validation lab that can ingest a vendor extract and
   compare it to our EAGLE-I catalogs.

## Vendor Data Questions

- Can the vendor provide historical outage detections by time and county/FIPS?
- Can the vendor provide location-level coverage scores without exposing
  sensitive sensor records?
- Can records be retained for audit for the full policy period plus dispute
  window?
- Are planned outages, public-safety shutoffs, and missing data explicitly
  identified?
- Does the commercial agreement allow use as a named parametric trigger source?
- What happens if the primary feed is unavailable during a major event?

## References Checked

- Whisker Labs Ting Insights:
  https://www.whiskerlabs.com/ting-insights/
- Tokio Marine HCC and Adaptive Insurance GridProtect announcement:
  https://www.tmhcc.com/en-us/news-and-articles/company-news/adaptive-insurance-and-tokio-marine-hcc-partner-to-tackle-150bn-power-outage-losses
- PowerOutage.us Terms of Use:
  https://poweroutage.us/legal/termsofuse
- PowerOutage.com Products:
  https://poweroutage.com/products
- ORNL OpenEnergy Hub EAGLE-I 2014-2025:
  https://openenergyhub.ornl.gov/explore/dataset/eaglei_outages_2014/
- Nature Scientific Data EAGLE-I dataset descriptor:
  https://www.nature.com/articles/s41597-024-03095-5
