# The Outward Pricing View

The shareable section. The whole job: an address → one annual premium → an intuitive risk read,
clean enough to send to a carrier without an actuary in the room. Validated against the closest live
analog (Adaptive **GridProtect** — parametric power-outage, duration trigger, fixed payout) and the
consumer-parametric trust playbook (FloodFlash, Jumpstart, Descartes, Arbol).

## The flow (GridProtect's four steps, out-designed)

```text
  1. address        autocomplete → confirm the resolved pin   (geocode guard, below)
  2. trigger T      named stops: 4h · 8h · 12h · 24h
  3. payout  X      coverage stepper ($500 … $10k)            (optional tiered ladder)
  4. PREMIUM        one annual number, recomputes live
```

## Layout — inline split, never a modal

```text
 ┌──────────────────────────────────┬──────────────────────────────────┐
 │  RESULT CARD  (~40%)             │   MAP  (~60%)  MapLibre           │
 │                                  │                                   │
 │  $612 / year        ← hero       │        ● pin = priced address     │
 │  indicative annual premium       │   soft single-hue choropleth:     │
 │                                  │   your block vs rest of county    │
 │  Trigger  [4h][8h•][12h][24h]    │                                   │
 │  Payout   $2,500   [ – + ]       │   "~30% of nearby addresses       │
 │                                  │    price higher than yours"       │
 │  ~1 outage of 8h+ every ~6 yrs   │                                   │
 │  (~16% chance in any year)       │                                   │
 │                                  │                                   │
 │  How this pays ▾                 │                                   │
 │  Priced from EAGLE-I · {county}  │                                   │
 │  See the breakdown →   (Studio)  │                                   │
 └──────────────────────────────────┴──────────────────────────────────┘
   mobile: map on top + draggable bottom sheet (never hide the map)
```

The map and premium stay co-visible — the pin gives the number meaning (Airbnb removed its split view
and got backlash; we don't hide the map). The **pin is the answer; the choropleth is context**
(First Street / RiskFactor point-vs-area).

## The one number

- The premium is the single dominant element; it **animates in place** as the buyer drags T or X
  (the canonical insurtech quote feel — Arbol "instant premium indication"). No full-page spinner.
- The `(1 − ER − TM)` gross-up happens **silently**. No expense ratio, no λ, no margin slider, no
  confidence taxonomy, no shadow number — exposing a margin lever to a buyer destroys trust instantly.
- Exactly **three** quiet supporting chips: trigger · payout · risk read. Everything deeper is one
  *See the breakdown →* link into the Studio.

## The range (and its one outward affordance)

The premium shows as a band — **"≈ $244 / year (likely $236–$252)"** — point as the headline, band as
a quiet qualifier (disc `07`). The band tightening/widening as the buyer drags the trigger *is* the
risk read.

**One affordance, and only one:** a small **ⓘ** giving the band's *plain-language meaning* — "this
range reflects how much local outage history backs the price; it's wider where history is thin." That
is the whole outward treatment. **No factor highlight, no breakdown outwardly** — the moment we show
*which* factors move the range, we've opened the breakdown, and that is the Studio's job (the
waterfall · the comfort-by-trigger strip · the sensitivity tornado). The seam stays a single
*See the breakdown →* into the Studio.

## Trigger & payout as tangible controls

- **Trigger** = named, consequence-labeled stops, not a number in a vacuum (FloodFlash sells "water on
  your wall", Jumpstart "shaking in your neighborhood"; we sell "how long the lights are off"):
  `4h — brief · 8h — half a workday · 12h — overnight · 24h — a full day+`, with one line under the
  active stop: *"Pays if an outage at this address lasts 8+ hours."* A higher trigger visibly lowers
  the premium — the buyer feels the trade-off without a lecture.
- **Payout** = a coverage stepper; payout = coverage, no scaling math on screen.
- **Optional tiered ladder** (opt-in, FloodFlash "Miss Smith" model): small payout at 4h, larger at
  12h, full at 24h — lowers premium for the same total cover and dissolves the all-or-nothing "what
  if I just miss 8h" anxiety. Default stays single-trigger (simplest). Keep λ(T) monotone across tiers.

## The risk read — one return-period sentence, no curves

Translate λ(T) into **one** plain sentence, driven live by the trigger slider:

> "An outage of **8+ hours** happens about **once every 6 years** here *(~16% chance in any year)*."

Lead with the tangible "once every N years"; put the annual % in parentheses to defuse the
documented "won't happen again for N years" misread. Avoid the word *probability* as a headline. **No**
Poisson/CDF/survival curve, **no** P5–P95 band — those are Studio honesty tools. (EIA already frames
outages to homeowners exactly this way.)

## "How this pays" — pre-empt basis risk (the trust make-or-break)

A calm, surfaced (not buried) block, framed as *certainty*, not exclusions:

```text
  · Pays on outage DURATION at this exact address — regardless of cause or damage.
  · Pays the full $X the moment an outage reaches T hours.
  · A just-missed outage (7h59m at an 8h trigger) does not pay — it's a fixed trigger, not a slider.
```

This is what makes the quote shareable: a carrier reads it cold and never feels tricked later. Never
imply cause/damage-based coverage anywhere (that manufactures the basis-risk dispute we're avoiding).

## Trust & guards

- **Provenance, one line:** *"Priced from federal EAGLE-I power-outage records for {county}, {years}."*
  Names a neutral source the seller can't manipulate — the outward form of "honest about confidence."
  Don't over-claim address-level precision from county data (that's why location/forward exist).
- **Geocode guard:** debounced autocomplete (matched substring bolded) → a **confirmable resolved-address
  chip** before the premium is final (*"Pricing for 123 Main St — not right? edit"*). A ZIP-centroid
  match visibly caveats the location factor. A wrong geocode silently produces a wrong, shareable price.
- **"Indicative annual premium,"** not a bindable price (no binding backend; avoids a compliance trap).
