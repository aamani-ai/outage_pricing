# Phase 1: Cause Attribution

Date: 2026-05-18

## Goal

Add likely cause and hazard context to EAGLE-I-derived outage events without
overclaiming causality.

The target is not a perfect forensic cause label. The target is an evidence
trail that says:

```text
This outage event overlaps with these external weather/grid disturbance records,
with this match strength, under this join rule.
```

## Why This Comes First

Cause attribution is closest to the current event catalog. It teaches the main
curated-data patterns before we touch broader utility/grid-condition features:

- event-to-event temporal joins;
- county/state geography joins;
- many-to-many source matches;
- confidence scoring;
- evidence preservation;
- "unknown / unattributed" handling.

## Candidate Sources

### NOAA Storm Events

Role:

- primary public weather-event enrichment source;
- county/zone-level storm and hazard context;
- useful for wind, hail, flood, winter storm, lightning, tornado, tropical
  cyclone, and other weather-related labels.

Initial use:

- match by state/county or zone where possible;
- match by time overlap and configurable lead/lag buffer;
- keep event type, episode ID, event ID, damage fields, magnitude fields, and
  narrative snippets where legally and practically usable.

Risks:

- not every outage-causing weather event is recorded;
- reports can be inconsistent over time and across offices;
- damage fields may be missing or noisy;
- county/zone granularity may not match EAGLE-I county events perfectly.

### DOE / OE-417

Role:

- major grid disturbance enrichment;
- useful for named/large events, load loss, system operations, cyber/physical
  security categories, fuel supply, and reliability events.

Initial use:

- match by state/county where available;
- match by event start/end overlap;
- preserve incident category and report metadata;
- use as high-confidence enrichment when overlap is strong.

Risks:

- reporting threshold means it misses most routine outages;
- public fields may be coarse or incomplete;
- many events may not map cleanly to county-level EAGLE-I events.

### PNNL Event-Correlated Outage Dataset

Role:

- external comparator for EAGLE-I event construction and OE-417 matching;
- useful validation source for major, long-duration, high-impact outages;
- published with 8-hour and 24-hour lag variants for OE-417 correlation.

Initial use:

- compare PNNL merged events against our 30/45/60 minute catalogs;
- compare PNNL OE-417 event correlations against our own matching rules;
- use differences to tune the QA report, not to silently replace our catalog.

Risks:

- PNNL's event-construction thresholds and stitching rules are external to our
  pricing engine unless we reproduce and validate them;
- DOE/OE-417 correlation naturally focuses on major reported disturbances, not
  routine county outage events;
- the public PNNL package currently covers EAGLE-I through 2023, while the
  pricing engine uses 2014-2025.

### Later Sources

- FEMA disaster declarations.
- NHC hurricane tracks and named-storm windows.
- SPC severe weather reports.
- State emergency records where available.

These should not block Phase 1.

## Matching Design

### Event-Level Join

Input:

```text
price_engine catalog events
NOAA / OE-417 external events
```

Output:

```text
event_cause_matches.parquet
```

Minimum fields:

| Field | Meaning |
|---|---|
| `catalog_id` | source EAGLE-I catalog |
| `event_id` | EAGLE-I-derived outage event |
| `fips` | outage county |
| `source` | NOAA, OE-417, FEMA, etc. |
| `source_event_id` | external source event identifier |
| `source_event_type` | storm type / incident category |
| `time_overlap_minutes` | overlap between outage and source event |
| `lead_lag_minutes` | nearest temporal gap if not overlapping |
| `geo_match_level` | county, zone, state, polygon, unknown |
| `match_score` | 0-1 match strength |
| `cause_family` | weather, grid_ops, equipment, vegetation, cyber, unknown |
| `cause_label` | more specific label when defensible |
| `confidence` | high, medium, low |
| `notes` | short caveat |

### Event Enrichment Rule

An outage event can have:

- zero matches;
- one match;
- many matches.

Do not collapse too early. Preserve the match table and derive a best-label view
separately.

## Cause Label Philosophy

Use layered labels:

```text
cause_family  -> broad category
cause_label   -> specific source-supported label
named_event   -> named storm or incident when available
confidence    -> high / medium / low
```

Examples:

| cause_family | cause_label | named_event | confidence |
|---|---|---|---|
| weather | tropical cyclone | Hurricane Irma | high |
| weather | thunderstorm wind | null | medium |
| grid_ops | load shed / system operation | null | medium |
| unknown | unattributed | null | none |

## Validation

Minimum QA before trusting labels:

```text
[ ] match rate by state and year
[ ] match rate by duration threshold T
[ ] top event types by state
[ ] unmatched long-duration events
[ ] many-to-one and one-to-many match examples
[ ] comparison against PNNL merged events for selected state-years
[ ] comparison against PNNL 8-hour and 24-hour OE-417 lag matches
[ ] manual review sample of high-confidence matches
[ ] manual review sample of unattributed long events
```

## Deliverables

1. Source notes for NOAA Storm Events, OE-417, and PNNL.
2. Draft schema for `event_cause_matches.parquet`.
3. First local join prototype for one state/year.
4. QA summary report.
5. Decision note: which join rule becomes the first canonical rule.
6. Learning note: what worked, what failed, what Phase 2 should inherit.

## Open Decisions

- Should the first prototype use Florida, Texas, or national one-year data?
- Should the first join use exact overlap only, or allow lead/lag buffers?
- How much source narrative text should be retained?
- What is the first match-score formula?
- Should NOAA zone-level events be mapped to counties immediately or preserved
  as source geography first?

## Recommended First Prototype

Use a narrow pilot:

```text
catalog: eagle-i-45min
state: Florida
years: 2017 and 2020
sources: NOAA Storm Events first, OE-417 second
```

Reason:

- hurricane/storm signal should be visible;
- event volume is high enough to inspect;
- known major events help manual validation.
- PNNL has 2017 and 2020 comparator files, so this pilot can also validate
  whether our event construction and OE-417 matching materially diverge from an
  external derived dataset.
