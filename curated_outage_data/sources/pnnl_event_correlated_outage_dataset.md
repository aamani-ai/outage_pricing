# Source Note: PNNL Event-Correlated Outage Dataset

Status: candidate Phase 1 comparator and validation source

## Role

The PNNL Event-Correlated Outage Dataset is a public derived dataset that
combines EAGLE-I outage records, DOE/OE-417 disturbance records, and county
population data.

Proposed role in this project:

```text
PNNL event-correlated data -> comparator for our event construction and OE-417
matching choices
```

It should not be the canonical pricing event catalog unless we first accept its
event-construction and filtering rules.

## Why It Matters

PNNL has already done part of the workflow we are planning:

- create merged county-level outage scenarios from raw EAGLE-I snapshots;
- summarize outage impact by state/year/month;
- correlate EAGLE-I-derived outages with DOE/OE-417 major disturbance records;
- publish 8-hour and 24-hour lag variants for event correlation.

That is valuable because it gives us an external benchmark for major-event
matching and for our own EAGLE-I event construction.

## Expected Grain

The public package includes three broad file families:

| Family | Typical file name | Grain |
|---|---|---|
| grouped outage data | `eaglei_outages_YYYY_group.csv` | state/month/year summary |
| merged outage data | `eaglei_outages_YYYY_merged.csv` | county outage scenario |
| event-correlated data | `eaglei_outages_with_events_YYYY*.csv` | county outage scenario matched to DOE/OE-417 event |

The event-correlated files include base, 8-hour lag, and 24-hour lag versions.

## Important Caveat

This source is not an all-cause outage truth table.

Because the event-correlated layer is tied to DOE/OE-417, it is naturally biased
toward major reported disturbances. That is exactly the catastrophic/large-event
layer we care about for validation, but it will miss many routine local outages.

The public guidelines describe merged outage records as continuous county-level
outage scenarios, but the full construction threshold and stitching logic should
be treated as external until we validate it against our own event catalogs.

## Proposed Use

Use PNNL in Phase 1 as:

1. A benchmark for our `eagle-i-30min`, `eagle-i-45min`, and `eagle-i-60min`
   event catalogs.
2. A comparator for our DOE/OE-417 matching rules.
3. A QA source for long-duration and high-impact events.
4. A reason to report match results separately by duration/impact threshold.

Do not use it as:

- the base catalog for v0 pricing;
- the only cause-attribution source;
- proof that an unmatched event had no external cause.

## Validation Questions

- How do PNNL merged-event counts compare with our 30/45/60 minute catalogs?
- Are PNNL durations systematically longer or shorter than ours?
- Which PNNL OE-417 matches disappear under our stricter geographic/time rules?
- Which of our long-duration events are missing from PNNL's event-correlated
  files?
- Do 8-hour and 24-hour lag rules materially change cause labels for pricing
  thresholds like 4h, 8h, 12h, and 24h?

## Official Links

- Data.gov catalog record:
  https://catalog.data.gov/dataset/event-correlated-outage-dataset-in-america
- Dataset archive:
  https://data.openei.org/files/6458/Outage_Dataset_R1.zip
- DOE/OE-417 archive linked by the catalog:
  https://www.eia.gov/electricity/data/disturbance/disturb_events_archive.html
