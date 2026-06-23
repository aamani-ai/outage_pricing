# Underwriter Cell-Read Framing For Eventized Frequency

**Status:** framing / communication doc — the Chris answer. The **mechanics are
canonical** in [`cell_read_fundamentals.md`](../../methodology/02_per_customer/cell_read_fundamentals.md)
(definition) and [`inner_event_shape_confidence_plan.md`](../../plan/cross_cutting/inner_event_shape_confidence_plan.md)
(design + phases); this doc carries the *why* and *how we say it to carriers*.
**Last reviewed:** 2026-06-22

## The Chris Question

Chris's practical question is not "can we write a more elegant model?" It is:

```text
Are these Gen-1 numbers believable enough to put in front of channel partners,
customers, and eventually risk capacity?
```

The hard part is that this is a real data constraint, not a missing dashboard
feature. No broad national source gives us the perfect object:

```text
insured location x actual outage start/end x actual customer restoration
```

What we have in Gen 1 is an observed outage-count history, mostly county-level,
plus a documented conversion from that history into contract-relevant events.
So the honest answer is not "these are exact location-level outage counts." It is:

```text
These are eventized frequency estimates from the best scalable historical outage
source available. Each price cell carries a cell read: how much to TRUST the
number (source coverage, eventization stability, sample volume) and which way it
LEANS (the customer-impact shape posture).
```

That is a stronger answer because it is auditable and does not overclaim.

## How To Say It Internally

```text
We are not hiding the data limitation. We are quantifying it.
```

Underwriter-facing version:

```text
The raw feed is not a policy-level loss history. It is an observed grid-state
history. We convert it into outage events using explicit duration and continuity
rules, then attach a cell read to each county-threshold cell. Cells with poor
source coverage, gap-sensitivity, thin event volume, or a flat (low-cushion)
shape are not treated the same as stable, cushioned cells.
```

This lets us be commercially useful without pretending the feed is perfect.

## The Lower-T Question

"Are we undercounting lower-duration thresholds?" needs a careful answer:

```text
Sometimes yes, but lower T can also be overcounted. The direction depends on
the data artifact.
```

| Artifact | Lower T effect | Higher T effect |
|---|---|---|
| Missed short outages | Can undercount `2h` / `4h` frequency | Less important if the outage would never reach `8h+` |
| Strict gap rule splits one outage | Can overcount short events | Can undercount if each fragment falls below `T` |
| Loose gap rule merges separate outages | Can undercount event count | Can create a false long-duration event |
| Missing source year treated as zero | Undercounts all thresholds | Especially damaging for trend / step-change reads |
| Tiny customer outage included as county event | Can overstate county event frequency | Customer-impact layer should down-weight it |

So we should not claim "lower T is always undercounted." The better claim:

```text
Lower-duration products are more exposed to eventization ambiguity. They have
more observations, but the event boundary itself is less clean. Longer-duration
products have fewer observations, but the insured event is easier to defend.
```

That supports a Gen-1 launch posture:

```text
Lead with sustained-outage products first, e.g. D >= 8h or D >= 12h.
Show 2h / 4h only where TRUST supports it, or mark them as exploratory.
```

## Why Higher Duration Helps The First Target Group

The trigger condition is `D >= T`. For Gen 1, duration does useful evidence work:

```text
short outage  -> more frequent, harder to distinguish from scrape noise
long outage   -> rarer, more economically meaningful, easier to explain
```

This does not mean long-duration products are always statistically better — a
county with only two long outages has thin data (TRUST will say so). But the
insured meaning is cleaner, and that matters for launch.

```text
Our initial product focus is sustained outage protection. Shorter-duration
options may remain available as configurable outputs, but they carry stricter
cell-read flags because the eventization layer has more influence there.
```

## Raw Duration Bucket Diagnostic

Inspect the raw event distribution before talking about pricing thresholds — the
useful view is non-overlapping duration buckets. This is **not** a pricing input;
it shows how much evidence sits below, around, and above the product thresholds.

Notebook: [`../../../notebooks/01_eventization/event_duration_bucket_analysis.ipynb`](../../../notebooks/01_eventization/event_duration_bucket_analysis.ipynb)

### National read, default 45-minute catalog

| Duration bucket | Events | Share |
|---|---:|---:|
| `0-2h` | 6,623,451 | 50.2% |
| `2-4h` | 3,070,904 | 23.3% |
| `4-8h` | 1,975,685 | 15.0% |
| `8-12h` | 671,651 | 5.1% |
| `12-24h` | 567,788 | 4.3% |
| `24h+` | 281,205 | 2.1% |

Cumulative `duration >= T`: `2h` 49.8% · `4h` 26.5% · `8h` 11.5% · `12h` 6.4% · `24h` 2.1%.

```text
About half the catalog is shorter than 2 hours. About a quarter clears 4 hours.
Only ~1/9 clears 8 hours; ~1/16 clears 12 hours.
```

`8h`/`12h` are not "better because they have more data" — they are better first
products because the event is cleaner and more economically meaningful. The
tradeoff is visibly thinner sample (which `C_sample` in TRUST captures per cell).

### Per-county support (45-minute catalog)

| County | Total | `0-2h` | `2-4h` | `4-8h` | `8-12h` | `12-24h` | `24h+` |
|---|---:|---:|---:|---:|---:|---:|---:|
| Worcester, MA | 10,344 | 4,179 | 1,888 | 2,002 | 940 | 959 | 376 |
| Suffolk, MA | 8,762 | 3,565 | 1,699 | 1,547 | 730 | 865 | 356 |
| Erie, NY | 8,796 | 2,782 | 1,727 | 1,679 | 1,014 | 1,277 | 317 |
| Harney, OR | 734 | 478 | 157 | 84 | 6 | 7 | 2 |
| Concho, TX | 1,447 | 637 | 421 | 205 | 58 | 43 | 83 |

- Worcester/Suffolk have broad support through `8h`/`12h` → a sustained-outage product has visible history.
- Harney has many short events but very few long ones → an `8h`/`12h` quote is thin (TRUST: Thin).
- Concho has a non-trivial long tail but a known source gap (TX-2016) → `C_source` flags it ([A012](../../methodology/assumptions.md#a012--per-customer-exposure-uses-one-global-window-dilutes-partial-coverage-counties)).

## Customer-Impact Distributions: Inner vs Outer

Duration buckets answer how many events survive each `T`. Customer impact has a
separate two-layer structure:

```text
within one event e                  across qualifying events at T
  +-- mean_customers(e)  headline     { mean_customers(e)/MCC(f) | dur >= T }
  +-- max_customers(e)   peak/stress    +-- mean    headline multiplier
                                        +-- median  typical-event sensitivity
                                        +-- p90/p99 tail-dominance evidence
```

The headline price uses **inner mean + outer mean** = `mean over qualifying events
of mean_customers(e) / MCC(f)`. The other statistics are **reported as context**
(not scored) and feed the read:

| Diagnostic | What it tells us |
|---|---|
| `max_customers` >> `mean_customers` (peak/mean) | events are spiky → POSTURE conservative (mean below peak → cushion) |
| outer mean >> outer median (`mm_ratio`) | a few large events dominate the multiplier (heavy-tail; the norm — reported, not scored) |
| high `p90/p99` affected-share | low-frequency, high-impact customer-out tail |

Audit trail of which shape signals survived the real data: [`03_inner_event_shape_diagnostics.md`](03_inner_event_shape_diagnostics.md).

## The cell read (validated): TRUST + POSTURE

Each matrix cell carries a two-tag read — **not** a probability the premium is
correct, but a practical read on how much to trust the number and which way it
leans. Full plain-language definitions and worked counties:
[`cell_read_fundamentals.md`](../../methodology/02_per_customer/cell_read_fundamentals.md).

```text
 TRUST   "how hard can I lean on this number?"   weakest-link min() of three checks:
   coverage   per-county observed years + known-gap flags (TX-2016, CT-2025)   [C_source]
   volume     enough qualifying events                                          [C_sample]
   stability  λ stays put across 30/45/60 stitching                             [C_evt]
       ->  Strong / Medium / Thin

 POSTURE "are we conservative here, and where does it break down?"  (Chris's question)
   (1) cushion LEVEL (by duration):  short T 2h/4h -> runs close (VERIFY) ·
        long T 8h/12h+ -> well-cushioned (mean over-states ~2-3x = conservative)
   (2) cushion TILT (within-T vs peers, secondary):  spikier · typical · flatter
```

Why weakest-link `min()`: a high event count must not hide a known source gap,
and a clean source window must not hide an unstable 30/45/60 result. The weakest
check is what an underwriter will challenge.

**The cushion LEVEL is the direct answer to Chris's duration-conservatism worry** (his action item: *"provide a statistical analysis to verify the duration assumptions are conservative"*). The conservatism is real but **not uniform** — strongest at 8h/12h+ and thinnest at 2h/4h. Nationally ~71% of 2h cells run close vs ~91% well-cushioned at 24h. So we can say *"we are conservative — and here is exactly where it breaks down (short T)"*, which is why we lead with sustained durations and flag short-T cells. (The full *proof* of net conservatism — duration over-stated × customer-count, plus a short-T directional check — is in [`04_duration_conservatism.md`](04_duration_conservatism.md), which closes the action item; this read shows **where** the cushion is thick or thin.)

Two deliberate refinements the real data forced (audit trail in [`03`](03_inner_event_shape_diagnostics.md)):

```text
 • Product-fit (which T to lead with) is NOT in the trust score — it is a separate
   STRATEGY axis, so a subjective product judgment can't silently cap a data read.
 • The dead proxies are gone: min-based "restoration-tail" (min ~= 1 everywhere,
   degenerate) and "bridge-heavy" (~0% of events). The only robust within-event
   shape signal is peak/mean, read as a percentile WITHIN its duration band.
```

## Dashboard / Matrix Treatment

Every cell can show: `premium · lambda_customer · TRUST · POSTURE · main reason`.

| TRUST | CUSHION LEVEL | Platform behavior |
|---|---|---|
| Strong | well-cushioned | normal display; can note the built-in margin |
| Strong | runs close | normal display; note it runs closest to the bone (verify, esp. short-T) |
| Medium | any | show value with a caveat note |
| Thin | any | suppress or route to manual review |

Examples (validated reads at `T=8h`):

```text
Worcester, MA — TRUST Strong · POSTURE conservative
  complete source years, ample events, spiky events (44% spiky) -> mean sits below
  the peak view -> built-in cushion.

Concho, TX — TRUST Thin · POSTURE mixed
  TX-2016 source gap caps C_source (per-county coverage flags it); enough events
  by volume, but the gap binds the read.  (A012)
```

## Suggested Answer To Chris

```text
We agree this is fundamentally a data-confidence problem. We do not have, and do
not think the market has at national scale, a perfect historical portfolio
location event count. So our Gen-1 approach is to price from observed outage time
series, convert them into events using explicit rules, and attach a TRUST +
POSTURE cell read to each county-duration cell.

For shorter durations we expect more eventization ambiguity — those cells get a
clearer flag unless they are stable across sensitivity tests. For the initial
product we lead with sustained-outage thresholds like 8h or 12h, where the
insured event is easier to defend. Lower thresholds can remain configurable, but
not all are equally launch-ready.

TRUST is not a model-performance trophy — it is governance: for this county and
this duration, is the price supported by complete source history, stable event
construction, and enough observed events? POSTURE tells us, separately, whether
the mean-based conversion leans conservative (cushion) or runs close to true.
```

## What This Unlocks

1. Keep the eventization discussion as the methodological foundation.
2. Build a read-only cell-read artifact at the pricing grain (`fips x T`) — Phase 2 of the plan.
3. Use it to decide which cells are launch-ready, review, or suppressed.
4. Use the same artifact to show risk capacity that we do not treat every county and threshold as equally reliable.

## Open vs Settled Decisions

| Decision | Status |
|---|---|
| Score as `0-100` vs `High/Med/Low` | **Settled** — categorical `Strong/Medium/Thin` externally; the `min()` score stays internal |
| `min()` vs capped weighted average | **Settled** — weakest-link `min()` of the three data checks |
| Does the read affect price, eligibility, or only explanation? | **Settled** — explanation + routing only; **never** moves price |
| Product-fit inside the score? | **Settled** — no; separate strategy axis |
| Hide low-TRUST low-T cells in Gen 1? | Open — product/market call |
| Which thresholds do we actively sell first? | Open — leaning `8h`/`12h` |

## The Analytical Pack (built)

The cell-read engine is built and validated in
[`../../../notebooks/02_per_customer/inner_event_shape_diagnostics.ipynb`](../../../notebooks/02_per_customer/inner_event_shape_diagnostics.ipynb),
emitting (gitignored) `notebooks/outputs/inner_event_shape_diagnostics/`:

```text
 county_cell_read_by_threshold.csv     per (fips,T): cell_read, trust_lbl, posture, TRUST,
                                       C_source, C_sample, C_evt, p2m_pctile,
                                       share_spiky/mid/flat, evt_spread, n_events_qualifying,
                                       n_obs_years, mm_ratio, pct_mcc_p90/p99, coverage_gate_status
 national_cell_read_by_threshold.csv   trust & posture distributions by T
 worked_counties_cell_read.csv         the discrimination check (Erie, Worcester, Concho, Harney, ...)
```

Review targets: Massachusetts counties (Gen-1 launch relevance), Concho/Texas
(known source-gap), low-T high-volume cells with poor eventization stability, and
high-T sparse cells that should route to review rather than an automatic quote.
