# Per-County Trigger Validity — "is the insured event genuine here?"

**Status:** plan · **GATED — not now** (see §Gate) · the **third facet** of the cell read
(product validity, distinct from trust and posture)
**Last reviewed:** 2026-06-22
**Owner:** outage pricing analytics
**Scope:** turn the national duration-conservatism verdict into a **per-county, decision-grade**
read. No premium change.

## Stage → Question → Solution

```text
 STAGE     Step 1-2 — eventized county events → per-customer frequency at threshold T
 QUESTION  "For THIS county at THIS duration, is the trigger event a REAL sustained outage,
            or a statistical artifact (a thin tail / merged short bursts)?"  → is it underwritable?
 SOLUTION  a per-(county, T) GENUINE vs THIN-TAIL routing from signals we already compute.
```

## Why this is a NEW question (not trust, not posture)

The cell read already answers two questions. This is a **third**, and it is the one Chris's
duration worry ultimately points at:

```text
 TRUST    "can I believe the number?"            (source · sample · merge-stability)
 POSTURE  "which way is the price biased?"        (cushion LEVEL — spiky = conservative)
 VALIDITY "is the insured EVENT real here?"   ◀  THIS: does a ≥T outage in this county reflect
                                                  a sustained customer outage, or a thin-tail artifact?
```

It matters because **price-conservatism ≠ product-validity** — they can disagree:

```text
 a super-spiky 8h cell:
   for PRICE   → mean << peak → over-state → CONSERVATIVE (cushion)        ✓ safe price
   for PRODUCT → the "8h event" is carried by a thin tail, not sustained mass
                 → did ANY customer experience a real 8h outage?            ⚠ is the product real?
```

A thin-tail 8h county is *over-reserved* (safe) yet may be a county where an 8h-trigger product
is **not meaningful** — worth catching before we write it there.

## The problem — two ways "short hides under a long aggregate"

```text
 (1) THIN TAIL  — within ONE genuine long event, the customer MASS was brief; a few customers
                  dragging on make it "8h".   ← the DOMINANT effect (peak/mean climbs 1.5→7.3 with T)
      peak ██████  (500 out, ~1h)
           ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒          detector: peak_to_mean (high = thin tail)
           0h                   8h

 (2) STITCHING  — separate short bursts gap-merged into one long event.
      [burst][gap][burst] → "one long event"   detector: C_evt (30/45/60 spread)
      our gap ≤45 min ⇒ this is SMALL (spread ~5-9%) → mostly ruled out, but measurable
```

## Method — per (county, T), route on three signals we already have

```text
   sustained?     peak_to_mean        low = real sustained mass · high = thin tail
   merge-stable?  C_evt (30/45/60)     stable = not stitched
   off-boundary?  share clearing T     low = robust · high = fragile to timing
        ⇓
   GENUINE / underwritable   : sustained · merge-stable · off-boundary  → writeable
   THIN-TAIL / artifact      : spiky + merge-sensitive + boundary-heavy  → don't lead / review

 which signal dominates flips with T:
   short T (2h/4h)  →  boundary + merge dominate   (is the COUNT even real?)
   long  T (8h+)    →  spikiness dominates          (is it SUSTAINED, or a thin tail?)
```

Output: a per-`(fips, T)` validity tag alongside the existing cell read — e.g.
`Strong · well-cushioned · GENUINE` vs `Strong · well-cushioned · THIN-TAIL (review)`.

## Scope (low lift)

```text
 already computed per cell:  peak_to_mean · C_evt (30/45/60 spread)
 one new line:               per-county boundary mass (share of qualifying events clearing T by a hair)
 then:                        combine → GENUINE / THIN-TAIL tag + a per-county map/table
```

## Gate — why this is NOT now

```text
 • the IMMEDIATE question (Chris: "are we conservative?") is answered by the national verdict — done.
 • the PRODUCT target is high-T (8h/12h) = the "robustly conservative" zone; the thin-tail
   worry bites hardest at SHORT-T, which we are not leading.
 ⇒ this read changes a LATER, finer decision (per-county write/no-write), not today's launch.

 BUILD WHEN:  we expand the product below 8h · OR underwriting wants per-county write/no-write
              · OR a high-T county is suspected to be a thin-tail artifact.
```

Writing the gate down means future-us reads this as a **deliberate defer**, not an oversight.

## Ceiling

The **genuine-vs-artifact routing is buildable today** (it only needs signals we already have).
What it still cannot give is the **absolute magnitude** — how short, exactly, the hidden customer
experiences are — because EAGLE-I has no per-customer durations. That needs PoUS per-outage data
(the [A011](../../methodology/assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation)
resolution path). Routing now; magnitude later.

## References

- National verdict this refines: [`04_duration_conservatism.md`](../../dicsscssion/eventization_frequency_contract/04_duration_conservatism.md)
- The cell read it extends (trust + posture): [`cell_read_fundamentals.md`](../../methodology/02_per_customer/cell_read_fundamentals.md) · [`inner_event_shape_confidence_plan.md`](inner_event_shape_confidence_plan.md)
- Assumption / ceiling: [A011](../../methodology/assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation)
- Framework: [`OUTAGE_MODELING_FRAMEWORK.md`](../../OUTAGE_MODELING_FRAMEWORK.md)
