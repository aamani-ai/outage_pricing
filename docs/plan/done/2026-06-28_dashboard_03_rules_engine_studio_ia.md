# 03 — Rules Engine + Studio IA (Settings → Rules Engine; split the Adjusters tab)

**Status:** plan — awaiting sign-off, then execute on `web/` (the main dashboard)
**Grounds:** [`dicsscssion/rules_engine_governance/00_carrier_underwriter_and_delegated_authority.md`](../../dicsscssion/rules_engine_governance/00_carrier_underwriter_and_delegated_authority.md)
**Decided with:** Divy (2026-06-28) — names + structure locked below.

---

## Goal

Make the dashboard's three sections honestly mirror the MGA governance model:

```text
   CARRIER         → Rules Engine          the BOUNDS · locked · (upload + governance later)
   UNDERWRITER     → Underwriting Studio   pick VALUES within the bounds + apply judgment
   POLICYHOLDER    → Pricing               the public quote that results   (unchanged this pass)
```

Two concrete moves:
1. **Rename `Settings` → `Rules Engine`**, and reframe it as the carrier rules table (bounds, scaffolded honestly).
2. **Split the Studio `Adjusters` tab** into three first-class sections: **Location** (factor) · **Forecast** (factor) · **Adjustments** (the underwriter levers), and **move ER/TM** from Settings into **Adjustments**.

---

## Decisions locked

```text
  · Location factor      → labeled "Location"  (NOT "Basis Risk" — reserved for trigger-vs-loss, basics/03)
  · Forward factor       → labeled "Forecast"  (intuitive for underwriters; internal `forward` keys unchanged)
  · Levers section name   → "Adjustments"      (no "Underwriting" prefix — already inside the Underwriting Studio)
  · ER/TM treatment       → bounds-vs-values: Rules Engine shows the cap/floor; the chosen value lives in Adjustments
```

---

## Scope

**In:** rename + reframe + reclassify which control lives where + honest "locked / scaffold" presentation + the tab split + relocating the ER/TM editor.

**Out (deferred, by prior agreement):** real auth / access control; carrier rules-table **upload** mechanism; **hard enforcement** of the bounds (caps/floors are shown as house defaults, not yet validated against); batch pricing. Access control was flagged as future work in the 2026-06-25 sync.

---

## Part A — Rules Engine (was Settings)

**Files:** `web/components/settings/settings-view.tsx` → new `web/components/rules-engine/rules-engine-view.tsx`; route `web/app/settings/` → `web/app/rules-engine/`; `web/components/shell/{nav-config.ts,topbar.tsx}`.

Render the full binding-authority shape. **Badge grammar stays universal** (D3 · 04 · 05): reuse the
existing `StatusBadge` visual (dot + word, **never red**) — but with words honest to the carrier-rules
axis (a *different, orthogonal* question from pricing-layer confidence, per communicate_to_share rule 4):

```text
   loaded          a real carrier/EAGLE-I value is in effect      (green dot)   — e.g. excluded counties, triggers
   house default   InfraSure default standing in until upload     (amber dot)   — e.g. margin floor, expense cap
   not configured  scaffold; no value yet                         (grey hollow) — e.g. limits, referral, reporting
```

Banner: *"No carrier rules table loaded — showing InfraSure house defaults."* Locked visual affordance;
an "Upload rules table" CTA present but disabled (`soon`). (If `StatusBadge`'s `Status` type is fixed to
active/modeled/placeholder, extend it with these three states rather than forking a second badge — one
visual grammar, defined once.)

```text
  RULES ENGINE
  ├─ Eligibility        eligible states · excluded counties (the ~7% insufficient)        ● real
  ├─ Limits & capacity  max line / location · min premium · regional accumulation cap     ○ scaffold
  ├─ Rating bounds      target-margin FLOOR · expense-allowance CAP · rate floor/cap       ◐ house-default
  ├─ Triggers allowed   ≥ 6h · {8, 12, 24h}                                                ● real
  ├─ Referral           thresholds beyond authority → refer to carrier                     ○ scaffold
  └─ Reporting          bordereaux cadence                                                 ○ scaffold
  ─ Platform data       EAGLE-I catalog (45 min default; 30/60 soon)   ← InfraSure config, clearly NOT a carrier rule
```

- ER/TM **sliders are removed here** (they move to Adjustments). What remains of ER/TM in the Rules Engine is the **bound** (cap/floor), display-only house defaults for now.
- The old "Risk exposure adjustments → go to Studio" pointer card is removed (manual loads now have a clear home).
- Data source moves under a visually-separated **Platform data** group (not a carrier rule).

## Part B — Studio IA: split Adjusters → Location · Forecast · Adjustments

**Files:** `web/lib/quote-store.tsx` (`StudioTab` union), `web/components/studio/studio-view.tsx` (`TAB_ORDER`, `SECTION_LABEL`, render switch), `web/components/shell/sidebar.tsx` (`STUDIO_TABS`); new `tabs/location.tsx`, `tabs/forecast.tsx`, `tabs/adjustments.tsx`; retire `tabs/adjusters.tsx`.

```text
  StudioTab:  "breakdown" | "baseline" | "clustering" | "adjusters"
           →  "breakdown" | "baseline" | "clustering" | "location" | "forecast" | "adjustments"

  UNDERWRITING STUDIO  (tab order)
  ├─ Price Breakdown      (unchanged)
  ├─ Baseline             (unchanged)
  ├─ County Clustering    (unchanged)
  ├─ Location             ◀ LocationFactor + LocationDetail  (lifted from adjusters.tsx)        FACTOR · read
  ├─ Forecast             ◀ ForwardFactor + ForwardDetail    (lifted; relabeled Forward→Forecast) FACTOR · read
  └─ Adjustments          ◀ ER/TM editor (moved from Settings) + AdjustmentsPanel (manual loads) LEVERS · operable
```

- `LocationFactor` / `ForwardFactor` (already in [adjusters.tsx](../../../web/components/studio/tabs/adjusters.tsx)) move near-verbatim into the new `location.tsx` / `forecast.tsx`; only the display string "Forward (stat + climate + grid)" → "Forecast (stat + climate + grid)".
- `AdjustersTab` is deleted; its three children are re-homed. No logic change to `LocationDetail`, `ForwardDetail`, `AdjustmentsPanel`.

## Part C — Relocate ER/TM into Adjustments

**Files:** `tabs/adjustments.tsx` (new editor), `settings-view`→`rules-engine-view` (remove sliders).

- Move the ER/TM sliders + "Apply across the platform" action into the Adjustments tab.
- **State unchanged:** `loadings {ER, TM}` stays in `quote-store` (still global, still localStorage `infrasure.loadings.v1`); `composePremium` still reads `expenseRatio/targetMargin` from params. Only the *editing UI* relocates — Pricing + Studio keep reading the same store, so no pricing math changes.
- Show the Rules-Engine bound beside each slider as context (e.g. *"expense ≤ 30% — carrier cap"*), display-only (no hard clamp this pass).

---

## What does NOT change

- `lib/pricing/compose.ts` and its 17 tests — untouched (no formula change).
- `pricing-view.tsx` (outward Pricing) — untouched.
- Data artifacts / `build_data.py` — untouched.
- The premium for any quote is byte-identical before/after (pure re-homing of UI + labels).

---

## Open micro-decisions (confirm in one go)

1. **Route name:** `/settings` → `/rules-engine` (clean URL) vs keep `/settings` path with new label only. *Lean: rename the route.*
2. **Forward → Forecast label:** confirmed in decisions above — flagging once more since it changes a user-visible string the team has seen in demos.
3. **Data source home:** under Rules Engine as a separate "Platform data" group (plan's assumption) vs somewhere else.

---

## Principles conformance (audit before ship)

```text
  communicate_to_share  · scannable-first (ASCII/visual carries it); labels say what to DO in UW words
                        · every panel changes a decision OR carries a finding — scaffold rows framed as
                          "what a carrier will set; none loaded yet" (a real governance finding, not filler)
                        · define-once: ONE badge grammar, ONE label per concept, identical across views
  model_to_consequence  · honest scaffold — never show authoritative "carrier rules" when nothing's loaded
  scaling / FAIL LOUD   · no silent fallback that hides a broken input (compose.ts untouched)
  visual system (05)    · reuse Card/StatusBadge/InfoHint; oklch tokens only; never red for low-confidence;
                          coherent module in the platform shell (D11) — not a standalone-looking page
```

## Amends to locked decisions

- **D4** ("Settings/Data" as the third section) → **Rules Engine** (carrier rules table). Record in
  [`00_decisions_locked.md`](../../dicsscssion/done/dashboard_redesign/00_decisions_locked.md) as part of this change.
- **D8** (no auth in scope) **still holds** — it is exactly what lets us defer access control here.

## Verify (after build)

- `npm run build` + typecheck clean (the `StudioTab` union change will surface any missed reference).
- Click-through: Pricing premium unchanged for a known county; Studio shows 6 tabs; Location/Forecast render their details; Adjustments edits ER/TM and a manual load and both flow into the premium; Rules Engine renders the scaffold with honest badges and no ER/TM sliders.
- Bump dashboard cache-bust if applicable; redeploy per `deployment.md` only when you ask.
