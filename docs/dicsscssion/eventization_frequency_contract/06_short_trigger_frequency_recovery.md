# Short-Trigger Frequency Recovery — and why ≥8h is well-cushioned

**Status:** discussion / pre-methodology. Proposes (a) the **method** to recover reliable
short-trigger frequency from the within-event 15-min path, and (b) the **proof** behind the
≥8h cushion gate. Reasoning first — the recovery *build* is deferred (the business leads with
longer triggers); the *qualitative* ≥8h explanation ships to the platform now.
**Reads after:** [`03_inner_event_shape_diagnostics.md`](03_inner_event_shape_diagnostics.md),
[`04_duration_conservatism.md`](04_duration_conservatism.md).
**Engine touched:** none. Posture/diagnostic + a deferred frequency method. **Price unchanged.**
**Dashboard:** short-T posture already gated to *"not established · verify"* (2026-06-24); this doc
adds the *why-≥8h* explanation.

---

## TL;DR

```text
 • Short-trigger per-customer rate has THREE biases that don't agree in sign → net UNKNOWN → "verify".
 • The recovery method: cut each event's 15-min curve into above-reference excursions (tᵢ, δᵢ, peakᵢ),
   and re-bucket any excursion of length ≥ T as a short-trigger episode (intensity = its peak).
 • Two design decisions to settle BEFORE a notebook: the reference LEVEL, and add-vs-replace.
 • The same machinery yields a DIAGNOSTIC that proves ≥8h is well-cushioned (established + conservative).
   Build the diagnostic first (low risk, platform value); the revival-pricing second.
 • Ceiling: the county aggregate can't see individual customers (churn) — everything here is a
   conservative PROXY, not the exact per-customer count. PoUS is the eventual shrink.
```

---

## 1. The problem — short-T has competing biases, so the net is uncertain

Per-customer rate is `λ(T) = freq(events ≥ T) × intensity(mean fraction out)`. At a **short**
trigger, three distinct biases act, and they **don't agree in direction**:

```text
 bias                          direction        where it comes from
 ─────────────────────────────────────────────────────────────────────────────────────────
 the duration GATE             OVER  (cons.)    04_duration_conservatism: county-event duration
   over-attributes                              ≥ any individual's duration → counting an event
                                                "≥T" over-counts who truly had a ≥T outage
 EPISODES hidden in a          UNDER (anti)     §2 here: one long continuous event can hold several
   long event                                  distinct ≥T surges, but is counted ONCE at T
 the priced MEAN dilutes       UNDER (anti)     the dilution: a broad short plateau is averaged
   the peak                                     against the long thin tail → m_e ≪ who crossed T
 ─────────────────────────────────────────────────────────────────────────────────────────
 NET at 2h / 4h                UNKNOWN          → "not established · verify"  (the shipped gate)
```

This is the honest reconciliation with [`04`](04_duration_conservatism.md): that analysis proved
the **gate** term is conservative and bounded the eventization knob (~10%). It is correct — but it
is **one term of three**. The other two (hidden episodes, diluted mean) push anti-conservative at
short T, and `04` did not measure them. So "conservative at every T" holds for the *gate*, not for
the *net priced rate* at 2h/4h. The net is genuinely undetermined today — which is exactly why the
posture read now abstains there.

At a **long** trigger the three align:

```text
 the GATE over-attributes      OVER  (cons.)    strong structural over-count
 episodes hidden               ~NONE            a long event is a single coherent surge (low boundary
                                                mass at 8h+: ~8% within 30min of T, vs 17% at 2h)
 the mean dilutes              OVER  (cons.)    mean over-states ~2–3× (A011)
 ─────────────────────────────────────────────────────────────────────────────────────────
 NET at 8h / 12h / 24h         OVER  →  ROBUSTLY CONSERVATIVE  =  well-cushioned
```

That sign-alignment at long T is the real content of the cushion claim — see §4.

---

## 2. The recovery method (excursion → revival)

Use the within-event 15-min path (local: `price_engine/data/raw/eaglei_*.csv`; the catalog drops
it to `min/mean/max` in [`02_construct_events.py`](../../../price_engine/data/02_construct_events.py),
so this reads the raw series). For one event, pick a **reference level** (the design decision — §3.1),
take the runs **above** it, and summarize each run:

```text
 one event, 15-min customers-out series, reference level L:

 cust │       ╭─╮                                    
      │      ╱   ╲           ╭──╮                      
   L ─┼─────╱─────╲─────────╱────╲──────────────   ← reference level
      │    ╱       ╲_______╱      ╲____               
      │ __╱                            ╲________      
      └──────────────────────────────────────── t
          └── t₁ ──┘       └── t₂ ──┘
           peak M₁          peak M₂

   each above-L run → (duration tᵢ , height δᵢ above L , peak Mᵢ)
   REVIVAL:  if tᵢ ≥ T   →   register a short-trigger episode in the T-bucket,
                             intensity = Mᵢ  (the peak during the run)
```

**Worked example** (the dilution case). An 8h event: 1000 out for ~2h, then 100 out for ~6h.

```text
 mean m = (1000·2 + 100·6)/8 = 325
 above-mean run: the first ~2h (1000 > 325) → t₁ ≈ 2h, peak M₁ = 1000
 today this 8h event counts ONCE at T=2h with intensity = mean 325  (diluted)
 recovery registers a 2h episode at intensity 1000                  (the peak that actually crossed 2h)
   → both the frequency (the episode is now visible) and the intensity (1000 ≫ 325) are corrected upward
```

**Why peak `Mᵢ` for intensity (not the mean):** it is *deliberately conservative*. The peak
over-states sustained exposure, so a short-trigger rate built from (recovered episodes × peak
intensity) errs high — which is what lets us later *defend* a "well-cushioned" claim there rather
than merely hope for one. We stack conservatism on purpose.

---

## 3. What must be settled before a notebook

### 3.1 The reference level `L` — the mean line is the weak joint

The method's correctness hinges on `L`. Using the **event's own mean** is fragile: a single
dominant spike drags the mean up and *hides a real secondary episode beneath it*.

```text
 cust │   ╭╮                          
   m ─┼───││─────────────────   ← mean pulled HIGH by the spike
      │   ││    ╭─────────╮          the 400-customers-for-4h plateau is a REAL ≥4h episode,
      │ __││____│         │____      but it sits BELOW the event mean → the mean-line method
      └────────────────────────  t   never sees it (and a perfectly FLAT event crosses its
          spike 3h    plateau 4h     own mean nowhere → yields nothing, though it's the clearest
                      (MISSED)        case of "everyone crossed the short trigger").
```

The clean generalization: the mean line is just the `L = mean` slice of a **level-crossing**
question — *for a level L and duration T, how many runs have `c(t) ≥ L` for ≥ T?* Choosing `L`
deliberately (e.g. a small set of intensity levels, or levels tied to the product) fixes the
hidden-plateau miss. This is also where the method meets the **load-duration curve** `c*(T)`
(the level sustained for ≥ T): the excursion view counts *episodes* (frequency); `c*(T)` gives
*level-sustained* (intensity) — two faces of the same (level × duration) surface. **Decision
needed:** keep the bare mean as a v1 and refine, or go straight to a deliberate level-crossing.

### 3.2 Add vs. replace — or we over-count

The parent event *already* counts once in the 2h bucket (8h ≥ 2h). If revival **adds** its runs on
top, the same physical outage is counted two+ ways → artificial inflation. A revived episode must
**replace** the parent's contribution at that threshold: a bucket entry is *either* the whole event
*or* its excursions, never both.

### 3.3 No nested passes — decompose once (this dissolves the double-count you flagged)

The double/triple-add risk comes only from running the pass over nested duration supersets
(`≥8h ⊂ ≥4h ⊂ …`). Avoid it structurally:

```text
 decompose EACH real event exactly ONCE (threshold-agnostic) → its runs are disjoint by construction
 assign each run to every bucket T ≤ its duration   (a 5h run feeds the 2h AND 4h buckets — same as
                                                     how the S_T thresholds already nest today)
 floors:  T ≥ 2h (smallest product trigger)  ·  runs must be resolvable at the 15-min cadence
```

One event → decomposed once → no double-add, and **no "start at 24h and stop somewhere" rule
needed**. (A *recursive* decomposition — re-entering below-`L` regions with a local reference to
catch that hidden plateau — is the only place a stop rule earns its keep; treat it as a deliberate
multi-resolution option, not the default.)

### 3.4 The ceiling — it stays a conservative proxy

This still lives on the **county aggregate**, which cannot see *individual* customer durations: a
sustained level (or a surge) can be one cohort out the whole time, or churn (people cycling). So a
recovered episode is an *episode of elevated county outage*, and its peak is an upper-ish intensity
— a **bounded, conservative proxy** for true per-customer crossings, not the exact count. The exact
number needs per-outage durations (PowerOutage.US / the [A011](../../methodology/assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation)
resolution path). State it; don't imply we measured individual durations.

---

## 4. The diagnostic — *established* + *conservative* = well-cushioned

The same decomposition, used **only to count** (not to re-price), is how we *test* the ≥8h cushion. Slice the
recovered short-trigger episodes by the **parent event's duration band**:

```text
 revival yield  =  extra short-trigger episodes recovered, by parent-event duration band
 (illustrative shape — the real numbers are the notebook's job)

 parent ≥24h │▏           ≈0 extra 2h episodes — one coherent surge, nothing hidden
 parent ≥12h │▎
 parent  ≥8h │█▍          little hidden structure   →  long-trigger frequency expected to hold
 parent  ≥4h │█████▏
 parent  ≥2h │█████████   lots of hidden sub-episodes →  short-trigger frequency NOT established
```

**The hiding pool — a *necessary* condition, not the answer.** To hide an *extra* T-episode, a parent
event needs room for **two disjoint ≥T runs** → duration **≥ 2T**. So the candidate pool for trigger T
is `count(events ≥ 2T)` (eagle-i-45min, 13.19M events):

```text
 trigger T   candidate pool   exact count   share all   pool / base(>=T)   realized extra
 ──────────────────────────────────────────────────────────────────────────────────────
 24h         events >= 48h       102,203       0.77%          36%           TBD (diagnostic)
 12h         events >= 24h       281,205       2.13%          33%           TBD
  8h         events >= 16h       549,616       4.17%          36%           TBD  <- the gate
 ──────────────────────────────────────────────────────────────────────────────────────
  4h         events >=  8h     1,520,644      11.53%          43%           TBD (likely material)
  2h         events >=  4h     3,496,329      26.51%          53%           TBD (likely large)
```

Two cautions the table forces — it measures *exposure to error*, not the error:
- **Absolute pool shrinks (3.5M → 0.1M), but pool/base is ≈ flat at ~⅓.** Relative to the trigger's
  *own* base — which is what actually moves λ(T) — the candidate pool is **not** smaller at long T. So
  "fewer long events" / counts alone **cannot** declare 8h "established."
- **`realized extra` is unmeasured.** The pool is only the *necessary* condition (parent long enough);
  the realized number needs the 15-min path (coherent single surge → ≈0 extra; multi-surge → +1). That
  is the diagnostic's job — assert the structure, **measure** the magnitude.

**Why 8h is still well-cushioned — a worst-case *bound*, not "rare."** Even if *every* long event were
maximally multi-surge, the extra is structurally capped: a ≥16h parent hides ≤1 extra 8h episode, a
≥24h parent ≤2 → `extra ≤ pool(≥16h) + (≥24h) ≈ 0.55M + 0.28M = 0.83M`, i.e. 8h frequency under-counted
by **≤ ~55%**. The priced mean already over-states true per-customer exposure **~2–3×** (A011), so
`priced/true ≥ (1 / 1.55) × 2 ≈ 1.3 > 1` — conservative **even in the worst case**. So the diagnostic
*refines* the 8h number; it cannot overturn the conclusion.

Two **distinct** pillars — keep them separate or the claim gets hand-wavy:

```text
 ESTABLISHED   the hidden-episode correction to long-trigger frequency is structurally BOUNDED
               (<= ~55% even worst-case at 8h) and absorbed by the cushion below; the diagnostic pins
               the (expected small) realized number. A reliability claim.
 CONSERVATIVE  the priced mean OVER-states true per-customer exposure at long durations
               (A011 ~2–3×, the structural gate over-count from 04). A direction claim.

 ESTABLISHED + CONSERVATIVE  →  "well-cushioned at ≥8h"
 short triggers fail BOTH (hidden sub-episodes; diluted mean) → "not established · verify"
```

This is the reasoning the platform's trust-&-posture detail needs for *"why ≥8h vs <8h."* The
**qualitative** version ships now; the **quantitative** revival-yield numbers go up only once the
notebook produces them (no unproven stat on the platform).

---

## 5. What is on the dashboard now

```text
 SHIPPED 2026-06-24  ·  short-T posture gated to "not established · verify"; ≥8h keeps well-cushioned.
 ADDING now (qualitative): the "why ≥8h" explanation (established + conservative) in the
                           trust-&-posture detail + cushion-by-trigger strip.
 NOT on the dashboard until computed: the revival-yield numbers; any short-trigger re-pricing.
```

---

## 6. Build order & open decisions

```text
 1. DIAGNOSTIC first (§4)  — low risk, no re-pricing; proves the ≥8h framing for docs + platform,
                            and its yield-by-duration output empirically answers "how much short-T
                            frequency is even recoverable" (your "where do we stop").
 2. RECOVERY second (§2-3) — the larger build; produces a reliable short-trigger λ once we pick L.
                            Gated on business need for short triggers; price move is a separate,
                            governed decision even then.
```

**The cushion/verify threshold is a *derived output*, not an assumption.** The diagnostic's first
deliverable is the T at which the net (the conservative cushion vs the bounded frequency + intensity
corrections) crosses from robustly-conservative to uncertain — *that* is the cushion/verify line.
Hygiene so it's objective, not chosen post-hoc: (1) fix the "cushion established" criterion *before*
running (e.g. net `priced/true ≥` a margin, held across counties); (2) test whether it's a clean
national line or varies by county/region (if it varies, keep national 8h as a conservative floor);
(3) report its **sharpness** — a cliff vs a gradual ramp (if gradual, the exact cut matters less and
"lead long" is robust either way). `8h` is the current working line (from `04` + low boundary mass);
**confirm-or-adjust** — either outcome strengthens it, and the gate is a one-line constant
(`CUSHION_ESTABLISHED_MIN_T`).

**Open decisions (these shape the notebook):**
1. **Reference level `L`** (§3.1) — bare event-mean v1, or a deliberate level-crossing from the start?
2. **Add vs. replace** (§3.2) — confirm revived episodes replace the parent's bucket contribution.

**Honesty guardrails (carry from the posture work):** posture/diagnostic never moves the price;
nothing claims individual-customer durations (churn ceiling); keep docs ↔ dashboard ↔ notebook
consistent on any label/threshold change.
