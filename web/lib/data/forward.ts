/**
 * Server-side statistical forward-factor reader (Step 05 — the "stat" in FORWARD = stat + climate + grid).
 * Reads the compact artifact promoted by build_data.py from notebooks/05_forward_regime/statistical_router/.
 * The dashboard does MATH ONLY; the factor is calibrated in the notebook and swapped here when new data
 * lands. Keep SERVER-ONLY (the API route). The factor is the county's own-history forecast of next year's
 * frequency, expressed as a multiplier on the baseline mean — one-directional (uplift or hold), credibility-
 * shrunk, capped. It is the forward baseline that climate/grid challengers must beat.
 */
import data from "./forward/forward_factor.json";

export interface ForwardRead {
  /** the county's Step-3 behaviour regime (the routing group). */
  regime: string;
  /** the chosen forecast method for this regime (e.g. capped_lin, wtd_recent, persist, flat). */
  expert: string;
  /** regime confidence tier ("high" | "low"). */
  conf: string;
  /** the stat factor per trigger T (≥1.0 — one-directional: uplift or hold). */
  factorByT: Record<string, number>;
  /** per-T detail for the drop-down: the baseline mean, the forecast, credibility, and the raw (pre-cap) factor. */
  detailByT: Record<string, { lamFull: number; forecast: number; cred: number; raw: number }>;
}

type Raw = Record<
  string,
  {
    regime: string;
    expert: string;
    conf: string;
    T: Record<string, { f: number; lam_full: number; fc: number; cred: number; raw: number }>;
  }
>;
const FWD = data as unknown as Raw;

/** county FIPS (5-digit) → its statistical forward read, or null if the county isn't calibrated. */
export function getForward(fips: string): ForwardRead | null {
  const r = FWD[fips];
  if (!r) return null;
  const factorByT: Record<string, number> = {};
  const detailByT: ForwardRead["detailByT"] = {};
  for (const [t, d] of Object.entries(r.T)) {
    factorByT[t] = d.f;
    detailByT[t] = { lamFull: d.lam_full, forecast: d.fc, cred: d.cred, raw: d.raw };
  }
  return { regime: r.regime, expert: r.expert, conf: r.conf, factorByT, detailByT };
}
