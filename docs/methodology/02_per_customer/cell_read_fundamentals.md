# Cell Read — Trust & Posture (Step 1-2 Confidence)

*Audience: senior team + carrier-facing. Last reviewed: 2026-06-22. Reads after [`per_customer_pricing_fundamentals.md`](per_customer_pricing_fundamentals.md). Live engine: [`inner_event_shape_diagnostics.ipynb`](../../../notebooks/02_per_customer/inner_event_shape_diagnostics.ipynb); design + phases: [`inner_event_shape_confidence_plan.md`](../../plan/cross_cutting/inner_event_shape_confidence_plan.md).*

## What it is, in one paragraph

Every priced cell is a (county, duration-threshold `T`) pair carrying a per-customer
rate `λ_customer = λ_county × multiplier`. The **cell read** attaches two plain-English
tags to each cell so a writer or carrier can see, at a glance, **how much to trust the
number** and **which way it leans**. It is a confidence and communication layer — it
**never changes the price**.

```text
 STAGE     Step 1-2:  county 15-min snapshots  ->  per-customer frequency  λ_customer
 QUESTION  "Are these numbers over- or under-stated, and can I trust them
            county-by-county?"   (the writer / carrier question)
 SOLUTION  cell_read(fips, T) = TRUST + POSTURE
```

## TRUST — "how hard can I lean on this number?"

It is the **worst of three plain checks** (weakest link — one bad check caps the score,
because a great event count can't rescue a known data gap):

```text
 check       the question it answers
 ──────────────────────────────────────────────────────────────────────
 coverage    Did we watch this county long enough, with no known data
             blackouts?  (e.g. Texas lost reporting in 2016)
 volume      Are there enough qualifying outages to trust a rate — not
             just a handful?
 stability   Does the number stay put when we change how snapshots get
             stitched into events?  If it swings, we trust it less.

 Strong  ->  all three pass.  Quote on this number with normal confidence.
 Medium  ->  one check is soft (fewer events / partial coverage / some
             stitching sensitivity).  Usable — quote with a caveat, monitor.
 Thin    ->  a check fails (too few events, a known source gap, or unstable).
             Don't lean on it alone — route to review or fall back to county.
```

## POSTURE — "are we conservative here, and where does that break down?"

This is Chris's question. It reads the **shape** of the county's outages to say how much
built-in margin the price carries — and crucially, *where* that margin thins out. Two layers:

```text
 (1) CUSHION LEVEL — absolute, by duration: how much built-in over-statement (A011) is here
       short T (2h / 4h)   ->  runs close   ->  VERIFY ("are we undercutting short?")
       mid                 ->  some cushion
       long  T (8h / 12h+) ->  well-cushioned       ->  conservative (mean over-states ~2-3x)

 (2) CUSHION TILT — within-T vs peers (secondary, for cross-county comparison):
       spikier than peers -> extra cushion · typical -> no lean · flatter -> less cushion
```

**The LEVEL is the part that answers Chris.** The conservatism is real but **not uniform**:
strongest at long durations, thinnest at 2h / 4h — exactly the zone he worried we might
undercut. (Nationally: at 2h, ~71% of cells run close; by 8h, 93%+ carry at least mild
cushion; at 24h, 91% strong.) So the read says *"we're conservative, and here is precisely
where that breaks down."* The TILT is a secondary "which county stands out at this duration."

The two axes are deliberately **different questions**: TRUST = how much to believe it;
POSTURE = how conservative it is (LEVEL) and how it compares to peers (TILT). **Posture
never moves the price by itself** — it tells the underwriter where the margin is and isn't.

## One level deeper — what each axis is computed from

```text
 TRUST = min( C_source , C_sample , C_evt )      label: >=.75 Strong · >=.50 Medium · else Thin
   C_source   per-county observed years / window  (+ known-gap flags: TX-2016, CT-2025)
   C_sample   n_qualifying / (n_qualifying + 20)
   C_evt      λ_county spread across the 30/45/60-min catalogs  (stable -> high)

 POSTURE, from the cell's median peak_to_mean (= max/mean per event):
   cushion LEVEL = absolute band:  p2m_med >= 3 well-cushioned · >= 1.5 some cushion · else runs close
   cushion TILT  = within-T percentile:  <=40th flatter · >=60th spikier · else typical
   reported alongside, NOT scored: mm_ratio (mean/median), pct_mcc_p90/p99, coverage_gate
```

- TRUST is the **data-confidence** read (source coverage + sample + eventization stability).
- POSTURE is the per-cell empirical read of the [A011](../assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation) conservative cushion.
- **LEVEL vs TILT — two halves of the same cushion.** `peak_to_mean` rises mechanically with duration (national median 1.5 at 2h -> 7.3 at 24h). That ramp **is** the cushion's *general, by-duration* component — the LEVEL keeps it (it's real: long events genuinely carry more cushion, which is what Chris asked about). The *within-T percentile* strips the ramp out to expose the county-specific residual — the TILT. LEVEL answers "how conservative here"; TILT answers "spikier/flatter than peers."

## What it deliberately does NOT do

- **No automatic price effect.** Posture is context + routing only.
- **No rich per-event pattern taxonomy.** From event summaries (`min/mean/max`) the only
  robust shape axis is spiky↔flat. Plateau-vs-spike-with-decay, restoration slope, and
  double-peak need the 15-minute path, which the catalog does not store — that is a later,
  targeted step, not Gen-1. `min_customers` is ~1 for most events (degenerate), so the old
  "restoration-tail" proxy was dropped.
- **C_source is diagnostic here.** The matching *price* fix — replacing the flat global
  exposure denominator with per-county observed years — is a separate, validated pricing
  decision tracked as [A012](../assumptions.md#a012--per-customer-exposure-uses-one-global-window-dilutes-partial-coverage-counties).

## Worked counties @ T = 8h (does it discriminate?)

| county | n events | C_source | peak/mean | cushion LEVEL | tilt (vs peers) | cell read |
|---|---:|---:|---:|---|---|---|
| Erie NY | 2,608 | 1.00 | 4.7 | well-cushioned | spikier (p95) | **Strong · well-cushioned** |
| Worcester MA | 2,275 | 1.00 | 4.4 | well-cushioned | spikier (p93) | **Strong · well-cushioned** |
| Suffolk MA | 1,951 | 1.00 | 4.1 | well-cushioned | spikier (p90) | **Strong · well-cushioned** |
| Alachua FL | 1,546 | 1.00 | 4.6 | well-cushioned | spikier (p94) | **Strong · well-cushioned** |
| Concho TX | 184 | 0.46 | 2.6 | some cushion | typical (p50) | **Thin · some cushion** (TX-2016 gap binds) |
| Harney OR | 15 | 0.67 | 1.1 | runs close | flatter (p04) | **Thin · runs close** (flat *and* sparse) |

## One-line takeaways

- **TRUST = how much to believe it; POSTURE = how conservative it is, and where that breaks down.**
- **TRUST is weakest-link** of coverage / volume / stability — one bad check caps it.
- **POSTURE LEVEL answers Chris:** conservative at long durations, thinnest cushion at 2h/4h (the verify zone). **TILT** is the secondary "spikier/flatter than peers."
- **It explains and routes; it never moves the price.**

## References

- Plan + phases: [`inner_event_shape_confidence_plan.md`](../../plan/cross_cutting/inner_event_shape_confidence_plan.md)
- Assumptions: [A011](../assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation) (the cushion posture reads), [A012](../assumptions.md#a012--per-customer-exposure-uses-one-global-window-dilutes-partial-coverage-counties) (exposure dilution → the C_source price fix)
- Upstream: [`per_customer_pricing_fundamentals.md`](per_customer_pricing_fundamentals.md), [`eagle_i_data_fundamentals.md`](../cross_cutting/eagle_i_data_fundamentals.md)
- Framework: [`OUTAGE_MODELING_FRAMEWORK.md`](../../OUTAGE_MODELING_FRAMEWORK.md)
