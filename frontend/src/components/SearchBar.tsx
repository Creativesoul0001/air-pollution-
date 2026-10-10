"use client";

import { useState } from "react";
import { Search, MapPin, LocateFixed } from "lucide-react";
import { DELHI_PLACES } from "@/lib/constants";

interface Props {
  onSelect: (place: { name: string; lat: number; lon: number }) => void;
  onLocate: (lat: number, lon: number) => void;
}

export function SearchBar({ onSelect, onLocate }: Props) {
  const [q, setQ] = useState("");
  const matches = q.trim()
    ? DELHI_PLACES.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
    : [];

  const pick = (i: number) => {
    const p = matches[i];
    if (!p) return;
    onSelect(p);
    setQ("");
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 dark:border-slate-700 dark:bg-slate-900">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              pick(0);
            }
          }}
          placeholder="Search a school, home or junction in Delhi…"
          aria-label="Search a place in Delhi"
          className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
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
      </div>

      {matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {matches.map((p, i) => (
            <li key={p.name}>
              <button
                onClick={() => pick(i)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
