/**
 * CONUS focus — AK / HI / all territories are out of scope (MA-first go-to-market). Shared by the Analytics
 * endpoints. Keyed by FIPS state PREFIX, not state name/abbr, so it's robust to source name mismatches
 * (e.g. the Virgin Islands are stored as "US Virgin Islands", so a "VI" abbr check misses them).
 *   02 AK · 15 HI · 60 AS · 66 GU · 69 MP · 72 PR · 74 UM · 78 VI
 */
export const NON_CONUS_FIPS = new Set(["02", "15", "60", "66", "69", "72", "74", "78"]);
export const isConus = (fips: string) => !NON_CONUS_FIPS.has(fips.slice(0, 2));
