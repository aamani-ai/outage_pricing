# Curated Data Plan

This folder holds phase plans for the curated outage data workstream.

## Phase Sequence

| Phase | Name | Purpose | Status |
|---|---|---|---|
| 0 | Project contract | Define scope, artifacts, folder rules, and decision process. | Draft |
| 1 | Cause attribution | Enrich outage events with likely cause labels and evidence. | Next |
| 2 | Grid condition features | Build utility, capex, reliability, and infrastructure-context features. | Parked |
| 3 | Forward-looking modeling support | Prepare modeling-ready targets/features for future risk adjustment. | Parked |

## Files

| File | Purpose |
|---|---|
| `00_project_contract.md` | Defines the curated-data project boundary and artifact contract. |
| `01_phase_cause_attribution.md` | Phase 1 plan for NOAA / DOE-OE-417 cause attribution. |
| `02_phase_grid_condition_features.md` | Phase 2 plan for utility/grid condition datasets. |
| `03_phase_forward_modeling_support.md` | Phase 3 plan for model-ready curated datasets. |
| `04_phase1_source_strategy.md` | Source hierarchy for PNNL/OE-417, NOAA, and unknown labels. |
| `workflow_template.md` | Repeatable research-to-learning workflow for every source/phase. |

## Decision Rule

The curated-data project can create richer datasets than `price_engine/`, but it
must not silently change v0 pricing math. Any curated feature that affects price
must first be validated and documented as an explicit overlay or next-version
modeling change.
