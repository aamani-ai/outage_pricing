# README — InfraSure outage models: `ve3`, `vc3`, `ve4`, `vc4`

Annual, county-level residual models for the **NOAA Northeast** region (244 counties, 2015–2025), feeding the
parametric outage-insurance product. This README explains the notebook family, what each models, the features,
the event-vs-customer distinction (and the after-the-fact customer-exposure sampling in the event line), how
uncertainty is produced, the **output schema** a consumer needs, and the **input files** fetched from the bucket.

---

## 1. The notebook family — prefixes and what each does

Two parallel modeling **lines**, each at two **versions**:

| Notebook | Line | Models… | Adds vs. the v3 base |
|---|---|---|---|
| `joint_count_duration_RESIDUAL_ve3.ipynb` | **event** (`ve`) | event **counts** ≥T, then translates to customer exposure after the fact | event→customer translation layer |
| `joint_count_duration_RESIDUAL_ve4.ipynb` | **event** (`ve`) | same as ve3 | + static features (elevation, log density) |
| `joint_count_duration_RESIDUAL_vc3.ipynb` | **customer** (`vc`) | affected-**customer** exposure ≥T **directly** | peak/mean customer-variant switch |
| `joint_count_duration_RESIDUAL_vc4.ipynb` | **customer** (`vc`) | same as vc3 | + static features (elevation, log density) |

**Prefix meaning**
- **`ve`** = **v**ent… no: **e**vent line. Models the count of outage **events** exceeding a duration threshold,
  then converts to customer exposure in a separate, explicit post-modeling step.
- **`vc`** = **c**ustomer line. Models affected-**customer** exposure counts **directly** (no translation step).
- **digit** = version: **3** = first build of that line; **4** = `3` plus the static county features.

So `ve`↔`vc` is *what is modeled*; `3`↔`4` is *feature set* (4 = 3 + static features).

---

## 2. Models being evaluated (identical across all four notebooks)

Each notebook fits **four ML runs** and reports **two baselines** alongside. The "winner" is chosen among the
**ML runs only** (baselines are reference, not candidates).

**ML runs** (one regressor per duration bucket/threshold, predicting the de-anomalized residual):
- **XGB-features** — gradient-boosted trees on the weather features (+ context + static).
- **GLM-features** — ridge linear regression on the same feature design.
- **XGB-PCs** — gradient-boosted trees on **weather principal components** (+ context + static).
- **GLM-PCs** — ridge on the PC design.

**Baselines** (no weather inputs; reference only):
- **County-History Joint** — each county's empirical per-threshold history, coupled across thresholds with a
  region-pooled Gaussian copula. (Essentially the climatology.)
- **Linear Trend** — per-(county, threshold) OLS trend on the training years, extrapolated.

"features" vs "PCs" = the same models on two design matrices: raw weather features, or weather PCA components.
In **both** designs the context and static features sit **outside** the PCA.

---

## 3. Feature lists

**Weather features** (`SELECTED_RAW_FEATURES`; ERA5-derived, annual, per county). Optionally replaced by
monotone-optimal transforms (`USE_TRANSFORMED_FEATURES=True`; helps GLM, XGB-invariant):
`max_wind_gust_kmh`, `freeze_thaw_cycles`, `hard_freeze_days`, `total_precip_mm`, `heavy_precip_days`,
`total_snowfall_cm`, `high_wind_days`, `wind_energy_sum`, `mean_temp_range_c`, `trop_storm_days_epri`,
`dew_point_mean_c`. These (and only these) are the inputs to the **weather PCA**.

**Context features** (static-per-county or temporal; computed train-only, leakage-safe; **bypass the PCA**,
enter both designs): `year_trend`, `TE` (train county mean of the target), `HIST_STD`, `HIST_TREND`,
`HIST_LAG1` (prior-year same threshold), and `state` one-hot columns.

**Static county features** (`ve4`/`vc4` only; **bypass the PCA**, enter both designs):
- `elevation_m` — county centroid elevation.
- `log1p_density` — `log1p(population_density_per_sq_km)` (log-transformed to tame the urban/rural skew).
- Raw population is **not** used (collinear with `MCC`, already in the rate normalization). Static features
  carry no temporal-anomaly signal on their own; they let models **modulate the cross-county weather response**
  (e.g. terrain/density changing how a county reacts to a storm). XGB captures this via splits; GLM would need
  explicit weather×static interactions to benefit.

---

## 4. Event modeling vs. customer-exposure modeling

The parametric product pays a customer each time their outage exceeds a duration threshold **T**, so the
quantity of interest is **affected-customer exposure ≥T**. The two lines reach it differently.

### Customer line (`vc3`/`vc4`) — model exposure directly
The target is `Rcust(≥T) = 1000 · CUST(≥T) / MCC`, where `CUST(≥T)` sums each event's customer contribution
over events with `duration ≥ T`, per county-year, for the 8 nested thresholds `{≥0,≥1,≥4,≥8,≥12,≥16,≥20,≥24}h`.
The model predicts the de-anomalized residual; reconstruction gives `CUST(≥T)` counts directly. Two **variants**
(set `CUST_VARIANT` and run once each):
- **peak** — each event contributes `peak_customers` (conservative upper bound; the v3 default).
- **mean** — each event contributes `customer_hours / duration_h` (time-average affected customers, ≤ peak).
Both assume each affected customer experiences the event's max duration, so both stay nested across thresholds.
**The two variants have different ground truths and are validated separately.**

### Event line (`ve3`/`ve4`) — model events, then translate (see §5)
The model predicts the count of **events** ≥T (the residual of the event-count rate, reconstructed to raw
counts). A separate post-modeling step then converts predicted event counts into customer exposure. Rationale:
how many customers a single event takes out, and for how long, depends heavily on county logistics that the
model doesn't see; keeping the event count as the modeled quantity isolates the weather signal, and the
peak/max-duration assumption is pushed into an explicit, swappable translation step rather than baked into the
target.

---

## 5. Event line — after-the-fact customer-exposure sampling (detailed)

This is the step that makes the event line comparable to the customer line. It runs **after** the event-count
predictions and their samples exist, for every model, every test (county, year), and every threshold **T**.

**Inputs to the step**
- The model's **raw predicted event-count samples** for ≥T: from the count-space sample tensor
  `MODEL_SAMPLES[run]` of shape `(n_test, 8 buckets, 2000)`, summed over the buckets at/above T to give
  `(2000,)` raw predicted **event counts** N(≥T). (These are **raw counts**, not a per-1,000 rate — verified;
  the rate would be `samp / (MCC/1000)`.)
- A **historic event pool** for that county and threshold: every event in the county with `duration ≥ T`, drawn
  from the **raw event log over the training years** (leakage-free; restoration/severity is a slow county
  trait). Each pooled event carries a **three-tuple** `(peak_customers, customer_hours, duration_h)`. If a
  county's pool at that T is small (<30 events — common at ≥24h), it falls back to a **region-wide** pool.

**The sampling (per model × county × year × T)**
1. For each of the 2000 event-count samples `N_s`, draw `round(N_s)` historic events **with replacement** from
   the pool.
2. The three-tuple is drawn **jointly** — one historic event contributes all three of its values together — so
   the within-event relationship between severity and duration is preserved (no pairing a huge peak with a tiny
   duration).
3. Aggregate the drawn events two ways:
   - **peak variant:** `Σ peak_customers` over the drawn events → a customer-exposure sample.
   - **mean variant:** `Σ (customer_hours / duration_h)` over the drawn events → a customer-exposure sample.
4. Repeating over all 2000 event-count samples yields 2000 customer-exposure samples **per variant**, which
   **compose two sources of uncertainty**: the model's event-count spread *and* the per-event resampling spread.
5. Quantile those samples → p05/p10/p50/p90/p95 + mean, for **both** variants.

**Why this matters / how to read it.** The event line's `cust_peak_*` is directly comparable to the customer
line's **peak** run, and `cust_mean_*` to the customer line's **mean** run (same target definition). Comparing
the event line's `cust_peak` against the directly-modeled `vc` peak isolates how much of the customer number is
the peak/max-duration assumption vs. the model. Comparing peak vs. mean quantifies the conservatism of the peak
choice. (The translation does not force monotonicity across T — it reflects whatever the event model predicted.)

---

## 6. How uncertainty is modeled

- Every model emits **2000 count-space samples** per (county-year, bucket/threshold) — `N_SAMPLES = 2000`,
  fixed seed.
- **ML runs:** empirical residual **bootstrap** — whole 8-bucket residual-error vectors are resampled, binned
  by a severity proxy (quartiles of predicted activity), with a global-pool fallback for thin bins. Resampling
  whole vectors preserves the **cross-bucket/threshold correlation** (a bad storm year lifts all durations).
- **County-History Joint:** empirical marginals + region-pooled Gaussian copula (its own joint draws).
- **Linear Trend:** OLS prediction-interval variance, censored at 0.
- **Bands** = quantiles of the **summed samples** (sum the samples across the relevant buckets, *then*
  quantile — never sum the per-bucket bounds), at **p05 / p10 / p50 / p90 / p95**.
- **Customer line nesting:** because thresholds are modeled directly, each sample path is **monotone-sorted**
  across thresholds (so `CUST(≥8) ≥ CUST(≥12) …` holds); the point prediction is the p50 of the sorted samples.
- **Event-line customer exposure:** bands come from the §5 sampling (model + translation uncertainty combined).
- A **band-coverage diagnostic** is exported (empirical fraction of observations inside p10–p90; currently the
  bands are known to be under-dispersed — treat intervals as indicative, recalibration is a pending item).

All models use **expanding-window 3-fold CV**: train 2015–2022→test **2023**; train 2015–2023→test **2024**;
train 2015–2024→test **2025**. De-anomalization, features, scaler, PCA, and fits are recomputed per fold; the
three single-test-year predictions are stitched into the combined test set. **Use only the test-year rows.**

---

## 7. Output schema — the file you will use

All outputs land in `/<OUTPUT_DIR>/data/` and are bundled into `<OUTPUT_DIR>_outputs.zip`. `<region>` is
`Northeast`. The headline file differs by line:

### 7a. Customer line (`vc3`/`vc4`): `pred_counts_threshold_<region>.parquet`
One row per **(run, county, year, threshold)**. Customer-exposure counts with bands. Run the notebook once per
variant; **the file's customer columns refer to whichever `CUST_VARIANT` produced it** (peak or mean) — the
variant is identified by the output directory (`..._peak` / `..._mean`), not by a column.

| Column | Meaning |
|---|---|
| `run` | model name: `XGB-features`, `GLM-features`, `XGB-PCs`, `GLM-PCs`, `County-History Joint`, `Linear Trend` |
| `fips_code` | 5-digit county FIPS (string, zero-padded) |
| `year` | test year (2023, 2024, or 2025) |
| `threshold_h` | duration threshold T in hours: one of 0, 1, 4, 8, 12, 16, 20, 24 |
| `bucket` | the threshold's label, e.g. `>=8h` (redundant with `threshold_h`) |
| `pred_cust_mean` | predicted affected-customer exposure ≥T (mean of the samples) |
| `cust_p05`, `cust_p10`, `cust_p50`, `cust_p90`, `cust_p95` | predictive band quantiles (customers ≥T) |
| `obs_cust` | observed affected-customer exposure ≥T for that county-year (this variant's ground truth) |

**Point estimate** = `cust_p50` (nested/monotone across thresholds). **80% interval** = `cust_p10`–`cust_p90`;
**90%** = `cust_p05`–`cust_p95`. `pred_cust_mean` is the sample mean (can exceed p50 for skewed cells).

### 7b. Event line (`ve3`/`ve4`): two files
**(i) `pred_counts_threshold_<region>.parquet`** — predicted **event counts** ≥T (the modeled quantity):

| Column | Meaning |
|---|---|
| `run`, `fips_code`, `year`, `threshold_h` | as above |
| `pred_count_mean` | predicted **event count** ≥T (sample mean) |
| `count_p05`, `count_p10`, `count_p50`, `count_p90`, `count_p95` | event-count band quantiles |
| `obs_count` | observed event count ≥T |

**(ii) `pred_customer_exposure_threshold_<region>.parquet`** — the §5 translation; **both variants in one
file** (this is the file to compare against the `vc` outputs):

| Column | Meaning |
|---|---|
| `run`, `fips_code`, `year`, `threshold_h` | as above |
| `n_hist_events_pool` | size of the historic event pool used (diagnostic; small ⇒ region fallback used) |
| `pred_event_count_mean` | mean predicted event count fed into the translation (for reference) |
| `pred_cust_peak_mean` | **peak**-variant customer exposure ≥T (mean of samples) |
| `cust_peak_p05/p10/p50/p90/p95` | peak-variant band quantiles |
| `pred_cust_mean_mean` | **mean**-variant customer exposure ≥T (mean of samples) |
| `cust_mean_p05/p10/p50/p90/p95` | mean-variant band quantiles |

**Cross-line comparison:** `ve` `cust_peak_*` ↔ `vc` **peak**-run `cust_*`; `ve` `cust_mean_*` ↔ `vc`
**mean**-run `cust_*`. Compare peak-to-peak and mean-to-mean (matching ground truths).

Other exported files (secondary): `pred_residuals_threshold_*` (residual-space preds + bands),
`band_coverage_*` (coverage diagnostic), `evaluation_*` / `reconstructed_kpis` (metrics), `model_specs/*`,
and exhibit figures.

---

## 8. Input files fetched from the bucket (`gs://outage-data/`)

To substitute a local variant, drop a file with the **same schema** at the same relative path under the local
data root (`~/outage-data/`). Paths below are relative to the bucket root.

| Path (relative) | Used for | Expected schema |
|---|---|---|
| `v1.2/processed/event_log.parquet` | event counts, customer sums, and the §5 historic pools | one row per outage **event**: `event_start`, `event_end` (datetime), `duration_h` (float), `peak_customers` (int), `customer_hours` (float), `fips_code` (str 5-digit), `county`, `state` (str), `year` (int). 2015–2025. |
| `v1.2/processed/era5_annual_features.parquet` | raw weather features | one row per **(fips_code, year)**: `fips_code` (str), `year` (int), and the weather columns in §3 (e.g. `max_wind_gust_kmh`, `total_precip_mm`, …), all numeric. |
| `v1.2/processed/era5_annual_features_transformed.parquet` | monotone-optimal transformed weather features (used when `USE_TRANSFORMED_FEATURES=True`) | same key `(fips_code, year)`; columns are the transformed names (e.g. `max_wind_gust_kmh_exp`) that the notebook renames back to raw names. |
| `eaglei_outages/MCC.csv` | MCC denominator for the `Rcust = 1000·CUST/MCC` rate | columns auto-detected: one containing "fips" (county FIPS) and one containing "customer" (maximum customer count). Numeric MCC. |
| `external/county_fips.csv` | maps FIPS → state (the event log's own `state` is treated as unreliable) | `fips_code` (str 5-digit), `state_abbr` (str, e.g. `NY`). |
| `external/noaa_climate_regions.geojson` | resolves the region's member states | GeoJSON FeatureCollection; each feature `properties` has `region_name` (e.g. `Northeast`) and `states` (list of state abbreviations). |
| `external/county_static_features_ctfilled.parquet` | **`ve4`/`vc4` only** — static county features | one row per **county**: `fips_code` (str 5-digit), `elevation_m` (float), `population_density_per_sq_km` (float). Connecticut legacy counties backfilled. |

**Notes for swapping inputs**
- Keep `fips_code` as a zero-padded 5-digit string everywhere; the notebooks re-pad on load, but a local file
  with integer FIPS will still join if the column exists.
- The event log is the **one file the §5 translation re-reads with `customer_hours`** — a local replacement must
  include `peak_customers`, `customer_hours`, and `duration_h` per event, or the customer-exposure step fails.
- Static-feature coverage is expected at 244/244 NE counties; missing rows are region-mean-filled (a warning
  prints), so a partial local file degrades gracefully rather than dropping counties.
- Switching `SELECTED_REGION` requires the geojson to contain that region; everything else flows from it.

---

## 9. Quick start for a consumer of the predictions
1. Pick the line/variant you need: customer line → `vc` outputs; event line + translation → `ve`
   `pred_customer_exposure_threshold_*`.
2. Filter to the **test years** (2023–2025) and your chosen `run` (e.g. `XGB-PCs`).
3. For each `(fips_code, year, threshold_h)` read the point estimate (`*_p50` / `pred_*_mean`) and the band
   (`p10`–`p90` for 80%, `p05`–`p95` for 90%).
4. For customer exposure, remember the **peak** vs **mean** distinction and match like-for-like across lines.
5. Treat band widths as indicative (coverage recalibration is pending).
