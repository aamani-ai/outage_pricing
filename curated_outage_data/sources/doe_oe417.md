# Source Note: DOE / OE-417

Status: candidate Phase 1 source

## Role

DOE / OE-417 records are candidate enrichment for major electric emergency
incidents and grid disturbances.

Proposed role:

```text
large EAGLE-I outage event -> temporal/state overlap -> major disturbance context
```

This should be treated as a high-value but sparse source. It will not explain
routine county outages.

## Why It Matters

OE-417-style records can help identify major grid events that are important for
insurance review:

- load loss;
- physical attack / cyber / operational incidents where reported;
- severe weather disturbance;
- fuel or system emergency;
- multi-state or large-customer events.

## Expected Grain

Source grain is reported disturbance incident, not county outage event.

Expected fields to preserve where available:

- event/incident ID;
- start and end dates/times;
- affected state(s);
- event type/category;
- demand/load or customer impact fields;
- report metadata;
- source publication year.

## Proposed Join

First prototype:

```text
state overlap
AND time overlap with outage event +/- buffer
AND outage duration or customers-out threshold high enough to be plausible
```

OE-417 should not be forced onto small routine events.

## Caveats

- Reporting thresholds mean many outage events will have no OE-417 match.
- Public fields may be coarse relative to county-level EAGLE-I events.
- A single OE-417 event can match many county events.
- Some records may cover broad regions rather than precise counties.

## First Decision Needed

Should OE-417 matches be treated as higher confidence than NOAA matches?

Recommendation: not automatically. Use source type plus overlap strength. A
strong NOAA county/time match can be more specific than a broad OE-417 record.

## Official Links

- DOE / OE-417 annual summaries on Open Energy Data Initiative:
  https://openenergyhub.ornl.gov/explore/dataset/oe-417-annual-summaries/map/
