# Fundamentals — Senior Team Brief

Short, self-contained explainers for non-implementers. Each is ~1.5–2 pages, with worked examples, ASCII visuals, and explicit caveats. They build on each other; reading in order takes ~15 minutes total.

## Reading order

1. **[EAGLE-I Outage Data](eagle_i_data_fundamentals.md)** — what the raw dataset is, what one row means, what MCC is and why it's modeled.
2. **[Event Catalog Construction](event_catalog_fundamentals.md)** — how 15-minute snapshots become events. The gap-merge rule and what it does.
3. **[County-Trigger Pricing (v0)](county_trigger_pricing_fundamentals.md)** — the baseline pricing formula. The Alachua λ = 307.148490 anchor. The six things v0 explicitly does NOT do.
4. **[Per-Customer Pricing](per_customer_pricing_fundamentals.md)** — the headline rate. Why it's 30–100× smaller than v0. The single load-bearing assumption ([A011](../assumptions.md)).
5. **[Outage Trend (Descriptive)](outage_trend_fundamentals.md)** — per-county 11-year yearly-event-count slope. The data foundation for future forward-regime modifiers (grid_condition, hazard, weather). NOT a pricing input.

## How to use these

- **Read straight through** for a complete picture (~15 min).
- **Pick one** if you only care about that layer — each is self-contained.
- **Skim the one-line takeaways** at the bottom of each for the punch line.

## Related deeper material

- [`../assumptions.md`](../assumptions.md) — stable-ID assumption registry (A001 … A011) cited from every doc above.
- [`../per_customer_view_walkthrough.md`](../per_customer_view_walkthrough.md) — long-form pedagogical walkthrough with the Boone, MO worked example.
- [`../roadmap.md`](../roadmap.md) — where the three-bucket framework (basis-risk / trigger-alignment / forward-regime) sits.
- [`../competitive_landscape.md`](../competitive_landscape.md) — competitive intelligence (Adaptive, Whisker Labs Ting, PowerOutage.US, adjacent verticals).
