# Premium implausibility — investigation findings & remediation plan

**Type:** investigation (findings → plan). **Date:** 2026-06-28. **Owner:** outage pricing.
**Trigger:** the Analytics Studio QC surfaced both a **$3M outlier** (Henderson NC) and an **unreasonable median**
(~$562/yr for an 8h/$2,500 policy). This traces *why*, with data, and plans the fix + how to surface it.
**Evidence:** `curated_outage_data/outputs/per_customer_rate/per_customer_lambda__eagle-i-45min.parquet`,
`price_engine/data/events.parquet`, `price_engine/data/raw/MCC.csv`. Method: see [pricing chain](#the-pricing-chain).

---

## TL;DR — two separate causes

```text
  1. THE EXTREME OUTLIERS ($50k–$3M)  =  a DATA BUG — broken MCC (customer-base denominator).
        a handful of counties have MCC = 1, 4, 6, 16, 24 … → mean_customers/MCC explodes past 100%.
        CLEAR FIX, do now.
  2. THE "UNREASONABLE" MEDIAN        =  the MEAN estimator over a heavy-tailed, any-customer-out event set.
        theoretically correct for expected loss, but it's the known per-customer over-pricing concern (A011).
        NOT a quick bug; it's the per-customer bias-correction track, now quantified.
```

## The pricing chain

```text
  λ_county(T)   = n_qualifying(dur ≥ T) / observation_years          annual count of ≥T county events
  multiplier    = mean over those events of  mean_customers / MCC    avg fraction of the county's customers out
  λ_customer    = λ_county × multiplier                              the priced per-customer rate
  premium       = λ_customer × X ÷ (1 − ER − TM)
```
Inflation can therefore enter only via (a) too many qualifying events, or (b) a multiplier that's too high —
and a multiplier **> 1 is physically impossible** (more customers out than exist).

---

## Finding 1 — broken MCC denominator (the extreme outliers)

The 6 counties with an impossible `multiplier > 1` — they hold the entire >$50k premium tail:

```text
  county          MCC    λ_county(8)   multiplier(8)   λ_customer(8)   peak-ever-out / MCC
  Henderson NC     24       180.2          3.97            715           131,460 / 24  = 5,478×
  Buena Vista VA    1         3.0         37.12            110             1,930 / 1   = 1,930×
  Waynesboro VA     6        10.8         23.37            253             9,737 / 6   = 1,623×
  Niobrara WY       4         4.3          1.70              7               683 / 4   =   171×
  Lexington VA     16         2.3          5.52             13             1,952 / 16  =   122×
  Jeff Davis TX    44        11.8          0.98             12             2,358 / 44  =    54×
```

**Mechanism.** `MCC.csv` (the modeled customer count) has garbage values for a small set of counties — confirmed
in the raw source file (Henderson NC literally reads `24`). `multiplier = mean_customers / MCC`, so a denominator
that's ~1000× too small makes the per-customer rate ~1000× too big. Henderson's own data proves it: up to
**131,460 customers out in one snapshot**, but MCC says **24**.

**Scope (tiers of "broken"):**
```text
  multiplier > 1 (impossible) ............  6 counties   ← the explosive outliers
  MCC < 10% of own observed peak (severe)  23 counties   ← unambiguous garbage denominators
  MCC < 1,000 customers ................... 125 counties  ← implausibly small; review
  MCC < own observed peak ................. 661 counties  ← soft signal (some legit near-total storm outages;
                                                            indicates MCC is an unvalidated denominator)
```
This is a **source-data quality problem**, not a pricing-logic error. The pricing math is correct given the inputs.

---

## Finding 2 — the "unreasonable" median is the estimator, not a bug

Among the **sane** counties (multiplier ≤ 1), at 8h / $2,500:

```text
  estimator                       median λ_customer    → median premium
  MEAN   (mean_customers/MCC)          0.117                $449       ← today's headline
  MEDIAN (robust)                      0.021                $ 82
  multiplier:  mean 0.0052  vs  median 0.0008   →  the mean is ~5–6× the median
```

**Mechanism.** Qualifying ≥8h events skew toward **severe storms** (heavy right tail of `mean_customers`). The
**mean** over them is the *expected* fraction of customers affected — which is **theoretically correct for
expected-loss pricing** (median would *under*-price). So this is **not a simple bug**: it's the long-standing
**per-customer over-pricing question (A011)** — does the mean-over-qualifying-events overstate a typical
customer's exposure? — now **quantified at ~5×**. Two inputs feed the doubt:
- **event definition** counts *any* customer out (`customers_out > 0`) → λ_county(T) counts many small localized
  outages as county "events" (median 22 ≥8h events/yr/county).
- **selection** on qualifying events biases `mean_customers` upward.

Resolving the *level* needs external validation (PowerOutage.US / the per-customer plan), not a unilateral switch
to the median. The investigation's contribution: the level is **highly estimator-sensitive**, and that sensitivity
is now measured.

---

## Remediation plan

### A — MCC bug (do now; small, high-impact)
```text
  A1  GUARDRAIL  cap multiplier at 1.00 in compute_per_customer_lambda  →  kills every >100%-out explosion.
  A2  DQ GATE    flag/exclude counties where MCC is implausible:
                   hard:  multiplier>1  OR  MCC < 10% of observed peak   (≈23–30 counties) → EXCLUDE + reason "MCC invalid"
                   soft:  MCC < observed peak                            → review flag
  A3  FIX SOURCE replace the broken MCC with a validated base (Census households, or observed-peak as a floor),
                 then re-emit pricing.json. Re-verify the Analytics tails collapse.
  A4  ASSUMPTION register an MCC-validity assumption (A0xx) in methodology/assumptions.md.
```

### B — systemic level (the per-customer track; team decision)
```text
  B1  Fold the ~5× mean/median gap into the per-customer bias-correction work (per_customer_pricing_plan, A011).
  B2  Validate the multiplier against PowerOutage.US (the existing shrink candidate) to pin the true per-customer
      exposure; decide the estimator (mean vs trimmed/credibility-shrunk) from that, not from intuition.
  B3  Revisit whether "any customer out" is the right county-event definition for the per-customer rate
      (a severity floor would cut the localized-outage inflation) — eventization choice B.
  DO NOT silently switch to the median (it under-prices expected loss). This is a methodology call, documented.
```

### How to reveal it (in the product)
```text
  · Analytics Studio QC already surfaces the outliers (highest-priced watch) — add an explicit "MCC invalid"
    exclusion reason so an underwriter sees WHY, and the county drops out of the offered book (like insufficient-data).
  · County Explorer: show MCC vs observed-peak so the broken denominator is visible per county.
  · Keep the honest framing: excluded ≠ $0; the level question is flagged as under-validation, not "final".
```

## Sequencing
```text
  NOW    A1 cap + A2 exclude broken MCC  → the $50k–$3M tail disappears; book becomes defensible.   (small)
  NEXT   A3 source fix + A4 assumption + reveal in QC/explorer.                                      (small–med)
  THEN   B  per-customer level validation (PoUS) — the real "is the median right?" answer.           (research)
```

## Appendix — reproduce
`scratchpad` queries over the three sources above; key checks: `multiplier_mean>1` count (6), MCC tiers
(5/12/125 under 10/100/1000), `MCC < peak_observed` (661; <10% peak = 23), mean-vs-median premium ($449 vs $82).
