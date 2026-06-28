import { NextResponse } from "next/server";
import { getCountyTrace } from "@/lib/data/county-traces";

const EPOCH_MS = Date.UTC(2014, 0, 1);

/**
 * One outage event's raw 15-minute customers-out trace, read from the lake on demand.
 *
 * The 15-min granularity lives only in the raw EAGLE-I snapshots, sliced per-county-per-year into
 * gs://infrasure-outage-pricing-data/app/county_traces/<FIPS>/<year>.json by build_county_traces.py.
 * We load the year file(s) the event window touches and filter to the window — so this works on the
 * deployed dashboard (reads the private bucket via the bound service account), not just localhost.
 *
 *   GET /api/event-trace?fips=&startMin=&durH=
 *     startMin = event start, whole minutes since 2014-01-01 UTC (the `mins` field of county_events)
 *     durH     = event duration in hours
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const fips = (u.searchParams.get("fips") ?? "").replace(/\D/g, "").padStart(5, "0");
  const startMin = Number(u.searchParams.get("startMin"));
  const durH = Number(u.searchParams.get("durH"));
  if (fips === "00000" || !u.searchParams.get("startMin") || !Number.isFinite(startMin) || !Number.isFinite(durH)) {
    return NextResponse.json({ error: "fips, startMin, durH required" }, { status: 400 });
  }

  const endMin = startMin + Math.round(durH * 60) + 15; // +1 snapshot of buffer
  const startMs = EPOCH_MS + startMin * 60_000;
  const endMs = EPOCH_MS + endMin * 60_000;
  const years = Array.from(
    new Set([new Date(startMs).getUTCFullYear(), new Date(endMs).getUTCFullYear()]),
  );

  const pts: [number, number][] = [];
  for (const y of years) {
    const trace = await getCountyTrace(fips, y);
    if (!trace) continue;
    for (const [mins, out] of trace.rows) {
      if (mins < startMin || mins > endMin) continue;
      pts.push([EPOCH_MS + mins * 60_000, out]);
    }
  }
  pts.sort((a, b) => a[0] - b[0]);

  // downsample pathological long (stuck-snapshot) events so the payload stays small
  const CAP = 2500;
  let points = pts;
  if (pts.length > CAP) {
    const step = Math.ceil(pts.length / CAP);
    points = pts.filter((_, i) => i % step === 0);
  }

  return NextResponse.json({ fips, startMs, endMs, n: pts.length, points });
}
