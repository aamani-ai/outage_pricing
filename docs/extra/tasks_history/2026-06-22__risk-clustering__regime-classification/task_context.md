# Task Context — Step 3 Risk Clustering: Regime Classification (2026-06-22)

## Objective

Build **Step 3 (risk clustering)** correctly: a defensible, per-county **behavioral regime
classification** on the source-coverage-masked outage series — and turn it into a complete,
shareable reference for the team.

## Background

- Step 3 had been a **shadow 7-shape pattern classifier** (`county_trend` / `county_predictability`
  → smooth/volatile trend · episodic · step-change · stable · sparse). It **churned**: the v1 rule
  order moved 858 labels with *bidirectional* reshuffling — the shapes overlapped.
- The **source-coverage mask** (the Step-3 pre-clean: observed-zero vs missing, the EAGLE-I
  coverage ramp) was already built and validated in a prior session.
- This session reframed Step 3 from the ground up and rebuilt it.

## Problems we hit (and resolved)

1. **7-shape churn** — too many overlapping threshold-defined buckets. → replaced by a small,
   significance-gated outcome set.
2. **Step-3 / Step-5 conflation** — the first rebuild let a *forecasting backtest* define the
   regime. That pulled model-selection (a Step-5 job) into the clustering and rested on fragile
   ~7-point backtests. → backtest moved to Step 5 as *evidence*; Step 3 is now pure stats.
3. **Real classifier bugs** (caught by adversarial verification): perfect-fit divisor *inverted*
   labels (a flawless ramp → flat); `episodic` swallowed late ramps; near-zero counties faked
   `episodic`; a single terminal spike faked `shift`. → all fixed.
4. **Force-fitting labels on thin data** — Cherry NE `[0,2,4,0,22,39]` came out "trend" (it's a
   2-yr surge, not a trend). → the **abstain, don't force** reframe: a 5th outcome `insufficient`.

## What we built

1. **Stats regime classifier** (`regime_classification.ipynb`) — a significance-gated rule tree on
   the masked ≥8h annual series → one of **stable / trend / shift / episodic + insufficient**.
2. **The abstain reframe (A015)** — ~11% of counties get `insufficient` (recent-change / low-volume
   / short-history) rather than a forced wrong label.
3. **Per-county metadata** — sub-flag, confidence (an honesty flag), per-T label vector, and a
   **cross-T descriptor** (`intensifies@longT` = storm-driven long outages), plus a `show_county()` card.
4. **The artifact** — `notebooks/outputs/regime_classification/county_regime_T8.csv` (3,090 counties).
5. **The reference docs** — a shareable **README overview**, the **canonical methodology**, and
   assumptions **A013–A016**; the backtest re-filed as **Step-5 evidence**.

## Files touched

**Created**
- `docs/methodology/03_risk_clustering/README.md` — the shareable Step-3 overview (entry point)
- `docs/methodology/03_risk_clustering/regime_classification_methodology.md` — canonical HOW + metadata map
- `docs/plan/03_risk_clustering/regime_routing_backtest_plan.md` — design history + Step-5 backtest evidence
- `notebooks/03_risk_clustering/regime_classification.ipynb` — the classifier (current)
- `notebooks/_archive/README.md`; `.gitignore` entry for `scratchpad/`

**Modified**
- `docs/methodology/assumptions.md` — A013–A016 added/refined
- `docs/OUTAGE_MODELING_FRAMEWORK.md` — Step-3 section rewritten · status bar · doc-map · A001–A016
- `docs/methodology/00_reading_order.md`, `docs/methodology/roadmap.md` — Step-3 repointed to current docs
- `docs/dicsscssion/eventization_frequency_contract/05_source_coverage_mask.md` — consumer repointed
- `docs/plan/README.md` — 7-shape plan archived; redesign callout
- `notebooks/README.md` — new notebook + `_archive/` + `05_forward_regime/` sections
- Bannered superseded: `outage_trend_fundamentals.md`, `outage_predictability_fundamentals.md`,
  `lambda_shadow_pricing_fundamentals.md`, `dicsscssion/risk_based_clustering/*`

**Moved / archived**
- `risk_based_clustering_quantification_plan.md` → `plan/done/2026-06-22_…` (7-shape, closure note)
- `outage_regime_analysis_initial.ipynb` → `notebooks/_archive/`
- `regime_routing_backtest.ipynb` → `notebooks/05_forward_regime/` (Step-5 evidence, not Step 3)

## Current status

```text
 ✔ Step-3 stats classifier BUILT + adversarially verified (3-lens; bugs fixed)
 ✔ abstain outcome (insufficient) + per-T metadata + cross-T descriptor + county card
 ✔ artifact saved (county_regime_T8.csv, 3,090 counties)
 ✔ complete cross-linked reference (README · methodology · mask · notebooks · A013–A016 · framework)
 ✔ cleanup: backtest→05_forward_regime · scratchpad gitignored · all links repointed (verified)
 ☐ share README with team
 ☐ dashboard rebuild (scoping pass) — parallel next track
 ☐ revisit A016 (a T-specific coverage signal) before it ships to the actuarial consultant
```

## Next steps

1. **Share** the README with the team (it's the single self-contained link).
2. **Dashboard** — scope a fresh build (regime color-by map · county card · chronic-vs-storm layer).
3. **A016** — derive/validate a T-specific coverage signal (the mask is all-duration applied to ≥8h).
