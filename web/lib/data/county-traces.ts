/**
 * Server-only reader for the per-county-per-year RAW 15-minute outage traces hosted in the private GCS bucket
 * (gs://infrasure-outage-pricing-data/app/county_traces/<FIPS>/<year>.json). Powers the County-explorer
 * event drill-down (one event's raw 15-min customers-out shape). Auth via ADC locally
 * (gcloud auth application-default login), a bound service account in prod. Small in-memory cache keyed by
 * (fips, year) so re-opening events in the same county-year doesn't re-fetch.
 *
 * Built by web/scripts/build_county_traces.py from the raw EAGLE-I snapshots.
 */
import { Storage } from "@google-cloud/storage";

const BUCKET = "infrasure-outage-pricing-data";
const PREFIX = "app/county_traces";
const PROJECT = "modeling-nonprod-svc-db5x"; // the project that owns the bucket

export interface CountyTrace {
  fips: string;
  year: number;
  epoch: string; // "2014-01-01" — `mins` are integer offsets from here (UTC)
  cols: string[]; // ["mins","out"]
  n: number;
  /** [minsSinceEpoch, customersOut] per 15-min snapshot, sorted by mins. */
  rows: [number, number][];
}

let storage: Storage | null = null;
function client(): Storage {
  if (!storage) storage = new Storage({ projectId: PROJECT });
  return storage;
}

const cache = new Map<string, CountyTrace | null>();
const MAX_CACHE = 120; // per-county-per-year slices are small (~0.1–0.4 MB)

export async function getCountyTrace(fips: string, year: number): Promise<CountyTrace | null> {
  const f5 = String(fips).padStart(5, "0");
  const key = `${f5}-${year}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  let result: CountyTrace | null = null;
  try {
    const [buf] = await client().bucket(BUCKET).file(`${PREFIX}/${f5}/${year}.json`).download();
    result = JSON.parse(buf.toString("utf8")) as CountyTrace;
  } catch (e: unknown) {
    const code = (e as { code?: number }).code;
    if (code !== 404) console.error(`[county-traces] ${key}:`, (e as Error).message);
    result = null; // 404 = no raw rows for this county-year; other errors logged + treated as empty
  }

  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
  cache.set(key, result);
  return result;
}
