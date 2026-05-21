# Phase 1 Learning: PNNL-First Enriched Preview

Date: 2026-05-18

## What Changed

The Phase 1 pilot now builds a source-priority enriched preview:

```text
PNNL/OE-417 major disturbance first
NOAA onset-window weather evidence second
unknown third
```

This matches the current modeling view: PNNL/OE-417 is a strong source for
major reported disturbance context, NOAA is useful weather evidence, and unknown
must remain a normal result.

## Pilot Scope

```text
catalog: eagle-i-45min
state: Florida
years: 2017, 2020
```

Generated local output:

```text
curated_outage_data/outputs/phase_1_cause_attribution/fl_2017_2020/
```

## Key Results

| Metric | Count |
|---|---:|
| catalog events | 84,270 |
| PNNL/OE-417 match rows | 2,431 |
| PNNL/OE-417 matched events | 697 |
| PNNL-first labeled events | 692 |
| NOAA fallback labeled events | 1,210 |
| unknown events | 82,368 |

This is intentionally conservative. Most events remain unknown because public
major-disturbance/weather sources cannot explain routine county outage events.

## Interpretation

PNNL/OE-417 labels are major-disturbance labels, not exact outage on/off labels.

For example, a DOE/OE-417 event can describe a broad severe weather or
transmission incident while county-level EAGLE-I outage intensity rises and
falls across the incident. The label should be read as:

```text
this county outage event is plausibly part of a reportable major disturbance
```

not:

```text
this county was off for the full OE-417 incident duration
```

## Timeline QA Added

The pilot now writes timeline review samples:

```text
timeline_review_samples/index.html
timeline_review_samples/timeline_samples.csv
*_raw_snapshots.csv
*_source_windows.csv
```

Each sample overlays:

- raw EAGLE-I customer-out snapshots;
- our constructed outage event;
- PNNL/OE-417 event window;
- PNNL merged outage scenario;
- NOAA storm-event windows.

This is the right review surface because cause attribution is not only a join
problem. We need to see whether the source explains outage onset, outage
persistence, or only broader background context.

## Caveats

- PNNL/OE-417 timestamps are used as published by the PNNL package in this
  pilot. A direct OE-417 timezone audit is still needed before production use.
- NOAA timestamps are converted from local-standard `CZ_TIMEZONE` offsets to
  timezone-naive UTC.
- Events longer than 336 hours remain `extreme_duration_review`.
- The pilot is still Florida 2017/2020 only, not a national run.

## Next Step

Use the generated timeline samples to decide whether we need a separate
cause-attribution event view. The likely answer is yes:

```text
pricing event catalog: preserve empirical duration/frequency behavior
cause-attribution view: focus on outage onset and major-disturbance episodes
```

After that, add a direct OE-417 parser/matcher so PNNL can validate our logic
rather than being the only source of OE-417 matching.
