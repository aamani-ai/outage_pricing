# Principle: County-Specificity — don't assume one logic fits all counties

- **Status:** principle
- **First written:** 2026-06-24

## The principle

```text
Both DATA AVAILABILITY (coverage history) and OUTAGE NATURE (stable / trend / shift / episodic) are
SPECIFIC TO EACH COUNTY. A single logic applied across the board — one window, one "best method", one
threshold, one adjuster rule — will be wrong at the corners.

But the answer is NOT "every county gets its own rule" either — that OVER-FITS on thin data and is not
smart. The craft is the BALANCE between two extremes: **GROUP counties by what makes them behave alike,
apply logic PER GROUP, and ABSTAIN where the evidence is thin.**

```text
  one-size-fits-all  ◀───────────  the right GROUPING  ───────────▶  every county its own rule
  (one global rule;               (cluster by behaviour /              (over-fit; thin-data noise;
   wrong at the corners)           data-availability; per-group         not "smart")
                                   logic; abstain on thin)
```

Finding the right grouping is itself the hard, ongoing work: too coarse and it collapses back to
one-size-fits-all; too fine and it's noise. We already lived this — the 7-shape catalog over-grouped and
overlapped, and was replaced by the stable / trend / shift / episodic **regime routing**, which is the
current grouping the statistical adjuster routes on.
```

## What it is NOT (so it isn't applied too strictly)

```text
  · NOT a mandate that every number be per-county. A single headline / aggregate is fine as a DIAGNOSTIC.
  · NOT "global summaries are forbidden." Use them to describe — not to decide a rule for every county.
  · NOT licence to over-fit per-county on thin data. Thin/ambiguous counties should ABSTAIN, not force a move.
```

## What it IS

```text
  · a default SUSPICION of one-size-fits-all conclusions;
  · a requirement to CHECK a global rule against the county DISTRIBUTION (not just the median) before adopting it;
  · a preference to put per-county judgment in EXPLICIT, REVIEWABLE adjusters — not silently baked into the baseline;
  · evaluate PER-BUCKET / per-county (equal-weight), not only by volume-pooled aggregates.
```

## Why — the hard lessons that earned this

```text
  · forward router: a national volume-pooled "best method" hid that different regimes want different experts.
  · baseline window: a global "drop 2015-2017" cut was right ON AVERAGE but WRONG for declining counties
    (Lee FL, T=8h: 250 events early -> 120 recent). It baked an UNVERIFIABLE per-county assumption
    ("this county's early years are coverage-suppressed") into the audit anchor.
  · what has worked is already per-county: location basis is WITHIN-county; regime is per-county;
    per-customer is per-county; the premium band debate was "do not pool nationally."
```

## The test — run this before adopting any across-the-board rule

```text
  1. does the rule hold PER-COUNTY, or only on the aggregate? (look at the distribution, not the median)
  2. can it go BOTH WAYS where counties differ, or is it one-directional?
  3. is it an EXPLICIT, reviewable adjustment — or silently baked into the baseline/anchor?
  4. on thin / ambiguous counties, does it ABSTAIN rather than force a move?
  5. is the GROUPING right — coarse enough to be robust, fine enough to be accurate (not one rule, not 3,000)?
```

## Cross-references

- [`communicate_to_share.md`](communicate_to_share.md) — split orthogonal questions; answer the right one.
- The decision that earned this: [`../dicsscssion/eventization_frequency_contract/07_coverage_ramp_baseline_window.md`](../dicsscssion/eventization_frequency_contract/07_coverage_ramp_baseline_window.md).
- The structure it points to: [`../dicsscssion/forward_regime_statistical_router/04_statistical_adjuster_design.md`](../dicsscssion/forward_regime_statistical_router/04_statistical_adjuster_design.md).
