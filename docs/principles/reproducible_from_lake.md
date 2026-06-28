# Principle: Reproducible from the Lake — one source of truth, rebuildable anywhere

- **Status:** principle
- **First written:** 2026-06-28 (the principle the GCS data-lake work earned; supersedes the never-written
  "scaling.md / no orphaned data" the build scripts used to gesture at)

## The principle

```text
Every number must be REBUILDABLE from a single canonical source — the GCS data lake
(gs://infrasure-outage-pricing-data) — on ANY machine with credentials, producing IDENTICAL results.

No pipeline step may depend on an artifact that lives only on one laptop. DATA lives in the LAKE; the
repo holds CODE, small committed dashboard bundles, and DOCS. ONE switch (OUTAGE_PRICING_DATA_ROOT)
selects local-vs-lake, and the two paths produce the SAME numbers — an equivalence that is VERIFIED,
not assumed.
```

```text
  laptop-only (it runs on MY machine)  ◀────────  the canonical source of truth  ────────▶  committed into the repo
  (single point of failure; not a       (the LAKE: raw + heavy derived; the              (heavy data bloats a public
   pipeline; can't redeploy)             laptop is a cache, the repo is code+docs)        repo; goes stale; leaks)
```

## Why — the lesson that earned this

```text
The whole ~13 GB pipeline (raw EAGLE-I 11 GB + catalogs + derived) was gitignored = LOCAL-ONLY on one
laptop. If that machine died, the eventized catalogs and the exact data vintage were gone, and the
deployed dashboard could not reproduce itself. "It runs on my machine" is not a pipeline.

We moved the data to the lake and made every serving/curated stage resolve local↔GCS by ONE env var,
then PROVED equivalence: build_data is byte-identical local vs GCS; re-running the whole curated layer
left web/lib/data git-clean. Reproducibility is the property, verification is the proof.
```

## What it is NOT (so it isn't applied too strictly)

```text
  · NOT "commit data to the repo" — the OPPOSITE. Heavy/raw data belongs in the lake, gitignored locally.
  · NOT "GCS for everything" — SECRETS stay local (.env / CENSUS_API_KEY, never in the lake); the dashboard's
    small bundle (web/lib/data/*.json) stays committed (it's the served artifact, versioned with the code).
  · NOT "re-run the full 11 GB rebuild on every change" — the value is CAPABILITY + verified equivalence,
    exercised deliberately, not a tax on every edit.
```

## What it IS

```text
  · a single canonical SOURCE OF TRUTH (the lake) for raw + heavy derived; the laptop is a cache, not the origin.
  · every stage reads/writes through ONE resolver (price_engine/core/data_paths) + ONE I/O layer (gcs_io);
    flipping local↔lake is one env var, nothing else changes.
  · local and lake produce IDENTICAL numbers — and we VERIFY it (byte-diff / downstream git-clean), not trust it.
  · raw→numbers PROVENANCE is documented per stage (docs/pipeline): transform · what it masks/cleans · QC gate · knobs.
  · regenerate to STAGING, then diff, before overwriting the live source of truth — never blind-overwrite the
    artifacts everything depends on.
```

## The test — run before shipping a pipeline change

```text
  1. Could a FRESH machine (creds only) rebuild this number from the lake? Is ANY input local-only?
  2. Do local and lake produce IDENTICAL output — and has that been VERIFIED, not assumed?
  3. Is every stage's raw→numbers path DOCUMENTED (what it transforms / masks / cleans / gates)?
  4. Does a regeneration write to STAGING + diff before touching the canonical copy?
  5. Are SECRETS kept out of the lake; is the committed bundle still the small served artifact, not heavy data?
```

## Relationship to the other principles

```text
  communicate_to_share   → how you PRESENT the number (clarity for the actor).
  county_specificity     → WHERE the logic applies (right grouping).
  model_to_consequence   → by WHAT OBJECTIVE you score it (the stakes).
  reproducible_from_lake → HOW the data + pipeline are SOURCED and REBUILT (one truth, anywhere, verified).
```

## Cross-references

- The convention + stage map: [`../pipeline/README.md`](../pipeline/README.md).
- The data it governs: [`../schema/`](../schema/) (lake layout, dataset reference, profile).
- The helpers: `price_engine/core/gcs_io.py` (I/O) + `price_engine/core/data_paths.py` (the switch + path map).
- Mirrors the sibling pattern: `model-gpr/src/model_gpr/core/io/gcs.py`.
