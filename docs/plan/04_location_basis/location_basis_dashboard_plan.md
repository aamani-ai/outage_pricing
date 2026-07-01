# Location Basis — Dashboard Integration Plan

- **Status:** plan of record for wiring the Step-04 location-basis artifact into the Next.js dashboard (`web/`). **Plan first — no code until reviewed.**
- **Date:** 2026-06-23
- **Companions:** notebook [`location_basis_notebook_plan.md`](../done/2026-06-23_location_basis_notebook_plan.md) · studio spec [`../done/2026-06-23_dashboard_02_studio_section_spec.md`](../done/2026-06-23_dashboard_02_studio_section_spec.md) · principles `docs/principles/communicate_to_share.md` + renewablesinfo_org `docs/principles/{ui_design,presentability}.md`
- **The artifact to consume:** `notebooks/outputs/location_basis/{relativity_table.json, tract_rurality.json (2.4MB / 81,356 tracts), county_lookup.json (3,116 counties), guardrail_spec.json}`

The dashboard does **math only** on this artifact. Calibration stays in the notebook. The location slot **already exists** in the engine (`composePremium` `location:{relativity,status}`, defaulting to neutral 1.0) and in the UI (`adjusters.tsx` renders a Location FactorRow + the price-breakdown waterfall has a Location $ bucket) — this is **populate-the-skeleton**, not build-from-scratch.

---

## 1. Principles checklist — the ship gate (run on every read/label/chart)

This is the standard the build must hit, drawn from the principles folder. **Nothing ships until it passes all of these.**

**Communicate-to-share (the 6-point test):**
```
[ ] answers the question the underwriter ACTUALLY asks ("denser or sparser than my county, and can I trust it?")
[ ] reader can state what it MEANS + what to DO without the relativity math
[ ] every panel/tag CHANGES A DECISION or carries a finding — else cut/demote to ExpandBox detail
[ ] the maturity label is defined ONCE and identical on every surface (FactorRow · banner · waterfall note · methodology drawer)
[ ] direction-of-bias + ceiling stated HONESTLY (shadow · CT/MA/RI-only · extrapolated · A018–A023)
[ ] someone OUTSIDE the build reads the Location views back correctly  ← the routinely-skipped one; do it
```
**UI design (Bloomberg-Terminal density for knowledgeable users):**
```
[ ] data leads, chrome disappears — labels small/muted, values prominent; no decorative titles
[ ] specificity — ×1.40, 91% impervious, p13; summary→precision hierarchy
[ ] immature state is HONEST not apologetic — "shadow, validated CT/MA/RI only" plainly, no padding
[ ] dark + light BOTH first-class; charts respond to theme (useChartColors); never hardcode a hex
[ ] default the simplest display; deep detail (empirical-vs-capped, Spearman) lives in a collapsed ExpandBox
[ ] reuse the existing kit verbatim — StatusBadge / InfoHint / ExpandBox / Card / EChart; invent nothing
```
**Aesthetic (restraint = credibility):**
```
[ ] no gradient, no emoji, no "shadow ✨" pill — provenance is attribution, not decoration
[ ] StatusBadge: modeled=amber dot / placeholder=hollow grey; RED is reserved for broken, never for shadow
[ ] split orthogonal questions — the FACTOR (×N), its TRUST (validated?), and the GUARDRAIL action are three things, never one blended badge
[ ] motion only for orientation
```

---

## 2. Where it fits (IA) — RESOLVED: expand-in-place in Adjusters

**Home:** Underwriting Studio → **Adjusters tab** → the **Location FactorRow becomes click-to-expand** (no new tab). Honors the locked 4-tab IA. The Pricing (outward) view shows Location **only as map context**, never as a separate factor/number.

**Rationale (the principle):** Location is a *factor / adjuster*, not a *diagnostic layer*. Baseline (Trust & Posture) and County Clustering (regime) earn their own tabs because every panel there changes a decision. Location's decision content is small — *where in the county · can I trust it · did the guardrail fire* — and the rest is evidence. Per communicate-to-share rule 5 ("every panel changes a decision or is demoted to detail"), the evidence belongs in a collapsed disclosure, not a tab. So: decision-read top-level, evidence one click away.

**Two-level progressive disclosure:**
```
DEFAULT (collapsed):  Location (within-county) · urban — built-up core   ×0.80  ●modeled  ⌄
                        shadow — validated CT/MA/RI only, not in the quoted premium

CLICK → expands in place:  Position in <County> (tercile · percentile · density · "X% above/below avg")
                           ⚠ Guardrail note (only if it fired) · one tercile relativity bar · Trust line
                           ▸ Methodology & evidence  ← nested ExpandBox: empirical-vs-capped · conservation · ρ
```
The **price-breakdown waterfall Location $ bucket** still auto-populates the moment `location.relativity ≠ 1`. **No tab registration** (quote-store / studio-view / sidebar untouched) — fewer moving parts than a tab. Repeatable: Forward gets the same expand-in-place treatment later.

---

## 3. Data flow (precise — confirmed against the current code)

```
notebooks/outputs/location_basis/*.json
        │  (web/scripts/build_data.py — add a location block; the canonical reproducible build)
        ▼
web/lib/data/location/{relativity_table.json, county_lookup.json, guardrail_spec.json}  + tract_rurality.json (SERVER-ONLY, 2.4MB)
        │  typed reader web/lib/data/location.ts  (getTract(geoid) / getCounty(fips) / getRelativity(T,tercile)) — server-only, mirrors pricing.ts/studio.ts
        ▼
/api/studio (and /api/price) route:
   lat,lon → geo.fcc.gov/api/census/block/find → County.FIPS  AND  Block.FIPS
                                                   tract GEOID = Block.FIPS.slice(0,11)   ← NO new call
   tract → getTract → tercile + within-county percentile
   ON-DEMAND guardrail: fetch NLCD zonal-impervious for the point (live MRLC WMS) → apply guardrail_spec
                        (Type A rural+imp≥70→urban · Type B urban+imp≤20→mid) → maybe reclassify tercile
   tercile → getRelativity(T, tercile).v0_shadow  → location.relativity
        ▼
composePremium({ baseline, location:{relativity, status}, forward }, {T,X,…})
   (renormalizeMeanOne is the firewall; FAILS LOUD; band carries through identically)
        ▼
Studio tabs render stack.location.relativity (the COMPOSED number);
relativity_table.json is read directly only for the EVIDENCE charts.
```

**Notes:** the per-tract relativity is already mean-1 within its county (the calibration renormed it), so the single-address path passes the relativity straight through; `renormalizeMeanOne` stays the firewall for any multi-unit composition. `validated` is **not** a `composePremium` field today — carry it in the resolver payload / studio data (drives the trust read), not the math.

---

## 4. The Location views (what to build)

Each is a `space-y-5` Card (CardHeader `flex justify-between` {title + description} + `InfoHint` top-right; CardContent; closing read in `text-muted-foreground/70 text-xs`), mirroring `baseline.tsx` / `county-clustering.tsx`. Priced numbers come from `stack.location.relativity`; evidence from the artifact.

| # | View | Shows (the decision read) | Honest label | Source |
|---|---|---|---|---|
| 1 | **Position-in-county headline** *(lead)* | where THIS address lands: tercile (rural/mid/urban) · within-county percentile · ×N.NN as "% above/below county average" | modeled · shadow — validated CT/MA/RI only, not in quoted premium (A023) | `tract_rurality` → `relativity_table[T][tercile].v0_shadow`, composed |
| 2 | **Tercile relativity bars** (T follows trigger) | rural/mid/urban span (≈1.40/1.23/0.80 at T4) as `c.loc` teal EChart bars — the rural>1/urban<1 gradient | v0 capped (0.80–1.40 = policy throttle, not the signal — A022) | `relativity_table[T].v0_shadow`, evidence-only |
| 3 | **Empirical vs capped, across T** | raw empirical (rural 1.76–2.06×) vs capped — proves the deliberate throttle | "before the activation cap" vs "the priced choice" | `relativity_table.empirical` vs `.v0_shadow`, in **ExpandBox** |
| 4 | **Conservation / mean-1 firewall** | exposure-weighted within-county mean ≈ 1.0 — proves Location only REDISTRIBUTES, never moves the county total | structural guarantee (true by construction — A018), not dressed as a finding | `compose.renormalizeMeanOne` |
| 5 | **Dispersion + validated flag** | how spread-out density is in this county (high vs low) + is it in the validated pilot set | validated:false everywhere today (CT/MA/RI graduation pending — A023) | `county_lookup{disp,n_sub,validated}` |
| 6 | **Guardrail readout** *(edge case, when triggered)* | when a tract was reclassified (the Midtown fix) — an honesty note: tercile overridden + why | on-demand; thresholds v0 physics+face-validity, not fit on outcomes (A022); **silent when not triggered** | `guardrail_spec` + the on-demand impervious value |

**Deferred:** the CONUS within-county relativity **map** (extrapolated, heaviest piece, can't reflect the per-address guardrail) — add when validation graduates + the raster is precomputed.

---

## 5. Honesty & maturity treatment (defined once)

- **One canonical label string**, reused verbatim everywhere (seed: the existing `adjusters.tsx` note) → **"shadow — validated CT/MA/RI only, not in the quoted premium."** Appears on the FactorRow, the in-tab maturity banner, the price-breakdown note, and the methodology drawer. No competing framings.
- **In-tab maturity banner** at the top of the Location lane/tab (hard spec requirement).
- **StatusBadge** = `modeled` (amber dot) when relativity ≠ 1, else `placeholder` (hollow grey). Never red.
- **Caveats by assumption ID** (A018–A023) via `InfoHint` — never restate the math.
- **Outward vs Studio split:** OUTWARD Pricing stays at **×1.00 display-only** (no shadow number; map context + one ⓘ only) until governance graduates CT/MA/RI. STUDIO headlines the **composed** v0_shadow relativity *with* the banner — consistent with the internal-dashboard-headlines-the-full-premium convention.

---

## 6. Build steps (ordered)

```
1. Promote the artifact → web bundle.  build_data.py location block → web/lib/data/location/* (+ server-only
   tract_rurality.json); add typed web/lib/data/location.ts reader (server-only, mirrors pricing.ts).
2. Resolve tract + guardrail in /api/studio.  parse Block.FIPS → tract GEOID; getTract → tercile + percentile;
   fetch on-demand NLCD zonal-impervious (live WMS) + apply guardrail_spec; return {tercile, percentile,
   relativityByT, guardrailVerdict, dispersion, validated}.
3. Feed composePremium.location (math on artifact, fail-loud).  status='modeled' when validated else compose
   neutral for outward; define precedence vs any manual kind:'location' load in quote-store effectiveFactors
   (model factor and manual load must NOT double-count).
4. Build the 6 Location views.  reuse Card/InfoHint/ExpandBox/EChart; priced from stack.location, evidence from artifact.
5. Compose into the IA.  Option B → register 'location' in all 3 places + keep the Adjusters summary FactorRow +
   retarget the waterfall CTA; Option A → expand lane A in adjusters.tsx. Confirm the waterfall $ bucket populates.
6. Honesty labels everywhere (the one canonical string + banner + StatusBadge + A018–A023 InfoHints).
7. Ship-gate.  run §1 checklist on every view; verify dark+light; the outside-reader read-back (test #6).
```

---

## 7. Open decisions

| # | Decision | Default / recommendation | Needs you? |
|---|---|---|---|
| D1 | **IA: where Location lives** | **RESOLVED (2026-06-23) — expand-in-place in Adjusters.** The Location FactorRow becomes click-to-expand → a compact decision detail (position · guardrail · one tercile bar · trust) → a nested `▸ evidence` ExpandBox (empirical-vs-capped · conservation proof · ρ). Honors the locked 4-tab IA. Rationale: Location is a *factor/adjuster*, not a diagnostic layer like Baseline/Clustering — its decision-read stays top-level and the evidence is demoted to detail (the communicate-to-share "every panel changes a decision or is demoted" rule). Repeatable: Forward expands the same way later. | resolved |
| D2 | T=12h / 24h relativity (table only has T1/2/4/8) | **clamp to T8** (gradient stable by T8; conservative, explainable) | confirm (pricing input) |
| D3 | Shadow relativity in the Studio headline premium? | **yes, composed + banner** (internal = full premium); outward stays ×1.00 | default unless you object |
| D4 | National CONUS map now? | **defer** (extrapolated, heavy, can't show the per-address guardrail) | default |
| D5 | On-demand impervious: live WMS vs cached? | **live WMS for v1** (edge case, low volume); register raster-precompute as the append-only deferral | default |

---

## 8. Out of scope / deferred (append-only, non-breaking)

- The CONUS relativity **map** layer (needs the raster precompute to reflect the guardrail).
- The **raster precompute** that retires the live per-address WMS call.
- **Calibration refresh** (out-of-region + storm-season) — stays in the notebook; clears the activation gate.
- **Search-granularity + non-residential guards** — gate the location read on geocode granularity
  (address/POI → show; region/locality/ZIP → suppress) + neutralize ≈0-resident tracts (parks/water).
  From a live observation ("Manhattan" → Central Park → "rural"). Spec:
  [`../../dicsscssion/location_aware_outage_pricing/04_location_read_granularity.md`](../../dicsscssion/location_aware_outage_pricing/04_location_read_granularity.md).

---

## 9. Sequence

1. **You review this plan + answer D1 (and D2).**
2. Build steps 1–3 (data wiring) → verify a real address composes the right relativity.
3. Build steps 4–6 (views + IA + honesty labels); you review the UI.
4. Ship-gate (step 7), incl. the outside-reader read-back.
