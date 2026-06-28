/**
 * Server-only reader for the per-county event series hosted in the private GCS bucket
 * (gs://infrasure-outage-pricing-data/app/county_events/<FIPS>.json). Powers the County-explorer
 * event-timeseries view. Auth via ADC locally (gcloud auth application-default login), a bound
 * service account in prod. Small in-memory cache so re-opening a county doesn't re-fetch.
 *
 * Built by web/scripts/build_county_events.py from price_engine/data/events.parquet.
 */
import { Storage } from "@google-cloud/storage";

const BUCKET = "infrasure-outage-pricing-data";
const PREFIX = "app/county_events";
const PROJECT = "modeling-nonprod-svc-db5x"; // the project that owns the bucket

export interface CountyEvents {
  fips: string;
  epoch: string; // "2014-01-01" — `days` are integer offsets from here (UTC)
  minDurationH: number; // only events >= this are included
  cols: string[]; // ["days","durH","meanCust","maxCust"]
  n: number;
  /** [daysSinceEpoch, durationHours, meanCustomers, maxCustomers] per event, sorted by days. */
  events: [number, number, number, number][];
}

let storage: Storage | null = null;
function client(): Storage {
  if (!storage) storage = new Storage({ projectId: PROJECT });
  return storage;
}

const cache = new Map<string, CountyEvents | null>();
const MAX_CACHE = 250;

export async function getCountyEvents(fips: string): Promise<CountyEvents | null> {
  const key = String(fips).padStart(5, "0");
  if (cache.has(key)) return cache.get(key) ?? null;

  let result: CountyEvents | null = null;
  try {
    const [buf] = await client().bucket(BUCKET).file(`${PREFIX}/${key}.json`).download();
    result = JSON.parse(buf.toString("utf8")) as CountyEvents;
  } catch (e: unknown) {
    const code = (e as { code?: number }).code;
    if (code !== 404) console.error(`[county-events] ${key}:`, (e as Error).message);
    result = null; // 404 = no events for this county; other errors logged + treated as empty
  }

  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
  cache.set(key, result);
  return result;
}
