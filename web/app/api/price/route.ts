import { NextResponse } from "next/server";
import { getCounty } from "@/lib/data/pricing";

export const dynamic = "force-dynamic";

/**
 * Resolve a point to its county pricing.
 *   GET /api/price?lat=&lon=  →  { fips, county } | { error }
 * Coords → county FIPS via the free FCC block API (server-side: no key, no CORS),
 * then a lookup in the precomputed catalog. The client composes the premium.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  }

  let fips: string | null = null;
  try {
    const r = await fetch(
      `https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lon}&format=json`,
      { cache: "no-store" },
    );
    if (r.ok) {
      const j = (await r.json()) as { County?: { FIPS?: string } };
      if (typeof j.County?.FIPS === "string") fips = j.County.FIPS;
    }
  } catch {
    /* fall through to the 502 below */
  }
  if (!fips) {
    return NextResponse.json({ error: "Couldn’t resolve a U.S. county for this location." }, { status: 502 });
  }

  const county = getCounty(fips);
  if (!county) {
    return NextResponse.json({ fips, error: "No priced outage history for this county yet." }, { status: 404 });
  }
  return NextResponse.json({ fips, county });
}
