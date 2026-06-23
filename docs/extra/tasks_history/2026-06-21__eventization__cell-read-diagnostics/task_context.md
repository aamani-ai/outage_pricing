# Task Context

Date: 2026-06-21  
Area: eventization  
Slug: cell-read-diagnostics

## Objective

Turn the eventization / per-customer exposure concern into a concrete
underwriting-facing diagnostic framework. The result should explain, per
county-threshold cell, not only whether there is enough evidence, but also
whether the county-event-to-customer proxy looks balanced, likely conservative,
or in need of duration-alignment review.

## Background

The team discussion exposed a foundational issue: EAGLE-I provides 15-minute
county-level `customers_out` snapshots, not customer IDs and not actual
policy-level outage start/end times. The pricing engine eventizes those
snapshots into county outage events and then converts county event frequency
into per-customer expected loss using event-level customer-count summaries.

That raises the underwriter question:

```text
If a county event lasts 8h or 12h, did an individual customer really experience
an 8h or 12h outage, or did the county just have some outage activity somewhere
for that long?
```

The earlier language called this broadly "confidence." During the session we
corrected that framing. The useful output is a **cell read**:

```text
cell_read(fips, T)
  = evidence reliability + proxy posture + review reason
```

This preserves two separate ideas:

- evidence reliability: source completeness, event volume, gap sensitivity,
  missing-vs-zero status;
- proxy posture: whether the event summary suggests the mean-based
  per-customer proxy is balanced, likely conservative, or needs
  duration-alignment review.

## Problems We Were Solving

1. **Confidence was too broad a word.** It mixed data evidence, source
   quality, product threshold fitness, and pricing conservatism into one vague
   label.
2. **The per-customer conversion needed better explanation.** The production
   formula uses `mean_customers(e) / MCC`, but the event catalog also has
   `max_customers`, `min_customers`, and `n_snapshots`. We needed to document
   which distribution each field belongs to.
3. **The team needed a quantitative way to discuss event shape.** Spike-like,
   plateau-like, restoration-tail, bridge-heavy, and threshold-borderline
   events needed clear metrics and visual examples.
4. **Long-duration products needed nuanced communication.** `8h`/`12h` are
   cleaner insured-event concepts, but county-level long events can have high
   peak-to-mean shape because of real restoration tails. That should not be
   blindly called "low confidence."
5. **Risk-based clustering was blocked on upstream eventization clarity.**
   Before refining trend/episodic/step-change labels, we needed to clarify the
   eventization-frequency contract and zero-vs-missing handling.

## What We Fixed

1. **Created a dedicated eventization discussion folder.**
   - `01_eventization_frequency_discussion.md` documents the data constraint,
     eventization contract, external-practice scan, bias directions, zero vs
     missing years, and validation sequence.
   - `02_underwriter_confidence_framing.md` was reframed as an underwriting
     cell-read document.
   - `03_inner_event_shape_diagnostics.md` documents the inner-event shape
     metrics, visual examples, national results, and communication language.

2. **Clarified the two customer-impact distributions.**
   - Updated `per_customer_pricing_fundamentals.md` to distinguish:
     - within-event snapshot distribution: `min_customers`, `mean_customers`,
       `max_customers`, `n_snapshots`;
     - across-event customer-impact distribution:
       `mean_customers(e) / MCC(f)` across events clearing `T`.
   - Made `multiplier_max` explicit:

     ```text
     multiplier_max(f, T)
       = mean over qualifying events of max_customers(e) / MCC(f)
     ```

3. **Built a duration-bucket diagnostic notebook.**
   - `notebooks/event_duration_bucket_analysis.ipynb`
   - Outputs raw non-overlapping duration buckets and cumulative threshold
     counts.
   - Key default 45-minute results:
     - `0-2h`: 6,623,451 events, 50.2%;
     - `2-4h`: 3,070,904 events, 23.3%;
     - `4-8h`: 1,975,685 events, 15.0%;
     - `8-12h`: 671,651 events, 5.1%;
     - `12-24h`: 567,788 events, 4.3%;
     - `24h+`: 281,205 events, 2.1%.

4. **Built an inner-event shape diagnostics notebook.**
   - `notebooks/inner_event_shape_diagnostics.ipynb`
   - Uses event-summary proxies available in `events.parquet`:
     - `peak_to_mean = max_customers / mean_customers`;
     - `mean_to_peak = mean_customers / max_customers`;
     - `min_to_mean = min_customers / mean_customers`;
     - `observed_fraction = n_snapshots * 0.25 / duration_hours`;
     - `borderline_1h = duration_hours in [T, T+1h)`.
   - Generates national, county-threshold, example-county, toy-shape, and
     worked Concho outputs.

5. **Added visual toy examples for the five diagnostics.**
   - `diagnostic_shape_examples.png`
   - Shows what spike-like, plateau-like, restoration-tail, bridge-heavy, and
     threshold-borderline shapes look like in toy 15-minute paths.
   - Important caveat documented: these are visual examples only because the
     current event catalog stores event summaries, not full snapshot paths.

6. **Added worked Concho, TX cell-read example.**
   - `worked_concho_tx_inner_event_shape_read.csv`
   - `worked_concho_tx_inner_event_shape_read.png`
   - At `T=8h`:

     ```text
     events: 184
     median peak/mean: 2.61
     p90 peak/mean: 25.86
     spike-like share: 46.2%
     plateau-like share: 28.8%
     borderline +1h: 12.0%
     cell read: strong shape evidence · likely conservative; duration-alignment review
     ```

7. **Reframed "confidence" as "evidence + proxy posture."**
   - Updated docs and notebook language to use:

     ```text
     Strong evidence · balanced proxy
     Strong evidence · likely conservative
     Medium evidence · duration-alignment review
     Thin evidence · review
     ```

8. **Updated planning docs and indexes.**
   - Added `docs/plan/inner_event_shape_confidence_plan.md`, internally titled
     "Inner-Event Shape Cell-Read Plan."
   - Added it to `docs/plan/README.md`.
   - Added notebook entries to `notebooks/README.md`.
   - Linked the new discussion docs from the eventization README.

## Files Touched

### Created

- `docs/dicsscssion/eventization_frequency_contract/README.md`
- `docs/dicsscssion/eventization_frequency_contract/01_eventization_frequency_discussion.md`
- `docs/dicsscssion/eventization_frequency_contract/02_underwriter_confidence_framing.md`
- `docs/dicsscssion/eventization_frequency_contract/03_inner_event_shape_diagnostics.md`
- `docs/plan/inner_event_shape_confidence_plan.md`
- `notebooks/event_duration_bucket_analysis.ipynb`
- `notebooks/inner_event_shape_diagnostics.ipynb`
- `docs/extra/tasks_history/2026-06-21__eventization__cell-read-diagnostics/`

### Modified

- `docs/methodology/fundamentals/per_customer_pricing_fundamentals.md`
- `docs/plan/README.md`
- `docs/plan/risk_based_clustering_quantification_plan.md`
- `notebooks/README.md`

### Generated Locally

These are under `notebooks/outputs/` and are gitignored:

- `notebooks/outputs/event_duration_bucket_analysis/`
- `notebooks/outputs/event_duration_bucket_analysis_executed.ipynb`
- `notebooks/outputs/inner_event_shape_diagnostics.html`
- `notebooks/outputs/inner_event_shape_diagnostics/`
- `notebooks/outputs/inner_event_shape_diagnostics_executed.ipynb`

Important generated files:

- `county_duration_bucket_matrix.csv`
- `default_45min_duration_bucket_summary.csv`
- `default_45min_cumulative_threshold_summary.csv`
- `county_inner_event_shape_by_threshold.csv`
- `national_inner_event_shape_by_threshold.csv`
- `diagnostic_shape_examples.png`
- `worked_concho_tx_inner_event_shape_read.png`
- `worked_concho_tx_inner_event_shape_read.csv`

### Existing Modified / Unrelated Worktree Items

The working tree also contains changes not created by this final task-doc step
and not reverted:

- `InfraSure_Outage_Pricing_Methodology_Internal.pptx`
- `docs/methodology/InfraSure_Outage_Pricing_Methodology.md`

## Current Status

- [x] Eventization-frequency discussion folder exists and is linked.
- [x] Underwriter framing moved from generic confidence to cell read.
- [x] Per-customer fundamentals distinguish inner vs outer distributions.
- [x] Duration-bucket notebook executed and outputs generated.
- [x] Inner-event shape notebook executed in place and HTML exported.
- [x] Toy diagnostic visual examples generated.
- [x] Worked Concho, TX example generated.
- [x] Plan and README indexes updated.
- [x] Notebook JSON validation passed.
- [x] `git diff --check` passed on edited docs/notebooks.
- [ ] Cell-read metrics are not yet wired into the dashboard.
- [ ] No production pricing logic changed.
- [ ] Full 15-minute path features are not available from current event
  parquet; only summary proxies are used.

## Next Steps

1. Review the inner-event notebook and decide whether the five proxy flags are
   the right first-pass set.
2. Decide whether `cell_read(fips,T)` should be implemented as a dashboard-only
   review artifact or first as a generated JSON/CSV under `price_engine/catalogs`.
3. Decide naming for the production artifact:
   - `cell_read`;
   - `underwriting_read`;
   - `evidence_proxy_posture`;
   - or another clearer term.
4. If implementing, add fields:
   - `evidence_reliability`;
   - `proxy_posture`;
   - `review_reason`;
   - raw metrics such as `median_peak_to_mean`, `p90_peak_to_mean`,
     `share_spike_like_peak_to_mean_ge_3`, `share_borderline_within_1h`.
5. Use the cell-read output to unblock the next risk-based clustering
   discussion, especially where zeros/missingness or long-tail events create
   misleading trend labels.

