# Derivation of Location Relativity Factors

- **Status:** audit appendix for the location-basis shadow layer; not active pricing.
- **First written:** 2026-06-18
- **Last reviewed:** 2026-06-18
- **Read alongside:** [Location Basis Methodology](location_basis_methodology.md), [Per-Customer Pricing Fundamentals](fundamentals/per_customer_pricing_fundamentals.md), and the location feature workstream [`docs/extra/location_features/`](../extra/location_features/).

## Why this appendix exists

The location-basis methodology uses rural / mid / urban **relativity factors**.
This appendix answers the audit questions:

- Why is the adjustment a multiplier?
- What data produced the factors?
- Did we fit a continuous function or derive bucket ratios?
- Which files reproduce the numbers?
- What validation supports the direction and magnitude?

The short answer: the factors are **within-county frequency relativities**. They
redistribute the per-customer county price across locations inside the same
county, while preserving the county average at roughly 1.0.

## 1. System Flow at a High Level

There are two related flows: the **calibration flow** that learns the factors,
and the **runtime quote flow** that applies them.

### Calibration flow: how the factors were learned

```text
PoUS city x utility outage sample
        |
        v
qualifying events by threshold T
        |
        v
per-cell customer outage rate
        |
        v
divide by county exposure-weighted mean
        |
        v
within-county relative target
        |
        v
join land area, compute density, rank within each county
        |
        v
rural / mid / urban density terciles
        |
        v
exposure-weighted empirical relativity by tercile
        |
        v
monotone + mean-1 + capped v0 shadow factors
```

The pilot outcome data is PowerOutage.US (PoUS), CT / MA / RI, Jan-Mar 2019.
PoUS is **calibration-only**. It is not needed at quote time.

### Runtime quote flow: how a location receives a price

```text
address or "lat, lon"
        |
        v
point (lon, lat)
        |
        +--> county FIPS --> per-customer county price
        |
        +--> Census tract --> density = population / land area
                              |
                              v
                         rank inside county
                              |
                              v
                         rural / mid / urban
                              |
                              v
                         relativity factor
        |
        v
location price = per-customer county price x location relativity
```

The runtime feature is Census density. The pilot uses town density because PoUS
is town/city-grained; the national dashboard uses tract density because Census
tracts provide national address-scale coverage.

## 2. Why the Adjustment Is a Multiplier

The layer is a **frequency relativity**, not a fixed dollar surcharge. The base
pricing stack is:

```text
lambda_location(T) = lambda_county(T) x customer_impact x location_basis
```

and the displayed location price is:

```text
location price = per-customer price x location_basis relativity
```

This choice is intentional for four reasons:

1. **It matches expected-loss math.** Price scales with outage frequency. If a
   location has 1.4x the expected customer outage rate, a 1.4x frequency
   multiplier is the direct actuarial expression.
2. **It preserves the county baseline.** The factors are mean-1 within a county,
   so the county total is not changed by the location layer.
3. **It composes cleanly.** The same factor can apply across payout sizes,
   duration thresholds, and per-customer price levels.
4. **It avoids double counting.** The county's overall rurality already lives in
   `lambda_county`; location basis only asks whether this address is rural or
   urban **relative to its own county**.

An additive adjustment would depend on payout, load, and county price level; it
would also be harder to keep mean-1 inside the county.

## 3. What Was Actually Estimated

We did **not** fit a smooth function such as:

```text
relativity = f(density)
```

For v0, we deliberately used three robust buckets:

```text
within-county density rank:
0-33%     rural / sparsest
33-67%    mid
67-100%   urban / densest
```

That keeps the method simple, auditable, and less overfit to a thin pilot
sample. The exact construction lives in:

- Target construction: [`within_county_relative_rate.py`](../extra/poweroutage_us/analysis/within_county_relative_rate.py)
- Density-vs-size feature test: [`town_density_vs_size.py`](../extra/location_features/analysis/town_density_vs_size.py)
- Factor derivation: [`build_density_relativity.py`](../extra/location_features/analysis/build_density_relativity.py)
- Final dashboard artifact: [`density_relativity.json`](../../price_engine/dashboard/data/density_relativity.json)

## 4. Step-by-Step Derivation

### Step A: Build the within-county target

For each PoUS city x utility cell and threshold `T`, compute a customer-weighted
frequency-style rate:

```text
A_i,T = sum(customer_share_e) for qualifying outage events e where duration >= T
```

Then compute the county exposure-weighted mean:

```text
county_mean_c,T = sum(tracked_i x A_i,T) / sum(tracked_i)
```

and the within-county relative:

```text
relative_i,T = A_i,T / county_mean_c,T
```

This produces the mean-1 target: a cell above 1.0 is worse than its own county
average; a cell below 1.0 is better than its own county average.

Files:

- Script: [`within_county_relative_rate.py`](../extra/poweroutage_us/analysis/within_county_relative_rate.py)
- Target output: [`within_county_relative_rate.csv`](../extra/poweroutage_us/analysis/outputs/within_county_relative_rate.csv)
- Summary output: [`within_county_target_summary.csv`](../extra/poweroutage_us/analysis/outputs/within_county_target_summary.csv)

### Step B: Join density

For the pilot, density is:

```text
density_town = PoUS tracked customers / Census town land area
```

This is a rurality proxy. Lower density generally means longer overhead radial
feeders, more vegetation exposure, and slower restoration geometry. Higher
density generally means shorter feeders, more undergrounding, looped networks,
and faster crew access.

Files:

- Script: [`town_density_vs_size.py`](../extra/location_features/analysis/town_density_vs_size.py)
- Feature output: [`town_density_features.csv`](../extra/location_features/analysis/outputs/town_density_features.csv)
- Summary output: [`town_density_vs_size.csv`](../extra/location_features/analysis/outputs/town_density_vs_size.csv)

### Step C: Rank density within each county

Within each county, towns are ranked by density and split into thirds:

```text
rural = sparsest third
mid   = middle third
urban = densest third
```

This is important. We use **within-county density rank**, not absolute density,
because the county baseline already captures the county's overall level. Location
basis is only the residual inside that county.

### Step D: Compute empirical tercile relativities

For each threshold, compute the exposure-weighted mean relative by density
tercile:

```text
raw_relativity_tercile,T =
    weighted_average(relative_i,T, weight = tracked_i)
```

At `T>=4h`, the empirical factors are:

| density tercile | empirical relativity |
|---|---:|
| rural | 1.90x |
| mid | 1.23x |
| urban | 0.71x |

### Step E: Apply three v0 controls

The implementation applies three controls before the numbers are shown as v0
shadow price factors:

1. **Monotone direction.** Enforce rural >= mid >= urban. This matches the physics
   prior and avoids a noisy bucket reversal.
2. **Mean-1 renormalization.** Re-scale so the exposure-weighted county average
   stays around 1.0.
3. **Attribution-confidence cap.** Cap to `[0.80, 1.40]`, then renormalize again.
   This cap is a v0 throttle, not the empirical signal size.

The code path is in [`build_density_relativity.py`](../extra/location_features/analysis/build_density_relativity.py).

## 5. Current Factor Table

Generated artifact: [`density_relativity_table.csv`](../extra/location_features/analysis/outputs/density_relativity_table.csv).

| T threshold | tercile | empirical | v0 shadow |
|---:|---|---:|---:|
| 1h | rural | 1.762x | 1.448x |
| 1h | mid | 1.125x | 1.163x |
| 1h | urban | 0.789x | 0.827x |
| 2h | rural | 1.775x | 1.419x |
| 2h | mid | 1.187x | 1.203x |
| 2h | urban | 0.753x | 0.811x |
| 4h | rural | 1.900x | 1.402x |
| 4h | mid | 1.227x | 1.228x |
| 4h | urban | 0.708x | 0.801x |
| 8h | rural | 2.058x | 1.372x |
| 8h | mid | 1.296x | 1.270x |
| 8h | urban | 0.640x | 0.784x |

The dashboard reads the copied JSON artifact:
[`price_engine/dashboard/data/density_relativity.json`](../../price_engine/dashboard/data/density_relativity.json).

## 6. Validation Checks

### Signal-vs-noise target check

The target script reports raw spread, the spread after requiring at least three
qualifying events, and a credibility-shrunk spread. For `T>=4h`:

| check | value |
|---|---:|
| raw p90 relative | 1.900x |
| p90 after >=3-event filter | 1.902x |
| p90 after credibility shrink | 1.574x |
| share of customer exposure in >=2x cells | 9.14% |
| Spearman between frequency-style and time-style target | 0.909 |

Interpretation: the raw 1.9x tail is not created only by one-event cells. The
credibility-shrunk tail is lower, which is why the applied v0 factor is capped
around 1.4x rather than using the full empirical 1.9x.

### Density predicts the within-county relative

Output: [`town_density_vs_size.csv`](../extra/location_features/analysis/outputs/town_density_vs_size.csv).

| T | median rho(size, relative) | median rho(density, relative) | rural third | urban third |
|---:|---:|---:|---:|---:|
| 1h | -0.35 | -0.41 | 1.75x | 0.80x |
| 4h | -0.19 | -0.35 | 1.90x | 0.75x |
| 8h | -0.20 | -0.30 | 2.11x | 0.70x |

The displayed `rho = -0.35` is **not** one pooled city-level correlation. It is
the median of county-level within-county Spearman correlations.

### Significance audit for the rho claim

Script: [`density_significance_check.py`](../extra/location_features/analysis/density_significance_check.py).  
Output: [`density_spearman_significance.csv`](../extra/location_features/analysis/outputs/density_spearman_significance.csv).

For `T>=4h`:

| item | value |
|---|---:|
| county-level samples | 24 |
| matched towns across those samples | 437 |
| towns per county | 5 to 50 |
| counties with negative rho | 22 / 24 |
| median within-county Spearman rho | -0.348 |
| one-sided sign-test p-value | 1.79e-5 |

This test asks whether the county-level correlations are directionally negative
more often than chance. We prefer this as the first audit test because it respects
the within-county design. A single pooled city-level p-value would be easy to make
look strong but would overweight large counties and blur the design.

## 7. What Is Empirical vs. Policy Choice

| Component | Type | Reason |
|---|---|---|
| PoUS within-county relative target | empirical | observed sub-county outage outcome in the pilot |
| density rank / tercile split | modeling choice | simple, stable, and auditable v0 shape |
| rural > mid > urban monotonicity | physics prior | long overhead radial feeders and vegetation exposure should not price below dense urban cores |
| mean-1 renormalization | actuarial constraint | prevents double counting the county baseline |
| `[0.80, 1.40]` cap | v0 governance throttle | reflects attribution confidence, not the full signal size |
| national application outside CT/MA/RI | extrapolation | shadow only until out-of-region validation |

## 8. Current Limitations

- The calibration is one region and one season: CT / MA / RI, Jan-Mar 2019.
- The runtime national feature is Census tract population density, which can
  mis-rank dense commercial cores with low residential population.
- Tree canopy was tested and did not add lift beyond density in the NE pilot.
- Point-sampled impervious surface fixed some commercial-core intuition but was
  too noisy at a single pixel; the planned fix is tract-level zonal mean
  impervious / developed land-cover.
- The factors remain shadow until out-of-region validation and governance review.

## 9. File Map for Reviewers

| Question | File |
|---|---|
| What is the full location-basis methodology? | [`location_basis_methodology.md`](location_basis_methodology.md) |
| How is the within-county target built? | [`within_county_relative_rate.py`](../extra/poweroutage_us/analysis/within_county_relative_rate.py) |
| Where is the target output? | [`within_county_relative_rate.csv`](../extra/poweroutage_us/analysis/outputs/within_county_relative_rate.csv) |
| Where is the target noise summary? | [`within_county_target_summary.csv`](../extra/poweroutage_us/analysis/outputs/within_county_target_summary.csv) |
| Where is density tested against size? | [`town_density_vs_size.py`](../extra/location_features/analysis/town_density_vs_size.py) |
| Where are the factor values computed? | [`build_density_relativity.py`](../extra/location_features/analysis/build_density_relativity.py) |
| Where is the final dashboard factor artifact? | [`density_relativity.json`](../../price_engine/dashboard/data/density_relativity.json) |
| Where is the rho significance audit? | [`density_significance_check.py`](../extra/location_features/analysis/density_significance_check.py) |
| What alternatives were tested? | [`01_findings.md`](../extra/location_features/docs/01_findings.md) |
| What is the data lineage? | [`02_end_to_end_and_data_lineage.md`](../extra/location_features/docs/02_end_to_end_and_data_lineage.md) |

