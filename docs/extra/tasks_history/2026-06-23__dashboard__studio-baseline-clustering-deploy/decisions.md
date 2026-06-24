# Decisions — 2026-06-23

## 1. Baseline tab = the Trust & Posture cell read (NOT a "comfort" score)
**Decision:** The Baseline tab presents each (county, T) cell as TWO orthogonal axes — **TRUST**
(weakest-link min of coverage `C_source` / sample `C_sample` / stability `C_evt` → Strong≥.75 /
Medium≥.50 / Thin) and **POSTURE** (cushion LEVEL by duration from median peak/mean, + TILT vs peers).
Never merged into one tier.
**Rationale:** This is exactly what `docs/methodology/02_per_customer/cell_read_fundamentals.md` defines
(its title is literally "Cell Read — Trust & Posture"). The first attempt collapsed everything into a
one-dimensional "comfort" tier off the confidence band — which (a) computed TRUST wrong and (b) dropped
POSTURE (the conservative-cushion read) entirely. Trust = "how hard can I lean on this"; Posture = "how
conservative, and where does that thin." They answer different questions and must be shown side by side.
The real values come from `inner_event_shape_diagnostics.ipynb` (don't approximate them).

## 2. Regime "insufficient" → split `recent-change` out (communication fix, not a classifier change)
**Decision:** At the display/build layer, split the overloaded `insufficient` regime: `recent-change`
(data-rich, recently shifted) renders as **"Recent change"**; `low-volume`/`short-history` render as
**"Insufficient data"**. The classifier logic and the schema label are UNCHANGED.
**Rationale:** "insufficient" is correct for the sparse subs but badly misleading for `recent-change`
(125 counties, median ~183 events; e.g. Middlesex MA = 2,282). The classifier correctly *abstains*
(abstain-don't-force) — only the surfaced word was wrong. Promoting `recent-change` to a 5th regime
would contradict a verified design (it's an abstention, not a behavior). So fix communication across
all three surfaces (canonical doc, README, dashboard), keep the schema.

## 3. County Clustering peer mix = 4 behavioral regimes + a 2-faced abstention (not "6 clusters")
**Decision:** Group the national distribution into "Behavioral regimes" (stable/trend/shift/episodic,
~89%) and "Abstained — not typed" (recent-change/insufficient, ~11%). Abstained counties' headline says
"abstained — not a behavioral regime."
**Rationale:** Flattening all six into one list implies recent-change/insufficient are behaviors peer to
stable/trend — a category error. The methodology is "four regimes + one honest abstention."

## 4. Settings = global loadings; Studio = per-county adjusters (resolved earlier, locked here)
**Decision:** Platform-wide ER/TM live in **Settings** (persisted, applied to every quote); per-county
forward/location/manual levers live in the Studio. The Studio panel is **manual loads** (the legit
underwriter lever); location/forward come from models, not casual ±% sliders.
**Rationale:** "Change my margin, apply across the platform" is a global setting; per-county risk
overrides are a different layer. Conflating them under one word "adjustments" confused the model.

## 5. Deploy via Dockerfile, NOT Paketo buildpacks
**Decision:** Build the Cloud Run image with `web/Dockerfile` (multi-stage, real node_modules).
**Rationale:** Turbopack's `next build` rejects the buildpack's **symlinked** node_modules ("Symlink
node_modules points out of filesystem root"). A real node_modules (Docker) sidesteps it entirely. This
was the first deploy failure.

## 6. Deploy-to-live on push (the only working flip path given access)
**Decision:** The deploy workflow routes 100% traffic to the new revision on push (deploy-to-live +
`update-traffic --to-latest`), rather than a preview-then-dispatch-flip.
**Rationale:** A personal gcloud account lacks `artifactregistry.repositories.downloadArtifacts` (can't
flip traffic) and the gh token lacks repo-admin (`workflow_dispatch` → 403). The **GHA deploy SA**
(`gh-actions-deploy@`) has both, so deploy-to-live on push is the only path that works without manual
infra access. Prior revisions are retained for rollback. (A `promote-outage-pricing.yml` workflow exists
on `main` for a manual flip/rollback IF the gh token ever gets repo-admin.)

## 7. basePath `/dashboard` at build AND runtime; manual asset/fetch prefixing
**Decision:** Bake `NEXT_PUBLIC_BASE_PATH=/dashboard` at build (preserves the deck-cited URL) and also
set it as a Cloud Run runtime env. Route all internal `fetch('/api/...')` through `api()` and raw
`<img src="/...">` through `asset()` (`web/lib/base-path.ts`).
**Rationale:** Next prefixes Link/_next assets automatically, but NOT raw fetch() or raw `<img>` — those
404 under a basePath. `next start` re-reads next.config at runtime, so basePath must be set both times.
This caused the API-404 risk and the broken-logo bug.
