# InfraSure — Outage Pricing Methodology (Reference)

- **Status:** living reference — the canonical narrative of *how* we price and *why* each
  step is named and ordered the way it is.
- **First written:** 2026-06-19
- **Audience:** the build team, new joiners, and anyone preparing an advisor / carrier
  conversation. This is the "why," not the code. Implementation detail lives in the
  `fundamentals/`, `plan/`, and `dicsscssion/` folders; this file ties them together.
- **Companion deck:** `InfraSure_Outage_Pricing_Methodology_Internal.pptx` (repo root).

> **How to use this doc.** When someone asks "why is it called *risk-based clustering*?"
> or "isn't customer-basis a separate pricing layer?" or "why are spatial and forward
> *parallel* and not nested?", the answer is here — with the reasoning, not just the
> conclusion. Section 12 is a fast naming glossary; Section 13 is the design principles.

---

## 1. The goal — one output: a premium matrix

Everything in the system exists to produce **one number, repeatedly**: the **annual
premium** for a given **(T, X)** on a specific insured address.

- **T** — the trigger duration (how long an outage must last to pay). Acts like a
  deductible: longer T → cheaper.
- **X** — the fixed parametric payout if the trigger fires.
- The product surface is a **5 × 5 matrix** per county: `T ∈ {2, 4, 8, 12, 24} h` ×
  `X ∈ {$500, $1k, $2.5k, $5k, $10k}` = **25 quotable cells**.

The business-facing flow is deliberately simple: **pick the address → choose T and X →
the model returns the annual premium.** All the methodology below is what makes those
25 numbers defensible.

---

## 2. The pipeline at a glance

```
Historical baseline                         (customer-level λ, from county history)
        │
Risk-based clustering                        (group counties by frequency behavior → identity)
        │
   ┌────┼─────────────────┐                 (THREE PARALLEL passes — siblings, not nested)
   ▼    ▼                  ▼
Spatial      Forward            Grid
adjustment   climate            conditioning
   └────┴─────────────────┘
        ▼
Adjusted premium  →  (T, X) matrix cell

Trigger source  ── separate problem: the live signal that fires a payout (not a price factor)
```

Two structural rules drive the order:

1. **Fix the data-input layer before modeling on top of it.** A perfect forward model on
   a misaligned baseline just adds signal to the wrong number.
2. **Profile before you adjust.** Counties are not interchangeable; the risk profile
   decides *which* adjustment each county even needs. That is why clustering sits
   *between* the baseline and the adjustment passes — it is the hub.

---

## 3. Layer 0 — Historical baseline

**What it is.** An empirical, reproducible rate built entirely from the public **EAGLE-I**
record (Oak Ridge National Lab): county-level customer-outage snapshots every 15 minutes,
2014–2025, stitched into an event catalog. No fitted distribution, no third-party cat
model — every number re-derives from the raw data.

**The math (county form):**

```
λ_county(T) = events/yr × share of events lasting ≥ T      (S(T) read off the empirical survival curve)
pure        = λ_county(T) × X
retail      = pure ÷ (1 − ER − TM)
```

**Customer-level by construction (important framing).** The headline baseline is the
**customer-level** frequency/premium — *what one insured experiences* — not the
county-event rate. The conversion from the county rate to the customer rate is an
**internal data-quality adjustment** for the granularity of the public source:

```
λ_customer(T) = λ_county(T) × granularity_adjustment
```

> **Why we present it this way (reframing, 2026-06).** We used to show the large
> county-level number (e.g. ~$236k retail for a single cell) and then "fix" it in a
> separate *customer-basis* layer. For an advisor / analyzer / client that reads as a
> sticker-shock bug, not a method. The county number is **never quoted**. So the baseline
> is presented as customer-level from the start, with the county→customer step demoted to
> a one-line note. It is plumbing that corrects the public data's grain — **not** a
> client-facing pricing layer.

**Worked anchor.** Alachua County, FL · T = 4h · X = $500 (eagle-i-45min, mean estimator):
county event rate λ_county ≈ 307/yr → customer-level λ ≈ 0.102/yr → pure ≈ $51/yr →
**retail ≈ $79/yr**. The customer retail lands in a commercially sensible band
(~$10–300/yr depending on cell), which is the whole point of working at customer grain.
*(Reconciled 2026-06-23 to the live computed catalog; an earlier round illustration showed ≈$154.)*

**Guardrails.** Modelability tiers gate credibility — green quotes, amber quotes with a
caution band, red is suppressed.

Detail: [`fundamentals/county_trigger_pricing_fundamentals.md`](02_per_customer/county_trigger_pricing_fundamentals.md),
[`fundamentals/per_customer_pricing_fundamentals.md`](02_per_customer/per_customer_pricing_fundamentals.md),
[`fundamentals/eagle_i_data_fundamentals.md`](cross_cutting/eagle_i_data_fundamentals.md).

---

## 4. Step 1 — Risk-based clustering (the hub)

This is the step most people ask about, so it gets the most space.

**What it does.** Reads each county's **frequency history** and assigns it a **behavioral
identity** — a cluster such as *smooth-worsening (trend-clean)*, *step-change (regime)*,
*volatile (noisy)*, *episodic/spiky (hazard-driven)*, or *sparse (thin)*. The cluster is
the county's risk identity, and the identity **decides the treatment**:

| History shape | Risk identity | Routed treatment |
|---|---|---|
| Smooth / step-change | trend-clean / regime | Forward: simple linear or recent-regime model |
| Volatile | noisy | Forward: small move + an uncertainty load (a *load-bearing* factor, v2) |
| Episodic / spiky | hazard-driven | Forward: ML hazard model — **not** a trend |
| Sparse history | thin | Credibility gate / no-quote |

> The grouping above is **illustrative and high-level** — the exact clusters will evolve
> with the data and the methods. The point is the *routing*, not a frozen taxonomy.

### 4.1 Why this step exists at all — and why it is its own step

This step started life as two separate "forward-looking" ideas — an **outage trend**
("is the county getting worse?") and a **predictability** read ("is that trend actually a
trustworthy summary, or is it one storm year masquerading as a trend?"). The key
realization that reshaped the whole pipeline:

> **Trend + predictability is really nothing but county identity / clustering.**

Once you see it as *identity*, two things follow that a "forward signal" framing misses:

1. **It serves more than forecasting.** A county's behavioral group is a signal for the
   **intra-county spatial** problem too — e.g. a trending or volatile group carries
   information about *where within the county* the variation lives. So clustering is not a
   sub-item of "forward"; it feeds **both** the spatial pass and the forward passes.
2. **It is the routing decision, not a price move.** Clustering does not (by itself) move
   the premium. It tells us **which model to apply** downstream: a smooth county gets a
   simple linear forward model; an episodic county needs an ML hazard model; a noisy
   county is better served by an uncertainty load than by a frequency move; a sparse
   county should be gated, not trended.

Because it feeds two different downstream families and is a prerequisite for both, it has
to be its **own step, immediately after the baseline** — the hub the rest of the pipeline
hangs off.

### 4.2 Why the name "risk-based clustering" (not "county clustering")

We deliberately moved off **"county clustering."** Reasons:

- "County clustering" reads as a **geographic / technical** operation ("you grouped some
  counties on a map"). The actual intent is to group counties by their **risk behavior**,
  which is an **insurance** concept. The name should speak the business language an
  advisor or carrier uses.
- "Risk-based clustering" (equivalently *risk profiling* / *risk grouping*) makes the
  purpose legible: we are assigning a **risk identity** that drives differentiated
  treatment — which is exactly what ratemaking is.

So: **Risk-based clustering** on the diagram and on both clustering slides, used
consistently. Avoid mixing in "county clustering," "profiling," and "trend" as if they
were different things — they are one step.

### 4.3 What it is NOT

- Not the hazard model. Clustering describes the *shape* of the history; the hazard model
  (forward climate) explains *why* the risk may be changing.
- Not a direct premium factor. It is the **router**.
- Not a black box. The labels are rule-based and auditable (slope normalized by scale,
  residual noise, line fit, one-year dominance, sparse-year count, cross-T consistency).

Detail: [`fundamentals/outage_predictability_fundamentals.md`](_archive/outage_predictability_fundamentals.md),
[`fundamentals/outage_trend_fundamentals.md`](03_risk_clustering/outage_trend_fundamentals.md),
[`../dicsscssion/pricing_adjustment_mechanisms/01_pricing_adjustment_mechanism_design.md`](../dicsscssion/pricing_adjustment_mechanisms/01_pricing_adjustment_mechanism_design.md).

---

## 5. The three parallel passes (siblings, not nested)

After the risk profile, three adjustments run **in parallel**. None is a subset of
another — that distinction is load-bearing and is drawn explicitly on the conceptual
slide. Each is *routed by* the cluster identity.

### 5.1 Pass A — Spatial adjustment

**What it does.** Adjusts for the fact that two addresses in the *same* county carry
different outage exposure. Expressed as a **frequency relativity** against the county
average.

- **Mean-1, exposure-weighted within each county** — relativities *redistribute* risk
  inside a county; they never change the county total (that is the baseline's job).
- **Capped for attribution confidence** — the cap reflects how confidently we can place a
  specific address in the tail, *not* the size of the signal.
- **"Rural" is a composite signal, not one variable.** This is a common misread to head
  off: rural-vs-urban here is a combination of **census population density + vegetation /
  tree-canopy cover + terrain & elevation + feeder/grid layout**, not a single density
  number. The composite produces a large, monotone gradient (illustratively ~1.9× for the
  high-exposure third vs ~0.72× for the low-exposure third at T ≥ 4h, widening to ~3× at
  T ≥ 8h).
- **Utility identity is deliberately excluded here** — a serving utility's restoration
  behavior belongs to grid conditioning / duration, not to the static within-county
  frequency relativity, to avoid double-counting the baseline.

> **Naming note.** Previously "intra-county spatial basis." Renamed **"Spatial
> adjustment"** — plainer and more intuitive for a business reader.

Detail: [`../dicsscssion/location_aware_outage_pricing/03_location_basis_risk_design.md`](../dicsscssion/location_aware_outage_pricing/03_location_basis_risk_design.md).

### 5.2 Pass B — Forward climate

**What it does.** Adjusts for the county's outage-causing **weather/climate environment**
— storms, wildfire, flood, heat, climate regime by peril — the perils that drive extreme
outage spikes. Episodic/hazard-driven clusters are routed here to ML hazard models rather
than to a blanket trend uplift.

### 5.3 Pass C — Grid conditioning

**What it does.** Adjusts for the **physical grid** serving the county — utility
reliability history, hardening / capex, restoration capacity — i.e. whether the grid is
getting stronger or weaker than its history alone implies.

> Forward climate and grid conditioning used to be bundled as one "forward climate & grid"
> box. They are now **two separate parallel passes** because they answer different
> questions (outside drivers vs. infrastructure) and will use different data and methods.

**Discipline across the passes.** The same evidence cannot create two factors unless the
mechanisms are explicitly separated. A storm-driven spike is routed to a hazard model, not
turned into both an episodic load *and* a trend uplift.

---

## 6. Candidate prediction (shadow λ)

When the risk cluster routes a county to a **frequency** model, the forward pass
**predicts a candidate rate** and shows the price pressure it implies — **without
changing today's premium**.

```
factor          = λ_candidate ÷ λ_baseline
premium_effect  = premium × factor
```

- **Frequency-first:** the native output is a candidate rate; the *factor* is only the
  shared premium-impact expression (premium is linear in λ).
- **Guardrails** (safety rails for a review artifact, not final actuarial selections):
  uplift capped at **2.50×**; normal discount floored at **0.75×**; step-down at
  **0.80×**; volatile-improving at **0.90×**.
- **Shadow, not active.** It stays a review artifact until holdout-year backtests beat the
  baseline. Episodic, noisy, and sparse clusters get **no** automatic λ move.

> **Clarification.** This is the *prediction/candidate-rate* mechanism, and it **is** part
> of the method. It is **not** the same thing as the *uncertainty load* (which is a v2
> item — see Section 9). Don't conflate them.

Detail: [`fundamentals/lambda_shadow_pricing_fundamentals.md`](_archive/lambda_shadow_pricing_fundamentals.md).

---

## 7. Trigger source (a separate problem)

A **trigger** is the live, objective signal that an outage of duration ≥ T happened at the
insured site and fires the payout. **It is not a pricing source.** Pricing needs national,
multi-year history (EAGLE-I); a trigger only needs a live signal at insured sites — so it
scales with the **book**, not the nation. A trigger must be objective, independent of the
peril party, auditable, low-basis, and timely.

**Version 1 (what we'll build first):**

- **Contracted utility OMS** — the operator's own outage record via a data agreement;
  premise/feeder grain, with audit terms in the contract.
- **PowerOutage.US** — licensed national feed aggregating utility outage maps; live and
  historical, sub-county coverage.

**Also exploring (promising, not current priority):** premise sensor networks (Ting-style),
customer-authorized AMI (Green Button), multi-source consensus, ODIN (the emerging national
utility standard), satellite night-lights (NASA VIIRS).

> **Framing note.** Earlier drafts ranked these with PRIMARY / EVALUATE / ROBUSTNESS
> labels — those were not the team's view and have been removed. The honest framing is the
> two tiers above: **v1 = utility OMS + PoUS**, everything else = exploring.

**The bridge.** Pricing stays on the historical baseline; a calibrated **bridge factor**
reconciles the priced event frequency with whichever trigger is contracted.

Detail: [`../plan/trigger_source_options.md`](../plan/cross_cutting/trigger_source_options.md),
[`../plan/trigger_source_implications.md`](../plan/cross_cutting/trigger_source_implications.md).

---

## 8. Premium composition & status

```
premium = historical baseline × spatial adjustment × forward (climate · grid) × load
```

Risk-based clustering is the **router** — it decides which factors apply and which model
produces them — not a factor itself. A factor of the same size means different things
(1.20× frequency ≠ 1.20× load ≠ 1.20× exposure), and a *missing* factor means "not
validated yet," not "zero impact."

| Step | What it does | Status |
|---|---|---|
| Historical baseline | customer-level rate from county history | **Done · active** |
| Risk-based clustering | group counties → route each to its treatment | **Under review** (this week) |
| Spatial adjustment | within-county location exposure (composite) | **Under review** |
| Forward climate | storm / wildfire / flood / heat / climate regime | **WIP** |
| Grid conditioning | reliability, hardening, restoration capacity | **WIP** |
| Candidate prediction (shadow λ) | forward frequency candidate, capped | **Shadow / review** |
| Trigger source | live payout signal — v1: utility OMS + PoUS | **In discussion** |

---

## 9. v2 / roadmap (explicitly not v1)

Kept separate so we don't over-claim what v1 does:

- **Uncertainty loads** — a load-bearing premium factor for noisy clusters where no clean
  frequency signal exists. (Distinct from candidate prediction.)
- **Address & business-type assessment** — assessing an address and the type of business
  at it, and **auto-suggesting** appropriate payouts (X) and trigger durations (T).
- Other roadmap features from the methodology docs.

---

## 10. Design principles (the "why" behind the shape)

1. **Reproducible baseline.** Every baseline number re-derives from the public EAGLE-I
   record — no opaque model in the loop.
2. **Aligned before adjusted.** Fix what the data measures vs. what the policy sells
   (customer grain) before any forward modeling.
3. **Profile, then adjust.** Risk-based clustering precedes the adjustment passes because
   the identity decides which adjustment each county needs.
4. **Mechanism, not multiplier.** Every adjustment names its mechanism, native target, and
   status — never a bare factor. Avoid the shortcut `pattern → price multiplier`; use
   `pattern → mechanism → native candidate → factor`.
5. **Validated before active.** Forward signals stay shadow until holdout backtests earn
   them into pricing.
6. **v1 vs. v2 honesty.** Be explicit about what ships first (baseline, clustering,
   spatial, the v1 trigger sources) vs. what is exploration/roadmap.

These four advantages are how the product is positioned: **dynamic, forward-looking,
localized, transparent** — built to defend (reproducible from public data, aligned before
adjusted, validated before active).

---

## 11. The branched mental model (and why it's a branch, not a stack)

A reference diagram we were given showed adjustments **nested** inside one another
(Russian-doll style). We deliberately moved to a **branch**:

- A nested model implies each adjustment is a refinement *of the one inside it*. That is
  false here.
- After the risk profile, the **spatial**, **forward climate**, and **grid conditioning**
  passes are **independent siblings** that each act on the same profiled baseline and then
  combine. The branch makes that parallelism — and the clustering hub — visually honest.

---

## 12. Naming glossary & rationale

| Current name | Was | Why the name |
|---|---|---|
| **Historical baseline** | "Baseline" / "Layer 0" | Signals it is the empirical, history-derived starting point — and that it is customer-level, not a separate per-customer layer. |
| **Risk-based clustering** | "County clustering" / "trend & predictability" | Speaks the insurance language (risk identity driving treatment), not a geographic/technical grouping. It is one step, not three ideas. |
| **Spatial adjustment** | "Intra-county spatial basis" | Plainer and more intuitive for a business reader. |
| **Forward climate** | part of "forward climate & grid" | Its own parallel pass: the outside (weather/climate) drivers. |
| **Grid conditioning** | part of "forward climate & grid" | Its own parallel pass: the physical-infrastructure drivers. |
| **Candidate prediction (shadow λ)** | "shadow λ pricing" | Emphasizes it predicts a candidate rate (price pressure), shown but not active. |
| **Trigger source** | unchanged | The live payout signal; a separate problem from pricing. |

> **Customer-basis** is intentionally **not** in this list as a layer name — it was folded
> into the historical baseline as an internal granularity adjustment (Section 3).

---

## 13. Open questions / decisions log

- **Risk-cluster taxonomy** is illustrative; the final clusters and their routing rules
  are under active work. Backtesting (historical mean vs. last-5-year vs. linear vs. robust
  vs. piecewise) gates any candidate before it becomes active pricing.
- **Spatial adjustment** activation waits on out-of-region validation; the town→premise
  last mile stays open until live geometry / meter data.
- **Forward climate & grid conditioning** are WIP; clustering routes each county to the
  right model, but the models themselves are not built.
- **Trigger** v1 is utility OMS + PoUS; the bridge-factor calibration needs overlap data.
- **Illustrative premiums** in the deck use realistic per-customer event rates, so
  high-payout / short-trigger cells run into the thousands — honest, but flag as
  illustrative.

---

## 14. Source map (where the detail lives)

- Baseline & data: `fundamentals/county_trigger_pricing_fundamentals.md`,
  `fundamentals/per_customer_pricing_fundamentals.md`, `fundamentals/eagle_i_data_fundamentals.md`
- Clustering: `fundamentals/outage_predictability_fundamentals.md`,
  `fundamentals/outage_trend_fundamentals.md`
- Mechanism taxonomy: `../dicsscssion/pricing_adjustment_mechanisms/01_pricing_adjustment_mechanism_design.md`
- Spatial: `../dicsscssion/location_aware_outage_pricing/03_location_basis_risk_design.md`
- Candidate prediction: `fundamentals/lambda_shadow_pricing_fundamentals.md`
- Trigger: `../plan/trigger_source_options.md`, `../plan/trigger_source_implications.md`
- Sequencing: `roadmap.md`
- Deck: `InfraSure_Outage_Pricing_Methodology_Internal.pptx` (repo root)

> **Not yet incorporated:** the meeting dictation notes (Sarasi collab thread, Gemini
> recaps from week 2026-06-14→20) were not reachable in this session. When the notes
> folder is connected, fold any decisions/wording from them into Sections 4, 9, and 13.
