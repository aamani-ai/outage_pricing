# 02 — Understanding the denominator: what counts as a "customer"

**Type:** explainer (the concept behind the fix in [`01`](01_denominator_fix.md)). Written so the team can
*understand* why the customer-base denominator is Census **housing units** — not households, not raw MCC.

---

## Why the denominator matters at all

The per-customer rate hangs entirely on one division:

```text
  share-out  =  customers_out (during an event)  ÷  CUSTOMER BASE
  λ_customer =  λ_county × share-out
```

`share-out` is "what fraction of the county's customers were out." Get the **base** (the denominator) wrong
and every per-customer premium in that county is wrong — proportionally. A base that's 3× too small makes the
premium 3× too big. So the whole question is: **how many electric customers does a county actually have?**

---

## Three candidate answers — and the trap

```text
  SOURCE                         WHAT IT COUNTS                                  PROBLEM
  ─────────────────────────────────────────────────────────────────────────────────────────────
  MCC (EAGLE-I)                  the utility's modelled customer count           garbage for ~a few hundred
                                 (residential + commercial)                      counties (Henderson NC = 24)
  Census households (B11001)     OCCUPIED homes (year-round residents)           MISSES seasonal/vacant homes
  Census housing units (B25001)  ALL homes: occupied + vacant + SEASONAL         ✅ matches "metered homes"
```

**The key idea — a "customer" is a meter, not a household.** An electric customer is a *metered account*.
Almost every home has one — and a **seasonal / vacation home keeps its meter on even while nobody lives there
year-round.** So it is a utility customer but it is **not** a "household" (households = occupied homes only).

```text
   utility customers  ≈  ALL homes (incl. seasonal)  +  commercial accounts
                      ≈  HOUSING UNITS  ×  ~1.1
   households (occupied only)  UNDER-counts wherever there are vacation homes.
```

---

## Why it bit us (the seasonal-home counties)

In an ordinary year-round county, occupancy is high, so households ≈ housing units — either works. But the
counties we were over-pricing are **vacation counties**, where housing units far exceed households:

```text
  county          households   housing units   hu / hh     (Adirondacks, Sierra Nevada, lake country)
  Hamilton NY        1,725         7,920         4.6×       ← 78% of homes are seasonal
  Mono CA            5,473        13,625         2.5×
  Alcona MI          4,832        10,320         2.1×
```

Dividing `customers_out` by **households** in Hamilton uses a base ~4× too small → share-out reads 7.15% when
the truth is ~2.3%. The proof is in the county's own data: Hamilton's worst observed outage was **7,289**
customers out — which is impossible against "1,725 households," but sits right under **7,920 housing units**.
The peak basically *equals* the housing-unit count. That's the tell that housing units is the real base.

---

## The data backs it (all counties)

```text
  MCC / households      median 1.32   IQR 1.12–1.56   r 0.977     ← noisier; biased by seasonality
  MCC / housing-units   median 1.10   IQR 0.91–1.30   r 0.976     ← tighter, centered near 1.0
```

MCC ≈ **1.1 × housing units** nationwide (the ~10% is commercial/industrial accounts). Housing units is the
cleaner, more physical basis — and it explains the seasonal counties that the households ratio hid.

---

## The full policy (what `build_customer_base.py` does)

```text
  base    = max( MCC , housing_units , observed_peak_out )
              │            │                  └ HARD FLOOR: you can't have more customers out than exist,
              │            │                    so the base must be ≥ the worst outage ever seen.
              │            └ counts every metered home, incl. seasonal (fixes the vacation counties).
              └ keeps the real utility count where it's the largest (genuine commercial load).

  EXCLUDE if  observed_peak_out > 1.5 × max(MCC, housing_units)
              └ the NUMERATOR is corrupt — more customers "out" than the county can plausibly have
                (Henderson NC: peak 131,460 vs 56,744 housing units = 2.3×). Pricing it would UNDER-price
                (a huge base → tiny share-out), the dangerous direction → don't price it.
```

Outcome across CONUS: **1,856 keep MCC · 935 fall to the housing-unit floor · 335 to the peak floor · 131
excluded.** Share-out is now ≤ 1 everywhere (max 0.27); Hamilton 7.15% → 2.34% ($13.7k → $4.0k premium).

---

## What this is NOT

```text
  · NOT the LEVEL question. Fixing the denominator makes share-out correct. Whether the per-customer λ is
    still too high on average (the MEAN-over-qualifying-events / A011 question) is SEPARATE — Finding 2.
  · NOT a claim MCC is useless. Where MCC ≈ housing units (most counties) we keep it (it carries commercial).
    We only override it where it's clearly too low (seasonal) or where the outage data itself is impossible.
  · NOT final on the 1.5× exclusion threshold — a deliberate, reviewable knob.
```

## How we got here (the honest version)
First attempt used **households** and called it "validated" (r=0.977 looked convincing). It left the seasonal
counties over-priced, and I wrongly told Divy those were "clean, just high-frequency." Re-checking the actual
numbers — housing units vs households on the over-priced counties — revealed the seasonal-meter gap. Lesson:
a ratio can look "validated" in aggregate and still be wrong on the sub-population that matters. See the
learning log: `learning_logs/analytics_studio_surfaced_the_mcc_bug.md`.
