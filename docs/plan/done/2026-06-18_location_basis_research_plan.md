# Location Basis — Within-County Signal Research Plan

Date: 2026-06-17

## Status

Research plan. No pricing change. **No assumed feature set and no assumed
dataset.** This plan exists to *find out* which variables and which sources
actually explain within-county outage variation, rather than adopting the
candidate list from the 2026-06-17 meeting on faith.

Companions: engineering pre-op
[`location_basis_risk_preop_plan.md`](2026-06-17_location_basis_risk_preop_plan.md);
design note
[`../dicsscssion/location_aware_outage_pricing/03_location_basis_risk_design.md`](../../dicsscssion/location_aware_outage_pricing/03_location_basis_risk_design.md);
spatial entity reference
[`../extra/poweroutage_us/docs/09_spatial_entity_resolution.md`](../../extra/poweroutage_us/docs/09_spatial_entity_resolution.md).

## The correction this plan encodes

The meeting proposed vegetation, elevation, urban/rural, and utility identity as
location-basis inputs. Those are reasonable **physical priors**, but they are
hypotheses. We have an observed outcome dataset (PoUS city × utility) that can
test them. So:

```text
Do not assume which variables matter. Do not assume which dataset is best.
Measure it: regress an OBSERVED within-county outage signal on POINT-RESOLVABLE
candidate features, and keep only what earns its place.
```

A feature or source enters the model because it demonstrably explains the
target, is resolvable at a point nationally, and does not double-count another
lane — not because it sounded right in a discussion.

## The question

> Which point-resolvable features predict a location's outage experience
> *relative to its county average*, and which datasets supply them — judged by
> validated explanatory power, availability, and interpretability, not by
> plausibility?

## The validation target (the ground truth we regress against)

The one dataset we hold that resolves below county grain: the PoUS
**CT / MA / RI, Jan–Mar 2019, city × utility** sample (53,190 rows, 475 series,
27 counties; see [`06_findings.md`](../../extra/poweroutage_us/docs/06_findings.md)
Finding 5).

Define, per city (or city × utility), a **within-county relative outage signal**
— e.g. the city's qualifying-event rate / duration-time normalized by its
county average — constructed so that it is **mean-1, exposure-weighted within
each county** (the conservation constraint: location basis redistributes risk
inside a county, it does not change the county total). This distribution *is*
the empirical `location_basis_modifier` for the pilot. The existing
`city_vs_county_multiplier.py` and `county_synchrony_probe.csv` are the starting
point, not a finished target.

Honest ceiling, stated up front: this target is **city grain, one region, one
season (a quiet Q1 with one nor'easter).** It can rank/validate candidate
features; it cannot itself close the city→premise last mile, and it must be
replicated (e.g. TX, a storm season) before any feature is trusted nationally.

## Candidate signal universe — hypotheses, deliberately broader than the meeting

Each row is a hypothesis to be tested, not a commitment. "Lane" flags whether it
plausibly drives event **frequency** vs restoration **duration**, and whether it
belongs to location-basis (static, within-county) or risks bleeding into the
forward-regime / grid-condition / hazard lanes (which must not be double-counted
here — that signal is Sarasi's residual model's job).

| Family | Candidate features | Candidate source (to evaluate, not assume) | Lane | Double-count risk |
|---|---|---|---|---|
| Utility identity | which utility serves the point; operator | PoUS `CityByUtility` (pilot); HIFLD service territories (national) | duration + freq | grid-condition (forward capex/opex) |
| Utility reliability | SAIDI / SAIFI / CAIDI, customers, density | EIA-861 (annual, utility-level — must be spread) | duration | grid-condition |
| Vegetation / land cover | canopy %, land-cover class | NLCD / tree-canopy, 30 m | frequency | hazard (wind/fire) |
| Built density / undergrounding proxy | housing & pop density, housing vintage | Census / ACS | frequency + duration | — |
| Urban/rural | RUCA / urban-area classification | Census, USDA | frequency + duration | — |
| Terrain | elevation, slope, ruggedness | USGS 3DEP DEM | frequency | hazard (flood) |
| Exposure geometry | distance to coast / water; transmission proximity | HIFLD, Census TIGER | frequency | hazard |
| Hazard climatology | lightning density, wind/ice/fire climatology | Vaisala (licensed), USFS WHP, NOAA | frequency | **high — likely belongs in hazard lane** |
| Direct observation | historical sub-county outage rate | PoUS itself | both | this is the target, not a feature |
| Parcel | tax-lot attributes | free subsets; paid aggregators (~$50–100k) | both | premise-level (later) |

## Sharp hypotheses worth settling early

- **H1 (parsimony):** within-county variation is dominated by **utility identity
  + rurality**, and the geo-feature stack (canopy/terrain/etc.) adds only
  marginal lift. If true, the defensible model is small and explainable — the
  best outcome.
- **H2 (frequency vs duration split):** geo/vegetation features predict outage
  *frequency*; utility features predict *duration*. If so, the modifier should
  act on the two separately, not as one blended multiplier.
- **H3 (signal vs noise floor):** with one quiet season, much of the measured
  city spread may be sampling noise, not structural. Quantify how much of the
  12.5×–34× worst-city spread survives a noise/credibility floor.
- **H4 (dataset sufficiency):** free public sources (NLCD, 3DEP, HIFLD,
  EIA-861, Census) may be enough; the paid parcel data may not earn its cost for
  Gen-1. Test before recommending any purchase.

## Selection / falsification criteria

A candidate feature is **kept** only if it:

1. explains within-county variance against the PoUS target *beyond* the county
   baseline (incremental, not just correlated with county level);
2. is resolvable at an arbitrary lat/lon **nationally**, not just in the pilot;
3. has an **interpretable sign** (we can say in one sentence why it raises or
   lowers risk);
4. does not duplicate another lane's signal (esp. forward hazard / grid).

A candidate is **dropped** if its lift vanishes under cross-validation, if it
only works in-region, or if it is collinear with a simpler kept feature.

## Sequence

1. **Build the target.** From the PoUS sample, compute the within-county
   relative outage signal (mean-1, exposure-weighted), at city and city×utility
   grain, for several thresholds T. Characterize its distribution and how much
   survives a noise floor (H3). Reuse/extend `city_vs_county_multiplier.py`.
2. **Assemble the candidate feature matrix** at city grain — start with the free,
   point-resolvable sources; confirm each one's availability and join quality
   *as part of the research* (this is where "which dataset" gets answered).
3. **Test explanatory power** — univariate first (rank raw lift), then
   multivariate with cross-validation; explicitly check H1/H2 and guard the
   duration/synchrony confound documented in Finding 5.
4. **Rank and prune** to the minimal defensible feature set per the criteria.
5. **Only then** translate findings into a modifier form + cap and feed the
   design-doc update and the actuarial-consultant 2–3 pager — so neither ships an
   unvalidated variable.

## What this plan deliberately does NOT do

- It does not change v0 pricing.
- It does not pick the location *unit* by fiat (that's the units-as-roles
  discussion); it works at the grain the outcome data supports (city), and lets
  the feature results inform how far down we can credibly push.
- It does not model forward hazard, storm regime, or grid capex/opex — those are
  separate lanes and must not be back-doored in through a "location" feature.

## Open risks

- One region / one quiet season is thin; treat all v1 findings as provisional
  until replicated.
- Utility identity may be the dominant signal *and* the messiest to resolve
  nationally (HIFLD territories are approximate, many:many).
- The city→premise last mile stays open; this research bounds and prioritizes
  the prior, it does not close it.
