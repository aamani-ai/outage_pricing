# Handoff — 2026-06-02 Competitive Landscape + Trigger Verification

## 10-bullet summary

1. Created **[`docs/methodology/competitive_landscape.md`](../../methodology/competitive_landscape.md)** — canonical living reference for the parametric outage segment. Covers Adaptive/GridProtect, Whisker Labs Ting, PowerOutage.US, Parametrix, Ki Insurance.
2. Wired the doc into the **in-app methodology library** as a new "Strategy" nav group between "What's next" and "Walkthroughs."
3. Cross-linked from [`docs/plan/trigger_source_implications.md`](../../plan/trigger_source_implications.md) and [`docs/dicsscssion/utility_oms_and_trigger_sources.md`](../../dicsscssion/utility_oms_and_trigger_sources.md).
4. Bumped cache-bust to `?v=20260531-1`. Deploy succeeded (gh run 26849954350).
5. Teammate raised: *"some sources say PowerOutage.US is Adaptive's trigger, not Ting."* Verified the claim against primary sources.
6. **Conclusion:** Ting is correct for the current product (post Aug 2025 integration). No primary source ties Adaptive to PoUS as a trigger.
7. **Strongest evidence:** [IT Brief](https://itbrief.news/story/adaptive-whisker-labs-bring-real-time-data-to-outage-insurance) — the only primary source using the explicit word *"triggered"* with Ting: *"allowing insurance claims to be triggered, verified, and paid using live grid data."*
8. **Honest caveat:** Adaptive's own [website](https://www.adaptiveinsurance.com/) does NOT name Ting on product pages. The TMHCC June 2025 announcement predates the Ting integration and names no data provider.
9. **Likely explanation for teammate's sources:** they're either older than Aug 2025, or conflate PoUS as a generic brand for outage data.
10. **One queued refinement:** soften [`competitive_landscape.md:25`](../../methodology/competitive_landscape.md#L25) from a flat "Ting sensor network" assertion to a timestamped + sourced attribution.

## Files touched

**Created:**
- `docs/methodology/competitive_landscape.md`

**Modified:**
- `price_engine/dashboard/app.js` (LIBRARY_SECTIONS, link rewriter, Strategy nav group)
- `price_engine/dashboard/index.html` (library nav, cache-bust)
- `docs/plan/trigger_source_implications.md` (cross-link)
- `docs/dicsscssion/utility_oms_and_trigger_sources.md` (cross-link)

**Verified untouched (per session contract):**
- `price_engine/data/`, `pricing/`, `filtration/` — v0 byte-identical
- All NDA-scoped folders

## Repro commands

```bash
# Verify dashboard renders the competitive landscape entry
open http://127.0.0.1:8001/dashboard/
# Click "Library" → expand "Strategy" → click "Competitive Landscape"

# Verify deploy state
gh run list --workflow=deploy-outage-pricing.yml --limit 5
gh run view 26849954350 --log

# Re-verify trigger-source claim
# (sources in order of strength)
# 1. IT Brief (explicit "trigger" + Ting):
#    https://itbrief.news/story/adaptive-whisker-labs-bring-real-time-data-to-outage-insurance
# 2. Artemis.bm partnership announcement:
#    https://www.artemis.bm/news/adaptive-and-whisker-labs-launch-real-time-parametric-power-outage-insurance/
# 3. Insurance Edge with CTO quote:
#    https://insurance-edge.net/2025/08/04/adaptive-insurance-integrates-ting-insights-into-grid-protect/
```

## Next action — Phase A then optionally B / C

### Phase A — Refine the trigger-source attribution in competitive_landscape.md (READY NOW)

The single line to change is currently:

> **Trigger source:** Whisker Labs Ting sensor network (see §2 below).

Proposed replacement (already drafted in the verification message):

> **Trigger source (as of Aug 2025):** Whisker Labs Ting sensor network — per the [Adaptive + Whisker Labs partnership announcement (Jul 2025, via Artemis.bm)](https://www.artemis.bm/news/adaptive-and-whisker-labs-launch-real-time-parametric-power-outage-insurance/) and the explicit "trigger" attribution in [IT Brief (Aug 2025)](https://itbrief.news/story/adaptive-whisker-labs-bring-real-time-data-to-outage-insurance). Adaptive's own product pages do not publicly name the data source; the earlier (2024) trigger source was not publicly named.

Steps:
1. Read `docs/methodology/competitive_landscape.md` to confirm current line 25.
2. Edit line 25 with the replacement above.
3. Bump `Last reviewed:` to 2026-06-02.
4. Bump dashboard cache-bust to `?v=20260602-1` in `price_engine/dashboard/index.html`.
5. Commit + push to `deploy/outage-pricing`. Watch deploy with `gh run watch`.

### Phase B — Add a "Timeline of trigger-source disclosures" sidebar (OPTIONAL)

Helps neutralize the next teammate question by making the timeline explicit:

| Date | Event | Trigger source named? |
|---|---|---|
| 2024 | GridProtect launch | No |
| Jun 2025 | TMHCC + Adaptive partnership | No ("verified trigger events" only) |
| Jul–Aug 2025 | Whisker Labs + Adaptive partnership announced | **Yes — Ting Insights** |
| Today (2026-06-02) | Public product pages | Still not named on Adaptive's own site |

Lives as a subsection under §1 in `competitive_landscape.md`.

### Phase C — Pick off one "Gaps in our intelligence" item (FUTURE WORK)

The 5 open items from the doc, ranked by ease/value:

1. **Easiest:** Check TMHCC public filings for GridProtect reinsurance pricing disclosure.
2. **Medium:** Survey non-US parametric outage entrants (UK, EU, Australia, Japan).
3. **Hard:** Adaptive's actual rating methodology — would need a direct conversation, not a research task.

## Key context / gotchas for next session

- **v0 pricing math is locked.** `price_engine/data/`, `pricing/`, `filtration/` must remain byte-identical without explicit user approval. Competitive-landscape work does not touch these.
- **NDA-scoped folders never get pushed publicly.** `docs/extra/poweroutage_us/`, `docs/extra/outage_data/`, API key `.env` — gitignored, never commit.
- **Cache-bust discipline.** Every dashboard edit needs the `?v=YYYYMMDD-N` bump in `index.html`. Two prior "dashboard not loading" incidents traced to soft-refresh cache mismatches. Server.py Cache-Control headers added in the previous session help, but the query-string bump is still required.
- **Library markdown is served via symlink.** `price_engine/dashboard/methodology → ../../docs/methodology`. No build step. Markdown edits are visible on next reload.
- **Planning-workflow discipline:** research → reason → plan → user approves → implementation. Don't auto-edit canonical docs without an explicit approval step.
- **Today's date when next session reads this:** 2026-06-02. Update "Last reviewed" timestamps in `competitive_landscape.md` accordingly.
