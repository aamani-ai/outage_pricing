# Step 3 — Risk Clustering (Regime Classification): Overview

*Start here. The single shareable entry point for Step 3 — one screen; drill into the linked docs +
notebooks for the detail. Part of the [end-to-end framework](../../OUTAGE_MODELING_FRAMEWORK.md).*

**What Step 3 is:** each U.S. county gets one **behavioral identity** — a label for how its
long-outage (≥8h) history *behaves*. It is **behavior, not cause** (no weather/grid inputs —
[A013](../assumptions.md)), a **router, not a forecast**, and it changes **no price**. It exists so a
downstream forecasting layer (Step 5) knows *which* machinery each county needs.

## The pipeline: clean → categorize → output

```text
   masked ≥8h annual              significance-gated rule tree            one regime / county
   event series per county  ──▶   (ABSTAIN when the data can't      ──▶   + confidence + cross-T
   (coverage ramp removed)         support a confident label)             stability  →  Step 5 / dashboard
          │                                  │                                   │
     §1 (pre-clean)                    §2 (categorize)                      §3 (output)
```

## 1. Pre-clean — the source-coverage mask

EAGLE-I onboarded counties over 2014–2019, so early years are **under-counted, not quiet**. If we
treated those as real zeros, a county's trend would be manufactured by *improving coverage*. So we
mask the coverage-ramp years (observed-zero vs missing), **asymmetrically** — only the low/under-
covered side; genuine storm spikes are always kept.

→ **[05_source_coverage_mask.md](../../dicsscssion/eventization_frequency_contract/05_source_coverage_mask.md)** (the finding + the onset mask + safeguards) · notebook [`source_coverage_mask_analysis.ipynb`](../../../notebooks/03_risk_clustering/source_coverage_mask_analysis.ipynb)

## 2. Categorize — the five outcomes

A significance-gated rule tree, **defaulting to `stable`**, applied to each county's masked series:

```text
 GATES → INSUFFICIENT (abstain)  ─→  EPISODIC  ─→  SHIFT  ─→  TREND  ─→  STABLE (default)
```

| outcome | what it means | real example |
|---|---|---|
| **stable** | steady, mean-reverting noise — the long-run mean is the honest summary | Bexar TX `██▇▅▁█▁▅▆█▆` |
| **trend** | a real, persistent slope (up/down) — a fitted line beats the mean | Putnam FL `▁▁▂▂▄▄▅▆▆▇█` |
| **shift** | jumped to a new level and held it (≥3 post-years) | Whatcom WA `▁▆▇▆█▇████▇` |
| **episodic** | one/two storm-spike years that **revert** — rare-storm, not chronic | Albany WY `▁▁█▄▁▁▁▁▁` |
| **insufficient** | the honest abstention — *can't type it* (recent-change / low-volume / short-history) | Cherry NE `▁▁▁▁▅█` |

```text
 distribution (T=8h):  stable 42 · trend 23 · shift 22 · insufficient 11 · episodic 1.5   (% of counties)
 the reframe that makes the labels TRUE → ABSTAIN, don't force: ~11% honestly say "can't type this"
 instead of being force-fit a wrong label (e.g. Cherry NE's 2-yr surge is NOT a "trend").
```

→ **[regime_classification_methodology.md](regime_classification_methodology.md)** (the canonical HOW — the decision tree, the T decision, the "abstain" reframe, full examples) · notebook [`regime_classification.ipynb`](../../../notebooks/03_risk_clustering/regime_classification.ipynb)

## 3. Output + the honest caveats

```text
 ARTIFACT   one row per county → outputs/regime_classification/county_regime_T8.csv
            regime · sub-flag · confidence · cross-T stability · per-T label vector + descriptor · features
 READ IT    every county also carries a cross-T DESCRIPTOR — incl. `intensifies@longT` (stable at
            short T, structured at long T = STORM-driven long outages; e.g. coastal Baldwin AL).
            full metadata map → methodology §7; the notebook's `show_county()` prints a card for any county.
 CAVEATS    A014  one label @ T=8h — T-stability is moderate (~0.60), not rigid; flagged per county
            A015  ~11% are 'insufficient' by design (abstain, don't force)
            A016  the mask is all-duration, applied to ≥8h (discards ~3,073 real ≥8h events) — flagged
```

**The honest line (for a carrier / actuary):** *we type a county's long-outage behavior only when the
data earns it — stable, trending, shifted, or storm-spiked — and we say "insufficient" (with the
reason) when it doesn't. It's an identity, not a forecast, and it moves no price.*

> **Surfacing note (docs ↔ dashboard consistency).** `insufficient` has two faces that must not read the
> same: `low-volume` / `short-history` are genuinely **sparse**, but `recent-change` is **data-rich**
> (median ~183 ≥8h events; e.g. Middlesex MA = 2,282) — the recency, not the data, blocks a label. The
> bare word "insufficient" implies *no data* and misleads on `recent-change`. Rule: **show the reason,
> never the bare label.** The dashboard renders `recent-change` as **"Recent change"** and the sparse
> ones as **"Insufficient data."** Classifier logic + schema label are unchanged — communication only.
> Full callout: [methodology §3](regime_classification_methodology.md).

## Cross-references

| | |
|---|---|
| **Canonical HOW (categorization)** | [`regime_classification_methodology.md`](regime_classification_methodology.md) |
| **Pre-clean (the mask)** | [`05_source_coverage_mask.md`](../../dicsscssion/eventization_frequency_contract/05_source_coverage_mask.md) |
| **Notebooks (live evidence)** | [`regime_classification.ipynb`](../../../notebooks/03_risk_clustering/regime_classification.ipynb) · [`source_coverage_mask_analysis.ipynb`](../../../notebooks/03_risk_clustering/source_coverage_mask_analysis.ipynb) |
| **Assumptions** | [A013](../assumptions.md) (behavior-not-cause) · A014 (T) · A015 (abstain) · A016 (mask) |
| **Design history + Step-5 evidence** | [`regime_routing_backtest_plan.md`](../../plan/03_risk_clustering/regime_routing_backtest_plan.md) · [`05_forward_regime/regime_routing_backtest.ipynb`](../../../notebooks/05_forward_regime/regime_routing_backtest.ipynb) (routing beats flat ~+18% OOS — the proof Step 5 is worth building) |
| **Framework (where Step 3 sits)** | [`OUTAGE_MODELING_FRAMEWORK.md`](../../OUTAGE_MODELING_FRAMEWORK.md) |
