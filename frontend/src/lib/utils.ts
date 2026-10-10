import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPM25(v: number): string {
  return v >= 100 ? Math.round(v).toString() : v.toFixed(1);
}

export function formatCount(v: number): string {
  return v.toLocaleString("en-IN");
}

export type AqiBand = "good" | "moderate" | "poor" | "veryPoor" | "severe";

/** CPCB-style PM2.5 banding (24h). */
export function categoryOf(pm25: number): AqiBand {
  if (pm25 <= 30) return "good";
  if (pm25 <= 60) return "moderate";
  if (pm25 <= 90) return "poor";
  if (pm25 <= 120) return "veryPoor";
  return "severe";
}
