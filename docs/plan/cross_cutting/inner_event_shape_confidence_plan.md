# Step 1-2 Cell Read — TRUST × POSTURE (Inner-Event Shape Plan)

**Status:** Phase 1 done (notebook rebuilt + validated on real catalogs); diagnostic, not active pricing
**Last reviewed:** 2026-06-22
**Owner:** outage pricing analytics
**Scope:** the **Solution** layer for Steps 1-2 — a per-cell evidence + bias read. No premium change.

## Stage → Question → Solution

```text
 STAGE     Step 1-2:  county 15-min snapshots  ->  per-customer frequency  λ_customer
 QUESTION  "Are these numbers over- or under-stated, and can I trust them
            county-by-county?"   (the writer / carrier question)
 SOLUTION  cell_read(fips, T) = TRUST + POSTURE   ◀ this plan
```

The read is **two axes on purpose** — "do I trust it" and "which way is it biased" are
different underwriting questions:

```text
 TRUST   "can we believe  λ_county × multiplier ?"        weakest-link min() of:
   ├ C_source   per-county source coverage + known-gap hard-flags
   ├ C_sample   enough qualifying events
   └ C_evt      eventization stability (λ spread across 30/45/60)
        →  Strong / Medium / Thin

 POSTURE "are we conservative here, and where does it break down?"  (= the A011 read; Chris's Q)
   (1) cushion LEVEL  absolute, by duration:  short T → runs close (VERIFY zone) ·
        long T → well-cushioned (mean over-states ~2-3x = conservative)
   (2) cushion TILT   within-T vs peers (secondary): spikier · typical · flatter

 reported alongside (shown, NOT scored): mm_ratio (mean/median), pct_mcc_p90/p99, coverage_gate
```

POSTURE is the per-cell empirical read of where the cell sits on the
[A011](../../methodology/assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation)
synchronous↔core+periphery spectrum — i.e. how large the conservative cushion is. It is
**context + routing, never an automatic premium multiplier.**

## How to read the labels (plain language)

**TRUST — "how hard can I lean on this number?"** worst of three plain checks (weakest link):

```text
 coverage   did we watch this county long enough, no known data blackouts (e.g. TX-2016)?  [C_source]
 volume     enough qualifying outages to trust a rate, not a handful?                       [C_sample]
 stability  does the number stay put when we change snapshot-stitching (30/45/60)?          [C_evt]

 Strong → all pass: quote with normal confidence.
 Medium → one soft: usable — quote with a caveat / monitor.
 Thin   → one fails: don't lean on it alone — review or fall back to county.
```

**POSTURE — "are we conservative here, and where does it break down?"** (Chris's question). Two layers:

```text
 LEVEL (by duration):  short T 2h/4h → runs close (VERIFY) · long T 8h/12h+ → well-cushioned (conservative)
 TILT  (within-T vs peers, secondary):  spikier · typical · flatter
```

Full carrier-facing definition: [`cell_read_fundamentals.md`](../../methodology/02_per_customer/cell_read_fundamentals.md).

## What the real catalog allowed — and forbade

The design was cut down by the actual `events.parquet`, not by taste. The catalog stores
only `min / mean / max / n_snapshots` per event (no within-event percentiles, no 15-min
path), and the data killed three of the five originally-proposed proxies:

```text
 proxy / flag           empirical finding (eagle-i-45min)              verdict
 ───────────────────────────────────────────────────────────────────────────────────
 min_customers          median = 1 at EVERY T; ≤1 for 57-67% of        DEAD — degenerate
   → restoration-tail   events, ≤5 for 87-95%                          (fires on ~everything)
 observed_fraction      median = 1.000; < 0.75 for only 0.1-0.6%       INERT — rare QA flag,
   → bridge-heavy       of events                                      not a posture driver
 peak_to_mean           median 1.54 → 7.26 as T 2h → 24h               CONFOUNDED by duration
   → spike-like (≥3)    (rises mechanically with T)                    → read as %ile WITHIN T
 mm_ratio (mean/median) ≈ 5-8× for the MEDIAN cell (heavy tail is      NON-DISCRIMINATING
                        the norm in outage data)                       → report, don't score
 borderline D∈[T,T+1h)  symptom of eventization sensitivity            REDUNDANT w/ 30/45/60 spread
```

Net: **from event summaries, `peak_to_mean` is the only robust within-event shape signal.**
Real plateau/tail detection needs the 15-min paths preserved — Phase 4, not Gen-1.

## The engine (as implemented in the notebook)

```text
 C_source  = (distinct observed years / full window).clip(0,1)
             × 0.5  if TX county with no 2016 events     (TX-2016 source gap)
             = 0.25 if CT 2025 planning-region FIPS (9110-9190)
 C_sample  = n_qualifying / (n_qualifying + 20)
 C_evt     = bin( λ_county spread across 30/45/60 ):  ≤.15→1.0  ≤.35→.75  ≤.60→.50  else .25
             spread = (max - min) / median  of λ_county over the three catalogs

 TRUST     = min(C_source, C_sample, C_evt)      label: ≥.75 Strong · ≥.50 Medium · else Thin
 cushion LEVEL = absolute band of median peak_to_mean:  ≥3 well-cushioned · ≥1.5 some cushion · else runs close
 cushion TILT  = within-T percentile of median peak_to_mean:  ≤.40 flatter · ≥.60 spikier · else typical
                 (<10 events → suppressed)
```

Two findings worth telling carriers directly:
- **Eventization is stable almost everywhere** — λ spread median ~0.05-0.09 across 30/45/60.
  Gap tolerance moves almost no prices; `C_evt` flags only the unstable tail.
- **`C_source` replaced a flat global number.** The per-customer pipeline divides every
  county by one global ~11.17-yr exposure; using per-county coverage is what lets a
  source-gap county read **Thin** instead of falsely **Strong** (see A012 below).

## Validation — does it discriminate? (T = 8h)

```text
 county         n_evt  C_source  peak/mean  cushion LEVEL     tilt(vs peers)  cell read
 ──────────────────────────────────────────────────────────────────────────────────────────
 Erie NY        2,608   1.00       4.7      well-cushioned    spikier (p95)   Strong · well-cushioned
 Worcester MA   2,275   1.00       4.4      well-cushioned    spikier (p93)   Strong · well-cushioned
 Suffolk MA     1,951   1.00       4.1      well-cushioned    spikier (p90)   Strong · well-cushioned
 Alachua FL     1,546   1.00       4.6      well-cushioned    spikier (p94)   Strong · well-cushioned
 Concho TX        184   0.46 ⚑     2.6      some cushion      typical (p50)   Thin · some cushion   (TX-2016 gap)
 Harney OR         15   0.67       1.1      runs close flatter (p04)   Thin · runs close   (flat AND sparse)
```

National: TRUST Strong 85%→34% as T rises. **CUSHION LEVEL by duration** — short T mostly
runs close (2h ≈ 71%), long T mostly well-cushioned (24h ≈ 91%) = Chris's "conservative
where?" answer. The TILT (within-T vs peers) is ~40/40/20 by construction — read per-county, not by T.

## Data inputs

```text
 curated_outage_data/outputs/per_customer_rate/per_customer_lambda__{30,45,60}min.parquet
   → lambda_county (the 30/45/60 spread = C_evt), n_events_qualifying, multiplier_mean/median,
     pct_mcc_p90/p99, coverage_gate_status
 price_engine/catalogs/eagle-i-45min/data/events.parquet
   → peak_to_mean (max/mean) for POSTURE; distinct observed years for C_source
```

Notebook: [`../../../notebooks/02_per_customer/inner_event_shape_diagnostics.ipynb`](../../../notebooks/02_per_customer/inner_event_shape_diagnostics.ipynb)
· outputs (gitignored): `notebooks/outputs/inner_event_shape_diagnostics/`

## Phases

```text
 ✔ Phase 1  DESIGN + VALIDATE          rebuilt notebook on real catalogs; 2-axis engine;
                                        dead proxies dropped; worked counties discriminate
   Phase 2  GENERATE THE ARTIFACT      emit a read-only fips×T cell-read JSON/CSV at the
                                        pricing grain; align discussion doc 03 to this design
   Phase 3  SHARED SOURCE-COVERAGE MASK build the per-year observed-vs-missing mask — the
                                        Step-3 prerequisite that ALSO powers the A012 fix
                                        and a fuller C_source (one artifact, three payoffs)
   Phase 4  15-MIN PATH REBUILD        only if summary proxies prove insufficient; targeted,
                                        per-county (share>50% peak, plateau run, restoration slope)
```

## Decision rules

```text
 • POSTURE is context + routing — NEVER an automatic premium multiplier.
 • C_source as a TRUST flag is diagnostic and ships now (no price change).
 • The exposure-denominator FIX (per-county observed years) is a real PRICE move —
   sequenced as its own validated item under A012, not slipped into the diagnostic.
 • Product-fit (which T to lead with) is a SEPARATE strategy axis, not part of TRUST.
```

## What it cannot prove (honest ceiling)

- whether the *same* customers were out the whole event (`min` is degenerate ~1);
- the exact restoration curve (needs 15-min paths — Phase 4);
- the *absolute* A011 cushion magnitude (needs external per-customer duration data — the
  PowerOutage.US trial is the first shrink candidate).

## References

- Assumptions: [A011](../../methodology/assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation) (the cushion this posture reads), [A012](../../methodology/assumptions.md) (exposure-denominator dilution — flagged pricing decision)
- Discussion: [`eventization_frequency_contract/01`](../../dicsscssion/eventization_frequency_contract/01_eventization_frequency_discussion.md) (observed-zero vs missing), [`03_inner_event_shape_diagnostics`](../../dicsscssion/eventization_frequency_contract/03_inner_event_shape_diagnostics.md) (discussion resolved — records what was tested and why)
- Fundamentals: [`per_customer_pricing_fundamentals`](../../methodology/02_per_customer/per_customer_pricing_fundamentals.md)
- Framework: [`OUTAGE_MODELING_FRAMEWORK`](../../OUTAGE_MODELING_FRAMEWORK.md)
- Pipeline: `curated_outage_data/pipelines/per_customer_rate/compute_per_customer_lambda.py`
