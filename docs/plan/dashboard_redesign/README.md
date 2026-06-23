# Dashboard Redesign — Plan

The build plan for the new two-audience pricing dashboard. **Design is settled** in
`docs/dicsscssion/dashboard_redesign/` (decisions D1–D11); this folder sequences the work.

## Sequencing principle — engine first, confidence before features

Per `principles/scaling.md` (and D1): the silent-failure risk in an LLM-built rebuild is killed by
**structural verification, not eyeballs**. So we **extract and canary-test the pricing engine before
any UI**, and every view renders the premium from that one engine — never re-deriving the formula
(the old dashboard duplicated it 5×; that is the anti-pattern we're ending).

> Build order is deliberately *inside-out*: engine → data → shell → sections → charts → deploy.
> A view never ships before the number it shows is tested.

## Phased roadmap

```text
  P0  Architecture & scaffold     repo layout · Next.js+shadcn+Tailwind · engine/data/ui boundary   → 00_architecture.md
  P1  Pricing engine  ✔ DONE      pure typed composePremium() + 17 canaries green (web/lib/pricing/)   → 01_pricing_engine.md
  P2  App shell  ✔ DONE           Next.js + shadcn-style ui/ + oklch tokens (light/dark) · InfraSure sidebar · 3 routes · engine wired
  P3  Outward Pricing  ✔ DONE     Mapbox address/POI search → FCC FIPS → live premium + year-based range + how-it-pays + MapLibre map
  P4  Underwriting Studio  ✔ DONE factor build-up · dollar split · tweakable ER/TM · comfort-by-trigger strip · regime + raw history
  P5  Charts & map  ◀ NEXT        ECharts polish (proper waterfall/tornado) · within-county location · search polish (mode + left-align)
  P6  Data layer  ✔ DONE          web/scripts/build_data.py rebuilds pricing/studio/counties JSON reproducibly
  P5b Studio adjustments  ✔ DONE  county-keyed quote store (localStorage) → adjustments flow into Studio + outward price
  P7  Deploy & cutover            reuse Cloud Run service · tagged-revision preview · flip traffic · archive old   → deployment.md
  ──  cross-cutting               testing & guardrails (canary · count assertions · fail-loud) — woven through every phase
```

P2–P6 implementation docs are written **at phase start** (they'll shift as earlier phases land); each
maps back to a design doc in the discussion folder (`02_outward_pricing_view`, `03_underwriting_studio`,
`05_visual_system_and_stack`). P0/P1 and the deployment decision are drafted now because they're
foundational and immediate.

## Deployment call (full: `deployment.md`)

Reuse the existing `outage-pricing` Cloud Run service, URL, Artifact Registry, and WIF/GitHub-Actions
plumbing; ship the new Next.js image (Node buildpack); keep the `/dashboard/` path via Next `basePath`;
cut over via a **tagged no-traffic revision → validate → flip traffic 100% → archive the old**. One
canonical URL, reused security plumbing, preview-before-promote.

## Status

- Plan folder created with the roadmap, architecture (`00`), the first build phase (`01`), and the
  deployment decision (`deployment.md`).
- **P1 DONE** — `web/lib/pricing/` (pure `composePremium()` + `renormalizeMeanOne` firewall), 17
  canaries + strict typecheck green. Anchored on the LIVE catalog ($78.76 @4h/$500), which surfaced
  that the deck's $154 is stale (multiplier ~halved) — flagged for the deck/methodology refresh.
- **P2 DONE** — Next.js 16 + React 19 + Tailwind 4 app over `web/`: oklch token system (light/dark
  both first-class), shadcn-style `components/ui/` (Card, Button, StatusBadge), the InfraSure
  `components/shell/` (grouped sidebar + context selector, topbar, three-state theme toggle), routes
  `/` `/studio` `/settings`, and the P1 engine wired into the Pricing page. `next build` + 17 canaries green.
- **P3 DONE** — interactive outward Pricing view: Mapbox Geocoding v6 address/business autocomplete →
  `/api/price` (FCC coords→county FIPS, server-side, no token) → live `composePremium` over the
  precomputed catalog. Trigger/payout segmented controls, premium + year-based range ("(likely $A–$B)"
  + ⓘ), return-period read, "How this pays" basis-risk block, MapLibre map (CARTO, theme-paired).
  Data layer: `web/lib/data/pricing.json` (3,023 counties, λ + band per T). `next build` green.
  ⚠ Within-county location relativity not yet applied — addresses resolve to their COUNTY price (the
  location-basis layer is a later phase), so two addresses in one county currently price the same.
- **P4 DONE** — Underwriting Studio (`/studio`): address → `/api/studio` (FCC FIPS → pricing + regime +
  annual history). Factor build-up (baseline → location → forward → loadings), dollar-split bar with
  **live ER/TM sliders**, **comfort-by-trigger strip** (observed events per T + cross-T label),
  county-regime card (Reask "challenge only λ(T)" framing), and a raw-history bar chart. Data:
  `web/lib/data/studio.json` (3,090 counties). Search rebuilt on **cmdk + Mapbox Search Box** (proxied)
  with keyboard nav — addresses **and** businesses.
- **P6 DONE (data layer)** — `web/scripts/build_data.py` rebuilds `pricing/studio/counties` JSON
  reproducibly from the catalogs (deterministic; no orphaned scratchpad gen).
- **Studio Adjustments DONE** — county-keyed quote store (`lib/quote-store.tsx`, localStorage) + an
  Adjustments panel; enabled adjustments flow into the Studio premium **and** the outward Pricing quote
  for any address in that county.
- **Search polish DONE** — Search Box API + type/state/county filters (county from real coverage),
  color-coding, keyboard nav; account-menu placeholder; map zoom; info hints across both views.
- **Next:** Saved quotes (store supports it) → within-county location + ECharts waterfall → **deploy (P7)**.

## Carried-over open questions (minor; resolve in-phase)

```text
  Q3  premium "range" derivation        → RESOLVED (../../dicsscssion/dashboard_redesign/07_outward_range.md):
                                          band = (a) confidence (Poisson on K), widened by residual (b) when
                                          placement weak; engine returns {low,point,high} — refines P1 below.
  Q4  section names                     → decide in P2 (shell)
  Q7  data-source selector placement    → decide in P2 / P6
  Q8  auth (deferred)                   → only before a live external share
```

## Links

- Design decisions: `../../dicsscssion/dashboard_redesign/00_decisions_locked.md`
- Principles: `../../principles/` (communicate_to_share · + ui_design/scaling/usability to be ported, D9)
- References (gitignored): `../../extra/references/` (renewablesinfo web · old dashboard)
