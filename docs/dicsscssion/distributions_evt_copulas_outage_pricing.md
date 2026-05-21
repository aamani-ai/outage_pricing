# Distributions, EVT, And Copulas For Outage Pricing

Date: 2026-05-18

## Question

How should we think about probability distributions, extreme-value theory
(EVT), and copulas for outage frequency and duration modeling? Are these better
methods we should use now, or do they require more data and a later modeling
stage?

## Short Answer

These tools are important, but they should not replace the current v0 empirical
engine yet.

The right sequence is:

```text
v0     empirical baseline: direct historical counting
v0.5   validation, uncertainty, credibility, distribution diagnostics
v0.7   optional tail model / partial pooling for sparse or high-threshold cases
v1     forward-looking model using hazards, grid condition, and trigger evidence
v1+    portfolio dependence: regional event clustering, copulas, capital model
```

The current v0 method is intentionally simple:

```text
lambda(T) = qualifying historical events at T / source observation years
premium   = lambda(T) * payout
```

That simplicity is a strength. It is transparent, backtrackable, and easy to
explain to insurance, product, and technical reviewers.

The next layer should quantify how much trust we should place in that empirical
number, not immediately replace it with a fitted model.

## Outage Empirical Baseline Versus Hazard Catalog Construction

This distinction is central.

For outage v0, empirical counting works because we have:

```text
event catalog already constructed
duration magnitude already observed
trigger is simple: duration >= T
historical window is reasonably long
goal is historical exceedance pricing
```

So the empirical formula is enough for the current question:

```text
S(T)      = count(duration >= T) / count(all events)
lambda(T) = count(duration >= T) / observation years
```

For many physical hazards, we often do not start with a clean, ready-to-price
event catalog. We may start with fragments:

```text
weather station observations
radar fields
reanalysis grids
damage reports
claims
remote sensing
engineering thresholds
short historical records
```

Example: hail.

```text
raw data = radar signatures + storm reports + sparse hail observations
need     = hail size at a specific asset location over many years
problem  = historical observations are incomplete and spatially biased
```

In that case, empirical counting alone may not be enough. The modeling work may
be required before the event catalog even exists:

```text
event detection
spatial interpolation
bias correction
parametric or semi-parametric tail model
stochastic event set
vulnerability model
```

This is why distributional assumptions are sometimes not decorative. They can
be the bridge from incomplete observations to usable risk estimates.

The modeling caution is not:

```text
do not fit distributions
```

The caution is:

```text
do not fit a distribution before knowing what capability it needs to provide
```

For hazards, the capability may be real:

| Need | Why empirical alone may fail | Model that may help |
|---|---|---|
| estimate rare hail size | few local observations | EVT / regional pooling |
| build spatial footprint | sparse reports | radar/reanalysis + interpolation |
| fill missing years | incomplete records | stochastic simulation |
| estimate location risk | observations not at asset | spatial hazard model |
| price portfolio tail | history too short | event set / cat simulation |
| model damage | hazard magnitude is not loss | vulnerability curve |

KDE can also have a place, especially for exploratory shape or smoothing inside
observed support. The main caution is using KDE for tails or extrapolation,
where it can create false comfort.

Refined rule:

```text
If the event catalog and magnitude are directly observed:
    empirical exceedance is a strong baseline.

If the event catalog or location magnitude must be inferred:
    modeling assumptions are part of the data construction itself.

If the question goes beyond observed support:
    parametric / EVT / simulation may be necessary.
```

For outage, EAGLE-I gives a fairly direct historical outage magnitude record
after event construction. For hail, flood, wind, wildfire, and similar hazards,
the "event catalog" is often already a model product. That is why RMS-style and
Verisk-style systems exist. They are not just pricing formulas; they are
machinery for constructing plausible event catalogs and footprints from
incomplete hazard evidence.

## Current v0 Baseline

Current v0 uses no fitted duration distribution.

For a county:

```text
S(T) = count(events with duration_hours >= T) / count(all events)

n_per_year = count(all events) / source observation years

lambda(T) = n_per_year * S(T)
          = count(events with duration_hours >= T) / source observation years
```

So v0 is really pricing from the observed historical qualifying-event rate.

Example:

```text
source observation years = 11.167
events >= 8h             = 80

lambda(8h) = 80 / 11.167 = 7.16 qualifying events per year
```

No Lognormal, Weibull, Exponential, GPD, Poisson-duration model, simulation, or
copula is used to produce that v0 `lambda(T)`.

## Nonparametric Does Not Mean KDE

One important nuance from the outage-pricing discussion:

```text
nonparametric != KDE only
```

KDE is one nonparametric method, but it is not the only one. The empirical CDF,
empirical survival curve, histogram, and raw event list are also nonparametric
ways to describe data.

For our current pricing use case, the most natural nonparametric object is the
empirical survival curve:

```text
S(T) = count(duration >= T) / count(all durations)
```

That is different from KDE.

| Method | Type | What it estimates | Pricing relevance |
|---|---|---|---|
| raw event list | empirical / nonparametric | observed durations directly | strongest source for direct counting |
| empirical CDF / survival | empirical / nonparametric | cumulative / exceedance probability | current v0 pricing method |
| histogram | nonparametric summary | binned counts | useful for visual diagnosis |
| KDE | nonparametric smoothing | PDF-like density shape | useful for body visualization, weak for tail pricing |
| Lognormal / Weibull | parametric | full fitted duration family | diagnostic or future pricing candidate |
| GPD / EVT | parametric tail model | exceedance tail beyond threshold | tail diagnostic / possible v0.7 layer |

KDE answers a density-shape question:

```text
Where is the duration distribution concentrated?
```

The premium engine asks an exceedance question:

```text
How many historical events lasted at least T hours?
```

Those are related, but they are not the same. For exceedance pricing, direct
empirical counting is cleaner than smoothing a density and integrating it back
into a tail probability.

## Middle Trigger Values

If a user asks for a trigger between grid points, such as `T = 6h`, there are
three conceptually different answers:

| Approach | Example | When appropriate |
|---|---|---|
| exact empirical count | count events with `duration_hours >= 6` | best when raw durations are available |
| visual interpolation | interpolate between `S(4h)` and `S(8h)` | chart display only, not preferred for pricing |
| fitted distribution | evaluate fitted `S(6h)` | only when the fitted model has been justified |

Because we have `county_durations.parquet`, the best empirical answer is not to
interpolate. It is to count the actual events above the requested threshold.

Example:

```text
100 total events
25 events >= 4h
17 events >= 6h
10 events >= 8h

S(4h) = 25%
S(6h) = 17%
S(8h) = 10%
```

If the dashboard only knows the grid points `4h` and `8h`, it might draw an
interpolated line around the middle. But the pricing engine can calculate the
true empirical `S(6h)` directly from event durations.

Dashboard nuance: the current survival chart draws a smooth-looking line
through the fixed grid points. That visual should be read as display
interpolation, not fitted distributional inference. A step curve or explicit
label would be more honest.

## Complexity Must Buy A Capability

The modeling lesson here is not "avoid distributions." The lesson is:

```text
add distributional complexity only when it buys a capability the empirical
method cannot provide
```

Useful capabilities include:

| Capability | Empirical counting | Added model that may help |
|---|---|---|
| describe observed trigger history | strong | usually not needed |
| price a supported middle `T` | strong if raw durations exist | usually not needed |
| quantify sampling uncertainty | needs bootstrap / intervals | binomial, bootstrap, Bayesian intervals |
| stabilize sparse counties | weak | credibility / hierarchical pooling |
| extrapolate beyond observed support | cannot do it | EVT / tail model |
| forecast future regime shifts | weak | hazard, grid, cause, climate covariates |
| aggregate portfolio tail risk | weak | event replay, dependence model, copulas |

So the burden of proof is on the added model:

```text
What specific failure of the empirical baseline is this model fixing?
What new decision can we make because of the added model?
How do we validate that the added complexity improved the answer?
```

## The Three Separate Modeling Problems

These concepts are related, but they answer different questions.

| Problem | Question | Current v0 answer | More advanced tool |
|---|---|---|---|
| Frequency | How often do outage events occur? | historical events / years | Poisson, negative binomial, seasonal count models |
| Duration | Given an event, how long does it last? | empirical `S(T)` | Lognormal, Weibull, GPD, mixture models |
| Dependence | Which counties or policies are hit together? | not modeled in standalone v0 | event clustering, spatial dependence, copulas |

The pricing formula combines frequency and duration:

```text
lambda(T) = event frequency * probability(duration >= T)
```

For a fixed per-event payout, this is enough for a standalone county premium.
For portfolio pricing, capital, and reinsurance, dependence becomes essential.

## Frequency Modeling

### What We Have Now

v0 annualizes observed event counts:

```text
n_per_year = total_events / source_observation_years
```

This is a point estimate. It does not yet ask whether the count process is
stable, overdispersed, seasonal, storm-driven, or changing over time.

### Candidate Frequency Models

| Model | Use case | Caution |
|---|---|---|
| Poisson | simple baseline where mean roughly equals variance | often too thin for weather-driven outages |
| Negative binomial | overdispersed counts; storm years create clustering | needs enough years to estimate dispersion |
| Seasonal model | monthly or seasonal rate changes | needs stable seasonal history |
| Hierarchical regional model | sparse county data; partial pooling | requires defensible pooling regions |
| Forward-looking count model | hazard/grid/climate covariates | needs external features and validation |

My view: Poisson is fine as a diagnostic baseline, but outages are likely
overdispersed. Negative binomial or hierarchical regional models are more
realistic once we go beyond v0.

### What To Do Next

For v0.5, run frequency diagnostics:

```text
[ ] annual event counts by county
[ ] mean versus variance by county / state / region
[ ] Poisson expected variance check
[ ] negative-binomial overdispersion estimate where enough years exist
[ ] year concentration index: how much one storm year dominates history
```

This should feed uncertainty and modelability, not replace the v0 number yet.

## Duration Distributions

### What We Have Now

v0 uses the empirical duration survival:

```text
S(T) = qualifying events / all events
```

This is strongest when:

- total event count is high;
- qualifying count at the selected `T` is not tiny;
- the selected `T` is inside the observed data support;
- the county has enough years to cover seasonality and storm cycles.

This is weak when:

- the county has few events;
- `T` is high, such as 24h or 48h;
- one or two extreme events dominate the tail;
- the county's event history is short or unstable.

### Candidate Duration Families

| Family | Why it may fit outage durations | Caution |
|---|---|---|
| Lognormal | right-skewed, heavy-ish tail, common in restoration time work | can absorb mixed causes but parameters may not be physical |
| Weibull | flexible hazard shape; can model decreasing or increasing restoration hazard | tail may still be too light for catastrophes |
| Exponential | simple memoryless baseline | likely too simplistic |
| GPD / POT | tail-focused model for exceedances above high threshold | needs enough exceedances; threshold choice matters |
| Mixture model | routine outages plus storm/cat outages | needs cause or event-class information to defend |

My view: Lognormal and Weibull are good diagnostic fits. GPD is the right
tail stress test. But fitting one family county-by-county and calling it truth
would be premature.

### What To Do Next

For high-volume counties, compare:

```text
empirical S(T)
bootstrap CI for empirical S(T)
Lognormal-implied S(T)
Weibull-implied S(T)
POT-GPD-implied S(T), where enough tail exceedances exist
```

At each standard threshold:

```text
T in {2h, 4h, 8h, 12h, 24h}
```

The key output should be a diagnostic table:

| County | T | empirical S(T) | fitted range | disagreement | action |
|---|---:|---:|---:|---:|---|
| example | 12h | 0.04 | 0.03-0.08 | 2.0x | review / load |

The point is not to pick a beautiful curve. The point is to identify where the
empirical number is stable and where the tail is uncertain.

## Extreme-Value Theory

EVT is useful for the long-duration tail:

```text
24h, 48h, 72h+ outages
```

The most practical version is peaks over threshold:

```text
choose threshold u
model excess = duration - u | duration > u
fit GPD to excesses
estimate P(duration >= T) for T > u
```

### Why EVT Helps

EVT focuses on exactly the part of the distribution that matters for high
deductibles and catastrophic outage pricing. Body-fit metrics can look good
while the tail is wrong. EVT forces us to look at the tail directly.

### Why EVT Is Not A v0 Replacement

County-level tail data may be thin. If a county has only 10 events above 12h,
a GPD fit may be less stable than the raw empirical count.

EVT becomes more defensible when we have:

- enough exceedances above the threshold;
- regional pooling;
- cause or storm-event classification;
- tail diagnostics across states or hazard regions;
- validation against external sources.

My view: use EVT first as a tail diagnostic and stress test. Do not use it as
the main pricing engine until we have clear thresholds, enough exceedances, and
pooling rules.

## Copulas And Dependence

Copulas model dependence between random variables after their marginal
distributions are specified.

In this project, copulas could eventually connect:

- county event frequencies across space;
- event durations across counties hit by the same storm;
- outage duration and customers affected;
- trigger frequency and payout severity;
- policy losses across a portfolio.

### Where Copulas Are Useful

Copulas are most useful for portfolio questions:

```text
If we write many policies, how often do many of them trigger together?
How large can annual aggregate loss become?
How much capital or reinsurance do we need?
```

They are less important for the first standalone county price where payout is
fixed per event and we are pricing one policy independently.

### Recommended Order

Do not start with abstract copulas. Start with event-based dependence:

```text
1. Identify regional outage events across counties.
2. Build a county-event incidence matrix.
3. Measure co-trigger rates by distance, state, region, and storm type.
4. Estimate portfolio loss by replaying historical regional events.
5. Add copulas only if the event-replay approach is not enough.
```

This is more explainable to insurance reviewers than jumping straight to a
Gaussian or t-copula.

My view: copulas are a v1+ portfolio modeling tool, not a v0.5 single-county
premium tool.

## What Data We Need Before Going Further

Advanced models become more defensible with more context.

| Need | Why it matters |
|---|---|
| cause labels | separates routine outages from storm/cat outages |
| regional event IDs | supports dependence and portfolio replay |
| weather/hazard data | enables forward-looking frequency and duration |
| utility territory | county is too coarse for some outage behavior |
| live trigger overlap | measures EAGLE-I to trigger-source alignment |
| customer/policy exposure | needed for portfolio aggregation |
| external validation | checks that EAGLE-I-derived events are not biased |

Without these, distributions can still be useful, but mostly as diagnostics and
uncertainty tools.

## My Recommendation

Do not replace v0 empirical pricing now.

Instead, add a validation and uncertainty layer that asks:

```text
How much should we trust the empirical rate in this county at this T?
```

### Near-Term v0.5 Work

1. Add event-density / event-volume map layer.
2. Add qualifying-event count at each `T`.
3. Add binomial confidence bands for empirical `S(T)`.
4. Add Poisson and negative-binomial diagnostics for annual counts.
5. Add bootstrap confidence intervals for `lambda(T)`.
6. Fit Lognormal and Weibull only as diagnostics in high-volume counties.
7. Fit POT-GPD only where tail exceedance count is high enough.
8. Compare fitted tail versus empirical tail and flag disagreement.
9. Convert uncertainty into either a load or a tier downgrade.

### Medium-Term v0.7 Work

1. Build regional priors for sparse counties.
2. Use credibility blending:

```text
lambda_blended = Z * lambda_county + (1 - Z) * lambda_region
```

3. Explore hierarchical duration/tail models by state, FEMA region, climate
   zone, utility territory, or hazard region.
4. Decide whether fitted duration models should ever drive pricing directly.

### v1 And Portfolio Work

1. Add forward-looking covariates:
   - weather and hazard trends;
   - utility capex and reliability;
   - grid age and vegetation risk;
   - trigger-source coverage.
2. Identify regional multi-county outage events.
3. Replay historical regional events against a portfolio.
4. Add copulas or spatial catastrophe-style simulation only after event replay
   shows what dependence structure we need.

## Decision Rules

Use these rules to avoid over-modeling:

```text
If T is well supported by observed events:
    use empirical S(T), with confidence bands.

If T is between standard grid points and raw durations are available:
    count events directly at that T; do not interpolate for pricing.

If T is in the sparse tail but there are enough exceedances:
    use EVT/GPD as a diagnostic and possible uncertainty load.

If county data is sparse:
    use credibility blending or regional pooling before fitting a county-only tail model.

If pricing one standalone policy:
    copulas are usually not needed.

If pricing a portfolio:
    start with historical event replay and co-trigger matrices; consider copulas later.

If a fitted model disagrees strongly with empirical data:
    do not hide the disagreement; flag it as model uncertainty.
```

## Bottom Line

Distributions, EVT, and copulas are the right modeling vocabulary, but the
right implementation sequence matters.

The current v0 empirical baseline is not naive. It is deliberately transparent.
The next serious step is not "fit a better curve everywhere." The next serious
step is:

```text
empirical estimate
+ confidence interval
+ credibility / regional comparison
+ tail diagnostic
+ clear modelability signal
```

Only after that should a fitted distribution become part of the primary pricing
engine.
