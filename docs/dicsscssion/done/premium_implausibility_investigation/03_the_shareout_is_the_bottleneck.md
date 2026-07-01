# 03 — The share-out is the bottleneck now (the estimator question)

**Type:** finding (what's left after the denominator fix in [`01`](01_denominator_fix.md) / [`02`](02_understanding_the_denominator.md)).
With the base fixed, the per-customer **level** hangs on one remaining number — the **share-out** — and *how we
estimate it* is the open question. This note makes that concrete with a real county. Routes to assumption **A011**.

---

## Where the premium comes from (one line)

```text
  premium  =  λ_county  ×  SHARE-OUT  ×  X  ÷  (1 − ER − TM)
                 │            └ the fraction of the county's customers an event takes out, on average
                 └ how many qualifying ≥8h events the county sees per year   (well-grounded, just counting)
```

`λ_county` is just counting events — we trust it. `X`, `ER`, `TM` are policy terms. **Everything uncertain about
the per-customer level is in the share-out.** That's why it's the bottleneck.

---

## What the share-out actually is

```text
  share-out  =  MEAN over the county's qualifying ≥8h events of ( mean_customers_out_during_event ÷ base )
```

It is a **mean of a per-event fraction**. And the per-event fraction is **heavy-tailed**: most ≥8h outages are
small/localized (a few homes on one feeder); a few are real storms that take out a big slice of the county. A mean
over a heavy tail is **pulled up by the rare big events**.

---

## Worked example — Doddridge, WV (54017), the "45 events / 2.33%" county

```text
  λ_county = 45 qualifying ≥8h events/yr      base = 4,004 (housing-units / peak floor; MCC 3,891, HU 3,279)

  per-event customer fraction across its 500 observed ≥8h events:
     TYPICAL (median) event   ████                      0.66%   ← a normal localized outage
     MEAN  (= the share-out)  ████████████              2.33%
     p90 event                ███████████████████████   5.95%
     worst event              ███████████ … █████████  64.92%   ← a county-wide storm

  the top 10% of events average 12.6% — they alone drag the mean from 0.66% → 2.33% (3.5×).

  λ_customer = 45 × 2.33% = 1.05 / yr
  premium with MEAN share-out:   $4,016        with MEDIAN share-out:   $1,141     ← a 3.5× lever
```

So the share-out is "still high" **not because of a bug** — the denominator is correct now — but because it is the
**mean** of a heavy-tailed event distribution, and a handful of genuine storms set the level.

---

## The real question: is the MEAN the right estimator?

```text
  FOR the mean:   it is the textbook estimator of EXPECTED LOSS. E[fraction out] = the probability a random,
                  average customer is out in a given event. The MEDIAN would systematically UNDER-price.

  AGAINST it:     it conflates two physically different events —
                    · county-wide storm  → a given customer really is out      (correctly counted)
                    · localized fault     → a given customer probably is NOT   (the small fraction down-weights it)
                  …which is fine for an AVERAGE customer, but customers aren't uniform: the same vulnerable feeders
                  go out repeatedly. The mean over-states for the lucky majority and under-states for the unlucky few.
                  (per-customer heterogeneity = exactly the A011 / "mean-over-qualifying-events" question.)
```

```text
   ESTIMATOR        Doddridge share-out      premium      reads as
   ────────────────────────────────────────────────────────────────────────────────────
   mean (today)         2.33%                $4,016       expected loss for an average customer
   median               0.66%                $1,141       the typical event — UNDER-prices expected loss
   trimmed / capped     ~1–1.5% (tbd)        ~$2–2.6k     storm-robust middle ground (not yet chosen)
```

---

## What we do NOT do

```text
  · NOT switch to the median. It under-prices expected loss — the dangerous direction. The mean isn't "wrong,"
    it's "unvalidated at the customer level."
  · NOT hand-tune per county. The fix has to be a principled estimator + a ground truth, not a knob per Doddridge.
```

## The path (Finding 2)

```text
  1. VALIDATE against PowerOutage.US: does a Doddridge customer actually experience ~1 qualifying ≥8h outage/yr?
     PoUS gives per-customer / sub-county truth EAGLE-I can't. (NDA trial already confirmed 64% of live outages
     hit ≤1 customer — directly relevant to the localized-vs-storm split above.)
  2. Only then choose the estimator (mean vs trimmed vs a heterogeneity-aware model) against that truth.
  3. The lever is large ($4k vs $1.1k on Doddridge), so it's worth doing properly — not patched.
```

This is now **the** main open item for the per-customer *level*. Denominator: solved. Frequency (λ_county): trusted.
Share-out estimator: the bottleneck — **A011**, validated via the PoUS track.

---

*Surfaced 2026-06-28 from the County-explorer high-side counties (Doddridge / Clay / Lincoln WV). Companion to the
denominator fix; see [`02_understanding_the_denominator.md`](02_understanding_the_denominator.md) for why the base is housing units.*
