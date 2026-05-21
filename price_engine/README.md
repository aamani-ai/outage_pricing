# Price Engine — v0 (Historical-Only Baseline)

This folder is the end-to-end pricing engine for parametric outage insurance, version zero.

The folder is intentionally named `price_engine/` rather than `price_engine/v0/`; v0 is the documented methodology version, not a path segment.

**What v0 is.** A defensible, historical-only premium for per-event indemnity contracts at the customer-county level, presented through an insurance-friendly dashboard with explicit modelability filtration.

**What v0 is not.** Not forward-looking. Not climate-adjusted. Not exposure-segmented beyond geography. No PRESTO. No simulation. No reinsurance treaty math. No portfolio aggregation. All of these are valid follow-ons but are explicitly out of scope.

The intent is to get a working price-per-(county, deductible) matrix on a dashboard, with an honest filter telling us where we should and should not sell, before adding any sophistication.

## Folder structure

```
price_engine/
├── README.md                      ← you are here
├── plan/                          ← planning docs (read these first)
│   ├── 00_scope_and_principles.md
│   ├── 01_geography_decision.md
│   ├── 02_pricing_math.md
│   ├── 03_filtration_framework.md
│   ├── 04_confidence_load_stub.md
│   ├── 05_dashboard_spec.md
│   ├── 06_data_pipeline.md
│   └── 07_build_sequence.md
├── data/
│   ├── INVENTORY.md               ← what data we use (single source: Figshare 24237376)
│   ├── EVENT_CONSTRUCTION.md      ← snapshots → events algorithm + 3 knobs
│   ├── 01_ingest.py               ← Figshare downloader
│   ├── 02_construct_events.py     ← writes events.parquet
│   ├── 03_aggregate_county.py     ← writes county_summary.parquet + county_durations.parquet
│   └── raw/                       ← Figshare files land here
├── filtration/
│   └── 04_filter.py               ← writes county_tiers.csv
├── pricing/
│   └── 05_price.py                ← writes county_premiums.csv + county_drilldown.json
├── catalogs/
│   ├── README.md                  ← generated catalog contract
│   └── build_catalogs.py          ← builds 30 / 45 / 60 minute catalogs
├── confidence/                    ← uncertainty load (deferred to v0.5)
├── dashboard/                     ← static web UI
├── run_all.sh                     ← run one canonical artifact set
└── run_catalogs.sh                ← build the dashboard-switchable catalogs
```

## How to run

```bash
bash price_engine/run_all.sh
```

Each stage is idempotent. Outputs land next to the script that writes them.
`run_all.sh` defaults to the `45 min` gap tolerance; override with
`GAP_TOLERANCE_MINUTES=30` or `GAP_TOLERANCE_MINUTES=60` when needed.

For internal threshold comparison, build catalog artifacts:

```bash
cd price_engine
bash run_catalogs.sh
```

The dashboard reads `catalogs/manifest.json` and can switch among the generated
`30 min`, `45 min`, and `60 min` EAGLE-I catalogs. Generated catalog data stays
local and gitignored.

Annualized rates use the raw source exposure window documented in
[`data/SCHEMA.md`](data/SCHEMA.md), not 12 calendar years and not county
first/last event dates.

## Start here

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — **the canonical entry doc.** Data source, pipeline diagram, event-construction algorithm, pricing math, and a real worked example (Alachua FL, T=4h, X=$500). Read this first.
- [`END_TO_END.md`](END_TO_END.md) — one-page map of how raw CSVs become the dashboard, what this session actually ran, what's stubbed.
- [`REFRESH.md`](REFRESH.md) — how to re-run locally with more disk to fill in the missing years, how to refresh when Figshare publishes new data, and the resource budget.

## Read this order

If you are catching up, read `plan/` files in numbered order. They are short and build on each other.

## Decisions locked in v0

| Question | Decision |
|---|---|
| Contract structure | Per-event indemnity at deductible `T` |
| Modeling unit | County (FIPS) |
| Quoting unit | County (FIPS) |
| Regulatory / sell/don't-sell unit | State |
| Historical only? | Yes — no forward-looking adjustments in v0 |
| Duration survival `S(T)` | Raw empirical count only: `events(duration >= T) / total events`; no fitted duration distribution in v0 |
| Filter | Tiered: Green / Amber / Red, based on **modelability**, not loss frequency |
| Confidence load | Interface specified in v0; implementation deferred to v0.5 |
| Data source | EAGLE-I raw snapshots from Figshare article 24237376. No PRESTO. |

## Cross-refs

- [`../docs/extra/outage_modeling_us/ideas/unified_outage_archive/learning/distributions_for_outage_durations.md`](../docs/extra/outage_modeling_us/ideas/unified_outage_archive/learning/distributions_for_outage_durations.md) — distribution-family primer for future v0.5+ work; v0 does not fit a duration distribution
- [`../docs/extra/outage_modeling_us/ideas/unified_outage_archive/external_tools/presto.md`](../docs/extra/outage_modeling_us/ideas/unified_outage_archive/external_tools/presto.md) — why we are not using PRESTO
- [`../docs/extra/outage_modeling_us/ideas/unified_outage_archive/pricing/panel_vs_event_log_for_pricing.md`](../docs/extra/outage_modeling_us/ideas/unified_outage_archive/pricing/panel_vs_event_log_for_pricing.md) — why the event log, not the panel, is the right input
