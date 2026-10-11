"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Layers, Maximize2, Minimize2, Wind as WindIcon, X } from "lucide-react";
import { useDashboard } from "@/lib/dashboard";
import { fetchObservationPoints, fetchPoints } from "@/lib/api";
import { MAP_LAYERS } from "@/lib/layers";
import { aqiFromPm25, windDirToCompass } from "@/lib/aq";
import type { ObsPoint, PointRow } from "@/lib/types";
import { Button, Badge } from "@/components/ui";

// Clean, LIGHT OpenStreetMap tiles (real roads, water, parks, boundaries, city labels).
// Keyless, correct attribution, no watermark and no dark overlay — so state boundaries,
// city labels, major/local roads, parks and water bodies all stay clearly distinguishable
// against the dark navy dashboard chrome.
const OSM_RASTER = [
  "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
  "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
  "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
];

function dot(color: string, size = 10, ring = false): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `height:${size}px;width:${size}px;border-radius:9999px;background:${color};box-shadow:${
    ring ? "0 0 0 3px rgba(255,255,255,.25)" : "0 0 0 1px rgba(0,0,0,.35)"
  };`;
  return el;
}

export function MapStage() {
  const { coord, selected, selectLocation, weather } = useDashboard();
  const wrapRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [enabled, setEnabled] = useState<Set<string>>(new Set(["airQuality"]));
  const [obs, setObs] = useState<ObsPoint[]>([]);
  const [poi, setPoi] = useState<PointRow[]>([]);
  const [layersOpen, setLayersOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  // Init the map once.
  useEffect(() => {
    if (!wrapRef.current) return;
    const map = new maplibregl.Map({
      container: wrapRef.current,
      style: {
        version: 8,
        sources: {
          base: {
            type: "raster",
            tiles: OSM_RASTER,
            tileSize: 256,
            maxzoom: 19,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "base",
            type: "raster",
            source: "base",
          },
        ],
      },
      center: [coord.lon, coord.lat],
      zoom: 11,
      maxZoom: 19,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enabledPoiCats = MAP_LAYERS.filter((l) => enabled.has(l.key) && l.category).map((l) => l.category!) as string[];

  // Fetch air-quality observation points.
  useEffect(() => {
    if (!enabled.has("airQuality")) {
      setObs([]);
      return;
    }
    const c = new AbortController();
    fetchObservationPoints(1000, c.signal).then((r) => setObs(r.ok ? r.data.points : []));
    return () => c.abort();
  }, [enabled]);

  // Fetch POI points for enabled categories.
  useEffect(() => {
    if (enabledPoiCats.length === 0) {
      setPoi([]);
      return;
    }
    const c = new AbortController();
    fetchPoints(enabledPoiCats, 600, c.signal).then((r) => setPoi(r.ok ? r.data.points : []));
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledPoiCats.join(",")]);

  // Re-render markers on any relevant change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const draw = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const add = (lngLat: [number, number], element: HTMLElement, onClick?: () => void) => {
        const marker = new maplibregl.Marker({ element })
          .setLngLat(lngLat)
          .addTo(map);
        if (onClick) element.addEventListener("click", onClick);
        markersRef.current.push(marker);
      };

      // Air-quality observation markers (colored by PM2.5 band).
      if (enabled.has("airQuality")) {
        for (const o of obs) {
          const { color } = aqiFromPm25(o.value);
          add([o.lon, o.lat], dot(color, 9), () =>
            selectLocation({
              id: o.id,
              name: o.name || "Observation point",
              category: "observation",
              lat: o.lat,
              lon: o.lon,
              city: null,
              has_observation: true,
            })
          );
        }
      }

      // POI markers grouped by layer colour.
      for (const layer of MAP_LAYERS) {
        if (!layer.category || !enabled.has(layer.key)) continue;
        for (const p of poi.filter((x) => x.category === layer.category)) {
          add([p.lon, p.lat], dot(layer.color, 8), () =>
            selectLocation({
              id: p.id,
              name: p.name || layer.label,
              category: p.category,
              lat: p.lat,
              lon: p.lon,
              city: null,
              has_observation: false,
            })
          );
        }
      }

      // Wind direction marker (arrow rotated to the direction the wind blows toward).
      const wd = weather?.wind_direction_deg;
      if (wd != null && enabled.has("wind")) {
        const el = document.createElement("div");
        el.textContent = "➤";
        el.style.cssText = `color:var(--dd-warn);font-size:20px;transform:rotate(${wd}deg);`;
        el.title = `Wind ${Math.round(wd)}° ${windDirToCompass(wd)}`;
        add([coord.lon, coord.lat], el);
      }

      // Selected-location pin.
      const sel = document.createElement("div");
      sel.style.cssText =
        "height:18px;width:18px;border-radius:9999px;background:var(--dd-accent2);box-shadow:0 0 0 4px rgba(34,184,255,.25);border:2px solid #fff;";
      add([coord.lon, coord.lat], sel, undefined);

      map.flyTo({ center: [coord.lon, coord.lat], duration: 700 });
    };

    if (map.loaded()) draw();
    else map.once("load", draw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obs, poi, coord.lat, coord.lon, weather, enabled]);

  const toggleLayer = (key: string) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      // wind is not in MAP_LAYERS; keep a dedicated toggle below
      return next;
    });

  const toggleFullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative h-[55vh] min-h-[420px] w-full overflow-hidden rounded-2xl border border-dd-border bg-dd-elev lg:h-full lg:min-h-0">
      <div ref={wrapRef} data-testid="map-canvas" className="h-full w-full" />

      {/* Layer toggles */}
      <div className="pointer-events-auto absolute left-3 top-3 z-10 w-56 rounded-xl border border-dd-border bg-dd-header/95 p-3 shadow-lg backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-dd-text">
            <Layers className="h-3.5 w-3.5 text-dd-accent" /> Layers
          </span>
          <button
            aria-label="Toggle layers panel"
            onClick={() => setLayersOpen((o) => !o)}
            className="rounded p-0.5 text-dd-muted hover:bg-dd-elev"
          >
            {layersOpen ? <X className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
          </button>
        </div>
        {layersOpen && (
          <div className="space-y-1.5">
            {MAP_LAYERS.map((l) => (
              <label key={l.key} className="flex cursor-pointer items-center gap-2 text-xs text-dd-text">
                <input
                  type="checkbox"
                  checked={enabled.has(l.key)}
                  onChange={() => toggleLayer(l.key)}
                  className="h-3.5 w-3.5 accent-[var(--dd-accent)]"
                />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                {l.label}
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-2 text-xs text-dd-text">
              <input
                type="checkbox"
                checked={enabled.has("wind")}
                onChange={() => toggleLayer("wind")}
                className="h-3.5 w-3.5 accent-[var(--dd-warn)]"
              />
              <WindIcon className="h-3 w-3 text-dd-warn" /> Wind direction
            </label>
          </div>
        )}
      </div>

      {/* Fullscreen */}
      <div className="pointer-events-auto absolute right-3 top-3 z-10">
        <Button size="sm" variant="outline" onClick={toggleFullscreen} aria-label="Toggle fullscreen map">
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-xl border border-dd-border bg-dd-header/90 p-3 text-[11px] text-dd-text shadow-lg backdrop-blur">
        <p className="mb-1.5 font-semibold text-dd-muted">PM2.5 (µg/m³) — CPCB bands</p>
        <div className="flex flex-col gap-1">
          {[
            ["Good", "var(--dd-accent)", "0–30"],
            ["Moderate", "var(--dd-warn)", "31–60"],
            ["Poor", "#fb923c", "61–90"],
            ["Very Poor", "var(--dd-crit)", "91–120"],
            ["Severe", "#b91c1c", ">120"],
          ].map(([label, color, range]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
              {label} <span className="text-dd-muted">{range}</span>
            </span>
          ))}
        </div>
        <p className="mt-2 border-t border-dd-border pt-1.5 text-dd-muted">
          {obs.length} live PM2.5 observations shown · © OpenStreetMap
        </p>
      </div>
    </div>
  );
}
