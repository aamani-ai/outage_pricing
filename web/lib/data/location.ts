/**
 * Server-side location-basis reader (Step 04: within-county density relativity + the
 * commercial-core guardrail). Imports the compact artifact promoted by build_data.py from
 * notebooks/outputs/location_basis/. Keep these imports SERVER-ONLY (the API route) —
 * tract_rurality.json is ~2.4MB and must never reach a client bundle. Math only; the numbers
 * are calibrated in the notebook and swapped here when new data lands. Applied (composes into the
 * premium); pilot-calibrated on CT/MA/RI (validated:false until validated beyond the pilot).
 */
import relTable from "./location/relativity_table.json";
import tractData from "./location/tract_rurality.json";
import countyData from "./location/county_lookup.json";
import guardrailSpec from "./location/guardrail_spec.json";

export const TERCILES = ["rural", "mid", "urban"] as const;
export type Tercile = (typeof TERCILES)[number];

/** A tract's within-county density read. */
export interface TractRurality {
  /** people per km² (tract ACS pop / land area). */
  density: number;
  /** within-county density percentile (0–1); 0 = sparsest, 1 = densest. */
  pct: number;
  /** within-county density tercile. */
  tercile: Tercile;
}

/** A county's within-county density spread + validation flag. */
export interface CountyDispersion {
  /** std(log10 tract density) — how much location matters inside this county. */
  disp: number;
  /** number of sub-units (tracts); 1 → relativity forced neutral. */
  nSub: number;
  /** PoUS-outcome-validated? false everywhere today (only CT/MA/RI pilot, town-grain). */
  validated: boolean;
}

interface RelativityTable {
  cap: [number, number];
  terciles: string[];
  relativity: Record<string, { empirical: number[]; v0_shadow: number[] }>;
}

const REL = relTable as unknown as RelativityTable;
// tract GEOID (11-digit) → [density, within-county percentile, tercile index 0|1|2]
const TRACT = tractData as unknown as Record<string, [number, number, number]>;
const COUNTY = countyData as unknown as Record<string, { disp: number; n_sub: number; validated: boolean }>;

/** the symmetric, conservative commercial-core guardrail spec (thresholds are v0, physics+face-validity). */
export const GUARDRAIL = guardrailSpec as unknown as {
  imp_high_pct: number; // Type A: rural-by-density + impervious ≥ this → reclassify URBAN (de-uplift)
  imp_low_pct: number; //  Type B: urban-by-density + impervious ≤ this → reclassify MID (conservative penalty)
  type_A: string;
  type_B: string;
  thresholds_basis: string;
};

const tercileFromIdx = (i: number): Tercile => TERCILES[i] ?? "mid";

/** the v0 attribution-confidence cap the relativity is throttled to (a policy choice, not the signal). */
export const LOCATION_CAP = REL.cap;

/** clamp a trigger to the last calibrated threshold: relativity is measured at T=1/2/4/8h only, so
 *  T≥8 reuses the T8 relativity (the gradient is stable by 8h; conservative + explainable). */
function relKey(T: number): string {
  return `T${Math.min(T, 8)}`;
}

/** tract GEOID (11-digit) → its within-county density read, or null if not in the surface. */
export function getTract(geoid: string): TractRurality | null {
  const r = TRACT[geoid];
  return r ? { density: r[0], pct: r[1], tercile: tercileFromIdx(r[2]) } : null;
}

/** county FIPS (5-digit) → within-county dispersion + validated flag, or null. */
export function getCounty(fips: string): CountyDispersion | null {
  const c = COUNTY[fips];
  return c ? { disp: c.disp, nSub: c.n_sub, validated: c.validated } : null;
}

/** capped (v0_shadow) relativity for a trigger T and tercile — the number that composes into the price. */
export function getRelativity(T: number, tercile: Tercile): number {
  const row = REL.relativity[relKey(T)] ?? REL.relativity.T8;
  if (!row) throw new Error(`location: no relativity row for T${T} (artifact missing T8)`);
  return row.v0_shadow[TERCILES.indexOf(tercile)] ?? 1;
}

/** both empirical (uncapped) + capped relativity rows for a trigger T — for the evidence charts only. */
export function getRelativityRow(T: number): { empirical: number[]; v0_shadow: number[] } {
  const row = REL.relativity[relKey(T)] ?? REL.relativity.T8;
  if (!row) throw new Error(`location: no relativity row for T${T} (artifact missing T8)`);
  return row;
}

/** the full per-T relativity table (empirical + capped) — for the empirical-vs-capped evidence view. */
export function getRelativityTable(): RelativityTable["relativity"] {
  return REL.relativity;
}
