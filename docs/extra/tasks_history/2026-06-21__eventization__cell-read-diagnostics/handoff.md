# Handoff — 2026-06-21

For the next session / model switch / teammate. Read this quickly, then start
from the **Next action** section.

## 10-Bullet Summary

1. We created a dedicated eventization-frequency discussion folder:
   `docs/dicsscssion/eventization_frequency_contract/`.
2. The core framing changed from generic "confidence" to a more useful
   underwriting **cell read**:
   `cell_read(fips,T) = evidence reliability + proxy posture + review reason`.
3. `per_customer_pricing_fundamentals.md` now explicitly distinguishes the
   within-event customer-count distribution from the across-event
   customer-impact distribution.
4. `multiplier_max` is now documented as **inner max + outer average**:
   `mean(max_customers(e) / MCC(f))` across qualifying events.
5. `event_duration_bucket_analysis.ipynb` now provides raw duration buckets and
   cumulative threshold counts for eventization evidence.
6. `inner_event_shape_diagnostics.ipynb` now computes shape proxies:
   peak/mean, mean/peak, min/mean, observed fraction, and threshold-borderline
   share.
7. The notebook includes toy visual examples for spike-like, plateau-like,
   restoration-tail, bridge-heavy, and threshold-borderline event shapes.
8. The worked Concho, TX example shows how the language works:
   `strong shape evidence · likely conservative; duration-alignment review` at
   `T=8h`.
9. `docs/plan/inner_event_shape_confidence_plan.md` is internally reframed as
   the "Inner-Event Shape Cell-Read Plan"; dashboard implementation is not yet
   active.
10. No production pricing logic changed; all work is discussion, planning,
    notebooks, and methodology documentation.

## Files To Read First

Read these in order:

```text
docs/dicsscssion/eventization_frequency_contract/README.md
docs/dicsscssion/eventization_frequency_contract/01_eventization_frequency_discussion.md
docs/dicsscssion/eventization_frequency_contract/02_underwriter_confidence_framing.md
docs/dicsscssion/eventization_frequency_contract/03_inner_event_shape_diagnostics.md
docs/plan/inner_event_shape_confidence_plan.md
docs/methodology/fundamentals/per_customer_pricing_fundamentals.md
notebooks/inner_event_shape_diagnostics.ipynb
notebooks/event_duration_bucket_analysis.ipynb
```

For upstream context:

```text
docs/plan/risk_based_clustering_quantification_plan.md
docs/dicsscssion/risk_based_clustering/01_candidate_pattern_definitions.md
```

## Files Touched

Created:

```text
docs/dicsscssion/eventization_frequency_contract/
docs/plan/inner_event_shape_confidence_plan.md
notebooks/event_duration_bucket_analysis.ipynb
notebooks/inner_event_shape_diagnostics.ipynb
docs/extra/tasks_history/2026-06-21__eventization__cell-read-diagnostics/
```

Modified:

```text
docs/methodology/fundamentals/per_customer_pricing_fundamentals.md
docs/plan/README.md
docs/plan/risk_based_clustering_quantification_plan.md
notebooks/README.md
```

Generated local outputs:

```text
notebooks/outputs/event_duration_bucket_analysis/
notebooks/outputs/event_duration_bucket_analysis_executed.ipynb
notebooks/outputs/inner_event_shape_diagnostics.html
notebooks/outputs/inner_event_shape_diagnostics/
notebooks/outputs/inner_event_shape_diagnostics_executed.ipynb
```

## Repro Commands

Execute the inner-event shape notebook:

```bash
cd /Users/divy/code/work/infrasure_git_codes/outage_pricing
.venv/bin/python -m jupyter nbconvert --to notebook --execute --inplace \
  notebooks/inner_event_shape_diagnostics.ipynb \
  --ExecutePreprocessor.timeout=900
```

Export the HTML report:

```bash
.venv/bin/python -m jupyter nbconvert --to html \
  notebooks/inner_event_shape_diagnostics.ipynb \
  --output-dir notebooks/outputs \
  --output inner_event_shape_diagnostics.html
```

Inspect the worked Concho output:

```bash
.venv/bin/python - <<'PY'
import pandas as pd
p = 'notebooks/outputs/inner_event_shape_diagnostics/worked_concho_tx_inner_event_shape_read.csv'
print(pd.read_csv(p).to_string(index=False))
PY
```

Validate notebook JSON:

```bash
.venv/bin/python - <<'PY'
import nbformat
nb = nbformat.read('notebooks/inner_event_shape_diagnostics.ipynb', as_version=4)
nbformat.validate(nb)
print('valid notebook')
PY
```

Whitespace check:

```bash
git diff --check -- \
  docs/dicsscssion/eventization_frequency_contract \
  docs/plan/inner_event_shape_confidence_plan.md \
  notebooks/inner_event_shape_diagnostics.ipynb
```

## Current Output Anchors

Default `eagle-i-45min` duration buckets:

```text
0-2h    6,623,451 events  50.2%
2-4h    3,070,904 events  23.3%
4-8h    1,975,685 events  15.0%
8-12h     671,651 events   5.1%
12-24h    567,788 events   4.3%
24h+      281,205 events   2.1%
```

Default cumulative threshold counts:

```text
T>=2h    6,567,233 events  49.8%
T>=4h    3,496,329 events  26.5%
T>=8h    1,520,644 events  11.5%
T>=12h     848,993 events   6.4%
T>=24h     281,205 events   2.1%
```

Concho, TX at `T=8h`:

```text
events: 184
median peak/mean: 2.61
p90 peak/mean: 25.86
spike-like share: 46.2%
plateau-like share: 28.8%
borderline +1h: 12.0%
cell read: strong shape evidence · likely conservative; duration-alignment review
```

## Next Action

### Phase A — Review the cell-read vocabulary

Before implementation, decide whether these labels are the right underwriting
language:

```text
Strong evidence · balanced proxy
Strong evidence · likely conservative
Medium evidence · duration-alignment review
Thin evidence · review
```

Questions to answer:

1. Should "likely conservative" be a label, a note, or both?
2. Should "duration-alignment review" be used only at high `T`, or whenever
   spike/tail shape is high?
3. Should "evidence reliability" have a numeric score, or only categories?
4. Should proxy posture be categorical only, or include the raw metrics in the
   UI?

### Phase B — Decide the artifact shape

If the vocabulary is accepted, create a generated artifact. Candidate:

```text
price_engine/catalogs/<catalog>/pricing/county_cell_read.json
```

Suggested fields:

```text
fips
T_hours
evidence_reliability
proxy_posture
review_reason
events
median_peak_to_mean
p90_peak_to_mean
share_spike_like_peak_to_mean_ge_3
share_plateau_like_mean_to_peak_ge_075
share_bridge_heavy_observed_fraction_lt_075
share_borderline_within_1h
```

Keep it read-only / explanatory. Do not pipe it into premium.

### Phase C — Dashboard design

If Phase B lands, surface the cell read in the matrix/drilldown:

1. Add a compact badge near each selected `T` cell:
   `Strong evidence · likely conservative`.
2. On hover/click, show raw drivers:
   event count, spike-like share, plateau-like share, borderline share.
3. In the annual outage series, explain that this is not a forecast
   probability and not a premium multiplier.
4. Keep the current price unchanged.

### Phase D — Risk-based clustering follow-on

Return to `risk_based_clustering_quantification_plan.md` only after the
cell-read vocabulary is accepted. The annual trend labels should not be tuned
until:

- observed-zero vs missing-year policy is settled;
- cell-level evidence and proxy posture are available;
- source-gap examples like Concho/Texas 2016 are treated correctly.

## Critical Gotchas

1. **Do not rename the existing `dicsscssion` folder unless the whole repo is
   cleaned up.** New docs intentionally follow the current spelling.
2. **Do not treat high peak-to-mean as bad data by default.** At long `T`, it
   can be a real restoration-tail signature.
3. **Do not turn proxy posture into a premium multiplier yet.** The current
   decision is diagnostic/read-only.
4. **The current event parquet lacks full 15-minute paths.** Inner-event shape
   metrics are summary proxies, not full customer-duration truth.
5. **Generated notebook outputs are gitignored.** If a teammate needs the PNG
   or HTML, send/export it explicitly or decide to commit a curated copy.
6. **No production pricing logic changed in this work.**
7. **The working tree has unrelated changes.** Do not revert them. Use
   `git status --short` before committing.

## Acceptance Criteria Met

- [x] Dedicated eventization discussion docs created.
- [x] Underwriter-facing cell-read framing written.
- [x] Inner vs outer customer-impact distributions documented.
- [x] Duration-bucket notebook created and executed.
- [x] Inner-event shape notebook created and executed.
- [x] Toy diagnostic visuals generated.
- [x] Worked Concho example generated.
- [x] Plan and README indexes updated.
- [x] Notebook validates with `nbformat`.
- [x] `git diff --check` passes for edited docs/notebooks.

