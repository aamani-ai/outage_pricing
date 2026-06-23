# Key Decisions — Regime Classification (2026-06-22)

## 1. Step 3 is STATS clustering, not a forecasting backtest

**Decision.** Step 3 derives a county's regime from **descriptive statistics** of its outage history.
The forecasting **backtest** (which estimator predicts best) moved to **Step 5**, retained as
*evidence* that routing beats flat (~+18% OOS).

**Rationale.** Model selection is a forecasting activity → it belongs in Step 5, with the *real*
models (Sarasi's weather ML, hazard), not a toy 5-estimator backtest. Backtesting on ~7–11 annual
points is also low-power. Step 3's job is the *identity* (the router); Step 5 forecasts on top of it.
This split was the user's call after the first (backtest-defines-regime) rebuild conflated the two.

## 2. Outcome set = stable / trend / shift / episodic + INSUFFICIENT

**Decision.** Replace the backtest's `flat / recent / trend / step` with **stable / trend / shift /
episodic**, plus an explicit **`insufficient`** abstention.

**Rationale.**
- `recent` vs `step` was a *forecasting-estimator* distinction (3-yr-mean vs last-value) — a Step-5
  concern, not a Step-3 behavior. Both are "the county moved to a new level" → merged into **`shift`**
  (with a recent/established sub-flag).
- **`episodic`** added — storm-spike-that-reverts is behaviorally distinct and the most
  underwriting-relevant (chronic vs rare-storm); the old 7-shape had it.
- **`stable`** (not "flat") — intuitive for the underwriter.

## 3. ABSTAIN, don't force (`insufficient`)

**Decision.** When the data can't support a label — `n<5` (short-history), `total<15` events
(low-volume), or a jump with `<3` post-years (recent-change) — output **`insufficient`** with the
reason, not a forced regime. ~11% of counties.

**Rationale.** The user's key insight: for Cherry NE `[0,2,4,0,22,39]` etc., **the logic isn't wrong
— the data is.** Forcing a label produces confident *wrong* answers (Cherry → "trend"). Abstaining is
honest and *protects* the labels that genuinely hold. Recorded as **A015**.

## 4. Rule-based, significance-gated (not unsupervised clustering)

**Decision.** A transparent decision tree where each label must pass a statistical test (slope
t-stat ≥ 2.5 + Theil–Sen sign agreement; step explains ≥55% variance + beats line + jump ≥2σ;
peak-share ≥ 0.40 + reverts). Default = stable.

**Rationale.** We *know* the categories → it's a classification, not discovery. A rule tree is
defensible to a carrier line-by-line; unsupervised would group by *magnitude* not *shape* and be a
black box. The 7-shape churn came from **arbitrary thresholds + too many buckets**, not from rules —
so the fix is significance gates + default-to-simpler + only 5 outcomes (one a fixed order).

## 5. One primary label @ T=8h + cross-T stability (not per-T, not blanket-invariant)

**Decision.** Classify at all five T (2/4/8/12/24); the **primary label is T=8h**; each county carries
a cross-T **stability** score + the per-T label vector + a **descriptor**. Not a separate label per T.

**Rationale.** Per-T is over-complex *and* unreliable (24h is ~1–2 events/county/yr → noise). Events
are nested so the shape is largely shared (binary stable-vs-typed agrees ~74% across T). One identity
is communicable. T=8h is the robustly-conservative, data-rich threshold (A011 / duration analysis).
Honest middle: don't assert invariance — flag T-sensitive counties (A014).

## 6. Surface the cross-T story as metadata (the chronic-vs-storm read)

**Decision.** Add a `xT` descriptor: `T-stable` / `intensifies@longT` / `weakens@longT` / `T-mixed`.
`intensifies@longT` (stable at short T → structured at long T) = **storm-driven long outages**.

**Rationale.** We already compute the label at all 5 T — so exposing the per-T vector is cheap and
*informative*. Baldwin AL (coastal) reads `stable` at 2/4h but `shift→trend` at 8/12/24h — its long
outages are storm-driven. That read is invisible if we show only the 8h label, and it's exactly what
an underwriter needs. This is the user's "multiple frequencies" instinct, delivered as metadata.

## 7. The existing 7-shape pipeline is a TEACHER, not a crutch

**Decision.** Build fresh; do **not** depend on or force-reuse the old `county_trend` /
`county_predictability` pipeline. Learn its discipline (careful step-change gating, a
sparse/insufficient escape hatch).

**Rationale.** The old pipeline "picked things nicely" because of that discipline — but it churned at
the label level. We keep the lessons (esp. the insufficient escape hatch) and drop the dependency.
