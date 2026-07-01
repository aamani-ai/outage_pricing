# 01 — The denominator fix: MCC vs Census households

> **STATUS — IMPLEMENTED & CORRECTED 2026-06-28 (localhost; not deployed).**
>
> **Correction (the households approach below was wrong).** First pass used Census **households** (occupied
> homes) as the basis — it left a whole class of counties over-priced (Hamilton NY share-out 7.15%). Root
> cause: utility customers ≈ **HOUSING UNITS** (B25001 — every home, *including seasonal/vacation*, has a
> meter), and the over-priced counties are exactly the seasonal ones (Adirondacks, Sierra Nevada, lake
> country) where housing units is 2–4.6× households. Also the first pass only enforced the peak floor on
> *repaired* counties, so `mcc_ok` counties with a too-low MCC (Hamilton: peak 7,289 > MCC 2,561) slipped through.
>
> **Corrected policy** (`build_customer_base.py`): `base = max(MCC, housing_units, peak)`; **exclude** where
> observed peak-out > 1.5 × max(MCC, housing_units) (numerator corrupt → would under-price). MCC/housing-units
> is tight (median 1.10, r 0.976). Result: **1,856 mcc_ok · 935 housing-floor · 335 peak-floor · 131 excluded.**
>
> **Verified:** share-out > 1 across all counties/T = **0** (max 0.27); Hamilton 7.15% → **2.34%** ($13.7k →
> $4.0k); priced @8h median **$391**, max **$4,520**; Henderson excluded. The earlier "$13.7k = clean high
> frequency" claim was WRONG — those were under-counted denominators (see learning log on verify-before-asserting).
> Remaining: register the assumption (A0xx); re-run 30/60-min catalogs; County-Explorer flag; the LEVEL question
> (Finding 2) is its own track.

**Type:** analysis → decision. **Date:** 2026-06-28. Follows [`00_findings_and_plan.md`](00_findings_and_plan.md) Finding 1 (broken MCC).
**Question (Divy):** rather than a v0 patch, source the *right* denominator. Can Census households be the
customer base, and what is the MCC↔households relationship? Decide the path from data, not intuition.
**Reproduce:** `mcc_vs_census.py` (ACS 2022 acs5, cached) → `mcc_vs_census_county.csv` (per-county).

---

## Result — households is a validated denominator

```text
  MCC / households   median 1.324    IQR 1.116 – 1.558    (2,993 of 3,058 counties, 97.9%)
  log-log corr(MCC, households)      r = 0.977            ← MCC tracks households almost perfectly
```

**Reading:** utility customers ≈ households + ~30% (commercial / secondary meters), and the relationship is
**tight and stable** across the country. So Census ACS households is a sound basis for the customer-base
denominator — and the **1.324×** factor lets us *repair* a broken MCC with a calibrated estimate, not a guess.

## The broken set falls right out

```text
  MCC / households  < 0.1  (severe) ......  17 counties      ← the $50k–$3M outliers
                    < 0.5  (too small) ...  83 counties      ← clearly under-stated denominators
                    > 3.0  (too big) .....  22 counties      ← MCC over-stated (under-prices; lower risk, still flag)
```
Examples (full list in the CSV):
```text
  county              MCC      households   MCC/hh    repaired base (hh×1.324)
  Henderson NC         24       49,494     0.0005       65,506
  Mecklenburg NC   28,172      446,584     0.063       591,063     ← Charlotte: MCC 16× too small
  Durham NC         6,008      135,469     0.044       179,296
  Buena Vista VA        1        2,655     0.0004        3,514
```
**Systematic signal:** a cluster of **North Carolina** counties are broken (Henderson, Mecklenburg, Durham,
New Hanover, Alamance, Vance…) — this looks like a *utility-level MCC gap in the EAGLE-I source for NC*,
not random noise. Worth flagging to whoever owns MCC ingestion.

## The decision — validate-and-repair via households (the right fix)

```text
  1. KEEP MCC where it agrees with households (ratio ∈ [0.5, 3] → ~97% of counties). It's the real
     utility count and carries genuine per-county commercial variation; don't throw it away.
  2. REPAIR the broken ~83 (ratio < 0.5): base = households × 1.324 (the calibrated, validated estimate).
  3. EXCLUDE the irreconcilable ~20: where even the repaired base < the county's own observed peak-out,
     the customers_out series itself is corrupt (e.g. Henderson: peak 131,460 > 65,506 base) → flag
     "data invalid", don't price. Can't trust the numerator either.
  4. GUARDRAIL: cap multiplier ≤ 1.0 everywhere — covers the ~586 legit near-total-storm counties where
     peak ≈ base, with no false exclusions.
  + (optional) review the 22 over-stated (ratio > 3) the same way.
```

Why this over the alternatives (settles [`00`](00_findings_and_plan.md) §A):
- **vs cap-only:** capping leaves λ_county-driven nonsense (Henderson still ~$693k); it fixes the symptom, not the denominator.
- **vs blanket-exclude:** throws away ~83 real counties (incl. Charlotte/Durham — target-state markets) over a denominator we can validate and repair.
- **vs uniform households×1.324 everywhere:** simpler, but discards the real per-county commercial variation (IQR 1.12–1.56) where MCC is good. Validate-and-repair keeps accuracy where we have it, fixes only what's broken.
- **Conservative direction holds** (`model_to_consequence`): households×1.324 is a central estimate; the peak-out floor + cap keep us from under-stating the base.

## Way forward (implementation, when approved)
```text
  · curated_outage_data: add a denominator-QC step — load ACS households, compute base_repaired + flags,
    feed compute_per_customer_lambda (replace bad MCC, exclude corrupt, cap multiplier).
  · register assumptions: "MCC validated against ACS households (1.324×); repaired below 0.5×, excluded
    when peak-out exceeds the repaired base" (A0xx in methodology/assumptions.md).
  · re-emit pricing.json; verify the Analytics tails collapse; surface "MCC invalid" exclusions + the
    MCC-vs-households read in the County Explorer.
  · raise the NC systematic MCC gap with the data owner.
  NOTE: this fixes the DENOMINATOR (Finding 1). The level/estimator question (Finding 2, ~5× mean-vs-median)
        is the separate per-customer/PoUS validation track — unchanged by this.
```
