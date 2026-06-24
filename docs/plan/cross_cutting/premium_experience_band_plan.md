# Premium Range → the Experience Band (v1 confidence → v2 experience)

**Status:** plan · **DECISION OPEN** — band method under team review (3 candidates: confidence / experience p10–p90 / experience p25–p75); see the [pressure test](../../dicsscssion/dashboard_redesign/08_band_pressure_test.md). P0 docs done as a *proposal*; P1 informs the decision; P2/P3 gated on it.
**Last reviewed:** 2026-06-24
**Owner:** outage pricing analytics
**Scope:** change *what the displayed `{low, point, high}` band means and how it's computed* — from a
bootstrap of the mean rate (confidence-in-the-average) to the empirical p10/p90 of the annual counts
(year-to-year experience). **No change to the point premium.** Records [A017](../../methodology/assumptions.md) at v2.

## Stage → Question → Solution

```text
 STAGE     v0 pricing emits a band {low, point, high} per (county, T); the engine carries it through
           the price linearly and the UI renders it.
 QUESTION  "What should the band MEAN?"  An annual policy pays on ONE year's realized outcome — so the
           band must show how much an actual YEAR swings, not how precisely we know the long-run average.
 SOLUTION  band = empirical p10..p90 of the observed annual qualifying-event counts (the year-to-year
           bounce), carried linearly. No bootstrap, no fitted distribution. Evidence-only.
```

## The change in one line

```text
  was (v1):  rel_band = p10/p90 of BOOTSTRAPPED MEANS   = spread ∕ √(years)  → shrinks toward 0   (TOO TIGHT)
  now (v2):  rel_band = p10/p90 of the ANNUAL COUNTS     = the real bounce    → converges to spread (HONEST)

  measured (eagle-i-45min, 15,135 county×T cells):  v2 median ~2.9× wider than v1  ·  98.3% of cells widen
  structural reason:  a bootstrap of the mean IS the standard error ≈ spread∕√years; √11 ≈ 3.3 ≈ the widening
```

This is the same `rel_band` slot — a 2-line body change — so it rides through `composePremium`
unchanged (the band scales multiplicatively by `location.relativity × forward.factor`, A017 untouched
in shape). Visible effect: wider bands, point unchanged.

## Decisions

```text
 D1  EXPERIENCE, not confidence-in-the-mean.   The policy is annual; price the spread of YEARS, not the
                                               precision of their average. Resolves the latent contradiction
                                               between the shipped pitch ("year-to-year bounce") and the v1 math.
 D2  Empirical p10/p90 of the raw annual counts.   No bootstrap, no KDE, no parametric fit. The trivial,
                                                    auditable, evidence-only estimator.
 D3  Experience band ONLY (v2).   Placement (within-county location basis) and forward (climate/regime)
                                  widening are DEFERRED to a later proper process — never blended in now
                                  (communicate_to_share rule 4). The (b)/(c) framework in disc 07 still stands.
 D4  Keep the v1 suppression guard.   <5 observed years, or near-zero events at long T → route to
                                      `insufficient` and suppress the point quote (unchanged).
 D5  Update A017 IN PLACE (v1→v2 evolution note), not a new ID.   The title/decision (year-based, reject
                                      Poisson, no fitted distribution) holds; the change is a correction
                                      within the same band slot, and code/doc citations to A017 stay valid.
                                      [Reversible to a supersede-with-A018 if the team prefers strict
                                       meaning-change discipline — flagged for review.]
 D6  Depth = p10/p90 (80%).   The widest the ~11-year history honestly supports; p1/p99 would be a
                              model/bandwidth artifact, not evidence. Single band for v2; a 90% Studio
                              variant is optional/deferred (not currently computed).
 D7  BandDriver value 'confidence'.   At P2, rename 'confidence' → 'experience' across types.ts /
                              compose.ts default / consumers, OR keep 'confidence' as a legacy value name
                              + a JSDoc pointing to A017 v2. Lean: rename (the term is user-visible in the
                              engine contract). Confirm at P2; either way the band MATH is unchanged.
```

## Phases & gates

```text
 P0  DOCUMENT (this change)         A017 → v2 · pricing_methodology.md band section · disc 07 v2 banner ·
     [done, awaiting review]        learning log v2 banner · this plan.
        GATE → user reviews the doc set before any code.

 P1  PRESSURE-TEST (decide here)    notebooks/premium_range/ — formalize the 3-candidate comparison
                                    (scratchpad/band_pressure_test.py): width distribution + dollar bands
                                    stratified by regime / volatility / history length; the √years story.
                                    OUTPUT = the team picks confidence / p10–p90 / p25–p75 (or a two-band view).
        GATE → team decides the band method (this gate replaces "validate v2").

 P2  ENGINE + UI                    build_data.py rel_band() → np.percentile(counts,[10,90])/mean ;
                                    band label string ; pricing-view.tsx "Confidence band" → "Experience band".
        GATE → compose.test.ts passes ; band visibly wider locally ; point unchanged.

 P3  REBUILD + DEPLOY               re-run build_data.py → regenerate web/lib/data/pricing.json ;
                                    push deploy/outage-pricing → Cloud Run.
        GATE → live smoke: bands wider, A017 v2 reflected.
```

## Change surface (P2/P3)

```text
  web/scripts/build_data.py  rel_band()        bootstrap-of-mean  →  lo,hi = np.percentile(counts,[10,90]); return lo/m, hi/m
  web/scripts/build_data.py  ~line 183 label   "year-based-80pct" →  "experience-p10-p90"
  web/lib/pricing/types.ts   BandDriver type   'confidence' → 'experience'  (or keep as legacy value + JSDoc — see D7)
  web/lib/pricing/types.ts   rateBand comment  "year-based bootstrap, A017" → "empirical p10/p90 of annual counts (A017 v2)"
  web/lib/pricing/compose.ts ~line 106 default  bandDriver ?? 'confidence'  →  follows the D7 decision
  web/components/pricing/pricing-view.tsx ~213  "Confidence band"  →  "Experience band"
  web/components/pricing/pricing-view.tsx ~188  "It's our confidence in the price" → "It's the year-to-year volatility we observed"
                                          ~185  tooltip "bounced year to year" → already correct, KEEP
  web/components/studio/* (context-bar RangeBar, price-breakdown)  →  band is label-agnostic; no stale terms
  web/lib/pricing/compose.test.ts               update only if the BandDriver value is renamed (D7); else no functional change
  web/lib/data/pricing.json                     REGENERATED (wider bands; point unchanged)
```

## Honesty / ceiling (carried from A017)

```text
  · CONFLATES TREND.  Full annual variance includes a worsening county's trend → wider = conservative;
    proper trend handling is a Step-5 forward concern.
  · THIN HISTORY.     <5 years or near-zero at long T → unreliable → insufficient + suppress (D4).
  · v2, NOT FINAL.    Named-parametric alternatives (negative-binomial / overdispersed-Poisson predictive,
    Bühlmann credibility, Gamma-Poisson) remain documented if we later want a justified p5/p95 tail.
```

## Cross-references

- Assumption: [A017](../../methodology/assumptions.md) — estimator under review (confidence vs experience).
- Pressure test / open decision: [`08_band_pressure_test.md`](../../dicsscssion/dashboard_redesign/08_band_pressure_test.md).
- Methodology (the HOW): [`pricing_methodology.md`](../../methodology/cross_cutting/pricing_methodology.md#the-premium-band-the-experience-band-a017).
- Design note / reasoning trail: [`07_outward_range.md`](../../dicsscssion/dashboard_redesign/07_outward_range.md) (v2 banner).
- Learning log: [`premium_range_clustering.md`](../../learning_logs/premium_range_clustering.md) (v2 banner; the clustering finding that makes the bounce wide).
- Premise check (read-only): `scratchpad/band_compare.py`.
