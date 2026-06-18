# Fundamentals — Senior Team Brief

Short, self-contained explainers for non-implementers. Each is ~1.5–2 pages, with worked examples, ASCII visuals, and explicit caveats. They build on each other; reading in order takes ~15 minutes total.

## Reading order

1. **[EAGLE-I Outage Data](eagle_i_data_fundamentals.md)** — what the raw dataset is, what one row means, what MCC is and why it's modeled.
2. **[Event Catalog Construction](event_catalog_fundamentals.md)** — how 15-minute snapshots become events. The gap-merge rule and what it does.
3. **[County-Trigger Pricing (v0)](county_trigger_pricing_fundamentals.md)** — the baseline pricing formula. The Alachua λ = 307.148490 anchor. The six things v0 explicitly does NOT do.
4. **[Per-Customer Pricing](per_customer_pricing_fundamentals.md)** — the headline rate. Why it's 30–100× smaller than v0. The single load-bearing assumption ([A011](../assumptions.md)).
5. **[Location Basis](location_basis_fundamentals.md)** — within-county location risk. Density terciles (rural/mid/urban) as a mean-1 relativity on the per-customer price. The second `basis_alignment` layer; shipped as a shadow read. What we tried (canopy, impervious) and why we keep density.
6. **[Outage Trend (Descriptive)](outage_trend_fundamentals.md)** — per-county 11-year yearly-event-count slope. The data foundation for future forward-regime modifiers (grid_condition, hazard, weather). NOT a direct pricing input.
7. **[Outage Predictability Pattern](outage_predictability_fundamentals.md)** — transparent labels for whether the simple annual trend line is usable, noisy, episodic, sparse, or better read as a step change. Shipped as a review layer.
8. **[Lambda Shadow Pricing](lambda_shadow_pricing_fundamentals.md)** — candidate lambda and premium-pressure read from the pattern layer. Shipped as shadow pricing, not active v0 premium mutation. This is one `forward_regime` / `frequency_lambda` mechanism inside the broader pricing adjustment mechanism taxonomy.

## How to use these

- **Read straight through** for a complete picture (~15 min).
- **Pick one** if you only care about that layer — each is self-contained.
- **Skim the one-line takeaways** at the bottom of each for the punch line.

## Related deeper material

- [`../assumptions.md`](../assumptions.md) — stable-ID assumption registry (A001 … A011) cited from every doc above.
- [`../per_customer_view_walkthrough.md`](../per_customer_view_walkthrough.md) — long-form pedagogical walkthrough with the Boone, MO worked example.
- [`../location_basis_methodology.md`](../location_basis_methodology.md) — long-form location-basis reference (granularity ladder, Census/CONUS data, density→tercile→price, validation, and the work ahead).
- [`../roadmap.md`](../roadmap.md) — sequencing for baseline, basis/alignment, forward-regime reads, and trigger alignment.
- [`../../dicsscssion/pricing_adjustment_mechanisms/`](../../dicsscssion/pricing_adjustment_mechanisms/) — project-level architecture for combining basis/alignment and forward-regime adjustments into a tagged premium-impact view.
- [`../competitive_landscape.md`](../competitive_landscape.md) — competitive intelligence (Adaptive, Whisker Labs Ting, PowerOutage.US, adjacent verticals).
