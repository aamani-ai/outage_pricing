# 00 — Analytics Studio: purpose & shape (discussion seed)

**Type:** discussion — a seed to argue with, NOT a plan or a decision
**Status:** v0 · open · iterate before any implementation
**Why this exists:** the idea is real but the source discussion was vague (June 25 sync). Before we
build, we settle *what this section is for* and *how it differs from what we already have.* This doc
organizes the problem and lists the decisions; the answers come from a few rounds of us arguing here.

> Sibling context: [`rules_engine_governance/00`](../rules_engine_governance/00_carrier_underwriter_and_delegated_authority.md)
> (the three-actor model) · [`dashboard_redesign/`](../dashboard_redesign/) (the section IA + status grammar).
> Principles: [`communicate_to_share`](../../principles/communicate_to_share.md) · [`model_to_the_consequence`](../../principles/model_to_the_consequence.md) · [`county_specificity`](../../principles/county_specificity.md).

---

## What we actually heard (the honest source)

June 25 Thursday sync (~00:21), Prashant → Divy. Two things, lightly specified:

```text
  1. AGGREGATE RANGES   "run a batch across ~1,000 counties × strike rates × durations,
                         so I can see what the premium ranges look like" — not one at a time.
  2. QC / GUARDRAIL      "a capacity provider can't drop in a county and get $0 or $2."
                         premium is never ~0 (expected loss ≈ 20% of premium); and for any number,
                         "I want to be able to say I KNOW WHY this is low."
  + (gestured, not decided)  a comparison view; validation vs published insurance numbers;
                             (separately, deferred) concentration / portfolio risk.
```

Owned action item already on the books: **a batch-pricing script** across strikes × durations. That's
the compute spine; this doc is about the *product* on top of it.

---

## The gap it fills — the MANY, not the one

Our three sections today all operate on **one** thing or are a boundary. Nothing looks across the book.

```text
  SECTION              UNIT            QUESTION IT ANSWERS                          AUDIENCE
  ─────────────────────────────────────────────────────────────────────────────────────────
  Pricing              one address     "what's the price here?"                     outward
  Underwriting Studio  one quote       "WHY is THIS price what it is?"   (depth)     internal
  Analytics Studio     MANY quotes     "what do prices look like ACROSS the book —  internal
                       (grid / book)    and WHERE are they wrong?"      (breadth)
  Rules Engine         the bounds      "what are we allowed to write?"              carrier / locked
```

**The hinge (my position, argue with it):** the Underwriting Studio is *depth on one* — it already is
the analytical deep-dive the June 25 meeting talked about. The Analytics Studio is *breadth across
many*: distributions, anomalies, comparisons, defensibility at the book level. If a view only makes
sense for a single county, it belongs in the Underwriting Studio, not here. Keeping that line sharp is
how we avoid two sections that feel like the same thing.

---

## The jobs it might do (candidate purposes)

```text
  J1  RANGES        the spread of premiums (or rate-on-line) across counties × trigger × payout.
                    "what does the book look like; what's typical, what's the tail."
  J2  QC / DEFEND   never a nonsense number; for every number, a one-click "why is this low/high?"
                    (excluded · thin data · regime · cell-read). The trust tool before we hand a
                    capacity provider the keys.  ← the load-bearing one (model_to_consequence: the
                    costly error is an indefensible / under-priced cell slipping through).
  J3  COMPARE       counties / strikes / durations side by side; benchmark vs published numbers.
  J4  PORTFOLIO     a real book in a region → aggregate exposure + concentration/accumulation.
                    (concentration is DEFERRED elsewhere — flag, probably v2.)
```

---

## Candidate building blocks (to pick from, not all of them)

```text
  A  BATCH GRID engine     price every priced county × {T} × {X} → one dataset (the spine).
  B  DISTRIBUTION view     histogram / percentiles of premium or rate-on-line, faceted by T, X.
  C  NATIONAL MAP          choropleth of premium / rate by county at a chosen (T, X).
  D  QC PANEL              flag suspicious cells by rule; each flagged row → "why" → jumps into the
                           Underwriting Studio for that county (reuse, don't re-explain).
  E  COMPARE table         pin a handful of counties/strikes; columns incl. an optional benchmark.
  F  PORTFOLIO/concentration (deferred): select/upload a book → accumulation read.
```

Note we already have a **national dispersion map** (location basis). Decision needed: does Analytics
absorb/extend it, or is that a different lens? (Q7.)

---

## Open questions — the stuff we actually need to decide

```text
  Q1  UNIT & GRID    county-only (pricing is county-based) or include address/location too?
                     which dims (T fixed set; X a few canonical payouts vs continuous)?
  Q2  HEADLINE VIEW  what's the ONE thing you see first — a distribution, a map, or a QC list?
                     (communicate_to_share: one headline, not a wall of charts.)
  Q3  QC RULES       what makes a premium "suspicious"? candidates: ~$0 / below a sane floor /
                     excluded county / thin-or-insufficient data / outlier vs regime peers.
                     and the "why" drill — what does it link to (cell read · regime · exclusion)?
  Q4  COMPARE TARGET each other? published insurance benchmarks (do we even have that data?)?
                     across catalogs (30/45/60) or time?
  Q5  COMPUTE        precomputed artifact (build_data.py emits a county×T×X grid) vs on-the-fly
                     compose in the client. (~3,090 counties × 5 T × a few X is cheap either way;
                     continuous X argues for on-the-fly.)
  Q6  PORTFOLIO      in v1, or deferred with concentration (my lean: deferred)?
  Q7  MAP OVERLAP    absorb the existing national location-basis map, or keep separate?
  Q8  NAME           "Analytics Studio" / "Analytical Studio" / "Book Analytics" / "Portfolio".
  Q9  NAV PLACEMENT  4th top-level section. Order: Pricing · Underwriting Studio · Analytics · Rules Engine?
```

---

## A strawman v1 (so we have something concrete to cut down)

Not a proposal to build — a target to react to. Deliver Prashant's two stated jobs (J1 ranges + J2 QC)
with the least new machinery; defer the rest.

```text
  v1   pick a (trigger T, payout X)  →  batch-price every priced county, then show:
         · a NATIONAL MAP + a PREMIUM DISTRIBUTION (percentiles; "typical $X, tail to $Y")   [J1]
         · a QC PANEL: counties flagged excluded / thin / anomalous, each → Underwriting Studio  [J2]
       honest: excluded ~7% shown as excluded, never as $0.

  v2+  COMPARE table (+ benchmarks if we get data)  ·  PORTFOLIO + concentration.
```

Why this cut: J2 is the one with teeth (model_to_consequence — the expensive failure is an
indefensible or under-priced cell reaching a carrier). J3/J4 are bigger and the source barely
specifies them — better to design those once we've used v1.

---

## Principles check (to hold the design to)

```text
  model_to_consequence  QC must catch the COSTLY error first (under-price / $0 / indefensible), not
                        just "look at all the numbers."
  communicate_to_share  one headline read; every flag must change a decision; "I know why" is a
                        first-class feature, not a footnote.
  county_specificity    show the spread AND the grouping behind it (regime/exclusion) — don't flatten
                        3,000 counties into one number with no structure.
```

---

## What I need from you to iterate

React to the **hinge** (breadth-vs-depth split), the **strawman v1 cut**, and the **open questions** —
especially Q1 (unit/grid), Q2 (headline view), Q3 (what "suspicious" means), and Q6/Q8 (portfolio
scope · name). Each round we resolve some Qs and add detail; when the shape is stable we move it to
`plan/` and only then build.
