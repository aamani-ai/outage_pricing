import { NextResponse } from "next/server";
import { getCounty } from "@/lib/data/pricing";
import { getStudio } from "@/lib/data/studio";
import { getForward } from "@/lib/data/forward";
import { getCustomerBase } from "@/lib/data/customer-base";

/** One county's regime read + annual qualifying-event history + next-year forecast + denominator
 *  provenance (County explorer). Resolves even for denominator-excluded counties (not in pricing). */
export function GET(req: Request) {
  const fips = new URL(req.url).searchParams.get("fips");
  if (!fips) return NextResponse.json({ error: "fips required" }, { status: 400 });
  const c = getCounty(fips);
  const cb = getCustomerBase(fips);
  if (!c && !cb) return NextResponse.json({ error: "unknown county" }, { status: 404 });
  const s = getStudio(fips);
  const fwd = getForward(fips);

  // next-year forecasted annual event count per trigger (same units as perT history)
  const forecastByT: Record<string, number> = {};
  if (fwd) for (const [t, d] of Object.entries(fwd.detailByT)) forecastByT[t] = Math.round(d.forecast);
  const years = s?.years ?? [];
  const nextYear = years.length ? years[years.length - 1]! + 1 : null;

  return NextResponse.json({
    fips,
    name: c?.name ?? cb?.name ?? null,
    state: c?.state ?? cb?.state ?? null,
    tier: c?.tier ?? null,
    quotable: c?.quotable ?? null,
    regime: s?.regime ?? null,
    sub: s?.sub ?? null,
    conf: s?.conf ?? null,
    nObs: s?.n_obs ?? null,
    total: s?.total ?? null,
    labelsByT: s?.labels_by_T ?? null,
    years,
    perT: s?.perT ?? {},
    // per-customer build-up per trigger T: lc = λ_county (events/yr) · sh = share-out (avg fraction of
    // customers out per event). λ_customer = lc × sh; avg customers out per event = sh × base.
    chainByT: s?.chain ?? {},
    forecastByT,
    nextYear,
    customerBase: cb
      ? { status: cb.status, base: cb.base, mcc: cb.mcc, hu: cb.hu, excluded: cb.excluded }
      : null,
  });
}
