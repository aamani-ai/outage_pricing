import { NextResponse } from "next/server";
import { getCounty } from "@/lib/data/pricing";
import { getStudio } from "@/lib/data/studio";

export const dynamic = "force-dynamic";

/**
 * Full county picture for the Underwriting Studio.
 *   GET /api/studio?lat=&lon=  →  { fips, county (pricing), studio (regime + annual history) }
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
    /* fall through */
  }
  if (!fips) {
    return NextResponse.json({ error: "Couldn’t resolve a U.S. county for this location." }, { status: 502 });
  }

  const county = getCounty(fips);
  if (!county) {
    return NextResponse.json({ fips, error: "No priced outage history for this county yet." }, { status: 404 });
  }
  return NextResponse.json({ fips, county, studio: getStudio(fips) });
}
