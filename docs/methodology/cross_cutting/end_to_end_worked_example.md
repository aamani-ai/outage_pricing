# End-to-End Worked Example — One County, Every Step, Real Numbers

*One county traced through the whole pipeline with actual values, so the math is legible and each
step's hand-off is concrete. Companion to the per-step methodology docs (which carry the deeper
"how"). County: **Honolulu, HI (FIPS 15003)** — an island grid, storm-exposed, with a real coverage
ramp and a recent regime shift, so it exercises every step. Catalog: `eagle-i-45min`. All numbers
reproduce from the catalogs + the masked annual series.*

```text
  MASK ─► BASELINE λ(T) ─► PER-CUSTOMER ─► REGIME ─► LOCATION ─► RANGE ─► PREMIUM
  (clean)  (county rate)   (one insured)   (identity) (where)   (how sure)  (the quote)
```

---

## Step 1 · Source-coverage mask — decide which years are real

EAGLE-I didn't cover every county from day one; early "zeros" can mean *not reporting* rather than
*no outages*. The mask keeps only **observed** county-years (see `eventization_frequency_contract/05_source_coverage_mask.md`, [A016](../assumptions.md)).

```text
  year :  2015  2016  2017  2018  2019  2020  2021  2022  2023  2024  2025
  count:   —     —    218   208   238   254   215   223   155   187   183      (T = 8h)
  state:  masked masked  ───────────────── observed (9 of 11) ─────────────────
```

Honolulu's feed onboards in **2017** → 2015–2016 are masked (a coverage ramp), not counted as zeros.
**Hand-off:** the 9 observed annual counts `[218,208,238,254,215,223,155,187,183]` are what every
later step reads — *not* a naive 11-year series with two false zeros.

---

## Step 2 · Baseline frequency λ(T) — the county rate

The empirical rate of qualifying outages, read straight off the history (no fitted curve):
`λ_county(T) = N_per_year · S(T)`, where `S(T)` is the observed share of outages lasting ≥ T hours.

```text
  T       λ_county(T)     S(T)
  2h        301.9 /yr     0.638
  4h        229.2 /yr     0.485
  8h        168.4 /yr     0.356     ◄ primary threshold (A011)
  12h       127.0 /yr     0.269
  24h        46.2 /yr     0.098
            (n_events_total = 5,280 · window ≈ 11.2 yrs · tier: amber)
```

This is the *county-wide* rate — never quoted directly; it's the source we adjust down from.

---

## Step 3 · Per-customer conversion — what one insured experiences

A single address is not the whole county. We scale the county rate by the customer-impact multiplier
(the fraction of the county a typical outage actually hits — see `02_per_customer/`, [A010](../assumptions.md)/[A011](../assumptions.md)):

```text
  λ_customer(8h) = λ_county(8h) × multiplier_mean = 168.4 × 4.78e-4 ≈ 0.080 /yr
                 mean 0.080   median 0.024   max 0.846     ← the spread is HETEROGENEITY, not uncertainty
```

The median (0.024) ≪ mean (0.080): most addresses see far fewer outages than the county average —
exactly why pricing the county rate to a customer would over-charge ~30–100×. **The headline λ is
customer-level: ≈ 0.080 qualifying outages / year.**

---

## Step 4 · Risk regime — the county's behavioral identity

A significance-gated classifier on the masked ≥8h series assigns one of `stable / trend / shift /
episodic / insufficient` (see `03_risk_clustering/`, [A013](../assumptions.md)–[A015](../assumptions.md)):

```text
  regime = shift (sub: recent)   ·  t-stat −2.02  ·  labels_by_T = shift at every T  ·  xT = T-stable
  read: a recent step DOWN in level (2023 drops to 155 from ~220) — not a smooth trend, not a one-storm spike.
```

This is the **router**, not a price move: `shift` says "a recent-regime model fits the forward
pass," and it flags the county as recently-changed for the underwriter.

---

## Step 5 · Location basis — where inside the county

Two addresses in one county differ. A **mean-1** within-county relativity redistributes risk by
local exposure (density, vegetation, terrain, feeder layout — see `04_location_basis/`). It changes
*who*, never the county total.

```text
  λ_located = λ_customer × relativity(address)      relativity ≈ 0.7×–1.4× typical (validated in CT/MA/RI;
                                                    shadow/national elsewhere — Honolulu is shadow → status: modeled)
  headline below uses the county-average location (×1.00); a specific address applies its own relativity.
```

---

## Step 6 · The range — how sure is the price

The band is the **year-to-year wobble of the actual annual counts** (year-based bootstrap, not a
naive Poisson on the event count — outages cluster; see [A017](../assumptions.md) + learning log
`premium_range_clustering.md`):

```text
  observed annual counts [218,208,238,254,215,223,155,187,183]  →  var/mean = 4.3  (clustered)
  annual rate: point 209  ·  80% band 197–221
  → premium band ≈ ±6%          (a naive Poisson would say ±3% — too tight, it ignores the clustering)
```

---

## Step 7 · Assemble the premium

`pure = λ_customer · X` ; `retail = pure / (1 − ER − TM)`. At T=8h, X=$2,500, ER 20%, TM 15%:

```text
  baseline  λ_customer(8h)     0.080 /yr            active        ×
  location  (address)          ×1.00 (county avg)   modeled       ×   (a real address applies its relativity)
  forward   (climate+grid)     ×1.00                placeholder   ×   (not yet plugged in)
  payout    X                  $2,500                             ×
  loadings  ER 20% · TM 15%    ÷ 0.65
  ─────────────────────────────────────────────────────────────────
  pure ≈ $201 / yr   →   PREMIUM ≈ $309 / yr   (likely $291–$327)
```

That headline — **≈ $309/yr, likely $291–$327** — is what the outward Pricing view shows; the Studio
shows this whole chain with each layer's status badge.

---

## Cross-step note (a real subtlety this example surfaces)

The **regime and range use the 9 masked-observed years**, while **baseline λ and per-customer use the
full ~11.2-year global window** ([A012](../assumptions.md) one-window exposure; [A016](../assumptions.md)
all-duration mask). So if you cross-check counts across steps they won't tie out exactly — by design,
not error. It's the most visible place the windowing assumptions bite; flagged here so a reader isn't
tripped up, and a reminder that A012/A016 are live simplifications to revisit.

## Where the deeper per-step examples live

```text
  mask        eventization_frequency_contract/05_source_coverage_mask.md (+ worked example there)
  per-cust    02_per_customer/per_customer_view_walkthrough.md (Boone MO; Alachua county λ=307 → customer retail ≈$79 @4h/$500, live catalog)
  regime      03_risk_clustering/regime_classification_methodology.md (Cherry NE, Baldwin AL)
  location    04_location_basis/location_relativity_factor_derivation.md
  range       learning_logs/premium_range_clustering.md
```
