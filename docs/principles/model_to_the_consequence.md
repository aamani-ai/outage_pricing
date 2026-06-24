# Principle: Model to the Consequence — the loss is a business choice, not a default metric

- **Status:** principle
- **First written:** 2026-06-24

## The principle

```text
A model OPTIMISES a loss and is JUDGED by a metric. Those must encode the real BUSINESS CONSEQUENCES of
being wrong — which are usually ASYMMETRIC and specific to what the number is USED FOR — not a default
symmetric statistical error.

Before choosing how to score or optimise, ask:
  what DECISION does this number feed, and what does being wrong in EACH DIRECTION cost us?
```

A default metric (symmetric WAPE, RMSE, accuracy) silently assumes every error is equally bad. It almost
never is. If you don't shape the objective to the use case, the objective will quietly choose the wrong
thing — and look "accurate" while doing it.

## Why — the example that earned it

```text
  forecasting outage FREQUENCY for INSURANCE:
    UNDER-forecast  → under-reserve / under-price → solvency risk        → COSTLY  → penalise ~3x
    OVER-forecast   → cushion / over-reserve       → a little lost margin → CHEAP   → fine / even good

  symmetric WAPE treats these as equal — and would have picked an UNDER-predicting method as "best."
  We only caught it by asking "what does this forecast DO in our business?" → asymmetric loss +
  one-directional (uplift + abstain) for the statistical adjuster. The accuracy lens alone would have
  shipped the dangerous choice and called it optimal.
```

## What it is NOT

```text
  · NOT "ignore accuracy" — accuracy still matters; it is scored THROUGH the consequence, not instead of it.
  · NOT "always be conservative everywhere" — the asymmetry is SPECIFIC (here: under-reserving). Name the
    consequence for THIS use case; don't import a generic bias.
```

## What it IS

```text
  · the loss / metric is a BUSINESS decision, set BEFORE modelling, from the cost of each error direction;
  · the conservative DEFAULT should be the cheap-error direction (here: over-reserve), and ABSTAIN when unsure;
  · you discover the right objective by stating the DECISION the number feeds and the cost of being wrong.
```

## The test — run before adopting any metric / loss / objective

```text
  1. what DECISION does this number feed, and who acts on it?
  2. cost of being wrong HIGH vs LOW — are they symmetric? (usually NOT)
  3. does the loss / metric REFLECT that asymmetry — or is it a default symmetric one?
  4. is the conservative default the cheap-error direction, and do we ABSTAIN when the evidence is thin?
```

## Relationship to the other principles

```text
  communicate_to_share  → how you PRESENT the number (clarity for the actor).
  county_specificity    → WHERE the logic applies (grouping, not one-size-fits-all).
  model_to_consequence  → by WHAT OBJECTIVE you score / optimise it (the stakes).
```

## Cross-references

- The decision it produced: [`../dicsscssion/forward_regime_statistical_router/04_statistical_adjuster_design.md`](../dicsscssion/forward_regime_statistical_router/04_statistical_adjuster_design.md) (asymmetric loss, one-directional, abstain).
- Same conservative-direction theme: the experience band ([A017](../methodology/assumptions.md)) and "Bias as a guardrail" in the metrics cohort.
