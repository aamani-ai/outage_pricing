# Decisions — 2026-06-02 Competitive Landscape Session

## 1. One canonical competitive doc, not many scattered notes

**Decision:** Create a single `docs/methodology/competitive_landscape.md` rather than appending to existing trigger-source notes.

**Rationale:** Scattered references in `docs/plan/trigger_source_implications.md` and `docs/dicsscssion/utility_oms_and_trigger_sources.md` had partial overlap and could drift. A single canonical doc means one place to update when capital, footprint, or product facts change — and one place to point a teammate or client at. The two older docs remain as deeper-dive references and now cross-link to the canonical one.

## 2. Place it in `docs/methodology/`, not `docs/plan/` or `docs/dicsscssion/`

**Decision:** File under `docs/methodology/` alongside walkthroughs, assumptions, and roadmap.

**Rationale:** The competitive landscape is part of the canonical HOW of the product (positioning, attribution, what we lean on for defensibility), not a transient plan or open discussion. `docs/methodology/` is already the user-facing library surface in the dashboard, which means anyone using the dashboard can reach it in two clicks. Plans evolve; methodology is stable-ish.

## 3. Frame Adaptive (MGA) vs Ting (trigger network) as the load-bearing reframe

**Decision:** Lead §1 with Adaptive as the carrier-platform / MGA, and §2 with Ting as the trigger-network infrastructure provider — explicitly drawing the distinction that they are not the same kind of company.

**Rationale:** Most external audiences conflate them ("Adaptive uses sensors → they ARE the sensor company"). The §1/§2 split is what lets the "we sit underneath all three" positioning paragraph land. Without that distinction, the positioning sounds like we're claiming to compete with both — which we're not.

## 4. Source the Ting-as-trigger claim from IT Brief, not from Adaptive's own materials

**Decision:** Cite [IT Brief](https://itbrief.news/story/adaptive-whisker-labs-bring-real-time-data-to-outage-insurance) as the primary source for the explicit "triggered" attribution.

**Rationale:** Adaptive's own [website](https://www.adaptiveinsurance.com/) does not name Ting on product pages. The [TMHCC June 2025 announcement](https://www.tmhcc.com/en-us/news-and-articles/company-news/adaptive-insurance-and-tokio-marine-hcc-partner-to-tackle-150bn-power-outage-losses) predates the Ting integration. Whisker Labs' own [Ting Insights page](https://www.whiskerlabs.com/ting-insights/) mentions the partnership but does not use the word "trigger". IT Brief is the cleanest single sentence connecting Ting to the trigger role in a primary source. Multiple corroborating-but-softer sources back it up. This is defensible but not over-determined — captured honestly in the "Gaps in our intelligence" section.

## 5. Add "Gaps in our intelligence" section instead of pretending we know everything

**Decision:** Include a dedicated section listing what we don't know (Adaptive's actual rating methodology, whether Ting is also used for pricing, reinsurance pricing on TMHCC paper, non-US entrants, regulatory vs data constraints on the 18-state footprint).

**Rationale:** Keeps the doc honest. Forces explicit acknowledgement of weak points before a teammate or client surfaces them. Makes future research scopable — every line in that section is a research task ready to be picked up. Aligns with the broader "documents first, code last" planning workflow discipline.

## 6. Treat the teammate's "PoUS as trigger" hypothesis as a falsifiable claim, not a correction

**Decision:** Verify with primary sources rather than auto-updating the doc to match the teammate's source.

**Rationale:** Teammate sources matter, but so does the primary-source evidence trail. Found zero primary sources tying Adaptive to PoUS as a trigger. Multiple primary sources naming Ting. The honest conclusion is: Ting is the correct answer for the current product, and the teammate's source likely predates the Aug 2025 Ting integration or conflates PoUS as a generic brand. Documented this reasoning in the verification message rather than silently changing the doc.

## 7. Wire into library as a new "Strategy" nav group

**Decision:** Add a new nav group in the library titled "Strategy" containing the competitive landscape entry, positioned between "What's next" and "Walkthroughs."

**Rationale:** "Strategy" is the right semantic bucket — competitive positioning is neither methodology mechanics (walkthroughs) nor forward roadmap. Creating a distinct group also leaves room for future strategy docs (pricing/positioning notes, partner-relationship modes, regulatory strategy) without re-shuffling existing groups.

## 8. Keep refinement of `competitive_landscape.md:25` as a queued task, not a same-turn edit

**Decision:** End the verification turn with a proposed edit rather than executing it immediately.

**Rationale:** The user asked "can you give me source which proves this" — that is a verification request, not an edit request. Doing the edit unprompted would skip the explicit approval step. Following the planning-workflow discipline: research → reason → plan → user approves → implementation. The proposed edit is captured in `task_context.md` and `handoff.md` for the next session to pick up.
