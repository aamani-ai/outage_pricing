# Validate Attribution: Evidence & Source Audit

**Purpose:** Validate whether statements in a document are **(a) directly supported by cited sources**, **(b) reasonable inferences**, or **(c) engineering judgment/calibration** — and rewrite wording so the epistemology is defensible.

This is designed for cases like:
- “Source: IEC 61215 §X” attached to **numeric damage thresholds**
- Standards being used as if they define wildfire failure conditions
- Mixed evidence classes (standards + materials science + fire engineering + forensics) not separated clearly

---

## What This Command Does

Given a target document (and optionally PDFs/notes), it produces a **Validation Ledger**:

- **Claim** (verbatim excerpt)
- **Claim Type**: definition / requirement / empirical fact / derived calculation / model assumption / calibration / interpretation
- **Evidence Class**:
  - **E1 — Direct text in cited source** (strongest)
  - **E2 — Direct implication from cited source** (still strong; requires minimal reasoning)
  - **E3 — External literature support** (materials science / fire engineering / reliability)
  - **E4 — Field/forensic support** (photos, claims notes, post-event reports)
  - **E5 — Engineering judgment / calibration knob** (acceptable, but must be labeled)
- **Verdict**: Supported / Partially supported / Unsupported / Misattributed
- **Fix**: rewrite the sentence(s) to be defensible, including correct attribution language
- **Confidence**: High / Medium / Low

---

## How to Use

1. Provide:
   - The file to validate
   - Any referenced standards/literature files you have locally
   - What you care about (e.g., “validate IEC/UL citations”, “validate heat-flux mapping”)

2. Ask for one of these modes:
   - **Mode A (Quick Audit)**: top 15–30 high-risk claims
   - **Mode B (Full Audit)**: all claims in selected sections
   - **Mode C (Standards-only Audit)**: only claims that mention IEC/UL/IEEE/NFPA/ASTM

---

## Where to Store the Output (Recommended)

Create an audit report Markdown file **next to the methodology** (preferred for review workflows), under a `validation/` subfolder.

**Default location (recommended):**
- Same folder as the target doc, in: `validation/`

**Filename convention:**

`validate_attribution_YYYY-MM-DD__<target_doc_basename>__<scope>.md`

Examples:
- `validate_attribution_2026-02-04__damage_curve_derivation_methods__standards_only.md`
- `validate_attribution_2026-02-04__damage_curve_derivation_methods__full_sections_3-6.md`

**Why this location works well:**
- Keeps validation artifacts close to what they validate
- Makes it easy to diff/iterate over time
- Avoids dumping audits into a global Q&A file where they get lost

---

## Output Structure

### 1) Epistemology Statement (1 paragraph)

Generate a “defensibility framing” paragraph like:
- We are not claiming standards define wildfire damage thresholds.
- We are synthesizing standards (bounds) + materials science + fire engineering + forensics to construct a transparent fragility model.

### 2) Validation Ledger (table)

| # | Claim (verbatim) | Source cited | Evidence class | Verdict | Fix (rewrite) |
|---|------------------|-------------|----------------|--------|---------------|

### 3) Red-Flag Patterns Detected

Examples:
- **Misattribution**: numeric threshold not present in cited standard
- **Category error**: qualification test envelope treated as failure threshold
- **False precision**: 3-decimal parameters with ±50% uncertainty
- **Hidden calibration**: “derived from physics” but actually tuned to match expectations

### 4) Patch Suggestions (ready-to-apply wording)

Provide copy-paste replacements for the exact sentences/blocks to fix.

---

## Ideal Format (What “Good” Looks Like)

- **Lead with a single-paragraph epistemology statement** (the “defensibility framing”).
- **Then the ledger** for the highest-risk claims first (misattribution, category errors).
- **Then patch blocks** that can be pasted into the source doc with minimal editing.
- Keep the ledger “mechanical” (verbatim excerpts, crisp verdicts); keep interpretation in a short “Red-Flag Patterns” section.

---

## Validation Principles (Non-negotiable)

- **Separate evidence classes explicitly**:
  - Standards: qualification envelope / safety requirements (**bounds**, not wildfire failure temperatures)
  - Materials science: decomposition/softening/annealing thresholds (**mechanisms**)
  - Fire engineering: heat flux, duration, heating rate (**exposure bridge**)
  - Forensics: ordering and typical outcomes (**reality check**)
  - Calibration: parameters chosen to match observed/plausible outcomes (**label as calibration**)

- **Never say “Source: IEC/UL” for a number unless it’s in the standard**.
  - If the standard only bounds normal operation, say that.

- **If it’s inferred, say inferred**:
  - “Indicative,” “literature-supported,” “engineering judgment,” “calibration target,” etc.

---

## Templates (Copy/Paste Wording)

### Standards-boundary wording

> IEC/UL standards define qualification and safety test envelopes (e.g., –40°C to +85°C for thermal cycling), which we use as **boundary conditions** for normal operation and reliability screening. They do **not** specify wildfire damage thresholds.

### Derived/synthesized threshold wording

> High-temperature damage onset thresholds shown here are **indicative** and are derived from a synthesis of **materials science**, **fire engineering exposure relationships**, and **post-event forensic observations**, with standards used only to anchor normal-operation bounds.

### Calibration knob wording

> Heat-flux thresholds are treated as **calibration targets** consistent with published fire engineering damage bands and engineering judgment, rather than outputs of a closed-form thermal model.

---

## Success Criteria

✅ A reader can tell, for every key number/threshold, whether it is:
- directly in a standard,
- derived from literature,
- calibrated,
- or an explicit assumption.

✅ The document becomes **harder to attack** in underwriting / audit / litigation contexts because attribution is precise and honest.
