# Decisions Locked (Dashboard Redesign)

Converged during the design discussion. Each is settled unless re-opened in `06_open_questions.md`.

```text
  D1  Fresh rebuild, harvest the proven pieces — NOT a patch of the old dashboard.
  D2  Stack: Next.js + React + shadcn/Radix + Tailwind + ECharts (charts) + MapLibre (map).
  D3  ONE end-to-end premium; per-component status badges; NO shadow/active dual number.
  D4  Three sections: Pricing (outward) · Underwriting Studio (internal) · Settings/Data.
  D5  Two adjustment layers — location (within-county, mean-1) + forward (combined climate+grid).
  D6  Regime taxonomy + confidence live in the Studio ONLY — never in the outward Pricing snapshot.
  D7  Studio surfaces the Steps 1–2 "which-T-to-underwrite" cushion signal, on the matrix rows.
  D8  No auth / access control in scope — single app, build the core well.
  D9  Port + adapt principles (ui_design · scaling · usability) under communicate_to_share.
  D10 Charts: waterfall (factor build-up) · 100% stacked bar (dollar split) · tornado (sensitivity). No Sankey.
  D11 Build as a coherent MODULE inside the InfraSure platform shell — not a separate-looking app.
```

---

### D1 — Fresh rebuild, harvest the proven pieces
The IA is inverting (feature-views → persona/depth sections); the old `app.js` is a 4,571-line
monolith with the premium formula duplicated 5+ times, zero tests, manual cache-busting that broke
twice. The reframe (D3) needs a single pricing engine as its spine — a ground-up keystone, not an
edit. **But** the old dashboard's pure `composeLocationPremium()`, theming, ColorBrewer scales,
MapLibre interaction, Mapbox geocoding, and methodology drawer are genuinely good → port them. Old
dashboard = reference we mine. *Discipline:* extract the pricing engine first and write a canary
test (live-catalog anchor: Alachua FL, T=4h, X=$500 → ≈$78.76 retail; the deck's ≈$154 is stale) **before** any UI.

### D2 — Stack  *(resolved 2026-06-23, `06`/Q6)*
**Next.js + React 19 + shadcn/Radix + Tailwind + ECharts + MapLibre.** Match the InfraSure /
renewablesinfo platform framework so we lift the recon's component layer almost directly and stay
native to the family (D11); keep **ECharts** (not the platform's Recharts) for charting headroom
(waterfall, tornado, distributions from one declarative API, tree-shaken via `echarts/core`).
MapLibre stays the map (vector tiles, feature-state); theme via next-themes. ECharts/MapLibre coupling
kept at the leaf so it's replaceable; all themed off the same CSS-variable (oklch) tokens.

### D3 — One end-to-end premium, no shadow price
Every component shows its value with a quiet status badge — `active` / `modeled` / `placeholder` —
and unplugged layers sit at a neutral `1.00×`. No "real vs shadow" pair (two competing framings of
one number). Honesty about the ceiling comes from the per-component badge, not a second number —
the "provenance is universal, not special-cased" idea from `ui_design.md`. See `04`.

### D4 — Three sections
Pricing (outward, simple, shareable) · Underwriting Studio (internal, deep) · Settings/Data
(catalog/source selection — the old "3 database options" live here). Section = the persona's job.

> **Amended 2026-06-28** (plan `dashboard_redesign/03`, primer `rules_engine_governance/00`): the third
> section **"Settings/Data" → "Rules Engine"** — the carrier's rules table (binding/delegated authority
> bounds), locked. Section = the **actor** (carrier · underwriter · policyholder), not just the persona's
> job. The global ER/TM loadings move **out** of this section into Studio → **Adjustments** (bounds-vs-values:
> the carrier sets the cap/floor here; the underwriter picks the working value there). Data-source/catalog
> stays here under a "Platform data" group, flagged as InfraSure config, not a carrier rule. D8 (no auth)
> still holds and is what lets us defer real upload/access-control.

### D5 — Two adjustment layers
`baseline λ_customer(T) × location(within-county, mean-1) × forward(climate + county-grid) × X ÷ (1−ER−TM)`.
Forward climate + grid conditioning **combine into one forward factor** at the surface, stay
separable in the engine. Grid conditioning is a *signal at two scales*, split by the mean-1
firewall. See `04`.

### D6 — Regime + confidence → Studio only
The regime taxonomy (`stable/trend/shift/episodic/insufficient`), the confidence flag, and the
cross-T descriptor (`intensifies@longT`) change an *underwriter's* decision, not a buyer's
(`communicate_to_share` rule 5). Outward Pricing stays free of them — not even a soft chip.

### D7 — "Which-T-to-underwrite" signal in the Studio
The Steps 1–2 analysis found our construction is conservatively cushioned at some T and thin at
others (A011). Surface that cushion as a per-T "underwriting comfort" indicator **attached to the
matrix rows** (not a separate panel), composed with the regime cross-T descriptor: the sweet spot
is where we're well-cushioned AND the regime is well-behaved. See `03`.

### D8 — No auth in scope
Single app, no login/role-gating. With the shadow price gone (D3), there is nothing sensitive to
gate; the outward/internal split is navigational, and we build the core well.

### D9 — Principles ported + adapted
Bring `ui_design.md`, `scaling.md`, and the usability doc (`open_source_tool.md`) into this repo's
`docs/principles/`, rewritten for carriers/underwriters/advisors, under the existing
`communicate_to_share.md` spine. Also codify "reference, not constraint" here.

### D10 — Charts  *(refined by the UX research, 2026-06-23)*
**Waterfall** for the multiplicative factor build-up (baseline → location → forward → expense/margin),
rendered as ± % uplifts on log-spaced bars (the documented fix for the multiplicative pitfall);
**100% stacked bar** for the static dollar split (pure / expense / margin); **tornado** as a secondary
"what moves this price" sensitivity view. **Sankey dropped** — it implies routing/flow our linear
build-up doesn't have. MapLibre for the map. (Charts were delegated to us; the research sharpened the
call. Dropping Sankey weakens the case for ECharts → see `06`/Q6 stack reconciliation.)

### D11 — Coherent module in the InfraSure platform shell
Our Pricing + Underwriting Studio + Settings live inside the broader InfraSure platform's design
language — the same shell: grouped action-oriented sidebar, context/portfolio selector, breadcrumb +
tabs, KPI-card rows, theme toggle, brand. Outage-insurance pricing maps naturally to the platform's
`Mitigate → Risk Transfer` area. We design our specific views (the Pricing result, the Studio
drill-down) ourselves, but they should feel **native to the family**, not a standalone app — so we
inherit/match the shell + component grammar (confirmed against the platform / renewablesinfo
reference in the recon) and own our *views*, not a whole separate visual system. Resolves `06`/Q5.
