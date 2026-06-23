# Regime Classification — Methodology (Step 3)

*Audience: senior team + actuarial consultant. First drafted: 2026-06-22. Status: **canonical HOW for Step 3.** The 4 regimes + the T decision are settled; the decision tree is calibrated and **adversarially verified** (3 lenses; bugs fixed; thresholds confirmed not knife-edge). Implementation: [`regime_classification.ipynb`](../../../notebooks/03_risk_clustering/regime_classification.ipynb).*

**This supersedes** the 7-shape methodology in this folder (`outage_trend_fundamentals.md`,
`outage_predictability_fundamentals.md` — both bannered). **Design + history:**
[`regime_routing_backtest_plan.md`](../../plan/03_risk_clustering/regime_routing_backtest_plan.md)
(the backtest now lives as Step-5 evidence). **Framework:** [`OUTAGE_MODELING_FRAMEWORK.md`](../../OUTAGE_MODELING_FRAMEWORK.md) Step 3. **Assumptions:** A013 · A014 · A016.

## 1. What Step 3 is — and is not

Step 3 gives each county **one behavioral regime**: a label for *how its outage history behaves*.
It is a **router / identity**, not a forecast. It is derived from **outage history alone** —
behavior, not cause (no weather / grid inputs; that is [A013](../assumptions.md)).

```text
 STEP 3  describe the BEHAVIOR of the county's own count history   → one regime label  (identity)
 STEP 5  pick & backtest a forecasting MODEL, predict next year     → the number        (forecast)

 the line between them (the rule we hold):
   "which estimator predicts best" is a FORECASTING question → it lives in Step 5.
   Step 3 only says what KIND of county this is, from descriptive statistics.
```

> **Why this split.** An earlier draft let a forecasting backtest *define* the regime. That pulled
> Step-5 model-selection into the clustering and rested on fragile 4-point backtests. Step 3 is now
> a clean statistical description; the backtest (and any per-T model choice) is done once, properly,
> in Step 5 with the real models. The backtest work is retained as Step-5 *evidence* that routing can
> beat a flat baseline (~+18% out-of-sample, leakage-tested) — the motivation to build Step 5 at all.

## 2. Input — the masked annual series

Per county, the yearly count of qualifying **≥8h** outage events, 2015–2025, on the
**source-coverage-masked** series (observed years only; coverage-ramp years nulled — see
[`05_source_coverage_mask.md`](../../dicsscssion/eventization_frequency_contract/05_source_coverage_mask.md)).

```text
 carries over from the mask (state honestly in any output):
   A016  the mask is all-duration-derived, applied to the ≥8h series (discards ~3,073 real ≥8h
         events, mostly 2015-17) — a cross-resolution proxy, flagged.
   survivorship  ramp-masked counties have short, recent-only histories → their regime is
         lower-confidence (a confidence tier, §6).
```

## 3. Four behavioral regimes + one honest abstention

```text
 STABLE    no reliable trend, shift, or spike — wobbles around a steady level (mean-reverting noise)
    counts |  * *   *  *   *  *  *      the long-run average is the honest summary. the DEFAULT.
           | *   * *  *  *  *    *      sub-attribute: tight vs noisy (by CV).
           +------------------------

 TREND     a real, persistent slope (up or down) — drifts year after year
    counts |              * *          a fitted line beats the average; the level keeps moving.
           |        * *                NOT a one-time jump (that's shift); NOT a spike (that's episodic).
           |  * *
           +------------------------

 SHIFT     a level CHANGE — sat at one level, jumped to a new plateau, stays there
    counts |        * * * * *          the average straddles two regimes and mis-fits both.
           |  * *                       sub-flag (for Step 5): SETTLED (old jump, stable since) vs
           |                            ABRUPT (recent jump / still moving).  ← this is where the old
           +------------------------     "recent" vs "step" lives, as an attribute, not a top regime.

 EPISODIC  one or two transient spike years dominate, then REVERT — storm-driven, not chronic
    counts |        *                  the mass is concentrated in rare big years and comes back down.
           |  . . .   . . . *  . .      underwriting-critical: rare-storm risk, not a steady book.
           +------------------------

 INSUFFICIENT   we can't confidently type it — the honest abstention (NOT a behavior). reasons:
    short-history  too few observed years        ·  low-volume  too few events (a ratio of ~nothing)
    recent-change  a level move (up OR down) in the last 1–2 observed yrs — too new to call trend/shift/one-off
           → we say so rather than force-fit a wrong label. ~11% of counties land here.
```

> **The reframe that makes the labels true: ABSTAIN, don't force.** For thin / near-zero /
> recently-changed counties the rule logic isn't wrong — the *evidence* can't yet support a label
> (too little data, or too recent a change), so the honest output is `insufficient` (with a reason),
> which protects the labels that genuinely hold.

> **Two faces of the abstention — they must NOT read the same to an underwriter.** `insufficient`
> lumps two situations that mean opposite things:
>
> ```text
>   sparse data    short-history · low-volume   genuinely too little to say          (~219 counties)
>   recent-change  data-RICH, a recent move     ample history (median ~183 ≥8h events;
>                  too new to type yet           Middlesex MA = 2,282) — it's the RECENCY,
>                                                not the data volume, that blocks a label   (~125)
> ```
>
> The bare word "insufficient" implies *no data* — right for the first, badly misleading for the second.
> **Surfacing rule (dashboard + any carrier-facing output): show the reason, never the bare label.** The
> dashboard renders `recent-change` as **"Recent change"** (data-rich, recently moved — weigh the long-run
> average with care; check a real change vs a reporting taper near the present) and
> `short-history` / `low-volume` as **"Insufficient data"** (sparse). The classifier logic and the
> `insufficient` schema label are **unchanged** — this is a communication rule, not a regime change.

`shift` absorbs the old `recent`/`step` pair — behaviorally both are "the county moved to a new
level"; *which* forecaster to use (3-yr-mean vs last-value) is a Step-5 question, kept here only as
the recent/established sub-flag. A jump with **fewer than 3 post-years is `insufficient/recent-change`,
not a confirmed shift.** `episodic` is the most underwriting-relevant distinction (chronic vs
rare-storm) and is strict (reverting spikes only, ~1.5%).

**Real examples (from the built classifier — the eye should agree with the label):**

```text
 stable        Bexar TX     ██▇▅▁█▁▅▆█▆   [300,302,290,…,299,288]   pinned ~284, mean-reverting
 trend         Putnam FL    ▁▁▂▂▄▄▅▆▆▇█   [75,74,…,147,168]         near-doubling on a clean slope
 shift         Whatcom WA   ▁▆▇▆█▇████▇   [59,115,…,141,124]        jumped off 59, held the new level
 episodic      Albany WY    ▁▁█▄▁▁▁▁▁     [9,17,112,48,9,5,6,9,11]  one 112-storm year, then reverts
 insufficient  Cherry NE    ▁▁▁▁▅█        [0,2,4,0,22,39]           recent surge — too new to type
               Weakley TN   ▁▁▁▁▁█▁▁▁     [0,0,0,0,0,1,0,0,0]       1 event in 9 yrs — no signal
```

## 4. How a county is classified — rule-based, significance-gated

We **assign** counties to these four *known, named* behaviors (a classification), rather than
**discover** unknown groups (unsupervised clustering). Reasons: the categories are pre-defined and
intuitive; a rule tree is defensible to a carrier line-by-line; the 7-shape churn came from
*arbitrary thresholds + too many buckets*, not from rules; and tests on shape (not magnitude)
classify a 300/yr and a 30/yr county by the same logic.

```text
 FEATURES (per county, on the masked annual series)
   slope b + t-stat (OLS)            direction & its significance
   Theil–Sen slope (robust)          confirms direction isn't a single spike faking a line
   best changepoint split            μ_pre, μ_post; RSS of 2-level vs line vs constant (+ how recent)
   peak_share = max_yr / total       spike dominance (+ top2_share)
   CV                                volatility (a stable sub-attribute, not its own regime)

 DECISION (ordered; first match wins; DEFAULT = stable)  — as implemented + adversarially verified
   0. GATES        n_obs < 5 → INSUFFICIENT/short-history ·  total < 15 → INSUFFICIENT/low-volume ·
                   constant series (rss0=0) → stable/tight        (gates run first: no shape on no data)
   1. EPISODIC     (peak_share ≥ 0.40 OR top2 ≥ 0.60) AND the spike REVERTS (last yr < 0.6·peak)
                   AND the de-peaked remainder (all max-tied yrs dropped) has no significant slope
                     → a transient storm spike that came back down. strict + rare (~1.5%).
   2. STEP?        step explains ≥55% of variance AND beats the line by ≥10pp AND jump ≥2σ:
                     ≥3 post-jump years → SHIFT (recent/established) ·  else → INSUFFICIENT/recent-change
                     (a 1–2 yr jump is too new to confirm — we abstain, not force-fit trend)
   3. TREND        |t-stat| ≥ 2.5 AND sign(OLS)==sign(Theil–Sen)   → gradual, robust, persistent drift
   4. STABLE       nothing cleared its bar                          → default; CV ⇒ tight vs noisy

 ANTI-CHURN DISCIPLINE (what the 7-shape lacked)
   • gate by STATISTICAL SIGNIFICANCE (t-stat / variance-explained / jump-σ), not hand-picked cutoffs
   • DEFAULT to the simpler outcome (stable) unless the complex one clears a real bar → no borderline flip
   • ABSTAIN (`insufficient`) when data can't support a label — don't force-fit (A015)
   • 4 regimes + the `insufficient` abstention, applied in one fixed order
   • perfect-fit guard: a flawless ramp/step scores an ∞ statistic (not 0) so it isn't inverted to stable/trend
```

> **Verified, and the thresholds are calibrated knobs.** A 3-lens adversarial pass fixed real bugs
> (perfect-fit inversion, episodic swallowing late ramps, near-zero counties faking episodic, terminal
> spikes faking shift) and confirmed the gates are **not knife-edge** — ±20% threshold perturbation
> churns ≤8% of labels, all boundary-adjacent (the opposite of the 7-shape failure). `t≥2.5`,
> `peak_share≥0.40`, `r_step≥0.55`, `jump≥2σ`, `volume≥15` are explicit, tuned by face-validity and by
> what's stable across the 30/45/60-min catalogs — never silent.
> **Known limit (honest):** the changepoint search needs ≥2 years each side, so a regime change in the
> very first or last single year is not detectable *as a shift* (it routes to `insufficient/recent-change`
> until a second post-year confirms it).

## 5. Why one threshold (T=8h), not per-T

A county gets **one** regime, derived at **T=8h**, with a **cross-T stability flag** — not a separate
label per duration threshold.

```text
 the options
   A. ONE T, asserted for all T          simplest, but DISHONEST — it's the old blanket-invariance trap
   B. SEPARATE label per (county, T)      most granular, but over-complex AND unreliable (below)
   C. ONE primary (8h) + stability flag   ← chosen: clean identity, honest about where it bends

 why NOT B (per-T), even though it sounds more accurate
   DATA THINS HARD AT HIGH T  (total qualifying events, nationwide)
       2h ≈ 6.6M    4h ≈ 3.4M    8h ≈ 1.5M    12h ≈ 0.85M    24h ≈ 0.27M
                                    ▲ sweet spot               ▲ ~1–2 events/county/yr → series ≈ (0,1,2,1,0)
       classifying trend/shift/episodic on a 0–2 integer series is noise, not signal → per-T would
       manufacture UNRELIABLE labels exactly at the thin end: more labels, less truth.
   SHARED SIGNAL  events are nested (every ≥8h event is also a ≥4h event) → shape is largely common
       across T; the prototype showed flat-vs-non-flat agreement 77–79% across thresholds.
   COMMUNICABILITY  "this county is a trend county"  ≫  "trend at 8h, flat at 24h, shift at 4h…" × 3,090

 why 8h is the reference   enough events to read shape (~44/county/yr) · low boundary noise ·
       the robustly-conservative threshold ([A011] + 04_duration_conservatism). 2h/4h are timing-
       sensitive; 12h/24h are data-starved.
```

**The honesty mechanism (not blanket invariance):** the classifier runs at every T; we record a
per-county **cross-T stability flag** — high agreement ⇒ trust the single label; flips ⇒ flag
`T-sensitive`, lower confidence. The cross-T *pattern* is itself a signal: a county that reads `stable`
at 2h but `episodic` at 24h is telling you its **long-outage risk is storm-driven** (a chronic-vs-storm
read worth surfacing to the underwriter). Per-T forecasting nuance is then **consumed in Step 5**,
gated by this flag — not baked into the identity. (Refines [A014](../assumptions.md).)

## 6. Accuracy & validation — how we know the labels are right

There is no ground-truth label, so "accurate" means defensible, robust, and face-valid:

```text
 1. FACE VALID   eyeball N real sparklines per regime — the label matches the eye
 2. DEFENSIBLE   every typed (non-stable) label passes a significance test (it isn't noise)
 3. STABLE       same county → same label across catalogs (30/45/60-min) and neighbouring T
                   (this IS the cross-T stability flag of §5, reused as a validity check)
 4. DISTINCT     regimes genuinely separate on their defining feature
 5. CROSS-CHECK  a light unsupervised clustering should roughly agree with the rule labels;
                   disagreements are the counties to eyeball
```

## 7. What it produces — the per-county metadata map

One row per county (`county_regime_T8.csv`). The **sub-flag is regime-specific**; the rest is
universal. This is the reference for reading a county and for the dashboard tooltip.

```text
 OUTCOME        sub-flag values                              driven by
 ───────────────────────────────────────────────────────────────────────────────────
 stable         tight | noisy                                cv (< 0.15 = tight)
 trend          up | down                                    sign of the slope
 shift          recent | established                         post_n (yrs since jump; ≤4 = recent)
 episodic       peak=0.XX                                    peak_share
 insufficient   short-history | low-volume | recent-change   why we abstained
 ───────────────────────────────────────────────────────────────────────────────────
 UNIVERSAL columns:  regime · sub · n_obs · first_yr · total · tstat · r_step · peak_share · cv
                     · stab4 · stabS · labels_by_T · xT · conf

 CONFIDENCE (typed counties)  conf = LOW if any:
   n_obs<8 · first_yr>2016 · total<20 · stab4<0.5 (T-sensitive)
   · shift & r_step<0.60 · trend & |tstat|<2.75  (a borderline call)     else HIGH ;  insufficient → —
   (it is an HONESTY flag — "should you trust this label" — NOT a model probability.)

 CROSS-T DESCRIPTOR (xT)  — from the per-T label vector (labels_by_T), the chronic-vs-storm read:
   T-stable            label holds across thresholds (stab4 ≥ 0.75)
   intensifies@longT   stable/insufficient at short T → structured at long T  → STORM-driven long outages
   weakens@longT       structured at short T → stable/insufficient at long T  → signal is in short outages
   T-mixed             flips without a monotone pattern → read with caution
   (national: T-stable ~1460 · T-mixed ~825 · weakens ~589 · intensifies@longT ~216 counties)
```

> **Worked example — Baldwin AL (coastal, hurricane-prone):** `stable` at 2/4h but `shift→trend` at
> 8/12/24h ⇒ `intensifies@longT`. Its *long* outages are storm-driven even though its short-outage
> rate looks steady — exactly the read an underwriter wants, and invisible if we only showed the
> single 8h label. The notebook's `show_county()` card prints all of this for any county.

**Feeds:** Step-5 forecasting (the regime routes to a model class; the backtest + per-T forecasting
nuance live there) · the dashboard (color-by-regime map, the county card, the chronic-vs-storm read).

## 8. Assumptions

- [A013](../assumptions.md) — regime is behavior-based (history only; cause data deferred).
- [A014](../assumptions.md) — derived at T=8h; **one primary label + cross-T stability flag** (not
  blanket T-invariance — refined here, §5).
- [A016](../assumptions.md) — the all-duration coverage mask is applied as a proxy for ≥8h observability.

## 9. References

- Design + the retained backtest evidence: [`regime_routing_backtest_plan.md`](../../plan/03_risk_clustering/regime_routing_backtest_plan.md)
- The masked input series: [`05_source_coverage_mask.md`](../../dicsscssion/eventization_frequency_contract/05_source_coverage_mask.md)
- Why 8h is conservative: [`04_duration_conservatism.md`](../../dicsscssion/eventization_frequency_contract/04_duration_conservatism.md)
- Framework: [`OUTAGE_MODELING_FRAMEWORK.md`](../../OUTAGE_MODELING_FRAMEWORK.md) Step 3
