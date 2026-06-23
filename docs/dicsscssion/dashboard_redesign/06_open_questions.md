# Open Questions (resolve before the plan)

Threads still open. Each names the doc it feeds and a default/lean where we have one.

```text
  Q1  Grid double-count firewall = mean-1 renormalization?        → 04   (lean: yes, confirm)
  Q2  T-comfort signal attached to the Studio matrix ROWS?        → 03   (lean: yes, confirm)
  Q3  How is the premium "range" derived?                         → RESOLVED → 07 (confidence band; (b) = position)
  Q4  Section names — "Pricing / Underwriting Studio / Settings"? → 01   (lean: keep, confirm)
  Q5  Standalone vs module in the InfraSure platform shell?        → RESOLVED → D11 (coherent module)
  Q6  Stack?                                                      → RESOLVED → D2 (Next.js+shadcn+ECharts)
  Q7  Catalog/data-source selector — where does it live?          → 01   (lean: Settings + top context selector)
  Q8  Auth gate if/when we publish a LIVE external link?          → 01   (deferred — D8 says none for now)
  Q9  How does the new dashboard reach the remote?                → RESOLVED → plan/deployment.md (reuse service + tagged cutover)
```

---

### Q1 — Grid firewall
Is the **mean-1 renormalization** of the location relativity the intended mechanism that lets the
grid signal feed both the location layer (within-county deviation) and the forward layer (county
mean + trend) without double-counting? This is the load-bearing assumption behind D5. *Lean: yes.*

### Q2 — T-comfort on the matrix rows
Surface the Steps 1–2 conservatism/cushion signal as a per-T "underwriting comfort" indicator in a
gutter on the **Studio matrix rows** (composed with the regime cross-T descriptor) — vs a separate
panel the underwriter has to cross-reference. *Lean: on the rows (data leads, chrome disappears).*

### Q3 — The premium range
**RESOLVED (2026-06-23 — full write-up + worked examples in `07_outward_range.md`, validated in
`notebooks/premium_range/`).** The realization: (a)/(b)/(c) are *three different uncertainties*, not
rival answers. **(a)** confidence (a **year-based** band on the observed annual rate — outages cluster,
so a naive Poisson-on-count was ~2× too tight; A017) = the **band**; **(b)** the
per-customer multiplier spread = **heterogeneity** (the old work's value), kept as the Studio's
**position-in-county** read, NOT the band; **(c)** location/geocode resolves where the address sits
in (b). Composition: `band = (a) confidence, widened by unresolved (b) when (c) placement is weak`.
Per `communicate_to_share`, confidence and heterogeneity stay **two separate reads**, never one
blended band. Engine returns `{low, point, high}` + a band-driver tag (refines plan P1).

### Q4 — Section names
Keep `Pricing` / `Underwriting Studio` / `Settings`, or rename (e.g. "Quote", "Pricing Workbench",
"Risk Studio")? Names should say what the user does there. *Lean: keep, confirm.*

### Q5 — Standalone vs platform module  ⟵ surfaced by the reference image
The shared InfraSure platform shell has a `Mitigate → Risk Transfer` nav slot — which is exactly
where outage-insurance pricing belongs. So: do we build a **standalone tool** that *matches* that
design language, or a **module that slots into the platform shell** (same sidebar, brand, KPI/tab
grammar)? This shapes the sidebar IA and how much shell we own vs inherit.
**RESOLVED (Chris, 2026-06-23): coherent module** — feels native to the InfraSure platform family;
we own our views, inherit the shell. See `00`/D11.

### Q6 — Stack reconciliation (reopened by the recon)
React is settled. The recon shows the design-language reference is **Next.js 16 + React 19 +
shadcn/Radix + Tailwind 4 + Recharts + next-themes**, and the viz research dropped Sankey (D10) — so
**Recharts now covers our chart needs**. Given D11 (coherent module) + maximum component reuse (we can
lift the recon's component list almost directly), the lean is to **match the platform stack: Next.js +
shadcn + Recharts**, vs our earlier D2 pick of **Vite + ECharts** (still viable if we'd rather a
standalone-but-consistent app with richer charting). The UI layer (shadcn/Radix/Tailwind) ports to
either. This is the one foundational decision the research reopened. *Lean: match the platform.*

**RESOLVED (Chris, 2026-06-23): Next.js + shadcn/Radix + Tailwind + ECharts + MapLibre** — match the
platform framework (reuse + nativeness, D11), keep ECharts (not Recharts) for charting headroom. See `00`/D2.

### Q8 — Auth (deferred)
D8 scopes no auth. The IA research notes that a *shared external link* ideally resolves only to the
calm outward layer via route+auth. We're not publishing a live link now, and D3 (no shadow price)
means nothing actuarially sensitive is exposed — so this stays deferred. Revisit before any live
external share. See `01` (audience boundary).

### Q9 — Remote deployment
**RESOLVED (Chris's call, deferred to me, 2026-06-23): reuse the existing `outage-pricing` Cloud Run
service, URL, registry, and WIF/GHA plumbing; ship the new Next.js image; cut over via a tagged
no-traffic revision → validate → flip traffic 100% → archive the old.** One canonical URL (keeps the
deck/links valid), reused vetted security plumbing, preview-before-promote. Full plan: `plan/dashboard_redesign/deployment.md`.

### Q7 — Data-source selector placement
The old dashboard's catalog/source switch (the "3 EAGLE-I options") — does it live in **Settings**,
or as a **top-of-sidebar context selector** (like the "AIG Client Portfolio ▼" in the reference), or
both? *Lean: Settings owns it; a compact context selector echoes the active choice.*
