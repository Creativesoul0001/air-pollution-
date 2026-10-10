"use client";

import { ShieldAlert, RefreshCw, ExternalLink } from "lucide-react";
import { useDashboard } from "@/lib/dashboard";
import { resolveStatus, statusLabel, hrsAgo, isStale, type DataStatus } from "@/lib/aq";
import { Badge, Button } from "@/components/ui";

const TONE: Record<DataStatus, "good" | "accent" | "moderate" | "veryPoor"> = {
  live_observation: "good",
  cached_observation: "accent",
  model_estimate: "accent",
  development_fixture: "moderate",
  unavailable: "veryPoor",
};

export function DataAccuracyCard() {
  const { air, detail, setView, refresh } = useDashboard();
  const status = resolveStatus({ air: !!air, ingested: !!detail?.latest_observation });
  const time = air?.time ?? detail?.latest_observation?.observed_at ?? null;
  const provider = air?.provider ?? (detail?.latest_observation?.source ?? null);

  return (
    <div className="rounded-2xl border border-dd-border bg-dd-card p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-dd-muted">
          <ShieldAlert className="h-4 w-4 text-dd-warn" /> Data accuracy &amp; provenance
        </span>
        <Badge tone={TONE[status]}>{statusLabel(status)}</Badge>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-dd-muted">Provider</dt>
          <dd className="font-medium">{provider ?? "Unavailable"}</dd>
        </div>
        <div>
          <dt className="text-dd-muted">Timestamp</dt>
          <dd className="font-medium">
            {time ? new Date(time).toLocaleString() : "Unavailable"} {time && <span className="text-dd-muted">({hrsAgo(time)})</span>}
          </dd>
        </div>
        <div>
          <dt className="text-dd-muted">Freshness</dt>
          <dd className="font-medium">
            {!air ? "Unavailable" : isStale(time, 90) ? "Stale (>90 min)" : "Current"}
          </dd>
        </div>
        <div>
          <dt className="text-dd-muted">Validation</dt>
          <dd className="font-medium text-dd-warn">Not validated vs CPCB ground stations</dd>
        </div>
      </dl>

      <p className="mt-3 text-xs leading-relaxed text-dd-muted">
        Values are provider model output (live assimilation) or ingested readings, not ground
        monitoring stations. Geographic coverage does not imply environmental coverage — many
        indexed points have no measurement. See methodology &amp; sources.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={refresh}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setView("sources")}>
          <ExternalLink className="h-3.5 w-3.5" /> Methodology &amp; sources
        </Button>
      </div>
    </div>
  );
}
