# The Premium Range (resolves Q3)

The premium is shown as a **range**, not a false-precise point. The key realization — which reconciles
the old per-customer work with the new finding — is that **"the range" is not one thing.** There are
three *different* uncertainties, they answer different questions, and blending them into one band
would hide the very distinction an underwriter needs. Validated on real data
(`scratchpad/range_explore_dev.py` → `notebooks/premium_range/outward_range_exploration.ipynb`).

## Three uncertainties, not three rival answers

```text
  (a) CONFIDENCE     how sure are we of the county's average rate?         epistemic · shrinks with data
                     → a Poisson band on K (events counted over ~11 yrs)
  (b) HETEROGENEITY  how much does frequency vary by location IN the county? structural · real spread
                     → the customer-impact multiplier median..mean..max     (the OLD dashboard's range)
  (c) PLACEMENT      where in (b) does THIS address sit, and how sure?       → location relativity + geocode
```

Your instinct on **(b) is right, and the old work was right to centre it** — but its *role* was being
asked to do two jobs at once. (b) is the **heterogeneity backdrop**: within one county the median
customer sees far fewer outages than the mean, and the worst-placed far more (e.g. Alachua T=2h:
median λ 0.03 ≪ mean 0.14 ≪ max 0.75). The old dashboard showed that median..max as *the range*
because it was a **county-level** tool — it hadn't resolved a specific address, so "depending where
you are, a customer here sees this much" was the honest statement.

The new dashboard **resolves the address** (the location adjustment, (c)). So (b) stops being the band
and becomes a **position read** — "this address sits at the upper third of its county." What's left as
the band around the resolved point is **(a) confidence.**

## The decision — and how the three compose

> **band = (a) confidence, widened by the unresolved part of (b) in proportion to (c)'s weakness.**

```text
  well-placed address     good geocode + validated relativity → (c) resolves (b) → band ≈ (a) confidence
  weakly-placed address   ZIP-centroid / unvalidated region   → (b) leaks back in  → band widens
```

So none of (a)/(b)/(c) is discarded:
- **(a)** is the band — a **year-based** confidence interval (bootstrap of the observed annual rate).
  Tight where rich/steady, wide where thin/volatile. *(An earlier Poisson-on-count version was
  rejected — too tight, because outages cluster; see "what's behind it" below + learning log.)*
- **(b)** is kept as the Studio's **position-in-county** read (honouring the old work) and as the
  fallback that widens the band when we can't place the address.
- **(c)** (location basis) is the gate that decides how much (b) matters.

**Per `communicate_to_share` (rule 4 — split orthogonal questions, never one blended score):** the
band shows **confidence**; position shows **heterogeneity**. They are never merged into one opaque
range, because a wide band from "we're unsure" demands a *different* underwriter action than a wide
band from "this county is very heterogeneous." Two reads, not one number.

## What this band means, and what's behind it — for underwriter trust

*(The part that has to be communicative — an underwriter must trust these bands.)*

**Say it in one breath.** "The band is **how much this county's outage rate has actually bounced year
to year** — wide where the history is noisy or thin, tight where it's steady and rich — *not* the
spread of who-pays-what across the county."

**What's behind it, plainly:**
```text
  1. take this county's OBSERVED annual count of outages >= T hours (the ~11-year series).
  2. bootstrap the average annual rate over those years (resample years, 80% interval).
  3. carry that band straight through the price (premium scales linearly in the rate).
  4. why year-based, not a naive event count: outages CLUSTER (a storm = many at once), so the real
     year-to-year bounce is far wider than counting events suggests (median ~2x wider; up to ~8x for
     storm-prone counties). We use the bounce. No fitted distribution, no fudge factor.
```

**Why it's trustworthy:**
- It uses the **real observed variability** — no independence assumption, no fitted distribution.
  Reproducible from public EAGLE-I data.
- It uses the **same annual series** as the Studio's comfort-by-trigger strip — one fact, two views
  (the Reask "challenge only the frequency" framing).
- It's **honest about direction**: it widens where the history is genuinely noisy or thin (long
  triggers, sparse/volatile counties) — exactly where an underwriter *should* apply judgment.

## Worked examples (real · eagle-i-45min · X=$2,500 · ER 0.20 · TM 0.15)

```text
  CONFIDENCE band (a) — the NAIVE POISSON first-cut (kept to show the shape; SUPERSEDED by year-based)
   Pasco FL,   8h · 3,103 events → $320  (~±5% Poisson)
   Alachua FL, 8h · 1,546 events → $244  (~±7% Poisson;  across trigger 2h ±3% · 24h ±21%)
   Clayton IA, 8h ·   116 events → $153  (~±25% Poisson)
   → YEAR-BASED band (adopted) is a median ~2x wider (up to ~8x for storm-clustered counties),
     because outages cluster. See learning log `premium_range_clustering.md` for the corrected widths.

  HETEROGENEITY (b) — NOT confidence: huge even for data-rich counties, so shown as POSITION not band
   Wake NC, 8h · 3,305 events → customer median..max  $1,208..$28,736  (748% of point — structural, not "unsure")
```

## Open sub-choices (settled with the Pricing view, P3)

```text
  · confidence level: 80% ("likely") outward vs 90% in the Studio — show both, default 80%.
  · near-zero K at long T: band explodes → tie to `insufficient` / low-comfort, SUPPRESS the point quote
    rather than show a meaningless range.
  · display form: "(likely $A–$B)" vs "±N%" vs low/expected/high triple.
  · how (b) leaks into the band when placement is weak — exact rule once location basis confidence is wired.
```

## How it lands

```text
  1. (done) dev validation     scratchpad/range_explore_dev.py (shape) + range_method_dev.py (clustering: D=5 at T=8h)
  2. (done) notebook           notebooks/premium_range/outward_range_exploration.ipynb (executed)
  3. (done) record             assumption A017 (year-based, overdispersion-aware band) + learning log
                               `premium_range_clustering.md` (the clustering finding)
  4. engine (refines P1)       PRECOMPUTE the band in the pipeline (bootstrap needs per-year counts) and ship it;
                               composePremium() returns {low, point, high} + a band_driver tag; outward shows the band,
                               Studio shows it + the annual series + position
```

> **Refines plan P1:** the engine returns a band + driver tag — so this is a *pre-P1 input*, settled
> here + the notebook before the engine is built.
