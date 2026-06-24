# Premium Band — Pressure Test: Confidence vs Experience (decision OPEN)

- **Status:** discussion / decision-support · **decision OPEN** — gathering team feedback before any dashboard change
- **Date:** 2026-06-24
- **Owner:** outage pricing analytics

**TL;DR.** The displayed price band `{low, point, high}` can be computed three ways. They differ *a lot*
in width, and each is defensible for a different reason. **The point premium is identical in all three**
— only `low`/`high` change. This note lays out the evidence so we can decide; it does **not** decide.

---

## The question

The premium shows as a band, not a single number. **How should `low`/`high` be computed?** All candidates
carry linearly through `premium = λ·X/(1−ER−TM)`, so they leave the point premium untouched.

## Three candidates

```text
  v1  CONFIDENCE   bootstrap of the MEAN annual rate      "how precisely do we know the average?"   ◀ SHIPS TODAY
                   (standard error ≈ spread ∕ √years)         narrow; collapses for high-volume counties

  v2  EXPERIENCE   empirical p10/p90 of the annual counts  "how much does an actual YEAR swing?"
                   (the realized year-to-year bounce)         the 80% of years; wide; shows storm years

  v2b EXPERIENCE   empirical p25/p75 of the annual counts  "the middle HALF of years"
                   (a trimmed bounce, interquartile)          middle ground; HIDES the storm-year tail
```

Why the v1 vs v2 gap is structural, not a tuning knob: a bootstrap of the *mean* is the standard error
of the average ≈ (year-to-year spread) ∕ √(years). With ~11 years, √11 ≈ 3.3 — so the experience band
is ~3× wider *by construction*. v1 answers a different question (precision of the average) than an
annual policy actually faces (the swing of one year).

---

## What the data says — T=8h · 3,032 counties · `eagle-i-45min`

### Table A — how wide are the bands? (share of counties in each width band)

```text
  band width                 v1 confidence    v2 p10/p90    v2b p25/p75
  ±<5%   absurdly tight             3%             0%            2%
  ±5–15%  tight                    32%             4%           18%
  ±15–25% "reasonable"             34%            10%           25%
  ±25–45% wide                     23%            26%           33%
  ±>45%   very wide                 7%            60%           22%
  ───────────────────────────────────────────────────────────────────
  median ±                        ±19%           ±53%          ±27%
```

### Table B — the same counties, in dollars (illustrated on a $326 point)

```text
  county                          v1 (shipped)      v2 p10/p90        v2b p25/p75
  Wake NC   (steady, huge n)      $321–$331         $310–$342         $318–$337
  Pasco FL                        $315–$337         $291–$348         $324–$343
  Manatee FL                      $306–$346         $271–$373         $294–$367
  Alachua FL (volatile)           $277–$379         $190–$483         $204–$456
  Clayton IA (thin, ~6/yr)        $282–$370         $217–$489         $244–$435

  the TYPICAL v1 county (≈ the "$264–$388" example): v1 $263–$387  →  v2 $202–$474  (+45/−38%)
```

---

## Findings — what the tables actually tell us

```text
  1. v1 is NOT broadly broken.   Median ±19%; 69% of counties within ±25%. The "$264–$388 on $326"
                                 band is the TYPICAL v1 county and looks reasonable. v1's real flaw is
                                 CONCENTRATED false-precision at the tight tail — Wake NC at ±2% claims
                                 we're 80% sure an annual outage price is within ±2%. That is indefensible.

  2. v2 (p10/p90) over-corrects. 60% of counties blow out past ±45% ($190–$483). Honest about the year
                                 swing, but commercially reads as "we don't really know the price."

  3. v2b (p25/p75) has a TRAP.   Median ±27% looks like the sweet spot and it fixes the absurd cases —
                                 BUT it hides the storm-year tail. For Pasco it is even NARROWER than v1
                                 ($324–$343). For OUTAGE insurance the storm years are the thing being
                                 priced; trimming them is the dangerous direction (under-reserving).

  4. The real decision is the    Not "v1 vs v2." It's HOW MUCH of the year-to-year tail to show — a dial
     TAIL / DEPTH dial.          from p25/p75 (clean, hides storms) to p10/p90 (honest, wide). v1's defect
                                 is that ÷√years collapses that dial to ~nothing for rich counties.
```

## What to weigh (for the feedback round)

```text
  · WHO is the band FOR?    a buyer wants a clean "likely range"; an underwriter wants the storm tail visible.
  · Is ±2% defensible?      v1 implies ~80% confidence the price is within ±2% for steady counties.
  · How much tail to show?  p25/p75 hides storm years; p10/p90 shows them but is wide. Where is the line?
  · One band or two?        option: headline the middle-half AND mark a "tough year" separately — two reads
                            kept distinct (communicate_to_share), instead of one compromise number.
  · Which error is worse?   for insurance, hiding the tail UNDER-reserves; an over-wide band loses deals.
```

## Honesty — what this is and isn't

```text
  · All numbers are T=8h on the source-coverage-masked annual series; other triggers shift widths
    (longer T → wider). The pattern (v1 < v2b < v2) holds across T.
  · Relative bands are mapped onto a $326 point purely for tangibility; the point premium is identical
    across all three candidates.
  · Thin-history counties (<5 observed years) are noisy under EVERY method and are already routed to
    `insufficient` / point-quote suppressed — not in scope of this choice.
  · Reproduce: `scratchpad/band_pressure_test.py` (to be formalized in `notebooks/premium_range/`).
```

## Status of the rest of the band write-ups

The experience-band documents — [A017](../../methodology/assumptions.md), the band section in
[`pricing_methodology.md`](../../methodology/cross_cutting/pricing_methodology.md), and the
[build plan](../../plan/cross_cutting/premium_experience_band_plan.md) — describe the **proposed**
change. They are **proposals under this pressure-test, not adopted.** **v1 still ships. Nothing changes
on the dashboard until this decision is made.**

## Cross-references

- Range design + the three-uncertainty framing: [`07_outward_range.md`](07_outward_range.md).
- Assumption (estimator under review): [A017](../../methodology/assumptions.md).
- Clustering finding (why the bounce is wide): [`premium_range_clustering.md`](../../learning_logs/premium_range_clustering.md).
- Build plan (gated on this decision): [`premium_experience_band_plan.md`](../../plan/cross_cutting/premium_experience_band_plan.md).
