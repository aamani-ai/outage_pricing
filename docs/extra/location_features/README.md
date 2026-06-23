# Location Features — point-resolvable features for within-county location basis

A separate data workstream (sibling to [`../poweroutage_us/`](../poweroutage_us/))
for the **external, point-resolvable feature data** used to build the
within-county **location-basis** layer — and, later, adjacent grid-condition
features.

> **New to this workstream?** Start with [`docs/00_concepts.md`](docs/00_concepts.md)
> (plain-language: rural vs urban, density, how to read a relativity), then the
> end-to-end story — *what we did, what we depended on, how* —
> [`docs/02_end_to_end_and_data_lineage.md`](docs/02_end_to_end_and_data_lineage.md),
> with the evidence in [`docs/01_findings.md`](docs/01_findings.md).

Motivation and method: [`../../plan/location_basis_research_plan.md`](../../plan/04_location_basis/location_basis_research_plan.md).
What we are predicting (the target): the mean-1 within-county relative-outage
rate built in [`../poweroutage_us/docs/06_findings.md`](../poweroutage_us/docs/06_findings.md)
(Finding sets 6–7). Step 2a already showed the within-county signal is
**rurality**, not utility; this workstream replaces the crude size *proxy* with
real features.

## Working rules (from the notebook principles)

We follow the exploratory-data-notebook principles at
`Hazard_modeling/docs/principles/notebook_work/`:

- **Interpret every variable** — value + meaning + units/reference base + a
  use-decision. The interpretation is the deliverable, not the number.
- **Understand before you use** — onboard a source before any analysis joins it.
- **Pin the source, cache the raw bytes** — every external pull records its URL
  pattern + version and caches the raw response under `data/raw/`.
- **No silent windows or sampling** — state region/date/match-rate, report what
  is excluded (e.g. unmatched towns in a join).
- **Every output earns a takeaway.** Don't gold-plate the simple case (a tidy
  table → load + profile); do a from-scratch pass for complex raw/gridded data.

## Layout

```text
location_features/
  README.md                 # this file
  data/
    raw/                    # cached raw bytes, per source (reproducible)
    derived/                # cleaned feature tables
  analysis/
    lib/                    # thin, cache-backed fetch clients
    outputs/                # analysis artifacts (CSVs, figures)
    notebooks/              # reviewable onboarding/analysis notebooks
  docs/                     # source onboarding notes + findings
```

## Sources (live + planned)

| Source | Grain | Provides | Key needed? | Status |
|---|---|---|---|---|
| Census 2023 **Gazetteer** (county subdivisions) | town (MCD) | land area (ALAND), centroid | **No** | live |
| PoUS within-county target | town × utility | the relative we predict | — | in hand |
| Census **ACS** (pop/housing) | tract/cousub | population, housing vintage | **Yes** (API key) | planned |
| **NLCD** land cover / tree canopy | 30 m raster | vegetation, developed share | No (bulk file) | planned |

## Gotchas (read before joining)

- **CT county redefinition:** the 2023 Gazetteer files CT towns under the new
  **planning regions** (GEOID county part `110`, `120`, ...), not the legacy
  counties (`001`-`015`) used by the PoUS pilot. EAGLE-I raw outage data appears
  to switch to planning-region FIPS in 2025. **Join on `(state, town name)`,
  never on the gazetteer county FIPS.** See the
  [CT FIPS transition bridge](../poweroutage_us/docs/10_connecticut_fips_transition_bridge.md).
- **`ALAND` excludes water but includes uninhabited land** (forest), so
  `customers / ALAND` reads heavily-forested towns as low-density — which is the
  right direction for rurality, but it conflates "few people" with "much
  uninhabitable land." Noted where it matters.

## Cross-references

- Spatial entity resolution (why town↔county↔utility is tricky):
  [`../poweroutage_us/docs/09_spatial_entity_resolution.md`](../poweroutage_us/docs/09_spatial_entity_resolution.md)
- Research plan & target definition:
  [`../../plan/location_basis_research_plan.md`](../../plan/04_location_basis/location_basis_research_plan.md)
