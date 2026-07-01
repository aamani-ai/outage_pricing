import type { composePremium } from "@/lib/pricing";
import type { LayerStatus } from "@/lib/pricing/types";
import type { WeatherRead } from "@/lib/data/weather";

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
  chain: Record<string, { lc: number; sh: number }>; // per T: baseline build-up — λ_county (lc) × share-out (sh) = λ_customer
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
/** Location basis (Step 04): the address's within-county density read + on-demand guardrail. Applied
 *  (composes into the premium); pilot-calibrated on CT/MA/RI, nationally extrapolated. */
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
  relativityByT: Record<string, number>; // capped within-county relativity per trigger T (post-guardrail), applied
}

/** Statistical forward factor (Step 05): the "stat" in FORWARD = stat + climate + grid — the county's
 *  own-history forecast of next-year frequency vs its long-run mean. One-directional (uplift or hold),
 *  credibility-shrunk, capped. The forward baseline that climate/grid challengers must beat. */
export interface ForwardRead {
  regime: string; // the Step-3 behaviour regime (routing group)
  expert: string; // chosen forecast method for that regime
  conf: string; // regime confidence tier
  factorByT: Record<string, number>; // the stat factor per trigger T (≥1.0)
  detailByT: Record<string, { lamFull: number; forecast: number; cred: number; raw: number }>;
}

export type { WeatherRead } from "@/lib/data/weather";

export type StudioData = {
  fips: string;
  county: CountyPricing;
  studio: CountyStudio | null;
  location: LocationRead | null;
  forward: ForwardRead | null;
  /** Step-05 weather challenger + routing verdict for NE counties (governs the price where it wins the
   *  backtest — the 16 durable winners); null elsewhere. */
  weather: WeatherRead | null;
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

/** One intended forward sub-component (Step 5). */
export interface ForwardComponent {
  key: string;
  name: string;
  factor: number;
  status: LayerStatus;
  active: boolean;
  blurb: string;
}

/**
 * The forward sub-components — defined ONCE so the Forecast tab and the Price Breakdown's expandable
 * forward row never drift (communicate_to_share). The forward factor is a ROUTED choice between two
 * frequency experts (statistical own-history vs the weather challenger) times Grid (a future overlay):
 * the router picks whichever won the backtest, so the CHOSEN expert carries the applied factor and the
 * other stands down to ×1.00 here — the product equals the composed forward factor exactly. No shadow;
 * the chosen expert is the one that prices.
 */
export function forwardComponents(opts: {
  routedFactor: number; // the applied forward factor (= stack.forward.factor, incl. any manual load)
  source: "weather" | "statistical"; // which expert the router chose
  statFactor: number; // the statistical expert's model factor (for the challenger read-out)
  weatherFactor: number | null; // the weather expert's model factor; null = county outside weather coverage
  statStatus: LayerStatus;
}): ForwardComponent[] {
  const { routedFactor, source, statFactor, weatherFactor, statStatus } = opts;
  const wxCovered = weatherFactor != null;
  return [
    {
      key: "statistical",
      name: "Statistical",
      factor: source === "statistical" ? routedFactor : 1,
      status: source === "statistical" ? statStatus : "placeholder",
      active: source === "statistical",
      blurb:
        source === "statistical"
          ? "county's own outage-history trend vs its long-run mean — governs here"
          : `stands down — weather won the backtest (own-history would be ×${statFactor.toFixed(2)})`,
    },
    {
      key: "climate",
      name: "Climate / Weather",
      factor: source === "weather" ? routedFactor : 1,
      status: source === "weather" ? statStatus : "placeholder",
      active: source === "weather",
      blurb:
        source === "weather"
          ? "weather forecast — governs here (beat the statistical baseline out-of-sample)"
          : wxCovered
            ? `challenger — statistical won (weather would be ×${weatherFactor!.toFixed(2)})`
            : "forward hazard — storm, heat & seasonal-climate exposure (not yet covered)",
    },
    { key: "grid", name: "Grid", factor: 1, status: "placeholder", active: false, blurb: "utility / resource reliability — asset age, restoration, capacity (planned)" },
  ];
}

/** Which forward expert the router chose for (county, T) + both experts' model factors — the single
 *  source of truth shared by the Forecast tab and Price Breakdown so their read-outs never drift. */
export function forwardRouting(data: StudioData, T: number): {
  source: "weather" | "statistical";
  statFactor: number;
  weatherFactor: number | null;
} {
  const statFactor = data.forward?.factorByT?.[String(T)] ?? 1;
  const weatherFactor = data.weather?.byT?.[String(T)]?.weatherFactor ?? null;
  const isWeatherRouted = data.weather?.route === "weather";
  const source: "weather" | "statistical" =
    isWeatherRouted && weatherFactor != null && Number.isFinite(weatherFactor) && weatherFactor > 0
      ? "weather"
      : "statistical";
  return { source, statFactor, weatherFactor };
}
