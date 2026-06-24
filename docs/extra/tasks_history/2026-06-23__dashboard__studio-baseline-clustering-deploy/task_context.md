# Task Context — Studio (Baseline + County Clustering), regime-label fix, and live deploy

*Date: 2026-06-23 · Area: dashboard / underwriting-studio + deploy*

## Objective
Build out the Underwriting Studio's deep tabs (Baseline, County Clustering) to the spec, fix a
trust-killing regime mislabel surfaced during review, keep docs↔dashboard consistent, and **ship the
whole Next.js dashboard live to Cloud Run** (replacing the old python static dashboard).

## Background
The from-scratch dashboard rebuild (a two-audience product — outward **Pricing** + internal
**Underwriting Studio** + **Settings**) had its engine, shell, Pricing view, Settings, and a Studio
shell already built in prior sessions. This session built the Studio's analytical depth and deployed.
Canonical spec: `docs/plan/dashboard_redesign/02_studio_section_spec.md` (grounded by a survey of our
notebooks/MD). House principles enforced throughout: data-leads / scannable / honest provenance /
communicate-to-share (`docs/principles/`, and renewablesinfo_org `docs/principles/ui_design.md`).

## What we did (this session)
1. **ECharts foundation** — `web/components/charts/echart.tsx` (thin theme-aware wrapper + `useChartColors` + `tooltipStyle`). Charts now have real hover tooltips (replaced bare CSS-div bars).
2. **Price Breakdown tab** — factor build-up rows that route into the deep tabs + an ECharts **dollar waterfall** decomposed into **Baseline / Location / Forward** buckets (with legend), exact integer split (sums to the premium).
3. **Baseline tab = the Trust & Posture cell read** (the big correction). First shipped a one-dimensional "comfort" score; reviewer flagged it conflated things and omitted the documented framing. Rebuilt per `cell_read_fundamentals.md`: **TRUST** (weakest-link of coverage/sample/stability → Strong/Medium/Thin) and **POSTURE** (cushion LEVEL by duration + TILT vs peers), shown as two orthogonal axes + a per-cell detail (collapsed) + a Trust×Posture grid w/ the VERIFY zone. Plus the per-customer median→mean→max spread + annual history (overdispersion read).
4. **Regime mislabel fix** — reviewer caught Middlesex MA tagged "insufficient" despite 2,282 events. Diagnosed: NOT a bug — the classifier correctly **abstains** on `recent-change`, but the word "insufficient" (right for sparse `low-volume`/`short-history`) is misleading for the **data-rich** `recent-change` bucket (125 counties, median ~183 events). Split it at the display layer: `recent-change` → "Recent change"; sparse → "Insufficient data". Classifier/schema unchanged.
5. **County Clustering tab** — regime identity (corrected label) + cross-T strip + annual ≥8h series w/ least-squares trend overlay + national peer mix grouped as **4 behavioral regimes + a 2-faced abstention** (not "6 clusters"). Collapsed classifier-detail expander.
6. **Methodology docs** — `regime_classification_methodology.md` (§3 "two faces of the abstention" + surfacing rule) and `03_risk_clustering/README.md` (surfacing note) updated so the team's GitHub view matches the dashboard. Determined the issue was **communication, not quantitative/code**.
7. **Smaller UI** (continued from prior): map ResizeObserver + sticky height; top-right 🔔/❓ popovers; About scrubbed of data sources; risk-read → collapsed "Risk detail" expand; sidebar nested sub-nav under Risk explorer (mirrors the top tabs — both drive a shared `studioTab`); restored the section divider; Settings "Apply across the platform" button; context-bar layout fixes; "Chris's question" attribution removed from UI.
8. **DEPLOY (live)** — Next.js dashboard live at the canonical URL via GitHub Actions on push.

## Files touched (created/modified)
- **Studio tabs:** `web/components/studio/tabs/{price-breakdown,baseline,county-clustering,adjusters}.tsx`, `web/components/studio/{studio-view,context-bar,adjustments-panel,shared}.tsx`
- **Charts/util:** `web/components/charts/echart.tsx`, `web/lib/base-path.ts` (new: `api()`/`asset()` basePath prefixers)
- **Shell:** `web/components/shell/{sidebar,topbar,nav-config,account-menu}.tsx`, `web/components/settings/settings-view.tsx`
- **State/data:** `web/lib/quote-store.tsx` (added `loadings`, `studioTab`), `web/scripts/build_data.py` (added cell-read, mult, od, regime fields, regime-dist), regenerated `web/lib/data/{pricing,studio,counties-by-state,regime-dist}.json`
- **Deploy:** `web/Dockerfile` (new), `web/.dockerignore` (new), `.github/workflows/deploy-outage-pricing.yml` (rewrote for Next.js + deploy-to-live + `--to-latest`), `.github/workflows/promote-outage-pricing.yml` (new, on main)
- **Docs:** `docs/methodology/03_risk_clustering/{regime_classification_methodology,README}.md`

## Current status
- ✅ Pricing + Studio (Price Breakdown · Baseline · County Clustering) all substantive and live.
- ✅ Deployed: **https://outage-pricing-wsd6lcl64q-uc.a.run.app/dashboard** (canary $78.76 ✓, logo loads, geocode works, both themes).
- ✅ Docs↔dashboard consistent on the regime taxonomy.
- 🔲 **Adjusters** tab is still a framed placeholder — it's the one remaining piece and is a separate quantitative workstream (NOT UI).

## Next steps
**Adjusters** — see handoff.md. Location = promote + validate the shadow artifacts; Forward = build a real signal (blocked on upstream data). Both are quant groundwork; the tab honestly shows them as developing today.
