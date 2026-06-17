# Decisions

Each section is one decision made this session, with rationale and the tradeoff considered. Decisions are listed roughly in the order they were taken.

## 1. Per-customer as the dashboard headline price (not shadow)

**Decision:** Ship the per-customer chain as the dashboard's headline annual premium. Retire the "shadow" framing. v0 county-trigger rate becomes a muted reference / sensitivity view below the headline.

**Rationale:** v0 itself ships with eight documented assumptions (A001–A008). None are called "shadow"; they are documented in the registry and the engine ships. The per-customer chain adds exactly one new assumption — A011, the synchronous-outage approximation. Phase 1 showed v0 over-prices per-customer expected loss by 100×–4000× depending on county. Treating the more-accurate per-customer chain as "shadow" while shipping the less-accurate v0 as "the price" inverts the accuracy ordering. The right pattern: register the new assumption with a resolution path, and ship.

**Tradeoff considered:** Conservative governance discipline says don't ship a new modifier without external validation. Counter-argument we accepted: that discipline was designed for forward-regime modifiers (climate, grid, hazard). For bias-risk adjustments (measurement corrections that reduce known systematic error), the registry-with-resolution-path pattern is the right activation gate. Decision recorded in the adjustment framework's refined activation-pattern table.

## 2. Add A011 as a documented data constraint, not an open problem

**Decision:** Capture the synchronous-outage approximation as A011 in the assumptions registry with a stated "Suggested resolution path" pointing at per-`OutageId` data (PoUS contracted feed or utility OMS overlap).

**Rationale:** The assumption is intrinsic to EAGLE-I (snapshot counts, no customer identifiers). It is a data constraint, not a modelling oversight. Documenting it gives the team a clear position: we shipped the best-available first-order estimator with the limitation named, and we know exactly what data would resolve it.

**Tradeoff considered:** Could have kept it as a "Phase 4 gate" item instead. Rejected because Phase 4 may take quarters to execute and we shouldn't leave a 100×-more-accurate baseline in shadow while waiting on vendor contracting.

## 3. Three-bucket roadmap framing (basis-risk / trigger-alignment / forward-regime)

**Decision:** Reorganize the roadmap into three categorical buckets — Basis-risk adjustments (customer ✓, location pending), Trigger alignment (blocked), Forward-regime improvements (grid, hazard). Drop the original two-bucket binary (bias-correction vs forward-regime).

**Rationale:** The two-bucket binary lumped trigger-alignment with customer / location basis-risk under "bias-correction," but trigger alignment is a categorically different kind of fix — it's a contract-data integration that requires a vendor relationship, not a derivation we can make from data we have. The three-bucket framing makes this distinction visible in the sidebar widget, the roadmap doc, and the adjustment framework. User-facing language: each bucket has its own activation rule.

**Tradeoff considered:** Three buckets is more cognitive overhead than two. Accepted because the distinction is real and was actively confusing readers in the two-bucket presentation.

## 4. Document the "fix data input before improving the model" sequencing principle

**Decision:** Write the sequencing principle into both `docs/methodology/roadmap.md` ("Why this order matters" section) and `docs/plan/outage_baseline_adjustment_framework.md` ("Why the buckets are sequenced in this order" subsection).

**Rationale:** The order of work (basis-risk → trigger alignment → forward-regime) is structural, not arbitrary. A perfect climate or grid model layered on top of a misaligned data-input baseline doesn't compensate — it adds modelled signal to a misaligned starting point. Without documenting this principle, future team members might invert the order (e.g. start with hazard modeling) and produce work that can't be used.

**Tradeoff considered:** Could have kept the principle implicit in the ordering of sections. Rejected because principles that survive team turnover need to be explicit.

## 5. Customer = policyholder = single metered entity

**Decision:** Be explicit in A008 and the walkthrough that an EAGLE-I "customer" is a metered electric account — one billed entity behind one meter — which aligns naturally with one policyholder. A 4-person household with one meter = one customer = one policy. A 200-unit building with separate meters = 200 customers = 200 policies.

**Rationale:** The earlier framing of MCC as "electric service points" triggered correct concern that we were dividing customer count by service-point count (apples / oranges). They are the same in EAGLE-I's universe. Making the alignment explicit removes a class of stakeholder confusion and clarifies that the per-customer math is *directly* the per-policy expected loss with no further unit conversion.

## 6. Methodology library as a right slide-out drawer, not a modal or new route

**Decision:** In-app methodology library is a right slide-out drawer (default `min(720px, 58vw)` wide, expandable to full-screen). Triggered by a header `Library` button.

**Rationale:** Lets a reader keep the dashboard visible on the left while reading the docs on the right. Natural for "what does this number mean" workflows. Less disruptive than a modal that hides the dashboard. Expand-to-full-screen toggle handles long-form reading sessions.

**Tradeoff considered:** Full overlay modal would give more reading space. New-route would be permanent state. Drawer is the right middle ground.

## 7. Vendor marked.min.js locally (no CDN)

**Decision:** Download `marked.min.js` v13.0.3 (38.7 KB) into `price_engine/dashboard/vendor/` and reference locally.

**Rationale:** Two "dashboard not loading" incidents in this session traced to CDN failures (d3 / Plot timeouts) and browser-cache mismatches. Adding another CDN dependency for the library renderer would compound the fragility. 38.7 KB vendored is acceptable for a self-contained dashboard.

## 8. Symlink `price_engine/dashboard/methodology → ../../docs/methodology`

**Decision:** Use a relative symlink to expose `docs/methodology/` markdown files under the dashboard's static-served root, so the library can fetch them live without a build or copy step.

**Rationale:** Python's `http.server` follows symlinks by default. Edits to methodology files show up on the next section load — no rebuild, no manual sync. The deploy workflow replaces the symlink with a real directory copy as a pre-build step so the container is self-contained.

## 9. Force-add the dashboard data bundle to the deploy branch only

**Decision:** Keep the catalog JSON / event-evidence / per_customer_view files gitignored on `main`. Force-add them to `deploy/outage-pricing` so they ship with the container; `main` stays data-free.

**Rationale:** ~570 MB of generated artifacts. Committing to `main` would bloat every clone and pollute the source-of-truth branch. Force-adding only to the deploy branch is a one-line git pattern that keeps responsibilities clean.

**Tradeoff considered:** Could have uploaded to GCS and fetched at runtime. Rejected for now because it adds bucket / CORS / IAM complexity for marginal benefit. If the data bundle grows beyond a few GB, revisit.

## 10. Cloud Run with IAP gating to `domain:aamani.ai`

**Decision:** Deploy the dashboard with IAP enabled and `roles/iap.httpsResourceAccessor` granted to `domain:aamani.ai`.

**Rationale:** The dashboard is still v0-and-shadow / now v0-and-shipped-per-customer with refinement open. Per-customer is shipped but Phase 4 refinement is pending. Domain-restricted access is the right default — team-only review without exposing internal pricing surfaces to the open internet.

## 11. Public GitHub repo (link-only sharing)

**Decision:** Create `aamani-ai/outage_pricing` as a public repo with the understanding that "anyone with the link" is the intended audience (vs full GitHub indexing).

**Rationale:** Public repo is cheaper and simpler than private + collaborator management. The methodology and code are intentionally team-shareable. NDA-scoped vendor materials (PoUS data, vendor PDFs) are gitignored at the folder level so they cannot leak.

## 12. Cache-bust `?v=YYYYMMDD-N` on every dashboard edit

**Decision:** Bump the `?v=` token on both `app.js` and `styles.css` in `index.html` together on every dashboard change. Document the discipline in memory.

**Rationale:** Two "dashboard not loading" incidents in this session traced to soft-refresh cache mismatches. The cache-bust forces fresh fetches even on soft refresh, keeping HTML/CSS/JS in lockstep.

## 13. Workflow: research → reason → plan → implementation → feedback

**Decision:** All non-trivial work this session followed the explicit phase loop with gates between phases. Plan docs precede code. Methodology files precede dashboard surfaces.

**Rationale:** User-stated preference (saved as feedback memory). The discipline kept the per-customer track from being rushed and produced documentation that is now the primary defensible artifact for the team review.
