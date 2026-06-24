# Duration Conservatism — the answer to Chris's action item

**Status:** closes the 2026-06-19 action item *"verify the duration assumptions are conservative"*
**Last reviewed:** 2026-06-22
**Analysis:** [`../../../notebooks/01_eventization/duration_conservatism_analysis.ipynb`](../../../notebooks/01_eventization/duration_conservatism_analysis.ipynb)

## The question

```text
 STAGE     Step 1: eventization — 15-min snapshots → events, each with a DURATION
 QUESTION  Chris: "I'm comfortable being conservative, but I'm not sure our math suggests
           we're conservative ONLY on the long-duration stuff. Are we undercutting short?"
 ANSWER    Yes, conservative — by direction it's structural; but NOT uniform: strong at 8h+,
           thin and timing-sensitive at 2h/4h. So lead with 8h/12h, flag short-T.
```

## Why the direction is conservative (structural, holds at every T)

A county event's duration spans the window in which **someone in the county** was out. Any
single customer is out for a **subset** of that span. So:

```text
   county-event duration  ≥  any individual customer's outage duration
     ⇒ counting an event "≥ T" over-counts who truly had a ≥T outage
     ⇒ per-customer qualifying frequency is OVER-stated  =  CONSERVATIVE
```

This is the duration side of [A011](../../methodology/assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation);
the per-customer fundamentals bracket the over-statement at **~2–3×**. Chris's specific
"1h + 2h-break + 1h → false long event" cannot happen: the gap tolerance bridges at most three
missing 15-min snapshots (≤45 min), so a 2-hour break **always splits** (A003).

## How much does the eventization knob move it? (bounded ~10%)

Total qualifying events by threshold, as the gap tolerance loosens 30 → 60 min:

| T | gap 30 | gap 45 | gap 60 | 30→60 |
|---:|---:|---:|---:|---:|
| 2h | 6.64M | 6.54M | 6.45M | **−2.9%** |
| 4h | 3.42M | 3.48M | 3.54M | +3.5% |
| 8h | 1.45M | 1.52M | 1.58M | **+9.0%** |
| 12h | 0.80M | 0.85M | 0.89M | +10.4% |
| 24h | 0.27M | 0.28M | 0.29M | +8.8% |

```text
 looser merging  →  FEWER short-T qualifying (absorbs short events)  ← mildly anti-conservative
                 →  MORE  long-T qualifying  (builds long events)    ← more conservative
```

So the duration/merge choice is a **bounded ~10% lever** — the full reasonable range (30→60)
moves λ by only −3% (2h) to +10% (long T). Directly answers *"are we heavily over-weighting
long durations?"* — **no.** And it confirms Chris's mechanism: the knob trades short-T against
long-T, exactly in the direction he intuited.

## The honest short-T caveat

Short thresholds carry the most **boundary mass** — events that barely clear T, where small
timing/cadence changes can flip the count:

```text
 within +30 min of T:   2h 17%  ·  4h 12%  ·  8h 8%  ·  12h 6%  ·  24h 3%
```

At 2h/4h: the structural over-count still makes us conservative, but the margin is **thin**,
the knob is mildly anti-conservative, and un-observable sub-15-min / missed-short outages could
under-count. Net: likely still conservative, but **less certain** — so we don't lead there.

## Verdict by threshold

| T | net read |
|---:|---|
| 2h | conservative but **thin + timing-sensitive** → verify, don't lead |
| 4h | conservative, modest margin |
| 8h / 12h / 24h | **robustly conservative** (strong structural over-count, low boundary mass) |

The cell read now **gates** on this: short triggers (2–4h) surface as **"not established · verify"**
(no cushion claim — the priced mean is duration-blind there), and only **≥8h** shows `well-cushioned`
— [`cell_read_fundamentals.md`](../../methodology/02_per_customer/cell_read_fundamentals.md). This
analysis proves the long-T *direction* (conservative) and bounds the *sensitivity*; the
[short-trigger frequency-recovery discussion](06_short_trigger_frequency_recovery.md) covers the
competing short-T biases (the gate over-counts, but hidden episodes and the diluted mean push the
other way → net uncertain) and the method to resolve them.

## Ceiling — what would make it a magnitude proof

The structural argument proves the **direction** and bounds the eventization **sensitivity**.
It does not measure the exact short-T magnitude — EAGLE-I has no per-customer durations, so we
cannot directly count how many customers were truly out ≥ 2h. That needs **per-outage
durations** (PowerOutage.US / the [A011](../../methodology/assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation)
resolution path). Until then: ship conservative, lead long-T, flag short-T — honest, not overclaimed.
