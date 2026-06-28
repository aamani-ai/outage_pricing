/**
 * Analytics Studio data contract — the national batch (one row per county) for a chosen
 * (trigger T, payout X, ER, TM). Computed server-side in /api/analytics (the heavy JSONs are
 * server-only); the client renders map + distribution + QC from these compact rows.
 */

export interface AnalyticsRow {
  fips: string;
  name: string;
  state: string;
  /** composed retail annual premium at (T, X, ER, TM); null if no price at this trigger. */
  premium: number | null;
  /** baseline per-customer rate at this T. */
  lam: number | null;
  /** observed qualifying-event count at this T (sample size). */
  n: number | null;
  /** per-T sample-adequacy gate ("available" | "caution"). */
  gate: string | null;
  /** modelability tier ("green" | "amber" | "red" | null). */
  tier: string | null;
  quotable: boolean | null;
  /** behaviour regime ("stable"|"trend"|"shift"|"episodic"|"insufficient"|null). */
  regime: string | null;
  sub: string | null;
  /** regime confidence ("high"|"low"|"—"|null). */
  conf: string | null;
  /** observed years of history. */
  nObs: number | null;
  /** total ≥8h qualifying events. */
  total: number | null;
  /** statistical forward factor at this T (≥1.0), or null if no price. */
  forward: number | null;
  /** offered to the market? false → shown as excluded, never as a $0 premium. */
  excluded: boolean;
  /** why excluded (priority-ordered), or null when offered. */
  exclReason: string | null;
  /** how the customer-base denominator was chosen (A018): mcc_ok = raw utility count · housing_floor /
   *  peak_floor = repaired · excluded = data invalid · null = no base record. */
  denomStatus: "mcc_ok" | "housing_floor" | "peak_floor" | "excluded" | null;
}

export interface AnalyticsSummary {
  totalCount: number;
  pricedCount: number;
  excludedCount: number;
  min: number;
  p10: number;
  median: number;
  p90: number;
  max: number;
  mean: number;
}

export interface AnalyticsResponse {
  meta: { T: number; X: number; ER: number; TM: number };
  rows: AnalyticsRow[];
  summary: AnalyticsSummary | null;
}
