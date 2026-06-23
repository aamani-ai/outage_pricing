# Eventization And Frequency Contract Discussion

**Status:** discussion draft, not final methodology  
**Last reviewed:** 2026-06-20  
**Purpose:** define the questions we need to settle before tuning clustering,
source-quality rules, or final pricing methodology.

## Why This Needs Its Own Discussion

The largest modeling assumption is not the color label, the trend line, or the
shadow lambda factor. It is the upstream conversion:

```text
raw outage time series
  -> curated outage event
  -> annual qualifying frequency
  -> per-customer expected loss
```

If we change the eventization logic, the frequency number can move. If the
frequency number moves, then tiering, annual trend, predictability buckets,
shadow lambda, and zero-vs-missing rules all move with it.

This note is intentionally **before** formal methodology. It is a working
discussion artifact so we can be honest about the assumptions, decide which
ones are acceptable for v1, and identify where sensitivity tests are needed.

## The Core Flow

```text
                 RAW EAGLE-I SNAPSHOTS
        one row per (FIPS, 15-min timestamp), customers_out > 0
                              |
                              v
                 EVENTIZATION / EPISODE BUILD
        bridge adjacent positive snapshots within gap tolerance
        close event with start, end, duration, customer aggregates
                              |
                              v
                    COUNTY EVENT CATALOG
        one row per county-event, with duration_hours and customers_out stats
                              |
                 +------------+-------------+
                 |                          |
                 v                          v
       QUALIFYING FREQUENCY          CUSTOMER IMPACT
       count events with             estimate per-event fraction
       duration >= T                 of county customers affected
                 |                          |
                 +------------+-------------+
                              v
                    PER-CUSTOMER LAMBDA
             county event rate x customer impact adjustment
                              |
                              v
               PREMIUM / TIER / TREND / PREDICTABILITY
```

The important point: event count and customer impact are not independent
implementation details. They multiply into the final per-customer expected-loss
read.

## Current Implementation Snapshot

This is the current working contract, not the final answer.

| Layer | Current rule | Why it exists | Main open concern |
|---|---|---|---|
| Snapshot inclusion | `customers_out > 0` | Do not hide small real outages before duration filtering | A tiny-customer outage can create a county event; per-customer adjustment must carry the burden of down-weighting it |
| Continuity | Catalogs at 30 / 45 / 60 minute gap tolerance; dashboard default is 45 min | Avoid splitting one real outage because one or two 15-min scrapes were missed | Too strict can fragment events; too loose can merge separate events |
| Event duration | `end_time = last positive snapshot + 15 min` | Matches the 15-min snapshot interval | Duration is inferred from positive observations, not from customer-specific restoration |
| County unit | Events are county-scoped; no cross-county merging | Contract and pricing are county-addressable today | A single storm becomes many county-events, which is correct for county pricing but affects spatial correlation |
| Annualization | Count qualifying events over source exposure years | Empirical and transparent | Needs source-quality masking where whole county/state/year source gaps exist |
| Per-customer conversion | County event frequency is multiplied by customer-impact adjustment | Moves from county-event view toward insured-customer expected loss | Depends on assumptions about who is out and for how long inside each county event |

Implementation references:

- Event construction spec:
  [`../../../price_engine/data/EVENT_CONSTRUCTION.md`](../../../price_engine/data/EVENT_CONSTRUCTION.md)
- Event methodology:
  [`../../methodology/event_catalog_creation_methodology.md`](../../methodology/01_eventization/event_catalog_creation_methodology.md)
- Per-customer fundamentals:
  [`../../methodology/fundamentals/per_customer_pricing_fundamentals.md`](../../methodology/02_per_customer/per_customer_pricing_fundamentals.md)
- Assumptions registry:
  [`../../methodology/assumptions.md`](../../methodology/assumptions.md)

## External Practice Scan

**Research status:** public scan, June 2026. This is not a competitive claim
that we know another firm's private pricing method. It is a structured read of
what adjacent insurance, utility, outage-data, sensor, and catastrophe-modeling
sources publicly disclose.

The public evidence points to one consistent theme:

```text
industry practice does not skip event definition

raw signal / index / hazard record
        |
        v
defined event unit + trigger threshold + exposure mapping
        |
        v
frequency / loss / payout model
```

So our current concern is normal and important. The event unit and frequency
contract are not clerical pipeline details; they are part of the actuarial
method.

### 1. EAGLE-I / public outage research data

Public EAGLE-I materials describe the dataset as county-scale outage estimates
reported at 15-minute increments, built from public real-time outage
information. The Nature Scientific Data paper contrasts this with OE-417:
EAGLE-I is 15-minute, county-scale, and captures smaller outages; OE-417 is
event-based and focuses on large federally reported disturbances.

Implication for us:

```text
EAGLE-I is a snapshot source, not a ready-to-price event catalog.
```

That validates our need to own the eventization layer. It also means our event
rules must be named, versioned, and sensitivity-tested, because different
reasonable rules can produce different annual frequencies.

Source:
[`Nature Scientific Data - EAGLE-I county outage dataset`](https://www.nature.com/articles/s41597-024-03095-5).

### 2. Utility reliability reporting / EIA / IEEE-style metrics

Utility reliability practice usually centers on customer interruption indices,
not county episode counts. EIA-861 collects non-momentary interruption metrics
such as SAIDI and SAIFI where utilities report them. EIA also notes that many
utilities follow IEEE-style reporting in which SAIDI/SAIFI are based on
interruptions longer than five minutes, and that major-event treatment can vary.

Industry shape:

```text
utility reliability view
  interruption event
    -> interrupted customers
    -> interruption duration
    -> customer-minutes / customer interruptions
    -> SAIDI / SAIFI / CAIDI
```

Implication for us:

```text
Our move from county-event rate to per-customer rate is directionally aligned
with reliability practice, because the industry cares about customer
interruptions, not only event existence.
```

But our public EAGLE-I source does not give true customer-level restoration
paths, so our customer-impact adjustment is still an assumption layer. It should
be reviewed alongside eventization, not treated as a solved downstream detail.

Sources:
[`EIA-861 detailed data`](https://www.eia.gov/electricity/data/eia861/),
[`EIA SAIDI/SAIFI reporting overview`](https://www.eia.gov/todayinenergy/detail.php?id=37652).

### 3. Parametric insurance generally

Regulatory and supervisory references describe parametric insurance around a
predefined event parameter or index, a threshold, and a payout structure. IAIS
/ FSI emphasizes an objective index reported by an independent third party and
correlated with the insured loss. NAIC highlights basis risk and the need to
understand the policyholder exposure and select a parameter that fits it.

Industry shape:

```text
objective parameter/index
        |
        v
pre-agreed trigger threshold
        |
        v
fixed / proportional / tiered payout
```

Implication for us:

```text
The event/frequency contract has two jobs:
1. pricing: estimate expected trigger frequency;
2. product: describe the future trigger in a way that controls basis risk.
```

This supports keeping the pricing source and trigger source separate, but it
also means the bridge between them must be explicit. If the trigger source is
premise-level and the pricing source is county-level, the alignment factor is a
real modeling object, not a footnote.

Sources:
[`IAIS / FSI parametric insurance paper`](https://www.iais.org/uploads/2024/12/FSI-IAIS-Insights-on-parametric-insurance.pdf),
[`NAIC parametric disaster insurance`](https://content.naic.org/insurance-topics/parametric-disaster-insurance).

### 4. Catastrophe modeling / reinsurance analytics

Cat models make the event unit first-class. NAIC's catastrophe-modeling primer
describes event loss tables and year loss tables with simulated events and
associated losses, at resolutions ranging from aggregate geographies to
individual locations. Oasis LMF similarly assigns event losses into periods
such as years, then computes occurrence and aggregate exceedance outputs.

Industry shape:

```text
event catalog
  -> event occurrence in a period/year
  -> event impact by exposure/location
  -> annual loss / occurrence loss / aggregate loss
```

Implication for us:

```text
Our outage event catalog is the outage analog of a cat-model event set.
```

That argues for:

- stable event IDs and event-construction versioning;
- catalog sensitivity runs, not a single hidden preprocessing choice;
- explicit period/year assignment;
- separate outputs for event frequency, exposure impact, and annual loss.

Sources:
[`NAIC catastrophe modeling primer`](https://content.naic.org/sites/default/files/committees-pending-action-cat-mod-primer.pdf),
[`Oasis LMF results documentation`](https://oasislmf.github.io/sections/results.html).

### 5. Outage-specific parametric product: Adaptive / Ting

Adaptive publicly describes GridProtect as power-outage parametric insurance
with automatic triggers and rapid payouts. Whisker Labs states that Adaptive
uses Ting Insights outage and restoration data to verify outages in real time.
The public materials do not disclose Adaptive's rating method or whether
sensor history is used for pricing, trigger verification, or both.

Publicly visible shape:

```text
Ting real-time outage/restoration signal
        |
        v
Adaptive GridProtect trigger verification
        |
        v
rapid parametric payout
```

Implication for us:

```text
The only visible outage-parametric example separates live verification from
publicly disclosed pricing.
```

We should assume advisors will ask the same question of us: does the event
source price the risk, trigger the claim, or both? Our answer should stay
clean:

```text
EAGLE-I = historical pricing baseline
Ting / PoUS / utility / AMI = possible live trigger or validation source
bridge = measured alignment between the two
```

Sources:
[`Adaptive`](https://www.adaptiveinsurance.com/),
[`Whisker Labs Ting Insights`](https://www.whiskerlabs.com/ting-insights/).

### 6. Adjacent parametric downtime: Parametrix

Parametrix publicly states that its monitoring system detects performance
issues and triggers cloud outage events. This is a close analogy even though
the peril is cloud downtime rather than power outage.

Industry shape:

```text
monitoring system
    -> service failure / downtime event
    -> pre-agreed waiting period / threshold
    -> payout
```

Implication for us:

```text
For downtime-style parametric products, the monitoring/event-detection system
is part of the product architecture, not an afterthought.
```

That supports treating our outage eventization and live-trigger event
definition as product-critical artifacts.

Source:
[`Parametrix cloud outage insurance`](https://www.parametrixinsurance.com/solutions-cloud).

### 7. PowerOutage.com / utility-map aggregators

PowerOutage.com offers live outage data, GeoJSON outage shapes from utility
providers, CSV reporting, and historical data with city-level granularity and
time intervals as frequent as 10 minutes. This is a live/high-frequency outage
intelligence product, not a public actuarial pricing method.

Implication for us:

```text
Aggregator feeds can improve trigger, validation, and source-quality review,
but duration and event boundaries still need explicit rules.
```

If an API emits live shapes every 10 minutes, we still need to define:

- when an outage event starts;
- when it ends;
- whether adjacent shapes are the same outage;
- how an address is assigned to the shape;
- what happens if the utility map goes stale or drops a shape.

Source:
[`PowerOutage.com products`](https://poweroutage.com/products).

### 8. Utility / AMI / Green Button / ODIN

Green Button Connect My Data supports customer-authorized sharing of utility
interval usage and billing data, with intervals potentially including 1-minute,
15-minute, hourly, daily, or monthly data depending on the utility. ODIN is a
DOE/ORNL effort to standardize near-real-time outage data exchange; its public
dataset is currently county-level.

Industry shape:

```text
customer-authorized meter/utility data  -> local truth, utility-by-utility
standardized ODIN county outage feed     -> national standardization direction
```

Implication for us:

```text
Premise/meter data is the cleanest trigger/exposure truth where available,
but it is not yet a national historical pricing source.
```

ODIN also reinforces that standard outage data exchange is moving toward
structured near-real-time feeds. That is positive for future trigger alignment,
but county-level ODIN does not remove our need for per-location basis handling.

Sources:
[`Green Button Connect My Data`](https://www.greenbuttondata.org/cmd.html),
[`ODIN real-time outages county dataset`](https://ornl.opendatasoft.com/explore/dataset/odin-real-time-outages-county/api/).

## External Scan Takeaways For Our Method

| External practice | What it teaches us | What we should do |
|---|---|---|
| EAGLE-I is snapshot/county data | Event construction is our responsibility | Version eventization and run sensitivity |
| Utility reliability uses customer-interruption metrics | Per-customer conversion is directionally correct | Keep testing mean/max/customer-impact assumptions |
| Parametric products depend on objective triggers | Basis risk is central | Keep pricing source, trigger source, and bridge separate |
| Cat models use event catalogs and year/period assignment | Event unit is a first-class actuarial object | Treat outage events like a priced event catalog |
| Adaptive/Ting uses real-time outage/restoration data | Live trigger verification can differ from pricing | Do not imply EAGLE-I is the live trigger |
| Parametrix uses monitoring-driven downtime events | Monitoring/event detection is product architecture | Make outage event detection explicit and auditable |
| PowerOutage/ODIN provide live or near-real-time feeds | Feeds still require start/end/grouping rules | Use them for validation and bridge, not blind replacement |

The practical conclusion:

```text
We are not overthinking this.
The industry pattern says event definition, exposure mapping, source quality,
and trigger alignment are core methodology decisions.
```

## The Eventization Contract

The team should be able to answer this in one sentence:

```text
What is one outage event in this model?
```

Current answer:

```text
One county-level contiguous run of positive EAGLE-I outage snapshots,
where adjacent positive snapshots are allowed to bridge a catalog-specific
gap tolerance, and duration is measured from first positive snapshot to
last positive snapshot plus one 15-minute interval.
```

That is defensible, but it has consequences.

### ASCII Shape: Split vs Merge

```text
15-min snapshots for one county

true outage:     [======================== 6 hours ========================]

observed rows:   + + + + + . . + + + + + + + + + + + + + + + + +
                 |       |     gap       |                         |

strict gap rule:
                 [event A]     gap       [event B]

looser bridge:
                 [================ one event = 6 hours ================]
```

If the strict rule splits one real six-hour event into two three-hour events:

| Threshold | Directional bias |
|---|---|
| `T=2h` | May overcount qualifying events: one event becomes two |
| `T=4h` | May undercount: two three-hour fragments fail 4h |
| `T=8h` | Usually still zero either way |

If the loose rule merges two separate events:

| Threshold | Directional bias |
|---|---|
| `T=2h` | May undercount event count but inflate duration |
| `T=4h` / `8h` / `12h` | Can create false long-duration qualifying events |

This is why the gap tolerance is not a harmless preprocessing knob. It changes
frequency differently by threshold.

## The Frequency Contract

The team should also answer:

```text
What does lambda mean?
```

There are two related but different meanings:

| Quantity | Plain meaning | Current role |
|---|---|---|
| `lambda_county(T)` | County-level qualifying outage episodes per year | Historical baseline event rate |
| `lambda_customer(T)` | Expected qualifying outage experience for a representative insured customer | Headline per-customer price basis |

The per-customer layer was a major correction because a county event is not the
same thing as a customer event:

```text
county outage event != every customer in the county was out for T hours
```

But the per-customer layer does not eliminate the eventization assumption. It
depends on it:

```text
lambda_customer(T)
  = eventized_county_frequency(T)
    x estimated_customer_impact_per_event(T)
```

So if eventized county frequency changes, per-customer pricing changes even if
the customer-impact multiplier is unchanged.

## Threshold-Specific Confidence

Confidence is not monotonic with the number of events.

| Threshold | Usually has more data? | Usually cleaner insurance meaning? | Main concern |
|---|---:|---:|---|
| `2h` | High | Lower | Sensitive to short interruptions, event fragmentation, telemetry cadence |
| `4h` | Medium/high | Medium | Still sensitive to gap tolerance and outage splitting |
| `8h` | Medium | High | Cleaner product signal, but fewer observations |
| `12h` | Lower | High | Strong economic meaning, but sparse and source-gap sensitive |
| `24h` | Low | Very high | Often hazard/event dominated; not enough county-year samples for simple trend alone |

This gives us a useful framing:

```text
lower T = more statistical volume, weaker event-definition confidence
higher T = stronger insurance meaning, weaker sample-size confidence
```

That is the nuance we should communicate. More observations at 2h/4h do not
automatically mean more reliable pricing. Fewer observations at 8h/12h do not
automatically mean worse pricing; the event definition may be cleaner.

### Initial Target-Market Read: Let Duration Do Confidence Work

This is the underwriter-facing version of the same point. Our first target
group should probably lean toward products where the trigger duration `D` must
clear a meaningful threshold:

```text
D >= T
```

Higher `T` does two useful things at once:

1. It makes the product easier to explain: a long outage is economically
   meaningful to the insured.
2. It reduces dependence on the noisiest parts of the feed: brief scrape
   glitches, momentary interruptions, and small split/merge choices matter less
   when the contract waits for a sustained outage.

That does **not** mean higher `T` is automatically more statistically stable.
The sample gets thinner as `T` rises, and source gaps matter more when events
are rare. The framing is:

```text
lower T = more volume, more eventization noise
higher T = cleaner insured event, less volume
```

So the initial underwriting message should not be "higher duration is always
more accurate." It should be:

```text
We have higher confidence explaining and defending the event definition at
longer outage durations. For shorter durations, we can still price, but the
eventization sensitivity and source-quality checks need more weight.
```

## Bias Directions To Discuss

| Assumption or artifact | Can make frequency too high | Can make frequency too low |
|---|---|---|
| Gap tolerance too strict | Low-threshold events can be split into multiple qualifying events | High-threshold events can be broken below T |
| Gap tolerance too loose | Separate interruptions can become one false long event | Low-threshold event count can be merged downward |
| `customers_out > 0` inclusion | Tiny localized outages count as county events | Not usually; the concern is more about customer-impact correction |
| Mean customer impact | If affected customers rotate but mean is treated too broadly | If one customer cluster is repeatedly affected and mean hides concentration |
| Max customer impact sensitivity | Conservative upper read | Can overstate representative-customer risk if used as headline |
| Missing source year treated as zero | Can manufacture fake improving history after a missing early high year | More commonly creates fake worsening / step-change-up from missing early quiet years |
| Real observed zero treated as missing | Removes true quiet evidence and can overstate frequency | Can also suppress real stability evidence |

This table is the reason the zero/missing rule cannot be an afterthought.

## Observed Zero vs Missing Year

The immediate issue from the dashboard is:

```text
When does a zero mean "no qualifying events"?
When does a zero mean "we did not observe the source properly"?
```

Recommended working distinction:

```text
observed zero
  = the county/year has reliable source observation,
    but no event crossed threshold T

missing year
  = source/geography coverage is not reliable enough to interpret absence
    as zero
```

### Practical Example

For a county-year:

```text
all-duration events > 0
T>=8h events       = 0
```

Interpretation:

```text
real observed zero at T=8h
```

The county had outage observations, just no long-duration qualifying event.

But if:

```text
all-duration events = 0
T>=8h events        = 0
```

Interpretation depends on source quality. If many counties in the same
state/year also have no all-duration events, it is likely a source artifact,
not a quiet year.

### Current Diagnostic From 45-Minute Catalog, T=8h

This is not a final rule; it is the reason we need a source-quality review.

| Diagnostic | Value |
|---|---:|
| Counties in dashboard trend view | 3,090 |
| Counties with full 11-year observed trend window under current mask | 2,489 |
| Counties with at least one interior observed year that has no all-duration source event | 216 |
| Total such county-years | 279 |
| Texas counties with no all-duration source event in 2016 | 135 / 254 |

Texas 2016 is the clearest warning sign. For a county like Concho, TX
(`48095`), 2016 has no all-duration source events, while 2015 and 2017 do have
source events. That should probably be reviewed as a source-quality gap, not
automatically treated as a true observed zero.

## Candidate Source-Quality Policies

We should compare policies before changing production artifacts again.

| Policy | Rule | Pros | Cons |
|---|---|---|---|
| A. Current positive-window rule | Years between first and last positive source year are observed, unless known partial geography issue | Simple; avoids treating leading/trailing absent years as zero | Interior source gaps can still be treated as observed zeros |
| B. County all-duration evidence rule | A county-year must have at least one all-duration event to be observed for threshold-specific zeros | Conservative for source quality | Too strict; truly quiet small counties may become missing |
| C. State/year abnormal-gap rule | A county all-duration zero becomes missing only when state/year no-source rate is abnormal | Balances real quiet years vs broad source gaps | Requires selecting abnormality threshold and documenting it |
| D. Known gap calendar | Maintain explicit source-gap calendar by state/year/vendor/geography | Most explainable when known gaps exist | Needs manual research and updates |

My recommended discussion starting point:

```text
Use Policy C + D for annual trend / predictability.
Keep Policy A as a baseline sensitivity.
Do not use Policy B alone; it is too aggressive for rural quiet counties.
```

## What We Need To Validate Before Locking

### 1. Gap-Tolerance Sensitivity

For each catalog (`30`, `45`, `60` minutes), compare:

| Output | Why |
|---|---|
| qualifying event counts by T | shows threshold sensitivity |
| county lambda movement | shows pricing impact |
| rank/tier movement | shows underwriting impact |
| named county examples | catches absurd merges/splits |

Important visual:

```text
same county, same raw time series
        |
        +--> 30 min catalog --> lambda_30(T)
        +--> 45 min catalog --> lambda_45(T)
        +--> 60 min catalog --> lambda_60(T)
```

If a county changes dramatically between catalogs, its eventization confidence
should be lower.

> **Executed (2026-06-22):** the national gap-tolerance sensitivity is measured in
> [`04_duration_conservatism.md`](04_duration_conservatism.md) — the full 30→60 range moves λ
> only −3% (2h) to +10% (long T): a bounded ~10% lever, in the conservative direction. The
> per-county movement (`C_evt`) feeds the [cell read](../../methodology/02_per_customer/cell_read_fundamentals.md);
> turning it into a per-county "is the trigger event genuine vs a thin-tail artifact?" decision
> is planned (gated) in [`per_county_trigger_validity_plan.md`](../../plan/cross_cutting/per_county_trigger_validity_plan.md).

### 2. Source-Quality Calendar

Produce a state/year matrix:

```text
state x year -> share of counties with zero all-duration source events
```

Flag abnormal cells, for example:

```text
Texas 2016: 135 / 254 counties have zero all-duration source events
```

This is where the zero/missing policy should come from, not from individual
county charts alone.

### 3. Per-Customer Exposure Sensitivity

For selected counties and thresholds, compare:

| Read | Purpose |
|---|---|
| county event lambda | raw episode frequency |
| mean customer-impact lambda | current headline per-customer basis |
| max customer-impact lambda | conservative sensitivity |
| lower-duration source activity | checks whether threshold zero is real |

This should answer:

```text
Are we conservative or aggressive after moving from county event to
per-customer expected loss?
```

### 4. Threshold Reliability Ranking

For each threshold, score:

| Dimension | Example metric |
|---|---|
| sample volume | number of qualifying events |
| source completeness | observed year count / missing year count |
| eventization sensitivity | movement across 30/45/60 catalogs |
| economic relevance | review judgment; 8h/12h likely stronger than 2h |
| clustering stability | label movement under source-quality policies |

This lets us say:

```text
T=8h may be economically cleaner than T=2h, even with fewer samples.
```

## Decision Questions For The Team

These should be answered before final methodology language.

| Question | Why it matters |
|---|---|
| What exact event unit do we want to defend externally? | Everything downstream depends on the event unit |
| Is `customers_out > 0` still the right inclusion threshold? | Controls whether tiny county events enter the catalog |
| Is 45-minute gap tolerance still the default after sensitivity review? | Controls split/merge bias |
| Should annual trend use a stricter source-quality mask than pricing aggregation? | Trend/clustering is more sensitive to fake zeros than full-history lambda |
| How should state/year source gaps be detected? | Determines null vs observed zero |
| How do we communicate per-customer conservatism by threshold? | Chris/team questions will focus here |
| Which outputs are production price inputs vs shadow diagnostics? | Prevents accidental overclaiming |

## Proposed Next Artifact

Create an analysis pack before changing the classifier again:

```text
curated_outage_data/outputs/eventization_frequency_review/
  state_year_source_quality.csv
  gap_tolerance_sensitivity_by_county_T.csv
  zero_vs_missing_candidate_changes.csv
  named_county_review_examples.md
```

The review examples should include:

| Example | Why |
|---|---|
| Concho, TX (`48095`) | interior all-duration zero in Texas 2016 |
| Harney, OR (`41025`) | leading missing years vs true observed zero |
| CT legacy counties | 2025 geography transition |
| A high-volume urban county | check that source-quality rule does not over-null real years |
| A sparse rural county | check that true quiet years are not all erased |

## Suggested Sequencing

```text
1. Eventization / frequency contract discussion
2. Source-quality zero/missing policy
3. Rebuild annual series with selected policy
4. Re-run risk-pattern classifier
5. Tune clustering thresholds
6. Only then harden methodology docs
```

The main principle:

```text
Do not tune the clustering rules until the annual series means what we think it means.
```
