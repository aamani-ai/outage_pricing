# Pipeline — raw → numbers, and local ↔ GCS

How the outage-pricing numbers are built from raw EAGLE-I, and how every stage runs against either the
**local repo** or the **GCS data lake** (`gs://infrasure-outage-pricing-data`) via one switch. Companion to
[`../schema/`](../schema/) (the data) — this is the *transformations*.

---

## The one switch: `OUTAGE_PRICING_DATA_ROOT`

```text
  unset                                  → every stage reads/writes the LOCAL repo (today; offline-friendly)
  gs://infrasure-outage-pricing-data     → every stage reads/writes the BUCKET (reproducible on any machine)
```

Stages resolve paths through **`price_engine/core/data_paths.resolve("repo/relative/path")`** and read/write
through **`price_engine/core/gcs_io`** (`read_parquet/csv/json/text`, `write_*`, `exists`, `ls` — `gs://` handled
by pandas+gcsfs; mirrors model-gpr's `gcs.py`). `data_paths` maps the repo tree to the lake layout:

```text
  price_engine/data/raw/eaglei_*.csv  → sources/eagle_i/      price_engine/catalogs/<id>/ → catalogs/<id>/
  price_engine/data/raw/MCC.csv       → sources/mcc/          price_engine/data/customer_base.csv → derived/customer_base.csv
  price_engine/data/raw/acs_*.json    → sources/acs/          curated_outage_data/outputs/<x>     → derived/<x>
  price_engine/data/raw/{DQI,cov}.csv → sources/reference/    notebooks/outputs/<x>               → derived/notebooks/<x>
  price_engine/data/<intermediate>    → working/             price_engine/filtration/<x> → working/filtration/
  price_engine/pricing/<x>            → working/pricing/     (events.parquet, county_summary, tiers, premiums — Wave 2)
```

**Auth:** ADC locally (`gcloud auth application-default login`); a bound service account in prod. **Secrets stay
local** — `CENSUS_API_KEY` (`docs/extra/location_features/.env`) is never in the bucket.

**Run:**
```bash
.venv/bin/python web/scripts/build_data.py                                            # local
OUTAGE_PRICING_DATA_ROOT=gs://infrasure-outage-pricing-data .venv/bin/python web/scripts/build_data.py   # GCS
```
Verified: the two produce **byte-identical** `web/lib/data/*.json`.

---

## The stages: raw → numbers (with what each masks / cleans / gates)

```text
  STAGE                         IN → OUT                                  TRANSFORM · MASK/CLEAN · QC GATE · KNOBS
  ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
  01_ingest                     Figshare → local raw → (sources/* on lake)  download w/ MD5 verify · idempotent;
                                                                           `--push-lake` promotes raw via gcloud cp
  02_construct_events           raw CSVs → events.parquet                  eventize 15-min snapshots; CLEAN: bridge
                                                                           gaps ≤ GAP_TOLERANCE, dedup, threshold
                                                                           customers_out>0; KNOB: gap 30/45/60min
  03_aggregate_county           events + MCC/DQI/coverage → county_summary annualize over SOURCE window (not event
                                + county_durations                        span); MASK: coverage; carries DQI
  build_customer_base (A018)    MCC + ACS + events(peak) → customer_base   CLEAN denominator: base=max(MCC,housing,
                                                                           peak); EXCLUDE peak>1.5×; secret: CENSUS key
  04_filter                     county_summary → county_tiers              GATE: green/amber/red = worst of {volume,
                                                                           events/yr, window, p95 tail, DQI}
  05_price                      summary+durations+tiers → drilldown        λ(T)=N_per_year·S(T)·X; retail=pure/(1−ER−TM)
  ── curated (descriptive / shadow; NOT v0 price) ──
  per_customer_rate             events + customer_base → per_customer_view share-out = mean_customers/base; mean vs
                                                                           median (A011); GATE: coverage_gate_status
  county_trend → predictability yearly counts → trend/pattern             OLS slope/t-stat; regime patterns (descriptive)
  county_lambda_shadow          drilldown+trend+pred → shadow factor       recent-vs-mean λ adj, capped [0.75,2.5] (shadow)
  ── serving ──
  build_data                    catalogs/pricing + curated + notebooks →   bundle → web/lib/data/*.json (committed)
                                web/lib/data/*.json
  build_county_events           events.parquet → app/county_events/<fips>  per-county event series (GCS)
  build_county_traces           raw EAGLE-I → app/county_traces/<fips>/<yr> per-county-per-year 15-min RAW trace (GCS);
                                                                           powers the event drill-down on the deployed app
```
Orchestrator: `price_engine/catalogs/build_catalogs.py` runs 02–05 for each gap-tolerance catalog, then the
curated/shadow pipelines.

---

## Migration status (the GCS-native rollout)

```text
  ✓ FOUNDATION         price_engine/core/{gcs_io,data_paths}.py — the env switch + path map
  ✓ build_data         reads catalogs + curated + notebooks from GCS → identical bundle  (deploy-unblocking)
  ✓ build_county_events already GCS (writes app/county_events/)
  ✓ curated pipelines  per_customer / trend / predictability / lambda_shadow — resolve local↔GCS  (Wave 1b)
  ✓ core engine        01_ingest(+--push-lake) · 02→05 · build_catalogs — read raw / write catalogs via the switch  (Wave 2)
  ◻ deploy             service account for the deployed dashboard to read the private bucket
```

Every stage runs against either root (env unset = local; `gs://…` = lake), and flipping one stage never breaks the
others. Verified, not assumed:
```text
  · build_data         local vs GCS → byte-identical web/lib/data/*.json
  · core engine        local 30-fips chain ran 02→05 end-to-end; GCS smokes: 02 streamed events.parquet to the
                       bucket + read back; 04 read county_summary from the bucket (tiers 951/2070/69) + wrote back
  · orchestrator       build_catalogs --downstream-only --catalog eagle-i-45min rebuilt 03→05 + curated, then
                       build_data → `git status web/lib/data` CLEAN (the full chain preserves the bundle)
```

---

## Rebuild runbook

**Local full rebuild** (offline; the laptop cache is the working copy):
```bash
.venv/bin/python price_engine/data/01_ingest.py                 # raw → price_engine/data/raw (idempotent, MD5)
.venv/bin/python price_engine/catalogs/build_catalogs.py        # 02→05 + curated, all catalogs (30/45/60)
.venv/bin/python web/scripts/build_data.py                      # bundle → web/lib/data/*.json (committed)
# faster inner loop (reuse events.parquet):  build_catalogs.py --downstream-only --catalog eagle-i-45min
```

**Lake rebuild** — *regenerate to STAGING, diff, then promote* (never blind-overwrite the live lake; principle #4):
```bash
export OUTAGE_PRICING_DATA_ROOT=gs://infrasure-outage-pricing-data       # one switch flips the whole pipeline
.venv/bin/python price_engine/data/01_ingest.py --push-lake             # land + promote raw (gcloud cp; ~11 GB)
# stage into a parallel root, diff vs live, then promote — do NOT point build_catalogs at the live root casually:
#   OUTAGE_PRICING_DATA_ROOT=gs://infrasure-outage-pricing-data-staging build_catalogs.py
#   gcloud storage rsync --dry-run gs://…-staging/catalogs gs://…/catalogs   # inspect the diff first
build_data.py                                                            # reads the lake; verify bundle git-clean
```

The proof of equivalence is the cheap, repeatable check: `build_data` local vs GCS is byte-identical, and a
`--downstream-only` rebuild leaves `web/lib/data` git-clean. Run that before trusting a lake change.

---

*Started 2026-06-28; core-engine (Wave 2) GCS-native 2026-06-28. Inputs schema in [`../schema/`](../schema/);
assumptions in [`../methodology/assumptions.md`](../methodology/assumptions.md); the principle that governs this in
[`../principles/reproducible_from_lake.md`](../principles/reproducible_from_lake.md).*
