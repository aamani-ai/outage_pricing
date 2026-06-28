# Principle: Structural Verification — the system catches its own mistakes, not your eyeballs

- **Status:** principle
- **First written:** 2026-06-28 (restores and renames the deleted `scaling.md`, which carried these
  disciplines through the dashboard rebuild; "scaling" was a misleading name — the doc was never about scale.)

## The principle

```text
Correctness is enforced STRUCTURALLY — by tests, assertions, loud failures, and clean boundaries —
not by trusting that the code (often LLM-written and fast-moving) happens to be right.

A defect must SHOW UP on its own: fail a test, crash loudly, or violate a count check. It must never
silently produce a wrong number that looks fine. A crash you notice today beats a wrong premium you
ship for a year.
```

```text
  silent wrong answer (looks fine, ships, found a year later)   ◀──────  the failure mode we engineer against
                                                                          │
                            ┌─────────────────────────────────────────────┴───────────────────────────────┐
                       FAIL LOUD                    TEST THE CONTRACT FIRST              CLEAN BOUNDARIES
                  no fallback that hides          "ask for the test, not the         python side: zero web deps
                  a broken core input;           feature" — the pricing engine       web side: zero pandas;
                  count/range asserts at         got its canary suite BEFORE any      they meet at JSON/CSV, so
                  load (3,090 counties)          UI rendered a single number          each half is testable alone
```

## Why — the lesson that earned this

```text
This dashboard is largely LLM-built and moves fast. The dominant risk in that mode is not a loud bug —
it is a SILENT one: a truncated catalog, a swapped column, a denominator off by 100×, an input that
quietly defaults to zero. The number still renders. It still looks plausible. Nobody eyeballs 3,090
counties. So the rebuild's keystone decision (D1) was to EXTRACT and canary-test the pricing engine
before any UI existed, assert the row counts at load, and make the engine FAIL rather than fall back.
Structural verification, not eyeballs — because eyeballs do not scale and trust is not a control.
```

## What it is NOT (so it isn't applied too strictly)

```text
  · NOT "100% test coverage" — it is targeted: the CONTRACT (the number-producing path + its input shapes),
    not every getter. One canary that would catch the inverse beats fifty that assert nothing.
  · NOT "never use a fallback" — graceful degradation is CORRECT for OPTIONAL EXTERNAL deps (geocoding,
    land-cover WMS, the event drill-down): no result is fine, a wrong PRICE is not. The rule governs the
    CORE inputs that determine the number, never the optional garnish around it.
  · NOT ceremony — it is the cheapest insurance against shipping a confidently-wrong premium. If a check
    can't fail on a real defect, it isn't structural verification, it's decoration.
```

## What it IS

```text
  · FAIL LOUD on core-input errors — no silent default/fallback that hides a broken input (web/lib/pricing/compose.ts).
  · TEST THE CONTRACT FIRST — "ask for the test, not the feature"; the engine's canary suite predates its UI
    (web/lib/pricing/compose.test.ts).
  · ASSERT COUNTS + RANGES at load — a silently truncated catalog or regime file fails immediately, not at
    quote time (the 3,090-county count assertion).
  · CLEAN BOUNDARIES so each half is verifiable in isolation — the data/pipeline side has zero web-framework
    deps; the web side has zero pandas; they meet at JSON/CSV. Either half is replaceable without touching the
    other, which is exactly what makes each independently testable.
```

## The test — run before shipping a code change

```text
  1. If a CORE input were truncated/corrupt/zeroed, would something FAIL (a test, an assert, a crash) —
     or would it silently produce a number that renders fine?
  2. Does the new logic have a test that would catch its INVERSE (the bug, not just the happy path)?
  3. Are input counts/ranges ASSERTED at load (row counts, county counts, value bounds)?
  4. Is graceful-fallback used ONLY for optional EXTERNAL deps — never for the core number?
  5. Could the python and web halves each be tested WITHOUT the other (do they meet only at files)?
```

## Relationship to the other principles

```text
  communicate_to_share    → how you PRESENT the number (clarity for the actor).
  county_specificity      → WHERE the logic applies (right grouping).
  model_to_consequence    → by WHAT OBJECTIVE you score it (the stakes).
  reproducible_from_lake  → how the DATA + pipeline are sourced and rebuilt (one truth, anywhere, verified).
  structural_verification → how the CODE catches its OWN mistakes (loud, tested, asserted, cleanly bounded).
```

`reproducible_from_lake` and `structural_verification` are siblings — the first proves the **data pipeline**
reproduces (byte-diff, downstream git-clean); the second proves the **code** fails loud (tests, asserts).
Both are the same instinct: *verify, don't assume.*

## Cross-references

- The canary that embodies it: `web/lib/pricing/compose.ts` (FAIL LOUD) + `web/lib/pricing/compose.test.ts`
  (the engine-first canary suite).
- The decisions it grounds: `docs/plan/dashboard_redesign/{00_architecture,01_pricing_engine,README}.md`
  (D1 — extract + canary-test the engine before any UI).
- Its sibling: [`reproducible_from_lake.md`](reproducible_from_lake.md).
