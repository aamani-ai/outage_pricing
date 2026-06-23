# P7 — Deployment & Cutover

How the new dashboard reaches the remote. **Decision: reuse the existing service, ship a new
container, cut over via a tagged revision, archive the old.** (Cross-cutting doc — referenced by P7.)

## The current setup (what we reuse)

```text
  workflow      .github/workflows/deploy-outage-pricing.yml   (push to branch deploy/outage-pricing)
  service       Cloud Run  outage-pricing   · region us-central1 · project modeling-nonprod-svc-db5x
  registry      us-central1-docker.pkg.dev/modeling-nonprod-svc-db5x/infrasuremodelingdocker/outage-pricing
  build         Paketo buildpacks (pack build) · builder paketobuildpacks/builder-jammy-BASE · APP_PATH=price_engine
  runtime       Procfile `web: python server.py`  (static-file server) · 512Mi / 1 CPU
  auth          WIF (gh-actions-deploy SA) · PUBLIC (--allow-unauthenticated --no-iap)
  secret        MAPBOX_TOKEN → gitignored config.local.js at build time
  URL           outage-pricing-…run.app/dashboard/   ← cited in the methodology deck (slide 12)
```

## The decision (Option 2, clean)

Reuse the **service, URL, registry, and WIF/GHA plumbing**; swap only the **image** (python-static →
Next.js). Rationale: one canonical URL keeps the deck + shared links valid; the security plumbing is
already vetted; the old dashboard has no ongoing value beyond reference (preserved in git + the
`docs/extra/references/` symlink). Rejected "separate new service" — it splits the URL, re-does the
security surface, and leaves two things to run.

## What changes in the workflow for Next.js

```text
  APP_PATH          price_engine        → web
  builder           builder-jammy-BASE  → builder-jammy-FULL   (the libatomic gotcha is Node-specific —
                                                                 the current workflow comment already notes this)
  Procfile/start    python server.py    → Next: `web: npm run start` (next start)   [Node-server lean]
  URL path          served at /dashboard → Next `basePath: '/dashboard'`  (keeps the exact public URL)
  Mapbox token      config.local.js     → Next public env / runtime config, still from MAPBOX_TOKEN secret, still gitignored
  docs symlinks     resolve methodology/ → methodology now a sidebar item reading docs/ — revisit/retire that step
```

### Node server vs static export (sub-decision)
- **Lean: Node server** (`next build` + `next start`, Paketo Node buildpack) — consistent with the
  platform's RSC patterns (D2) and server-side data loading close to the data.
- **Fallback: static export** (`output: 'export'`) — viable since our data is precomputed files;
  cheapest, closest to the old static model. Decide at P5/P6 once we know if anything needs SSR.

## Cutover sequence (preview-before-promote, zero downtime)

```text
  1. build the new image, deploy with  --no-traffic --tag next   → private preview URL  next---outage-pricing-…run.app
  2. validate the new dashboard live on the tagged URL (real data, both themes, geocode, the canary anchor)
  3. flip:  gcloud run services update-traffic outage-pricing --to-tags next=100   (instant, reversible — old revision still there)
  4. soak; if anything's wrong, flip traffic back to the prior revision in one command
  5. ARCHIVE the old: remove the python serve path (Procfile/server.py/old dashboard from the build),
     keep it in git history + the reference symlink; drop the now-dead workflow steps (symlink-resolve, base builder)
```

## Guardrails

- Deploy stays gated to the `deploy/outage-pricing` branch (main keeps not-deploying — iteration decoupled).
- Keep `--allow-unauthenticated` only while D8 holds (no auth). If we ever gate externally (Q8),
  this is where the `--iap` / domain-restriction flags come back (the workflow already documents how).
- The canary anchor (Alachua T=4h/$500 → ≈$78.76, live catalog) is the smoke test on the tagged URL before flipping traffic —
  if the live number doesn't match the engine test, do not promote.
