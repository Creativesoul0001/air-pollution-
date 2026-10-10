import { categoryOf } from "./utils";

export type Band = "good" | "moderate" | "poor" | "veryPoor" | "severe";

export interface PollutantMeta {
  key: string;
  label: string;
  unit: string;
  color: string;
}

/** Only pollutants actually returned by the configured provider (Open-Meteo current). */
export const POLLUTANTS: PollutantMeta[] = [
  { key: "pm2_5", label: "PM2.5", unit: "µg/m³", color: "var(--dd-accent)" },
  { key: "pm10", label: "PM10", unit: "µg/m³", color: "var(--dd-accent2)" },
  { key: "no2", label: "NO₂", unit: "µg/m³", color: "var(--dd-purple)" },
  { key: "so2", label: "SO₂", unit: "µg/m³", color: "var(--dd-warn)" },
  { key: "o3", label: "O₃", unit: "µg/m³", color: "#f472b6" },
  { key: "co", label: "CO", unit: "µg/m³", color: "#94a3b8" },
];

export function pollutantMeta(key: string): PollutantMeta {
  return (
    POLLUTANTS.find((p) => p.key === key) ?? { key, label: key, unit: "µg/m³", color: "var(--dd-muted)" }
  );
}

const BAND_STYLE: Record<Band, { label: string; color: string; tone: "good" | "moderate" | "poor" | "veryPoor" | "severe" }> = {
  good: { label: "Good", color: "var(--dd-accent)", tone: "good" },
  moderate: { label: "Moderate", color: "var(--dd-warn)", tone: "moderate" },
  poor: { label: "Poor", color: "#fb923c", tone: "poor" },
  veryPoor: { label: "Very Poor", color: "var(--dd-crit)", tone: "veryPoor" },
  severe: { label: "Severe", color: "#b91c1c", tone: "severe" },
};

export function bandStyle(band: Band) {
  return BAND_STYLE[band];
}

/**
 * CPCB PM2.5 (24h) sub-index via documented piecewise-linear breakpoints.
 * Breakpoints: (C_lo, C_hi, I_lo, I_hi).
 */
const PM25_BREAKS: [number, number, number, number][] = [
  [0, 30, 0, 50],
  [30, 60, 51, 100],
  [60, 90, 101, 200],
  [90, 120, 201, 300],
  [120, 250, 301, 400],
  [250, 1000, 401, 500],
];

export function pm25ToSubIndex(pm25: number): number {
  const c = Math.max(0, pm25);
  for (const [cLo, cHi, iLo, iHi] of PM25_BREAKS) {
    if (c <= cHi) {
      const idx = ((iHi - iLo) / (cHi - cLo)) * (c - cLo) + iLo;
      return Math.round(idx);
    }
  }
  return 500;
}

/** Everything the UI needs from a single PM2.5 value. */
export function aqiFromPm25(pm25: number) {
  const band = categoryOf(pm25) as Band;
  return { subIndex: pm25ToSubIndex(pm25), band, ...BAND_STYLE[band] };
}

export type DataStatus =
  | "live_observation"
  | "cached_observation"
  | "model_estimate"
  | "development_fixture"
  | "unavailable";

const STATUS_LABEL: Record<DataStatus, string> = {
  live_observation: "Live observation",
  cached_observation: "Cached observation",
  model_estimate: "Model estimate",
  development_fixture: "Development fixture",
  unavailable: "Unavailable",
};

export function statusLabel(s: DataStatus): string {
  return STATUS_LABEL[s];
}

/** Resolve the honest data-status label for the selected location.
 * Open-Meteo current readings are model assimilation (live) -> "model_estimate";
 * stored ingested rows are "cached_observation". Never claims a ground station. */
export function resolveStatus(opts: { air: boolean; ingested: boolean }): DataStatus {
  if (opts.air) return "model_estimate";
  if (opts.ingested) return "cached_observation";
  return "unavailable";
}

export function isStale(isoTime: string | null | undefined, maxAgeMinutes = 90): boolean {
  if (!isoTime) return true;
  const t = Date.parse(isoTime);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > maxAgeMinutes * 60_000;
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export function windDirToCompass(deg: number): string {
  return COMPASS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

export function hrsAgo(isoTime: string | null | undefined): string {
  if (!isoTime) return "unknown time";
  const t = Date.parse(isoTime);
  if (Number.isNaN(t)) return "unknown time";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} d ago`;
}
