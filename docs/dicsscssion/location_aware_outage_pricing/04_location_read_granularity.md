# Location Read — Search Granularity & Non-Residential Tracts

Date: 2026-06-24

## Status

Discussion / **future update** — not urgent. Location basis is **shadow / internal** (not in the
quoted premium), and it reads **correctly for real addresses**. Logged from a live observation on the
deployed Underwriting Studio. This is a *product-grain / UX* refinement, **not** a calibration bug.

## The observation

Searching the place name **"Manhattan, New York"** in the Studio returned a Location read of:

```text
Location (within-county) · rural · ×1.37 · "37% above its county average"
  "sparsest third — long overhead radial feeders, more tree contact · 0 /km² · denser than 1%"
```

No math error. The geocoder resolved the *locality* "Manhattan" to its centroid, which lands in
**Central Park** (Census tract `36061014300`, **0 residents**). Population density ranks any
0-resident tract as "rural (sparsest)," and the on-demand impervious guardrail did not fire there (a
park reads low impervious), so the read is an **accurate-but-misleading "rural uplift"** for a point
that is not an insurable location at all.

A real Manhattan **street address** resolves to a real tract and reads correctly (urban discount,
guardrail fires). So this is a **search-granularity** issue, not a coverage or calibration issue.

```text
"Manhattan" (locality)  → centroid → Central Park tract (0 residents) → "rural ×1.37"   ← misleading
a Manhattan street addr → real tract (14k/km², 92% impervious)        → "urban ×0.80"   ← correct
```

## Why it matters (the principle)

Location basis is a **within-county, premise-level** read (assumption **LB-4**): it redistributes risk
among the *customers* inside a county. A region — "Manhattan", a city, a county, a ZIP — is **not an
insurable location**, and its centroid is arbitrary. A single within-county location read for a region
is a category mismatch.

```text
policy exposure location = insured building / address / asset   ← location basis applies here
region / locality        = an area, centroid is arbitrary       ← a single location read is undefined
```

This is the same "keep the grains separate" discipline as `01_problem_framing.md`, surfaced at the UI.
communicate-to-share: **don't present a read the input doesn't actually support.**

## Proposed future updates

### A. Gate the location read on geocode granularity (primary)

The geocoder already returns the result type (we observed `feature_type: "locality"` for Manhattan).

```text
address / POI  (a building you'd insure)        → SHOW the within-county location read
locality / place / region / county / postcode   → SUPPRESS it → "search a specific address for a
                                                    within-county read"  (still show the county
                                                    baseline + regime — those are county-level)
```

This generalizes — it fixes **every** region/city search, not just ones that happen to land on a
0-population tract.

### B. Non-residential / ≈0-resident tract guard (complementary, cheap)

Even for a real address, if its tract has ≈0 residents (density below a floor — parkland, water,
airports, large cemeteries), the within-county relativity is undefined (no customers to place).
Return **neutral ×1.00 + a "non-residential (≈0 residents)" label** and skip the noisy point-impervious
guardrail there. Belt-and-suspenders behind (A).

## Implementation sketch (when picked up)

- **(A)** thread the geocode result `feature_type` from `address-search` → `quote-store` →
  `studio-view`; render the Location detail only for address/POI results, else a "pick a specific
  address" stub. (Pricing baseline + regime stay county-level, unaffected.)
- **(B)** a guard in `web/app/api/studio/route.ts`: tract density below a floor →
  `{ nonResidential: true, relativity 1.0 }`, skip the guardrail; the UI shows the non-residential
  label. Document the floor in `location_basis_methodology.md`.

## Why deferred (not done now)

Location basis is shadow / internal / not in the quoted premium, and it reads correctly for real
addresses — so this is a polish/honesty improvement, not a correctness fix. The natural time to
implement is when the location read moves toward anything customer-facing.

## Cross-references

- Dashboard build: [`../../plan/04_location_basis/location_basis_dashboard_plan.md`](../../plan/04_location_basis/location_basis_dashboard_plan.md)
- Premise-grain caveat (LB-4): [`../../methodology/04_location_basis/location_basis_methodology.md`](../../methodology/04_location_basis/location_basis_methodology.md)
- Original grain framing: [`01_problem_framing.md`](01_problem_framing.md)
