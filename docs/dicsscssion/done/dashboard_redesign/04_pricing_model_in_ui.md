# The Pricing Model, As the UI Sees It

How the premium decomposes into layers, how those layers render, and the rule that keeps the
grid signal from being counted twice. This is the contract the pricing engine and both sections
share.

## The chain (two adjustment layers)

```text
   baseline   λ_customer(T)                      active     ── county history → per-customer
     × location  r(address)        mean-1        modeled    ── WHERE in the county (within-county)
     × forward   f(county, year)   level move    placeholder── WHERE it's heading (across-county)
     × payout X
     ÷ (1 − ER − TM)
     = annual premium
```

- **location** redistributes risk *inside* a county — it is **mean-1** (exposure-weighted) and can
  never change the county total. Inputs: density · vegetation · terrain · within-county grid/feeder.
- **forward** moves the *county total* up or down — climate regime + county-level grid conditioning,
  **combined into one factor** at the surface (`f = f_climate × f_grid_county` in the engine).

## The grid double-count firewall

Grid conditioning is **not a layer — it's a signal that enters at two spatial scales.** The mean-1
constraint is the firewall that lets it feed both layers with no double-count. It's a fixed-effects
decomposition: *total exposure = county-level effect + within-county deviation.*

```text
   grid signal  g(address)   — feeder topology · undergrounding · hardening · restoration
        │
        ├─ COUNTY MEAN  ḡ_c  ───────────►  FORWARD     (moves the county TOTAL; carries the level + trend)
        │
        └─ DEVIATION  g(a)/ḡ_c  ────────►  LOCATION    (REDISTRIBUTES within county; mean-1 by construction)
```

- The location relativity is **always renormalized to mean-1** within the county → mathematically
  cannot move the county total.
- The forward factor operates **only on the county aggregate** → invariant to within-county
  redistribution.
- One acts on the *spread*, the other on the *level* → orthogonal by construction.

**Worked case — utility undergrounds dense urban feeders, not rural:**
county-average reliability rises → `ḡ_c` shifts → **forward** captures the mean improvement; urban
now relatively safer than rural → spread widens → **location** captures the redistribution. Both
real effects captured; neither double-counted.

> Open: confirm the mean-1 renormalization is the intended firewall (`06`, Q1). It is the
> load-bearing assumption behind "combine forward, split grid."

## Per-component status grammar (provenance is universal)

No shadow price. Instead, **every component carries the same quiet badge** — the forward factor is
not a scary ghost number, it is one row in the chain like any other, at a neutral value until live.

```text
   active       computed from data and in the price today        (baseline)
   modeled      a real model/estimate, lower confidence          (location where validated)
   placeholder  present in the chain at 1.00×, not yet plugged    (forward, until live)
```

Same badge grammar everywhere; nothing singled out. Honesty about the ceiling lives in the badge,
not in a second number (`communicate_to_share`: no competing framings + honest about the ceiling).

## How it renders — the end-to-end table

```text
   ANNUAL PREMIUM   $ X,XXX                                   ← one number, headline
   ───────────────────────────────────────────────────────────
   baseline   λ_customer(8h)         0.20 /yr     active      ×
   location   within-county          1.15×        modeled     ×   (CT/MA/RI validated)
   forward    climate + grid         1.00×        placeholder ×   (not yet plugged in)
   payout                            $2,500                   ×
   loadings   ER 20% · TM 15%        ÷ 0.65
   ───────────────────────────────────────────────────────────
```

- **Outward Pricing:** shows the headline + a compact, plain-language version of this.
- **Underwriting Studio:** shows the full table, expandable (forward → climate vs grid sub-factors),
  as a **waterfall** (the multiplicative build-up) plus a **Sankey** for the dollar split
  (pure / expense / margin). The ER/TM loadings are tweakable here.
