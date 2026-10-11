"use client";

import { useState } from "react";
import {
  Radio,
  GitBranch,
  CheckSquare,
  HeartPulse,
  RefreshCw,
  Baby,
  Bike,
  HardHat,
  TriangleAlert,
  Wind as WindIcon,
} from "lucide-react";
import { useDashboard } from "@/lib/dashboard";
import { POLLUTANTS, aqiFromPm25, pollutantMeta, windDirToCompass, hrsAgo } from "@/lib/aq";
import { Badge, Button, Card, CardTitle, Gauge, Skeleton, Tabs } from "@/components/ui";
import { DataAccuracyCard } from "./DataAccuracyCard";
import { useStations } from "@/hooks/useStations";

type Tab = "live" | "sources" | "actions" | "advice";

const PMAX: Record<string, number> = {
  pm2_5: 250, pm10: 430, no2: 200, so2: 200, o3: 240, co: 10000,
};

function ActionsForBand({ band }: { band: string }) {
  const map: Record<string, string[]> = {
    good: ["Normal outdoor activity is fine."],
    moderate: ["Sensitive groups: consider limiting prolonged outdoor exertion."],
    poor: ["Reduce prolonged outdoor exertion; keep windows closed during peak."],
    veryPoor: ["Avoid outdoor activity where possible; wear an N95 if unavoidable."],
    severe: ["Stay indoors; use air purification if available; seek care if unwell."],
  };
  return (
    <ul className="space-y-2">
      {(map[band] ?? map.moderate).map((a) => (
        <li key={a} className="flex items-start gap-2 text-sm">
          <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-dd-accent" />
          {a}
        </li>
      ))}
    </ul>
  );
}

export function LocationPanel() {
  const { selected, coord, air, weather, detail, loadingAir, loadingWeather, errorAir, errorWeather, refresh, setView } =
    useDashboard();
  const [tab, setTab] = useState<Tab>("live");

  const pm25 = air?.pollutants?.pm2_5 ?? null;
  const aqi = pm25 != null ? aqiFromPm25(pm25) : null;
  const { data: ground, loading: groundLoading } = useStations(coord.lat, coord.lon);

  return (
    <Card className="flex h-auto min-h-0 flex-col !p-0 lg:h-full">
      {/* Header */}
      <div className="border-b border-dd-border p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-dd-text" data-testid="panel-location-name">
              {selected?.name ?? "Selected coordinate"}
            </h2>
            <p className="text-xs text-dd-muted">
              {selected?.city ? `${selected.city} · ` : ""}
              {selected?.category ? `${selected.category.replace(/_/g, " ")} · ` : ""}
              {coord.lat.toFixed(5)}, {coord.lon.toFixed(5)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {aqi && <Badge tone={aqi.tone}>{aqi.label}</Badge>}
            <Button size="sm" variant="ghost" onClick={refresh} aria-label="Refresh data">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-3">
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            items={[
              { value: "live", label: "Live Data", icon: <Radio className="h-3.5 w-3.5" /> },
              { value: "sources", label: "Sources", icon: <GitBranch className="h-3.5 w-3.5" /> },
              { value: "actions", label: "Actions", icon: <CheckSquare className="h-3.5 w-3.5" /> },
              { value: "advice", label: "Advice", icon: <HeartPulse className="h-3.5 w-3.5" /> },
            ]}
          />
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {tab === "live" && (
          <>
            {loadingAir ? (
              <Skeleton className="h-40 w-full" />
            ) : errorAir || !air || pm25 == null ? (
              <div className="rounded-xl border border-dd-crit/40 bg-dd-crit/10 p-4 text-sm">
                <p className="flex items-center gap-2 font-medium text-dd-crit">
                  <TriangleAlert className="h-4 w-4" /> Live air data unavailable
                </p>
                <p className="mt-1 text-dd-muted">
                  The air-quality provider could not be reached for this coordinate.
                </p>
                <Button size="sm" variant="outline" className="mt-2" onClick={refresh}>
                  Retry
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-bold tabular-nums" style={{ color: aqi!.color }}>
                    {aqi!.subIndex}
                  </span>
                  <div className="pb-1.5">
                    <div className="text-sm text-dd-muted">AQI (CPCB PM2.5 sub-index)</div>
                    <div className="text-2xl font-semibold">
                      {Math.round(pm25)} <span className="text-sm text-dd-muted">µg/m³ PM2.5</span>
                    </div>
                  </div>
                </div>

                <div>
                  <CardTitle className="mb-2">Pollutant breakdown</CardTitle>
                  <div className="space-y-2.5">
                    {POLLUTANTS.map((p) => {
                      const v = air.pollutants?.[p.key];
                      const meta = pollutantMeta(p.key);
                      return (
                        <div key={p.key} className="grid grid-cols-[64px_1fr_56px] items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: meta.color }}>{p.label}</span>
                          <Gauge value={v ?? 0} max={PMAX[p.key] ?? 300} color={meta.color} />
                          <span className="text-right text-xs tabular-nums text-dd-muted">
                            {v == null ? "—" : `${Math.round(v)}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <CardTitle className="mb-2 flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5 text-dd-accent2" /> Ground monitoring
                  </CardTitle>
                  {groundLoading ? (
                    <Skeleton className="h-12 w-full" />
                  ) : ground?.status === "ok" ? (
                    <ul className="space-y-1.5 text-xs">
                      {ground.stations.map((s, i) => (
                        <li key={i} className="rounded-lg border border-dd-border p-2">
                          <div className="flex items-center justify-between">
                            <strong className="text-dd-text">{s.station}</strong>
                            <Badge tone="good">Ground</Badge>
                          </div>
                          <p className="text-dd-muted">
                            {s.network} · {s.distance_km.toFixed(2)} km ·{" "}
                            {s.timestamp ? new Date(s.timestamp).toLocaleString() : "time n/a"}
                          </p>
                          <div className="mt-0.5 flex flex-wrap gap-2">
                            {s.readings.map((r) => (
                              <span key={r.pollutant} className="tabular-nums">
                                {r.pollutant.toUpperCase()} <strong>{r.value}</strong> {r.unit}
                              </span>
                            ))}
                          </div>
                          <p className="mt-0.5 text-[10px] text-dd-muted">Provenance: {s.provenance.source}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-dd-muted">
                      No ground station readings reachable — the values above are model estimates,
                      not monitoring measurements.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-dd-border p-3">
                    <div className="text-xs text-dd-muted">Updated</div>
                    <div className="text-sm font-medium">
                      {air.time ? new Date(air.time).toLocaleTimeString() : "—"}{" "}
                      <span className="text-dd-muted">({hrsAgo(air.time)})</span>
                    </div>
                    <div className="mt-1 text-[11px] text-dd-muted">{air.provider}</div>
                  </div>
                  <div className="rounded-xl border border-dd-border p-3">
                    <div className="flex items-center gap-1 text-xs text-dd-muted">
                      <WindIcon className="h-3.5 w-3.5 text-dd-warn" /> Wind
                    </div>
                    {loadingWeather ? (
                      <Skeleton className="mt-1 h-6 w-20" />
                    ) : errorWeather || !weather ? (
                      <div className="text-sm text-dd-muted">Unavailable</div>
                    ) : (
                      <div className="text-sm font-medium">
                        {weather.wind_speed_kmh != null ? `${Math.round(weather.wind_speed_kmh)} km/h` : "—"}
                        {weather.wind_direction_deg != null && (
                          <span className="text-dd-muted">
                            {" "}
                            {Math.round(weather.wind_direction_deg)}° {windDirToCompass(weather.wind_direction_deg)}
                          </span>
                        )}
                        {weather.humidity_pct != null && (
                          <div className="text-[11px] text-dd-muted">Humidity {Math.round(weather.humidity_pct)}%</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {detail?.latest_observation && (
                  <div className="rounded-xl border border-dd-accent/30 bg-dd-accent/5 p-3 text-sm">
                    <div className="text-xs font-semibold uppercase text-dd-accent">Ingested observation</div>
                    <div>
                      PM2.5 <strong className="tabular-nums">{detail.latest_observation.value.toFixed(1)}</strong> µg/m³ ·
                      source {detail.latest_observation.source} · {detail.latest_observation.observed_at}
                    </div>
                  </div>
                )}
              </>
            )}

            <DataAccuracyCard />
          </>
        )}

        {tab === "sources" && (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-dd-warn/30 bg-dd-warn/10 p-3 text-dd-warn">
              <p className="flex items-center gap-2 font-medium">
                <TriangleAlert className="h-4 w-4" /> Source attribution unavailable
              </p>
              <p className="mt-1 text-dd-text/90">
                This deployment does not include a validated source-attribution model or CPCB
                ground stations, so we cannot identify which nearby source caused the current
                reading — and we will not claim otherwise without evidence.
              </p>
            </div>
            <p className="text-dd-muted">What a rigorous version would add:</p>
            <ul className="list-inside list-disc space-y-1 text-dd-muted">
              <li>Upwind geometry over a mapped source database (landfills, construction, kilns).</li>
              <li>Trajectory / dispersion evidence, not just proximity.</li>
              <li>Ground-station measurements to attribute against.</li>
            </ul>
            <Button size="sm" variant="outline" onClick={() => setView("sources")}>
              View data sources &amp; methodology
            </Button>
          </div>
        )}

        {tab === "actions" && (
          <div className="space-y-3">
            <CardTitle>Recommended actions</CardTitle>
            {aqi ? <ActionsForBand band={aqi.band} /> : <p className="text-sm text-dd-muted">Unavailable without a current reading.</p>}
            <p className="text-xs text-dd-muted">
              Persistent action tracking and verification are not available in this deployment.
            </p>
          </div>
        )}

        {tab === "advice" && (
          <div className="space-y-3">
            <CardTitle>Guidance</CardTitle>
            {aqi ? (
              <div className="grid gap-2 sm:grid-cols-1">
                <AdviceCard icon={<Baby className="h-4 w-4 text-dd-accent2" />} title="Parents">
                  Air is <strong style={{ color: aqi.color }}>{aqi.label}</strong>. Limit children&apos;s
                  outdoor play during peak hours and keep indoor air clean.
                </AdviceCard>
                <AdviceCard icon={<Bike className="h-4 w-4 text-dd-purple" />} title="Riders / commuters">
                  Prefer covered or lower-exposure routes this hour. A lower-estimated route is not
                  guaranteed safe.
                </AdviceCard>
                <AdviceCard icon={<HardHat className="h-4 w-4 text-dd-warn" />} title="Outdoor workers">
                  Take shaded breaks and use a well-fitting respirator if exposure is unavoidable.
                </AdviceCard>
              </div>
            ) : (
              <p className="text-sm text-dd-muted">Guidance unavailable without a current reading.</p>
            )}
            <p className="text-xs text-dd-muted">
              General guidance only — not medical advice.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function AdviceCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dd-border p-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-dd-elev">{icon}</span>
      <div>
        <div className="text-sm font-semibold text-dd-text">{title}</div>
        <p className="text-sm text-dd-text/90">{children}</p>
      </div>
    </div>
  );
}
