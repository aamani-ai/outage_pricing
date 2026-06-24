# Findings: Northeast Forecast Candidate Routing

Date: 2026-06-24

## Quick Read

I joined the Sarasi candidate outputs to our current regime buckets and scored
held-out 2023-2025 event-count predictions across the dashboard-overlapping
thresholds:

```text
4h / 8h / 12h / 24h
```

The point is not to pick one global winner. The useful signal is that method
choice should depend on the county behavior bucket.

## Core Result

```text
Best single global method:
  Linear Trend WAPE ~0.177

Simple bucket router:
  Stable     -> County-History Joint
  Non-stable -> Linear Trend

Router WAPE ~0.167

Lift vs best global method:
  ~5.7%
```

This Northeast example already shows why bucket-based forecasting matters.

- If we force one global model, Linear Trend wins overall.
- But stable counties are better served by historical climatology.
- Trend-like and shift-like counties benefit from forward extrapolation.
- So the regime bucket is doing useful work: it tells us when to trust the
  mean/history and when to forecast forward.

## Bucket-Level Read

Scope:

```text
Region:      Northeast
Years:       held-out 2023-2025
Target:      event counts
Thresholds:  4h / 8h / 12h / 24h
Metric:      WAPE vs observed count
Buckets:     stable / trend / shift / insufficient
```

| Bucket | Current winner | WAPE | Runner-up | Nuance read |
|---|---:|---:|---:|---|
| Stable | County-History Joint | 0.158 | Linear Trend / XGB | Stable counties should stay closer to climatology/history; extrapolation adds noise. |
| Trend | Linear Trend | 0.151 | XGB-PCs | Clear signal: trend counties benefit from extrapolation. |
| Shift | Linear Trend | 0.175 | XGB-PCs | Linear Trend likely wins because the current candidate set is missing the natural shift experts: recent mean, persistence/last-level, and changepoint plateau. |
| Insufficient | Linear Trend | 0.312 | County-History Joint | Too thin to make a strong rule; treat as fallback evidence only. |

At 8h, where the current regime definition is anchored, the read is similar:

| Bucket | Current winner | WAPE | Runner-up | Margin |
|---|---:|---:|---:|---:|
| Stable | County-History Joint | 0.159 | XGB-PCs | ~10% |
| Trend | Linear Trend | 0.152 | XGB-PCs | ~43% |
| Shift | Linear Trend | 0.185 | XGB-PCs | ~14% |
| Insufficient | Linear Trend | 0.337 | County-History Joint | ~18% |

## XGB-PCs Clarification

The README says the notebook's "winner" is chosen among the ML runs only:

```text
ML/weather candidates:
  XGB-features
  GLM-features
  XGB-PCs
  GLM-PCs

Reference baselines:
  County-History Joint
  Linear Trend
```

So the statement that XGB-PCs is the winner appears to mean:

```text
XGB-PCs is the best ML/weather challenger.
```

It does not mean:

```text
XGB-PCs is the best forecasting method overall.
```

When the simple baselines are allowed to compete as real forecasting candidates,
Linear Trend is the best single global method in this export, and
County-History Joint is best for stable counties.

That distinction matters for pricing. In the routing layer, the simple baselines
are not just references; they are legitimate forecast experts.

## Product Interpretation

The clean story is:

```text
One global model:
  Linear Trend wins overall.

Bucket-aware model choice:
  Stable counties should stay closer to history/climatology.
  Non-stable counties currently prefer Linear Trend.

Result:
  A simple regime router beats the best single global method.
```

This supports the use of a cluster-based forecasting layer. The current evidence
does not yet support a complex many-method router, but it does support a simple
and useful two-expert router:

```text
Stable      -> County-History Joint
Non-stable  -> Linear Trend
```

## Cautionary Takeaway

This should change the forward-model build order.

Even if we do not yet have a complex weather / climate / ML model, we may get a
useful forward-looking layer by picking the right simple statistical forecast
candidate for each behavior bucket.

This does not depend on County-History Joint specifically. If that model is too
heavy for the first national pass, a plain empirical-history / flat-mean expert
can still serve as the stable-bucket candidate. The broader point is the
statistical routing idea.

The immediate candidates are:

```text
stable      -> history / climatology
trend       -> linear or robust trend
shift       -> recent mean, persistence / last-level, changepoint plateau
episodic    -> storm-tail / hazard-review treatment
insufficient-> credibility / shrinkage / no forced move
```

The practical implication is:

```text
Do not benchmark weather ML only against a weak flat mean.
Benchmark it against the best routed statistical baseline.
```

So the next actionable step is a national, cluster-based statistical-router
backtest on our side. That should be enough to get the forward-looking piece
started, while leaving weather, climate, and grid conditioning as later
challengers that must add value beyond the routed baseline.

## Next Step

The next step should be to run this nationally and add the missing shift-style
candidates:

- recent mean
- persistence / last-level
- changepoint plateau

That should give us a much better method-by-bucket routing rule across the US,
especially for shift counties where Linear Trend may currently be winning only
because the more natural shift experts are absent.

## Current Limits

- The local Sarasi export is Northeast only.
- The export has no episodic counties under the current regime labels, so the
  episodic bucket cannot be tested here.
- The export has thresholds `0h / 1h / 4h / 8h / 12h / 16h / 20h / 24h`, so it
  does not directly test the dashboard's `2h` trigger.
- The customer-exposure export is useful for translation, but the local file does
  not include observed customer exposure, so this finding is based on event-count
  prediction.
