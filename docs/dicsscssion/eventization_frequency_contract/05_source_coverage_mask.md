# Source-Coverage Mask — observed-zero vs missing (Step-3 prerequisite)

**Status:** findings + design + opinion · diagnostic · resolves `01`'s "Source-Quality Calendar / Candidate Source-Quality Policies"
**Last reviewed:** 2026-06-22
**Analysis:** [`../../../notebooks/03_risk_clustering/source_coverage_mask_analysis.ipynb`](../../../notebooks/03_risk_clustering/source_coverage_mask_analysis.ipynb)

## Stage → Question → Solution

```text
 STAGE     Step 3 prerequisite — before we fit / cluster the annual series
 QUESTION  which county-year ZEROS and lows are real, and which are FEED COVERAGE GAPS?
 SOLUTION  approach (A): per-county RELIABLE-ONSET — null the early coverage ramp, keep the rest
```

## The finding — it's a coverage RAMP, not scattered gaps

We expected a handful of gaps; the data showed a **systematic onboarding ramp**. EAGLE-I added
counties over 2014–2019, so early years are *under-counted*, not quiet:

```text
 national share of counties that saw ZERO outages all year:
   2014 30%  2015 19%  2016 22%  2017 9%  2018 9%  2019 4%  2020 2%  …  (stable ~98% from 2020)
 concentrated where a feed onboards late — rural-western states, early years:
   WY/MT/AK/Dakotas 2015-16 ~80-96% zero · OR 80% · CA ~63% · TX-2016 53% (Concho's gap)
```

If we used those years, the trend would show **fake worsening** (counts "rise" as coverage
improves). 2014 is a partial boundary (EAGLE-I started Nov 2014) → always excluded.

> **Bonus — the heatmap is an underwriting guide too.** The state × year coverage heatmap (in the
> notebook) isn't only a mask input: a state/county that is still thin or gappy is one we have
> *less confidence* underwriting. So the same artifact helps the underwriter choose **where** to
> write — a second payoff we didn't plan for.

## The mask — approach (A): per-county reliable-onset

```text
 baseline(fips)  = median all-duration events over the STABLE window 2021–2025
 onset(fips)     = first year (≥2015) the county reaches ≥ 30% of its baseline
 NULL a county-year if:  year == 2014 (partial)
                      ·  year < onset  (the contiguous early ramp)   [baseline ≥ 6 only]
                      ·  post-onset year far below baseline AND state systemically empty (rare interior gap)
                      ·  CT planning regions (9110-9190) (2025 FIPS transition)
 else OBSERVED (use it — including genuine real zeros).
```

Validated (national: 91% observed; 95% of nulls in the 2014–18 ramp):

```text
 Concho TX (baseline 199, onset 2018)  null 2014-17 (5,21,0,10) · observed 2018-25   ✓ ramp caught
 Harney OR (baseline 101, onset 2019)  null 2014-18 (0,0,0,0,13) · observed 2019-25  ✓ ramp caught
 Suffolk MA (baseline 944, onset 2015) null 2014 only · keeps real 2015 (384)        ✓ busy county not over-nulled
 Erie NY (baseline 785, onset 2015)    null 2014 only                                 ✓
```

## Safeguards — we cut only the LOW/under-covered side, never the high side

This is the part to be careful about, and it is handled three ways:

```text
 1. ASYMMETRIC by construction — the rule fires only on  count < 30% × baseline.
       a genuine HIGH-spike year (hurricane) is ABOVE baseline → NEVER nulled → always kept.
       (we are masking under-coverage, NOT removing outliers in general.)
 2. MEDIAN baseline (not mean) — one giant year can't inflate the baseline and trigger
       over-nulling of normal years.
 3. LOW-activity protection — baseline < 6 ⇒ no ramp-null (a sleepy county's real 0s are real);
       and onset nulls only the CONTIGUOUS early ramp, not isolated real-low years later.
```

Residual risk (named honestly): a genuine *sharp decline* could look like a low year — but real
outage counts rarely drop 70%, it's the conservative direction to drop a suspect low year, and the
notebook's per-county dropdown lets us eyeball any cell before trusting it.

## Our opinion + the process

- **Opinion:** this is a defensible Gen-1 prerequisite. The dominant problem (a coverage ramp) is
  real, systematic, and explained; the mask is asymmetric and validates against intuition. Good
  enough to fit/cluster on the corrected series — not a perfect missing-data model, which it
  honestly isn't.
- **Process note (worth recording):** our *first* rule (within-county under-coverage **AND**
  state-wide gap) **under-nulled** — it missed Concho 2015/2017 and Harney 2017/2018. Validating
  on named counties surfaced that, and we switched to the **onset** framing. Same ground-up,
  research → design → **validate** discipline that reshaped the Step 1–2 categorization — and the
  validation is what caught the gap, again.

## What it feeds — one artifact, three payoffs · and the ceiling

```text
 1. Step-3 clustering  — fit/cluster on the corrected series (no fake worsening)
 2. the A012 fix       — per-county observed years correct the λ exposure denominator (a price move, gated)
 3. a fuller C_source  — upgrades the cell-read trust check ([cell_read_fundamentals])
```

**Ceiling:** this separates coverage-ramp from real-zero by *direction* (under-counts vs genuine
quiet). A true per-year source-coverage feed — vs our event-derived proxy — would make it exact;
absent that, we ship the onset mask and validate by eyeball.

## References

- Raises the question: [`01_eventization_frequency_discussion.md`](01_eventization_frequency_discussion.md) (§ Source-Quality Calendar / Candidate Source-Quality Policies)
- Sibling finding: [`04_duration_conservatism.md`](04_duration_conservatism.md)
- Consumers: [`cell_read_fundamentals.md`](../../methodology/02_per_customer/cell_read_fundamentals.md) (`C_source`), [A012](../../methodology/assumptions.md#a012--per-customer-exposure-uses-one-global-window-dilutes-partial-coverage-counties) (λ exposure), the **Step-3 regime classification** it feeds — [`03_risk_clustering/README.md`](../../methodology/03_risk_clustering/README.md) (overview) · [`regime_classification_methodology.md`](../../methodology/03_risk_clustering/regime_classification_methodology.md) (the canonical HOW)
- Framework: [`OUTAGE_MODELING_FRAMEWORK.md`](../../OUTAGE_MODELING_FRAMEWORK.md)
