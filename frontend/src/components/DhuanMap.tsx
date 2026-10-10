"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { conePolygon, destPointGeoJSON } from "@/lib/geo";
import { sourceMeta } from "@/lib/constants";
import type { AttributionContributor } from "@/lib/types";

interface Props {
  lat: number;
  lon: number;
  windDirDeg: number;
  contributors: AttributionContributor[];
}

const CART0 = "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

export function DhuanMap({ lat, lon, windDirDeg, contributors }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const firstRef = useRef(true);

  // Init once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          base: {
            type: "raster",
            tiles: [CART0],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors © CARTO",
          },
        },
        layers: [{ id: "base", type: "raster", source: "base" }],
      },
      center: [lon, lat],
      zoom: 12,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-draw overlays on every prop change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const draw = () => {
      // Clear previous markers.
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      // Clear previous sources/layers.
      for (const id of ["upwind-cone-fill", "upwind-cone-line"]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource("upwind-cone")) map.removeSource("upwind-cone");

      // User pin.
      const userEl = document.createElement("div");
      userEl.className =
        "h-4 w-4 rounded-full bg-blue-600 ring-4 ring-blue-300";
      markersRef.current.push(
        new maplibregl.Marker({ element: userEl }).setLngLat([lon, lat]).addTo(map)
      );

      // Wind arrow near the pin.
      const windEl = document.createElement("div");
      windEl.textContent = "➤";
      windEl.style.color = "#f59e0b";
      windEl.style.fontSize = "22px";
      windEl.style.transform = `rotate(${windDirDeg}deg)`;
      windEl.style.transformOrigin = "center";
      windEl.title = `Wind from ${Math.round(windDirDeg)}°`;
      markersRef.current.push(
        new maplibregl.Marker({ element: windEl })
          .setLngLat([lon + 0.004, lat])
          .addTo(map)
      );

      // Upwind cone.
      map.addSource("upwind-cone", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: conePolygon(lat, lon, windDirDeg, 5, 60) },
        },
      });
      map.addLayer({
        id: "upwind-cone-fill",
        type: "fill",
        source: "upwind-cone",
        paint: { "fill-color": "#f59e0b", "fill-opacity": 0.15 },
      });
      map.addLayer({
        id: "upwind-cone-line",
        type: "line",
        source: "upwind-cone",
        paint: { "line-color": "#f59e0b", "line-width": 1.5, "line-opacity": 0.6 },
      });

      // Source markers, positioned from bearing + distance.
      contributors.forEach((c) => {
        const [cLon, cLat] = destPointGeoJSON(lat, lon, c.bearing_deg, c.distance_km);
        const meta = sourceMeta(c.type);
        const el = document.createElement("div");
        el.className = `h-3.5 w-3.5 rounded-full ${meta.color} ring-2 ${meta.ring}`;
        el.title = `${meta.label}: ${c.name} (${c.distance_km.toFixed(1)} km)`;
        markersRef.current.push(
          new maplibregl.Marker({ element: el }).setLngLat([cLon, cLat]).addTo(map)
        );
      });

      if (!firstRef.current) {
        map.flyTo({ center: [lon, lat], duration: 700 });
      }
      firstRef.current = false;
    };

    if (map.loaded()) draw();
    else map.once("load", draw);
  }, [lat, lon, windDirDeg, contributors]);

  return <div ref={containerRef} className="h-full w-full" data-testid="dhuan-map" />;
}
