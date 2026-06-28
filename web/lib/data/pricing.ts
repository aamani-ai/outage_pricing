/**
 * Server-side pricing data reader. Imports the compact precomputed catalog
 * (per-county, per-T: λ_customer + year-based band, A017). Keep this import
 * SERVER-ONLY (the API route) — never pull it into a client bundle.
 */
import data from "./pricing.json";

export interface CountyRateT {
  /** per-customer annual rate at this trigger (mean estimator). */
  lam: number;
  /** year-based band on the rate (A017). */
  lo?: number;
  hi?: number;
  /** observed qualifying-event count (drives the band). */
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

interface PricingFile {
  catalog: string;
  estimator: string;
  band: string;
  counties: Record<string, CountyPricing>;
}

const PRICING = data as PricingFile;

export const PRICING_META = { catalog: PRICING.catalog, estimator: PRICING.estimator, band: PRICING.band };

/** Look up a county's pricing by 5-digit FIPS. */
export function getCounty(fips: string): CountyPricing | null {
  return PRICING.counties[fips] ?? null;
}

/** All [fips, county] entries — for the national batch (Analytics Studio). Server-only. */
export function allCountyEntries(): [string, CountyPricing][] {
  return Object.entries(PRICING.counties);
}
