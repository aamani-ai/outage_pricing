# Notes — 2026-06-02 Competitive Landscape Session

## Implementation summary

### New file: `docs/methodology/competitive_landscape.md`

~105 lines. Structure:

1. Header (status, dates, audience)
2. Market context (TAM, growth, "collaborative ecosystems" trend)
3. Direct outage-segment players (Adaptive §1, Ting §2, PoUS §3)
4. Adjacent-vertical players (Parametrix §4, Ki §5)
5. Players NOT seen in segment (reinsurers, major brokers, other insure-tech)
6. How we position (positioning paragraph)
7. How we use this document (pitch / library / refresh)
8. Gaps in our intelligence (5 open questions)
9. Cross-references

Citations include: Reinsurance News, Insurance Business America, Insurance Journal, Bold Penguin, TMHCC, Whisker Labs, IT Brief, Disaster Recovery Journal, PowerOutage.us, Parametrix, Ki Insurance.

### Dashboard wiring

In [`price_engine/dashboard/app.js`](../../../price_engine/dashboard/app.js):
- Added `LIBRARY_SECTIONS['competitive-landscape']` entry pointing to `methodology/competitive_landscape.md`
- Added `'competitive_landscape.md': 'competitive-landscape'` to the `rewriteLibraryMarkdownLinks()` map so in-library cross-links navigate without page reloads
- Added a new "Strategy" group in the library nav structure (between "What's next" and "Walkthroughs")

In [`price_engine/dashboard/index.html`](../../../price_engine/dashboard/index.html):
- Updated the library nav `<ul>` to include the new Strategy group + Competitive Landscape link
- Bumped cache-bust from `?v=20260530-X` to `?v=20260531-1` on both `styles.css` and `app.js`

Symlink `price_engine/dashboard/methodology → ../../docs/methodology` continues to serve the markdown live (no rebuild needed).

### Cross-links added

In [`docs/plan/trigger_source_implications.md`](../../plan/trigger_source_implications.md):
```
> See also: docs/methodology/competitive_landscape.md
> consolidates the live competitive picture into a single canonical
> reference. This file remains the source of truth for the
> *trigger-source-implications-for-pricing* reasoning.
```

In [`docs/dicsscssion/utility_oms_and_trigger_sources.md`](../../dicsscssion/utility_oms_and_trigger_sources.md):
Added consolidated-competitive-landscape reference link in the "Sensor-network trigger candidate" source section.

## Verification

### Deploy
```
gh run watch 26849954350
# Result: conclusion: success
```

### In-browser smoke test
- Library button opens drawer
- "Strategy" group appears with Competitive Landscape entry
- Clicking renders the markdown via vendored `marked.min.js`
- Internal cross-links (to roadmap, trigger_source_implications, utility_oms) navigate within the library drawer instead of leaving to GitHub
- Cache-bust took effect (no stale `?v=20260530-...` references in network tab)

### Trigger-source verification — primary sources fetched

| Source | URL | Names Ting? | Uses word "trigger"? |
|---|---|---|---|
| IT Brief | itbrief.news/story/adaptive-whisker-labs-bring-real-time-data-to-outage-insurance | ✅ | ✅ ("triggered, verified, and paid using live grid data") |
| Artemis.bm | artemis.bm/news/adaptive-and-whisker-labs-launch-real-time-parametric-power-outage-insurance | ✅ | ❌ (says "will now provide ... by leveraging Ting Insights") |
| Insurance Edge | insurance-edge.net/2025/08/04/adaptive-insurance-integrates-ting-insights-into-grid-protect | ✅ | ❌ (Yelovitch quote: "real-time, hyper-local power outage data from Ting Insights") |
| Whisker Labs Ting Insights | whiskerlabs.com/ting-insights | ✅ (mentions Adaptive) | ❌ |
| Adaptive Insurance website | adaptiveinsurance.com | ❌ (does NOT name Ting on product pages) | ✅ ("automatically triggers coverage") |
| TMHCC June 2025 release | tmhcc.com/en-us/news-and-articles/company-news/adaptive-insurance-and-tokio-marine-hcc-partner-to-tackle-150bn-power-outage-losses | ❌ (predates Ting integration) | ✅ ("verified trigger events") |
| Reinsurance News 18-state launch | reinsurancene.ws/tokio-marine-hcc-teams-up-with-adaptive-insurance-to-launch-short-term-power-outage-coverage-in-18-states | ❌ | ❌ |

**Searches checked for PowerOutage.US ↔ Adaptive linkage:** none found. No primary source ties Adaptive to PoUS as the trigger.

### Key evidence sentence (the one explicit "trigger" attribution)
> "The integration sees Whisker Labs' Ting Insights added to Adaptive's flagship parametric insurance product, GridProtect, allowing insurance claims to be **triggered, verified, and paid using live grid data**."
> — [IT Brief](https://itbrief.news/story/adaptive-whisker-labs-bring-real-time-data-to-outage-insurance)

## Key insights / lessons

1. **Adaptive's own product pages don't publicly name Ting.** That's worth knowing — the trade-press coverage names it, the partnership announcements name it, but Adaptive's customer-facing site keeps the data source unnamed. Suggests they consider the trigger-source detail commercial / contractual rather than marketing.
2. **Timeline matters for source comparison.** GridProtect launched 2024; TMHCC paper June 2025; Ting integration Aug 2025. Any analyst note older than Aug 2025 was guessing or working from non-public info. Always ask for the source date when a teammate brings a contradicting fact.
3. **"Trigger" vs "data" vs "verification" — words matter.** Only IT Brief uses the explicit "trigger" framing. The other sources say "leveraging," "real-time data," "automated assessment" — all consistent with trigger but less surgical. The phrasing distinction is worth preserving in our doc.
4. **The §1/§2 reframe (MGA vs trigger-network) is load-bearing.** Tested it informally by re-reading the doc cold — it's what makes the "we sit underneath all three" positioning paragraph land. Without it the positioning reads as competitive rather than complementary.
5. **"Gaps in our intelligence" forces honesty.** Listing what we don't know is more useful than overclaiming what we do. Five open questions → five research tasks ready to scope.
6. **Cache-bust + Cache-Control work.** No stale-cache incident this session despite multiple dashboard edits. The server.py Cache-Control headers added last session + `?v=` query string discipline appears to be a durable fix.

## Metrics

- Competitive landscape doc: ~105 lines, 9 sections, ~15 external citations
- Files modified: 4 (1 created, 3 cross-linked)
- Deploy time: ~3 min (gh run 26849954350)
- Primary sources fetched and quoted for verification: 7

## Commands used

```bash
# Deploy
git add docs/methodology/competitive_landscape.md docs/plan/trigger_source_implications.md docs/dicsscssion/utility_oms_and_trigger_sources.md price_engine/dashboard/app.js price_engine/dashboard/index.html
git commit -m "Add competitive landscape doc; wire into library; bump cache"
git push origin deploy/outage-pricing

# Watch deploy
gh run watch 26849954350
```

## Known issues (resolved vs remaining)

**Resolved:**
- Teammate's PoUS-as-trigger hypothesis — verified against primary sources, Ting is correct for current product (post Aug 2025).

**Remaining (queued):**
- `competitive_landscape.md:25` — soften flat assertion to timestamped + sourced attribution.
- Adaptive's actual rating methodology — unknown (closed product).
- Whether Ting is used for pricing as well as trigger by anyone — unknown.
- TMHCC reinsurance pricing on GridProtect — unknown (check public filings).
- Non-US parametric outage entrants — not yet researched.
- Adaptive 18-state footprint constraint type (regulatory vs data) — unknown.
