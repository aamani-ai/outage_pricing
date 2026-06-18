# Forward-Looking Modeling Plan

Date: 2026-05-18

## Goal

Move from a purely historical empirical premium to a forward-looking outage
pricing view that accounts for changing grid condition, utility management, and
hazard exposure.

For the consolidated modifier framework and source backlog, see
[`outage_baseline_adjustment_framework.md`](outage_baseline_adjustment_framework.md).
For the current pricing adjustment mechanism taxonomy, see
[`../dicsscssion/pricing_adjustment_mechanisms/01_pricing_adjustment_mechanism_design.md`](../dicsscssion/pricing_adjustment_mechanisms/01_pricing_adjustment_mechanism_design.md).

Bridge taxonomy note: this plan covers the `forward_regime` family. Customer
basis, location basis, and trigger-source alignment are `basis_alignment`
mechanisms. They can compose with forward-regime outputs in the premium-impact
view, but they are not forward-looking hazard/grid mechanisms.

This should not replace the current v0 engine immediately. The current engine is
the audit-friendly baseline. The forward-looking model should be an explicit
overlay that can be backtested, explained, capped, and turned off.

## Starting Point

Current v0 premium logic:

```text
premium = lambda(T) * payout / (1 - expense_ratio - target_margin)
```

Where `lambda(T)` is estimated from historical EAGLE-I outage event counts using
the corrected source exposure window.

Forward-looking modeling changes or reviews the future loss view through three
sibling lanes:

```text
predictability pattern read = empirical shape / routing
hazard & weather context    = storm, wildfire, flood, wind, climate
grid condition              = utility, infrastructure, restoration context
```

When the evidence is truly a frequency signal, the native output can be a
candidate forward lambda:

```text
lambda_forward(fips, T)
  = lambda_historical(fips, T)
    * grid_condition_modifier
    * hazard_modifier
    * credibility_modifier
```

Customer impact, location basis, and trigger alignment compose separately in
the broader premium-impact view. Keeping them separate avoids double counting
and keeps the reason for each factor visible.

The first version should keep this decomposition visible. If we later use a
statistical or machine-learning model, it should still report the components in
plain language.

## Model Components

### Historical baseline

Source: current EAGLE-I catalogs.

Purpose:

- empirical frequency by county and duration threshold
- event-duration survival
- modelability tier
- credibility weighting

This remains the anchor.

### Grid condition modifier

Potential features:

- utility reliability history: SAIDI, SAIFI, CAIDI
- reliability trend over trailing years
- AMI penetration
- distribution circuit indicators where available
- capex/O&M proxies
- utility ownership mix: IOU, co-op, municipal, public power
- service territory fragmentation

Interpretation:

This modifier asks whether the grid serving the county appears stronger or
weaker than the historical outage record alone implies.

### Hazard modifier

Potential features:

- storm event frequency by peril
- wind, hail, flood, winter storm, heat, cold, wildfire, hurricane tags
- seasonal event concentration
- disaster declaration history
- gridded weather extremes

Interpretation:

This modifier asks whether the county's outage-causing environment is changing
or whether a specific forecast horizon is elevated.

### Trigger alignment modifier

Source: future bridge dataset between EAGLE-I and a live trigger oracle.

Interpretation:

This adjusts county-level pricing frequency to the event definition that will
actually determine payouts.

This should not be guessed. Until we have overlap data, this modifier should be
`1.0` with a clear "not calibrated" status, or the county should remain
unavailable for trigger-adjusted pricing.

### Customer impact modifier (optional challenger)

> **Phased plan:** execution lives in
> [`per_customer_pricing_plan.md`](per_customer_pricing_plan.md). That plan
> sequences the customer-impact track **before** any of the forward-looking
> modifiers below, on the principle that you cannot honestly calibrate a
> ±20% climate/grid/hazard modifier on top of a baseline that is 30-100× off
> when read as per-customer.

Source: county aggregates of event-level customer-impact signals
(`max_customers`, `mean_customers`, `peak_out_pct_mcc`, planned
`customer_minutes_out`).

Interpretation:

This modifier asks whether the county event population, as constructed today,
fairly represents claim-relevant outages, or whether it is dominated by very
small events that inflate the qualifying-event count without matching realistic
loss experience.

Operating rules in the forward-looking context:

- Stays at `1.0` / `gate_only` until backtest evidence shows lift.
- Cap and floor must be set before any non-neutral value is used.
- Must not be used to silently lower premiums; non-quote (gate) is preferred to
  unbounded discount when severity evidence is weak.
- Must be reported as a separate column in challenger metrics, not folded into
  grid or hazard modifier outputs.

### Credibility modifier

Purpose:

- avoid overreacting to thin county data
- partially pool sparse counties toward state, FEMA region, utility class, or
  national baselines
- keep Green/Amber/Red modelability tied to actual data sufficiency

This is especially important for long-duration thresholds where observed event
counts are low.

## Candidate Methods

### Phase 0: transparent overlay

Use capped multiplicative modifiers from documented feature bins.

Pros:

- easy to explain
- easy to audit
- suitable for early underwriting conversations

Cons:

- less statistically efficient
- may miss interactions

### Phase 1: count and survival models

Use statistical models for:

- annual qualifying event counts by threshold
- event duration exceedance probability
- county-level random effects or partial pooling

Candidate families:

- Poisson or negative binomial count model
- logistic exceedance model for `duration >= T`
- survival model for duration curves
- hierarchical state/region pooling

### Phase 2: machine-learning challenger

Use gradient boosting or another interpretable challenger model once enriched
features are reliable.

Rules:

- compare against v0 and Phase 1 baselines
- require rolling-year backtests
- require feature importance and stability checks
- cap premium movement unless governance approves otherwise

## Backtesting Design

Use rolling-origin validation:

1. Train on years available up to `Y`.
2. Predict event rates for `Y + 1`.
3. Compare predicted and realized qualifying event counts by threshold.
4. Repeat across all possible years.

Metrics:

- calibration by duration threshold
- calibration by state/FEMA region
- observed vs expected event counts
- premium adequacy proxy
- rank stability
- top-risk capture
- residual bias by urban/rural, utility type, and data-quality tier
- residual bias by customer-impact intensity bins (e.g. low/medium/high
  `peak_out_pct_mcc`), so the customer-impact modifier is auditable as a
  separate effect

## Governance Rules

- Historical v0 remains the benchmark.
- Every feature must have a source, timestamp rule, and leakage rule.
- Same-year annual utility data cannot be used for a forecast unless it would
  have been available before pricing.
- Vendor trigger modifiers require documented overlap validation.
- Any forward-looking modifier must be inspectable at county level.
- The dashboard should label forward-looking outputs as projections, not
  historical rates.

## First Implementation Shape

The first implementation should create artifacts without replacing pricing:

- `forward_features.parquet`
- `forward_targets.parquet`
- `model_runs/<run_id>/metrics.json`
- `model_runs/<run_id>/county_predictions.parquet`
- `model_runs/<run_id>/model_card.md`

Dashboard integration should come later, after local reports prove the model is
stable and directionally useful.

## Open Decisions

- Should the first forecast horizon be one year, policy term, or seasonal?
- Should capex and reliability be modeled at utility level first or aggregated
  directly to county-year?
- Should forward-looking pricing adjust only `lambda(T)` or also the duration
  survival curve `S(T)`?
- How conservative should credibility pooling be for low-event counties?
- Should trigger alignment be an eligibility gate, a modifier, or both?
- Should the customer-impact modifier ever act as a numeric multiplier, or
  remain a non-quote gate, given that severity is observed in EAGLE-I but is
  not part of contract trigger today?

## Recommended Sequence

1. Finish enriched event datasets.
2. Build county-year targets for 30, 45, and 60 minute catalogs.
3. Run a v0 benchmark backtest using only historical event rates.
4. Add utility reliability and AMI features as the first forward-looking
   challenger.
5. Add storm/hazard features as the second challenger.
6. Add trigger alignment only after vendor overlap data exists.
7. Integrate only the stable pieces into the dashboard and pricing view.

## References Checked

- EIA-861 reliability and utility data:
  https://www.eia.gov/electricity/data/eia861/
- EIA reliability metric definitions:
  https://www.eia.gov/electricity/annual/table.php?t=epa_11_01
- NOAA Storm Events Database:
  https://www.ncei.noaa.gov/stormevents/
- EAGLE-I dataset descriptor:
  https://www.nature.com/articles/s41597-024-03095-5
