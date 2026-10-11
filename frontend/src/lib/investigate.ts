import type { Confidence } from "@/lib/types";

export const CONFIDENCE_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function confidenceTone(c: Confidence): "good" | "moderate" | "veryPoor" {
  return c === "high" ? "good" : c === "medium" ? "moderate" : "veryPoor";
}

/** Transparent ranking: by confidence score, then by inverse distance. */
export function sortHypotheses<T extends { score: number; source: { distance_km: number } }>(
  list: T[]
): T[] {
  return [...list].sort((a, b) => b.score - a.score || a.source.distance_km - b.source.distance_km);
}

const CAUSAL_PHRASES = [
  "caused by",
  "is the cause",
  "caused the",
  "confirmed source",
  "proven to be",
  "definitely from",
  "this source caused",
];

/** Honesty guard: flags causal language that must never appear in attribution output. */
export function hasCausalLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return CAUSAL_PHRASES.some((p) => lower.includes(p));
}

export function summariseHypotheses(count: number, topConfidence: Confidence | null): string {
  if (!count) return "no candidate sources found within the search radius";
  return `${count} candidate source${count === 1 ? "" : "s"} ranked${
    topConfidence ? `; strongest association is ${CONFIDENCE_LABEL[topConfidence]} confidence` : ""
  }`;
}
