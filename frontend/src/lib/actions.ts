import type { VerificationRecord } from "@/lib/types";

/** Authorized transition graph, mirroring the backend exactly. */
const ALLOWED: Record<string, string[]> = {
  open: ["assigned", "in_progress", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["pending_verification", "cancelled"],
  pending_verification: ["verified", "in_progress"],
  verified: ["closed"],
  cancelled: [],
  closed: [],
};

export const ACTION_STATUSES = Object.keys(ALLOWED);

export function statusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function statusTone(
  status: string
): "neutral" | "good" | "moderate" | "accent" | "veryPoor" {
  switch (status) {
    case "closed":
      return "good";
    case "verified":
      return "good";
    case "in_progress":
    case "pending_verification":
      return "accent";
    case "cancelled":
      return "veryPoor";
    default:
      return "neutral";
  }
}

export function allowedTransitions(status: string): string[] {
  return ALLOWED[status] ?? [];
}

/** Mirrors the backend rule; used only to disable impossible buttons client-side. */
export function canTransition(from: string, to: string): boolean {
  return allowedTransitions(from).includes(to);
}

export function isTerminal(status: string): boolean {
  return allowedTransitions(status).length === 0;
}

/** A delta is only meaningful when both measurements have provenance. */
export function verificationDelta(
  verification: Pick<VerificationRecord, "conclusion" | "delta" | "pct_change">
): { delta: number | null; pct: number | null; defensible: boolean } {
  const defensible = verification.conclusion === "measured_delta";
  return {
    delta: defensible ? verification.delta : null,
    pct: defensible ? verification.pct_change : null,
    defensible,
  };
}
