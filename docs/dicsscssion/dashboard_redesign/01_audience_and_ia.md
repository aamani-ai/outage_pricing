# Audience & Information Architecture

One tool, one engine, serving a calm outward buyer and a deep internal underwriter. Grounded in how
Stripe/Linear scale a single product across depths — references as teachers, not constraints.

## One engine, two front doors

The outward **Pricing** view and the **Underwriting Studio** render the *same computed quote* at two
depths — never two codebases (they drift, and the outward one silently shows stale numbers). The
Studio doesn't recompute; it un-hides the build-up of the number the buyer already saw.

```text
                 ┌──────────────────────────────┐
                 │  pricing engine (one source)  │
                 │  composePremium(...) → {stack} │
                 └───────────┬──────────┬─────────┘
                     calm    │          │  deep (same object)
              ┌──────────────▼───┐  ┌───▼───────────────────┐
              │ Pricing (outward) │  │ Underwriting Studio   │
              │ one premium       │  │ waterfall · regime ·  │
              │ one risk read     │  │ comfort · provenance  │
              └───────────────────┘  └───────────────────────┘
```

## The audience boundary — honest note vs D8

Research recommends enforcing the split by **route + auth** so a shared link only ever resolves to
the calm layer. We've scoped **no auth** (D8). Reconciliation:

- For now the split is **navigational** — calm route vs deeper route; the Studio is reachable client-side.
- This is acceptable *because of D3*: there is **no shadow price** and nothing actuarially sensitive
  that must be hidden — the Studio just shows the build-up + provenance of the same honest number.
- The only genuinely not-for-buyers bits are the **ER/margin levers** and the **regime taxonomy** —
  kept Studio-only by IA. ⚠ If we ever publish a *live* external link, revisit a real auth gate (`06`).

## Sidebar — the InfraSure shell (D11)

Grouped, action-oriented nav with a context selector pinned at top (mirrors the platform shell).
Active item = left-border + bold (the renewablesinfo pattern), not a heavy fill.

```text
   ┌ context selector  "Single address ▾"  (· book of business · region)
   │
   PRICING                ← outward
     Quote an address
     Saved quotes
   UNDERWRITING           ← internal (Studio)
     Risk explorer        (the national map)
     County regimes
     Adjustments
     Assumptions
     Methodology
   SETTINGS / DATA
     Data source / catalog
```

Labels in the audience's words — never backend pipeline names (eventize / per-customer / clustering
stay internal). The Methodology drawer graduates from a header button to a sidebar item.

## Inside each section

- **Outward Pricing** = one calm screen: hero premium + 2–3 micro-cards (risk read · payout · trigger)
  + the map. No tabs, no drawers, no deep breadcrumb. (see `02`)
- **Studio** = a breadcrumbed, **tabbed** workspace over the same quote:
  `Raw history · County regime · Adjustments · Final premium`. Right-side **drawers** peek a single
  factor's provenance without losing the build-up (Linear-style). Breadcrumb: County ▸ tract ▸ address ▸ quote. (see `03`)
- **Deep-link:** clicking the outward premium lands on the Studio's *Final-premium* tab — the
  build-up of the exact number the buyer saw.

## Progressive-disclosure tiers (the Advanced boundary IS the audience boundary)

```text
  ESSENTIAL (outward)   address · trigger T · payout X · the one premium · the risk read
  COMMON    (outward)   "How this pays" · "what changes my premium"  (one expandable line)
  ADVANCED  (Studio)    factor waterfall · confidence pills · ER/TM levers · regime · raw history · provenance
```
