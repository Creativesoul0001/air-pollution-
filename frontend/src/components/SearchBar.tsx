"use client";

import { useEffect, useState } from "react";
import { Search, MapPin, LocateFixed, Loader2 } from "lucide-react";
import { searchLocations } from "@/lib/api";
import type { LocationResult } from "@/lib/types";

interface Props {
  onSelect: (p: { name: string; lat: number; lon: number }) => void;
  onLocate: (lat: number, lon: number) => void;
}

export function SearchBar({ onSelect, onLocate }: Props) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [open, setOpen] = useState(false);

  // Debounced search against the backend location index.
  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setResults([]);
      setUnavailable(false);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      searchLocations(q, ctrl.signal).then((r) => {
        if (ctrl.signal.aborted) return;
        setLoading(false);
        if (r.ok) {
          setResults(r.data.results);
          setUnavailable(false);
        } else {
          setResults([]);
          setUnavailable(true);
        }
      });
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term]);

  const choose = (r: LocationResult) => {
    onSelect({ name: r.name || "Selected location", lat: r.lat, lon: r.lon });
    setTerm(r.name || "");
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 dark:border-slate-700 dark:bg-slate-900">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search indexed Delhi NCR locations…"
          aria-label="Search indexed Delhi NCR locations"
          className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : (
          <button
            onClick={() =>
              navigator.geolocation?.getCurrentPosition(
                (pos) => onLocate(pos.coords.latitude, pos.coords.longitude),
                () => {}
              )
            }
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Use my location"
          >
            <LocateFixed className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && term.trim().length >= 2 && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {unavailable && (
            <li className="px-3 py-2 text-sm text-slate-500">Location search unavailable (backend offline).</li>
          )}
          {!unavailable && results.length === 0 && !loading && (
            <li className="px-3 py-2 text-sm text-slate-500">No indexed locations match.</li>
          )}
          {results.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => choose(r)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{r.name}</span>
                {r.has_observation && (
                  <span className="ml-auto shrink-0 text-[10px] font-medium text-emerald-600">PM2.5</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
