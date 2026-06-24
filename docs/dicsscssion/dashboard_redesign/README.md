# Dashboard Redesign — Discussion

The pricing dashboard is moving from an **internal experiment** to a **product**. This folder is
the design discussion that precedes the plan (documents-first). When the decisions here settle,
they graduate to a multi-file plan under `docs/plan/`.

## The thesis

> Make the dashboard **purpose-driven** — organized by *who is using it and what they need*, not
> by *which data table they happen to be looking at*. One pricing engine, surfaced at two depths.

```text
  WHO                     SECTION              WHAT THEY NEED
  ──────────────────────  ───────────────────  ──────────────────────────────────────
  carrier / buyer         Pricing              address → annual premium, simply
  (shareable OUTWARD)                          + an intuitive risk read

  underwriter / advisor   Underwriting Studio  the full factor chain, the county risk
  (internal)                                   regime, confidence, tweakable loadings

  operator                Settings / Data      data source / catalog selection, knobs
```

## The one big reframe

**One end-to-end premium. No shadow price.** Every component (baseline · location · forward) shows
its value with a quiet status badge — `active` / `modeled` / `placeholder` — and unplugged layers
sit at a neutral `1.00×` placeholder. We never show a "real" price beside a "shadow" price; that
is two competing framings of one number (`docs/principles/communicate_to_share.md`). This is the
biggest break from the previous dashboard.

## Index

| Doc | What | Status |
|-----|------|--------|
| `00_decisions_locked.md` | Converged decisions + rationale | drafted |
| `01_audience_and_ia.md` | Two audiences, three sections, the IA | drafted |
| `02_outward_pricing_view.md` | The shareable Pricing section | drafted |
| `03_underwriting_studio.md` | The deep Studio (chain · regime · T-comfort) | drafted |
| `04_pricing_model_in_ui.md` | Two-layer chain + grid firewall + status grammar | drafted |
| `05_visual_system_and_stack.md` | Aesthetic, tokens, components, stack, references | drafted |
| `06_open_questions.md` | Threads to resolve before the plan | drafted |
| `07_outward_range.md` | What the premium range means (three-uncertainty framing) + backend, for trust; carries the 2026-06-24 experience-band update | drafted |
| `08_band_pressure_test.md` | **Band method DECISION (open):** confidence vs experience p10/p90 vs p25/p75 — width tables + dollar comparison, for team feedback | drafted |

## Method (how we're designing this)

1. **User-first.** Start from what each audience needs; design the experience, then wire the data.
2. **Reference, not constraint.** Mine the old dashboard, the renewablesinfo web app, and the
   InfraSure platform shell (`docs/extra/references/`, gitignored) for what works — re-derive for
   our context. (`principles/ui_design.md` "Reference platforms"; regime decision "teacher, not crutch".)
3. **Research → ideas → then the developer view.** Form the right idea from how real products solve
   it; consult the reference code *after*, to see what we can reuse.
4. **Documents first.** This folder, then the plan, then code.

## Status

- All section docs `00`–`07` are drafted; **Q3 (the range) is now resolved** in `07` (+ notebook).
- The user-first UX research sweep + reference recon (workflow `dashboard-rebuild-research`) completed;
  `01 / 02 / 03 / 05` are written from its findings (4 angles + a file-pointed reference recon).
- Two earlier calls were reopened by the research: D10 (Sankey dropped) and the stack (`06`/Q6, resolved).
- Only minor questions remain (Q4 names · Q7 selector placement); Q8 auth deferred.
- Pending from Chris: UI aesthetic reference images. We are designing the visual system ourselves;
  the one reference shared so far is the InfraSure platform Asset-Detail shell (grouped sidebar,
  context selector, KPI cards, tabs, map card).
