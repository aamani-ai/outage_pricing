# Prompt: Create Task Documentation

Use this prompt at the **end of a chat session** to have the AI generate comprehensive task documentation.

---

## Copy-Paste This Prompt:

```
We've completed work on [BRIEF DESCRIPTION OF WHAT YOU WORKED ON].

Please create task documentation in docs/extra/tasks_history/ following our standard format:

1. **Folder name:** Use format YYYY-MM-DD__area__short-slug
   - Today's date: [FILL IN, e.g., 2026-01-16]
   - Area: [FILL IN, e.g., forecast-simulation, gcs-bucket, asset-registry, etc.]
   - Short slug: [FILL IN, e.g., cleanup-organization, registry-fixes, etc.]

2. **Create these files:**
   - task_context.md (objective, background, problems, what we fixed, files touched, current status)
   - decisions.md (key design decisions with rationale)
   - notes.md (detailed implementation, commands used, verification, metrics, key insights)
   - handoff.md (10-bullet summary for next session/model switch)

3. **Important context to include:**
   - What problems we were solving
   - What we changed (files, configs, GCS folders, etc.)
   - Commands/scripts we ran
   - Verification steps
   - Known issues (resolved vs remaining)
   - Key insights/lessons learned

Please review the conversation history and create comprehensive docs covering everything we accomplished today.

Existing task folders for reference: @docs/extra/tasks_history
```

---

## Task Naming Guide

### Format
`YYYY-MM-DD__area__short-slug`

### Area Examples
- `news-pipeline` — News fetch, classification, linking
- `queue-pipeline` — Interconnection queue fetch, build, entity resolution
- `web-app` — UI components, explore page, plant detail
- `data-pipeline` — EIA/GEM/Wikidata pipeline work
- `deploy` — Export, database push, Vercel deploy
- `seo` — Sitemap, structured data, GSC
- `financial` — FERC, LBNL, EQR financial dimension
- `engineering` — USPVDB, USWTDB, engineering dimension
- `docs` — Documentation updates

### Short Slug Tips
- Keep it 2-4 words max
- Describe the specific fix/feature
- Examples:
  - `cleanup-organization`
  - `registry-timing-fixes`
  - `nb04-paths-explorer`
  - `hindcast-validation`
  - `phase0-planning`

### Good Examples
- `2026-01-16__gcs-bucket__cleanup-organization`
- `2026-01-14__forecast-simulation__registry-timing-fixes`
- `2026-01-14__backtesting__nb05-hindcast-validation`
- `2026-01-13__forecast-simulation__nb04-paths-explorer`

### Bad Examples
- `2026-01-16__misc__stuff` (too vague)
- `jan-16-bucket-cleanup` (wrong date format)
- `2026-01-16__gcs-bucket-cleanup-and-organization-plus-documentation` (too long)

---

## What Makes Good Task Docs

### task_context.md
- **Objective** — 1-2 sentences on the goal
- **Background** — Why this work was needed
- **Problems encountered** — Specific blockers/issues
- **What we fixed** — Numbered list with details
- **Files touched** — Categorized (modified, created, deleted, GCS changes)
- **Current status** — Checklist of acceptance criteria
- **Next steps** — What's left to do

### decisions.md
- **One section per decision** — Title + Decision + Rationale
- **Why, not just what** — Explain tradeoffs considered
- **Format:** `## N. Decision Title` with Decision and Rationale subsections

### notes.md
- **Chronological or topical sections**
- **Commands used** — With comments explaining purpose
- **Verification steps** — How to confirm it worked
- **Metrics** — Counts, sizes, timing (if applicable)
- **Key insights** — What we learned

### handoff.md (MOST IMPORTANT — this is the bridge to the next session)
- **10-bullet summary** — Can be read in 60 seconds (what happened, not how)
- **Files touched** — Quick list for context
- **Repro commands** — How to verify current state
- **Next action section (PRIMARY FOCUS)** — This is the main value of handoff.md:
  - Explicit multi-step execution roadmap (Phase A, B, C... with specific actions)
  - Every file path the next session needs to read before starting
  - Key design docs and plans to reference
  - Critical context/gotchas that aren't obvious from code alone
  - What data is already downloaded/available vs what needs fetching
  - The next session should be able to start executing immediately from this section

---

## Tips

1. **Run this at END of session** — Wait until work is complete
2. **Reference existing tasks** — Use `@local_docs/llm/tasks` to show format examples
3. **Be specific** — Better to have too much detail than too little
4. **Include commands** — Future you will thank past you for exact commands
5. **Flag remaining issues** — Don't pretend everything is perfect if it's not

---

## Example Prompt (Filled In)

```
We've completed work on cleaning up and organizing the GCS bucket structure, resolving mixed-case naming issues, and creating comprehensive documentation.

Please create task documentation in docs/extra/tasks_history/ following our standard format:

1. **Folder name:** 2026-01-16__gcs-bucket__cleanup-organization

2. **Create these files:**
   - task_context.md (objective, background, problems, what we fixed, files touched, current status)
   - decisions.md (key design decisions with rationale)
   - notes.md (detailed implementation, commands used, verification, metrics, key insights)
   - handoff.md (10-bullet summary for next session/model switch)

3. **Important context to include:**
   - Mixed Title_Case/lowercase duplicates in forecast_data and revenue_data
   - Scattered backup files and deprecated folders
   - Created archive/ and backups/ organization
   - Moved 92 Title_Case folders to archive
   - Created comprehensive bucket documentation with architecture diagram
   - Moved documentation to docs/layer_1/data_infrastructure/
   - Remaining issues: LMP naming, VACS missing, 52 vs 48 folder count

Please review the conversation history and create comprehensive docs covering everything we accomplished today.

Existing task folders for reference: @docs/extra/tasks_history
```
