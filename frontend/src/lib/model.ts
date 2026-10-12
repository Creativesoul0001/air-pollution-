import type { ModelEstimate, ModelInfo } from "@/lib/types";

export type Band = "good" | "moderate" | "poor" | "veryPoor" | "severe";

const BAND_STYLE: Record<Band, { label: string; color: string; tone: "good" | "moderate" | "poor" | "veryPoor" | "severe" }> = {
  good: { label: "Good", color: "var(--dd-accent)", tone: "good" },
  moderate: { label: "Moderate", color: "var(--dd-warn)", tone: "moderate" },
  poor: { label: "Poor", color: "#fb923c", tone: "poor" },
  veryPoor: { label: "Very Poor", color: "var(--dd-crit)", tone: "veryPoor" },
  severe: { label: "Severe", color: "#b91c1c", tone: "severe" },
};

/** CPCB PM2.5 24h banding (matching the backend's AQI sub-index breakpoints). */
export function bandOf(pm25: number): Band {
  if (pm25 <= 30) return "good";
  if (pm25 <= 60) return "moderate";
  if (pm25 <= 90) return "poor";
  if (pm25 <= 120) return "veryPoor";
  return "severe";
}

export function bandStyle(band: Band) {
  return BAND_STYLE[band];
}

export function bandToneFor(pm25: number) {
  return BAND_STYLE[bandOf(pm25)].tone;
}

/** Relative half-width of the uncertainty band, used to colour confidence in the UI. */
export function relativeBandWidth(p50: number | null, p10: number | null, p90: number | null): number | null {
  if (p50 == null || p10 == null || p90 == null || p50 <= 0) return null;
  return (p90 - p10) / p50;
}

export function bandPrecision(width: number | null): "narrow" | "moderate" | "wide" {
  if (width == null) return "moderate";
  if (width < 0.25) return "narrow";
  if (width < 0.6) return "moderate";
  return "wide";
}

/** A model estimate is only presented when it has a defensible p50 AND a validation error. */
export function isUsableEstimate(estimate: ModelEstimate | null): boolean {
  if (!estimate) return false;
  if (estimate.pm25_p50 == null) return false;
  const rmse = estimate.los_validation?.rmse;
  return rmse != null && Number.isFinite(rmse);
}

export function modelSummary(info: ModelInfo | null): string {
  if (!info) return "no validated model";
  const rmse = info.metrics?.rmse;
  return `${info.selected} · LOSO RMSE ${rmse ?? "?"} µg/m³ · n=${info.metrics?.n_samples ?? 0}`;
}
