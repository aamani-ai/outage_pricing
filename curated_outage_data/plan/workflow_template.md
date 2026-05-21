# Workflow Template

Use this template for every curated-data source or phase.

## 1. Research

Questions:

- What is the source?
- Who publishes it?
- What is the official documentation?
- What is the license / access model?
- What years and geographies are covered?
- What is the source grain?
- What are known caveats?

Output:

```text
sources/<source_name>.md
```

## 2. Reason

Questions:

- What role should this source play?
- Is it base data, enrichment, validation, forward-looking feature, or trigger
  evidence?
- What can it answer reliably?
- What should it not be used for?

Output:

```text
plan/<phase>_reasoning.md or section in phase plan
```

## 3. Decide

Questions:

- Are we using this source now, later, or not at all?
- What is the first pilot scope?
- What join rule is acceptable for a prototype?
- What fields are canonical?

Output:

```text
plan/decisions/<decision_name>.md
```

## 4. Plan

Questions:

- What artifact will be produced?
- What schema will it follow?
- What validation will prove it worked?
- What outputs stay local and gitignored?

Output:

```text
schemas/<artifact>.md
validation/<artifact>_qa_plan.md
```

## 5. Execute

Rules:

- Keep raw downloads local.
- Keep generated artifacts reproducible.
- Start with narrow pilot scope.
- Save logs and QA summaries.
- Do not modify pricing until validation supports it.

Output:

```text
pipelines/
outputs/
validation/
```

## 6. Feedback

Questions:

- What failed?
- What was missing?
- What was noisy?
- Did the output answer the original question?
- What should the next phase inherit or avoid?

Output:

```text
learning/<phase>_feedback.md
```

## 7. Learning

Final step:

- turn project-specific lessons into reusable analysis checks;
- update source caveats;
- update schemas if field meaning changed;
- update phase plan if the next step changed.
