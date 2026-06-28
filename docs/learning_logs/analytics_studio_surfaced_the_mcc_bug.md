# How the Analytics Studio Caught a Pricing Bug Single-County View Never Would

Date: 2026-06-28

## Why this note exists

We built the Analytics Studio as a breadth/QC tool — price the *whole book* at once instead of one address
at a time. On its **first run** it surfaced two things the single-county Pricing/Studio views had shown for
months without anyone noticing: a **$3,000,000** premium (Henderson NC) and a **median that's too high**
(~$562/yr for an 8h/$2,500 policy). Tracing both to root cause turned into one of our best findings. The
lesson is general: *some defects are only visible in aggregate — build the view that shows the distribution,
not just the point.*

```text
  one-at-a-time:  every single county "looked fine" — a number, a waterfall, a regime label.
  all-at-once:    sort 3,000 by premium → a $3M outlier and a long tail SCREAM. QC = breadth.
```

## The chain of reasoning (number → source data)

```text
  1. Analytics QC highest-watch:  Henderson NC = $3M; ~17 counties absurd; median feels high too.
  2. trace the formula:  premium = λ_county × (mean_customers / MCC) × X ÷ (1−ER−TM).
                         a multiplier (mean_customers/MCC) > 1 is IMPOSSIBLE → the denominator must be wrong.
  3. look at MCC:  Henderson's MCC = 24 customers … in a 120k-person county. 6 counties have MCC = 1,4,6,16,24.
                   confirmed in the raw source file — a DATA bug, not a pricing-logic bug.
  4. find the right denominator:  compare MCC to Census ACS → the right basis is HOUSING UNITS (B25001),
                   not households: utility customers ≈ every home incl. SEASONAL/vacation (each has a meter).
                   MCC/housing-units ≈ 1.10 (r 0.976). [First tried households (×1.324) and it left the
                   seasonal-home counties — Adirondacks/Sierra — over-priced; caught only by re-checking.]
  5. separate the second problem:  even on sane counties the MEDIAN premium is the MEAN estimator over
                   qualifying events ($449) vs the median estimator ($82) — a ~5× gap. That's the known
                   per-customer over-pricing question (A011), now quantified — a DIFFERENT issue, not a bug.
```

## What it produced

```text
  · a validated denominator fix — base = max(MCC, housing_units, peak); exclude where peak-out exceeds any
    plausible base (numerator corrupt); cap each event ≤ 1. (docs/dicsscssion/premium_implausibility_investigation/)
  · a systematic data-quality gate — "MCC must be consistent with Census households" flags ~83, not just patches 6.
  · a real systematic signal — a cluster of NORTH CAROLINA counties have broken MCC (Charlotte 16× too small),
    i.e. a utility-level gap in EAGLE-I's NC source, not random noise.
  · the level question routed to the per-customer / PoUS validation track, where it belongs.
```

## The meta-lessons

```text
  · BUILD THE BREADTH VIEW. A QC tool that shows the whole distribution finds what point-views hide.
    The cheapest bug-finder we have shipped is "sort everything and look at the tails."
  · TRACE A NUMBER TO ITS SOURCE DATA before trusting OR blaming the model. The math was correct;
    the input (MCC) was garbage. An "impossible" intermediate (multiplier > 1) is a gift — it localizes the bug.
  · FIX TO THE RIGHT THING, not a v0 patch. We resisted "just cap it" (still leaves nonsense) and
    "just exclude them" (throws away Charlotte) — and validated a real denominator (Census households) first.
  · TWO SYMPTOMS, TWO CAUSES. The outliers (data bug) and the level (estimator/A011) look related but aren't;
    conflating them would have mis-fixed both.
  · VERIFY BEFORE ASSERTING — and verify on the SUB-POPULATION that can break it. I picked households as the
    denominator, saw r=0.977, called it "validated," and told Divy the leftover high-premium counties were
    "clean, just high-frequency." Both wrong: utility customers ≈ HOUSING UNITS (seasonal homes have meters),
    and the leftovers were exactly the seasonal counties households under-counts. A ratio can look validated in
    aggregate and still be wrong where it matters. Never claim "fixed/clean" without checking the actual cases.
    (→ feedback memory: verify-before-asserting. The denominator concept: dicsscssion/.../02_understanding_the_denominator.md)
```

## Recorded as

Investigation + decision: [`dicsscssion/premium_implausibility_investigation/00_findings_and_plan.md`](../dicsscssion/premium_implausibility_investigation/00_findings_and_plan.md)
and [`01_denominator_fix.md`](../dicsscssion/premium_implausibility_investigation/01_denominator_fix.md). Analysis:
`mcc_vs_census.py` → `mcc_vs_census_county.csv`. Level question: [per-customer pricing plan](../plan/02_per_customer/per_customer_pricing_plan.md) (A011).
