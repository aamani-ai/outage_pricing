/**
 * InfraSure house-default Rules-Engine bounds — the guardrails a capacity provider would set,
 * standing in until a real carrier rules table is uploaded (see
 * docs/dicsscssion/rules_engine_governance/00). Bounds are the carrier's; the underwriter picks the
 * working VALUE within them in Studio → Adjustments. One source of truth so the Rules Engine and the
 * Adjustments context never drift (communicate_to_share: define once).
 *
 * NOT enforced in code this pass (no hard clamp) — shown as context only, per plan 03 scope.
 */
export const HOUSE_RULES = {
  /** expense-allowance ceiling — the chosen ER must sit at or below this. */
  expenseCap: 0.25,
  /** target-margin floor — the chosen TM must sit at or above this. */
  marginFloor: 0.15,
  /** minimum insurable trigger duration (hours). */
  triggerMinHours: 6,
  /** trigger durations offered to the market (hours). */
  triggersOffered: [8, 12, 24] as number[],
} as const;
