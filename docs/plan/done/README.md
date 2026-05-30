# Completed Plans Archive

Plans that have been fully executed — meaning the work landed in code, in published docs, or in a follow-on plan that supersedes them — are archived here so the active `docs/plan/` folder stays uncluttered.

## How to archive a plan

When a plan is closed:

1. **Add a closure note** at the top of the plan file under a `## Closure (YYYY-MM-DD)` heading. The note should record:
   - What was actually delivered (link the code, the doc, or the artifact).
   - What was deferred or descoped, and why.
   - Which follow-on plan (if any) picks up the open threads.
2. **Rename the file with a date prefix**: `YYYY-MM-DD_<original_name>.md` (the date the plan was closed). This keeps the archive sortable.
3. **Move it to this folder**: `mv docs/plan/<file>.md docs/plan/done/YYYY-MM-DD_<file>.md`.
4. **Update [`../README.md`](../README.md)**: remove the entry from "Current Plans" and add a one-line entry under "Archive" linking to the archived path.
5. **Update cross-references** in any related doc that still pointed to the old path. Prefer pointing at the follow-on plan if one exists.

## What this folder is not

- Not a working directory. Do not edit plans here.
- Not a graveyard for stale planning that was never executed — those should be deleted or rewritten, not archived. Archive means "this is how we did it; preserved for traceability."
- Not the place to store research notes that were never plans. Those belong in `docs/learning_logs/` or `docs/dicsscssion/`.
