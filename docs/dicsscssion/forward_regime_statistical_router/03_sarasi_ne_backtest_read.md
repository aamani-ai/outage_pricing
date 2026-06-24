# Sarasi Northeast Backtest Read

**Status:** discussion / evidence note  
**Date:** 2026-06-24  
**Source:** [`../../extra/sarasi_weather_outage_model/findings.md`](../../extra/sarasi_weather_outage_model/findings.md)

---

## 1. What Was Tested

The local Sarasi export provides forecast candidates for Northeast counties:

```text
Region:      Northeast
Counties:    244
Test years:  2023, 2024, 2025
Target:      event counts
Thresholds:  0h, 1h, 4h, 8h, 12h, 16h, 20h, 24h
Runs:        XGB-features, GLM-features, XGB-PCs, GLM-PCs,
             County-History Joint, Linear Trend
```

For the product-relevant read, the scored set was the overlap with current
dashboard triggers:

```text
4h / 8h / 12h / 24h
```

The current national regime classification joined cleanly:

```text
244 / 244 Northeast counties matched to regime labels
```

Northeast regime mix:

```text
stable          139 counties
trend            64
shift            28
insufficient     13
episodic          0
```

So this export can test stable / trend / shift directionally. It cannot test
episodic.

---

## 2. Headline Result

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

This is the first practical evidence that the regime bucket is doing useful
forecast work:

```text
it tells us when to trust history, and when to forecast forward.
```

---

## 3. Bucket-Level Read

Across `4h / 8h / 12h / 24h`:

| Bucket | Current winner | WAPE | Runner-up | Nuance read |
|---|---:|---:|---:|---|
| Stable | County-History Joint | 0.158 | Linear Trend / XGB | Stable counties should stay closer to climatology/history; extrapolation adds noise. |
| Trend | Linear Trend | 0.151 | XGB-PCs | Clear signal: trend counties benefit from extrapolation. |
| Shift | Linear Trend | 0.175 | XGB-PCs | Linear Trend likely wins because the current candidate set is missing the natural shift experts: recent mean, persistence/last-level, and changepoint plateau. |
| Insufficient | Linear Trend | 0.312 | County-History Joint | Too thin to make a strong rule; treat as fallback evidence only. |

At `8h`, where the regime definition is anchored:

| Bucket | Current winner | WAPE | Runner-up | Margin |
|---|---:|---:|---:|---:|
| Stable | County-History Joint | 0.159 | XGB-PCs | ~10% |
| Trend | Linear Trend | 0.152 | XGB-PCs | ~43% |
| Shift | Linear Trend | 0.185 | XGB-PCs | ~14% |
| Insufficient | Linear Trend | 0.337 | County-History Joint | ~18% |

---

## 4. Why This Is Not "XGB-PCs Wins"

The Sarasi README says the notebook chooses the "winner" among ML runs only:

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

So XGB-PCs appears to mean:

```text
best ML/weather challenger
```

It does not mean:

```text
best forecasting method overall
```

When the baselines are allowed to compete as real forecast experts:

```text
dashboard-overlap thresholds, all Northeast cells:

Linear Trend           WAPE ~0.177
County-History Joint   WAPE ~0.200
XGB-PCs                WAPE ~0.208
XGB-features           WAPE ~0.231
GLM-features           WAPE ~0.365
GLM-PCs                WAPE ~0.386
```

For pricing, the simple baselines are not just references. They are legitimate
forecast candidates in the routing layer.

---

## 5. The Useful Cautionary Tale

This small example should change the build order:

```text
Do not ask a complex weather / ML model to beat only a weak flat mean.
Ask it to beat the best routed statistical baseline.
```

And do not overread "County-History Joint" as a required dependency. It is a
history/climatology expert in this export. If the first national notebook uses a
plain flat mean or another simple empirical-history proxy, the lesson is the
same:

```text
pick the right statistical candidate class for the right regime bucket.
```

The first national Step-05 trial should therefore be:

```text
build a national simple statistical router
then let weather / climate / grid models challenge it
```

That gives us an actionable forward-looking layer without needing to overclaim
causality.

It also clarifies the threshold question. Sarasi is right that model selection
for an `8h` product should be checked at `8h`, not only on an aggregate across
all thresholds. Tail thresholds can have different skill patterns.

But that is a second-order refinement, not a reason to skip the county-regime
router. The current Step-3 clustering is intentionally one primary regime per
county because the first job is to identify the county's dominant nature:

```text
stable / trend / shift / episodic / insufficient
```

After that first-order router is proven, the next question is:

```text
within this county nature, do some thresholds need a different expert?
```

So the national notebook should report both:

```text
1. bucket-level routing: regime -> expert
2. threshold refinement: regime x T -> expert
```

and only adopt the second if it adds stable out-of-sample lift.

---

## 6. Current Limits

- Northeast only.
- No episodic counties under the current regime labels.
- No direct `2h` output in the Sarasi export.
- Customer-exposure export does not include observed customer exposure locally,
  so the clean score is event-count prediction.
- Shift is under-tested because the candidate set lacks recent mean,
  persistence, and changepoint plateau.

These limits do not invalidate the result. They define the next national
notebook.
