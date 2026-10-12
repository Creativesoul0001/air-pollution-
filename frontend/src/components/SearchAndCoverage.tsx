"use client";

import { useEffect, useRef, useState } from "react";
import { Search, MapPin, X, LocateFixed, Loader2, Database, LineChart } from "lucide-react";
import { useDashboard } from "@/lib/dashboard";
import { searchLocations } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { LocationResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const POI_CATS = ["school", "hospital", "metro_station", "park", "landmark", "college"];

export function SearchAndCoverage() {
  const { selected, selectLocation, clearSelection, stats, statsLoading, statsError, setView, coord, setCoord, lang } =
    useDashboard();
  const L = t(lang);

  const [term, setTerm] = useState("");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setResults([]);
      setUnavailable(false);
      setLoading(false);
      return;
    }
    const c = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      searchLocations(q, c.signal).then((r) => {
        if (c.signal.aborted) return;
        setLoading(false);
        if (r.ok) {
          setResults(r.data.results);
          setUnavailable(false);
          setActiveIdx(r.data.results.length ? 0 : -1);
        } else {
          setResults([]);
          setUnavailable(true);
          setActiveIdx(-1);
        }
      });
    }, 250);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [term]);

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const choose = (r: LocationResult) => {
    setTerm(r.name || "");
    setResults([]);
    setOpen(false);
    selectLocation(r);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[activeIdx];
      if (r) choose(r);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const clear = () => {
    setTerm("");
    setResults([]);
    clearSelection();
  };

  const poiSum = stats
    ? POI_CATS.reduce((s, c) => s + (stats.by_category[c] ?? 0), 0)
    : 0;
  const citiesCount = stats?.administrative_areas?.length ?? 0;

  const metrics: {
    label: string;
    value: string;
    hint?: string;
    to: "analytics" | "sources";
    icon: React.ReactNode;
  }[] = [
    {
      label: L.coverageGeo,
      value: citiesCount ? `${citiesCount} areas` : "—",
      hint: "Administrative areas in the dataset",
      to: "sources",
      icon: <MapPin className="h-4 w-4 text-dd-accent2" />,
    },
    {
      label: L.coverageIndexed,
      value: statsLoading || !stats ? "…" : stats.total_locations.toLocaleString("en-IN"),
      hint: "OpenStreetMap (ODbL)",
      to: "analytics",
      icon: <Database className="h-4 w-4 text-dd-accent2" />,
    },
    {
      label: L.coverageObserved,
      value: statsLoading || !stats ? "…" : stats.locations_with_observations.toLocaleString("en-IN"),
      hint: "Real PM2.5 from Open-Meteo",
      to: "analytics",
      icon: <span className="h-2.5 w-2.5 rounded-full bg-dd-accent" />,
    },
    {
      label: L.coveragePoi,
      value: statsLoading || !stats ? "…" : poiSum.toLocaleString("en-IN"),
      hint: "Schools, hospitals, metro, parks, landmarks",
      to: "analytics",
      icon: <Search className="h-4 w-4 text-dd-purple" />,
    },
    {
      label: L.coverageModel,
      value: statsLoading || !stats ? "…" : stats.locations_with_model_estimates.toLocaleString("en-IN"),
      hint: stats?.model?.trained ? `Validated model, RMSE ${stats.model.los_rmse} µg/m³` : "No model trained",
      to: "analytics",
      icon: <LineChart className="h-4 w-4 text-dd-accent" />,
    },
    {
      label: L.coverageCities,
      value: statsLoading || !stats ? "…" : citiesCount.toString(),
      hint: "Distinct cities / towns",
      to: "analytics",
      icon: <MapPin className="h-4 w-4 text-dd-warn" />,
    },
  ];

  return (
    <section className="space-y-3">
      {/* Search */}
      <div ref={boxRef} className="relative w-full max-w-2xl">
        <div className="flex items-center gap-2 rounded-xl border border-dd-border bg-dd-card px-3 shadow-sm focus-within:border-dd-accent">
          <Search className="h-4 w-4 text-dd-muted" />
          <input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={L.searchPlaceholder}
            aria-label={L.searchPlaceholder}
            aria-expanded={open && (results.length > 0 || unavailable)}
            role="combobox"
            aria-controls="loc-results"
            className="h-12 w-full bg-transparent text-sm text-dd-text outline-none placeholder:text-dd-muted"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-dd-muted" />}
          {term && !loading && (
            <button onClick={clear} aria-label={L.clear} className="rounded p-1 text-dd-muted hover:bg-dd-elev">
              <X className="h-4 w-4" />
            </button>
          )}
          {!term && (
            <button
              onClick={() =>
                navigator.geolocation?.getCurrentPosition(
                  (p) => setCoord({ lat: p.coords.latitude, lon: p.coords.longitude }),
                  () => {}
                )
              }
              aria-label="Use my location"
              className="rounded p-1.5 text-dd-muted hover:bg-dd-elev"
            >
              <LocateFixed className="h-4 w-4" />
            </button>
          )}
        </div>

        {open && term.trim().length >= 2 && (
          <ul
            id="loc-results"
            role="listbox"
            className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-dd-border bg-dd-header shadow-lg"
          >
            {unavailable && (
              <li className="px-3 py-3 text-sm text-dd-muted">{L.searchUnavailable}</li>
            )}
            {!unavailable && results.length === 0 && !loading && (
              <li className="px-3 py-3 text-sm text-dd-muted">{L.noMatches}</li>
            )}
            {results.map((r, i) => (
              <li key={r.id} role="option" aria-selected={i === activeIdx}>
                <button
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => choose(r)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                    i === activeIdx ? "bg-dd-elev text-dd-text" : "text-dd-text/90"
                  )}
                >
                  <MapPin className="h-3.5 w-3.5 text-dd-muted" />
                  <span className="truncate">{r.name}</span>
                  <span className="ml-auto text-[10px] uppercase text-dd-muted">{r.category.replace(/_/g, " ")}</span>
                  {r.has_observation && <span className="text-[10px] font-medium text-dd-accent">PM2.5</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Coverage metric cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((m) => (
          <button
            key={m.label}
            onClick={() => setView(m.to)}
            className="group rounded-xl border border-dd-border bg-dd-card p-3 text-left transition-colors hover:border-dd-accent/50 hover:bg-dd-elev"
            aria-label={`${m.label}: ${m.value}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-dd-muted">{m.label}</span>
              {m.icon}
            </div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums text-dd-text">
              {statsError ? <span className="text-dd-crit">Unavailable</span> : m.value}
            </div>
            {m.hint && <div className="truncate text-[11px] text-dd-muted">{m.hint}</div>}
          </button>
        ))}
      </div>
    </section>
  );
}

