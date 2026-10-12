"use client";

import { LineChart, TriangleAlert } from "lucide-react";
import { Badge, Card, CardTitle, Skeleton } from "@/components/ui";
import {
  bandOf,
  bandPrecision,
  bandStyle,
  bandToneFor,
  isUsableEstimate,
  relativeBandWidth,
} from "@/lib/model";
import { hrsAgo } from "@/lib/aq";
import type { ModelEstimate } from "@/lib/types";

/**
 * Presents a model estimate with its p10/p50/p90 band and the LOSO validation error.
 * Never shown as a measurement: it is labelled "Model estimate" everywhere.
 */
export function ModelEstimateCard({
  data,
  loading,
  unavailable,
}: {
  data: ModelEstimate | null;
  loading: boolean;
  unavailable: boolean;
}) {
  if (loading) return <Skeleton className="h-28 w-full" />;

  if (!data || unavailable || !isUsableEstimate(data)) {
    return (
      <Card className="space-y-1">
        <CardTitle className="flex items-center gap-1.5">
          <LineChart className="h-3.5 w-3.5 text-dd-warn" /> Model estimate
        </CardTitle>
        <p className="text-sm text-dd-muted">
          No validated model estimate is available for this area. The trained model only
          covers its observation grid, and estimates are not invented outside it.
        </p>
      </Card>
    );
  }

  const p50 = data.pm25_p50 as number;
  const style = bandStyle(bandOf(p50));
  const width = relativeBandWidth(data.pm25_p50, data.pm25_p10, data.pm25_p90);
  const precision = bandPrecision(width);
  const rmse = data.los_validation?.rmse;

  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-1.5">
          <LineChart className="h-3.5 w-3.5 text-dd-purple" /> Model estimate
        </CardTitle>
        <Badge tone={bandToneFor(p50)}>{style.label}</Badge>
      </div>

      <div className="flex items-end gap-3">
        <span className="text-4xl font-bold tabular-nums" style={{ color: style.color }}>
          {Math.round(p50)}
        </span>
        <div className="pb-1 text-xs text-dd-muted">
          <div>
            p10 {data.pm25_p10 ?? "—"} · p50 {data.pm25_p50 ?? "—"} · p90 {data.pm25_p90 ?? "—"} µg/m³
          </div>
          <div>
            {precision} band{width != null ? ` (±${Math.round(width * 100)}%)` : ""} · {data.method}
          </div>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-dd-muted">
        {rmse != null
          ? `Validated by leave-one-location-out: RMSE ${rmse} µg/m³ (n=${data.los_validation?.n_samples ?? 0}).`
          : "No validation error reported."}{" "}
        {data.reference_timestamp ? `Observations from ${hrsAgo(data.reference_timestamp)}.` : ""}
      </p>

      <p className="flex items-start gap-1.5 text-[11px] text-dd-warn">
        <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
        Model estimate with an empirical uncertainty band — interpolated from real observations.
        Not a measurement.
      </p>
      <p className="text-[10px] text-dd-muted">{data.provenance}</p>
    </Card>
  );
}

