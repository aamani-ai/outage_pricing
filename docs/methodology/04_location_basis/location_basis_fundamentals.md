# Location Basis — Fundamentals

*Audience: senior team. Last reviewed: 2026-06-23 (zonal-impervious guardrail plan). Reads naturally after [`per_customer_pricing_fundamentals.md`](../02_per_customer/per_customer_pricing_fundamentals.md). See the deeper reference at [`../location_basis_methodology.md`](location_basis_methodology.md).*

## What location basis is, in one paragraph

Per-customer pricing answers *"how often does the **average** customer in this county lose power?"* — but two addresses in the same county are not the same. A rural site on a long overhead radial feeder through trees loses power more often than a dense, undergrounded, networked downtown block. Location basis is the layer that **redistributes the per-customer rate *within* a county**: rural locations sit above their county average, urban below. It is the **second `basis_alignment` layer** (after per-customer), and it ships as a **shadow** read, not active pricing. We proxy "how exposed is the local grid" with **population density**, split into within-county **terciles** (rural / mid / urban), each mapped to a multiplicative **relativity**. Crucially the relativity is **mean-1 within each county** — it moves risk *between* locations, it does **not** change the county total.

## The formula

```
density(unit)     = population / land_area_km²            (Census; log scale)
tercile(unit)     = within-county rank of density -> rural | mid | urban
relativity(t, T)  = mean-1, monotone, capped factor per tercile t        (fit on the pilot)

price_location    = price_per_customer × relativity(tercile, T)
```

Where:
- **`relativity`** — rural > 1, urban < 1, exposure-weighted mean **= 1.0 within each county** (conservation — assumption **LB-1**).
- It multiplies the **per-customer** price (`λ_customer × X / load`), never the over-priced county-trigger price.
- **Capped** for *attribution confidence* (how sure we are a specific address sits in the tail), not because the signal is small.

## Worked example — New Haven County, CT (validated pilot)

| density tercile | relativity (T≥4h, v0 shadow) | per-customer $2,500 @ 4h → location price |
|---|---|---|
| **rural** (sparsest third) | **1.40×** | $303 → **~$425** |
| mid | 1.23× | $303 → ~$373 |
| **urban** (densest third) | **0.80×** | $303 → **~$243** |

Same county, same contract — ~**$243–$425** depending on within-county location. The three terciles, exposure-weighted, balance back to **1.0×** (the county total is unchanged). Empirical spread is larger (rural ≈ 1.9× at T≥4h, widening to ≈ 2.1× at T≥8h); the cap is the deliberate v0 throttle.

## How the relativity behaves (ASCII)

```
Within ONE county  (mean-1: the county total does not move):

   rural town                 mid                  urban core
   sparse · overhead          mixed                dense · undergrounded
   radial · wooded                                 networked
   ●    ●     ●               ●● ●●●               ▓▓▓▓▓▓▓▓▓▓
      ●     ●                 ●●● ●●               ▓▓▓▓▓▓▓▓▓▓
   low density                ~county avg          high density
   relativity 1.40×           1.23×                0.80×
        │                       │                      │
   per-customer $303 ─────────────────────────────────┤
        ▼                       ▼                      ▼
      $425                    $373                   $243
   └──────────────── exposure-weighted mean = 1.0× ───────────┘
```

A rural site runs above its county average; a dense urban core below. The county
baseline (and the per-customer layer beneath it) already own the *level*; location
basis only owns the *within-county redistribution*.

## How density is computed, and the terciles

- **Density = population ÷ land area (km²)** — Census `ALAND` (land only, water excluded), on a **log scale** (density spans ~5 orders of magnitude). Pilot uses PoUS customers ÷ town area; nationally, ACS tract population ÷ tract area.
- **Within-county, not absolute** (assumption **LB-3**): a density of 50/km² is "rural" inside dense Fairfield County but near-average inside rural Litchfield. Using absolute density would double-count the county baseline and break LB-1.
- **Terciles**: rank a county's units (towns / tracts) by density, split into thirds — sparsest = rural, densest = urban.

## Where it's validated, and where it's only extrapolated

| Region | What it is |
|---|---|
| **CT / MA / RI pilot** | **validated** against PowerOutage.US sub-county outage outcomes (Jan–Mar 2019). Density predicts the within-county relative (within-county ρ ≈ **−0.35**); the signal is structural, not noise; conservation holds (county mean ≈ 1.0). |
| **Rest of CONUS** | **descriptive + extrapolated** (shadow): the within-county density read is computed from ACS tracts, and the pilot-fit relativity is *applied*, but **not independently validated**. Labeled as such on the dashboard. |

## What we tried — and why we keep it simple with density

| Tried | Result | Verdict |
|---|---|---|
| Town **size** (customers) | crude rurality proxy, works | superseded by density |
| **NLCD tree canopy** | partial ρ ≈ 0 beyond density (NE canopy saturates) | adds nothing |
| **NLCD impervious (point)** | within-county ρ = −0.20 vs density −0.35 (centroid 0%-heavy, single pixel noisy) | point worse; the **zonal mean** is now the planned guardrail (below) |
| **Population density** ✅ | within-county ρ = **−0.35**, validated, simple, monotone | **kept (v1)** |

## The known limitation — and the fix now in development (2026-06-23)

Population density **mis-ranks dense commercial / low-residential cores**: Midtown Manhattan reads "rural" (few residents) and would wrongly get an uplift. The flaw is **localized** (big-city downtowns) and today **shadow-only** (it does not touch the validated pilot). The fix — now the **active Step-04 workstream** (see the [notebook plan](../../plan/04_location_basis/location_basis_notebook_plan.md)) — is a **zonal mean of NLCD impervious % per tract** used as a **symmetric, conservative guardrail** on the density rank, *not* a replacement:

- **Type A — de-uplift cores:** density says "rural" but impervious says built-up (Midtown ≈ 91% zonal) → reclassify **rural → urban**. Fires on the strong, unambiguous high-impervious signal.
- **Type B — penalize the reverse:** density says "urban" but impervious says not-built-up → pull **toward higher premium**. Deliberately **conservative** (for outage insurance, over-charging an ambiguous location beats under-charging) and documented: low impervious is ambiguous (urban green space reads low), so Type B may over-penalize some leafy, well-served tracts — an accepted, flagged bias (optional greenspace guard later).

**Spike (2026-06-23):** zonal impervious flipped Midtown (p13 density → 91%) and the Financial District (p15 → 89%) rural→urban (**2/2**), left genuinely-residential tracts untouched, and confirmed the **zonal mean is stable where a single point is noisy** (why point-impervious failed). National build = raster zonal-stats over the CONUS NLCD raster (`rasterio`, GB-scale), run **offline in the notebook**, never in the dashboard. **Status: planned / in development — not yet shipped into pricing.**

## Caveats — what to know before relying on location basis

1. **Shadow, not active pricing.** A candidate factor shown for review; not a filed rate.
2. **Validated only on CT/MA/RI** (one region, one quiet season). Everything else is descriptive density + extrapolated relativity — provisional until replicated (e.g. Texas, a storm season).
3. **Town/tract grain, not premise** (assumption **LB-4**). An address is placed in its tract, not verified at the meter — the last mile needs live geometry / AMI.
4. **The proxy is NE-validated.** "Density alone" holds in New England; low-tree regions may need other drivers (wind, ice, terrain). And the commercial-core flaw above.
5. **It composes on per-customer, not county-trigger.** The relativity multiplies `λ_customer`, never the ~$1.2M county-trigger number. Wrong base = wrong price.
6. **Static basis risk, not forward regime.** This is *where you are*, not *how the future differs* (storm/climate/grid) — that is a separate lane.

## How this fits the broader pricing roadmap

Location basis is the **second active-track `basis_alignment` mechanism** (after per-customer), shipped as a shadow read:

| Mechanism family | What it does | Examples |
|---|---|---|
| **`basis_alignment`** | Align the county estimate toward what the policy actually sells | Per-customer rate (**active**), **location basis (shadow, this doc)**, trigger-source alignment (**discussion**) |
| **`forward_regime`** | Adjust/review the future loss view (pattern, grid, hazard, weather) | Predictability/shadow read (**review layer**), grid & hazard (**wip**) |

The principle holds: **fix the data-input layer (basis/alignment) before adding forward-looking layers.**

## One-line takeaways

- **`per-customer price × a mean-1 within-county density relativity (rural > 1, urban < 1)`. That's it.**
- **Density is the validated, simple proxy; canopy and point-impervious were tried and don't beat it.**
- **Validated on the CT/MA/RI pilot; national is descriptive + extrapolated (shadow).**
- **Known flaw — population density mis-ranks commercial cores; the fix (a symmetric, conservative zonal-impervious guardrail) is now in development — spike flips Midtown & the Financial District 2/2.**
- **It redistributes within a county; it does not change the county total ([LB-1](location_basis_methodology.md#assumptions-introduced-here)).**

## References

- Deeper reference: [`../location_basis_methodology.md`](location_basis_methodology.md)
- Evidence + experiments: [`../../extra/location_features/docs/01_findings.md`](../../extra/location_features/docs/01_findings.md)
- Build + data lineage: [`../../extra/location_features/docs/02_end_to_end_and_data_lineage.md`](../../extra/location_features/docs/02_end_to_end_and_data_lineage.md)
- Plain-language primer: [`../../extra/location_features/docs/00_concepts.md`](../../extra/location_features/docs/00_concepts.md)
- The base it composes on: [`per_customer_pricing_fundamentals.md`](../02_per_customer/per_customer_pricing_fundamentals.md)
- Roadmap context: [`../roadmap.md`](../roadmap.md)
