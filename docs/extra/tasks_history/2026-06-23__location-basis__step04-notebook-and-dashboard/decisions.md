# Decisions — 2026-06-23 (Location Basis Step 04)

## 1. Calibration is LOCAL/offline; the dashboard does MATH ONLY (the core architecture)
**Decision:** All calibration + experiments live in `notebooks/04_location_basis/`, emitting a versioned
**numbers artifact** to `notebooks/outputs/location_basis/`. The dashboard consumes that artifact and only
does arithmetic (`per_customer × relativity`). Updating = **re-run the notebook → swap the numbers** →
dashboard unchanged. No calibration logic ever enters dashboard code.
**Rationale:** Clean separation; the heavy/offline work (raster, WMS, fitting) stays out of the runtime.
It also makes the forward path trivial: when PowerOutage.US sends more data, re-run + swap. Not customer-facing
yet — we're building the *process*, so we don't over-engineer the dashboard piece.

## 2. Manhattan fix = a SYMMETRIC, CONSERVATIVE NLCD zonal-impervious GUARDRAIL on density (not a replacement)
**Decision:** Keep validated **population density** as the within-county feature; use **zonal-mean NLCD
impervious %** only as a guardrail where density is provably wrong. **Type A** (sparse residents + high
impervious → rural→**urban**, a discount) fires on the strong, unambiguous high-impervious signal.
**Type B** (dense residents + low impervious → urban→**higher**, an uplift) is **deliberately conservative**
(for outage insurance, over-charge an ambiguous location rather than under-charge) and **documented** —
low impervious is ambiguous (urban green space reads low), so Type B may over-penalize leafy tracts; an
accepted, flagged bias.
**Rationale:** No single proxy *is* the grid — each has blind spots. High impervious is unambiguous (a
de-uplift discount is safe); low impervious is ambiguous (so the penalty is conservative, per the pre-op
rule "discounts require stronger evidence than uplifts"). **Point**-impervious already lost to density
(within-county ρ −0.20 vs −0.35) because one 30 m pixel is noisy → the **zonal mean** is the fix.

## 3. KEEP the calibrated relativity numbers — reproduce, don't re-fit (no new data)
**Decision:** The notebook re-derives the relativity from source and **asserts it matches** the locked
`density_relativity.json` exactly; it does **not** re-fit the magnitudes. The guardrail fixes *which
tercile a tract lands in*, not the multipliers.
**Rationale:** No new outcome data exists beyond the CT/MA/RI pilot, so re-fitting would change nothing
and only risk drift. This also fixed an apparent tension with "fix the MA join misses" — fixing the join
would shift the numbers, so the 14 MA "Town city" misses are **named honestly and the fix deferred** to
re-calibration.

## 4. NO new robustness / noise-floor analysis on thin data
**Decision:** Skip noise-floor / credibility re-analysis (the H3 work). The notebook does **reproduction
+ the feature fix**, nothing more on the statistical-confidence front.
**Rationale:** With one quiet season of PoUS data we already know it's thin — re-interrogating its
confidence buys nothing. The job is the Manhattan **feature** fix, grounded in **physics + face validity**
(impervious measures built-up-ness directly), not statistics on a thin sample. (User explicitly steered here.)

## 5. Emit BOTH empirical and capped; the cap is a documented, tunable parameter
**Decision:** The artifact carries `empirical` (uncapped) and `v0_shadow` (capped to `[0.80, 1.40]`) per T.
The cap is framed as an **attribution-confidence throttle** (how confidently we can place an address in the
tail), not the signal size. Retire the dead `[0.85, 1.35]` rail.
**Rationale:** Honesty about how much is being throttled; matches the "numbers we update later" model.

## 6. IA: expand-in-place in Adjusters, NOT a 5th tab (evolved with the user)
**Decision:** The Location detail lives **inside the Adjusters tab** — the Location FactorRow becomes
**click-to-expand** → a compact decision detail (position · guardrail · one tercile bar · trust) → a nested
`▸ evidence` ExpandBox. No new tab, no IA registration.
**Rationale:** *Location is a **factor/adjuster**, not a diagnostic layer.* Baseline (Trust & Posture) and
County Clustering (regime) earn their own tabs because every panel there changes a decision. Location's
decision content is small (where in the county · trust · did the guardrail fire); the rest is **evidence**.
Per communicate-to-share rule 5 ("every panel changes a decision or is demoted to detail"), the evidence
belongs in a collapsed disclosure, not a tab. Honors the locked 4-tab IA; less code; repeatable (Forward
expands the same way later). *(I initially leaned toward a 5th tab on a "symmetry with Baseline/Clustering"
argument — that was wrong; Location isn't as content-dense. The user's expand-in-place instinct was righter,
and the principles confirm it.)*

## 7. Outward stays ×1.00 (display-only); the Studio composes the shadow relativity
**Decision:** The modeled relativity is wired into `composePremium.location` **only in the Studio path**
(`/api/studio`). The outward `/api/price` path is untouched → the buyer premium is unmoved while location
basis is shadow. The Studio headlines the composed shadow number *with* the maturity caveat.
**Rationale:** Matches the project convention (internal dashboard = full composed premium honestly; outward
= strict). Location is `validated:false` (pilot-calibrated, nationally extrapolated) — not fit to move a quote.

## 8. On-demand per-address WMS guardrail for v1; defer the raster precompute
**Decision:** Apply the guardrail **per address at request time** via a small MRLC WMS zonal-impervious
lookup (3×3 grid, concurrent, 5 s timeout, graceful fallback; fires only for rural/urban terciles). Defer
the multi-GB CONUS NLCD raster precompute (only needed for a *static national map* guardrail layer).
**Rationale:** Internal, low-volume → on-demand (~1–2 s) is fine and avoids the heavy download. Both
remaining pieces (raster precompute, calibration refresh) are **append-only**, non-breaking.

## 9. Defer the tract↔town grain unification (D3) + reuse-T8 for long triggers
**Decision:** Keep the existing hybrid — validated on **towns** (CT/MA/RI pilot), applied on **tracts**
nationally (48 states; pilot states excluded from the tract surface). For triggers T ≥ 8h (the slider also
offers 12h/24h, uncalibrated), **reuse the T8 relativity** (clamp).
**Rationale:** No data to re-validate at tract grain; the seam is documented, not closed. Reuse-T8 is the
conservative, explainable choice (the gradient is stable by 8h). Both are honest, minimal moves.
