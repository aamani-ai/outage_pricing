# Event Catalogs

The dashboard can read multiple generated catalog folders. Each catalog is the
same EAGLE-I pricing pipeline with a different event-continuity threshold.

Current internal catalogs:

- `eagle-i-30min` — conservative baseline
- `eagle-i-45min` — recommended candidate from lab sensitivity work
- `eagle-i-60min` — sensitivity catalog for over-merge review

Build all catalogs from `price_engine/`:

```bash
bash run_catalogs.sh
```

Build one catalog:

```bash
bash run_catalogs.sh --catalog eagle-i-45min
```

Generated parquet, CSV, and JSON artifacts are local and ignored. The future
external event-log comparator should use this same catalog contract, but it is
intentionally not part of the first catalog set.

Annualized rates in every catalog use the same source exposure denominator:
`2014-11-01 04:00 UTC` through `2026-01-01 00:00 UTC`, about `11.167`
observation years. Each catalog writes `data/annualization_meta.json` with the
exact interval.
