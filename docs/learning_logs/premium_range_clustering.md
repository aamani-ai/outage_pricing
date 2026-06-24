# The Premium Range, and Why Storm Clustering Changes It

Date: 2026-06-23

## Why This Note Exists

The dashboard shows a premium as a **range**, not a false-precise point. We had to answer *what the
range means* and *how to compute it honestly* — and we nearly shipped a version that quietly lied.

The first cut put a textbook **Poisson** interval on the count of observed outages. It looked clean
and behaved sensibly (wider band at longer triggers). But outages **cluster** — one storm causes many
correlated outages — and Poisson assumes they don't. When we measured it, Poisson was **overconfident
by ~2× on average, and up to 8–10× for storm-prone counties.** This note records that finding, the
fix, and the discipline of shipping a *reasonably logic-oriented v1* rather than looping forever.

```text
  the trap:   a confidence band that is TOO TIGHT reads as "we're very sure" — the opposite of honesty.
  the lesson: for clustered events, count-based confidence (Poisson) is the wrong default.
```

> **Update (2026-06-24) — v1 shipped the *confidence* band; an *experience* band (v2) is proposed (decision OPEN).** Everything
> below describes v1: a **bootstrap of the mean annual rate**, which is the standard error of the average
> (≈ spread ∕ √years). It ran **~2.9× too tight** — and it contradicted this log's own "STEP 2 — THE
> RANGE" pitch (*"how much those yearly counts SWING year to year"*), which was the experience framing
> all along. The experience proposal makes the math equal the pitch: the band would be the **empirical p10/p90 of the annual
> counts themselves** — the bounce, not the bounce ∕ √years. The clustering finding below is still
> exactly why that bounce is wide. There is one further irony worth stating plainly: v1's "bootstrap"
> *was* a bootstrap, but of the **mean** — so it measured how well we know the average, not how much a
> year swings. The proposal drops the bootstrap entirely (`np.percentile(counts, [10, 90])`).
> **Decision is OPEN — three candidates (confidence / experience p10–p90 / experience p25–p75) are compared in**
> [`08_band_pressure_test.md`](../dicsscssion/dashboard_redesign/08_band_pressure_test.md). See
> [A017](../methodology/assumptions.md) (estimator under review) and the build plan
> [`premium_experience_band_plan.md`](../plan/cross_cutting/premium_experience_band_plan.md).

## What the range actually represents — three different uncertainties

The hardest part was realizing "the range" is **not one thing**. Three different uncertainties were
being conflated:

> *v2 note (read with the update above): under v2, **(a) is now the experience band** — realized
> year-to-year volatility, which does **not** shrink with data. The "confidence / epistemic" labels in
> the block below are the original v1 framing, kept for the reasoning trail.*

```text
  (a) CONFIDENCE     how sure are we of the county's average rate?          → THE BAND
                     (epistemic; shrinks as we observe more)
  (b) HETEROGENEITY  how much does frequency vary by location IN a county?  → a POSITION read, not the band
                     (structural; the per-customer multiplier median..max)    (the old dashboard's range)
  (c) PLACEMENT      where in (b) does THIS address sit, how sure?          → the GATE that resolves (b)
                     (location relativity + geocode precision)
```

They are not rival answers — they answer different questions. The old per-customer dashboard showed
**(b)** as *the* range because it was a *county-level* tool that hadn't resolved a specific address.
The new dashboard resolves the address (c), so **(b) becomes a position read** ("this address is in
the upper third of its county") and the **band becomes (a) confidence**. Composition:

```text
  band = (a) confidence, widened by the unresolved part of (b) when (c) placement is weak.
```

Per `principles/communicate_to_share.md` (split orthogonal questions, never one blended score):
**confidence and heterogeneity stay two separate reads.** A wide band from "we're unsure" demands a
different underwriter action than a wide band from "this county is very heterogeneous."

## The discovery: outages cluster, hard

We measured the **dispersion index** — `var / mean` of each county's annual qualifying-event counts
(on the source-coverage-masked series). For independent events (Poisson) this is ≈ 1. For clustered
events it's > 1.

```text
   T      median var/mean    % of counties overdispersed (>1)
   2h          12.6                      98%
   4h           9.0                      97%
   8h           5.0                      94%      ← the primary trigger
  12h           3.2                      91%
  24h           1.8                      81%
```

At T=8h the typical county's annual outage count varies **5× more** than Poisson assumes. Clustering
is strongest at short triggers (more events, more storm-bundling) and weakens at long triggers (rare,
more independent) — but it's pervasive everywhere.

## Why Poisson-on-K fails, in one line

```text
  Poisson treats each of the K outages as an independent draw.
  But a storm delivers a dozen outages at once → the EFFECTIVE number of independent
  "trials" is far smaller than K → the true band is far WIDER than Poisson says.
```

The band-width comparison confirmed it directly (80% bands):

```text
  OVERALL (T=8h):  the year-based band is a median 2.1x the Poisson band  (p25 1.4x, p75 3.0x)
  storm-clustered county (var/mean ~65):  Poisson said +/-7%,  reality +/-53%   (~8x too tight)
```

*(That 2.1× is Poisson vs the v1 year-based **bootstrap**. The later v1→v2 step — bootstrap-of-the-mean
→ the raw year-to-year spread — adds a **further ~2.9×**; see the update at the top.)*

## The v1 we shipped: a year-based bootstrap (overdispersion-aware)

Instead of trusting the count, **use the year-to-year variation we actually observed**:

```text
  1. take the observed annual qualifying-counts for this county x trigger (the ~11-year series)
  2. bootstrap the mean annual rate over those years (resample years, 80% interval)
  3. carry that band linearly through  premium = lambda * X / (1 - ER - TM)
```

Why this is the right v1:

```text
  + uses REAL observed variability → captures clustering automatically (no independence assumption)
  + no fitted distribution → consistent with the v0 empirical method
  + still widens at longer triggers and for thinner counties (the behavior we want)
  + reasonably logic-oriented — not a research project; we can iterate later
```

What it means for an underwriter (so the band is trustworthy):

```text
  "The band is how much this county's outage rate has actually BOUNCED year to year — which,
   because storms cluster, is much wider than a naive event count would suggest. Wider band =
   noisier history (or thin history), not a modeling fudge."
```

## The whole thing in two steps (the underwriter pitch)

Both numbers come from **one source — the actual yearly outage counts.** Nothing is modeled or fitted.

```text
  STEP 1 — THE PRICE.   Average the real yearly counts of qualifying outages in this county
                        (x payout / loadings). That average is the headline premium.

  STEP 2 — THE RANGE.   Measure how much those same yearly counts SWING year to year, and turn
                        that swing into a low-high band. Big swing or few years -> wide range;
                        steady, long history -> tight range.
```

> Same actual numbers, two reads: their **average** is the price, their **year-to-year wobble** is
> the range. We invent nothing.

The "second step" people miss is exactly that: the range isn't a separate model bolted on — it's the
*spread of the very numbers* that produced the price. And because storms make those yearly counts
swing hard, the range widens precisely where the history is storm-driven and harder to trust — the
honest outcome. (The "bootstrap" is only the standard tool for turning the swing into a clean
interval; an underwriter never needs that word.)

## Caveats (honest about the ceiling)

```text
  · CONFLATES TREND.  A worsening county's year-to-year variance includes its trend, so the band
    can over-state pure uncertainty (direction: wider = conservative). Trend is a Step-5 concern.
  · THIN HISTORY.  <5 observed years, or near-zero events at long triggers (43 zero / 76 tiny at
    T=8h; 89 / 225 at T=24h) → the band is unreliable. Route to `insufficient` and SUPPRESS the
    point quote rather than show a meaningless huge range.
  · v1, NOT FINAL.  Documented alternatives if we revisit: negative-binomial / overdispersed Poisson,
    Buhlmann credibility (shrink thin counties toward a peer prior), Bayesian Gamma-Poisson.
```

## The meta-lesson

```text
  · a clean-looking interval can be quietly overconfident — for clustered events, MEASURE the
    dispersion before trusting a count-based band.
  · "the range" is often several uncertainties wearing one label — separate them, name them,
    show the decision-relevant one (communicate_to_share).
  · ship a reasonably logic-oriented v1 and iterate; the dashboard reads {low, point, high} from
    the engine, so the band method can improve later without touching any UI.
```

**Recorded as:** assumption [A017](../methodology/assumptions.md). Design note:
[`07_outward_range.md`](../dicsscssion/dashboard_redesign/07_outward_range.md). Analysis:
[`premium_range`](../../notebooks/premium_range/outward_range_exploration.ipynb) (+ `scratchpad/range_method_dev.py`).
