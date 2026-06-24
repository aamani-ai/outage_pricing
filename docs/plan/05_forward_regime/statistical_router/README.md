# Statistical Router Plan

**Status:** active planning folder  
**Date:** 2026-06-24  
**Step:** 05 Forward Regime

This folder translates the discussion in
[`../../../dicsscssion/forward_regime_statistical_router/`](../../../dicsscssion/forward_regime_statistical_router/)
into a notebook-first implementation plan.

## Index

| File | What |
|---|---|
| [`01_notebook_plan.md`](01_notebook_plan.md) | Build plan for the national statistical-router backtest notebook and its artifacts. |

## Implementation Location

The first implementation should live under:

```text
notebooks/05_forward_regime/statistical_router/
```

not in dashboard code and not in the pricing engine.

The first output target should be:

```text
notebooks/outputs/forward_regime/statistical_router/
```

This keeps the work reviewable, reproducible, and explicitly shadow-only until
the gates are met.
