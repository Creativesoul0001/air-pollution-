"use client";

import { Search, BarChart3, Database, Info, ExternalLink, TriangleAlert } from "lucide-react";
import { useDashboard } from "@/lib/dashboard";
import { aqiFromPm25, windDirToCompass } from "@/lib/aq";
import { Badge, Button, Card, CardTitle, Gauge, Skeleton } from "@/components/ui";

/* ------------------------------- Investigate ------------------------------- */
export function InvestigateView() {
  const { selected, coord, air, weather, setView } = useDashboard();
  const pm25 = air?.pollutants?.pm2_5 ?? null;
  const aqi = pm25 != null ? aqiFromPm25(pm25) : null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-dd-text">
          <Search className="h-5 w-5 text-dd-accent" /> Investigate
        </h1>
        <p className="text-sm text-dd-muted">
          {selected?.name ?? "Selected coordinate"} · {coord.lat.toFixed(5)}, {coord.lon.toFixed(5)}
        </p>
      </div>

      {aqi ? (
        <Card className="space-y-4">
          <div className="flex items-end gap-3">
            <span className="text-5xl font-bold tabular-nums" style={{ color: aqi.color }}>{aqi.subIndex}</span>
            <div className="pb-1.5">
              <div className="text-sm text-dd-muted">AQI (CPCB PM2.5 sub-index)</div>
              <Badge tone={aqi.tone}>{aqi.label}</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <CardTitle>Exposure context</CardTitle>
            <ul className="list-inside list-disc space-y-1 text-sm text-dd-text/90">
              <li>PM2.5 is <strong>{Math.round(pm25!)} µg/m³</strong> — sub-index {aqi.subIndex} ({aqi.label}).</li>
              <li>
                Dispersion: {weather?.wind_speed_kmh != null
                  ? `${Math.round(weather.wind_speed_kmh)} km/h from ${Math.round(weather.wind_direction_deg ?? 0)}° ${windDirToCompass(weather.wind_direction_deg ?? 0)}`
                  : "wind unavailable"}
                {weather?.wind_speed_kmh != null && weather.wind_speed_kmh < 8 ? " — low wind encourages pollutant build-up." : "."}
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-dd-warn/30 bg-dd-warn/10 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-dd-warn"><TriangleAlert className="h-4 w-4" /> Evidence &amp; limits</p>
            <p className="mt-1 text-dd-text/90">
              This is provider model output, not a ground measurement, and it is not independently
              validated. We do not attribute the reading to a specific source (e.g. construction or
              landfill) without trajectory and ground-station evidence.
            </p>
          </div>
        </Card>
      ) : (
        <Card><p className="text-sm text-dd-muted">Live data unavailable for this coordinate.</p></Card>
      )}

      <Button variant="outline" onClick={() => setView("sources")}>
        <ExternalLink className="h-4 w-4" /> Data sources &amp; methodology
      </Button>
    </div>
  );
}

/* -------------------------------- Analytics -------------------------------- */
export function AnalyticsView() {
  const { stats, statsLoading, statsError, setView } = useDashboard();
  if (statsLoading) return <Skeleton className="h-80 w-full" />;
  if (statsError || !stats)
    return <Card><p className="text-sm text-dd-crit">Coverage statistics unavailable.</p></Card>;

  const cats = Object.entries(stats.by_category).sort((a, b) => b[1] - a[1]);
  const max = cats.length ? cats[0][1] : 1;
  const observedPct = stats.total_locations
    ? Math.round((stats.locations_with_observations / stats.total_locations) * 100)
    : 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <h1 className="flex items-center gap-2 text-xl font-bold text-dd-text">
        <BarChart3 className="h-5 w-5 text-dd-accent" /> Analytics
      </h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Locations indexed" value={stats.total_locations.toLocaleString("en-IN")} />
        <Stat label="With observations" value={stats.locations_with_observations.toLocaleString("en-IN")} />
        <Stat label="Model estimates" value="0" hint="No ML model deployed" />
        <Stat label="Cities / areas" value={String(stats.administrative_areas.length)} />
      </div>

      <Card className="space-y-2">
        <CardTitle>Environmental coverage</CardTitle>
        <Gauge value={observedPct} max={100} />
        <p className="text-sm text-dd-muted">
          {stats.locations_with_observations.toLocaleString("en-IN")} of{" "}
          {stats.total_locations.toLocaleString("en-IN")} indexed points ({observedPct}%) have a real
          pollution observation. The rest are geographic coverage only.
        </p>
      </Card>

      <Card className="space-y-3">
        <CardTitle>Locations by category</CardTitle>
        {cats.map(([cat, v]) => (
          <div key={cat} className="grid grid-cols-[150px_1fr_60px] items-center gap-2">
            <span className="truncate text-sm capitalize text-dd-text/90">{cat.replace(/_/g, " ")}</span>
            <Gauge value={v} max={max} color="var(--dd-accent2)" />
            <span className="text-right text-xs tabular-nums text-dd-muted">{v.toLocaleString("en-IN")}</span>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setView("sources")}>
          <ExternalLink className="h-3.5 w-3.5" /> Sources &amp; methodology
        </Button>
      </Card>
    </div>
  );
}

/* ------------------------------- Data sources ------------------------------ */
export function DataSourcesView() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <h1 className="flex items-center gap-2 text-xl font-bold text-dd-text">
        <Database className="h-5 w-5 text-dd-accent" /> Data sources &amp; methodology
      </h1>

      <Card className="space-y-2">
        <CardTitle>Providers actually used</CardTitle>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center justify-between">
            <span><strong>OpenStreetMap</strong> — locations, roads, POIs</span>
            <Badge tone="accent">ODbL · © OpenStreetMap contributors</Badge>
          </li>
          <li className="flex items-center justify-between">
            <span><strong>Open-Meteo</strong> — current air pollutants &amp; weather</span>
            <Badge tone="accent">CC BY 4.0 · keyless · model</Badge>
          </li>
          <li className="flex items-center justify-between">
            <span><strong>CPCB ground stations</strong> — ground monitoring network</span>
            <Badge tone="veryPoor">Not integrated</Badge>
          </li>
        </ul>
      </Card>

      <Card className="space-y-2">
        <CardTitle>Methodology</CardTitle>
        <ul className="list-inside list-disc space-y-1 text-sm text-dd-text/90">
          <li>AQI is the <strong>CPCB PM2.5 sub-index</strong> computed from PM2.5 with documented 24h breakpoints (not a ground-station index).</li>
          <li>Pollutant values (PM2.5, PM10, NO₂, SO₂, O₃, CO) are Open-Meteo current model output.</li>
          <li>No spatial heatmap or source-attribution model is deployed; the map shows real observation points and mapped POIs.</li>
        </ul>
      </Card>

      <Card className="space-y-2">
        <CardTitle>Limitations</CardTitle>
        <p className="text-sm text-dd-muted">
          Model output can differ from street-level conditions; most indexed points have no
          measurement; values are not validated against official monitors. Treat all figures as
          estimates with provider attribution, not certified readings.
        </p>
      </Card>
    </div>
  );
}

/* ---------------------------------- About ---------------------------------- */
export function AboutView() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 text-sm text-dd-text/90">
      <h1 className="flex items-center gap-2 text-xl font-bold text-dd-text">
        <Info className="h-5 w-5 text-dd-accent" /> About Dhuan Detective
      </h1>
      <p>
        Dhuan Detective is a Delhi NCR air-quality intelligence dashboard. It indexes a real,
        deduplicated set of {""}
        <strong>Delhi NCR locations</strong> from OpenStreetMap, shows {""}
        <strong>real current pollutant readings</strong> from Open-Meteo, and pairs them with a
        transparent, honestly-scoped analysis panel.
      </p>
      <div className="space-y-1">
        <p className="font-semibold text-dd-text">What is real today</p>
        <ul className="list-inside list-disc space-y-1 text-dd-muted">
          <li>Large indexed location dataset (neighbourhoods, schools, hospitals, metro, parks, landmarks, roads).</li>
          <li>Live multi-pollutant readings and weather for any coordinate.</li>
          <li>Ingested PM2.5 observations for a subset of locations.</li>
        </ul>
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-dd-text">Not available in this deployment</p>
        <ul className="list-inside list-disc space-y-1 text-dd-muted">
          <li>CPCB ground-station integration and validated attribution.</li>
          <li>Spatial heatmap / dispersion model.</li>
          <li>Accounts, persistent action tracking, and verification workflows.</li>
        </ul>
      </div>
      <p className="text-dd-muted">General information only — not medical or regulatory advice.</p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dd-border bg-dd-card p-3">
      <div className="text-2xl font-bold tabular-nums text-dd-text">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-dd-muted">{label}</div>
      {hint && <div className="text-[11px] text-dd-muted">{hint}</div>}
    </div>
  );
}
