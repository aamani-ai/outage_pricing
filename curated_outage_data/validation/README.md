# Validation

Validation is part of the curated-data product, not an afterthought.

## Phase 1 Cause Attribution QA

Minimum reports:

```text
match_rate_by_state_year.csv
match_rate_by_duration_threshold.csv
unmatched_long_events.csv
top_source_event_types.csv
pnnl_event_construction_comparison.csv
pnnl_oe417_lag_comparison.csv
manual_review_sample.md
```

Questions:

- Are long-duration outages more likely to get cause matches?
- Are NOAA matches plausible around known storm periods?
- How many outage events match multiple storm records?
- How many source events match many outage events?
- Which states/years have suspiciously low match rates?
- Where do our constructed events differ from PNNL merged events?
- How sensitive are OE-417 cause matches to 8-hour versus 24-hour lag windows?

## Phase 2 Grid Feature QA

Minimum reports:

```text
feature_coverage_by_state_year.csv
utility_county_weight_checks.csv
reliability_missingness.csv
capex_outliers.csv
leakage_audit.md
```

Questions:

- Do utility-county weights sum correctly?
- Which utility types are missing from FERC/PUDL?
- Are annual features lag-safe?
- Are capex/O&M outliers real or parsing errors?

## Phase 3 Modeling QA

Minimum reports:

```text
rolling_backtest_metrics.json
observed_vs_expected_by_threshold.csv
residual_bias_by_state.csv
model_card.md
```

Questions:

- Does the model beat v0 historical baseline?
- Is it calibrated by threshold?
- Is it stable by geography?
- Does it introduce unexplained premium jumps?
