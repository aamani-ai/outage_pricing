# Honest Assessment: Critical Methodology Review

**Purpose:** Deep-dive critical thinking to question assumptions, explore alternatives, identify gaps, and honestly assess what's right, blurry, and wrong in methodologies, approaches, and design decisions.

**Philosophy:** Be genuinely critical, not just validating. Question fundamentals. Explore trade-offs. Call out problems. Reason through physics, data, and practical constraints.

---

## What This Command Does

This prompt helps you engage in **Socratic, critical dialogue** about:
- Methodology design decisions
- Technical approaches and assumptions
- Trade-offs between alternatives
- Gaps, limitations, and edge cases
- "Why X instead of Y?" fundamental questions

**Output:** Deep-dive Q&A documents (like `q&a_2026-02-04.md`) that capture honest reasoning.

---

## What This Command is NOT

This command is **not** a rigorous **source/attribution validator**.

If your main concern is:
- “Do these numeric thresholds actually appear in IEC/UL/NFPA/ASTM text?”
- “Are we misattributing inferred values to standards?”
- “What is standards-based vs materials-science-based vs calibrated judgment?”

…then use: `VALIDATE_ATTRIBUTION.md` (a claim→evidence→rewrite audit).

---

## How to Use

1. **Provide context:**
   - Point to the methodology/approach/document you want to assess
   - Attach relevant files/folders
   - State what you're questioning or want to explore

2. **Ask the AI to:**
   - Question fundamental assumptions
   - Compare alternatives (with honest pros/cons)
   - Identify what's blurry or uncertain
   - Call out actual problems or limitations
   - Reason through design trade-offs

3. **Expect:**
   - Honest critique (not just validation)
   - Deep exploration of "why" and "why not"
   - Physics-based reasoning
   - Practical constraint analysis
   - Multiple perspectives

---

## Assessment Framework

When critically reviewing a methodology, explore these dimensions:

### 1. **Fundamental Design Decisions**

**Questions to ask:**
- Why was X chosen as the core metric/approach?
- What are the alternatives? (List at least 2-3)
- What are the honest pros/cons of each?
- What does the physics/science actually say?
- What do practitioners/standards use?

**Example from Q&A:**
> "Why Intensity → Damage (not Heat Flux or Flame Length)?"
> - Explored 3 alternatives
> - Compared physics directness vs. data availability
> - Identified the embedded distance assumption
> - Concluded: pragmatic trade-off, not perfect physics

### 2. **Assumptions & Their Validity**

**Questions to ask:**
- What assumptions are embedded (explicitly or implicitly)?
- Are they defensible? Under what conditions?
- When do they break down?
- What's the magnitude of error they introduce?
- Are they conservative or optimistic?

**Example from Q&A:**
> "Gen 1 assumes d = 10m distance (baked into damage curve)"
> - Actual distance: 5m → 2× higher heat flux
> - Actual distance: 20m → 0.5× lower heat flux
> - Error: ±40%, within existing uncertainty budget
> - Acceptable for Gen 1, document for Gen 2

### 3. **What's Missing (Scope Gaps)**

**Questions to ask:**
- What scenarios are NOT modeled?
- Why were they excluded?
- Is the exclusion acceptable? For which use case?
- What's the magnitude of the missing effect?
- When does it become critical?

**Example from Q&A:**
> "Infrastructure-initiated fires not modeled in Gen 1"
> - For solar/wind: ~10-20% of risk → acceptable exclusion
> - For T&D: PRIMARY ignition source → MUST model in Gen 2
> - Different assessment for different asset types

### 4. **Limitations & Uncertainty**

**Questions to ask:**
- What are the known limitations?
- How big are the uncertainties (quantify)?
- Which uncertainties dominate?
- Can we validate/calibrate? With what data?
- How do uncertainties compound?

**Example from Q&A:**
> "Damage curve uncertainty: ±40-50% (biggest contributor)"
> - Larger than soiling effects (5-15%)
> - Adding soiling wouldn't change decisions (within noise)
> - BUT captures different risk pathway (near-miss scenarios)

### 5. **Alternative Approaches**

**Questions to ask:**
- What other methods exist?
- Why weren't they chosen?
- Under what conditions would they be better?
- Can we compare quantitatively?
- Could we switch later? At what cost?

**Example from Q&A:**
> Compared 3 fire metrics:
> - Flame Length: Simple but categorical, empirical
> - Heat Flux: Best physics but needs distance (unknown)
> - Intensity: Fire science standard, generalizable
>
> Choice: Intensity (pragmatic balance)

### 6. **Cross-Cutting Concerns**

**Questions to ask:**
- Does the approach generalize across asset types?
- How does it handle edge cases?
- What happens at boundary conditions?
- Are there cascading effects not captured?
- What implicit coupling exists?

**Example from Q&A:**
> "Same damage curve for wildfire→asset and asset→wildfire?"
> - Physics is the same (intensity → heat → damage)
> - BUT frequency calculation differs
> - AND spatial pattern differs
> - Curve reusable, context differs

---

## Critical Thinking Patterns

### Pattern 1: **Question the Obvious**

Don't accept "standard practice" without interrogation.

**Example:**
- "Everyone uses flame length" → But why? Is it the best metric?
- Dig into: Is it because it's easy or because it's physically correct?

### Pattern 2: **Steelman Alternative Approaches**

Don't strawman alternatives. Give them the strongest possible case.

**Example:**
> "Heat Flux → Damage would be superior IF:
> - FSim provided distance information
> - You had empirical heat flux measurements
> - Within-cell Monte Carlo (Gen 3)"
>
> Not dismissing it - showing when it becomes viable

### Pattern 3: **Quantify Trade-offs**

Move from qualitative to quantitative comparison.

**Example:**
> Not: "Uncertainty is high"
> But: "±60-70% combined uncertainty, dominated by ±40-50% damage curve"

### Pattern 4: **Identify Hidden Assumptions**

Surface what's implicit.

**Example:**
> "Intensity → Damage curve" implicitly assumes:
> - d = 10m (not stated in curve itself)
> - "Cell burns" ≈ "Fire exposes asset"
> - Representative exposure scenario

### Pattern 5: **Context-Dependent Assessment**

Same limitation can be acceptable for one use case, critical for another.

**Example:**
> Infrastructure ignition:
> - Solar/wind Gen 1: Acceptable (second-order)
> - T&D Gen 2: NOT acceptable (primary risk)

### Pattern 6: **Evolution Path Thinking**

How does Gen 1 → Gen 2 → Gen 3 progression work?

**Example:**
> Gen 1: Intensity → Damage (distance baked in)
> Gen 2: Multiple exposure scenarios (d = 5m, 15m, 30m)
> Gen 3: Heat Flux → Damage with Monte Carlo distance sampling

---

## Question Templates

### For Methodology Design:

1. **"Why X instead of Y?"**
   - What is X? What is Y?
   - List pros/cons of each
   - What does the science/literature say?
   - What's the pragmatic trade-off?

2. **"What happens if assumption Z breaks?"**
   - Under what conditions does Z fail?
   - How often does that happen?
   - What's the error magnitude?
   - Is there a workaround?

3. **"What are we NOT modeling?"**
   - List excluded scenarios
   - Why excluded? (complexity, data, second-order?)
   - Magnitude of missing effect
   - When does it become important?

### For Technical Choices:

4. **"Is this the right level of complexity?"**
   - Too simple: What are we missing?
   - Too complex: What's not adding value?
   - Where's the sweet spot?

5. **"Can we validate this?"**
   - What data would we need?
   - Does it exist? Can we get it?
   - How would calibration work?
   - What's the uncertainty without validation?

6. **"How does this generalize?"**
   - Across asset types?
   - Across regions?
   - Across time (seasonality, climate change)?
   - What breaks when we extend scope?

### For Practical Constraints:

7. **"What's the implementation complexity vs. value?"**
   - How hard to implement? (days, weeks, months?)
   - What's the impact on results? (±X%)
   - Does it change decisions?
   - Priority: Gen 1, Gen 2, Gen 3, or never?

8. **"What do we do with uncertain inputs?"**
   - How sensitive are results?
   - Can we bound the uncertainty?
   - Conservative or optimistic bias?
   - How do we communicate uncertainty?

---

## Output Structure: Q&A Document

When creating a deep-dive Q&A (like `q&a_2026-02-04.md`), structure as:

```markdown
# [Topic] Q&A

**Questions, Clarifications, and Deep Dives on [Topic]**

*Created: [Date]*

---

## Document Purpose

This document captures questions, clarifications, and deeper explorations of [topic].
It serves as:
- Conceptual clarifications on design decisions
- Deep dives into "why we chose X over Y"
- Edge cases and nuanced interpretations
- Living document - questions and answers added over time

**Related Documents:**
- [List related methodology files]

---

## Table of Contents

1. [Q1: Title of first question]
2. [Q2: Title of second question]
...

---

## Q1: [Question Title]

**Date:** [Date]
**Context:** [Brief context - what prompted this question]
**Related Sections:** [Link to relevant methodology sections]

---

### The Question

[Clear statement of the question or set of related questions]

---

### The Short Answer

[1-2 paragraph summary of the conclusion]

---

### The Detailed Analysis

[Deep dive - can include:]
- Multiple alternatives compared
- Physics/science reasoning
- Trade-off analysis
- Pros/cons tables
- Quantitative comparisons
- Edge cases
- When assumptions break

---

### Comparison Table

[Optional: Structured comparison of alternatives]

---

### Practical Implications

For Gen 1: [What this means for current implementation]
For Gen 2: [How this informs future work]
For Gen 3: [Long-term considerations]

---

### Summary

[Key takeaways, recommendations, decision rationale]

---

[Repeat for Q2, Q3, etc.]
```

---

## Example Usage Scenarios

### Scenario 1: Questioning a Core Design Decision

**User provides:**
- Methodology document
- Specific design choice (e.g., "Why Intensity as damage parameter?")

**AI should:**
1. Identify alternatives (Heat Flux, Flame Length)
2. Compare on multiple dimensions (physics, data, generalizability)
3. Reason through trade-offs
4. Identify embedded assumptions
5. Assess when choice is good vs. problematic
6. Recommend evolution path

### Scenario 2: Assessing Scope/Limitations

**User provides:**
- Current Gen 1 scope
- Question about what's excluded (e.g., "Infrastructure-initiated fires?")

**AI should:**
1. Clarify what's modeled vs. not modeled
2. Assess magnitude of excluded effect
3. Compare across different asset types/use cases
4. Determine if exclusion is acceptable (and for whom)
5. Recommend when to add (Gen 2, Gen 3?)
6. Identify data requirements for future inclusion

### Scenario 3: Evaluating Enhancement Ideas

**User provides:**
- Enhancement proposal (e.g., "Use satellite for vegetation monitoring")
- Current approach for comparison

**AI should:**
1. Assess current limitation clearly
2. Evaluate enhancement feasibility (data, complexity)
3. Quantify potential impact (±X% improvement?)
4. Compare cost/benefit
5. Identify when it matters most (use cases)
6. Recommend priority (Gen 1.5, Gen 2, Gen 3)

### Scenario 4: Uncertainty Analysis

**User provides:**
- Methodology component
- Question about uncertainty/validation

**AI should:**
1. Identify sources of uncertainty
2. Quantify each component (±X%)
3. Determine which dominates
4. Assess compounding effects
5. Evaluate validation options (data availability)
6. Recommend uncertainty mitigation strategies

---

## Principles for Honest Assessment

### 1. **Intellectual Honesty**
- Don't defend the current approach just because it exists
- Admit when something is a pragmatic compromise, not ideal
- Call out actual problems, not just "acceptable limitations"

### 2. **Steel-manning, Not Straw-manning**
- Give alternatives the strongest possible case
- Don't dismiss with weak objections
- Explore when they'd be superior

### 3. **Quantitative Over Qualitative**
- "High uncertainty" → "±40-50%"
- "Small effect" → "5-15% of total loss"
- "Rare" → "~10-20% of scenarios"

### 4. **Context Matters**
- Same issue can be acceptable for one use case, critical for another
- Gen 1 vs. Gen 2 vs. Gen 3 have different bars
- Screening tool vs. pricing tool have different requirements

### 5. **Evolution Mindset**
- Gen 1 doesn't have to be perfect
- But it should be honest about limitations
- And it should set up Gen 2 properly

### 6. **Physics + Pragmatism**
- Start with physics/science (what's theoretically correct?)
- Layer in practical constraints (data, complexity, time)
- Find the balance (what's the right trade-off?)

### 7. **Document Reasoning**
- Capture WHY decisions were made
- Future you (or others) will thank you
- Decisions make sense in context

---

## Red Flags to Watch For

### In Methodology:
- **Circular reasoning** - "We use X because that's what we have" (why not get Y?)
- **Unexamined assumptions** - Critical parameters with no justification
- **Scope creep justification** - "It's too hard" without assessing impact
- **Validation hand-waving** - "We'll validate later" (with what data?)

### In Analysis:
- **False precision** - Reporting 3 decimal places with ±50% uncertainty
- **Cherry-picked comparisons** - Only showing favorable alternatives
- **Complexity bias** - More complex = better (not always!)
- **Simplicity bias** - Simpler = better (not always!)

### In Communication:
- **Hiding uncertainty** - Not communicating confidence bounds
- **Jargon barriers** - Can't explain to non-expert
- **Over-claiming** - "Best approach" without justification
- **Under-claiming** - "Rough estimate" when it's actually defensible

---

## Success Criteria

A good honest assessment should:

✅ **Question fundamentals** - Not just accept "that's how it's done"
✅ **Explore alternatives** - At least 2-3 other approaches considered
✅ **Quantify trade-offs** - Numbers, not just adjectives
✅ **Identify assumptions** - Surface what's implicit
✅ **Assess context-dependently** - Different answers for different use cases
✅ **Be evolution-aware** - Gen 1 → Gen 2 → Gen 3 path
✅ **Document reasoning** - Future readers understand WHY
✅ **Be honest** - Call out problems, not just validate

---

## AI Instructions

When the user invokes this command:

1. **Adopt a critical, questioning mindset**
   - You are a rigorous peer reviewer, not a cheerleader
   - Your job is to find gaps, question assumptions, explore alternatives
   - Be genuinely critical, not just validating

2. **Explore multiple perspectives**
   - Physics/science perspective (what's theoretically correct?)
   - Data/empirical perspective (what can we validate?)
   - Practical/operational perspective (what's implementable?)
   - Business perspective (what matters for decisions?)

3. **Use the assessment framework**
   - Fundamental design decisions
   - Assumptions & validity
   - What's missing (scope gaps)
   - Limitations & uncertainty
   - Alternative approaches
   - Cross-cutting concerns

4. **Structure responses as Q&A**
   - Clear question statement
   - Short answer (conclusion)
   - Detailed analysis (reasoning)
   - Comparison tables (where helpful)
   - Practical implications (Gen 1/2/3)
   - Summary (key takeaways)

5. **Quantify everything possible**
   - Uncertainty: ±X%
   - Impact: X% of total loss
   - Frequency: X% of scenarios
   - Improvement: ±X% change in results

6. **Be context-aware**
   - Gen 1 (screening) vs Gen 2 (refinement) vs Gen 3 (advanced)
   - Point assets vs T&D vs other asset types
   - Catastrophic risk vs operational risk
   - Insurance pricing vs risk management

7. **Identify evolution paths**
   - What's acceptable now (Gen 1)
   - What needs enhancement (Gen 2)
   - What's future work (Gen 3)
   - What requires new data/methods

8. **Document reasoning clearly**
   - WHY decisions were made
   - WHAT trade-offs were accepted
   - WHEN assumptions break down
   - HOW to improve in future

---

## Example Invocations

### Invoke to question a design decision:
```
Using HONEST_ASSESSMENT.md:

I want to critically examine why we use [X approach] in [methodology].
What are the alternatives? What are we missing? Is this the right choice?

[Attach relevant methodology files]
```

### Invoke to assess a limitation:
```
Using HONEST_ASSESSMENT.md:

Gen 1 doesn't model [Y scenario]. Is this acceptable? For which use cases?
When does it become critical? Should we add it in Gen 2?

[Attach scope documentation]
```

### Invoke to evaluate an enhancement:
```
Using HONEST_ASSESSMENT.md:

I'm thinking about adding [Z enhancement].
What's the current limitation it addresses?
What's the complexity vs. impact?
Should this be Gen 1.5, Gen 2, or Gen 3 priority?

[Attach current methodology + enhancement idea]
```

### Invoke for uncertainty analysis:
```
Using HONEST_ASSESSMENT.md:

What are the biggest sources of uncertainty in [methodology component]?
Can we quantify them? Can we validate/calibrate?
How do they compound? What's the total uncertainty?

[Attach methodology section]
```

---

## Related Commands

- `PROMPT_CREATE_TASK_DOCS.md` - For structured task documentation (implementation focus)
- `HONEST_ASSESSMENT.md` - For critical methodology review (this command)
- [Future: `METHODOLOGY_COMPARE.md`] - Side-by-side comparison of approaches
- [Future: `UNCERTAINTY_QUANTIFICATION.md`] - Deep dive on uncertainty budgets

---

**Remember:** The goal is **honest, critical thinking** - not validation, not cheerleading. Question everything. Explore alternatives. Reason through trade-offs. Be genuinely helpful by being genuinely critical.

---

*Created: February 4, 2026*
*Inspired by: `q&a_2026-02-04.md` deep-dive questioning approach*
