# Branching & Deploy Model

**Status:** describes the current setup + the fix for the `main` ↔ `deploy` drift.
**Last reviewed:** 2026-06-22 · **Owner:** outage pricing

## TL;DR

```text
 main                    canonical record. does NOT deploy. share / review from here.
 deploy/outage-pricing   the LIVE branch — pushing here AUTO-DEPLOYS the dashboard to Cloud Run.

 today changes are hand-RE-COMMITTED from deploy → main ("Sync source from deploy to main"),
       which is why the two branches look wildly diverged. → sync by `git merge` instead (below).
```

## The two branches

| branch | role | auto-deploys? |
|---|---|---|
| **`main`** | canonical source-of-record; the branch to share / review from | **no** |
| **`deploy/outage-pricing`** | active iteration **and** production deploy | **yes → Cloud Run** |

The deploy trigger lives in [`.github/workflows/deploy-outage-pricing.yml`](../.github/workflows/deploy-outage-pricing.yml):

> `on: push: branches: [deploy/outage-pricing]` — *"Keeps main non-deploying so iteration is
> decoupled from production."*

So a push to **`deploy/outage-pricing`** ships the dashboard; a push to **`main`** triggers nothing.

## Why `main` and `deploy` drift apart today

The commits `main` has that `deploy` doesn't are all titled **"Sync source from deploy to main: …"**.
That is the tell: changes are **re-committed** (cherry-picked / copied) from `deploy` onto `main`,
not **merged**.

```text
 a RE-COMMIT makes a NEW commit with a NEW SHA on main, even though the CONTENT is identical:

   deploy:  …──A──B──C   (Mapbox, Cloud Run, per-location view, …)
                   │  └ content copied onto main as fresh commits ↓
   main:    …──A'─B'─C'  (same content, DIFFERENT SHAs)

   → git now reports "main 7 ahead / deploy 26 ahead" — but it's largely the SAME work counted
     twice. The branches share almost no commits, so every manual sync drifts them further.
```

**Bottom line:** the drift is a *process artifact*, not divergent work. In content, `main` already
mirrors most of `deploy`; `deploy` is genuinely ahead only by the latest **not-yet-synced** work.

## The fix — sync by MERGE, not re-commit

```bash
# bring deploy's work onto main with SHARED history (no false divergence)
git checkout main
git pull
git merge deploy/outage-pricing        # fast-forward, or a single merge commit
git push origin main
```

After this, `main` shares `deploy`'s commits, so:

```bash
git log --oneline main..deploy/outage-pricing   # cleanly shows ONLY what's unsynced
```

Do this **instead of** copying files or cherry-picking. (One-time: because of the 7 existing
re-commits, the first merge may show small conflicts on already-synced files — resolve once, then it
stays clean.)

## Cookbook

```text
 deploy a dashboard change   commit to deploy/outage-pricing → push → CI deploys to Cloud Run
 sync deploy → main          the `git merge` above (not a re-commit)
 what's on deploy not main   git log --oneline main..deploy/outage-pricing
 share / review a file       link it on whichever branch has it — GitHub renders either (incl. notebooks)
 start new work              branch off deploy/outage-pricing (or work on it directly), keep main in sync via merge
```

## Open decision (not yet made)

A cleaner long-term model is **main-first**: integrate on `main`, then `git merge main →
deploy/outage-pricing` to ship. That makes `main` the source of truth and `deploy` just a deploy
pointer. It's a process change, so it's parked — **for now, keep deploy-first and switch the sync to
merge** (the section above), which removes the drift with no workflow disruption.

## References

- [`.github/workflows/deploy-outage-pricing.yml`](../.github/workflows/deploy-outage-pricing.yml) — the deploy trigger (Cloud Run via WIF + Artifact Registry)
- Cloud Run dashboard convention — see project memory / the deploy skill
