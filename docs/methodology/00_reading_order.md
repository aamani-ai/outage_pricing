# Fundamentals — Senior Team Reading Order

Short, self-contained explainers for non-implementers. Each is ~1.5–2 pages, with worked examples, ASCII visuals, and explicit caveats. They build on each other; reading in order takes ~15 minutes total. The briefs now live in their step subfolders (`01_eventization/` … `cross_cutting/`); this page preserves the reading order across them.

## Reading order

1. **[EAGLE-I Outage Data](cross_cutting/eagle_i_data_fundamentals.md)** — what the raw dataset is, what one row means, what MCC is and why it's modeled.
2. **[Event Catalog Construction](01_eventization/event_catalog_fundamentals.md)** — how 15-minute snapshots become events. The gap-merge rule and what it does.
3. **[County-Trigger Pricing (v0)](02_per_customer/county_trigger_pricing_fundamentals.md)** — the baseline pricing formula. The Alachua λ = 307.148490 anchor. The six things v0 explicitly does NOT do.
4. **[Per-Customer Pricing](02_per_customer/per_customer_pricing_fundamentals.md)** — the headline rate. Why it's 30–100× smaller than v0. The single load-bearing assumption ([A011](assumptions.md)).
5. **[Cell Read — Trust & Posture](02_per_customer/cell_read_fundamentals.md)** — the Step 1-2 confidence layer. How much to **trust** each county-threshold number (coverage / volume / stability, weakest-link) and which way it **leans** (posture: spiky → conservative cushion, flat → balanced/runs-close). Diagnostic, not a price input.
6. **[Location Basis](04_location_basis/location_basis_fundamentals.md)** — within-county location risk. Density terciles (rural/mid/urban) as a mean-1 relativity on the per-customer price. The second `basis_alignment` layer; shipped as a shadow read. What we tried (canopy, impervious) and why we keep density.
7. **[Risk Clustering — Regime Classification (Step 3)](03_risk_clustering/README.md)** — each county's behavioral identity: **stable / trend / shift / episodic** + an explicit **insufficient** abstention, from a significance-gated rule tree on the masked ≥8h series. A router/identity, not a forecast (A013). Canonical HOW: [`regime_classification_methodology.md`](03_risk_clustering/regime_classification_methodology.md).
8. **[Source-Coverage Mask](../dicsscssion/eventization_frequency_contract/05_source_coverage_mask.md)** — the Step-3 pre-clean: observed-zero vs missing (the coverage ramp), so a trend isn't manufactured by improving EAGLE-I coverage.
9. *(superseded — context only)* the old descriptive layer, kept bannered: [Outage Trend](03_risk_clustering/outage_trend_fundamentals.md) (slope is reused as a regime feature) · [Predictability](03_risk_clustering/outage_predictability_fundamentals.md) · [Lambda Shadow](03_risk_clustering/lambda_shadow_pricing_fundamentals.md) (the price-move is now Step-5-gated). The 7-shape labels were replaced by the 5 outcomes above.

**★ Capstone — [End-to-End Worked Example](cross_cutting/end_to_end_worked_example.md)** — one county (Honolulu, HI) traced through *every* step above with real numbers: mask → λ(T) → per-customer → regime → location → range → premium. Read this to see how the pieces connect into one quote (and the cross-step windowing subtlety it surfaces).

## How to use these

- **Read straight through** for a complete picture (~15 min).
- **Pick one** if you only care about that layer — each is self-contained.
- **Skim the one-line takeaways** at the bottom of each for the punch line.

## Related deeper material

- [`../assumptions.md`](assumptions.md) — stable-ID assumption registry (A001 … A017) cited from every doc above.
- [`../per_customer_view_walkthrough.md`](02_per_customer/per_customer_view_walkthrough.md) — long-form pedagogical walkthrough with the Boone, MO worked example.
- [`../location_basis_methodology.md`](04_location_basis/location_basis_methodology.md) — long-form location-basis reference (granularity ladder, Census/CONUS data, density→tercile→price, validation, and the work ahead).
- [`../roadmap.md`](roadmap.md) — sequencing for baseline, basis/alignment, forward-regime reads, and trigger alignment.
- [`../../dicsscssion/pricing_adjustment_mechanisms/`](../dicsscssion/pricing_adjustment_mechanisms/) — project-level architecture for combining basis/alignment and forward-regime adjustments into a tagged premium-impact view.
- [`../competitive_landscape.md`](cross_cutting/competitive_landscape.md) — competitive intelligence (Adaptive, Whisker Labs Ting, PowerOutage.US, adjacent verticals).
