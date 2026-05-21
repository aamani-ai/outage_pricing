# Decisions

Date: 2026-05-21

## 1. Keep `price_engine/` As The Canonical Baseline

### Decision

Develop the outage pricing engine in `price_engine/`, not inside
`docs/extra/outage_modeling_us/price_engine/v0/`.

### Rationale

The reference repo is useful as historical context, but active development
should happen in the main project. Versioning belongs in README/docs and catalog
metadata, not in a nested `v0/` source path.

## 2. Preserve v0 As Historical-Only And Empirical

### Decision

Keep v0 pricing based on observed EAGLE-I event counts and empirical survival:

```text
S(T) = count(duration >= T) / count(all events)
lambda(T) = count(duration >= T) / observation years
```

Do not introduce parametric distribution fitting, KDE, EVT, or copulas into v0
pricing yet.

### Rationale

The immediate product need is historical exceedance pricing from a constructed
event catalog. Distributional complexity may be useful later, but only if it
solves a concrete capability gap such as tail extrapolation, sparse-location
hazard construction, portfolio dependence, or forward-looking scenario
simulation.

## 3. Correct Annualization Before Modeling Anything More Advanced

### Decision

Use actual source observation years when annualizing event rates. Do not divide
by a naive 12 calendar years when the available observation window is about
11.2 years.

### Rationale

Annual event rate is a direct input to premium math. A small denominator bug can
shift `lambda(T)`, expected loss, survival-derived rates, and pricing decisions.
This is more important than adding sophisticated modeling layers.

## 4. Treat Event Threshold As A Catalog Choice

### Decision

Support 30, 45, and 60 minute event-stitching catalogs instead of choosing one
threshold too early.

### Rationale

Event definition materially changes counts and duration distributions. Internal
users should be able to compare catalog sensitivity before the team hardens one
definition into pricing policy.

## 5. Add Evidence Density To The Dashboard

### Decision

Add an event density / event volume layer alongside tier and pricing views.

### Rationale

Because the survival curve is empirical, the user's confidence should depend on
how much historical evidence exists. More events generally make the empirical
curve more stable; sparse counties should be interpreted with caution.

## 6. Separate Modelability From Severity

### Decision

Green/Amber/Red tier colors describe modelability and quote readiness, not
outage severity.

### Rationale

A county can be Green because it has enough evidence, not because outages are
small. The dashboard must make this explicit to avoid insurance/product users
misreading tier colors.

## 7. Keep Roadmap Dimensions Visible But Grey

### Decision

Show future modelability/readiness dimensions such as regulatory readiness,
trigger evidence, underwriting appetite, and compliance ops as grey roadmap
items.

### Rationale

The current v0 gates are mostly data/model gates. A real insurance product will
also need regulatory, trigger, underwriting, and operations readiness. Showing
these dimensions as grey keeps the distinction clear without pretending they
are already part of v0 pricing.

## 8. Create `curated_outage_data/` As A Separate Project Layer

### Decision

Create `curated_outage_data/` alongside `price_engine/` for event enrichment,
cause attribution, grid condition features, and forward-looking support.

### Rationale

The pricing engine should remain focused on reproducible historical pricing.
Cause, grid, utility, and weather enrichment are broader data products and need
their own plans, schemas, sources, validation rules, and learning notes.

## 9. Use Research-Reason-Decide-Plan-Execute-Feedback As The Curated Data Flow

### Decision

For each curated data phase, use a staged workflow:

```text
research -> reason -> decide -> plan -> execute -> feedback/learning
```

### Rationale

Source matching and cause attribution have many hidden assumptions. The staged
workflow prevents jumping from a plausible source to a production data join
without first documenting scope, evidence, failure modes, and validation.

## 10. Treat DOE-417/PNNL/NOAA As Complementary, Not Drop-In Truth

### Decision

Use DOE-417, PNNL, NOAA, weather, and utility/OMS sources as complementary
evidence for cause attribution and trigger validation.

### Rationale

These sources have different thresholds, reporting biases, temporal/spatial
granularity, and event definitions. They may be better aligned with major or
catastrophic events than with every county-level EAGLE-I outage event.

## 11. Separate Occurrence, Duration, Restoration, And Trigger Oracle Problems

### Decision

Do not collapse outage occurrence prediction, duration/restoration modeling,
pricing, and live payout trigger validation into one model.

### Rationale

Each layer answers a different question and can fail differently. Pricing may
use historical rates, restoration may need repair/crew/grid features, and a
contract trigger needs insurance-grade observability.

## 12. Use Goal-First Modeling For Hazard Work

### Decision

Document model choices by the goal they support: screening, pricing,
portfolio aggregation, mitigation, climate adjustment, underwriting, or claims
operations.

### Rationale

The right method depends on the decision. An empirical curve may be enough for
county outage pricing, while hail, wildfire, flood, or portfolio tail modeling
may require stochastic catalogs, spatial footprints, vulnerability curves, and
climate-conditioned scenarios.

## 13. Distinguish Loss Process From Loss Category

### Decision

Separate the loss process axis from the loss category axis.

```text
loss process: event-based, continuous, hybrid
loss category: revenue, generation, price, hazard, contractual, operational
```

### Rationale

These are different modeling dimensions. A solar project can have event-based
hail losses and continuous degradation losses, while both can affect the same
financial category such as revenue.

## 14. Historical Catalogs Can Support Portfolio Replay But Not All Tail Risk

### Decision

Use cleaned historical event catalogs for replay, co-trigger analysis, and
portfolio aggregation diagnostics, but do not treat them as complete rare-tail
event sets.

### Rationale

Historical catalogs preserve actual time/spatial co-occurrence. However, rare
and secondary hazards may be under-sampled, missing, biased, or non-stationary.
Stochastic catalogs and climate-conditioned event sets may be needed for
portfolio tail decisions.

## 15. Climate And Grid Adjustments Should Be Explicit Overlays

### Decision

Keep the v0 baseline unchanged, then evaluate adjustment overlays separately:

```text
lambda_adjusted = lambda_historical
  * credibility_modifier
  * regime_modifier
  * grid_condition_modifier
  * hazard_weather_modifier
  * location_basis_modifier
  * trigger_alignment_modifier
```

### Rationale

This makes each adjustment auditable. Modifiers should begin as `1.0`,
`not_used`, `unavailable`, or `gate_only`, not invented numeric uplift/discount
factors.

## 16. Save WISER And Similar Sources For Later Transcript Mining

### Decision

Bookmark the WISER North American Forecasting Model webinar and related outage
forecasting/weather/climate sources in
`docs/plan/outage_baseline_adjustment_framework.md`.

### Rationale

The source is likely useful, but it should not immediately change pricing. The
right next step is to extract transcript/slides into data sources, target
variables, spatial/temporal grain, validation metrics, and adjustment-feature
ideas.
