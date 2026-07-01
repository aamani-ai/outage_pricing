# The high-premium tail — where it comes from, and whether it's real

*Started 2026-06-28. Audience: senior team / underwriting. Question raised: the premium range runs to ~$139k with a
median ~$490; the highest premiums (>$1k, the ~$5k ones) all seem to sit in **low-denominator** counties — are they
real, what's the over-estimation, and what do we do?*

---

## TL;DR — it is NOT the denominator; it is FREQUENCY, and it is largely REAL

We decomposed the actual top counties. The high premiums are driven by **very high county event frequency
`λ_county`**, *not* a broken/low denominator. The share-out (`mean_customers / BASE`) is **tiny** (~1–2%) for these
counties — so the denominator isn't inflating anything via a near-cap share. These are the **worst-reliability rural
counties in the US** (Appalachia WV/KY, Adirondacks NY, Sierra CA, USVI), and the data is **robust** (11 years,
hundreds of events, stable regime) — not small-sample noise. **The premium is high because the risk is genuinely
high.** That is correct pricing, not an error — with a conservative cushion (A011) on top.

**The real issue is eligibility / product economics, not the price:** when a customer's rate ≈ **1 qualifying outage
per year**, the premium ≈ the payout — there is *no risk transfer left to sell*. That is the decision to make.

---

## What actually drives the premium (the chain)

```text
  premium  =  λ_customer  ×  location  ×  forward  ×  X  ÷  (1 − ER − TM)
              └─ λ_county × share-out      │           │
                 (events/yr) (mean frac    │           └─ forward: a CAPPED factor → modest, not a level driver
                              out per event)│
                                           └─ location: MEAN-1 within county (renormalizeMeanOne) → it can only
                                              REDISTRIBUTE inside a county, NEVER raise the county total.
```

So a high *county* premium can only come from **`λ_customer = λ_county × share-out`**. Location and forward are ruled
out by construction. Decomposing `λ_customer` is the whole game.

## The evidence — the top counties are FREQUENCY-driven, not denominator-driven

```text
  county (your example = Doddridge)   BASE    λ_county(≥8h)  share-out   λ_customer(≥8h)   data
  ─────────────────────────────────────────────────────────────────────────────────────────────────
  Doddridge, WV (54017)               4,004      44.8/yr       2.3%          1.04/yr       11 yrs · 498 ev · stable·high
  Clay, WV      (54015)               5,299      72.9/yr       1.6%          1.18/yr       11 yrs · 811 ev · stable·high
  Hamilton, NY  (36041)               7,920      44.7/yr       2.3%          1.04/yr       11 yrs · 493 ev · trend·low
  ─────────────────────────────────────────────────────────────────────────────────────────────────
  TOP-50 by λ_customer:   median BASE 10,348   ·  median share-out 1.1%   ← share-out is TINY (cap is 100%)
  ALL counties:           median BASE 17,289   ·  median share-out 0.4%   ·  median λ_customer 0.10/yr
```

Read it: the top counties' BASE (~10k) is only modestly below the median (~17k) — **the denominator is not the
standout**. The standout is `λ_county` — **40–130 ≥8h events/year** vs a tiny share-out. The premium is high because
the county is in a qualifying outage *often*, each one hitting a small slice — and over a year a given customer is
caught in ~1 of them.

It is **not noise:** these counties have 11 years of history, 490–810 qualifying events, and a *stable, high-confidence*
regime. The rate is robustly measured.

## Is it real? — mostly yes (your instinct was right)

Your read — "4,000 customers, ~45 outages/yr → ~1 outage/customer/yr is not a bad estimate" — is **correct**. Doddridge,
Clay (rural Appalachia), Hamilton (Adirondacks), Tuolumne/Calaveras/Mariposa (Sierra, PSPS country), USVI are *genuinely*
among the worst-reliability places in the country. A customer there really does lose power ≥8h about once a year. The
model is reporting a real signal, not a glitch.

**Where the (conservative) over-estimation lives — ranked:**
```text
  1. A011 share-out (within-event staggering)  → each event's share-out over-states the persistently-out set
        (PoUS sync_ratio 0.53 @8h). Inflates λ_customer ~2× — the CONSERVATIVE direction. KEPT on purpose.
  2. Eventization frequency (λ_county)         → are 45–130 "events/yr" all insurance-relevant, or does chronic
        tiny-outage churn inflate the count? Robustly measured, but the CONTRACT meaning is worth a look
        (→ ../eventization_frequency_contract/). This is the one lever that could move the level materially.
  3. Denominator (BASE)                        → contributes linearly but BASE here is CORRECT-small (real rural
        counties; Doddridge peak_floor 4,004, Hamilton housing_floor 7,920). Not the cause. (A018/A019 already
        excluded the broken-denominator artifacts — those were the $50k–$3M ones, a DIFFERENT problem.)
  ─ NOT location (mean-1, redistributes within county)  ·  NOT forward (capped factor).
```

So: **not location, not forecast.** The level is frequency × a conservative share-out. The premium is directionally
right and mildly over-stated (safe).

## The reframe — this is an ELIGIBILITY question, not a pricing bug

When `λ_customer ≈ 1/yr`, the actuarial premium ≈ `payout × 1 ÷ (1 − loadings)` ≈ **1.5× the payout, every year**. The
customer would pay ~$7.5k/yr for a $5k payout that triggers ~annually. **There is no risk to transfer** — it's
pre-paying near-certain losses plus loadings. That is *why these feel wrong*: not the price, but that a transfer product
stops making sense once the event is near-annual. The high premium is the model **correctly telling us the county is
near-uninsurable at this trigger.**

**The trigger `T` is the lever — and it's contract-chosen:**
```text
  Doddridge WV, λ_customer by trigger:   T=2h → 2.62/yr   T=8h → 1.04/yr   T=24h → 0.39/yr
                                         (near-continuous)  (≈ annual)       (insurable: ~1-in-2.5-yr)
```
Raising the trigger pulls these counties back into an insurable regime. So eligibility is *trigger-dependent*.

## Options (for the decision-maker)

```text
  A. Eligibility GATE     flag/withhold quotes where λ_customer > a threshold (e.g. > 0.5–1.0 /yr at the chosen T):
                          "high-frequency — marginal risk-transfer value." Simple, honest, defensible.
  B. RESTRUCTURE          steer these counties to a higher trigger T (or higher attachment) where λ_customer is
                          insurable. Keeps them quotable with real transfer value.
  C. QUOTE + FLAG         price as-is (it's correct + conservative) but surface a clear "near-annual event,
                          low transfer value" banner so the underwriter decides.
  D. Do nothing           the price is right; accept the tail. (Weakest — leaves a confusing $139k headline.)
```

**Recommendation:** **A + B together, surfaced in the UI** — gate on a per-customer-frequency eligibility band
(carrier-set bound, per the Rules Engine), and show the trigger-T curve so the underwriter can see that a higher trigger
restores insurability. This is a *product/eligibility* control, not a change to the (correct) pricing math.

## What this is NOT

- NOT the denominator bug (A018/A019) — that produced *artifact* $50k–$3M premiums from *broken* MCC and is fixed by
  exclusion. This tail is *real* premiums from *real* high frequency. Different problem, different fix.
- NOT a location or forward miscalibration — both are ruled out structurally (mean-1; capped).
- NOT under-pricing elsewhere — the conservative A011 cushion is global; nothing here suggests we under-state.

## Cross-references

- The estimator level + PoUS validation: [A011](../../methodology/assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation) · the PoUS synchrony probe (`sync_ratio` 1.00→0.53).
- The event-count contract: [`../eventization_frequency_contract/`](../eventization_frequency_contract/).
- Portfolio/tail concentration (separate): [A007](../../methodology/assumptions.md#a007--each-policy-is-priced-standalone-no-portfolio-correlation-in-v0) · `cross_cutting/concentration_and_portfolio_risk.md`.
- The denominator (different problem): [A018/A019](../../methodology/assumptions.md) · [`done/premium_implausibility_investigation/`](../done/premium_implausibility_investigation/).
