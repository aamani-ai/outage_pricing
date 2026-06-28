# Principles

Durable principles this project holds itself to. Each file is **one principle** — why it
exists, the rule stated crisply, and **how to test whether we followed it**. These are the
standard we audit our own work against, not aspirations on a wall.

- [**Built to Be Communicated**](communicate_to_share.md) — clarity is *designed into* the
  model, not bolted on as slides. The deliverable is a shared understanding that a writer, a
  carrier, and a teammate each reach with the least possible confusion — not the number alone.
- [**County-Specificity**](county_specificity.md) — don't assume one logic fits all counties
  (it's inaccurate), and don't atomise to one rule per county (it over-fits). The craft is the
  *right grouping* — cluster by behaviour, apply per-group, abstain on thin data.
- [**Model to the Consequence**](model_to_the_consequence.md) — the loss/metric must encode the real
  (usually asymmetric) business consequences of being wrong, not a default symmetric error. Ask what
  the number is *used for* before choosing how to score it — that's how we caught the asymmetric-loss point.
- [**Reproducible from the Lake**](reproducible_from_lake.md) — every number rebuilds from one canonical
  source (the GCS data lake) on any machine, identical results, *verified* not assumed. Data lives in the
  lake (not the laptop, not the repo); one env switch flips local↔GCS; regenerate to staging + diff before
  overwriting the source of truth.
- [**Structural Verification**](structural_verification.md) — correctness is enforced *structurally* (tests,
  assertions, loud failures, clean boundaries), not by trusting the code or eyeballing 3,090 counties. A
  defect must fail a test, crash loudly, or violate a count — never silently ship a wrong number. Fail loud
  on core inputs; test the contract before the feature; assert counts at load. (Restores the old `scaling.md`.)

Add a file when we learn a principle worth holding ourselves to. Keep them short, concrete,
and grounded in a real example from our own work.
