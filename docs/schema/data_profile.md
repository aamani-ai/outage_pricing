# Data Lake — Profile (distributions + outliers)

The analytical companion to [`data_lake.md`](data_lake.md). **What the data actually looks like** — central
tendency, spread, and the outliers / data-quality issues that drive pricing decisions. Every number is
computed from the sources (parallel profiling pass, 2026-06-28), not estimated.

---

## 0 · The findings that matter most

```text
  A. EVERYTHING IS HEAVY-TAILED — mean ≫ median everywhere.
        raw customers_out/snapshot:  median 4   mean 271   p99 ~3,523   max 1,376,382   (zero-inflated: 3.9% are 0)
        per-event mean_customers:    median 4   mean 38.6  p99 641      max 706,981     (top 1% of events = 43% of all mass)
        per-event max_customers:     median 4   mean 119   p99 2,219    max 1,777,800   (Miami-Dade, 2017 Irma)
     → the MEAN over-states the typical event ~10×. Any mean-based severity/per-customer estimator over-prices the
       typical county. This is the A011 question and it shows up in EVERY layer. Prefer median / tail-capped.

  B. THE DENOMINATOR IS THE FRAGILE INPUT — and we likely used the wrong source (see §1).

  C. THE COVERAGE RAMP IS REAL — early years (2018–2019) systematically under-observe (see §6).
     A naive multi-year average is biased LOW. This is the data-backed case for "recent beats long-run mean."

  D. IMPOSSIBLE PEAKS EXIST — customers_out > every home in the county (see §2). 8,441 snapshots in 2024 alone.
```

---

## 1 · ⭐ The denominator-source finding (new — worth acting on)

We divide per-customer rates by **MCC.csv**. But the **raw EAGLE-I carries its own `total_customers` column**
that we were *not* using — and it is dramatically better for the broken counties:

```text
  county            MCC.csv  raw EAGLE-I total_customers   ACS households   observed peak-out
  ───────────────────────────────────────────────────────────────────────────────────────────
  Henderson NC       24            69,102                     49,494           131,460
  (37089)            ↑ the value that produced the $3M premium      ↑ a sane denominator we ignored
```

MCC.csv is broken for a long tail (several counties = 1) **and** has a systematic **North Carolina
under-coverage cluster** (Durham 6,008 vs 135k households; New Hanover/Wilmington 2,544 vs 100k; Alamance 925
vs 67k) — a *missing NC utility in the MCC feed*, not random noise. The raw `total_customers` may not have that
gap. **Recommendation:** evaluate raw `total_customers` (and/or ACS) as the denominator source instead of MCC.csv.
This is a concrete refinement to Finding 1 (the denominator) — distinct from Finding 2 (the mean estimator).

*(Caveat: raw `total_customers` is still NOT guaranteed ≥ observed peak — Henderson's 69,102 < peak 131,460 — so
it would still need the ACS floor + exclusion logic. It just starts from a far saner base than 24.)*

---

## 2 · Impossible peaks (customers_out > the whole county)

```text
  Raw 2024 full-file scan:  8,441 snapshots (0.0305%) have customers_out > total_customers, across ~67 counties.
  events.parquet vs ACS:    4,574 events exceed total HOUSEHOLDS;  2,074 exceed total HOUSING UNITS (an absolute ceiling).
```

| County | Peak customers_out | Plausible base | Ratio | Driver |
|--------|-------------------|----------------|-------|--------|
| Barnstable MA (25001) | 273,634 | 165,068 housing units | 1.66× | Oct-2021 nor'easter — *more out than dwellings exist* |
| Austin TX (48015) | 126,963 | 10,181 total_customers | 12.5× | undersized denominator |
| Loving TX (48301) | 1,156 | 40 households | 28.9× | micro-county, miscalibrated |
| Daggett UT (49009) | 4,344 | 235 households | 18.5× | micro-county |
| Cochise AZ / Maricopa AZ | 718,642 | ~81k / ~59k | ~9× | single transient spike |

**Why this is invisible to `customer_base.csv`:** its `base` = `peak` for these counties (self-referential), so
0 events "exceed base." Plausibility must be checked against **ACS households/housing_units**, never `base`.

---

## 3 · Severity: the mean-vs-median gap (A011, quantified)

```text
  events.parquet mean_customers:   29.5% of events ≤1 customer · 58.8% ≤4 · 72.6% ≤10
                                   mean 38.6  vs  median 4.0  →  ~10× gap
                                   top 1% of events carry 42.7% of total customer-mean mass; top 0.1% carry 16.2%

  per_customer multiplier (T=8):   mean 7.19e-3  vs  median 4.37e-3 column-wise
                                   per-COUNTY mean/median ratio:  median 5.3×  ·  p90 11.4×  ·  max 132.6×
                                   → the mean multiplier runs ~5× the median at the typical county, up to 130× at the worst
```

This is the single biggest open pricing lever: the headline per-customer rate uses the **mean**, which a thin
tail of catastrophe events dominates. Median / trimmed estimators are the alternative (Finding 2 / PoUS track).

---

## 4 · Per-customer rate distribution + the high tail

```text
  lambda_customer_mean (T=8, n=2814):  median 0.102  mean 0.135  p90 0.278  p99 0.570  max 1.175  (events/customer/yr)
```

A handful exceed **~1 qualifying ≥8h outage per customer per year** — implausibly high for an individual:

```text
  fips 54015 (Clay WV)   1.175   (λ_county 72.9, mcc 5,299)        WV (54xxx) holds 7 of the top 12
  fips 78020 (St John VI) 1.129  (multiplier 10.8% of MCC/event)
  fips 54043 (Lincoln WV) 1.082
  at T=2 the tail is worse: 78020 = 5.94/yr, WV cluster 2.0–2.6/yr
```

These sit on **defensible bases** (mostly mcc_ok / peak_floor) — so the height is numerator-driven (high
λ_county × heavy-tailed share-out), not a denominator bug. That's the A011 estimator question, not a data fix.

Gate at T=8: **2,195 available · 619 caution · 276 not_available** (of which 131 `mcc_invalid`, 145 insufficient).

---

## 5 · The denominator sources, profiled

```text
  MCC.csv (3,232 counties):   min 1  median 12,813  mean 47,774  max 3,762,600 (LA)   sum 154.45M (≈ US total)
     · 5 counties <10, 12 <100, 125 <1,000.  MCC/ACS-households: median 1.32 (healthy); 11 counties <0.05 (broken).
     · BROKEN: Henderson NC 24, Buena Vista VA 1, Wahkiakum WA 1, Niobrara WY 4, Waynesboro VA 6, Lexington VA 16.
     · NC CLUSTER: Durham 6,008 / New Hanover 2,544 / Alamance 925 / Vance 863 — a missing NC utility, state-wide.
     · TRAPS: UTF-8 BOM header · 'Grand Total' footer row · unpadded FIPS (312 rows lose leading zero).

  ACS households (B11001):     min 32 (Kalawao HI)  median 10,021  max 3,363,093 (LA)
  ACS housing_units (B25001):  min 55  median 12,374  max 3,599,561 (LA);  always ≥ households.
     · housing/households ratio: median 1.185; 224 counties ≥1.5; 42 ≥2.0 (SEASONAL: Daggett UT 4.88, Hamilton NY 4.59,
       Summit CO 2.68 — genuine Census values, ~50–80% non-occupied homes). The denominator choice (households vs
       housing units) is material here — housing units over-states active metered exposure, households under-states it.

  customer_base.csv status:    mcc_ok 1,856 · housing_floor 935 · peak_floor 335 · excluded 131
     → only 57% of counties trust MCC directly; 43% needed a floor or exclusion. That ratio IS the bug's footprint.
```

---

## 6 · The coverage ramp (why "recent beats long-run mean")

```text
  national mean DQI:        70.1 (2018) → 74.4 → 75.6 → 84.8 → 86.4 (2022)
  customer-weighted floor:  min_pct_covered 0.752 (2018) → 0.782 → 0.847 → 0.863 → 0.890 (2022)
  events/year in catalog:   125,563 (2014 partial) → … → 1,501,069 (2025);  ~2/3 of all events post-2019
```

Early years systematically under-observe → any equal-weight multi-year average is biased **low**. Worst cells:
FEMA region 9 (CA/AZ/NV/HI) 2018 DQI=39.4; region 7 2019 DQI=50.3. **Onboarding artifacts** (not physical change):
Puerto Rico flips 0% → 100% between 2020 and 2021; MT 0.16 → 0.75; SD 0.46 → 0.87. Four territories (AS, GU, MP,
+PR pre-2021) have **zero coverage every year** — exclude or they inject false zero-outage signal.

*Spatial precision is the structural drag*: lowest sub-metric (median ~77%) — outages don't always map cleanly
to county. Note DQI/coverage are FEMA-region / state grain — **no county FIPS**, so they're evidence, not a join.

---

## 7 · Duration artifacts (stuck snapshots)

```text
  duration_hours: median 1.75  mean 4.18  p90 8.0  p99 38.5  max 7,152.75h (≈298 days)
  33.8% of events ≤1h; only 1.9% ≥24h.
```

The multi-month tail is **gap-bridging / never-recovered snapshots**, not real single outages: Wayne MI
7,152.75h (28,608 snapshots, mean only 464 out — a chronic low signal stretched into one "event"); Hampden MA
6,984h; Duval FL 6,864h. `bridge_ratio` caps at exactly 2.0× (gap tolerance bounds it), but `duration_max` /
`duration_p99` are distorted — treat the duration tail as raw, pre-correction.

---

## 8 · Sparse / single-event counties (non-credible)

```text
  n_per_year floor = 0.0896 = exactly 1 event / 11.167 yrs.
  Single-event counties: Billings ND (38007), Boone/Grant/Greeley NE — S(T) from one point is non-credible.
  34 counties have S_T(T=8)=0 (no ≥8h events ever); 69 counties non-quotable (red tier).
```

---

## 9 · Honest caveats (carry these into any analysis)

- **Mean is misleading** — every customer/severity field is right-skewed + zero-inflated; report median/quantiles.
- **`customer_base.csv base` can't flag impossible peaks** (self-referential to peak) — use ACS for plausibility.
- **Gate on `coverage_gate_status`** before using any per-customer number; honor `excluded` in customer_base.
- **FIPS zero-padding + UTC-naive timestamps + the MCC footer/BOM** silently corrupt joins if ignored.
- **Cross-year frequency must be coverage-weighted** (the ramp); don't equal-weight 2018–2019.
- **Vintages differ:** per_customer_view.json regenerated 2026-06-28; the other pricing JSONs 2026-06-20;
  source_version 2026-05-30. Joining across files mixes vintages.
- **Drilldown vs per_customer_view disagree** on broken-MCC counties (drilldown prices off mcc=24; per_customer
  gates it null) — a known inconsistency.

---

*Generated 2026-06-28 from a 9-dataset parallel profiling pass (schema + distributions + outliers). Companion:
[`data_lake.md`](data_lake.md) · ties to [premium-implausibility investigation](../dicsscssion/done/premium_implausibility_investigation/)
and [customer-base denominator fundamentals](../methodology/02_per_customer/customer_base_denominator_fundamentals.md).*
