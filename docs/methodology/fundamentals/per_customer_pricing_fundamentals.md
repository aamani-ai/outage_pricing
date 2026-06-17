# Per-Customer Pricing — Fundamentals

*Audience: senior team. Last reviewed: 2026-06-03. Reads naturally after [`county_trigger_pricing_fundamentals.md`](county_trigger_pricing_fundamentals.md). See the deeper walkthrough at [`per_customer_view_walkthrough.md`](../per_customer_view_walkthrough.md).*

## What per-customer pricing is, in one paragraph

The v0 county-trigger price answers the question *"how often does a qualifying outage happen anywhere in the county?"* — but that is not the question a single insured customer needs answered. The customer's question is *"how often do **I** lose power?"* — which is **much smaller** than the county event rate, because most county-level events affect only a portion of the county's customers, not all of them. The per-customer layer corrects this by multiplying the county event rate by the *average share of county customers actually affected* during qualifying events. The result is a price that reflects an individual customer's expected loss, not the county's. This adjustment **lowers the per-customer expected-loss number by roughly 30 to 100×** depending on the county. Per-customer is now the **headline rate** on the dashboard; v0 county-trigger remains as the reference.

## The formula

```
multiplier(f, T) = mean over qualifying events e in county f of:
                   ( mean_customers_out(e) / MCC(f) )

λ_per_customer(f, T) = λ_county(f, T) × multiplier(f, T)

EL_pure_per_customer(f, T, X) = λ_per_customer(f, T) × X
```

Where:
- **`mean_customers_out(e)`** — average instantaneous customer count out during event *e* (from the event catalog).
- **`MCC(f)`** — Modeled County Customers for county *f* (total customer base; see [`eagle_i_data_fundamentals.md`](eagle_i_data_fundamentals.md)).
- **`mean_customers_out(e) / MCC(f)`** — share of county customers affected, *averaged over the event*. Ranges from near 0 (small localized outage) to near 1 (county-wide outage).
- **`multiplier(f, T)`** — the average of that share across all qualifying events. Always ≤ 1, almost always ≪ 1.

## Worked example — Alachua County, FL — T = 4h, X = $500

| Quantity | Value |
|---|---|
| `λ_county` (from v0) | 307.148490 events/yr |
| Mean share affected during qualifying events | ~0.01 to 0.05 (illustrative) |
| `multiplier` | ~0.02 to 0.05 |
| `λ_per_customer` | **~6 to 15 events/yr** for the same trigger |
| Pure expected loss at X = $500 | ~$3,000 to $7,500/yr ← v0 county number; not what an individual customer experiences |
| Pure expected loss at X = $500, per-customer | **~$30 to $200/yr** ← the headline number |

The actual numbers shown on the dashboard come from the live calculation against the published catalog. The point of the table above is the **order-of-magnitude shift**: v0 over-prices the per-customer expected loss by 30–100×, and the per-customer layer brings it back into a defensible range. See `curated_outage_data/pipelines/per_customer_rate/compute_per_customer_lambda.py` for the production calculation.

## How the multiplier behaves (ASCII)

Picture two counties of the same population. Most qualifying events are **localized** — a transformer fault, a single-circuit outage:

```
County A (urban, dense):     County B (rural, sparse):

                              ●●●●●●●●●●
●─●─●─●─●─●─●─●─●─●          ●●●●●●●●●●
                              ●●●●●●●●●●
[ tiny outage on one circuit ] [ same severity, but a much larger fraction of county is dark ]

share affected ≈ 0.005        share affected ≈ 0.15
multiplier (after averaging) ≈ 0.02     multiplier (after averaging) ≈ 0.08
```

A rural county with fewer customers experiences the same physical outage as a larger *share* of its total — its multiplier is bigger, so the per-customer rate doesn't fall as far below the county rate. An urban dense county has tiny multipliers — its per-customer rate is dramatically lower than its county rate.

## The dashboard's sensitivity footer (median · headline · max)

Alongside the headline `multiplier_mean`, the dashboard surfaces two
sensitivities. They answer different questions and perturb the
estimator at different levels:

| Estimator | What changes vs the headline | What question it answers |
|---|---|---|
| `multiplier_median` | **outer aggregation** — `median` across events instead of `mean`, same per-event-mean inner statistic | *"what is the multiplier for a **typical** qualifying event in this county, ignoring a few major-storm outliers that pull the mean upward?"* |
| `multiplier_max` | **inner statistic** — `max_customers` per event instead of `mean_customers`, same outer mean across events | *"what if customers were out at the **peak** of each event rather than on average?"* (stress-test of A011 below) |

So if the footer shows `median $47 · max $2,259`, it isn't a symmetric
"three different statistics" view. The median is a **robust outlier-
resistant** version of the headline; the max is a **peakedness stress
test**. Both are bounded interpretations of the same uncertainty —
neither is the price the customer is quoted. Formal definitions in
[`A010`](../assumptions.md#a010--mean-not-max-of-customers_out--mcc-is-the-headline-per-customer-estimator).

## Coverage gate — when do we surface the per-customer price?

Not every county has enough qualifying events to compute a reliable multiplier. The gate is published as three states:

| State | Criterion (illustrative thresholds) | Dashboard behavior |
|---|---|---|
| **Available** | ≥ 100 qualifying events for this `T` | Show per-customer headline number |
| **Caution** | 10 ≤ qualifying events < 100 | Show with caution band + warning |
| **Not available** | < 10 qualifying events | Suppress per-customer; show v0 reference only |

Exact thresholds are tracked in `curated_outage_data/pipelines/per_customer_rate/compute_per_customer_lambda.py` and as assumptions in [`assumptions.md`](../assumptions.md).

## The one assumption you must read — A011

The per-customer multiplier is computed as the *time-average share of county customers out during the event*. It is **not** the *fraction of unique customers ever affected during the event*. The two are equal only under what we call the **synchronous-outage approximation**: that everyone who is out during the event was out for roughly the same fraction of the event's duration.

Concretely:
- **If true** (synchronous): `mean_customers_out / MCC` is a clean estimate of "what fraction of the county was actually out."
- **If false** (staggered restoration, rolling outages — the realistic case): the event is a *core* of customers out for the full duration (correctly triggered) plus a much larger *periphery* of customers experiencing brief restoration-churn outages well below `T` (which contribute to `mean_customers_out` but do not trigger). Net effect: `mean_customers_out` sits **above** the count of customers who actually crossed `T`, so we **overestimate** the per-customer rate. Worked Cases A–D in the [walkthrough §Why it is a model and not a measurement](../per_customer_view_walkthrough.md#why-it-is-a-model-and-not-a-measurement) bracket the regimes: synchronous (Case A) is exact, fully-staggered-brief (Case B) and realistic core+periphery (Case C) both overestimate, and the direction inverts only under a knife-edge "durations cluster at `T`" regime (Case D) that has no physical reason to occur.

EAGLE-I does not publish per-OutageId records, so we **cannot test this assumption from EAGLE-I alone**. It is fully documented as [A011](../assumptions.md). The PowerOutage.US trial is the first concrete data source that could shrink the uncertainty around A011.

## Overestimation as a conservative cushion

The direction of bias under realistic conditions — `mean_customers_out / MCC` sitting **above** the true per-customer trigger rate `N(T) / MCC` — is *not* a problem to apologise for. It is the **conservative direction** for insurance: expected loss is overstated, not understated, so the headline pure premium carries a built-in margin on top of the explicit loadings (target margin `TM`, expense ratio `ER`, uncertainty load `UncLoad`). Concretely, worked Cases B and C in the [walkthrough](../per_customer_view_walkthrough.md#why-it-is-a-model-and-not-a-measurement) show the overstatement is typically in the **2–3×** range for the core+periphery regime that dominates real outages.

Honest framing matters here. This is a **free cushion, not a designed one** — we did not engineer it; it falls out of the data constraint. Three implications:

- It sits *on top of* explicit margin in the retail formula `retail = pure / (1 − ER − TM − UncLoad)` — not in place of it.
- It is **bounded only by market-price discipline**: we cannot price the cushion through if it makes the retail premium uncompetitive. Quotes still have to clear the market.
- It **only insulates the mean**. It provides **no protection against tail or variance risk** from portfolio concentration — see [What about multiple policies in the same county?](#what-about-multiple-policies-in-the-same-county) below, [A007](../assumptions.md#a007--each-policy-is-priced-standalone-no-portfolio-correlation-in-v0), and the dedicated [concentration & portfolio risk doc](../concentration_and_portfolio_risk.md).

## What about multiple policies in the same county?

v0 (and the per-customer layer) prices each policy standalone — see [A007](../assumptions.md#a007--each-policy-is-priced-standalone-no-portfolio-correlation-in-v0). For a portfolio of `N` policies in the same FIPS:

- **Expected portfolio loss is unchanged** by intra-county correlation. By linearity of expectation, `E[Σ payouts] = N · per-policy EL` whether or not policy triggers are correlated. The mean is concentration-invariant.
- **Variance and tail are not.** Under v0's implicit independence assumption, portfolio `Var ≈ N · p(1−p) · X²`. Under the true model (one county event triggers all `N` policies jointly), `Var ≈ N² · p(1−p) · X²` — an `O(N)` blow-up in variance and `O(√N)` in standard deviation. The tail event becomes "with probability `p`, lose `N · X`" rather than "with probability ~`p^N`, lose `N · X`."
- **The overestimation cushion does NOT compensate** for this. The cushion lives on the mean; the concentration problem lives in the second moment. A 3× cushion on EL does not blunt a 10× SD blow-up.

At SMB scale (typical per-county policy counts of 1–3), this is latent — small `N` keeps absolute tail dollars small. **In hazard-prone counties as the book scales (hurricane belt, storm corridors, fire zones), it bites first**, because both `p` and `N` rise together. Treatment paths — concentration loading, reinsurance, capital reserves — are documented in the dedicated [concentration and portfolio risk doc](../concentration_and_portfolio_risk.md) and tracked as a lagged-implementation item on the [roadmap](../roadmap.md#portfolio-concentration-handling-lagged).

## Caveats — what to know before relying on per-customer pricing

1. **A011 is load-bearing — and biased in the conservative direction.** If the synchronous-outage approximation is materially wrong, per-customer pricing is biased. Direction of bias under realistic staggered-restoration conditions (which is most counties): **overestimating** the true per-customer rate, because `mean_customers_out` mixes a small *core* of customers who actually crossed `T` with a larger *periphery* of brief sub-`T` outages, lifting `M` above `N(T)`. This is the **conservative direction for insurance pricing** — it builds a cushion into expected loss rather than a shortfall. The direction can flip only under a knife-edge regime where individual outage durations cluster at or just above `T` (Case D in the [walkthrough](../per_customer_view_walkthrough.md#why-it-is-a-model-and-not-a-measurement)); the realistic core+periphery regime (Case C) sits firmly on the over side.
2. **MCC inherits its caveats.** A modeled, 2023-vintage denominator. Counties with population shifts since the 2023 vintage, or with large/non-uniform utility territories where LandScan-population weighting is a poor proxy for customer density, have larger MCC error bars — and therefore larger multiplier error bars. See [`eagle_i_data_fundamentals.md`](eagle_i_data_fundamentals.md) for the full MCC derivation.
3. **The "customer" unit is not uniform across utilities.** Per Brelsford et al. (the EAGLE-I paper), utilities define "customers" *"in a range of different ways, most typically the electric meter, a building, or a facility."* So a "customer" in our multiplier is *usually* a meter, but for some utilities it is a building or facility. The ratio `mean_customers_out / MCC` is internally consistent within each utility's territory (numerator and denominator share the same source convention), but cross-utility comparisons of the multiplier carry an additional unit-noise term we cannot remove without per-utility unit metadata. Documented as part of [A008](../assumptions.md).
4. **Coverage gate suppresses thin counties.** A county can be priceable at the v0 county level but fail the per-customer gate. We deliberately *do not* surface per-customer prices we don't trust.
5. **All upstream EAGLE-I / event-catalog caveats inherit.** Gap-merge choice, sub-15-min invisibility, inferred restoration — all affect the multiplier as well as the v0 rate.
6. **Bias-correction layer, not a competing model.** Per-customer pricing is structurally tied to v0: it's `λ_county × multiplier`. If v0 changes, per-customer changes with it. The two are not independent estimates.
7. **No portfolio correlation.** Same as v0: each customer is priced independently. A storm that affects 10,000 customers in one county is priced as 10,000 independent policies — no concentration loading.

## How this fits the broader pricing roadmap

Per-customer pricing is the **first bias-correction track** to ship under our three-bucket framework:

| Bucket | What it does | Examples |
|---|---|---|
| **Basis-risk adjustments** | Shrink the v0 county estimate toward the policyholder's true exposure | Per-customer rate (**shipped**), location-level basis risk (**research**) |
| **Trigger source alignment** | Calibrate against the actual live trigger (sensor / utility / vendor feed) | Bridge factor (**blocked on vendor data**) |
| **Forward-regime improvements** | Adjust the historical baseline for climate, grid, hazard | Climate-conditional rates (**planned**) |

See [`roadmap.md`](../roadmap.md) for the full sequencing logic. The key principle: **fix the data-input layer (basis risk) before adding forward-looking layers.**

## One-line takeaways

- **`λ_county × (mean customers out / MCC)`, averaged across qualifying events. That's it.**
- **The number shrinks by 30–100× because most county events affect a small share of the county.**
- **The whole thing rests on the synchronous-outage approximation, which we cannot test from EAGLE-I alone — that's [A011](../assumptions.md).**
- **It's a bias-correction layer, not an independent model. It moves *with* v0, not against it.**

## References

- Pipeline: `curated_outage_data/pipelines/per_customer_rate/compute_per_customer_lambda.py`
- Output: `price_engine/catalogs/<catalog_id>/pricing/per_customer_view.json`
- Deeper walkthrough with Boone, MO worked example: [`per_customer_view_walkthrough.md`](../per_customer_view_walkthrough.md)
- Model card: `curated_outage_data/model_cards/customer_impact_v1.md`
- Assumptions: [`assumptions.md`](../assumptions.md) — A011 in particular
- MCC source and derivation: [Brelsford et al., Nature Scientific Data 2024](https://www.nature.com/articles/s41597-024-03095-5) (§Methods documents the spatial allocation of EIA-861 customer counts via LandScan within HIFLD service territories). Dataset release: [Modeled County Customers 2023](https://openenergyhub.ornl.gov/explore/dataset/modeled-county-customers-2023/).
- Upstream: [`event_catalog_fundamentals.md`](event_catalog_fundamentals.md), [`county_trigger_pricing_fundamentals.md`](county_trigger_pricing_fundamentals.md)
- Roadmap context: [`roadmap.md`](../roadmap.md)
