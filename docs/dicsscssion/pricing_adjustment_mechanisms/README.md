# Pricing Adjustment Mechanisms Discussion

This folder is for the project-level pricing architecture that connects the
different adjustment tracks into one coherent pricing story.

The working framing is intentionally simple:

```text
Headline story:
  1. basis / alignment adjustments
  2. forward-regime adjustments

Required tags:
  - native target: frequency, exposure, load, gate, trigger source, hazard context
  - status: active, shadow, review, wip
```

The two headline buckets keep the business story understandable. The tags keep
the technical story honest.

The working thesis is:

```text
Native model first.
Factor second.
Premium-impact composition third.
```

That means we should not treat every signal as an arbitrary price multiplier.
Each signal should first be modeled in the unit it actually represents:
frequency, exposure basis, trigger-source alignment, uncertainty/load, hazard
context, or credibility. Only after that do we translate the result into a
comparable factor for dashboard display, audit, and premium-impact math.

## Files

| File | Purpose |
|---|---|
| `01_pricing_adjustment_mechanism_design.md` | Initial architecture note for combining active, shadow, review, and WIP pricing adjustments without losing mechanism meaning. |

## Current Working View

The factor is a common expression layer, not a common modeling layer.

```text
model-native output -> auditable factor -> premium-impact view
```

Examples:

- A trend/regime read may become a candidate frequency: `lambda_candidate`.
- A customer-basis adjustment changes county-event exposure into per-customer
  exposure.
- A location-basis adjustment should correct county average into local exposure.
- A noisy or episodic pattern may imply uncertainty or hazard review, not a
  direct lambda movement.
- A trigger-source mismatch may require a historical-to-live oracle bridge.

Those can all be expressed as factors for a simple premium-impact view, but they
must keep both:

1. a headline bucket: `basis_alignment` or `forward_regime`; and
2. a native target tag, so a `1.20x` frequency move is not confused with a
   `1.20x` uncertainty load.

## Status

Discussion/design. This folder is not an active-pricing implementation by
itself. It should guide the next updates to:

- the lambda-shadow and predictability methodology docs;
- the dashboard copy around "shadow pricing" and "price impact";
- the schema for future adjustment artifacts;
- the roadmap sequencing for basis risk, forward-regime reads, and trigger
  alignment.
