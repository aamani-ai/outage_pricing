# Event Catalog Creation — Methodology

- **Status:** skeleton
- **First written:** 2026-05-30
- **Last reviewed:** 2026-05-30

## Scope

How raw EAGLE-I snapshots are turned into discrete outage events with
explicit start, end, duration, and customer-count aggregates. This is the
single most opinionated stage of v0 — the algorithm is ours, not PNNL's.

## Inputs and outputs

| | Items |
|---|---|
| **Inputs** | `price_engine/data/raw/eaglei_outages_YYYY.csv` × 12 |
| **Outputs** | `price_engine/data/events.parquet` (one row per event) and `price_engine/data/events_meta.json` |
| **Catalog variants** | 30 / 45 / 60-minute gap-tolerance catalogs under `price_engine/catalogs/eagle-i-<N>min/data/` |

## Time semantics

UTC throughout, per [A001](../assumptions.md#a001--eagle-i-raw-timestamps-are-utc).
Each snapshot represents the half-open interval `[t, t + 15 min)`, per
[A003](../assumptions.md#a003--each-eagle-i-15-min-snapshot-represents-the-interval-t-t--15-min).

## Method (summary)

Per FIPS, walk the snapshots in time order. Three knobs control the
algorithm:

| Knob | Value | Choice ID |
|---|---|---|
| THRESHOLD | `customers_out > 0` | [A002](../assumptions.md#a002--customers_out--0-is-the-inclusion-threshold-for-events) |
| GAP_TOLERANCE | 30 / 45 / 60 min (catalog-specific) | TBD assumption ID |
| MIN_DURATION | 15 min (one snapshot) | TBD assumption ID |

A new event starts when the gap between consecutive included snapshots
exceeds GAP_TOLERANCE. The event closes at the last included snapshot
before the gap, with `end_time = last_snapshot_ts + 15 min`. Carry state
preserves the open event across yearly file boundaries.

## Snapshot threshold

See [A002](../assumptions.md#a002--customers_out--0-is-the-inclusion-threshold-for-events).

## Interval rules

See [A003](../assumptions.md#a003--each-eagle-i-15-min-snapshot-represents-the-interval-t-t--15-min).
`start_time` inclusive; `end_time` exclusive; cross-county merging is
explicitly not done.

## Customer-count fields

Each event carries `min_customers`, `max_customers`, `mean_customers`
aggregated over its observed positive snapshots. These are
**evidence-only** in v0 pricing; they are the primitives for the
per-customer pricing plan ([A009](../assumptions.md#a009--per-customer-customer_impact_multiplier-first-order-estimator))
and the customer-impact modifier in the adjustment framework.

## Validation

- Spot-check duration distribution: median ~1 h, p95 ~13 h, right-skewed.
- Reconcile against published utility after-action reports for known
  named events (Beryl 2024, Helene 2024).
- Compare catalog variants (30 / 45 / 60) for stability of priced cells.

## Known limitations

- Cross-FIPS merging is not done; a multi-county storm produces one event
  per affected county. This matches the v0 contract.
- Bridged-gap intervals do not get a `customers_out` value imputed; the
  `mean_customers` denominator is observed positive snapshots only, which
  can bias the mean upward on patchy-coverage events.
- 15-min resolution is the floor; events shorter than that are
  physically unrepresentable in this data.

## Implementation pointers

| Aspect | File |
|---|---|
| Algorithm | `price_engine/data/02_construct_events.py` |
| Algorithm spec | `price_engine/data/EVENT_CONSTRUCTION.md` |
| Schema | `price_engine/data/SCHEMA.md` |
| Multi-catalog build | `price_engine/catalogs/build_catalogs.py` |

## Cross-references

- [Data Ingestion Methodology](data_ingestion_methodology.md)
- [Aggregation and Annualization Methodology](../02_per_customer/aggregation_and_annualization_methodology.md)
- [Pricing Methodology](../cross_cutting/pricing_methodology.md)
- [Per-Customer Pricing Plan](../../plan/02_per_customer/per_customer_pricing_plan.md)
