# The Underwriting Studio

The internal depth. Same quote as the outward view, opened up: the full factor build-up, the county
risk regime, per-component confidence, and the levers an underwriter actually turns. Grounded in
how cat-model / pricing workbenches present hazard→loss→premium (RMS/Touchstone, Akur8, Jupiter,
Cervest, Reask, ICEYE) — adapted, not copied.

## The spine: a premium waterfall (the headline IS the right end)

Render the multiplicative chain as a left-to-right waterfall — each middle step a **% uplift/credit**
(mean-1 relativity reads as ± % natively), bar heights **log-spaced** so ×1.18 and ×0.85 are visually
symmetric (the documented fix for the multiplicative-waterfall pitfall). Canonical, *stable* order so
screenshots compare across quotes. This reconciles "one number" with "full decomposition": the
headline premium is literally the right end of the walk.

```text
  pure-premium build-up           (% uplift · log-spaced bars)        running     status
   baseline   λ(8h) · X      ████████████                              $385       active
   + location           +18%            ███                            $454       modeled  (CT/MA/RI validated)
   + forward             +0%             ·                             $454       placeholder
   + expense / margin gross-up            ██████                       $612
   ──────────────────────────────────────────────────────────────────────────
   = ANNUAL PREMIUM                                                    $612   ← headline
```

Each step is a card-row: multiplier · running subtotal · a status pill · click → **provenance drawer**
(formula + inputs + EAGLE-I/PoUS source + assumption ID — rendered from the *same* computation that
produced the number, never re-prosed).

## The dollar split: a 100% stacked bar (NOT a waterfall, NOT a Sankey)

The gross-up is a static part-to-whole — show it as one horizontal 100% bar beside the editable
ER/TM inputs, re-proportioning live as they tweak:

```text
   premium $612   ████████ pure $385 ███ expenses $123 ██ margin $104
```

(A waterfall over-dramatizes a static split; a Sankey implies routing that doesn't exist.)

## The signature signal: underwriting comfort by trigger T  (D7)

Our most product-specific control. λ(T)=N_per_year·S(T) is well-evidenced at short/common durations
and thins in the long tail. Compute comfort from **observed event counts ≥ T in that county**, render
it as a strip that updates live as the trigger drags, and compose it with the regime cross-T
descriptor. Thresholds defined in event-count terms and cited registry-style (A-IDs).

```text
  underwriting comfort by trigger          (observed events ≥ T, this county)
   2h  ████████  well-evidenced
   4h  ███████   well-evidenced
   8h  █████     solid             ← recommended underwriting window
   12h ███       moderate
   24h █         thin · long-tail extrapolation     ⚠ regime: intensifies@longT
```

The sweet spot is where we're **well-cushioned AND the regime is well-behaved**. A softened plain
version ("well-evidenced" vs "limited history at this duration") is the *only* thing that echoes
outward — never the taxonomy.

## "What moves this price" — a secondary tornado (labeled Sensitivity)

Swing each factor across its *credible* range — county λ sampling band, location P25–P75 (already
computed), climate scenario spread — sorted widest-at-top in premium dollars. A wide bar on a
`placeholder`-badged component is the clearest "apply judgment here" cue. Labeled **Sensitivity** so
it's never mistaken for the build-up (composition vs sensitivity are different questions).

## Per-component status — measurable, not a vibe

The `active / modeled / placeholder` pill (dot + word; never red for low-confidence) is openable to
its quantitative basis (borrowing the workbench red<60 / amber60–85 / green>85 discipline, but on
*real* credibility):

```text
  baseline λ     active        N events over Y years of EAGLE-I in this county   → click: counts + A001…
  location       modeled       PoUS-validated (CT/MA/RI) = active; else shadow/extrapolated
  forward        placeholder   present at 1.00× until structurally backed
```

## Confidence narrative — Reask's "collapse to one dimension"

Lead the Studio's trust story with our lucky structure: the **trigger and the pricing read the same
EAGLE-I outage record** — there is no severity/basis model in v0 — so the *only* thing to challenge is
the frequency **λ(T)**. Point all the confidence machinery (event counts, years, the comfort strip) at
that one quantity. ⚠ Flag explicitly the moment any future overlay sits between priced and paid —
that reintroduces basis risk and its component badge must say so.

## Level vs trajectory (Jupiter's present-vs-change split)

Show the county's **current regime** (`stable/trend/shift/episodic/insufficient`) as *where it is now*
and the **forward factor** as *expected change* — never a single blended opaque multiplier. Regime
taxonomy stays internal-only.

## Tabs, drawers, and audited tweaks

- Tabs: `Raw history · County regime · Adjustments · Final premium`; breadcrumb County ▸ tract ▸ address ▸ quote.
- Right-side **drawer** peeks one factor's provenance without leaving the build-up (Linear-style).
- **Tweaks are first-class but audited** (Touchstone/Akur8): ER, target margin, optional per-factor
  manual loadings as live sliders, always showing the **modeled baseline ghosted** beside the adjusted
  value, delta in % and $, and a **required reason string logged as provenance**. These knobs exist
  *only* here — their absence is what makes the outward view shareable.
