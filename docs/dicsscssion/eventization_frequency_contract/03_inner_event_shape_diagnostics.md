# Inner-Event Shape Diagnostics — discussion (RESOLVED)

**Status:** resolved — superseded by the validated 2-axis design
**Last reviewed:** 2026-06-22
**Scope:** this is the **audit trail** of the inner-event-shape exploration: what we
tested, what the real data said, and why the design ended where it did. The live
definition and engine now live in:

- **definition (carrier-facing):** [`cell_read_fundamentals.md`](../../methodology/02_per_customer/cell_read_fundamentals.md)
- **design + phases:** [`inner_event_shape_confidence_plan.md`](../../plan/cross_cutting/inner_event_shape_confidence_plan.md)
- **engine:** [`../../../notebooks/02_per_customer/inner_event_shape_diagnostics.ipynb`](../../../notebooks/02_per_customer/inner_event_shape_diagnostics.ipynb)

## The question this explored

The per-customer rate compresses each outage into `min / mean / max / n_snapshots /
duration`. We asked: *can those summaries tell us whether a county's qualifying events
are sustained, spiky, tail-heavy, or boundary-sensitive* — enough to flag whether the
mean-based per-customer proxy is conservative, balanced, or in need of review?

We started from **five candidate proxies** (peak/mean, mean/peak, min/mean,
observed_fraction, threshold-borderline). The exploration's job was to find out which
actually carry signal on real data.

## What the real catalog said (the verdict)

Run against the full `eagle-i-45min` catalog, three of the five did not survive:

```text
 proxy / flag           empirical finding                              verdict
 ───────────────────────────────────────────────────────────────────────────────────
 min_customers          median = 1 at EVERY T; ≤1 for 57-67% of        DEAD — degenerate
   → restoration-tail   events, ≤5 for 87-95%                          (fires on ~everything)
 observed_fraction      median = 1.000; < 0.75 for only 0.1-0.6%       INERT — rare QA flag
   → bridge-heavy       of events                                      (not a posture driver)
 peak_to_mean           median 1.54 → 7.26 as T 2h → 24h               CONFOUNDED by duration
   → spike-like (≥3)    (rises mechanically with duration)             → read as %ile WITHIN T
 mm_ratio (mean/median) ≈ 5-8× for the MEDIAN cell (heavy tail is      NON-DISCRIMINATING
                        the norm in outage data)                       → report, don't score
 borderline D∈[T,T+1h)  symptom of eventization sensitivity            REDUNDANT w/ 30/45/60 spread
```

The hard conclusion: **from event summaries, `peak_to_mean` is the only robust
within-event shape signal.** `min` is degenerate (~1 everywhere), so the catalog cannot
distinguish a true plateau from a spike-with-decay; that needs the 15-minute path
(a later, targeted step — not Gen-1). This is *why* the design collapsed from five flags
to a single, de-confounded posture signal.

## Where it landed — the 2-axis cell read

```text
 TRUST   weakest-link min( C_source , C_sample , C_evt )      Strong / Medium / Thin
           coverage (per-county observed yrs + known-gap flags) · volume · eventization stability
 POSTURE cushion LEVEL (absolute, by duration): short T → runs close (verify) ·
           long T → well-cushioned (conservative)   +   cushion TILT (within-T vs peers)
 reported, not scored: mm_ratio, pct_mcc_p90/p99, coverage_gate
```

Full plain-language definitions and worked counties are in
[`cell_read_fundamentals.md`](../../methodology/02_per_customer/cell_read_fundamentals.md).
Two findings worth carrying to carriers directly: **eventization is stable almost
everywhere** (λ spread median ~0.05-0.09 across 30/45/60 — gap tolerance moves almost no
prices), and **`C_source` replaced a flat global exposure number**, which surfaced the
exposure-dilution finding registered as
[A012](../../methodology/assumptions.md#a012--per-customer-exposure-uses-one-global-window-dilutes-partial-coverage-counties).

Current outputs (gitignored): `notebooks/outputs/inner_event_shape_diagnostics/`
(`county_cell_read_by_threshold.csv`, `national_cell_read_by_threshold.csv`,
`worked_counties_cell_read.csv`, `cell_read_shares_by_threshold.png`).

## What it can and cannot prove

**Can support:** a `POSTURE(fips,T)` read of the [A011](../../methodology/assumptions.md#a011--per-customer-multiplier-rests-on-a-synchronous-outage-approximation)
cushion direction; a `C_source`/`C_sample`/`C_evt` trust read; routing of which cells are
launch-ready vs review vs suppress.

**Cannot prove from summaries alone:** whether the *same* customers were out the whole
event; the exact plateau/restoration curve; cause attribution. Those need the 15-minute
path (Phase 4 of the plan) or external per-customer duration data (the PowerOutage.US
trial).

## Related discussion

- [`01_eventization_frequency_discussion.md`](01_eventization_frequency_discussion.md) — the upstream eventization/zero-vs-missing contract (still open, feeds Step 3).
- [`02_underwriter_confidence_framing.md`](02_underwriter_confidence_framing.md) — the original framing of evidence + proxy posture.
