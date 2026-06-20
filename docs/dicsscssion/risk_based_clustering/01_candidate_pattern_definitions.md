# Candidate Pattern Definitions

**Status:** discussion draft  
**Last reviewed:** 2026-06-20  
**Purpose:** define the candidate historical-outage shapes before tuning statistical thresholds

This note is deliberately intuitive. The goal is to decide whether the pattern
families are truly distinct enough to keep before we refine the quantitative
rules. The sketches show annual qualifying event counts for one county and one
threshold after missing years have been handled correctly.

```text
year index:  1  2  3  4  5  6  7  8  9 10 11
```

## First Decision: Observed History Or Not

Before choosing any pattern, separate observed years from missing/partial years.

```text
observed zero = real observed county-year with no qualifying event at T
missing year  = no reliable source/geography observation; not a zero
```

If the observed history is too short or too thin, the right label is **sparse**,
not stable, step-change, or improving/worsening.

## Candidate Families

### 1. Smooth Trend

Plain meaning: the county is moving in a consistent direction, and the annual
points stay close enough to a simple line that the line is a useful summary.

Shape:

```text
events
 50 |                         *
 40 |                    *  *
 30 |              *  *
 20 |        *  *
 10 |  *  *
    +--------------------------------
       1  2  3  4  5  6  7  8  9 10 11
```

Statistical intuition:

- directional slope / `t_stat`;
- low residual CV;
- few residual-band outliers;
- no one-year dominance.

Pricing/routing intuition: this is the cleanest case for a shadow frequency
read because the historical shape itself supports a simple direction.

### 2. Volatile Trend

Plain meaning: the county is still directional, but annual counts swing around
the line enough that the direction should be read with caution.

Shape:

```text
events
 70 |                    *        *
 55 |        *                 *
 40 |              *     *
 25 |  *                 *
 10 |     *
    +--------------------------------
       1  2  3  4  5  6  7  8  9 10 11
```

Statistical intuition:

- directional slope / `t_stat` exists;
- residual CV is high, `r_squared` is weak, or multiple residual outliers exist;
- not dominated by only one or two years.

Difference from spikiness: volatile trend has repeated noise around a direction.
Spikiness has one or two years that dominate the history.

Pricing/routing intuition: this can still inform a shadow frequency read, but
it needs uncertainty/load review or a lower-confidence handoff.

### 3. Episodic / Spiky

Plain meaning: one storm/event year, or two event years, explain too much of the
county history. The annual line is usually the wrong main summary.

Shape:

```text
events
 90 |                 *
 70 |
 50 |
 30 |                          *
 10 |  *  *  *  *  *  *  *  *     *  *
    +--------------------------------
       1  2  3  4  5  6  7  8  9 10 11
```

Statistical intuition:

- high `peak_share_total` or `top2_share_total`;
- one or two years can dominate even if the fitted slope is nonzero;
- residual outlier count may be high, but dominance is the deciding feature.

Difference from volatile trend: volatile trend has many uneven years; episodic
history is concentrated in one or two unusually large years.

Pricing/routing intuition: route toward hazard/weather context first. Do not
let a single storm year automatically become a direct lambda trend.

### 4. Step-Change

Plain meaning: the county appears to move from one level to another and then
stays near the new level. This is a regime shift, not a gradual line.

Shape:

```text
events
 80 |                 *  *  *  *  *
 60 |              *
 40 |
 20 |  *  *  *  *
  0 |
    +--------------------------------
       1  2  3  4  5  6  7  8  9 10 11
```

Statistical intuition:

- require observed support on both sides of the split;
- compare pre/post means;
- require a piecewise level model to beat a single linear fit;
- do not infer a step-change from missing early years.

Difference from smooth trend: smooth trend changes gradually. Step-change has
two relatively stable regimes with a transition between them.

Pricing/routing intuition: this may imply recency/regime review. If the shift
is real, the full-period average may be less appropriate than a guarded recent
regime read.

### 5. Stable Regular

Plain meaning: there is no reliable direction, and year-to-year variation is
low enough that the historical average is a reasonable summary.

Shape:

```text
events
 45 |
 35 |     *     *        *     *
 25 |  *     *     *  *     *     *
 15 |
  5 |
    +--------------------------------
       1  2  3  4  5  6  7  8  9 10 11
```

Statistical intuition:

- non-directional `t_stat`;
- low residual CV / low annual CV;
- few outliers;
- no dominance.

Pricing/routing intuition: keep the historical frequency baseline unless other
layers, such as location basis or hazard/grid, create a separate reason to move.

### 6. Stable Noisy

Plain meaning: there is no reliable up/down direction, but annual counts swing
too much for the average to feel clean.

Shape:

```text
events
 70 |        *              *
 55 |
 40 |  *           *              *
 25 |     *     *        *
 10 |                 *        *
    +--------------------------------
       1  2  3  4  5  6  7  8  9 10 11
```

Statistical intuition:

- non-directional `t_stat`;
- residual CV / annual CV is high;
- outliers may exist, but no single-year dominance strong enough for episodic.

Difference from volatile trend: volatile trend has a direction plus noise.
Stable noisy has noise without a reliable direction.

Pricing/routing intuition: keep the frequency baseline, but consider
uncertainty/load review. The problem is not direction; it is confidence.

### 7. Sparse

Plain meaning: there is not enough observed history to classify the county
shape. This includes too few observed years, too few observed events, or too
much missing/partial source history.

Shape:

```text
events
 20 |
 15 |                    *
 10 |
  5 |        *
  0 |  .  .     .  .  .     .  .  .
    +--------------------------------
       1  2  3  4  5  6  7  8  9 10 11

       . = missing or too little observed evidence
```

Statistical intuition:

- fails observed-year gate;
- fails event-volume gate;
- no slope or pattern should be trusted.

Pricing/routing intuition: no direct trend adjustment. Route to quoteability,
credibility, source coverage, or manual review.

## Boundary Rules To Avoid Overlap

The candidates should be applied in an order that prevents one shape from
stealing another shape's meaning.

```text
1. Observation gate
   -> sparse if too few observed years/events

2. Dominance gate
   -> episodic/spiky if one or two years dominate

3. Regime gate
   -> step-change if both sides are observed and piecewise level beats line

4. Direction gate
   -> smooth trend or volatile trend if slope is directional

5. No-direction gate
   -> stable regular or stable noisy
```

This order is now the implemented v1 rule order in
`curated_outage_data/pipelines/county_predictability/compute_county_predictability.py`.
The order is operational, but the numeric thresholds are still discussion
targets for validation and tuning. The core idea is:

- do not call missing data a step-change;
- do not call one storm year a trend;
- do not call noisy flat history volatile trend unless it has direction;
- do not call a real level shift smooth just because a line slopes upward.

## Questions For Threshold Design

- Is `piecewise_rss_reduction >= 0.25` too permissive, or is the higher
  step-change count directionally correct?
- Should episodic dominance be tested before step-change, or should extreme
  pre/post shifts get first priority?
- Should volatile vs stable noisy use the same residual-CV threshold, with
  direction deciding the label?
- Should step-change require a minimum absolute event shift, a percent shift,
  or both?
- Should all thresholds vary by duration threshold T?
- Should a recent spike carry a different routing label than an old spike?
