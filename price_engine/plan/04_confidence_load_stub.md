# 04 — Confidence Load (Interface only — implementation deferred to v0.5)

You said the confidence-to-premium piece is a v0.5 problem. Agreed. This doc exists so v0's pricing function and dashboard can be built around the right interface from day one, with a zero-default implementation. No refactor when v0.5 lands.

## The interface

```python
# confidence/load.py
def uncertainty_load(fips: str, T: float, X: float, context: dict) -> float:
    """
    Return a dollar load on top of PurePremium reflecting modelability uncertainty.

    v0 implementation: return 0.0 always.
    v0.5 implementation: see below.
    """
    return 0.0
```

The pricing function (`pricing/premium.py`) calls this and adds the result, period. The dashboard's drill-down has a row for it that is `$0.00` in v0 and a non-zero value in v0.5.

## What v0.5 will compute (so we know what `context` should carry)

The two candidates from our earlier discussion, kept side-by-side:

### Option A — Bootstrap-based uncertainty load

Resample the FIPS event log `B` times (say `B=500`). For each bootstrap sample, recompute `λ(T)`. Get the distribution of `λ(T)` estimates. Load the premium by some upper quantile (75th, 90th — calibration question) rather than the mean.

```
λ_hats = [estimate_lambda(bootstrap_sample(events), T) for _ in range(B)]
λ_loaded = quantile(λ_hats, 0.75)
load = (λ_loaded - λ_mean) * X
```

**What it answers**: "How wide is the confidence interval around my premium, and what does it cost to be on the safe side of it?"

**Pros**: Distribution-free, transparent, computable per-FIPS, no actuarial-prior calibration.
**Cons**: Bootstrap on thin samples is itself unreliable; the bootstrap quantile of a 20-event sample doesn't faithfully represent uncertainty.

### Option B — Credibility blend

Blend the county's empirical `λ_FIPS(T)` with a regional or state prior `λ_region(T)`:

```
Z = n / (n + K)                                    # credibility weight
λ_blended(T) = Z · λ_FIPS(T) + (1 - Z) · λ_region(T)
```

where `K` is a credibility constant (typically tuned so that `n = K` corresponds to ~50% credibility). The "load" is then the difference between the credibility-blended premium and the raw-empirical one, on the conservative side.

**What it answers**: "Should I trust this county's own data, or should I shrink toward what its neighbours look like?"

**Pros**: Actuarial-standard, familiar to insurance reviewers, well-defined behaviour for thin data.
**Cons**: Requires defining "region" defensibly (state? climate zone? eGRID region?); shrinkage can mask real heterogeneity.

### Option C — Both, run as a cross-check

If the two methods disagree by more than X%, the county gets flagged for manual review and may shift Amber → Red.

This is the route I'd recommend for v0.5 when we get there. It's marginally more code but gives us a built-in sanity check that catches the failure modes of either method in isolation.

## What `context` needs to carry

The interface is forward-compatible if we pass everything v0.5 might need:

```python
context = {
    "events": list_of_durations,           # for bootstrap
    "observation_years": float,
    "regional_lambda": float,              # for credibility blend
    "regional_n": int,                     # for region-weight in blend
    "tier": "Green" | "Amber" | "Red",
    "diagnostics": {                       # the four D's from filtration
        "d1": int, "d3": float, "d4": float,
        "d2": {2: int, 4: int, 8: int, 12: int, 24: int}
    },
}
```

v0 builds and passes this object but `uncertainty_load(...)` ignores it and returns 0. v0.5 turns it on without changing any caller code.

## Where the load shows up on the dashboard

The premium drill-down has a fixed row:

```
Pure premium               $200.00
Uncertainty load (v0: $0)  $  0.00      ← will be nonzero in v0.5
Expense load (25%)         $ 76.92
Margin (10%)               $ 30.77
────────────────────────────────────
Retail premium             $307.69
```

In v0 the row is visible with `$0.00` and a tooltip "Uncertainty load deferred to v0.5 — see [`04_confidence_load_stub.md`](04_confidence_load_stub.md)." This is deliberate. It tells viewers (insurance team especially) that this dial exists and is coming, so the v0 number is not yet a defensible market price — it is a *baseline* that still needs an uncertainty layer.

## Why this matters for v0 even though we don't implement it

Three reasons not to skip the stub:

1. **Locks the engine output schema** so the dashboard never needs a breaking change.
2. **Makes the v0 baseline honest.** Showing the `$0.00` line forces every viewer to confront that the v0 number is not the final commercial number. Without the stub, people read the v0 number as a price.
3. **Anchors the v0.5 conversation.** When we light up confidence loads, the team has a precise place to plug the new logic into.
