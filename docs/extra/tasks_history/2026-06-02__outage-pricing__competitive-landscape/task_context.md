# Task Context — Competitive Landscape Doc + Trigger Source Verification

**Date:** 2026-06-02
**Area:** outage-pricing
**Session focus:** Build canonical competitive-intelligence reference; verify the Adaptive Insurance trigger-source claim against primary sources.

## Objective

Stand up a single, citable competitive landscape document for the parametric power-outage segment — covering Adaptive Insurance / GridProtect, Whisker Labs Ting Insights, PowerOutage.US, and adjacent-vertical proof points — and wire it into the in-app methodology library. Then verify the doc's claim that Ting is Adaptive's trigger source, after teammate sources suggested PowerOutage.US instead.

## Background

- Previous session ended with a Slack share to the team and pushback questions about competitors (mass-market coarse pricing, sensor-level resolution).
- The team needed a single canonical reference to point at instead of re-explaining the competitive picture each time.
- A teammate then asked: *"some of my sources are saying they use PowerOutage as trigger — can you confirm?"* — which forced a source-grounded re-check of our internal Ting-as-trigger claim.

## Problems encountered

1. **No central competitive intelligence doc.** Scattered references existed in `docs/plan/trigger_source_implications.md` and `docs/dicsscssion/utility_oms_and_trigger_sources.md`, but no single canonical strategic-positioning document.
2. **Trigger-source claim was under-sourced.** Internal docs asserted "Whisker Labs Ting sensor network" as the Adaptive trigger source without timestamped attribution. Teammate sources contradicted this.
3. **Timeline ambiguity.** GridProtect launched in 2024; TMHCC partnership announced June 2025; Ting integration formally announced July/Aug 2025. Older analyst notes may have predated the Ting integration.

## What we did

1. **Created [`docs/methodology/competitive_landscape.md`](../../methodology/competitive_landscape.md)** — canonical living reference. Sections: market context, direct outage-segment players (Adaptive, Ting, PoUS), adjacent-vertical players (Parametrix, Ki), absences, positioning paragraph, refresh cadence, gaps in our intelligence, cross-references.
2. **Wired into in-app library.** Added `LIBRARY_SECTIONS['competitive-landscape']` in [`price_engine/dashboard/app.js`](../../../price_engine/dashboard/app.js); added a new "Strategy" group in the library nav in [`price_engine/dashboard/index.html`](../../../price_engine/dashboard/index.html); registered the markdown-link rewrite for `competitive_landscape.md`.
3. **Cross-linked from existing docs.** Added pointer blocks at the top of `docs/plan/trigger_source_implications.md` and the source-link section of `docs/dicsscssion/utility_oms_and_trigger_sources.md`.
4. **Bumped cache-bust** to `?v=20260531-1` (HTML + assets).
5. **Deployed.** `gh run 26849954350` — conclusion: success.
6. **Verified the Ting-as-trigger claim.** Fetched and quoted primary sources:
   - **[IT Brief](https://itbrief.news/story/adaptive-whisker-labs-bring-real-time-data-to-outage-insurance)** — the single primary source that uses the word **"triggered"** explicitly with Ting: *"…allowing insurance claims to be triggered, verified, and paid using live grid data."*
   - **[Artemis.bm](https://www.artemis.bm/news/adaptive-and-whisker-labs-launch-real-time-parametric-power-outage-insurance/)**, **[Insurance Edge](https://insurance-edge.net/2025/08/04/adaptive-insurance-integrates-ting-insights-into-grid-protect/)**, **[Whisker Labs Ting Insights page](https://www.whiskerlabs.com/ting-insights/)** — corroborating but softer language (data, verification, leveraging).
   - **[Adaptive's own website](https://www.adaptiveinsurance.com/)** does **not** name Ting publicly on product pages.
   - **[TMHCC June 2025 announcement](https://www.tmhcc.com/en-us/news-and-articles/company-news/adaptive-insurance-and-tokio-marine-hcc-partner-to-tackle-150bn-power-outage-losses)** uses *"verified trigger events"* but predates the Ting integration and **names no data provider**.
   - **No primary source** found that ties Adaptive to PowerOutage.US as a trigger.
7. **Identified a queued refinement.** `competitive_landscape.md:25` should be softened from a flat "Ting sensor network" assertion to a timestamped, sourced attribution.

## Files touched

**Created:**
- `docs/methodology/competitive_landscape.md`
- `docs/extra/tasks_history/2026-06-02__outage-pricing__competitive-landscape/` (this folder + 4 files)

**Modified:**
- `price_engine/dashboard/app.js` — LIBRARY_SECTIONS entry, Strategy nav group, link rewriter
- `price_engine/dashboard/index.html` — library nav, cache-bust `?v=20260531-1`
- `docs/plan/trigger_source_implications.md` — top-of-file cross-link block
- `docs/dicsscssion/utility_oms_and_trigger_sources.md` — sensor-network section cross-link

**Verified untouched:**
- `price_engine/data/`, `pricing/`, `filtration/` (v0 byte-identical — must not change without explicit user approval)
- All NDA-scoped folders (`docs/extra/poweroutage_us/`, `docs/extra/outage_data/`) — gitignored

## Current status

- [x] Competitive landscape doc shipped to repo and dashboard
- [x] Library nav updated and deployed
- [x] Cross-links added to related docs
- [x] Cache-bust bumped
- [x] Deploy succeeded (run 26849954350)
- [x] Trigger-source claim verified against primary sources
- [ ] `competitive_landscape.md:25` refinement — pending (timestamped + sourced attribution)
- [ ] `Last reviewed` field bump on next edit

## Next steps

See [`handoff.md`](handoff.md) for the explicit roadmap. Short version: tighten the trigger-source assertion in §1 with citation + as-of date, and consider adding a brief "Timeline of trigger-source disclosures" sidebar to neutralize the next teammate question.
