/**
 * Server-side denominator-provenance reader (A018) — powers the County-explorer flag.
 * Per county: which customer base the per-customer rate used and why
 * (mcc_ok = utility count kept · housing_floor = Census housing units, MCC too low ·
 *  peak_floor = pinned to observed peak · excluded = customers_out itself implausible → not priced).
 */
import data from "./customer_base.json";

export type DenomStatus = "mcc_ok" | "housing_floor" | "peak_floor" | "excluded";

export interface CustomerBase {
  name: string | null;
  state: string | null;
  status: DenomStatus;
  base: number | null;
  mcc: number | null;
  hu: number | null;
  excluded: boolean;
}

const CB = data as unknown as Record<string, CustomerBase>;

export function getCustomerBase(fips: string): CustomerBase | null {
  return CB[fips] ?? null;
}

export function allCustomerBase(): [string, CustomerBase][] {
  return Object.entries(CB);
}
