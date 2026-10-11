"use client";

import { useState } from "react";
import {
  Search,
  BarChart3,
  Database,
  Info,
  ExternalLink,
  TriangleAlert,
  Activity,
  Radar,
  Radio,
  CheckSquare,
  UserPlus,
  GitBranch,
} from "lucide-react";
import { useDashboard } from "@/lib/dashboard";
import { aqiFromPm25, windDirToCompass, hrsAgo } from "@/lib/aq";
import { useInvestigation } from "@/hooks/useInvestigation";
import { useStations } from "@/hooks/useStations";
import { useActions } from "@/hooks/useActions";
import { HypothesisCard, ranked } from "@/components/panels/HypothesisCard";
import { summariseHypotheses } from "@/lib/investigate";
import { canTransition, isTerminal, statusLabel, statusTone, verificationDelta } from "@/lib/actions";
import { Badge, Button, Card, CardTitle, Gauge, Skeleton } from "@/components/ui";

/* ------------------------------- Investigate ------------------------------- */
export function InvestigateView() {
  const { selected, coord, air, weather, setView } = useDashboard();
  const { data, loading, error, refresh } = useInvestigation(coord.lat, coord.lon);
  const { data: ground, loading: groundLoading } = useStations(coord.lat, coord.lon);
  const pm25 = air?.pollutants?.pm2_5 ?? null;
  const aqi = pm25 != null ? aqiFromPm25(pm25) : null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-dd-text">
            <Search className="h-5 w-5 text-dd-accent" /> Investigate
          </h1>
          <p className="text-sm text-dd-muted">
            {selected?.name ?? "Selected coordinate"} · {coord.lat.toFixed(5)}, {coord.lon.toFixed(5)}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={refresh}>
          <Radar className="h-3.5 w-3.5" /> Re-run investigation
        </Button>
      </div>

      {aqi && (
        <Card className="space-y-2">
          <div className="flex items-center gap-4">
            <span className="text-4xl font-bold tabular-nums" style={{ color: aqi.color }}>
              {aqi.subIndex}
            </span>
            <div>
              <div className="text-sm text-dd-muted">AQI (CPCB PM2.5 sub-index, model-based)</div>
              <Badge tone={aqi.tone}>
                {Math.round(pm25!)} µg/m³ PM2.5 · {aqi.label}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-dd-muted">
            Wind:{" "}
            {weather?.wind_speed_kmh != null && weather.wind_direction_deg != null
              ? `${Math.round(weather.wind_speed_kmh)} km/h from ${Math.round(
                  weather.wind_direction_deg
                )}° ${windDirToCompass(weather.wind_direction_deg)}`
              : "unavailable"}
          </p>
        </Card>
      )}

      {/* Ground monitoring */}
      <Card className="space-y-2">
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-dd-accent2" /> Ground monitoring stations
        </CardTitle>
        {groundLoading ? (
          <Skeleton className="h-14 w-full" />
        ) : ground?.status === "ok" ? (
          <ul className="space-y-2 text-sm">
            {ground.stations.map((s, i) => (
              <li key={i} className="rounded-xl border border-dd-border p-3">
                <div className="flex items-center justify-between">
                  <strong>{s.station}</strong>
                  <Badge tone="good">Ground measurement</Badge>
                </div>
                <p className="text-xs text-dd-muted">
                  {s.network} · {s.distance_km.toFixed(2)} km · {s.timestamp ? hrsAgo(s.timestamp) : "time n/a"}
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {s.readings.map((r) => (
                    <span key={r.pollutant} className="text-xs">
                      {r.pollutant.toUpperCase()}:{" "}
                      <strong className="tabular-nums">{r.value}</strong> {r.unit}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-dd-muted">Provenance: {s.provenance.source}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-dd-muted">
            No ground monitoring readings reachable. Reason:{" "}
            {(ground?.attempts ?? []).join("; ") || "unknown"}.{" "}
            {ground?.note ?? "Model estimates are reported separately and never labelled as station data."}
          </p>
        )}
      </Card>

      {/* Hypotheses */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-dd-purple" /> Ranked hypotheses
          </CardTitle>
          {data && (
            <span className="text-[11px] text-dd-muted">
              {summariseHypotheses(
                data.hypotheses.length,
                data.hypotheses[0]?.confidence ?? null
              )}
            </span>
          )}
        </div>

        {loading && <Skeleton className="h-28 w-full" />}
        {error && (
          <p className="text-sm text-dd-crit">Investigation backend unavailable: {error}</p>
        )}
        {!loading && data?.status === "unavailable" && (
          <div className="rounded-xl border border-dd-warn/30 bg-dd-warn/10 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-dd-warn">
              <TriangleAlert className="h-4 w-4" /> Source attribution unavailable
            </p>
            <ul className="mt-1 list-inside list-disc text-dd-text/90">
              {data.unavailable_reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {!loading &&
          data?.status === "ok" &&
          ranked(data.hypotheses).map((h) => (
            <HypothesisCard key={`${h.source.osm_type}/${h.source.osm_id}`} h={h} />
          ))}

        {data?.sources_provenance && (
          <p className="text-[11px] text-dd-muted">Source data: {data.sources_provenance}</p>
        )}
        {data?.model_context && (
          <p className="text-[11px] text-dd-muted">
            Model context (separate from ground data): {data.model_context.provider} ·{" "}
            {data.model_context.time}
          </p>
        )}
      </Card>

      <div className="rounded-xl border border-dd-warn/30 bg-dd-warn/10 p-3 text-xs text-dd-warn">
        <TriangleAlert className="mr-1 inline h-3.5 w-3.5" /> {data?.caution}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setView("actions")}>
          <CheckSquare className="h-4 w-4" /> Create an action for this area
        </Button>
        <Button variant="ghost" onClick={() => setView("sources")}>
          <ExternalLink className="h-4 w-4" /> Methodology
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------- Actions -------------------------------- */
export function ActionsView() {
  const { selected, coord } = useDashboard();
  const {
    items,
    total,
    loading,
    error,
    busy,
    actionError,
    detail,
    detailLoading,
    create,
    transition,
    assign,
    verify,
    loadDetail,
    clearError,
  } = useActions();
  const [actor, setActor] = useState("dhuan-web-user");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [assignee, setAssignee] = useState("");
  const [verifyForm, setVerifyForm] = useState({
    pollutant: "pm2_5",
    units: "µg/m³",
    before_value: "",
    before_time: "",
    before_provenance: "",
    after_value: "",
    after_time: "",
    after_provenance: "",
    note: "",
  });

  const submitCreate = async () => {
    const created = await create(
      {
        title,
        description: description || undefined,
        category,
        location_name: selected?.name ?? "Selected coordinate",
        lat: coord.lat,
        lon: coord.lon,
        source_osm_id: selected ? `${selected.category}/${selected.id}` : undefined,
      },
      actor
    );
    if (created) {
      setTitle("");
      setDescription("");
    }
  };

  const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));

  const submitVerify = async () => {
    if (!detail) return;
    await verify(
      detail.id,
      {
        pollutant: verifyForm.pollutant,
        units: verifyForm.units,
        before_value: num(verifyForm.before_value),
        before_time: verifyForm.before_time || undefined,
        before_provenance: verifyForm.before_provenance || undefined,
        after_value: num(verifyForm.after_value),
        after_time: verifyForm.after_time || undefined,
        after_provenance: verifyForm.after_provenance || undefined,
        note: verifyForm.note || undefined,
      },
      actor
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-dd-text">
          <CheckSquare className="h-5 w-5 text-dd-accent" /> Actions
        </h1>
        <p className="text-sm text-dd-muted">
          Persistent remediation records with authorized status transitions, assignment, audit
          history and before/after verification.
        </p>
      </div>

      <Card className="space-y-3">
        <CardTitle>Create an action</CardTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-dd-muted">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              minLength={3}
              placeholder="e.g. Inspect dust control at the site"
              className="mt-1 h-10 w-full rounded-lg border border-dd-border bg-dd-bg px-3 text-sm text-dd-text"
            />
          </label>
          <label className="text-xs text-dd-muted">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-dd-border bg-dd-bg px-3 text-sm text-dd-text"
            >
              <option value="general">General</option>
              <option value="construction">Construction dust</option>
              <option value="landfill">Landfill / burning</option>
              <option value="traffic">Traffic</option>
            </select>
          </label>
          <label className="text-xs text-dd-muted sm:col-span-2">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-dd-border bg-dd-bg px-3 py-2 text-sm text-dd-text"
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-dd-muted">
            Signed as
            <input
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              className="ml-2 h-9 w-48 rounded-lg border border-dd-border bg-dd-bg px-3 text-sm text-dd-text"
            />
          </label>
          <span className="text-[11px] text-dd-muted">
            demo identity only — full Cognito authorization is not wired in this build
          </span>
        </div>
        <Button onClick={submitCreate} disabled={busy || title.trim().length < 3}>
          <CheckSquare className="h-4 w-4" /> Create action
        </Button>
      </Card>

      {actionError && (
        <div className="rounded-xl border border-dd-crit/40 bg-dd-crit/10 p-3 text-sm">
          <p className="font-medium text-dd-crit">{actionError.message}</p>
          {actionError.allowed && (
            <p className="text-dd-muted">Allowed now: {actionError.allowed.join(", ") || "none"}</p>
          )}
          <Button size="sm" variant="ghost" className="mt-1" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2">
          <CardTitle>
            Records ({total})
          </CardTitle>
          {loading && <Skeleton className="h-24 w-full" />}
          {error && <p className="text-sm text-dd-crit">Could not load actions: {error}</p>}
          {!loading && items.length === 0 && (
            <p className="text-sm text-dd-muted">
              No actions yet. Create one to track a remediation and verify its impact.
            </p>
          )}
          <ul className="space-y-1.5">
            {items.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => loadDetail(a.id)}
                  className="flex w-full items-center gap-2 rounded-xl border border-dd-border p-2.5 text-left hover:bg-dd-elev"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-dd-text">{a.title}</span>
                    <span className="text-[11px] text-dd-muted">
                      #{a.id} · {a.location_name ?? "no location"} · by {a.created_by}
                    </span>
                  </span>
                  <Badge tone={statusTone(a.status)}>{statusLabel(a.status)}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-3">
          <CardTitle>Detail</CardTitle>
          {detailLoading && <Skeleton className="h-32 w-full" />}
          {!detailLoading && !detail && (
            <p className="text-sm text-dd-muted">Select an action to view its history.</p>
          )}
          {detail && (
            <>
              <div>
                <h3 className="font-semibold text-dd-text">{detail.title}</h3>
                <p className="text-xs text-dd-muted">
                  {detail.description || "no description"} · {detail.location_name ?? "no location"} ·
                  assignee: {detail.assignee ?? "unassigned"}
                </p>
                <div className="mt-1">
                  <Badge tone={statusTone(detail.status)}>{statusLabel(detail.status)}</Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {detail.allowed_transitions.length === 0 && (
                  <span className="text-[11px] text-dd-muted">Terminal status — no further transitions.</span>
                )}
                {detail.allowed_transitions.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={canTransition(detail.status, s) ? "outline" : "ghost"}
                    disabled={busy || !canTransition(detail.status, s) || isTerminal(detail.status)}
                    onClick={() => transition(detail.id, s, actor)}
                  >
                    → {statusLabel(s)}
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="assign to team / person"
                  className="h-9 flex-1 rounded-lg border border-dd-border bg-dd-bg px-3 text-sm text-dd-text"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || assignee.trim() === ""}
                  onClick={() => detail && assign(detail.id, assignee.trim(), actor)}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Assign
                </Button>
              </div>

              <div className="space-y-2 rounded-xl border border-dd-border p-3">
                <p className="text-xs font-semibold uppercase text-dd-muted">
                  Verify impact (before / after)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={verifyForm.before_value}
                    onChange={(e) => setVerifyForm({ ...verifyForm, before_value: e.target.value })}
                    placeholder="before value"
                    inputMode="decimal"
                    className="h-9 rounded-lg border border-dd-border bg-dd-bg px-2 text-sm text-dd-text"
                  />
                  <input
                    value={verifyForm.after_value}
                    onChange={(e) => setVerifyForm({ ...verifyForm, after_value: e.target.value })}
                    placeholder="after value"
                    inputMode="decimal"
                    className="h-9 rounded-lg border border-dd-border bg-dd-bg px-2 text-sm text-dd-text"
                  />
                  <input
                    value={verifyForm.before_provenance}
                    onChange={(e) => setVerifyForm({ ...verifyForm, before_provenance: e.target.value })}
                    placeholder="before provenance (station/source)"
                    className="h-9 rounded-lg border border-dd-border bg-dd-bg px-2 text-xs text-dd-text"
                  />
                  <input
                    value={verifyForm.after_provenance}
                    onChange={(e) => setVerifyForm({ ...verifyForm, after_provenance: e.target.value })}
                    placeholder="after provenance (station/source)"
                    className="h-9 rounded-lg border border-dd-border bg-dd-bg px-2 text-xs text-dd-text"
                  />
                </div>
                <Button size="sm" onClick={submitVerify} disabled={busy}>
                  <Activity className="h-3.5 w-3.5" /> Record verification
                </Button>
                <p className="text-[11px] text-dd-muted">
                  A delta is only computed when both measurements and their provenance are
                  supplied; otherwise the result is reported as insufficient evidence.
                </p>
              </div>

              {detail.verifications && detail.verifications.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase text-dd-muted">Verifications</p>
                  {detail.verifications.map((v) => {
                    const d = verificationDelta(v);
                    return (
                      <div key={v.id} className="rounded-lg border border-dd-border p-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge tone={d.defensible ? "good" : "moderate"}>
                            {d.defensible ? "Measured delta" : "Insufficient evidence"}
                          </Badge>
                          <span className="uppercase">{v.pollutant}</span>
                        </div>
                        <p className="mt-1 text-dd-muted">
                          before {v.before.value ?? "—"} → after {v.after.value ?? "—"}
                          {d.defensible && (
                            <>
                              {" "}
                              · delta <strong className="tabular-nums">{d.delta}</strong> ({d.pct}%)
                            </>
                          )}
                        </p>
                        <p className="text-[11px] text-dd-muted">{v.evidence_note}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase text-dd-muted">Audit history</p>
                <ol className="space-y-1">
                  {(detail.events ?? []).map((e) => (
                    <li key={e.id} className="text-[11px] text-dd-muted">
                      <span className="text-dd-text">{e.event_type}</span> · {e.actor} ·{" "}
                      {e.from_status ? `${e.from_status} → ${e.to_status}` : e.to_status} ·{" "}
                      {e.created_at ? hrsAgo(e.created_at) : ""}
                      {e.note ? ` · ${e.note}` : ""}
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </Card>
      </div>
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
function GroundStatusCard() {
  const { coord } = useDashboard();
  const { data, loading, refresh } = useStations(coord.lat, coord.lon);
  return (
    <Card className="space-y-2">
      <CardTitle className="flex items-center justify-between">
        <span>Ground monitoring — live status</span>
        <Button size="sm" variant="ghost" onClick={refresh}>
          <Radio className="h-3.5 w-3.5" /> Check
        </Button>
      </CardTitle>
      {loading && <Skeleton className="h-16 w-full" />}
      {!loading && data?.status === "ok" && (
        <p className="text-sm text-dd-accent">
          {data.count} ground station reading(s) reachable for the current area.
        </p>
      )}
      {!loading && data?.status === "unavailable" && (
        <div className="text-sm">
          <p className="font-medium text-dd-warn">No ground readings reachable</p>
          <ul className="mt-1 list-inside list-disc text-dd-muted">
            {(data.attempts ?? []).map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p className="mt-1 text-dd-muted">
            Verified from this environment: CPCB portals are unreachable; WAQI/OpenAQ require a
            token; Sensor.Community is open but currently has no sensors in India.
          </p>
        </div>
      )}
    </Card>
  );
}

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
            <span><strong>OpenStreetMap</strong> — locations, roads, POIs, mapped sources</span>
            <Badge tone="accent">ODbL · © OpenStreetMap contributors</Badge>
          </li>
          <li className="flex items-center justify-between">
            <span><strong>Open-Meteo</strong> — current air pollutants &amp; wind (model)</span>
            <Badge tone="accent">CC BY 4.0 · keyless · model</Badge>
          </li>
          <li className="flex items-center justify-between">
            <span><strong>Sensor.Community</strong> — open ground sensors (India: none)</span>
            <Badge tone="veryPoor">Open · no India sensors</Badge>
          </li>
          <li className="flex items-center justify-between">
            <span><strong>CPCB / WAQI</strong> — official ground station feeds</span>
            <Badge tone="veryPoor">Needs credentials</Badge>
          </li>
        </ul>
      </Card>

      <GroundStatusCard />

      <Card className="space-y-2">
        <CardTitle>Methodology</CardTitle>
        <ul className="list-inside list-disc space-y-1 text-sm text-dd-text/90">
          <li>AQI is the <strong>CPCB PM2.5 sub-index</strong> computed from PM2.5 with documented 24h breakpoints.</li>
          <li>Pollutant values (PM2.5, PM10, NO₂, SO₂, O₃, CO) are Open-Meteo current model output — always labelled as model, never as a station reading.</li>
          <li>Investigation ranks <em>mapped</em> sources by distance and upwind alignment with real wind; it reports supporting and contradicting evidence and never claims causation.</li>
          <li>No validated spatial heatmap or dispersion model is deployed.</li>
        </ul>
      </Card>

      <Card className="space-y-2">
        <CardTitle>Limitations</CardTitle>
        <p className="text-sm text-dd-muted">
          Ground monitoring is not reachable without credentials, so attribution relies on OSM
          geometry plus wind. Model output can differ from street-level conditions; most indexed
          points have no measurement; values are not validated against official monitors.
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
        deduplicated set of <strong>Delhi NCR locations</strong> from OpenStreetMap, shows{" "}
        <strong>real current pollutant readings</strong> from Open-Meteo, runs an{" "}
        <strong>evidence-based source investigation</strong>, and provides{" "}
        <strong>persistent action tracking</strong> with verification.
      </p>
      <div className="space-y-1">
        <p className="font-semibold text-dd-text">Implemented and verified</p>
        <ul className="list-inside list-disc space-y-1 text-dd-muted">
          <li>{""}Real indexed location dataset and search.</li>
          <li>Live multi-pollutant + wind readings for any coordinate (model, labelled).</li>
          <li>Evidence-based ranked hypotheses with supporting/contradicting evidence.</li>
          <li>Action records with authorized transitions, assignment, audit history and
            before/after verification.</li>
        </ul>
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-dd-text">Still requires credentials or external access</p>
        <ul className="list-inside list-disc space-y-1 text-dd-muted">
          <li>CPCB / WAQI ground-station readings (token required; verified unreachable here).</li>
          <li>Validated spatial risk map / dispersion model.</li>
          <li>Full Cognito authentication (X-Actor is currently a demo identity).</li>
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
