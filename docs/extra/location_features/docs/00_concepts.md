# 00 · How to read this — rural vs urban, density, and the relativity

*Plain-language primer. Read this before the findings if it's your first time —
it defines the words and shows how to read one row, so the numbers downstream
actually mean something.*

## What "rural" and "urban" mean here (it's about the grid, not the vibe)

We don't mean rural/urban in the demographic sense. We mean the **state of the
electric distribution grid** that serves a place, because that's what drives
outages:

| | Rural | Urban |
|---|---|---|
| Lines | long, **overhead**, strung over distance | more **underground** (weather-immune) |
| Topology | **radial** — one path, no backup | **looped / networked** — reroute around a fault |
| Trees | lines run through woods (tree contact) | fewer trees on the line |
| Restoration | crews travel far to one fault | crews close, many customers per crew |
| Result | **out more often, longer** | **fewer, shorter** interruptions |

We can't observe "grid state" directly, so we **proxy it with density** — electric
**customers per km²**. Low density ≈ rural ≈ exposed grid; high density ≈ urban ≈
resilient grid. (We also tested tree canopy; it added nothing beyond density in
New England — see [`01_findings.md`](01_findings.md). Density is the single, simple
feature that carries the signal.)

## The number we compute: the within-county relativity

> **relativity = how often a town's customers hit the outage threshold ÷ how
> often the average customer in the *same county* does.**

- **1.0** = exactly the county-average customer. **2.0** = twice as often.
  **0.5** = half as often.
- It is **within county** — every town is compared to its *own* county, not the
  nation. (The county's overall risk level is a separate layer.)
- It **conserves**: weight every town by its customers and the county averages to
  **exactly 1.0**. We are *not* saying the county is riskier — we're saying risk
  is spread **unevenly inside** it. Rural towns carry more than their share, urban
  towns less, and it nets back to the county rate.

## How to read one row — worked example, New Haven County CT

The county runs from rural Bethany to the dense city of New Haven:

| Town | density (cust/km²) | relativity (T≥4h) | reads as |
|---|---|---|---|
| Bethany | 43 — **rural** | ~high (>1) | exposed, wooded, radial → its customers hit a ≥4h outage **more often** than the county average |
| New Haven (city) | 1,215 — **urban**, 58,827 customers | **0.80×** | dense, undergrounded, looped → ~**20% less often** than the county average |
| *all 27 towns, customer-weighted* | — | **1.00×** | the redistribution nets back to the county rate (conservation) |

**Plain reading of any row:** *"Town X has D customers per km² (lower = more
rural), and over the study window its customers crossed the ≥T-hour outage line
about R times as often as a typical customer in the same county."*

The **reliable** signal is the gradient across many towns, not any single one:

> rural third of towns ≈ **1.9×** the county average · urban third ≈ **0.72×**.

### See it on a map

![Within-county relativity map — CT/MA/RI towns](../analysis/outputs/town_relativity_map.png)

**Left:** town **density** (the rurality proxy) — bright = dense urban cores
(Hartford, New Haven, Providence, the Boston suburbs), dark = rural. **Right:** the
**within-county relativity** — **red towns are rural and run above their county
average; blue towns are urban and run below.** Black lines are counties; inside
each one the reds and blues balance back to 1.0×. Read the *pattern*, not any one
town (single-town colors are noisy in one quiet season).

## What it is NOT (so you don't over-read it)

- **Not a forecast** — it's historical *relative experience*, not next year's prediction.
- **Not a per-address number** — it's the *town* average; your exact building isn't
  resolved yet (that needs meter / live-feed data).
- **Not about duration** — this is how **often** (frequency); how **long** an outage
  lasts is the utility / grid-condition lane.
- **Not trustworthy for one town in one quiet season** — single-town values are
  noisy (e.g. a town can read very high off a handful of events). Trust the
  **rural-vs-urban gradient and the conservation (county = 1.00×)**, not one town's
  exact number.

## One line to remember

> Within a county, rural (low-density) towns lose power **more often** than urban
> ones; we measure that as a **mean-1 relativity** (rural > 1, urban < 1), and
> **density** is the one simple feature that captures it.

## Cross-references

- The evidence: [`01_findings.md`](01_findings.md) (density vs size; canopy follow-up).
- The shareable notebook: [`../analysis/notebooks/02_nlcd_canopy.ipynb`](../analysis/notebooks/02_nlcd_canopy.ipynb).
- Why a "relativity" / how it composes with the other layers: [`../../../dicsscssion/location_aware_outage_pricing/03_location_basis_risk_design.md`](../../../dicsscssion/location_aware_outage_pricing/03_location_basis_risk_design.md).
- Method + target definition: [`../../../plan/location_basis_research_plan.md`](../../../plan/location_basis_research_plan.md).
