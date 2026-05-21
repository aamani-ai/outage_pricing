# Phase 1 Source Strategy: Cause Labels vs Context

Date: 2026-05-18

## Question

Should cause attribution rely primarily on NOAA Storm Events, or should it rely
on PNNL/OE-417 first and use NOAA only as fallback/context?

## Short Answer

Use a source hierarchy, not one source.

```text
PNNL/OE-417 -> major disturbance label
NOAA Storm Events -> weather context and secondary evidence
unknown -> valid result when public evidence is weak
```

Do not force a cause label for every EAGLE-I event.

## Why PNNL/OE-417 Is Different

PNNL/OE-417 is event-oriented around major reported grid disturbances. It is
most useful when the question is:

```text
Was this outage plausibly part of a major reported disturbance?
```

It is not a full outage on/off truth table. A DOE/OE-417 disturbance can cover a
large operational incident while individual counties move in and out of outage
states. The incident window and the county outage duration do not need to match
exactly.

That means PNNL/OE-417 is strong evidence for major/catastrophic episodes, but
it will miss many routine local outage events.

## Why NOAA Still Matters

NOAA Storm Events is not a power-outage source. It records weather hazards.

It helps answer:

```text
Was there a relevant weather event near outage onset in the same county?
```

NOAA is better as context and cause evidence than as a direct cause truth table.
It should be anchored around outage onset, not the full outage duration.

## Recommended Label Logic

Use layered labels:

| Layer | Source | Label strength | Meaning |
|---|---|---|---|
| major disturbance | PNNL/OE-417 | high for major events | outage overlaps a reportable grid disturbance |
| weather evidence | NOAA | medium/high depending on match quality | weather event near outage onset |
| context only | NOAA/PNNL weak match | low/review | useful for review, not clean label |
| unknown | none | none | no defensible public-source cause |

For Phase 1, the best cause label should follow this order:

1. If PNNL/OE-417 gives a strong major-disturbance match, label as
   `major_disturbance` with the reported event type.
2. Else, if NOAA gives a strong county/onset match, label as `weather` with the
   NOAA event type.
3. Else, retain `unknown / unattributed`.

## Next Test

The next implementation step should be a PNNL-first pilot, not a NOAA-only
pilot:

```text
catalog: eagle-i-45min
state: Florida
years: 2017, 2020
source priority:
  1. PNNL/OE-417 8h and 24h lag event-correlated files
  2. NOAA onset-window matches
  3. unknown
```

The output should create:

- `event_cause_matches_pnnl.parquet`
- `event_cause_matches_noaa.parquet`
- `event_enriched_preview.parquet`
- `source_priority_summary.csv`
- `timeline_review_samples/`

## Timeline View Needed

Before scaling nationally, we should build a county timeline for selected
examples:

```text
EAGLE-I raw customer-out snapshots
our constructed outage events
PNNL/OE-417 major disturbance windows
NOAA storm-event windows
```

This is the right visual QA because the important question is not only whether
two tables join. It is whether the external source window actually explains
outage onset, outage persistence, or only broad context.

## Current Decision

Do not replace NOAA with PNNL/OE-417.

Instead:

- PNNL/OE-417 should become the first-priority source for major/catastrophic
  labels.
- NOAA should remain the broader weather-evidence layer.
- Unknown should remain common and acceptable.
- The next pipeline run should produce a source-priority enriched preview.
