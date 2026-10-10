import { Badge, Card, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { formatPM25, categoryOf, type AqiBand } from "@/lib/utils";
import type { EstimateResponse } from "@/lib/types";

const BAND_LABEL: Record<AqiBand, string> = {
  good: "Good",
  moderate: "Moderate",
  poor: "Poor",
  veryPoor: "Very Poor",
  severe: "Severe",
};

const BAND_TONE: Record<AqiBand, "good" | "moderate" | "poor" | "veryPoor" | "severe"> = {
  good: "good",
  moderate: "moderate",
  poor: "poor",
  veryPoor: "veryPoor",
  severe: "severe",
};

const BAND_TEXT: Record<AqiBand, string> = {
  good: "text-aqi-good",
  moderate: "text-aqi-moderate",
  poor: "text-aqi-poor",
  veryPoor: "text-aqi-veryPoor",
  severe: "text-aqi-severe",
};

export function EstimateCard({ data, loading }: { data: EstimateResponse; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Estimated PM2.5</CardTitle>
        </CardHeader>
        <Skeleton className="h-12 w-40" />
        <Skeleton className="mt-3 h-4 w-56" />
      </Card>
    );
  }

  const band = categoryOf(data.pm25_p50);
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Estimated PM2.5</CardTitle>
        <Badge tone={BAND_TONE[band]}>{BAND_LABEL[band]}</Badge>
      </CardHeader>
      <div className="flex items-end gap-2">
        <span className={`text-5xl font-bold tabular-nums ${BAND_TEXT[band]}`}>
          {formatPM25(data.pm25_p50)}
        </span>
        <span className="pb-2 text-sm text-slate-500">µg/m³</span>
      </div>
      {data.nearest_station && (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Nearest station: <span className="font-medium">{data.nearest_station.name}</span> ·{" "}
          {data.nearest_station.distance_km} km away · reading {formatPM25(data.nearest_station.pm25)}
        </p>
      )}
    </Card>
  );
}
