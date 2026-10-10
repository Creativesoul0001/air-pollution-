"use client";

import { useMemo, useState } from "react";
import { Wind, Info, AlertTriangle, Satellite } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { DhuanMap } from "@/components/DhuanMap";
import { EstimateCard } from "@/components/panels/EstimateCard";
import { UncertaintyBar } from "@/components/panels/UncertaintyBar";
import { CausesList } from "@/components/panels/CausesList";
import { AgentTrace } from "@/components/panels/AgentTrace";
import { AdviceCards } from "@/components/panels/AdviceCards";
import { Card, CardHeader, CardTitle, Badge } from "@/components/ui";
import { useEstimate } from "@/hooks/useEstimate";
import { DEFAULT_COORD } from "@/lib/constants";
import type { Profile } from "@/lib/types";

export default function Page() {
  const [coord, setCoord] = useState(DEFAULT_COORD);
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [profile, setProfile] = useState<Profile>("parent");

  const { data, loading, usingSample } = useEstimate(coord.lat, coord.lon, lang);

  // If the API exposes wind, use it; otherwise fall back to the top contributor's bearing.
  const windDirDeg = useMemo(() => {
    if (data.wind?.dir_deg != null) return data.wind.dir_deg;
    return data.attribution.likely_contributors[0]?.bearing_deg ?? 305;
  }, [data]);

  return (
    <main className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Satellite className="h-5 w-5 text-blue-600" />
          <div>
            <h1 className="text-base font-bold leading-tight">Dhuan Detective</h1>
            <p className="text-[11px] leading-tight text-slate-500">Why is my street&apos;s air bad right now?</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <SearchBar
              onSelect={(p) => setCoord({ lat: p.lat, lon: p.lon })}
              onLocate={(lat, lon) => setCoord({ lat, lon })}
            />
          </div>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as "en" | "hi")}
            className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            aria-label="Language"
          >
            <option value="en">EN</option>
            <option value="hi">हिन्दी</option>
          </select>
        </div>
      </header>

      {/* Mobile search */}
      <div className="border-b border-slate-200 p-3 sm:hidden dark:border-slate-800">
        <SearchBar
          onSelect={(p) => setCoord({ lat: p.lat, lon: p.lon })}
          onLocate={(lat, lon) => setCoord({ lat, lon })}
        />
      </div>

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-5">
        {/* Map */}
        <div className="relative min-h-[45vh] lg:col-span-3 lg:min-h-0">
          <DhuanMap
            lat={coord.lat}
            lon={coord.lon}
            windDirDeg={windDirDeg}
            contributors={data.attribution.likely_contributors}
          />
          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow dark:bg-slate-900/90 dark:text-slate-300">
            <Wind className="h-3.5 w-3.5 text-amber-500" />
            Wind from {Math.round(windDirDeg)}°
            {data.wind?.speed_kmh != null && <span>· {Math.round(data.wind.speed_kmh)} km/h</span>}
          </div>
        </div>

        {/* Panel */}
        <section className="min-h-0 overflow-y-auto border-t border-slate-200 p-4 lg:col-span-2 lg:border-l lg:border-t-0 dark:border-slate-800">
          {usingSample && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>Backend offline — sample data shown.</strong> Start the backend (or
                <code className="mx-1">make dev</code>) to see live estimates.
              </span>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge tone="neutral">
                <Info className="mr-1 h-3 w-3" /> Street-level estimate
              </Badge>
              <span className="text-[11px] text-slate-400">
                {data.generated_at ? new Date(data.generated_at).toLocaleString() : "—"}
              </span>
            </div>

            <EstimateCard data={data} loading={loading} />
            <Card>
              <UncertaintyBar data={data} />
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Likely causes</CardTitle>
              </CardHeader>
              <CausesList contributors={data.attribution.likely_contributors} />
            </Card>

            <AgentTrace data={data} />

            <Card>
              <CardHeader>
                <CardTitle>What you can do</CardTitle>
              </CardHeader>
              <AdviceCards advice={data.advice} value={profile} onChange={setProfile} />
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
