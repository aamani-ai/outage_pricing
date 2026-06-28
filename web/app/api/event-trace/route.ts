import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import path from "node:path";

const pexec = promisify(execFile);
const EPOCH_MS = Date.UTC(2014, 0, 1);

/**
 * One outage event's raw 15-minute customers-out trace, extracted ON DEMAND from the local raw EAGLE-I CSVs
 * (price_engine/data/raw/eaglei_outages_<year>.csv) via grep on the zero-padded FIPS (~0.5s/file).
 *
 * LOCALHOST ONLY — the raw files are not on the deployed server. For deploy this would switch to a bucket
 * range-read or a pre-built per-event slice. fips is sanitized to digits and passed as an execFile arg (no shell).
 *
 *   GET /api/event-trace?fips=&startMin=&durH=
 *     startMin = event start, whole minutes since 2014-01-01 UTC (the `mins` field of county_events)
 *     durH     = event duration in hours
 */
function rawDir(): string {
  const cands = [
    path.resolve(process.cwd(), "..", "price_engine", "data", "raw"),
    path.resolve(process.cwd(), "price_engine", "data", "raw"),
  ];
  return cands.find(existsSync) ?? cands[0]!;
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const fips = (u.searchParams.get("fips") ?? "").replace(/\D/g, ""); // digits only — safe for execFile arg
  const startMin = Number(u.searchParams.get("startMin"));
  const durH = Number(u.searchParams.get("durH"));
  if (!fips || !Number.isFinite(startMin) || !Number.isFinite(durH)) {
    return NextResponse.json({ error: "fips, startMin, durH required" }, { status: 400 });
  }

  const fips5 = fips.padStart(5, "0");
  const startMs = EPOCH_MS + startMin * 60_000;
  const endMs = startMs + durH * 3_600_000 + 15 * 60_000; // +1 snapshot of buffer
  const dir = rawDir();
  const years = Array.from(new Set([new Date(startMs).getUTCFullYear(), new Date(endMs).getUTCFullYear()]));

  const pts: [number, number][] = [];
  for (const y of years) {
    const file = path.join(dir, `eaglei_outages_${y}.csv`);
    if (!existsSync(file)) continue;
    try {
      const { stdout } = await pexec("grep", [`^${fips5},`, file], { maxBuffer: 128 * 1024 * 1024 });
      for (const line of stdout.split("\n")) {
        if (!line) continue;
        const f = line.split(",");
        if (!f[4]) continue; // run_start_time
        const tMs = Date.parse(f[4].replace(" ", "T") + "Z"); // raw time is naive UTC
        if (Number.isNaN(tMs) || tMs < startMs || tMs > endMs) continue;
        pts.push([tMs, Number(f[3])]); // customers_out
      }
    } catch {
      /* grep exit code 1 = no match in this year file → skip */
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

  return NextResponse.json({ fips: fips5, startMs, endMs, n: pts.length, points });
}
