# Eventization And Frequency Contract

**Status:** discussion folder  
**Purpose:** hold the design discussion before locking methodology or tuning
risk-based clustering thresholds.

Start here:

- [`01_eventization_frequency_discussion.md`](01_eventization_frequency_discussion.md)
- [`02_underwriter_confidence_framing.md`](02_underwriter_confidence_framing.md)
- [`03_inner_event_shape_diagnostics.md`](03_inner_event_shape_diagnostics.md)
- [`04_duration_conservatism.md`](04_duration_conservatism.md) — closes Chris's "are the duration assumptions conservative?" action item
- [`05_source_coverage_mask.md`](05_source_coverage_mask.md) — observed-zero vs missing: the coverage-ramp finding + the onset mask (Step-3 prerequisite)
- [`06_short_trigger_frequency_recovery.md`](06_short_trigger_frequency_recovery.md) — the competing short-T biases (why the net is uncertain → "verify"), the excursion/revival method to recover short-trigger frequency, and the *established + conservative* proof behind the ≥8h cushion

This folder exists because the outage-pricing stack depends on a non-trivial
conversion:

```text
raw outage time series -> curated outage events -> annual frequency
```

That conversion sits before county tiering, per-customer pricing,
predictability routing, shadow lambda reads, source-quality zero/missing rules,
and location/hazard/grid overlays.
