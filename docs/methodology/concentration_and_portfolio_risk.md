# Concentration and Portfolio Risk — Deep Dive

*Audience: senior team. Last reviewed: 2026-06-03. Status: **lagged implementation, not an immediate threat at SMB scale**. Companion to [A007](assumptions.md#a007--each-policy-is-priced-standalone-no-portfolio-correlation-in-v0) and the [Portfolio aggregation roadmap entry](roadmap.md#portfolio-aggregation--parked-v1).*

## One-paragraph framing

When we write `N` policies in the same county, the **expected** portfolio loss is unchanged by intra-county correlation (linearity of expectation: `E[Σ payouts] = N · E[per-policy payout]`). What *does* change is the **second moment** — the variance, and the tail. v0 implicitly prices each policy as if outage triggers were independent across policies, whereas in reality a single county-level outage triggers *all* policies in that county simultaneously. The mean is invariant; the tail is not. The per-customer overestimation cushion (see [A011](assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation) and the [per-customer fundamentals doc](fundamentals/per_customer_pricing_fundamentals.md)) lives on the **mean**, not on the variance — it provides **zero** protection against the concentration-induced tail blow-up. Tail risk needs its own treatment: a concentration loading, reinsurance, or capital reserves.

## The mean-vs-tail split — math

Let `p = Pr(individual policy triggers in a given year)` and `payout = X`. Consider `N` policies in the same county.

### Expected portfolio loss (concentration-invariant)

```text
E[total loss] = E[ Σ_{i=1..N} X · 1_{i triggers} ]
              = X · Σ_{i=1..N} Pr(i triggers)
              = N · p · X
```

By linearity of expectation, this holds **whether or not** the `1_{i triggers}` indicators are correlated. v0's per-policy expected-loss pricing is *correct on the mean* for portfolios as long as `p` (the per-customer trigger probability) is correct.

### Portfolio variance (concentration-explosive)

Under v0's implicit independence assumption:

```text
Var_indep[total loss] = Σ_i Var[X · 1_i] = N · p(1−p) · X²
```

Under the true joint-trigger model (one county event triggers all `N` policies simultaneously), the indicator vector collapses to a single Bernoulli scaled by `N`:

```text
Var_true[total loss] = Var[ X · N · 1_{county event} ]
                    = N² · p(1−p) · X²
```

The variance ratio is `N` (linear in policy count). The standard deviation ratio is `√N`. For `N = 100`, the true portfolio standard deviation is **10×** the independence-implied one. The tail event is no longer "with probability ~`p^N`, lose `N · X`" (vanishingly small) — it is "with probability `p`, lose `N · X`" (an order-of-magnitude bigger problem).

## Worked example — 100 policies in one county, p = 0.30, X = $500

Suppose 100 SMBs in the same hurricane-belt county each carry a $500 payout, and the per-customer annual trigger probability is `p = 0.30`.

| Metric | Independent-policy model (v0 implicit) | True joint-trigger model |
|---|---|---|
| E[total loss] | 100 · 0.30 · $500 = **$15,000** | **$15,000** *(unchanged)* |
| Var[total loss] | 100 · 0.30 · 0.70 · $500² = $5,250,000 | 10,000 · 0.30 · 0.70 · $500² = **$525,000,000** |
| SD[total loss] | ≈ **$2,291** | ≈ **$22,913** |
| Tail event | ~0 probability of all 100 hitting | **30 % probability** of all 100 hitting → loss = **$50,000** in a single year |

The mean ties out. The standard deviation is 10× higher. The one-year `$50,000` loss — over 3× the annual expected loss — is a **routine** outcome in the true model (it happens whenever a county event lands), not a freak tail event. This is where capital reserves and reinsurance live.

## Why the overestimation cushion does not help

The per-customer multiplier `M/MCC` typically overstates `N(T)/MCC` under realistic core+periphery staggered restoration (see [A011](assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation) and the [per-customer fundamentals doc §Caveats](fundamentals/per_customer_pricing_fundamentals.md#caveats--what-to-know-before-relying-on-per-customer-pricing)). That cushion is real — it gives roughly 2–3× over expected loss in typical cases — and is the *conservative* direction for insurance.

But it is a cushion on the **mean**. The cushion compounds with the explicit margin (TM, ER, UncLoad) to push the retail price above pure EL. It does **not** add anything to the **variance** of portfolio outcomes. A 3× cushion on EL does not blunt a 10× SD blow-up from concentration; in fact it leaves the *coefficient of variation* (SD / EL) worse, not better. Tail risk needs explicit treatment.

## Treatment paths

Three standard tools, ordered roughly by implementation cost:

1. **Concentration loading.** A surcharge on policies written into counties where the book is already concentrated. Easiest to implement: requires an exposure table per FIPS and a loading curve (e.g. linear in `N` per FIPS, or capped per hazard tier). Lives inside the retail price formula. No external capacity needed.
2. **Reinsurance.** Cede the tail above a per-county or per-event retention to a reinsurer. The reinsurer prices the *joint* trigger probability and charges a premium for absorbing it. Requires a portfolio event-loss table (YLT / event_loss_table — see the [Portfolio Risk Engine Plan](../plan/portfolio_risk_engine_plan.md)) and a market relationship. Externalizes the tail but pays for it.
3. **Capital reserves.** Hold capital against a TVaR / OEP percentile of the portfolio annual loss distribution. Requires the same YLT machinery as reinsurance, plus a regulatory or internal capital framework. Internalizes the tail without paying an external premium, but ties up balance sheet.

A mature program combines all three: capital sized to a chosen percentile, reinsurance above that point, and concentration loading at point of sale to discourage further accumulation in hot counties.

## Why this is a lagged-implementation track

At SMB scale, the typical per-county policy count is small — often 1–3, occasionally up to ~10. The `N²` term in the variance dominates *only* when `N` grows large enough that `N · Var_independent < Var_true`, which is true at any `N > 1` mathematically, but only becomes a *materially scary* number when `N · X` is large in absolute dollars. At `N = 3`, `X = $500`, the worst-case single-county loss is `$1,500` — manageable.

**Where it bites first as the book scales:**

- **Hurricane belt** (TX–FL gulf coast, NC/SC outer banks): named-storm events trigger thousands of customers at once, with `p` itself elevated in hurricane years.
- **Storm corridors** (Tornado Alley, Great Lakes / Northeast ice belt): convective and winter storms produce wide-area triggers.
- **Fire zones** (CA, OR, WA wildland-urban interface): PSPS de-energizations are explicitly geographic, often county-scale, with high `p` in fire-season months.

For a uniformly-spread book, concentration is latent. For a book that organically clusters in any of the above zones, concentration becomes the dominant risk well before the mean-pricing layer even matters. The activation trigger is therefore not a chronological milestone but a **threshold on policies-per-county in any hazard-tiered county** — e.g. "any hazard-prone county with `N ≥ 10`, or any non-hazard county with `N ≥ 50`."

## Sequencing

| Phase | What | When |
|---|---|---|
| **Now (v0)** | Document as [A007](assumptions.md#a007--each-policy-is-priced-standalone-no-portfolio-correlation-in-v0). Track exposure-per-FIPS even if not used in pricing. | Shipped. |
| **Trigger** | Avg policies-per-county in any hazard-prone county exceeds threshold (target: 10), **or** book passes total-policy threshold (target: 1,000). | Monitored. |
| **v1 — concentration loading** | Add per-FIPS loading curve to retail formula. Hazard tiering from existing hazard-modifier research. | Lagged, triggered by threshold above. |
| **v1+ — portfolio YLT** | Build the event_loss_table / year_loss_table machinery in the [Portfolio Risk Engine Plan](../plan/portfolio_risk_engine_plan.md). Enables AAL / OEP / AEP / TVaR. | Parallel track once concentration loading is live and reinsurance conversations begin. |
| **v1++** | Reinsurance / capital framework on top of the YLT. | Externally triggered (reinsurer / capital-provider conversations). |

## Cross-links

- [A007 — Each policy is priced standalone (no portfolio correlation in v0)](assumptions.md#a007--each-policy-is-priced-standalone-no-portfolio-correlation-in-v0)
- [A011 — Per-customer multiplier rests on a synchronous-outage approximation](assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation)
- [Per-customer fundamentals — Overestimation as a conservative cushion](fundamentals/per_customer_pricing_fundamentals.md)
- [Roadmap — Portfolio aggregation (parked, v1)](roadmap.md#portfolio-aggregation--parked-v1)
- [Portfolio Risk Engine Plan](../plan/portfolio_risk_engine_plan.md)
- [Per-Customer Pricing Plan §How this interacts with future product layers](../plan/per_customer_pricing_plan.md)
