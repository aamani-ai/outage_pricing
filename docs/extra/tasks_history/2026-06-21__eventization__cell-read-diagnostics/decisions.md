# Decisions

Each section is one decision made during the eventization / cell-read work.

## 1. Use "cell read" instead of a single confidence label

**Decision:** Replace the broad "confidence" framing with:

```text
cell_read(fips, T)
  = evidence reliability + proxy posture + review reason
```

**Rationale:** A single confidence score mixes different concepts:

- whether the source history is complete;
- whether there are enough qualifying events;
- whether the eventization rule is stable;
- whether the mean-based customer proxy is conservative, balanced, or
  duration-sensitive.

The underwriter needs to know both evidence strength and bias direction. A
county-threshold cell can have strong historical evidence but still need
duration-alignment review because the events are peak-driven or tail-heavy.

**Tradeoff considered:** Keep one score for simplicity. Rejected because it
would hide the most important underwriting distinction: "do we trust the data"
is not the same as "is the proxy conservative or overconfident."

## 2. Keep inner-event shape as a diagnostic, not a pricing input

**Decision:** Do not change active pricing from this work. Inner-event shape
metrics feed review language and future cell-read artifacts only.

**Rationale:** The current per-customer headline uses:

```text
multiplier_mean(f, T)
  = mean over qualifying events of mean_customers(e) / MCC(f)
```

This remains the right Gen 1 pricing estimator. `max_customers`, spike-like
share, plateau-like share, and restoration-tail proxies are useful evidence,
but they do not yet justify a new automatic multiplier.

**Tradeoff considered:** Use `max_customers` or spike-like share to adjust
price directly. Rejected for now because high peak/mean can mean several
different things: a reporting artifact, a short peak, a real restoration tail,
or a true major event. The safer first move is explanation and review routing.

## 3. Separate inner-event and across-event distributions

**Decision:** Document the two customer-impact distributions explicitly:

1. within one event: 15-minute customer-out observations summarized into
   `min_customers`, `mean_customers`, `max_customers`, `n_snapshots`;
2. across qualifying events: ratios such as `mean_customers(e) / MCC(f)` for
   all events clearing threshold `T`.

**Rationale:** The team was correctly asking whether "mean" and "max" referred
to within-event values or across-event summaries. The distinction is central:

- `mean_customers(e)` is an inner statistic;
- `multiplier_mean` is an outer aggregation;
- `multiplier_max` is inner max + outer mean.

**Tradeoff considered:** Leave this in code/schema docs only. Rejected because
this confusion will recur with underwriters and teammates unless it appears in
the methodology text.

## 4. Use event-summary proxies before rebuilding snapshot paths

**Decision:** Build the first diagnostic notebook from event-level summaries
already available in `events.parquet`, rather than rebuilding full 15-minute
paths immediately.

**Rationale:** The current catalog has enough fields for a first-pass read:

- `peak_to_mean`;
- `mean_to_peak`;
- `min_to_mean`;
- `observed_fraction`;
- `borderline_1h`.

These proxies answer enough to guide the discussion, even though they cannot
prove individual customer duration.

**Tradeoff considered:** Rebuild event paths from raw 15-minute snapshots now.
Rejected for this phase because it would add complexity before we decide
whether the proxy metrics are useful. The plan preserves this as Phase 4 if
needed.

## 5. Treat high peak-to-mean at long T as a posture signal, not an automatic defect

**Decision:** Do not interpret high peak-to-mean at `8h`/`12h` as simply low
confidence or bad data.

**Rationale:** A long county outage often starts with many customers out and
then restores gradually. That naturally creates a high `max_customers /
mean_customers` ratio. In pricing language, this can mean the mean-based
headline is conservative versus a peak-based price, but it may also mean the
event duration is not aligned with individual customer outage duration.

**Tradeoff considered:** Penalize any long-T high peak/mean cell. Rejected
because this would misclassify real restoration-tail events.

## 6. Use Concho, TX as the worked cell-read example

**Decision:** Add a worked Concho, TX example to the notebook and outputs.

**Rationale:** Concho was already part of the broader source-quality discussion
and has useful signal:

- enough `T>=8h` events to inspect (`184`);
- growing peak-to-mean intensity at longer thresholds;
- clear output label:

  ```text
  strong shape evidence · likely conservative; duration-alignment review
  ```

This makes the cell-read concept concrete.

## 7. Keep dashboard implementation out of scope for this phase

**Decision:** Do not wire cell-read labels into the dashboard yet.

**Rationale:** The terminology and metrics are still being reviewed. The right
sequence is:

```text
discussion docs -> notebook analytics -> team review -> generated artifact ->
dashboard surface
```

**Tradeoff considered:** Move quickly to dashboard labels. Rejected because the
labels will shape underwriting interpretation and should be reviewed first.

