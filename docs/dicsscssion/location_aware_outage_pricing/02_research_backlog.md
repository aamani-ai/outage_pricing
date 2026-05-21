# Location-Aware Outage Pricing Research Backlog

Date: 2026-05-19

## Purpose

This backlog tracks the research and analysis needed before we redesign outage
pricing around policy-location risk.

## Research Stream 1: Data Grain

Questions:

- What is the smallest defensible spatial unit for each candidate source?
- Does the source expose county, municipality, ZIP, outage case, feeder,
  transformer, meter, or premise-level records?
- Does it preserve history, or only current/live state?
- Do restored outages disappear from the public view?
- Can outage symbols be mapped to a precise enough area without violating
  privacy or critical infrastructure constraints?

Candidate sources:

- EAGLE-I county snapshots.
- PNNL event-correlated EAGLE-I derivatives.
- Public utility outage maps.
- Licensed outage oracle data.
- Utility OMS/AMI partnership data.
- Sensor-network trigger data.

## Research Stream 2: County-To-Location Bridge

Questions:

- Given a county outage event, what is the probability a random SMB location in
  that county was actually affected?
- Does that probability vary by urban/rural status, utility territory, feeder,
  land cover, vegetation, storm hazard, or local grid condition?
- Can we estimate this bridge from overlap between EAGLE-I and a more local
  trigger source?
- Should the bridge be trigger-specific, for example different for 2h, 8h, 24h?

Potential output:

```text
alignment_factor(fips, location, T)
```

## Research Stream 3: Regime And Cause

Questions:

- Are qualifying events routine, storm-driven, persistent low-level, or
  source-artifact dominated?
- Do causes explain which events are spatially broad versus highly local?
- Should storm or major-disturbance events use different location-adjustment
  logic than routine local events?

Potential output:

```text
routine_rate + storm_rate + persistent_background_flag
```

## Research Stream 4: Commercial Viability

Questions:

- At which trigger durations does the premium become commercially hard to
  justify versus backup power, batteries, or operational resilience?
- Should 2h and 4h triggers be restricted, repriced, or only offered under a
  different product design?
- Should short triggers require stronger local trigger evidence than long
  triggers?

Potential output:

```text
commercial_viability_flag(T, X, premium, customer_segment)
```

## Research Stream 5: Data Collection Pilot

The likely pilot should collect one utility map forward in time rather than
pretending public maps provide a long historical archive.

Pilot requirements:

- select one utility service territory;
- identify legally acceptable public fields;
- collect snapshots at the map update cadence;
- preserve raw responses;
- build outage-case/event stitching logic;
- compare collected map events against EAGLE-I county events;
- document missingness, restored-event deletion, and schema drift.

Good first pilot candidate:

```text
Central Hudson-style outage map
```

Reason:

- the public guide documents 10-minute updates;
- the map has outage cases and county/municipality summaries;
- it illustrates the exact distinction between public map detail and exact
  premise-level trigger certainty.

## Proposed Next Working Sequence

1. Pick one county/utility territory where the public map and EAGLE-I overlap.
2. Write down the trigger definition we would want for an SMB policy.
3. Compare that trigger definition against what the public map actually exposes.
4. Decide whether the public map can support validation, live trigger, both, or
   neither.
5. Build a tiny forward collector only if the source terms and technical
   stability look acceptable.

## Open Decisions

| Decision | Current leaning |
|---|---|
| Should v0 remain county-level? | Yes, as historical baseline. |
| Should v1 be location-aware? | Yes, if we can support a defensible trigger source. |
| Should public utility maps be production triggers? | Probably no without license/permission and archival guarantees. |
| Should public utility maps be research/validation sources? | Yes, selectively. |
| Should pricing include a location adjustment? | Yes, but only after evidence or clear feature design. |
