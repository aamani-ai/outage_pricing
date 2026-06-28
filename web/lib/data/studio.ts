/** Server-side Studio data reader (regime + observed annual history). Server-only. */
import data from "./studio.json";

export interface CountyStudio {
  regime: string | null;
  sub: string | null;
  stab4: number | null;
  labels_by_T: string | null;
  xT: string | null;
  tstat: number | null;
  /** regime confidence tier ("high" | "low" | "—"); QC signal. */
  conf: string | null;
  /** observed years of history; QC signal (thin if < 5). */
  n_obs: number | null;
  /** total ≥8h qualifying events; QC signal (thin if < 15). */
  total: number | null;
  years: number[];
  /** observed annual qualifying-event counts, keyed by trigger hours. */
  perT: Record<string, number[]>;
  /** per-customer build-up per trigger T: lc = λ_county (events/yr), sh = share-out (avg fraction out). */
  chain: Record<string, { lc: number; sh: number }>;
}

interface StudioFile {
  catalog: string;
  counties: Record<string, CountyStudio>;
}

const STUDIO = data as StudioFile;

export function getStudio(fips: string): CountyStudio | null {
  return STUDIO.counties[fips] ?? null;
}
