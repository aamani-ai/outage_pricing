/**
 * Generate lib/data/county-centroids.json: { "01001": [lon, lat], ... }
 * A guaranteed-INTERIOR point per county (pole of inaccessibility of its largest ring, via polylabel)
 * so /api/studio's geocode resolves the SAME county — a bbox center falls outside concave/coastal
 * counties (Santa Barbara → ocean) and would deep-link to the wrong county.
 * Re-run if us-atlas updates:  node scripts/gen_centroids.cjs
 */
const topojson = require("topojson-client");
const polylabelMod = require("polylabel");
const polylabel = polylabelMod.default || polylabelMod; // ESM default interop
const us = require("us-atlas/counties-10m.json");
const fs = require("fs");
const path = require("path");

// shoelace area of a ring (sign-agnostic) — to pick the largest polygon of a MultiPolygon.
function ringArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(a / 2);
}

const fc = topojson.feature(us, us.objects.counties);
const out = {};
for (const f of fc.features) {
  const g = f.geometry;
  if (!g) continue;
  const id = String(f.id).padStart(5, "0");
  const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  let best = null;
  let bestArea = -1;
  for (const poly of polys) {
    const a = ringArea(poly[0]); // outer ring
    if (a > bestArea) {
      bestArea = a;
      best = poly;
    }
  }
  if (!best) continue;
  const p = polylabel(best, 0.01); // ~1km precision — an interior point, point-in-polygon safe
  out[id] = [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4];
}
const dest = path.join(__dirname, "..", "lib", "data", "county-centroids.json");
fs.writeFileSync(dest, JSON.stringify(out));
console.log("counties:", Object.keys(out).length, "→ lib/data/county-centroids.json (interior points)");
