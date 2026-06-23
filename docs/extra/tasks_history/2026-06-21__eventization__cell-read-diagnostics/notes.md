# Notes — Implementation Detail

Chronological and topical notes for the eventization / cell-read diagnostics
work.

## Starting Point

The session began from a broader discussion around risk-based clustering and
eventization. The user flagged a deeper issue:

```text
The frequency number is not only a model output. It depends on how we turn
15-minute outage time series into events, and how we convert county events into
per-customer exposure.
```

That led to three linked tasks:

1. document the eventization-frequency contract before tuning risk clusters;
2. answer the underwriter / Chris question honestly;
3. build quantitative diagnostics that show where the proxy is conservative,
   balanced, or duration-sensitive.

## Eventization Discussion Folder

Created:

```text
docs/dicsscssion/eventization_frequency_contract/
```

Files:

```text
README.md
01_eventization_frequency_discussion.md
02_underwriter_confidence_framing.md
03_inner_event_shape_diagnostics.md
```

Important note: the repository path uses `dicsscssion` as the existing folder
spelling. We followed the current repo convention rather than creating a new
`discussion/` spelling.

## External Practice Scan

`01_eventization_frequency_discussion.md` includes an industry-practice scan
covering:

- EAGLE-I / public outage research data;
- utility reliability reporting / EIA / IEEE-style SAIDI/SAIFI framing;
- parametric insurance;
- catastrophe modeling / reinsurance analytics;
- outage-specific parametric product examples;
- adjacent parametric downtime products;
- PowerOutage.com / utility-map aggregators;
- utility / AMI / Green Button / ODIN.

The conclusion: no broad national source gives policy-location outage history
with customer IDs and restoration paths. Our method must communicate the data
constraint rather than pretend it does not exist.

## Duration-Bucket Notebook

Notebook:

```text
notebooks/event_duration_bucket_analysis.ipynb
```

Executed output:

```text
notebooks/outputs/event_duration_bucket_analysis_executed.ipynb
notebooks/outputs/event_duration_bucket_analysis/
```

Key files:

```text
default_45min_duration_bucket_summary.csv
default_45min_cumulative_threshold_summary.csv
example_county_duration_bucket_summary.csv
county_duration_bucket_matrix.csv
national_duration_bucket_summary.csv
```

Default `eagle-i-45min` non-overlapping buckets:

| Duration bucket | Events | Share |
|---|---:|---:|
| `0-2h` | 6,623,451 | 50.2% |
| `2-4h` | 3,070,904 | 23.3% |
| `4-8h` | 1,975,685 | 15.0% |
| `8-12h` | 671,651 | 5.1% |
| `12-24h` | 567,788 | 4.3% |
| `24h+` | 281,205 | 2.1% |

Cumulative threshold counts:

| T | Events with duration >= T | Share |
|---:|---:|---:|
| `2h` | 6,567,233 | 49.8% |
| `4h` | 3,496,329 | 26.5% |
| `8h` | 1,520,644 | 11.5% |
| `12h` | 848,993 | 6.4% |
| `24h` | 281,205 | 2.1% |

Interpretation used in docs: higher duration thresholds are cleaner insured
events, but have thinner samples. That is a cell-level read, not a global
"12h is low confidence" claim.

## Per-Customer Fundamentals Update

Modified:

```text
docs/methodology/fundamentals/per_customer_pricing_fundamentals.md
```

Added:

- `Two distributions, not one`
- explicit within-event vs across-event distinction;
- explicit `multiplier_max` formula:

```text
multiplier_max(f, T)  = mean over qualifying events of:
                        max_customers(e) / MCC(f)
```

This resolved the user's question: "is max customer out inner max + outer
average?" Yes.

## Inner-Event Shape Notebook

Notebook:

```text
notebooks/inner_event_shape_diagnostics.ipynb
```

HTML:

```text
notebooks/outputs/inner_event_shape_diagnostics.html
```

Output folder:

```text
notebooks/outputs/inner_event_shape_diagnostics/
```

The notebook reads:

```text
price_engine/catalogs/eagle-i-45min/data/events.parquet
```

Columns used:

```text
event_id
fips
state
county
duration_hours
n_snapshots
min_customers
max_customers
mean_customers
year
```

Metrics:

```text
peak_to_mean      = max_customers / mean_customers
mean_to_peak      = mean_customers / max_customers
min_to_mean       = min_customers / mean_customers
observed_fraction = n_snapshots * 0.25 / duration_hours
borderline_1h     = duration_hours in [T, T + 1h)
```

Candidate flags:

```text
spike-like              peak_to_mean >= 3
plateau-like            mean_to_peak >= 0.75
restoration-tail proxy  min_to_mean <= 0.25
bridge-heavy proxy      observed_fraction < 0.75
threshold-borderline    duration_hours in [T, T + 1h)
```

## Inner-Event National Results

Generated file:

```text
notebooks/outputs/inner_event_shape_diagnostics/national_inner_event_shape_by_threshold.csv
```

Default `eagle-i-45min`:

| T | Events | Median peak/mean | P90 peak/mean | Spike-like share | Plateau-like share | Bridge-heavy | Borderline +1h |
|---:|---:|---:|---:|---:|---:|---:|---:|
| `2h` | 6,567,233 | 1.54 | 5.13 | 21.1% | 42.7% | 0.6% | 29.6% |
| `4h` | 3,496,329 | 2.16 | 7.61 | 34.9% | 24.1% | 0.3% | 21.3% |
| `8h` | 1,520,644 | 3.43 | 12.20 | 56.6% | 10.2% | 0.1% | 15.4% |
| `12h` | 848,993 | 4.59 | 16.26 | 70.5% | 6.0% | 0.1% | 11.2% |
| `24h` | 281,205 | 7.26 | 26.00 | 85.9% | 3.1% | 0.0% | 5.9% |

Important interpretation:

- long-duration events are more peak-to-mean heavy;
- this can mean the mean-based price is conservative versus peak impact;
- it can also mean county event duration and individual customer duration are
  not fully aligned;
- therefore the output is a proxy-posture read, not a price adjustment.

## Visual Toy Examples

Generated:

```text
diagnostic_shape_examples.png
diagnostic_shape_examples.csv
```

Purpose: show plain visual intuition for:

- spike-like;
- plateau-like;
- restoration-tail proxy;
- bridge-heavy proxy;
- threshold-borderline.

These are synthetic toy 15-minute paths. The notebook explicitly says they are
not sampled from a specific real county because the current event parquet does
not preserve the full 15-minute path.

## Worked Concho, TX Example

Generated:

```text
worked_concho_tx_inner_event_shape_read.csv
worked_concho_tx_inner_event_shape_read.png
```

Concho, TX (`48095`) by threshold:

| T | Events | Median peak/mean | P90 peak/mean | Spike-like | Plateau-like | Borderline +1h | Cell read |
|---:|---:|---:|---:|---:|---:|---:|---|
| `2h` | 810 | 1.00 | 4.64 | 15.2% | 65.6% | 33.1% | strong shape evidence · boundary-sensitive review |
| `4h` | 389 | 1.39 | 11.69 | 26.5% | 47.0% | 19.5% | strong shape evidence · mixed proxy posture |
| `8h` | 184 | 2.61 | 25.86 | 46.2% | 28.8% | 12.0% | strong shape evidence · likely conservative; duration-alignment review |
| `12h` | 126 | 3.60 | 40.85 | 57.9% | 20.6% | 4.8% | strong shape evidence · likely conservative; duration-alignment review |
| `24h` | 83 | 5.50 | 65.33 | 69.9% | 12.0% | 1.2% | medium shape evidence · likely conservative; duration-alignment review |

This is the clearest example of why a single "confidence" label is not enough.
At `T=8h`, Concho has enough shape evidence to inspect, but the event shape is
peak/tail heavy. The right read is:

```text
strong shape evidence · likely conservative; duration-alignment review
```

## Commands Used

Inspect docs and code:

```bash
rg -n "mean_customers|max_customers|min_customers|n_snapshots|duration_hours" \
  notebooks docs curated_outage_data price_engine

sed -n '1,220p' price_engine/data/02_construct_events.py
sed -n '1,150p' docs/methodology/fundamentals/per_customer_pricing_fundamentals.md
```

Create/update notebooks programmatically:

```bash
.venv/bin/python - <<'PY'
# nbformat scripts used to create / patch notebook cells
PY
```

Execute inner-event notebook in place:

```bash
.venv/bin/python -m jupyter nbconvert --to notebook --execute --inplace \
  notebooks/inner_event_shape_diagnostics.ipynb \
  --ExecutePreprocessor.timeout=900
```

Export HTML:

```bash
.venv/bin/python -m jupyter nbconvert --to html \
  notebooks/inner_event_shape_diagnostics.ipynb \
  --output-dir notebooks/outputs \
  --output inner_event_shape_diagnostics.html
```

Validate notebook:

```bash
.venv/bin/python - <<'PY'
import nbformat
nb = nbformat.read('notebooks/inner_event_shape_diagnostics.ipynb', as_version=4)
nbformat.validate(nb)
print('valid notebook')
PY
```

Check whitespace:

```bash
git diff --check -- \
  docs/dicsscssion/eventization_frequency_contract/02_underwriter_confidence_framing.md \
  docs/dicsscssion/eventization_frequency_contract/03_inner_event_shape_diagnostics.md \
  docs/plan/inner_event_shape_confidence_plan.md \
  docs/plan/README.md \
  notebooks/inner_event_shape_diagnostics.ipynb
```

Inspect generated output sizes:

```bash
find notebooks/outputs/inner_event_shape_diagnostics -maxdepth 1 -type f -print | sort
ls -lh notebooks/outputs/inner_event_shape_diagnostics.html
```

## Verification

Completed:

- executed `inner_event_shape_diagnostics.ipynb` in place;
- exported refreshed HTML;
- generated Concho worked example CSV/PNG;
- validated notebook JSON via `nbformat.validate`;
- ran `git diff --check` on edited docs/notebooks.

Warnings:

- HTML export reports missing alternative text on generated images. This is a
  notebook export accessibility warning, not a failed execution.
- `notebooks/outputs/` is gitignored, so generated CSV/PNG/HTML artifacts are
  local unless deliberately copied or committed elsewhere.

## Key Insights

1. **Longer T does not mean globally lower confidence.** It means cleaner
   insured-event meaning but thinner sample and more peak/tail shape. The read
   must be county-threshold specific.
2. **Peak-to-mean is not automatically bad.** At long T, high peak-to-mean can
   be a true restoration tail. It often means the mean-based headline is
   conservative versus peak impact, but needs duration-alignment review.
3. **Bridge-heavy is the clearest evidence-quality issue.** Low observed
   fraction means elapsed duration may depend on gap tolerance or missing
   snapshots.
4. **Threshold-borderline is an eventization issue.** Many events barely above
   `T` means small timing/gap changes can change the frequency count.
5. **The current event catalog is enough for a first read, not for full truth.**
   We can compute summary proxies, but cannot prove customer churn or plateau
   shape without full 15-minute paths.
6. **The right dashboard artifact is a cell read, not a confidence badge.**
   Underwriters need "strong evidence · likely conservative" more than a vague
   78/100 score.

