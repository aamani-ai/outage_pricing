import type { composePremium } from "@/lib/pricing";

export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
export const pct = (n: number) => `${Math.round(n * 100)}%`;

export interface CountyRateT {
  lam: number;
  lo?: number;
  hi?: number;
  n: number | null;
  gate: string | null;
}
export interface CountyPricing {
  name: string;
  state: string;
  tier: string | null;
  quotable: boolean | null;
  T: Record<string, CountyRateT>;
}
/** The per-customer cell read (TRUST + POSTURE) for one (county, T) — see cell_read_fundamentals.md. */
export interface CellRead {
  trust: string; // "Strong" | "Medium" | "Thin" — weakest-link of the three checks
  tnum: number; // numeric TRUST 0–1
  C: [number, number, number]; // [coverage C_source, sample C_sample, stability C_evt]
  level: string; // cushion LEVEL: "well-cushioned" | "some cushion" | "runs close"
  p2m: number; // median peak/mean per event (drives LEVEL)
  tilt: string; // cushion TILT vs peers: "spikier" | "typical" | "flatter"
  pctile: number; // within-T percentile of p2m (0–1)
  n_obs: number; // observed years
  mm: number | null; // mean/median ratio (heavy-tail gap); null when median ≈ 0
  route: string; // "Quote" | "Caveat" | "Verify" | "Suppress"
  pct?: [number, number, number, number]; // pct_mcc p10/p50/p90/p99
  reason?: string;
}

export interface CountyStudio {
  regime: string | null;
  sub: string | null;
  stab4: number | null;
  labels_by_T: string | null;
  xT: string | null;
  tstat: number | null;
  conf: string | null; // regime confidence tier: "high" | "low"
  n_obs: number | null; // observed years
  total: number | null; // total ≥8h events
  cv: number | null; // residual volatility (coefficient of variation)
  peak_share: number | null; // share of total in the single biggest year
  r_step: number | null; // step-fit quality (0–1)
  years: number[];
  perT: Record<string, number[]>;
  mult: Record<string, [number, number, number]>; // per T: [median, mean, max] per-customer λ
  od: Record<string, number>; // per T: overdispersion (Var/Mean) of annual counts
  cell: Record<string, CellRead>; // per T: the TRUST + POSTURE cell read
}

/**
 * Corrected regime category. "insufficient" overloads three subs; recent-change counties are
 * data-rich (median ~183 events), NOT sparse — split them out so the label communicates honestly.
 */
export function regimeKey(regime: string | null, sub: string | null): string {
  if (regime === "insufficient") return sub === "recent-change" ? "recent-change" : "insufficient";
  return regime ?? "";
}

export const REGIME_DISPLAY: Record<string, string> = {
  stable: "Stable",
  trend: "Trend",
  shift: "Shift",
  episodic: "Episodic",
  "recent-change": "Recent change",
  insufficient: "Insufficient data",
};

export function regimeLabel(regime: string | null, sub: string | null): string {
  const k = regimeKey(regime, sub);
  return REGIME_DISPLAY[k] ?? (regime ?? "—");
}
/** Location basis (Step 04): the address's within-county density read + on-demand guardrail. Shadow. */
export interface LocationRead {
  tract: string; // 11-digit tract GEOID
  tercile: "rural" | "mid" | "urban"; // post-guardrail tercile (drives the relativity)
  baseTercile: "rural" | "mid" | "urban"; // density-only tercile, before the guardrail
  pct: number; // within-county density percentile (0–1); 0 = sparsest, 1 = densest
  density: number; // people / km²
  dispersion: number | null; // std(log10 tract density) in this county — how much location matters here
  nSub: number | null; // tracts in the county
  validated: boolean; // PoUS-outcome-validated? false everywhere today (CT/MA/RI pilot is town-grain)
  guardrail: { triggered: boolean; type?: "A" | "B"; impervious?: number };
  relativityByT: Record<string, number>; // v0_shadow capped relativity per trigger T (post-guardrail)
}

export type StudioData = {
  fips: string;
  county: CountyPricing;
  studio: CountyStudio | null;
  location: LocationRead | null;
};

export type { StudioTab } from "@/lib/quote-store";

/** the composePremium result (non-null) — what the tabs render from. */
export type Stack = ReturnType<typeof composePremium>;

export function parseLabels(s: string | null | undefined): Record<string, string> {
  const m: Record<string, string> = {};
  for (const part of (s ?? "").split("|")) {
    const [t, l] = part.split(":");
    if (t && l) m[t] = l;
  }
  return m;
}
