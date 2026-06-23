"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";

// Free CARTO vector basemaps (no token) — paired light/dark so the data layer stays legible.
const STYLE = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

// building level — see the asset/parcel; the user can zoom out with the controls
const ZOOM = 16;

export default function LocationMap({ lon, lat, label }: { lon: number; lat: number; label?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const { resolvedTheme } = useTheme();
  const styleUrl = resolvedTheme === "dark" ? STYLE.dark : STYLE.light;

  // init once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [lon, lat],
      zoom: 12,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    markerRef.current = new maplibregl.Marker({ color: "#16a34a" }).setLngLat([lon, lat]).addTo(map);
    mapRef.current = map;
    map.on("load", () => map.resize());

    // keep the canvas matched to its container (it stretches as the left column grows)
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // recenter + move the marker when the priced point changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRef.current?.setLngLat([lon, lat]);
    map.flyTo({ center: [lon, lat], zoom: 12, essential: true });
  }, [lon, lat]);

  // swap the basemap with the theme
  useEffect(() => {
    mapRef.current?.setStyle(styleUrl);
  }, [styleUrl]);

  return <div ref={containerRef} className="h-full min-h-[440px] w-full" aria-label={label ? `Map of ${label}` : "Map"} />;
}
