import { NextResponse } from "next/server";
import { getCounty } from "@/lib/data/pricing";
import { getStudio } from "@/lib/data/studio";
import { getTract, getCounty as getLocCounty, getRelativity, GUARDRAIL, type Tercile } from "@/lib/data/location";
import { getForward } from "@/lib/data/forward";
import { getWeather } from "@/lib/data/weather";

export const dynamic = "force-dynamic";

const MRLC = "https://www.mrlc.gov/geoserver/mrlc_display/wms";
const LAYER = "NLCD_2021_Impervious_L48";
const SLIDER_T = [2, 4, 8, 12, 24]; // the trigger durations the UI offers

/** NLCD 2021 impervious % at a single point (MRLC WMS GetFeatureInfo). null on miss/water/no-data. */
async function imperviousAt(lat: number, lon: number, signal: AbortSignal): Promise<number | null> {
  const d = 0.0008;
  const params = new URLSearchParams({
    SERVICE: "WMS", VERSION: "1.1.1", REQUEST: "GetFeatureInfo", LAYERS: LAYER, QUERY_LAYERS: LAYER,
    SRS: "EPSG:4326", BBOX: `${lon - d},${lat - d},${lon + d},${lat + d}`,
    WIDTH: "5", HEIGHT: "5", X: "2", Y: "2", INFO_FORMAT: "application/json",
  });
  try {
    const r = await fetch(`${MRLC}?${params.toString()}`, { signal, cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as { features?: { properties?: { PALETTE_INDEX?: number } }[] };
    const v = j.features?.[0]?.properties?.PALETTE_INDEX;
    return typeof v === "number" && v >= 0 && v <= 100 ? v : null;
  } catch {
    return null;
  }
}

/**
 * On-demand zonal-mean impervious for the queried ADDRESS — a 3×3 grid (~100 m spacing) fetched
 * concurrently under a shared 5 s timeout. This is the documented Manhattan fix, evaluated per
 * address (not precomputed). Returns null if the source is unavailable — the guardrail then simply
 * does not fire and the density tercile stands (graceful, never blocks the price).
 */
async function zonalImpervious(lat: number, lon: number): Promise<number | null> {
  const stepLat = 100 / 111000;
  const stepLon = 100 / (111000 * Math.cos((lat * Math.PI) / 180));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  const pts: Promise<number | null>[] = [];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) pts.push(imperviousAt(lat + i * stepLat, lon + j * stepLon, ctrl.signal));
  }
  const vals = (await Promise.all(pts)).filter((v): v is number => v !== null);
  clearTimeout(timer);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/**
 * Full county picture for the Underwriting Studio.
 *   GET /api/studio?lat=&lon=  →  { fips, county, studio, location, forward }
 * `location` (Step 04) carries the within-county density read + on-demand commercial-core guardrail;
 * `forward` (Step 05) carries the statistical forward factor (the "stat" in stat + climate + grid) —
 * the county's own-history forecast vs its long-run mean, one-directional, credibility-shrunk, capped.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  }

  let fips: string | null = null;
  let blockFips: string | null = null;
  try {
    const r = await fetch(
      `https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lon}&format=json`,
      { cache: "no-store" },
    );
    if (r.ok) {
      const j = (await r.json()) as { County?: { FIPS?: string }; Block?: { FIPS?: string } };
      if (typeof j.County?.FIPS === "string") fips = j.County.FIPS;
      if (typeof j.Block?.FIPS === "string") blockFips = j.Block.FIPS; // 15-digit; first 11 = tract GEOID
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

  // --- location basis (Step 04): within-county density read + on-demand commercial-core guardrail ---
  let location = null;
  const tractGeoid = blockFips && blockFips.length >= 11 ? blockFips.slice(0, 11) : null;
  const tract = tractGeoid ? getTract(tractGeoid) : null;
  if (tract) {
    let tercile: Tercile = tract.tercile;
    let guardrail: { triggered: boolean; type?: "A" | "B"; impervious?: number } = { triggered: false };
    // the guardrail can only fire from rural (Type A) or urban (Type B) — skip the WMS call for mid
    if (tract.tercile === "rural" || tract.tercile === "urban") {
      const imp = await zonalImpervious(lat, lon);
      if (imp !== null) {
        const impR = Math.round(imp);
        if (tract.tercile === "rural" && imp >= GUARDRAIL.imp_high_pct) {
          tercile = "urban"; // Type A: density says rural, but it's a built-up core → de-uplift
          guardrail = { triggered: true, type: "A", impervious: impR };
        } else if (tract.tercile === "urban" && imp <= GUARDRAIL.imp_low_pct) {
          tercile = "mid"; // Type B: density says urban, but it's not built-up → conservative penalty
          guardrail = { triggered: true, type: "B", impervious: impR };
        } else {
          guardrail = { triggered: false, impervious: impR };
        }
      }
    }
    const relativityByT: Record<string, number> = {};
    for (const T of SLIDER_T) relativityByT[String(T)] = getRelativity(T, tercile);
    const cty = getLocCounty(fips);
    location = {
      tract: tractGeoid,
      tercile,
      baseTercile: tract.tercile,
      pct: tract.pct,
      density: tract.density,
      dispersion: cty?.disp ?? null,
      nSub: cty?.nSub ?? null,
      validated: cty?.validated ?? false,
      guardrail,
      relativityByT,
    };
  }

  return NextResponse.json({ fips, county, studio: getStudio(fips), location, forward: getForward(fips), weather: getWeather(fips) });
}
