# Built to Be Communicated

*Clarity is designed into the model, not bolted on as slides. The deliverable is a **shared
understanding** that a writer, a carrier, and a teammate each reach with the least possible
confusion — not the number alone.*

---

## Why this document exists

Chris said it plainly in the 2026-06-19 catchup: *"I'm still focused on making sure that our
numbers are good and believable… I don't care about slides in the next three days."* The thing
that goes in front of channel partners and risk capacity is **not the slide deck and not the
raw number — it is whether the right person can understand and trust what the number means.**

A model that only its author can explain is not finished. Complexity the reader can't follow
is a **defect**, not sophistication. This principle is how we keep the work shareable *by
construction* — so we don't discover at the risk-capacity table that nobody outside the build
can defend it.

> **The principle.** Build every number so the party who must act on it — writer, carrier,
> teammate — can state *what it means* and *what to do* without the math. If they can't, the
> work isn't done, however correct the math is.

---

## The operating rules (what we actually learned doing this)

```text
 1. GROUND in the real question, in the stakeholder's WORDS.
      Read the meeting note. Answer what they asked, not your paraphrase of it.
      (Chris asked "are we conservative ONLY on long durations?" — a specific,
       absolute, by-duration worry. Our first framing answered a different,
       relative question. Grounding caught it.)

 2. FRAME each step  Stage → Question → Solution.
      what step we're on · the honest question a carrier would raise · what we
      built to answer it. The scaffold above the 5-step pipeline.

 3. LABELS say what to DO, in the audience's words — and are defined ONCE.
      "how hard can I lean on this number?" beats "evidence_reliability score".
      "are we conservative, and where does it break down?" beats a percentile.
      Define it in one canonical place; every other doc points there.

 4. SPLIT orthogonal questions into separate tags — never one blended score.
      TRUST (believe it?) ≠ POSTURE (which way biased?). LEVEL (how conservative?)
      ≠ TILT (vs peers?). BUT: don't multiply tags past what changes a decision
      FOR THAT AUDIENCE — demote the rest to detail.

 5. EVERY tag / flag / chart must change a decision or carry a real finding.
      If not, cut it. We dropped 3 dead proxies (min, observed_fraction, borderline)
      and replaced a posture-by-T chart that was ~40/40/20 BY CONSTRUCTION (a
      tautology, not a finding) with one that actually moves.

 6. ANSWER the right question, not the convenient one.
      The within-T percentile was clean and easy — and answered the wrong question.
      The absolute, by-duration cushion was harder and answered Chris's.

 7. Be HONEST about direction-of-bias and the ceiling.
      Name which way it's wrong (conservative cushion; exposure dilution A012) and
      what it cannot prove (no per-customer durations → A011). Honest beats tidy.

 8. SCANNABLE-FIRST. Visuals carry the meaning; prose supports. A reader should
      grasp it from the diagram/table before reading a sentence.
```

---

## The test — run this before anything ships

A read, label, or chart is **not done** until it passes all six:

```text
 ┌─ does it answer the question the stakeholder ACTUALLY asked, in their words?
 │
 ├─ can the target reader state what it MEANS and what to DO — without the math?
 │
 ├─ does each tag / flag / panel CHANGE A DECISION (for that audience) or carry a
 │    finding?  if not → cut it or demote it to detail
 │
 ├─ is it defined ONCE and identical everywhere (no competing framings)?
 │
 ├─ is the direction-of-bias and the ceiling stated HONESTLY?
 │
 └─ has someone OUTSIDE the build read it back correctly?   ← the one we skip
```

---

## Caveats — the failure modes of "simple"

- **Clarity ≠ dumbing down.** The goal is least *confusion*, not least *content*. A dropped
  load-bearing caveat (e.g. A011's "this rests on a synchronous-outage approximation") is a
  failure of communication, not a simplification.
- **Honest beats simple.** Never tidy away the bias direction to look clean. "We over-state,
  here's where" is more shareable than a confident single number.
- **Two real questions need two tags.** Collapsing TRUST and POSTURE into one score *looks*
  simpler but hides the distinction the underwriter needs. Simplicity is "no tag that doesn't
  earn a decision," not "fewest tags."
- **Naming is part of the product.** A label that reads awkwardly ("Strong · strong cushion")
  taxes the reader; the words are not cosmetic.
