# Price Engine v0 — Architecture

The canonical entry doc for v0. Read this first. Everything else (`README.md`, `END_TO_END.md`, `REFRESH.md`, `plan/*`) drills into one piece of what's described here.

This document is grounded in the code and generated local artifacts. The dashboard now defaults to the `catalogs/eagle-i-45min/` artifact set, with `30 min` and `60 min` catalogs available for internal sensitivity review.

---

## TL;DR

v0 takes **raw EAGLE-I outage snapshots**, runs **our own event-construction algorithm** on them, derives a per-county empirical survival function, and turns that into a **per-(county, T, X) parametric premium grid** served by an interactive dashboard. No simulation, no parametric distribution fit, no climate adjustment, no PRESTO. Everything is historical and empirical.

```
EAGLE-I snapshots (Figshare/ORNL)
        │
        ▼
  our event-construction algorithm   ← we own this; not PNNL's merger
        │
        ▼
events.parquet  ──►  aggregate  ──►  filter (tiers)  ──►  price (T×X grid)  ──►  dashboard
```

---

## 1. Data source — what we use and what we don't

### Base data: EAGLE-I 15-minute snapshots

| Property | Value |
|---|---|
| Dataset | EAGLE-I Power Outage Data |
| Publisher | Oak Ridge National Laboratory (ORNL) |
| Distribution | Figshare article **24237376** |
| Granularity | one row per `(FIPS, 15-min timestamp)` where `customers_out > 0` |
| Coverage | 2014 – 2025, ~3,000 U.S. counties |
| Files we pull | `eaglei_outages_YYYY.csv` × 12, plus `MCC.csv`, `coverage_history.csv`, `DQI.csv` |

EAGLE-I polls public utility outage maps every 15 minutes and publishes the raw panel. **It does not publish events.** What you get looks like this:

```
fips   timestamp             customers_out   customers_tracked
12001  2024-09-26 03:00:00              28               139840
12001  2024-09-26 03:15:00            4912               139840
12001  2024-09-26 03:30:00           18204               139840
12001  2024-09-26 03:45:00           24881               139840
12001  2024-09-26 04:00:00           22107               139840
                ⋮                       ⋮                   ⋮
12001  2024-09-26 09:45:00            1140               139840
12001  2024-09-26 10:00:00              81               139840
            (no row at 10:15 because customers_out fell back to 0)
```

The snapshot is the raw signal. Everything else we derive from it.

### What we deliberately do NOT use

| Source | Why excluded from v0 |
|---|---|
| PNNL Event-Correlated Outage Dataset (`*_merged.csv`) | A derived event file with **undocumented-to-us** stitching rules. We define our own algorithm so we know exactly what's in `events.parquet`. PNNL stays as a future cross-validation comparator. |
| DOE OE-417 disturbance reports | Only catches the biggest events (≥ 50k customers · 1h, etc.). Useful as enrichment for major-storm labeling later; not a base layer. |
| NOAA Storm Events | Cause attribution, not outage measurement. Future enrichment. |
| EIA-861 annual SAIDI/SAIFI | Annual aggregates per utility — wrong granularity for event-level pricing. Will be used for back-validation in v0.5. |
| PRESTO | Forward-looking simulator; out of v0 scope by design. |

The framing: **raw EAGLE-I is the base. Everything else is enrichment or validation.**

---

## 2. The pipeline (five stages)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              v0 PIPELINE                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐                                                         │
│  │  Figshare API   │                                                         │
│  │  article 24237  │                                                         │
│  └────────┬────────┘                                                         │
│           │  HTTPS + MD5 verify                                              │
│           ▼                                                                  │
│  ┌─────────────────┐         01_ingest.py                                    │
│  │  data/raw/      │         pulls 12 yearly CSVs + MCC + DQI + coverage     │
│  │  eaglei_*.csv   │         idempotent, skips files already present         │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐         02_construct_events.py                          │
│  │  events.parquet │         OUR ALGORITHM (see §3)                          │
│  │  14,195,144 rows│         snapshots → discrete (start, end, duration)     │
│  └────────┬────────┘         partitioned by year                             │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐         03_aggregate_county.py                          │
│  │ county_summary  │         per-FIPS rollup:                                │
│  │ county_durations│           N_events, observation_years, N_per_year,      │
│  │ (parquet)       │           duration_p50/p95, MCC, DQI                    │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐         filtration/04_filter.py                         │
│  │ county_tiers.csv│         D1..D5 modelability gates → tier in             │
│  │ 3,090 rows      │         {green, amber, red} (worst-of-D rule)           │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐         pricing/05_price.py                             │
│  │ county_premiums │         for each FIPS × T × X:                          │
│  │ county_drill    │           λ(T) = N_per_year · S(T)                      │
│  │ (csv + json)    │           pure  = λ(T) · X                              │
│  └────────┬────────┘           retail = pure / (1 − ER − TM)                 │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │   dashboard/    │         static HTML + D3/Plot + MapLibre                │
│  │  index.html etc │         reads catalog manifest + selected artifacts     │
│  └─────────────────┘                                                         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

Each stage writes its output next to its script and is idempotent. `run_all.sh` chains one canonical artifact set. `run_catalogs.sh` builds dashboard-switchable catalog artifacts under `catalogs/`.

---

## 3. Event construction — the most opinionated stage

This is where snapshots become events. **It's our algorithm, not PNNL's.** Spec lives in `data/EVENT_CONSTRUCTION.md`; the three knobs are controlled by `02_construct_events.py`, including the catalog-specific `--gap-tolerance-minutes`.

### Algorithm in one sentence

Per FIPS, walk the FIPS's snapshots in time order; a new event starts when the gap to the previous snapshot exceeds `GAP_TOLERANCE`; close the previous event at the last snapshot before the gap.

### The three knobs

| Knob | v0 value | What it controls | What changes if you raise it |
|---|---|---|---|
| `THRESHOLD` | `customers_out > 0` | which snapshots count as "outage" | Higher → fewer events, but conflates existence with severity. v0 keeps it at 0 on purpose. |
| `GAP_TOLERANCE` | catalog-specific: 30 / 45 / 60 min | how big a missing-snapshot gap before we split into two events | Higher → fewer, longer events; over-merges genuine restorations. Lower → over-fragments storms with missed scrapes. |
| `MIN_DURATION` | 15 min (1 snapshot) | drop events below this duration | Higher → drops real short events, inflates S(T), over-prices every contract. v0 keeps it at the data's native resolution. |

### Why these choices (compressed)

- **`THRESHOLD = customers_out > 0`** — the contract triggers on *whether* an outage occurred in the county, not on how many customers it affected. Severity belongs in filtration (D-tiers), not event existence.
- **`GAP_TOLERANCE`** — exposed as catalogs. `30 min` bridges one missing intermediate snapshot, `45 min` bridges two, and `60 min` is retained as a sensitivity view. The current dashboard default is `45 min`.
- **`MIN_DURATION = 15 min`** — EAGLE-I's native resolution. A 15-min event is the shortest physically representable event. Dropping it would bias S(T) upward.

Full reasoning is in `data/EVENT_CONSTRUCTION.md`.

### What event construction actually does (visual)

```
customers_out
   │
   │            ┌──────┐
24k│            │      │
   │            │      │ ┌────┐
18k│            │      │ │    │
   │       ┌────┘      └─┘    │    ← single event (the 30-min gap is bridged)
12k│       │                  │      because GAP_TOLERANCE = 30 min
   │       │                  └──┐
 6k│       │                     │
   │   ┌───┘                     └──┐
 0 ├───┴─────────────────────────────┴───┐──────┬──┐──────────
   │   ▲                              ▲  ▲      ▲  ▲
   │   start (first row >0)           │  next snapshot row is 95 min later
   │                                  │  so a NEW event starts here
   │                                  end_time = last_row_ts + 15 min

   ── time, 15-min ticks ──►
```

### What `events.parquet` looks like

```
event_id              fips   state county   start_time            end_time              duration_hours  n_snapshots  min_customers  max_customers  mean_customers  year
12001_20240926T0315Z  12001  FL    Alachua  2024-09-26 03:15:00   2024-09-26 10:00:00            6.75           27              81          24881         13420.4  2024
12001_20240928T1430Z  12001  FL    Alachua  2024-09-28 14:30:00   2024-09-28 15:00:00            0.50            2             140            210           175.0  2024
...
```

### Run footprint (from `data/events_meta.json`)

| Metric | Value |
|---|---|
| Years actually run | 2014-2025 (12 of 12) |
| FIPS produced | 3,090 |
| Events produced | 14,195,144 |
| Duration p50 | 1.75 h |
| Duration p95 | 13.0 h |
| Duration max | 7,152.75 h |
| Wall time | 408.8 s |

This local run used the full public 2014-2025 release. The re-run procedure is in `REFRESH.md`.

---

## 4. Aggregation — per-county rollup

`03_aggregate_county.py` reads `events.parquet` and produces two artifacts:

- **`county_summary.parquet`** — one row per FIPS with `n_events_total`, `observation_years`, `n_per_year`, `duration_p50`, `duration_p95`, `MCC`, `DQI`.
- **`county_durations.parquet`** — every observed duration per FIPS, for downstream empirical S(T) computation.

`observation_years` is the raw source exposure window for the processed release.
For the current 2014-2025 release, that is about `11.167` years:
`2014-11-01 04:00 UTC` through `2026-01-01 00:00 UTC`.

This is deliberately **not** computed from a county's first and last observed
event. First/last event dates are event occurrence, not exposure. Using them as
the denominator would inflate rates for quiet counties whose first outage
happened late in the dataset. `event_span_years` and `coverage_history_years`
remain in `county_summary.parquet` as diagnostics only.

---

## 5. Filtration — modelability tiers, not loss tiers

`filtration/04_filter.py` assigns each FIPS a tier in `{green, amber, red}` based on **whether we can defensibly price it**, not how risky it is. The county's tier is the **worst** of five gates:

| Gate | Quantity | GREEN if | AMBER if | RED if |
|---|---|---|---|---|
| D1 — Volume | `n_events_total` | ≥ 200 | ≥ 50 | else |
| D2 — Events/year | `n_per_year` | ≥ 20 | ≥ 5 | else |
| D3 — Window | `observation_years` | ≥ 5 | ≥ 3 | else |
| D4 — Tail credibility | `duration_p95` | ≥ 4 h | ≥ 2 h | else |
| D5 — Data quality | `dqi` | ≥ 0.8 | ≥ 0.5 | else |

"Worst of" means a single RED gate red-tags the county. RED counties are **no-quote** in v0.

D1, D2, and D4 are county-event driven. D3 is now a source-window gate based on the raw EAGLE-I exposure window, and D5 is a FEMA-region source proxy. Separate launch-readiness dimensions — regulatory readiness, trigger evidence, underwriting appetite, and compliance operations — are useful roadmap dimensions, but they are intentionally not part of the v0 county tier.

### Current tier mix (default 45-minute catalog)

```
GREEN █████████░░░░░░░░░░░░░░░░░░░░░░  951  (30.8%)
AMBER ████████████████████░░░░░░░░░░░  2070 (67.0%)
RED   █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    69  (2.2%)
─────                                  ─────
                                       3,090
```

The Amber heaviness is no longer a coverage-window artifact: all counties pass D3 in the full run. Most Amber counties are currently capped by the implemented D5 DQI gate, so v0.5 should review DQI calibration before interpreting Amber as a sellability blocker.

---

## 6. Pricing — the math, end-to-end

The contract: **"If an outage in your FIPS lasts ≥ T hours, we pay you $X. Annual policy."**

### The chain (four numbers)

```
   N_per_year(FIPS)         S(T)                  λ(T)               Pure                Retail
       │                     │                     │                  │                    │
       │                     │                     │                  │                    │
       ▼                     ▼                     ▼                  ▼                    ▼
   total events    P(duration ≥ T | event)    expected qualifying   expected loss    loaded for expense
   ÷ obs years     in this FIPS               events per year       per policy-year  + margin
                   (empirical survival)
                                              = N_per_year · S(T)    = λ(T) · X       = Pure / (1 − ER − TM)
```

Two factors going in (frequency × survival), two outputs (pure premium, retail premium). That's the whole engine. Ten lines of code.

Important v0 assumption: `S(T)` is a raw empirical count, not a fitted distribution. We do **not** fit Lognormal, Weibull, Exponential, GPD, or any other duration family. For each county and threshold, the engine counts historical events with `duration_hours >= T` and divides by the county's total historical events.

### Default load assumptions (locked in v0)

| Parameter | Value | Configurable in dashboard? |
|---|---|---|
| Expense ratio (ER) | 0.20 | yes — slider 0–40% |
| Target margin (TM) | 0.15 | yes — slider 0–40% |
| Uncertainty load | $0 | no (slot reserved; deferred to v0.5) |
| Load denominator | 0.65 | derived: 1 − ER − TM |

### The standard `(T, X)` grid

```
                  X = $500    $1,000    $2,500    $5,000    $10,000
              ┌─────────┬─────────┬─────────┬─────────┬──────────┐
   T = 2h    │  cell   │  cell   │  cell   │  cell   │  cell    │   ← high frequency, expensive
              ├─────────┼─────────┼─────────┼─────────┼──────────┤
       4h    │  cell   │  cell   │  cell   │  cell   │  cell    │
              ├─────────┼─────────┼─────────┼─────────┼──────────┤
       8h    │  cell   │  cell   │  cell   │  cell   │  cell    │
              ├─────────┼─────────┼─────────┼─────────┼──────────┤
      12h    │  cell   │  cell   │  cell   │  cell   │  cell    │
              ├─────────┼─────────┼─────────┼─────────┼──────────┤
      24h    │  cell   │  cell   │  cell   │  cell   │  cell    │   ← catastrophic-only, cheap
              └─────────┴─────────┴─────────┴─────────┴──────────┘
                                  ↑
                            click any cell →
                       full drill-down (A·B·C·D panels)
```

5 × 5 = 25 cells per county × 3,090 counties = 77,250 priced cells per catalog in `county_premiums.csv`. The dashboard reads the selected catalog's `county_drilldown.json` for the full per-cell derivation chain.

### Worked example — Alachua County, FL (FIPS 12001)

Pulled directly from `pricing/county_drilldown.json` in the generated artifact set:

**Inputs from aggregation:**

```
n_events_total       = 11,789
observation_years    = 11.167       ← source exposure window, not first/last event dates
n_per_year           = 1,055.7
duration_p50         = 2.0 h
duration_p95         = 12.75 h
MCC                  = 218,548       ← modeled county customers
tier                 = AMBER
```

**Empirical survival at the standard T values:**

```
T (h)    S(T) = #events ≥ T / 11,789       λ(T) = 1,055.7 · S(T)
 2       0.5050  (5,954 events ≥ 2h)         533.2 /yr
 4       0.2909  (3,430 events ≥ 4h)         307.1 /yr
 8       0.1311  (1,546 events ≥ 8h)         138.4 /yr
12       0.0576    (679 events ≥ 12h)         60.8 /yr
24       0.0138    (163 events ≥ 24h)         14.6 /yr
```

**Pricing at T = 4 h, X = $500** (the cell from your earlier question):

```
λ(T = 4h)         = 1,055.7  ×  0.2909
                  = 307.1  qualifying events / year

Pure premium      = 307.1  ×  $500
                  = $153,574 / year

Retail premium    = $153,574 / (1 − 0.20 − 0.15)
                  = $153,574 / 0.65
                  = $236,268 / year
```

**Reading the full T-row at X = $500:**

```
T (h)    λ(T) /yr    Pure $/yr        Retail $/yr (ER=20%, TM=15%)
 2          533.2       266,583              410,128
 4          307.1       153,574              236,268
 8          138.4        69,220              106,493
12           60.8        30,401               46,771
24           14.6         7,298               11,228
```

Same county, same payout, just a stricter trigger → λ collapses, premium collapses with it. That T-axis collapse is the whole point: it lets a buyer pick the sensitivity that matches what they actually want to insure.

**Why this premium looks so big.** $236k/yr for a $500-per-event contract sounds wild — but at T=4h Alachua expects ~307 payouts per year. At T=24h it expects ~14.6 payouts and the contract drops to $11,228. The number isn't "expensive insurance"; it's "a near-certain payment schedule with a tiny per-event cap." Real pricing for an SMB customer would use T=8h or 12h.

---

## 7. What v0 is and is not

### v0 IS

- A defensible empirical premium per (FIPS, T, X), grounded in observed event durations.
- A modelability filter (Green/Amber/Red) that tells us where we should and shouldn't sell.
- An interactive dashboard with map view, premium matrix, and per-cell drill-down.
- Fully reproducible: `bash run_all.sh` rebuilds everything from raw CSVs; the local full 12-year event construction took about 6.8 minutes after download.

### v0 is NOT

- **Not forward-looking.** No climate trend, no PRESTO, no scenario simulation.
- **No fitted duration distribution.** `S(T)` is direct empirical counting: historical events with `duration_hours >= T` divided by all historical events in that county. No Lognormal, Weibull, Exponential, GPD, or simulation is used in v0.
- **No uncertainty load.** The slot is reserved in the math (`Retail = (Pure + UncLoad)/(1−ER−TM)`); the value is zero in v0. v0.5 fills it.
- **No back-validation against EIA-861 / utility after-action reports.** The reconciliation checks listed in `EVENT_CONSTRUCTION.md` §Validation are eyeballed for v0; formalized in v0.5.
- **No portfolio correlation.** If we write N policies in the same FIPS, all N trigger simultaneously on the same event. v0 prices each policy as if standalone. Customer-count fields (`min/max/mean_customers`) are preserved in events.parquet for v1 portfolio work.
- **Not regulator-ready.** The Amber-heavy DQI calibration, missing uncertainty load, and absence of formal validation all need to be addressed before a regulator would see this.

---

## 8. Where to read more

| Question | File |
|---|---|
| What does the whole pipeline do, step by step? | `END_TO_END.md` |
| How do I re-run this on the full 12-year dataset locally? | `REFRESH.md` |
| Why this contract structure, this geography unit, this filter shape? | `plan/00..07_*.md` (numbered, read in order) |
| Why these three event-construction knobs? | `data/EVENT_CONSTRUCTION.md` |
| Why no PRESTO, no panel, no DOE-417 as the base? | `docs/data_sources.md` at repo root |
| The math, in detail | `plan/02_pricing_math.md` |
| The filter, in detail | `plan/03_filtration_framework.md` |

---

*Last updated: when this file was committed. The numbers in §3, §5, and §6 reflect the most recent `run_all.sh` execution. Re-run and these tables refresh.*
