# Source Note: NOAA Storm Events

Status: candidate Phase 1 source

## Role

NOAA Storm Events is the first weather-cause enrichment source for outage
events.

Proposed role:

```text
EAGLE-I outage event -> temporal/geographic overlap -> weather hazard context
```

This source should support weather tags such as thunderstorm wind, hurricane,
flood, winter storm, tornado, hail, lightning, and other storm-event classes.

## Why It Matters

The v0 price engine knows that an outage happened and how long it lasted. It
does not know why it happened.

NOAA Storm Events can help answer:

- Was a storm reported in the same county and time window?
- What event type was reported?
- Was this a named or severe event?
- Are long-duration outages disproportionately storm-associated?

## Expected Grain

Source grain is storm-event record, not outage event.

Expected fields to preserve where available:

- event ID / episode ID;
- state;
- county or zone;
- begin/end date and time;
- event type;
- magnitude fields where relevant;
- property/crop damage fields;
- narrative or episode narrative if usable;
- source publication year.

## Proposed Join

First prototype:

```text
same state/county
AND NOAA event window overlaps the outage-onset window
```

Start with:

```text
buffer_before = 6 hours
buffer_after  = 12 hours
```

The current pilot anchors the window to outage start, not the full outage
duration. This avoids assigning a weather record as the cause only because it
happened somewhere inside a multi-day or multi-week outage interval.

NOAA `BEGIN_DATE_TIME` and `END_DATE_TIME` are parsed as local-standard source
times and converted to timezone-naive UTC using the `CZ_TIMEZONE` offset.

These are prototype values only. The final buffers should be decided after
manual review.

## Caveats

- NOAA reports weather events, not power outages.
- A temporal/geographic overlap is evidence, not proof of cause.
- Event reporting consistency can vary by state, office, year, and event type.
- Zone-level records may not map cleanly to county FIPS.
- Some outage-causing weather will be missing or under-described.

## First Decision Needed

Should Phase 1 keep all NOAA matches in `event_cause_matches.parquet` and only
derive a best-label field later?

Recommendation: yes. Preserve all matches first.

## Official Links

- NOAA Storm Events Database:
  https://www.ncei.noaa.gov/stormevents/
- NOAA Storm Events bulk CSV format:
  https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/Storm-Data-Bulk-csv-Format.pdf
