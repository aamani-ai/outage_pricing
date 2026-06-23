/** Server-side Studio data reader (regime + observed annual history). Server-only. */
import data from "./studio.json";

export interface CountyStudio {
  regime: string | null;
  sub: string | null;
  stab4: number | null;
  labels_by_T: string | null;
  xT: string | null;
  tstat: number | null;
  years: number[];
  /** observed annual qualifying-event counts, keyed by trigger hours. */
  perT: Record<string, number[]>;
}

interface StudioFile {
  catalog: string;
  counties: Record<string, CountyStudio>;
}

const STUDIO = data as StudioFile;

export function getStudio(fips: string): CountyStudio | null {
  return STUDIO.counties[fips] ?? null;
}
