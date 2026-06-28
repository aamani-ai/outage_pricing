import { NextResponse } from "next/server";
import { getCountyEvents } from "@/lib/data/county-events";

export const dynamic = "force-dynamic"; // reads the per-county object from the private bucket at request time

/** One county's full event series (for the County-explorer event-timeseries view). */
export async function GET(req: Request) {
  const fips = new URL(req.url).searchParams.get("fips");
  if (!fips) return NextResponse.json({ error: "fips required" }, { status: 400 });
  const data = await getCountyEvents(fips);
  if (!data) return NextResponse.json({ error: "no event series for this county" }, { status: 404 });
  return NextResponse.json(data);
}
