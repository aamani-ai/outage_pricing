"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";
import { feature } from "topojson-client";
import { asset } from "@/lib/base-path";
import { money } from "@/lib/analytics/format";
import type { AnalyticsRow } from "@/lib/analytics/types";

const STYLE_LIGHT = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const STYLE_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// premium ramp — INDIGO, matching the distribution's bar color (c.bar) so the whole section reads as one
// system. High-contrast (pale→deep on light, deep→bright on dark) so higher-premium counties still pop.
const RAMP_LIGHT = ["#eef2ff", "#c7d2fe", "#818cf8", "#4f46e5", "#3730a3"];
const RAMP_DARK = ["#312e81", "#4338ca", "#6366f1", "#818cf8", "#c7d2fe"];
const NODATA = { light: "#e5e7eb", dark: "#3f3f46" };
const EXCLUDED = { light: "#cbd5e1", dark: "#52525b" };
const DIM = { light: "#eceef1", dark: "#26262a" }; // non-matching counties when a filter is active

function rampColor(premium: number, lo: number, hi: number, ramp: string[]): string {
  const loP = Math.max(lo, 1e-9);
  const hiP = Math.max(hi, loP * 1.0001);
  const t = (Math.log10(Math.max(premium, loP)) - Math.log10(loP)) / (Math.log10(hiP) - Math.log10(loP));
  return ramp[Math.min(ramp.length - 1, Math.max(0, Math.floor(t * ramp.length)))]!;
}

const fipsNum = (fips: string) => Number(fips); // geojson feature ids are zero-padded strings; Number() normalizes both sides

export function PremiumMap({
  rows,
  lo,
  hi,
  onPick,
  matchIds,
  focusBounds,
}: {
  rows: AnalyticsRow[];
  lo: number;
  hi: number;
  onPick?: (fips: string) => void;
  /** when set, counties NOT in this set are dimmed (a filter is active); null = color all. */
  matchIds?: Set<number> | null;
  /** fit the view to these [[w,s],[e,n]] bounds (state scope); null = whole CONUS. */
  focusBounds?: [[number, number], [number, number]] | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const byId = useRef<Map<number, AnalyticsRow>>(new Map());
  const allIdsRef = useRef<number[]>([]);
  const rowsRef = useRef(rows);
  const loRef = useRef(lo);
  const hiRef = useRef(hi);
  const onPickRef = useRef(onPick);
  const matchRef = useRef(matchIds);
  const focusRef = useRef(focusBounds);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const ramp = dark ? RAMP_DARK : RAMP_LIGHT;

  rowsRef.current = rows;
  loRef.current = lo;
  hiRef.current = hi;
  onPickRef.current = onPick;
  matchRef.current = matchIds;
  focusRef.current = focusBounds;

  function applyColors() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const m = new Map<number, AnalyticsRow>();
    for (const r of rowsRef.current) m.set(fipsNum(r.fips), r);
    byId.current = m;
    const excl = dark ? EXCLUDED.dark : EXCLUDED.light;
    const dim = dark ? DIM.dark : DIM.light;
    const matching = matchRef.current;
    // iterate ALL counties so any not in the current (possibly state-scoped) set is HIDDEN —
    // not left showing a stale color from a previous render.
    for (const id of allIdsRef.current) {
      const r = m.get(id);
      if (!r) {
        map.setFeatureState({ source: "counties", id }, { hidden: true });
        continue;
      }
      const base = r.excluded || r.premium == null ? excl : rampColor(r.premium, loRef.current, hiRef.current, ramp);
      const color = matching && !matching.has(id) ? dim : base;
      map.setFeatureState({ source: "counties", id }, { color, hidden: false });
    }
  }

  function applyFocus() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const fb = focusRef.current;
    if (fb) map.fitBounds(fb, { padding: 36, duration: 600, maxZoom: 7 });
    else map.flyTo({ center: [-96, 38], zoom: 3.1, duration: 600 });
  }

  // init / re-init on theme (basemap can't hot-swap cleanly)
  useEffect(() => {
    if (!ref.current) return;
    readyRef.current = false;
    const map = new maplibregl.Map({
      container: ref.current,
      style: dark ? STYLE_DARK : STYLE_LIGHT,
      center: [-96, 38],
      zoom: 3.1,
      attributionControl: false,
      dragRotate: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "premium-map-popup" });

    map.on("load", async () => {
      try {
        const topo = await fetch(asset("/geo/counties-10m.json")).then((r) => r.json());
        if (mapRef.current !== map) return; // teardown raced the fetch — bail
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fc = feature(topo, topo.objects.counties) as any;
        for (const f of fc.features) f.id = Number(f.id); // numeric ids for feature-state
        allIdsRef.current = fc.features.map((f: { id: number }) => f.id);
        map.addSource("counties", { type: "geojson", data: fc });
        map.addLayer({
          id: "counties-fill",
          type: "fill",
          source: "counties",
          paint: {
            "fill-color": ["coalesce", ["feature-state", "color"], dark ? NODATA.dark : NODATA.light],
            "fill-opacity": ["case", ["boolean", ["feature-state", "hidden"], false], 0, 0.85],
          },
        });
        map.addLayer({
          id: "counties-line",
          type: "line",
          source: "counties",
          paint: {
            "line-color": dark ? "#18181b" : "#ffffff",
            "line-width": 0.2,
            "line-opacity": ["case", ["boolean", ["feature-state", "hidden"], false], 0, 1],
          },
        });
        readyRef.current = true;
        applyColors();
        applyFocus();

        map.on("mousemove", "counties-fill", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          map.getCanvas().style.cursor = "pointer";
          const r = byId.current.get(Number(f.id));
          if (!r) {
            popup.remove();
            return;
          }
          const val = r.excluded || r.premium == null ? `excluded · ${r.exclReason ?? "—"}` : `${money(r.premium)} / yr`;
          popup
            .setLngLat(e.lngLat)
            .setHTML(`<div style="font-weight:600">${r.name}, ${r.state}</div><div>${val}</div>`)
            .addTo(map);
        });
        map.on("mouseleave", "counties-fill", () => {
          map.getCanvas().style.cursor = "";
          popup.remove();
        });
        map.on("click", "counties-fill", (e) => {
          const f = e.features?.[0];
          if (f && onPickRef.current) onPickRef.current(String(f.id).padStart(5, "0"));
        });
      } catch {
        /* map is a progressive enhancement; the distribution + QC carry the data */
      }
    });

    return () => {
      popup.remove();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

  // recolor when the batch (rows / scale / active filter) changes
  useEffect(() => {
    applyColors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, lo, hi, matchIds]);

  // fit the view when the region scope changes
  useEffect(() => {
    applyFocus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusBounds]);

  return (
    <div className="relative h-full w-full">
      <div ref={ref} className="h-full w-full" />
      {/* legend — the ramp is clamped to p10–p90; the tails pile into the end colors */}
      <div className="bg-card/90 border-border absolute bottom-2 left-2 rounded-md border px-2.5 py-1.5 text-[10px] backdrop-blur">
        <div className="text-muted-foreground mb-1">annual premium · clamped p10–p90</div>
        <div className="flex items-center gap-1">
          <span className="tabular-nums">{money(lo)}</span>
          <span className="flex h-2 w-24 overflow-hidden rounded-sm">
            {ramp.map((col) => (
              <span key={col} className="flex-1" style={{ background: col }} />
            ))}
          </span>
          <span className="tabular-nums">{money(hi)}</span>
        </div>
        <div className="text-muted-foreground/70 mt-1 flex items-center gap-1">
          <span className="size-2 rounded-sm" style={{ background: dark ? EXCLUDED.dark : EXCLUDED.light }} /> excluded
        </div>
      </div>
    </div>
  );
}
