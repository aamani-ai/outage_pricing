# County-Trigger Pricing (v0) — Fundamentals

*Audience: senior team. Last reviewed: 2026-06-03. Reads naturally after [`event_catalog_fundamentals.md`](../01_eventization/event_catalog_fundamentals.md).*

## What v0 county-trigger pricing is, in one paragraph

This is the **baseline pricing layer** we built first. It produces a price per county per duration threshold, derived entirely from **historical EAGLE-I observations** — no fitted distributions, no climate-forward modeling, no portfolio correlation. The formula is deliberately simple: *how often do events of at least duration `T` happen in this county, multiplied by the payout*. The result is the pure expected loss, which is then loaded for expenses and target margin to give a retail rate. Every input is observable, every assumption is documented, and the math is fully reproducible from the public EAGLE-I dataset.

## The formula

The pure (loss-only) annual expected loss for a single insured location in county *f*, against a duration trigger *T* and payout *X*, is:

```
λ_county(f, T) = N_events_per_year(f, T) × S(f, T)

EL_pure(f, T, X) = λ_county(f, T) × X

EL_retail(f, T, X) = EL_pure(f, T, X) / (1 − ER − TM)
```

Where:
- **`N_events_per_year(f, T)`** — empirical annualized count of outage events with duration ≥ `T` in county *f*, over the EAGLE-I record (2014–2025).
- **`S(f, T)`** — empirical survival function: of all events in county *f*, the fraction that lasted at least `T`. Computed directly from the event catalog, no fitted curve.
- **`λ_county(f, T)`** — the expected annual count of *qualifying* events (those crossing the trigger).
- **`X`** — fixed parametric payout if the trigger fires.
- **`ER`, `TM`** — expense ratio and target margin loadings.

## Worked example — Alachua County, FL — T = 4h, X = $500

| Quantity | Value | Source |
|---|---|---|
| `N_events_per_year` | computed from catalog | event count in Alachua / years of coverage |
| `S(T = 4h)` | empirical fraction | event catalog → survival curve |
| `λ_county(T = 4h)` | **307.148490** | product of the two |
| Pure expected loss at X = $500 | `λ × $500` | per-county, per-policy, per-year |
| Retail rate | `pure / (1 − ER − TM)` | after loadings |

(The exact λ value above is the byte-identical anchor we use across the codebase — any v0 change that doesn't reproduce this number is a regression.)

## What the survival curve looks like (ASCII)

For a county with reasonable history, `S(T)` looks like a monotonically decreasing step function:

```
  S(T)
   1.00 |●
   0.80 |  ●
   0.60 |     ● ●
   0.40 |          ● ●
   0.20 |               ● ● ●
   0.00 |                       ● ● ● ● ● ● ●
        └─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─→ duration threshold T
         15m   1h    2h    4h    8h    24h
```

Each step is one observed event "dropping off" the qualifying set as the threshold rises. **There is no curve-fitting** — the function is read directly off the empirical CDF of event durations. Counties with few events (say <30 over the record) have stair-steps coarse enough that we flag them in the modelability tier (amber/red).

## Modelability tiers

Counties are sorted into a three-tier coverage gate based on the *number of historical qualifying events available to fit S(T)*:

| Tier | Criterion | Pricing surfaced? |
|---|---|---|
| **Green** | rich event history, stable survival curve | yes |
| **Amber** | thinner history; survival curve volatile | yes, with caution band |
| **Red** | insufficient history at this `T` | no — price suppressed |

The thresholds for each tier are documented in [`assumptions.md`](../assumptions.md) ([A003](../assumptions.md)). They are the *first* place we apply judgment about credibility.

## What v0 explicitly does NOT do

This is as important as what it does do — these are deliberate omissions, all documented in [A001 – A008](../assumptions.md):

1. **No fitted distribution.** No Weibull, no Gumbel, no parametric survival. We use the empirical curve directly.
2. **No PRESTO or external risk model.** We don't import third-party catastrophe model outputs.
3. **No portfolio correlation.** Each insured location is priced independently. Two insureds in the same county pay the same county rate; no diversification credit, no concentration loading.
4. **No climate forward look.** We are pricing the historical regime, full stop. Climate, grid hardening, vegetation management — none of these enter v0.
5. **No customer-impact adjustment.** v0 prices the **county** event, not the individual customer's expected loss. *(This is the gap the per-customer layer closes — see [`per_customer_pricing_fundamentals.md`](per_customer_pricing_fundamentals.md). v0 over-prices the per-customer expected loss by roughly 30–100×.)*
6. **No live trigger.** v0 prices against historical EAGLE-I; it does not say *how a live event would be detected and paid*. That is the trigger-alignment problem and is separate.

## Caveats — what senior team should know before relying on v0

1. **The county is the priced unit, not the insured site.** A county-wide event qualifies even if the specific insured address never actually lost power. This is the **basis risk problem** and is the biggest single conceptual gap in v0 — closed downstream by the per-customer multiplier.
2. **`λ_county` is silently large.** Because counties are large and any qualifying outage anywhere in the county counts, `λ_county` values are far higher than the policyholder's own expected outage frequency. A single λ value can be 100+ per year in storm-prone counties — that's correct as a *county-event rate*, but it's not the insured's own frequency.
3. **Empirical survival has variance.** Steps in `S(T)` are larger in counties with few events. The amber/red tiers exist to flag this; do not eyeball survival curves in amber counties.
4. **Loadings (`ER`, `TM`) are uncalibrated.** The retail conversion uses placeholder loadings until we have actual expense and target-margin numbers from a carrier partner. The pure-loss number is reliable; the retail number is illustrative.
5. **All EAGLE-I caveats inherit.** Anything that biases the event catalog (gap-merge choice, sub-15-min invisibility, modeled MCC) biases v0 pricing. See [`eagle_i_data_fundamentals.md`](../cross_cutting/eagle_i_data_fundamentals.md) and [`event_catalog_fundamentals.md`](../01_eventization/event_catalog_fundamentals.md).
6. **v0 is the floor, not the answer.** It is the simplest defensible price we can produce from public data with zero curve-fitting. Every adjustment layered on top (per-customer, future hazard, future grid) shrinks toward — or away from — this baseline in measurable ways.

## Why we built it this way

v0 is intentionally **the most boring, most reproducible, most byte-identical** pricing layer we could ship. Every senior reviewer, regulator, or partner carrier can re-run it from the public EAGLE-I dataset and our catalog rules and get the same numbers. That property — *defensibility through reproducibility* — is more valuable at this stage than any sophistication a fitted model would add.

## One-line takeaways

- **`λ_county(T) × payout`, with empirical (not fitted) inputs. That's it.**
- **The county, not the customer, is the priced unit — this is the known basis risk.**
- **Every modeling layer above v0 is documented as a bias-correction or forward-regime adjustment, not as a competing model.**

## References

- Source data: [EAGLE-I 2014–2025](https://openenergyhub.ornl.gov/explore/dataset/eaglei_outages_2014/)
- Anchor calculation: λ_county = 307.148490 for Alachua FL, T = 4h, eagle-i-45min catalog
- Assumptions: [`assumptions.md`](../assumptions.md) — A001 through A008 cover v0
- Upstream: [`event_catalog_fundamentals.md`](../01_eventization/event_catalog_fundamentals.md)
- Downstream bias-correction: [`per_customer_pricing_fundamentals.md`](per_customer_pricing_fundamentals.md)
