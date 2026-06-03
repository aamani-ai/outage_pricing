# EAGLE-I Outage Data — Fundamentals

*Audience: senior team. Length: ~1.5 pages. Last reviewed: 2026-06-03.*

## What the data is, in one paragraph

EAGLE-I is the **only public, national, multi-year record of US electric power outages** at the county level. It is published by Oak Ridge National Laboratory (ORNL) and covers **2014 through 2025**, with one observation every **15 minutes** for every reporting county in the United States — roughly **3,090 counties**. Each observation records how many electric utility customers were without power at that moment. **A "customer" is what the reporting utility itself reports to EIA — most typically an electric meter, sometimes a building or a facility, depending on each utility's reporting convention** (see MCC section below). The dataset is built by scraping public utility outage maps every 15 minutes and aggregating to county boundaries. Source: [ORNL OpenEnergy Hub — EAGLE-I 2014–2025](https://openenergyhub.ornl.gov/explore/dataset/eaglei_outages_2014/); methodology described in [Brelsford et al., Nature Scientific Data 2024](https://www.nature.com/articles/s41597-024-03095-5). The full dataset is ~250 GB uncompressed across 12 yearly files.

## What one row looks like

EAGLE-I delivers **two tables that must be joined**. The first is the outage snapshot table — one row per county per 15 minutes:

| fips_code | county   | state | customers_out | run_start_time         |
|-----------|----------|-------|---------------|------------------------|
| 24001     | Allegany | MD    | 0             | 2024-03-15 14:00:00 UTC |
| 24001     | Allegany | MD    | 1,847         | 2024-03-15 14:15:00 UTC |
| 24001     | Allegany | MD    | 2,103         | 2024-03-15 14:30:00 UTC |

- **fips_code** — 5-digit county FIPS code (state + county). This is the only spatial key.
- **county / state** — human-readable county name and 2-letter state code.
- **customers_out** — number of utility-defined "customers" without power **at this instant** (most typically meters; see MCC section for how the unit varies by utility). *Not* a count of unique customers across the whole event — see caveats.
- **run_start_time** — UTC timestamp of the 15-minute snapshot. The scraper runs every :00, :15, :30, :45.

The second table is the **MCC reference table** — one row per county, constant over time:

| County_FIPS | County   | State | customers |
|-------------|----------|-------|-----------|
| 24001       | Allegany | MD    | 36,420    |
| 12001       | Alachua  | FL    | 145,830   |

- **customers** — the **MCC** (Modeled County Customers): the modeled total number of electric utility customers in the county. Used as the denominator for "% of county affected" calculations.

## What MCC actually means (read carefully)

**MCC stands for Modeled County Customers**, published by ORNL as the [Modeled County Customers 2023 release](https://openenergyhub.ornl.gov/explore/dataset/modeled-county-customers-2023/). Its derivation is documented in the canonical EAGLE-I paper, [Brelsford et al. (Nature Scientific Data, 2024)](https://www.nature.com/articles/s41597-024-03095-5).

It is *modeled*, not observed, because there is no public registry of "how many customer accounts does each utility have, broken down by county" in the United States. EIA Form 861 reports customer counts by **utility**, not by county. ORNL therefore allocates each utility's total customer count to counties **spatially**, using three inputs:

1. **EIA-861** — annual utility-level total customer counts (the numerator the utility filed with the EIA).
2. **LandScan USA** — high-resolution day+night population grids (the weighting fabric).
3. **HIFLD electric retail service territories** — the polygon boundaries of each utility's service area (the slicing).

The allocation formula, for utility *u* and county *i*:

```
c_{u,i} = p_{u,i} × (C_u / P_u)

MCC(i) = Σ over utilities u of c_{u,i}
```

where `C_u` is the utility's total customers, `P_u` is its service-area population, and `p_{u,i}` is the LandScan population of county *i* lying inside utility *u*'s territory. Each utility's customer total is allocated to counties proportional to the population it contains, then summed across all utilities touching the county.

**Important — the "customer" unit is not uniform across utilities.** Per Brelsford et al. verbatim:

> Utilities define "customers" in a range of different ways, most typically the electric meter, a building, or a facility.

So a "customer" in MCC (and in EAGLE-I's `customers_out`) is **most often** a meter — but for some utilities it is a building, and for others a facility. This adds a layer of noise to any per-customer ratio: counties served by per-meter reporters are not perfectly comparable to counties served by per-building reporters. The ratio `customers_out / MCC` is **internally consistent within each utility's territory** because both numerator and denominator use the same source convention, but cross-utility and cross-county comparisons carry an additional unit-noise term.

The MCC release is a **static 2023 model output** — it does not update as populations or utility territories shift. So `customers_out / MCC` is an **approximation of percent-of-county affected**, not an exact measure, with three sources of error: (a) growth-drift since 2023, (b) population-weighted-allocation error inside large or non-uniform utility territories, and (c) the non-uniform-customer-unit noise above. This is documented as assumption [A008](../assumptions.md).

## How to read it (ASCII picture of one event)

A single county outage from raw 15-minute snapshots looks like this:

```
  customers_out
   2,500 |              ● ● ●
   2,000 |           ●         ●
   1,500 |        ●               ●
   1,000 |     ●                     ●
     500 |  ●                           ●
       0 |● ●                              ● ● ● ●
         └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──→ time (UTC)
          14:00       14:30       15:00       15:30
          ←─────── one outage event, ≈75 min ───────→
```

Each dot is one row in the snapshot table. The event "starts" when `customers_out` first exceeds zero and "ends" when it returns to zero (or below a chosen restoration threshold). Duration is the difference between those two timestamps. **There is no explicit event_id in the raw data** — events are constructed downstream by us (see [`event_catalog.md`](../event_catalog.md)).

## Caveats — what senior team should know before relying on this

1. **15-minute cadence is the floor of resolution.** Any outage shorter than 15 minutes is likely invisible. Sub-15-minute restoration of large customer counts also won't appear smoothly.
2. **`customers_out` is a snapshot, not a unique-customer count.** If the same customer goes out, restores, and goes out again within an event, they are counted twice in different snapshots. Conversely, the *peak* `customers_out` undercounts unique customers when restoration overlaps with new outages.
3. **Restoration is inferred, not observed.** A drop in `customers_out` is the only signal that customers came back online — utilities do not directly publish per-customer restoration timestamps.
4. **County is the only spatial unit.** No premise, no ZIP, no circuit, no substation. A county is much larger than a typical insured site, so county-level outage data has **basis risk** at the individual-premise level. *(This is the gap our per-customer adjustment closes — see [`per_customer_view_walkthrough.md`](../per_customer_view_walkthrough.md).)*
5. **MCC is modeled and 2023-vintage.** % affected calculations carry this uncertainty silently. Rural counties with population shifts or unusual co-op/IOU mixes have the largest MCC error bars.
6. **Coverage varies by state and utility.** Counties whose utilities do not publish a public outage map have no observations. Texas (ERCOT-territory utilities) and parts of the rural west are weakest. See coverage map on the dashboard.
7. **No cause attribution.** Storm, equipment failure, PSPS, scheduled maintenance, vehicle accidents — all look identical in raw data. Cause-of-outage requires joining external sources (NOAA Storm Events, utility press releases).
8. **Missing samples happen.** Scrapers fail, utility maps go offline, ORNL pipeline has gaps. Our event catalog applies gap-merge rules (30 / 45 / 60 minutes) to stitch fragmented events; the choice of rule is a documented assumption ([A005](../assumptions.md)).

## Why we use it anyway

Despite the caveats, EAGLE-I is the only dataset that allows **national, multi-year, defensible empirical rate estimation** for power outages. The caveats are *knowable* — we model around them with explicit, citable assumptions rather than working with an opaque vendor feed. Every modeled adjustment we layer on top (event catalog stitching, per-customer rate, future basis-risk bridges) is recorded in [`assumptions.md`](../assumptions.md) with a stable ID.

## One-line takeaways

- **It's a county-level, 15-minute, 12-year US outage snapshot — the only one of its kind.**
- **`customers_out` is an instant count, not a cumulative count of unique customers affected.**
- **MCC is a modeled denominator, not a census.**
- **Everything we layer on top is to bridge knowable gaps in this dataset, not to replace it.**

## References

- Brelsford, C., Tennille, S., Myers, A. et al. *A dataset of recorded electricity outages by United States county 2014–2022*. Sci Data 11, 308 (2024). [doi:10.1038/s41597-024-03095-5](https://doi.org/10.1038/s41597-024-03095-5) — canonical EAGLE-I paper; the MCC derivation methodology lives in §Methods of this paper.
- ORNL OpenEnergy Hub: [Modeled County Customers 2023](https://openenergyhub.ornl.gov/explore/dataset/modeled-county-customers-2023/) — the MCC dataset release used in this project (`MCC.csv` in `price_engine/data/raw/`).
- EAGLE-I dataset DOI: [Figshare 24237376](https://doi.org/10.6084/m9.figshare.24237376)
- LandScan USA (input to MCC allocation): [ORNL LandScan](https://landscan.ornl.gov/) — day+night population grids.
- HIFLD electric retail service territories (input to MCC allocation): [HIFLD Open Data](https://hifld-geoplatform.opendata.arcgis.com/datasets/electric-retail-service-territories).
- EIA Form 861 (input to MCC allocation): [EIA-861 detailed data files](https://www.eia.gov/electricity/data/eia861/).
- Per-customer rate methodology: [`per_customer_view_walkthrough.md`](../per_customer_view_walkthrough.md)
- Assumptions registry: [`assumptions.md`](../assumptions.md) — MCC is [A008](../assumptions.md)
