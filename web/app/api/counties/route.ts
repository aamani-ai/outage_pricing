import { NextResponse } from "next/server";
import { getCounty } from "@/lib/data/pricing";
import { getStudio } from "@/lib/data/studio";
import { allCustomerBase } from "@/lib/data/customer-base";
import { isConus } from "@/lib/analytics/conus";

/**
 * CONUS county list for the County explorer. Sourced from the customer-base table so that
 * denominator-excluded counties (data-quality flag, A018) are still browsable — joined with
 * regime/confidence (studio) for filtering and the denominator provenance for the flag.
 */
export function GET() {
  const counties = allCustomerBase()
    .filter(([fips]) => isConus(fips))
    .filter(([, cb]) => cb.name)
    .map(([fips, cb]) => {
      const s = getStudio(fips);
      const p = getCounty(fips);
      return {
        fips,
        name: cb.name as string,
        state: cb.state as string,
        regime: s?.regime ?? null,
        conf: s?.conf ?? null,
        denomStatus: cb.status,
        excluded: cb.excluded || p?.quotable === false || s?.regime === "insufficient",
      };
    })
    .sort((a, b) => (a.state === b.state ? a.name.localeCompare(b.name) : a.state.localeCompare(b.state)));
  return NextResponse.json({ counties });
}
