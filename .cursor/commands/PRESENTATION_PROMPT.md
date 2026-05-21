# PRESENTATION_PROMPT

Generate a Notebook LM presentation prompt (max 110 lines) for technical documentation.

## How to Use

Provide:
1. **Source document** (path or file to be uploaded to Notebook LM)
2. **Audience** (one-liner: who + context, e.g., "technical team learning our methodology" or "investors evaluating the approach")

That's it. The command will generate an optimized prompt.

---

## Command Logic

Analyze source document structure → Identify key concepts → Map to audience needs → Generate 110-line prompt following proven patterns:

**Pattern recognition:**
- Technical docs → Show physics chain, decision logic, validation
- Methodology docs → Problem → Solution → Trade-offs → Status
- Framework docs → Conceptual foundation → Assumptions → Roadmap
- Business docs → Crisis → Solution → Value → Proof

**Slide count (ADAPTIVE):** First analyze content depth, then decide:
- Simple concept/single methodology → 8-10 slides (tight, focused)
- Standard framework/methodology → 12-14 slides (balanced)
- Complex system/multiple concepts → 15-18 slides (comprehensive)
- **Rule:** More slides ≠ better. Match density to content complexity.
- **Goal:** Each slide adds value; no filler slides for structure's sake

**Structure template:**
```
**Slide 1: Title** - Captures essence + key specs
**Slides 2-4: Problem/Context** - Why this matters, what's broken, the gap
**Slides 5-9: Solution/Methodology** - Core concepts, how it works, key decisions
**Slides 10-12: Status/Results** - Where we are, what works, validation
**Slides 13-14: Trade-offs/Future** - Limitations, Gen 1→Gen 2→Gen 3
**Slides 15-16: Summary/Next Steps** - Key takeaways, contact/action
```

**Smart defaults by doc type:**
- Framework/Foundation docs: Heavy on "Why this approach?" and decision logic
- Methodology docs: Heavy on "How does it work?" with validation
- Component docs: Heavy on technical details with implementation status
- Business docs: Heavy on value, ROI, case studies

**Tone mapping:**
```
Technical audience     → "Technical but clear. Show reasoning. Use proper terms."
Business audience      → "Professional, confident. Minimize jargon. Show value."
Mixed/First-time       → "Clear, accessible. Explain terms. Build from basics."
Executive/Investor     → "Strategic, value-driven. Show urgency and opportunity."
```

**Key constraints:**
- **MAX 110 LINES (CRITICAL):** Count lines in output. If over, compress aggressively.
  - Combine bullets, use tables, shorten descriptions
  - Remove redundant slides, merge related concepts
  - Cut "nice-to-have" slides, keep "must-have" only
- Max 6 bullets per slide, each ≤15 words
- Use tables for comparisons (compact, scannable, saves lines)
- Avoid: "AI-powered", "revolutionary", "seamless", "unlock" (unless business pitch)
- Use: "defensible", "auditable", "validated", "forward-looking" (technical credibility)

**Smart inclusions based on doc patterns:**
- If "Gen 1/Gen 2/Gen 3" mentioned → Include roadmap slide
- If equations/formulas → "The Physics" or "Core Concepts" slide
- If comparisons to industry → Comparison table slide
- If assumptions listed → "What We Assume" or "Known Limitations" slide
- If validation mentioned → "Validation Strategy" slide
- If case studies/examples → Dedicated example slides

**Design directives:**
- Always end with: "**Design:** Clean, minimal text, [theme colors], diagrams from source doc"
- Specify visual elements: tables, flow diagrams, comparison charts
- Mention slide numbers and consistency

---

## Output Format

**CRITICAL:** Before outputting, analyze the source document to determine optimal slide count based on:
- Content density (how many distinct concepts?)
- Conceptual depth (surface overview vs deep methodology?)
- Audience needs (first-time learners need more scaffolding vs experts)
- Natural breakpoints (does content suggest 10 slides or 16?)

Then generate prompt following this structure:

```
Create a [TYPE] slide deck [PURPOSE].

**Audience:** [AUDIENCE DESCRIPTION]
**Tone:** [TONE GUIDANCE]

**Slide Structure:**

**Slide 1: Title**
- [Specific slide content]

**Slide 2-N:** [Progressive structure - N determined by content analysis]
...

**Design:** [Design guidelines]

**Key Messages:** [3-5 core takeaways]
```

**FINAL STEP:** Count output lines. If >110, compress immediately before returning.

---

## Example Usage

**Input:**
```
Source: docs/extra/wildfire_risk_modeling_guide/00_infrasure_wildfire_framework.md
Audience: Internal team learning our wildfire methodology for first time
```

**Output:** [110-line prompt following patterns, emphasizing framework concepts, decision logic, and Gen 1 status]

---

## Notes

- Notebook LM works best with structured, scannable prompts
- Tables > paragraphs for comparisons (saves lines, increases clarity)
- Specific slide titles > generic "Overview"
- "What/Why/How" structure > feature lists
- Numbers and specs in title slide create immediate credibility
- **Compression tactics if over 110 lines:**
  - Merge related slides (e.g., "Assumptions" + "Limitations" → one slide)
  - Use tables instead of bullets (3-4 rows = 1 line vs 3-4 bullets = 3-4 lines)
  - Shorten bullet text (15 words → 8-10 words)
  - Combine intro/context slides
  - Remove "nice-to-have" examples, keep core concepts only
