# `per_customer_lambda` — QA Plan

Tests that the Phase 2 pipeline output must pass before the artifact is
considered ready for downstream consumption.

## Scope

QA plan for
[`curated_outage_data/outputs/per_customer_rate/per_customer_lambda__<catalog_id>.parquet`](../outputs/per_customer_rate/).
Schema: [`../schemas/per_customer_lambda.md`](../schemas/per_customer_lambda.md).

## Checks

### QA1 — v0 baseline reproduction

For a known anchor (Alachua FL, FIPS 12001, T=4h, 45-min catalog), the
`lambda_county` value in the parquet must equal the v0 dashboard cell:

```text
lambda_county = 307.148490   (matches Phase 1 notebook & v0 drilldown JSON)
```

If this drifts, either (a) the upstream events.parquet changed, or (b) the
pipeline's annualization denominator is off — either case blocks publication.

### QA2 — Row count + grain integrity

- One parquet per catalog: `eagle-i-30min`, `eagle-i-45min`, `eagle-i-60min`.
- Each row identified by `(fips, T, catalog_id)`. No duplicate keys.
- Expected row count per file: `n_fips_in_events × |T_GRID|` ≈ 3,090 × 5 ≈ 15,450.

### QA3 — Coverage gate distribution sanity

The gate distribution should be monotone in T — `available` count decreases as
T increases (longer-duration events are rarer). A non-monotone pattern flags
a gating-logic bug. Phase 2 first run (2026-05-30) produced (45-min catalog):

| T | available | caution | not_available |
|---|---|---|---|
| 2 | 2,798 | 225 | 67 |
| 4 | 2,753 | 248 | 89 |
| 8 | 2,273 | 653 | 164 |
| 12 | 1,690 | 1,177 | 223 |
| 24 | 729 | 1,844 | 517 |

Future runs should be qualitatively similar; large shifts at any T-row trigger
an investigation.

### QA4 — Cross-catalog stability (Phase 2 gate)

For (FIPS, T) cells with `coverage_gate_status = 'available'` across all
three catalogs, the relative range of `multiplier_mean` must satisfy:

```text
rel_range(fips, T) = (max - min) / mean     across 30/45/60-min catalogs

at T in {4, 8, 12}:  rel_range <= 0.20 for at least 85% of available cells
```

Phase 2 first run passed:

| T | % within ±20% | gate |
|---|---|---|
| 4 h | 98.0% | ✓ |
| 8 h | 92.4% | ✓ |
| 12 h | 88.1% | ✓ |

### QA5 — Multiplier bounds

For every row with `coverage_gate_status != 'not_available'`:

- `multiplier_mean >= 0` ✓
- `multiplier_median >= 0` ✓
- `multiplier_max >= 0` ✓
- `multiplier_mean <= multiplier_max` ✓ (mean ≤ max by construction since
  `mean_customers <= max_customers` per event)

The pipeline does NOT clip to [0, 1]. If any row has `multiplier_max > 1.0`,
flag for investigation (likely a fast-growth county where MCC is stale).

### QA6 — Null semantics

- All `multiplier_*`, `lambda_customer_*`, `pct_mcc_*` columns are null when
  `coverage_gate_status = 'not_available'`. ✓
- `coverage_gate_reason` is null only when `coverage_gate_status = 'available'`. ✓
- `mcc`, `S_T`, `lambda_county` are null only when MCC is missing. ✓

### QA7 — Headline vs median directional consistency

Phase 1 (F4) showed the per-event share distribution is right-skewed, so
mean ≥ median for almost all counties. Test:

```text
(multiplier_mean >= multiplier_median).mean() > 0.95
```

If this fails, investigate the distribution shape for the failing counties
— may indicate a left-skewed county-population where the bias direction is
opposite.

### QA8 — `lambda_customer_mean = lambda_county * multiplier_mean`

Floating-point identity: re-multiply and check the diff is below a tolerance.

```text
|lambda_customer_mean - (lambda_county * multiplier_mean)| < 1e-9
```

## How to run

A QA runner script is not yet packaged. The checks above are exercised
manually in the Phase 2 close cells of the Phase 1 notebook and by the
ad-hoc Python session that produced the stability summary in the model
card. A reusable QA runner is reserved for the v0.5 hardening pass.

## Failure handling

Any failed check blocks publication of the artifact for downstream use
(dashboard, reports, governance). Document the failure with:

- check ID,
- which (FIPS, T, catalog) cells failed,
- root cause,
- whether a code change, a data refresh, or a gate-threshold tune is the
  right response.

Failures must be added to the model card's "Known failure modes" before the
artifact is re-published.
