# Event Catalog Construction — Fundamentals

*Audience: senior team. Last reviewed: 2026-06-03. Reads naturally after [`eagle_i_data_fundamentals.md`](../cross_cutting/eagle_i_data_fundamentals.md).*

## What the event catalog is, in one paragraph

The raw EAGLE-I data is a stream of 15-minute snapshots — there is **no native concept of "an outage event"** in it. The event catalog is the layer we build on top: a derived table where each row represents **one continuous outage event in one county**, with a start time, an end time, and aggregate statistics about how many customers were affected. Every downstream pricing calculation runs against this catalog, not against the raw snapshots. The catalog is **derived deterministically** from the raw data using a small set of documented rules — primarily a *gap-merge threshold* and a *restoration threshold*.

## What one event row looks like

| event_id | fips_code | start_time              | end_time                | duration_min | max_customers_out | mean_customers_out |
|----------|-----------|-------------------------|-------------------------|--------------|-------------------|--------------------|
| E0001    | 12001     | 2024-09-26 22:15:00 UTC | 2024-09-27 03:30:00 UTC | 315          | 8,420             | 4,170              |
| E0002    | 12001     | 2024-09-27 11:00:00 UTC | 2024-09-27 11:45:00 UTC | 45           | 612               | 410                |

- **event_id** — assigned by our pipeline; not present in raw EAGLE-I.
- **fips_code** — county-level location (the only spatial unit available).
- **start_time / end_time** — UTC. Onset is the first snapshot where `customers_out > 0`; restoration is the first subsequent snapshot where `customers_out` returns to zero (or below a threshold).
- **duration_min** — `end_time − start_time` in minutes. Used to define event-severity thresholds (e.g. "events lasting ≥ 4 hours").
- **max_customers_out** — peak instantaneous count during the event.
- **mean_customers_out** — average across all 15-min snapshots inside the event. Feeds the per-customer multiplier (see [`per_customer_pricing_fundamentals.md`](../02_per_customer/per_customer_pricing_fundamentals.md)).

## How a raw stream becomes one event (ASCII)

Without gap-merging, a single real outage with a brief reporting gap would look like two events:

```
  customers_out
   8,000 |  ● ● ●           ● ● ● ●
   6,000 |              ↑              ↑
   4,000 |             gap         restoration
   2,000 |
       0 |●         ●  ?  ●        ●          ●
         └─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴──→ time
            ←─ A ──→  ←B→  ←──── C ────→
```

If the gap between snapshot B's drop-to-zero and snapshot C's first non-zero is **shorter than the gap-merge threshold** (default: 45 min), we treat A+B+C as **one event**. If longer, we treat them as **two separate events**. This single rule — the gap-merge threshold — has a meaningful effect on event counts and is exposed in the dashboard as a configurable assumption (30 / 45 / 60 minutes). It is documented as [A005](../assumptions.md).

## The rules that build the catalog

1. **Onset rule.** An event begins at the first 15-min snapshot where `customers_out > 0` following a period of zero.
2. **Restoration rule.** An event ends at the first subsequent snapshot where `customers_out` returns to zero. (We do not require a sustained zero — one zero snapshot ends the event, subject to the gap-merge rule below.)
3. **Gap-merge rule.** If a new non-zero snapshot appears within `G` minutes of the prior restoration, the two segments are merged into one event. Default `G = 45` minutes. This is the single largest discretionary choice in the catalog and is **assumption [A005](../assumptions.md)**.
4. **Minimum-duration filter.** Events shorter than 15 minutes (i.e. visible in only one snapshot) are retained but flagged — they are most likely to be reporting artifacts.
5. **Catalog versioning.** We publish three parallel catalogs — `eagle-i-30min`, `eagle-i-45min`, `eagle-i-60min` — so downstream pricing is reproducible under each gap-merge choice. The dashboard lets you switch between them.

## How the catalog feeds pricing

For any duration threshold `T` (e.g. T = 4 hours), the catalog answers two questions per county:

1. **How often do events of duration ≥ T occur?** → `N_events_per_year(fips, T)`
2. **What fraction of all events last at least `T`?** → `S(T)`, the empirical survival function.

These two quantities are the inputs to the county-trigger pricing formula (see [`county_trigger_pricing_fundamentals.md`](../02_per_customer/county_trigger_pricing_fundamentals.md)). The event catalog is also where `mean_customers_out` lives — the field that drives the per-customer multiplier.

## Caveats — what to know before relying on the catalog

1. **Gap-merge rule is a discretionary choice.** Move from 30 → 60 minutes and event counts drop (some short events merge into longer ones) while average durations rise. Pricing is sensitive to this. We publish all three catalogs explicitly to surface the sensitivity rather than hide it.
2. **Sub-15-minute events are invisible.** A 10-minute outage that started and ended between snapshots will not appear in the catalog at all. This biases event counts downward and the survival curve toward longer durations.
3. **One zero snapshot ends an event.** If a utility briefly mis-reports zero during an ongoing outage, we will split one real event into two — *unless* the gap-merge rule re-joins them. This is the most common source of synthetic short events.
4. **Restoration is inferred, not observed.** A drop in `customers_out` from 5,000 to 0 is the only signal we have of restoration. We cannot tell whether all 5,000 customers actually came back at the same moment or whether the utility's outage map simply stopped reporting them.
5. **No cause attribution.** Storm, equipment failure, planned maintenance, PSPS — all produce identical event rows. The catalog is cause-agnostic.
6. **`mean_customers_out` is sensitive to event shape.** A sharp-peak-then-quick-decline event and a long flat event with the same peak will have very different means. The per-customer multiplier depends on this — see [A011](../assumptions.md).
7. **Catalog is regenerated, not appended.** When raw EAGLE-I is updated (ORNL re-publishes), the catalog is rebuilt end-to-end. Event IDs are not stable across rebuilds.

## One-line takeaways

- **The catalog is a derived layer, not raw data. Three documented rules build it.**
- **The gap-merge threshold is the single biggest discretionary choice — we publish all three options.**
- **Every downstream price runs against the catalog, not against raw EAGLE-I.**

## References

- Source data: [EAGLE-I 2014–2025](https://openenergyhub.ornl.gov/explore/dataset/eaglei_outages_2014/)
- Catalog build code: `curated_outage_data/pipelines/event_catalog/`
- Catalog rules as assumptions: [`assumptions.md`](../assumptions.md) — A005 (gap-merge), A006 (restoration), A007 (minimum duration)
- Downstream consumer: [`county_trigger_pricing_fundamentals.md`](../02_per_customer/county_trigger_pricing_fundamentals.md), [`per_customer_pricing_fundamentals.md`](../02_per_customer/per_customer_pricing_fundamentals.md)
